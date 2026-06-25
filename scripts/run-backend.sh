#!/usr/bin/env bash
set -euo pipefail

SERVICE="${1:-api-gateway}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export DATABASE_URL="${DATABASE_URL:-${POSTGRES_DSN:-postgres://postgres:postgres@localhost:5432/anti_vibe?sslmode=disable}}"
export POSTGRES_DSN="${POSTGRES_DSN:-${DATABASE_URL}}"
export QUEUE_URL="${QUEUE_URL:-redis://localhost:6379}"
export REDIS_ADDR="${REDIS_ADDR:-localhost:6379}"
export AUTH_JWT_HS256_SECRET="${AUTH_JWT_HS256_SECRET:-local-dev-jwt-secret-change-me}"
export JWT_SECRET="${JWT_SECRET:-${AUTH_JWT_HS256_SECRET}}"
export SERVICE_NAME="${SERVICE}"

if [[ "${SERVICE}" == "auth-service" ]]; then
  cd backend/nodejs
  sh ./scripts/ensure-deps.sh services/auth-service fastify pg @backend/microservice-sdk
  exec pnpm dev:auth
fi

if [[ "${SERVICE}" == "user-service" ]]; then
  cd backend/nodejs
  sh ./scripts/ensure-deps.sh services/user-service fastify pg @backend/microservice-sdk
  exec pnpm dev:user
fi

if [[ "${SERVICE}" == "api-gateway" ]]; then
  cd backend/nodejs
  sh ./scripts/ensure-deps.sh services/api-gateway fastify @backend/microservice-sdk
  exec pnpm dev:gateway
fi

if [[ "${SERVICE}" == "gitea-service" || "${SERVICE}" == "gitea-reader-service" ]]; then
  cd backend/nodejs
  sh ./scripts/ensure-deps.sh services/gitea-service fastify pg @backend/microservice-sdk
  exec pnpm dev:gitea
fi

if [[ "${SERVICE}" == "exam-service" ]]; then
  cd backend/nodejs
  sh ./scripts/ensure-deps.sh services/exam-service fastify @backend/microservice-sdk
  exec pnpm dev:exam
fi

if [[ "${SERVICE}" == "tomorrow-service" ]]; then
  cd backend/nodejs
  sh ./scripts/ensure-deps.sh services/tomorrow-service fastify @backend/microservice-sdk
  exec pnpm dev:tomorrow
fi

if [[ "${SERVICE}" == "worker-service" ]]; then
  cd backend/nodejs
  sh ./scripts/ensure-deps.sh services/worker-service fastify pg redis @backend/microservice-sdk
  exec pnpm dev:worker
fi

cd backend
go run "./cmd/${SERVICE}"
