#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! npx --no-install vitest --version >/dev/null 2>&1; then
  echo "Vitest is required for frontend integration tests. Install dev dependencies with npm install when registry access is available." >&2
  exit 1
fi

npx --no-install vitest run "tests/integration/**/*.integration.test.tsx" --environment jsdom
