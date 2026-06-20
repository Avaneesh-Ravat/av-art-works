# AV Art Works

A production-grade, cost-effective e-commerce platform for selling paintings and
artwork (resin art, texture art, acrylic, customized, and handmade pieces).

Built as 4 Go microservices behind an API gateway, with a React + TypeScript
frontend, PostgreSQL, Redis, and AWS infrastructure (ECS Fargate + Terraform).

## Architecture (summary)

| Service | Port | Responsibility |
|---|---|---|
| Gateway | 8080 | Public entry: routing, auth, rate limiting, CORS |
| User Service | 8081 | Registration, login, JWT, profile, addresses, roles |
| Catalog Service | 8082 | Products, categories, inventory, search/filter |
| Order Service | 8083 | Cart, wishlist, checkout, orders |
| Payment Service | 8084 | Payments (mocked Indian gateway), refunds |

- **Datastore:** single PostgreSQL instance, one schema per service (`user_svc`, `catalog_svc`, ...).
- **Cache/eventing:** Redis (cache, refresh tokens, rate limiting, pub/sub).
- **Comms:** synchronous REST between services + Redis pub/sub for light events.

## Local development

Prerequisites: Go 1.24+, Docker, Node 20+.

```bash
cp .env.example .env          # adjust if needed
make up                       # start postgres + redis
make tidy                     # fetch Go dependencies
make run-user                 # run the user-service (migrates on boot)
```

Then visit `http://localhost:8081/healthz`.

## Repository layout

```
services/        Go microservices (clean architecture per service)
pkg/             Shared Go libraries (config, logger, db, auth, httpx, eventbus)
web/             React + TypeScript frontend (Vite)
deploy/k8s/      Kubernetes manifests
deploy/terraform/ AWS infrastructure as code
docs/            Architecture, API, and deployment docs
.github/         CI/CD pipelines
```

## Status

Built incrementally (MVP-first). See `docs/` for the full architecture, AWS
cost analysis, and roadmap.
