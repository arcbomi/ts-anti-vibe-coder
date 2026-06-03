#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Running backend integration tests against PostgreSQL and Redis."
echo "Set TEST_DATABASE_URL and TEST_REDIS_ADDR to use dedicated test services."

go test -count=1 -tags=integration ./tests/integration
