#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if command -v docker >/dev/null 2>&1; then
  docker compose -f docker-compose.infra.yml up -d
  ./scripts/run-migrations.sh
else
  echo "Docker is not available; assuming PostgreSQL and Redis are already running."
fi

export TEST_DATABASE_URL="${TEST_DATABASE_URL:-${DATABASE_URL:-${POSTGRES_DSN:-postgres://postgres:postgres@localhost:5432/anti_vibe?sslmode=disable}}}"
export TEST_REDIS_ADDR="${TEST_REDIS_ADDR:-${REDIS_ADDR:-localhost:6379}}"
cd backend
go test -count=1 -tags=integration ./tests/integration
