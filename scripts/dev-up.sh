#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example. Update secrets such as GITEA_BOT_TOKEN and AI_API_KEY when needed."
fi

docker compose -f docker-compose.yml -f docker-compose.infra.yml up --build
