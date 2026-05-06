#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
APP_ROOT="$ROOT_DIR"

if [[ -d "$ROOT_DIR/api/dist" && -d "$ROOT_DIR/web" ]]; then
  API_DIST_DIR="$ROOT_DIR/api/dist"
  WEB_DIST_DIR_DEFAULT="$ROOT_DIR/web"
  MIGRATIONS_ENTRY="$ROOT_DIR/api/dist/database/migrate.js"
else
  API_DIST_DIR="$ROOT_DIR/apps/api/dist"
  WEB_DIST_DIR_DEFAULT="$ROOT_DIR/apps/web/dist"
  MIGRATIONS_ENTRY="$ROOT_DIR/apps/api/dist/database/migrate.js"
fi

RUNTIME_DIR="${RUNTIME_DIR:-$APP_ROOT/runtime}"
LOG_DIR="$RUNTIME_DIR/logs"
PID_DIR="$RUNTIME_DIR/pids"
ENV_FILE="${ENV_FILE:-$APP_ROOT/.env}"
mkdir -p "$LOG_DIR" "$PID_DIR"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export WEB_DIST_DIR="${WEB_DIST_DIR:-$WEB_DIST_DIR_DEFAULT}"
export STORAGE_ROOT="${STORAGE_ROOT:-$APP_ROOT/storage}"

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "Missing required file: $1" >&2
    exit 1
  fi
}

start_process() {
  local name="$1"
  local pid_file="$2"
  local log_file="$3"
  shift 3

  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "$name is already running with PID $(cat "$pid_file")"
    return
  fi

  nohup "$@" >>"$log_file" 2>&1 &
  echo $! >"$pid_file"
  echo "Started $name with PID $(cat "$pid_file")"
}

require_file "$API_DIST_DIR/main.js"
require_file "$API_DIST_DIR/workers/all-workers.js"
require_file "$MIGRATIONS_ENTRY"

echo "Running migrations..."
node "$MIGRATIONS_ENTRY"

start_process "api" "$PID_DIR/api.pid" "$LOG_DIR/api.log" node "$API_DIST_DIR/main.js"
start_process "workers" "$PID_DIR/workers.pid" "$LOG_DIR/workers.log" node "$API_DIST_DIR/workers/all-workers.js"

echo "Stack started."
echo "Web: http://127.0.0.1:${API_PORT:-3000}/"
echo "Health: http://127.0.0.1:${API_PORT:-3000}/health"
