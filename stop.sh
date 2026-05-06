#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
RUN_DIR="$ROOT_DIR/.run"

APP_ENV=""
BACKEND_PORT=""
FRONTEND_PORT=""

usage() {
  cat <<EOF
Usage: ./stop.sh [options]

Options:
  -e, --env ENV              Execution environment used by start.sh
  -b, --backend-port PORT    Backend port used by start.sh
  -f, --frontend-port PORT   Frontend port used by start.sh
      --help                 Show this help

Without options, stops all Smart ERD instances recorded under .run/.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    -e|--env)
      [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }
      APP_ENV="$2"
      shift 2
      ;;
    -b|--backend-port)
      [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }
      BACKEND_PORT="$2"
      shift 2
      ;;
    -f|--frontend-port)
      [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }
      FRONTEND_PORT="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

instance_from_args() {
  [ -n "$APP_ENV" ] || return 1
  [ -n "$BACKEND_PORT" ] || return 1
  [ -n "$FRONTEND_PORT" ] || return 1
  printf '%s-%s-%s' "$APP_ENV" "$BACKEND_PORT" "$FRONTEND_PORT" | tr -c 'A-Za-z0-9_.-' '_'
}

kill_tree() {
  pid="$1"

  children=$(ps -ax -o pid= -o ppid= 2>/dev/null | awk -v parent="$pid" '$2 == parent { print $1 }')
  for child in $children; do
    kill_tree "$child"
  done

  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
  fi
}

wait_for_exit() {
  pid="$1"
  count=0
  while kill -0 "$pid" 2>/dev/null && [ "$count" -lt 20 ]; do
    count=$((count + 1))
    sleep 0.25
  done

  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
}

stop_service() {
  name="$1"
  pid_file="$2"

  if [ ! -f "$pid_file" ]; then
    echo "$name is not running (no pid file)."
    return
  fi

  pid=$(cat "$pid_file" 2>/dev/null || true)
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    echo "$name is not running (stale pid file)."
    rm -f "$pid_file"
    return
  fi

  echo "Stopping $name (pid $pid) ..."
  kill_tree "$pid"
  wait_for_exit "$pid"
  rm -f "$pid_file"
}

if INSTANCE=$(instance_from_args); then
  stop_service "Frontend [$INSTANCE]" "$RUN_DIR/frontend.$INSTANCE.pid"
  stop_service "Backend [$INSTANCE]" "$RUN_DIR/backend.$INSTANCE.pid"
else
  found=false
  for pid_file in "$RUN_DIR"/frontend.*.pid "$RUN_DIR"/frontend.pid; do
    [ -f "$pid_file" ] || continue
    found=true
    stop_service "Frontend" "$pid_file"
  done
  for pid_file in "$RUN_DIR"/backend.*.pid "$RUN_DIR"/backend.pid; do
    [ -f "$pid_file" ] || continue
    found=true
    stop_service "Backend" "$pid_file"
  done

  if [ "$found" = false ]; then
    echo "No Smart ERD pid files found."
  fi
fi

echo "Smart ERD stopped."
