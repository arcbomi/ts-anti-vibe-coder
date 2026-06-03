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

export DATABASE_URL="${DATABASE_URL:-${POSTGRES_DSN:-postgres://postgres:postgres@localhost:5432/anti_vibe?sslmode=disable}}"
cd backend
go run ./cmd/migrate up
