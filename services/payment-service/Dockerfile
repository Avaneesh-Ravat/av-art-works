# Multi-stage build. Build context is the repository root.
FROM golang:1.24-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" \
    -o /out/payment-service ./services/payment-service/cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/payment-service /app/payment-service
USER nonroot:nonroot
EXPOSE 8084
ENTRYPOINT ["/app/payment-service"]
