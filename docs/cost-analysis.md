# AWS Cost Analysis

Target workload: an art e-commerce site with light traffic (~100 visitors/hour
peak, ~72k visits/month max). At this scale cost is driven by **architecture
choices, not load**. Region: **Mumbai (ap-south-1)**. FX: **~₹86/USD** (2026).

## Recommended: single-host deployment (what this repo deploys)

All services + Postgres + Redis + nginx on one Graviton EC2 box; images in S3
served through Cloudflare's free CDN.

| Component | Spec | ₹ / month |
|---|---|---|
| EC2 (all containers) | `t4g.small` (2 vCPU, 2 GB ARM) | ~1,055 |
| EBS root volume | 30 GB gp3, encrypted | ~210 |
| Elastic IP | free while attached | 0 |
| S3 storage | a few GB of images | ~15–30 |
| S3 → CloudFront/Cloudflare egress | images cached at edge | ~0 |
| Data transfer | light | ~100 |
| Domain | `.com`/`.in` (amortised) | ~100 |
| DNS + TLS + CDN | Cloudflare free plan | 0 |
| GitHub Actions CI/CD | free tier | 0 |
| **Total** | | **~₹1,450 / month** |

### Levers to go lower
- **`t4g.micro` (1 GB)** + swap → ~₹850/mo (tight with Postgres + Redis co-located).
- **1-year Savings Plan / Reserved Instance** → ~30–40% off the EC2 line.
- **AWS Free Tier (new accounts)** → ~₹0 for EC2/EBS for the first 12 months.
- **Cloudflare R2** instead of S3 → zero egress fees ever (works with the
  existing S3 code via a custom endpoint).

## For comparison: full managed microservices (the README's "textbook" build)

| Component | ₹ / month |
|---|---|
| 5× Fargate tasks (24×7, smallest size) | ~4,450 |
| Application Load Balancer | ~1,750 |
| RDS PostgreSQL (db.t4g.micro, single-AZ) | ~1,250 |
| ElastiCache Redis (cache.t4g.micro) | ~1,050 |
| S3 + CloudFront | ~200 |
| NAT Gateway (if private subnets) | ~3,500 |
| Misc (ECR, logs) | ~350 |
| **Total** | **~₹9,000–12,500 / month** |

The two biggest avoidable costs there are the **NAT Gateway** and running **5
always-on tasks** — neither is justified at 100 users/hour.

## When to graduate from the single host

Move pieces out only when traffic/availability needs it, in this order:
1. **Postgres → RDS** (managed backups, multi-AZ) — first thing to externalise.
2. **Redis → ElastiCache**.
3. **Split services onto ECS/Fargate + ALB** once a single box is saturated.

Each step is config-only thanks to the 12-factor env setup; no code rewrite.
