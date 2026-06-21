output "public_ip" {
  description = "Elastic IP of the host. Point your DNS A record (@ and www) here."
  value       = aws_eip.app.public_ip
}

output "ssh_command" {
  description = "Convenience SSH command (assumes your private key matches ssh_public_key)."
  value       = "ssh ec2-user@${aws_eip.app.public_ip}"
}

output "image_bucket" {
  description = "S3 bucket name for product images. Set this as S3_BUCKET in the server .env."
  value       = aws_s3_bucket.images.bucket
}

output "region" {
  description = "AWS region. Set this as AWS_REGION in the server .env."
  value       = var.region
}
