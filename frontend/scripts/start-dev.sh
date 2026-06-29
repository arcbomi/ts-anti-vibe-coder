#!/bin/sh
set -eu

LOCKFILE_PATH="/app/frontend/package-lock.json"
LOCKFILE_HASH_PATH="/app/frontend/node_modules/.package-lock.sha256"

install_dependencies() {
  attempt=1
  max_attempts=5

  while [ "$attempt" -le "$max_attempts" ]; do
    if npm ci; then
      sha256sum "$LOCKFILE_PATH" | awk '{print $1}' > "$LOCKFILE_HASH_PATH"
      return 0
    fi

    if [ "$attempt" -eq "$max_attempts" ]; then
      echo "npm ci failed after $max_attempts attempts." >&2
      return 1
    fi

    sleep_seconds=$((attempt * 5))
    echo "npm ci failed on attempt $attempt/$max_attempts. Retrying in ${sleep_seconds}s..." >&2
    attempt=$((attempt + 1))
    sleep "$sleep_seconds"
  done
}

mkdir -p /app/frontend/node_modules

current_hash="$(sha256sum "$LOCKFILE_PATH" | awk '{print $1}')"
stored_hash=""

if [ -f "$LOCKFILE_HASH_PATH" ]; then
  stored_hash="$(cat "$LOCKFILE_HASH_PATH")"
fi

if [ ! -d /app/frontend/node_modules/vite ] || [ "$current_hash" != "$stored_hash" ]; then
  install_dependencies
fi

exec npm run dev -- --host 0.0.0.0
