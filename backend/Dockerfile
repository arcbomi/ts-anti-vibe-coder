# syntax=docker/dockerfile:1

FROM golang:1.24 AS base
WORKDIR /app/backend
COPY go.mod go.sum ./
RUN go mod download

FROM base AS dev
COPY . .
CMD ["go", "run", "./cmd/ai-analysis-service"]

FROM base AS build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/ai-analysis-service ./cmd/ai-analysis-service \
  && CGO_ENABLED=0 GOOS=linux go build -o /out/scheduler-service ./cmd/scheduler-service \
  && CGO_ENABLED=0 GOOS=linux go build -o /out/migrate ./cmd/migrate

FROM gcr.io/distroless/static-debian12 AS runtime
WORKDIR /app/backend
COPY --from=build /out/ /usr/local/bin/
COPY migrations ./migrations
USER nonroot:nonroot
CMD ["/usr/local/bin/ai-analysis-service"]
