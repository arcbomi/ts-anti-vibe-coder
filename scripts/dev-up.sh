#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example. Update secrets such as AI_API_KEY when needed."
fi

if [[ "$#" -eq 0 ]]; then
  docker compose up --build
  exit 0
fi

BASE_SERVICES=(nodejs-deps mongodb redis redpanda)

docker compose up --build "${BASE_SERVICES[@]}" "$@"
