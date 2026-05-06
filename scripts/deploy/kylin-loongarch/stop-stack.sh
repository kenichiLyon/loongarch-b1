#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RUNTIME_DIR="${RUNTIME_DIR:-$ROOT_DIR/runtime}"
PID_DIR="$RUNTIME_DIR/pids"

stop_process() {
  local name="$1"
  local pid_file="$2"
  if [[ ! -f "$pid_file" ]]; then
    echo "$name is not running"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    echo "Stopped $name (PID $pid)"
  else
    echo "$name pid file exists but process $pid is not running"
  fi
  rm -f "$pid_file"
}

stop_process "workers" "$PID_DIR/workers.pid"
stop_process "api" "$PID_DIR/api.pid"
