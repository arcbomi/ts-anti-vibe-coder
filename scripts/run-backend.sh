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

cd backend
go run "./cmd/${SERVICE}"
