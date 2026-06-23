data "aws_caller_identity" "current" {}

# Latest Amazon Linux 2023 ARM64 AMI (matches t4g/Graviton instances).
data "aws_ami" "al2023_arm" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-arm64"]
  }
  filter {
    name   = "architecture"
    values = ["arm64"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  bucket_name = var.image_bucket_name != "" ? var.image_bucket_name : "${var.project}-images-${data.aws_caller_identity.current.account_id}"
  tags        = merge({ Project = var.project, ManagedBy = "terraform" }, var.tags)
}

############################################
# Networking: a small dedicated VPC with one public subnet + internet gateway.
# (Self-contained so it doesn't depend on the account's default VPC state.)
############################################
data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "this" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(local.tags, { Name = "${var.project}-vpc" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.tags, { Name = "${var.project}-igw" })
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.this.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true
  tags                    = merge(local.tags, { Name = "${var.project}-public" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = merge(local.tags, { Name = "${var.project}-public" })
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "app" {
  name        = "${var.project}-app"
  description = "Public web + restricted SSH for the ${var.project} single-host deployment."
  vpc_id      = aws_vpc.this.id
  tags        = local.tags

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_ingress_cidr]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

############################################
# S3 bucket for product images (kept private).
############################################
resource "aws_s3_bucket" "images" {
  bucket = local.bucket_name
  tags   = local.tags
}

resource "aws_s3_bucket_public_access_block" "images" {
  bucket                  = aws_s3_bucket.images.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "images" {
  bucket = aws_s3_bucket.images.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# CORS: browsers PUT directly to S3 via presigned URLs from the admin UI.
resource "aws_s3_bucket_cors_configuration" "images" {
  bucket = aws_s3_bucket.images.id

  cors_rule {
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

############################################
# IAM: instance role granting S3 access (no static keys on the box).
############################################
data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "${var.project}-app"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags               = local.tags
}

data "aws_iam_policy_document" "s3_access" {
  statement {
    sid       = "ObjectAccess"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.images.arn}/*"]
  }
  statement {
    sid       = "BucketList"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.images.arn]
  }
}

resource "aws_iam_role_policy" "s3_access" {
  name   = "${var.project}-s3-access"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.s3_access.json
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.project}-app"
  role = aws_iam_role.app.name
}

############################################
# Compute: single Graviton EC2 host running the Docker stack.
############################################
resource "aws_key_pair" "app" {
  key_name   = "${var.project}-key"
  public_key = var.ssh_public_key
  tags       = local.tags
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.al2023_arm.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.app.key_name
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name
  user_data              = file("${path.module}/user_data.sh")

  # Hop limit 2 lets Docker containers reach IMDSv2 to assume the instance role.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_gb
    encrypted   = true
  }

  # The AMI data source tracks "most_recent", so a newer Amazon Linux image would
  # otherwise force-replace this instance on a routine `terraform apply`, wiping
  # the on-box Docker volumes (Postgres data). Ignore AMI drift so the instance is
  # only rebuilt intentionally (e.g. taint/replace). Networking + DB data stay put.
  lifecycle {
    ignore_changes = [ami]
  }

  tags = merge(local.tags, { Name = "${var.project}-app" })
}

resource "aws_eip" "app" {
  instance   = aws_instance.app.id
  domain     = "vpc"
  depends_on = [aws_internet_gateway.this]
  tags       = merge(local.tags, { Name = "${var.project}-eip" })
}
