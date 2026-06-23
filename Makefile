.PHONY: help tidy build test lint run-user up down logs fmt

help:
	@echo "Targets:"
	@echo "  tidy      - go mod tidy"
	@echo "  build     - build all Go services"
	@echo "  test      - run Go unit tests"
	@echo "  fmt       - gofmt all packages"
	@echo "  run-user  - run the user-service locally"
	@echo "  up        - start local infra (postgres + redis) via docker compose"
	@echo "  down      - stop local infra"
	@echo "  logs      - tail docker compose logs"

tidy:
	go mod tidy

build:
	go build ./pkg/... ./services/...

test:
	go test ./pkg/... ./services/...

fmt:
	gofmt -w ./pkg ./services

lint:
	go vet ./pkg/... ./services/...

run-user:
	go run ./services/user-service/cmd/server

up:
	docker compose up -d postgres redis

down:
	docker compose down

logs:
	docker compose logs -f
