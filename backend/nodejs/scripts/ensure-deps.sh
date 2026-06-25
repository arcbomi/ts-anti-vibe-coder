#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
LOCK_DIR="$ROOT_DIR/node_modules/.install-lock"
STAMP_FILE="$ROOT_DIR/node_modules/.install-complete"
SERVICE_PATH="${1:-}"

if [ -n "$SERVICE_PATH" ]; then
  shift
fi

has_required_packages() {
  [ -f "$ROOT_DIR/node_modules/tsx/package.json" ] || return 1

  if [ -n "$SERVICE_PATH" ]; then
    [ -d "$ROOT_DIR/$SERVICE_PATH/node_modules" ] || return 1
  fi

  for package_name in "$@"; do
    if [ -n "$SERVICE_PATH" ]; then
      [ -f "$ROOT_DIR/$SERVICE_PATH/node_modules/$package_name/package.json" ] || return 1
    else
      [ -f "$ROOT_DIR/node_modules/$package_name/package.json" ] || return 1
    fi
  done

  return 0
}

install_dependencies() {
  cd "$ROOT_DIR"
  corepack enable
  pnpm install --no-frozen-lockfile --config.confirmModulesPurge=false
  touch "$STAMP_FILE"
}

mkdir -p "$ROOT_DIR/node_modules"

if has_required_packages "$@"; then
  touch "$STAMP_FILE"
  exit 0
fi

while ! mkdir "$LOCK_DIR" 2>/dev/null; do
  if has_required_packages "$@"; then
    touch "$STAMP_FILE"
    exit 0
  fi
  sleep 1
done

cleanup() {
  rmdir "$LOCK_DIR"
}

trap cleanup EXIT INT TERM

if ! has_required_packages "$@"; then
  install_dependencies
fi
