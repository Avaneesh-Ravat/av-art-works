variable "region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "ap-south-1"
}

variable "project" {
  description = "Name prefix for all resources."
  type        = string
  default     = "avartworks"
}

variable "instance_type" {
  description = "EC2 instance type (ARM/Graviton). t4g.small is the cost-effective floor for this stack."
  type        = string
  default     = "t4g.small"
}

variable "root_volume_gb" {
  description = "Root EBS volume size in GB."
  type        = number
  default     = 30
}

variable "ssh_public_key" {
  description = "SSH public key material (e.g. contents of ~/.ssh/id_ed25519.pub) used to log into the box."
  type        = string
}

variable "ssh_ingress_cidr" {
  description = "CIDR allowed to SSH (port 22). Lock this to your IP, e.g. 203.0.113.4/32."
  type        = string
  default     = "0.0.0.0/0"
}

variable "image_bucket_name" {
  description = "Globally-unique S3 bucket name for product images. Defaults to <project>-images-<account-id>."
  type        = string
  default     = ""
}

variable "cors_allowed_origins" {
  description = "Origins allowed to upload directly to S3 via presigned PUT (your site domain). e.g. https://avartworks.in"
  type        = list(string)
  default     = ["*"]
}

variable "tags" {
  description = "Extra tags applied to all resources."
  type        = map(string)
  default     = {}
}
