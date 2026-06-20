# Multi-stage build. Build context is the repository root.
FROM golang:1.24-alpine AS build
WORKDIR /src

# Cache dependencies.
COPY go.mod go.sum ./
RUN go mod download

# Build the service binary.
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" \
    -o /out/user-service ./services/user-service/cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/user-service /app/user-service
USER nonroot:nonroot
EXPOSE 8081
ENTRYPOINT ["/app/user-service"]
