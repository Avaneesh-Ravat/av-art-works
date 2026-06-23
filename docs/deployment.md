# Deployment

This deploys the whole stack (5 Go services + Postgres + Redis + nginx/SPA) onto
a **single Graviton EC2 host** using Docker Compose, with product images in a
private **S3** bucket. It is the cost-optimised setup (~₹1,350–1,450/month; see
[`cost-analysis.md`](./cost-analysis.md)).

```
Internet ──> Cloudflare (DNS + TLS + CDN, free) ──> EC2 :80
                                                     └─ web (nginx) ── /api ─> gateway ─> services
                                                                       Postgres + Redis (containers)
                                                     services ── IAM role ─> S3 (images, private)
```

## Prerequisites

- An AWS account + the AWS CLI configured locally (`aws configure`).
- [Terraform](https://developer.hashicorp.com/terraform/downloads) ≥ 1.5.
- An SSH key pair: `ssh-keygen -t ed25519 -f ~/.ssh/avartworks`.
- A domain (optional but recommended) and a free Cloudflare account.

## 1. Provision infrastructure (Terraform)

```bash
cd deploy/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: paste your PUBLIC key (~/.ssh/avartworks.pub),
# set ssh_ingress_cidr to "<your-ip>/32", and your site origins.

terraform init
terraform apply
```

This creates: a `t4g.small` EC2 host (Docker pre-installed via user-data), an
Elastic IP, a security group (80/443 open, 22 locked to your IP), a **private**
S3 bucket with CORS for uploads, and an IAM instance role granting the box S3
access (no static keys anywhere).

Note the outputs:

```bash
terraform output            # public_ip, image_bucket, region, ssh_command
```

## 2. Configure GitHub Actions secrets

In the repo: **Settings → Secrets and variables → Actions**. Add:

| Secret | Value |
|---|---|
| `SSH_HOST` | the `public_ip` output |
| `SSH_USER` | `ec2-user` |
| `SSH_PRIVATE_KEY` | contents of `~/.ssh/avartworks` (the private key) |
| `PROD_ENV` | the full production `.env` file contents (see below) |

The `PROD_ENV` secret is the server-side `.env`. Base it on `.env.example`'s
production section:

```dotenv
POSTGRES_PASSWORD=<openssl rand -base64 32>
JWT_SECRET=<openssl rand -base64 32>
INTERNAL_TOKEN=<openssl rand -base64 32>
CORS_ALLOWED_ORIGINS=https://avartworks.in,https://www.avartworks.in
ADMIN_EMAIL=admin@avartworks.in
ADMIN_PASSWORD=<strong-password>
RAZORPAY_KEY_ID=<real-or-mock>
RAZORPAY_KEY_SECRET=<real-or-mock>
RAZORPAY_WEBHOOK_SECRET=<real-or-mock>
S3_BUCKET=<image_bucket output>
AWS_REGION=ap-south-1
MEDIA_PUBLIC_BASE_URL=/api/v1/media
```

## 3. Deploy

Push to `main` (CI runs first; deploy runs on success), or trigger **Deploy**
manually from the Actions tab. The pipeline:

1. **Builds all app images in GitHub Actions** (linux/arm64) and pushes them to
   GHCR (`ghcr.io/<owner>/av-art-works-*`).
2. Rsyncs compose/config to the box (no compiling on the server).
3. Pulls the tagged images and runs `docker compose up -d`.

This keeps heavy Go/npm builds off the small EC2 host so deploys do not wedge SSH.

First boot after provisioning still needs one successful deploy so images exist in
GHCR. DB migrations run automatically when each service starts.

### Manual deploy (no GitHub Actions)

Log into GHCR on the box (needs a GitHub PAT with `read:packages`), set
`IMAGE_TAG` and `GHCR_OWNER` in `/opt/avartworks/.env`, then:

```bash
ssh ec2-user@<public_ip>
cd /opt/avartworks
docker compose -f docker-compose.prod.yml --env-file .env pull
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

## 4. Domain + HTTPS (Cloudflare, free)

1. Add your domain to Cloudflare; point its nameservers at Cloudflare.
2. Create a DNS **A record** `@` → `<public_ip>` (proxied / orange cloud). Add
   `www` as a CNAME to the apex (or another A record).
3. SSL/TLS mode: **Full**. For a proper origin cert, create a Cloudflare Origin
   Certificate and terminate TLS on the box (add a 443 server block); the simple
   path is Cloudflare-terminated TLS to an HTTP origin on :80.
4. Ensure `CORS_ALLOWED_ORIGINS` in `PROD_ENV` matches your domain.

Cloudflare also caches `/api/v1/media/*` (the painting images), so image
bandwidth is served from the edge for free.

## Operations

- **Logs:** `docker compose -f docker-compose.prod.yml logs -f <service>`
- **Restart:** `docker compose -f docker-compose.prod.yml restart <service>`
- **DB backup:** `docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U avart avartworks | gzip > backup-$(date +%F).sql.gz`
  (schedule via cron and copy to S3 for off-box safety).
- **Tear down everything:** `cd deploy/terraform && terraform destroy` (stops all
  AWS charges; the S3 bucket must be empty first).
