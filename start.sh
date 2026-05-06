#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/logs"

APP_ENV="${SMART_ERD_ENV:-dev}"
BACKEND_PORT="${SERVER_PORT:-}"
FRONTEND_PORT="${VITE_DEV_SERVER_PORT:-}"
FRONTEND_HOST="${VITE_DEV_SERVER_HOST:-127.0.0.1}"

usage() {
  cat <<EOF
Usage: ./start.sh [options]

Options:
  -e, --env ENV              Execution environment: dev, local, test (default: dev)
  -b, --backend-port PORT    Backend port (default: env-specific)
  -f, --frontend-port PORT   Frontend port (default: env-specific)
  -h, --frontend-host HOST   Frontend host (default: 127.0.0.1)
      --help                 Show this help

Examples:
  ./start.sh
  ./start.sh --env local
  ./start.sh --env test --backend-port 9512 --frontend-port 4512
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
    -h|--frontend-host)
      [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }
      FRONTEND_HOST="$2"
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

case "$APP_ENV" in
  dev)
    : "${BACKEND_PORT:=9503}"
    : "${FRONTEND_PORT:=4503}"
    BACKEND_SCRIPT="./bootRun-dev.sh"
    FRONTEND_SCRIPT="dev"
    ;;
  local)
    : "${BACKEND_PORT:=9501}"
    : "${FRONTEND_PORT:=4501}"
    BACKEND_SCRIPT="./bootRun-local.sh"
    FRONTEND_SCRIPT="local"
    ;;
  test)
    : "${BACKEND_PORT:=9502}"
    : "${FRONTEND_PORT:=4502}"
    BACKEND_SCRIPT="./bootRun-test.sh"
    FRONTEND_SCRIPT="test:frontend"
    ;;
  *)
    echo "Unsupported environment: $APP_ENV (expected: dev, local, test)" >&2
    exit 2
    ;;
esac

INSTANCE=$(printf '%s-%s-%s' "$APP_ENV" "$BACKEND_PORT" "$FRONTEND_PORT" | tr -c 'A-Za-z0-9_.-' '_')
BACKEND_LOG="$LOG_DIR/backend.$INSTANCE.log"
FRONTEND_LOG="$LOG_DIR/frontend.$INSTANCE.log"
BACKEND_PID_FILE="$RUN_DIR/backend.$INSTANCE.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.$INSTANCE.pid"

is_running() {
  [ -f "$1" ] || return 1
  pid=$(cat "$1" 2>/dev/null || true)
  [ -n "$pid" ] || return 1
  kill -0 "$pid" 2>/dev/null
}

start_backend() {
  if is_running "$BACKEND_PID_FILE"; then
    echo "Backend already running (pid $(cat "$BACKEND_PID_FILE"))."
    return
  fi

  echo "Starting backend [$APP_ENV] on http://localhost:$BACKEND_PORT ..."
  nohup sh -c 'cd "$1" && SERVER_PORT="$2" exec "$3"' \
    sh "$ROOT_DIR" "$BACKEND_PORT" "$BACKEND_SCRIPT" >"$BACKEND_LOG" 2>&1 &
  echo "$!" >"$BACKEND_PID_FILE"
}

start_frontend() {
  if is_running "$FRONTEND_PID_FILE"; then
    echo "Frontend already running (pid $(cat "$FRONTEND_PID_FILE"))."
    return
  fi

  echo "Starting frontend [$APP_ENV] on http://$FRONTEND_HOST:$FRONTEND_PORT ..."
  nohup sh -c 'cd "$1/client" && VITE_DEV_SERVER_PORT="$2" VITE_API_PROXY_TARGET="http://localhost:$3" VITE_WS_PROXY_TARGET="ws://localhost:$3" exec npm run "$4" -- --host "$5"' \
    sh "$ROOT_DIR" "$FRONTEND_PORT" "$BACKEND_PORT" "$FRONTEND_SCRIPT" "$FRONTEND_HOST" >"$FRONTEND_LOG" 2>&1 &
  echo "$!" >"$FRONTEND_PID_FILE"
}

print_recent_log() {
  name="$1"
  log_file="$2"

  echo ""
  echo "$name exited during startup. Recent log:"
  if [ -s "$log_file" ]; then
    tail -40 "$log_file"
  else
    echo "(log is empty)"
  fi
}

verify_started() {
  failed=false

  sleep 2

  if ! is_running "$BACKEND_PID_FILE"; then
    print_recent_log "Backend" "$BACKEND_LOG"
    rm -f "$BACKEND_PID_FILE"
    failed=true
  fi

  if ! is_running "$FRONTEND_PID_FILE"; then
    print_recent_log "Frontend" "$FRONTEND_LOG"
    rm -f "$FRONTEND_PID_FILE"
    failed=true
  fi

  if [ "$failed" = true ]; then
    echo ""
    echo "Startup failed. Stop any remaining process with: ./stop.sh"
    exit 1
  fi
}

mkdir -p "$RUN_DIR" "$LOG_DIR"

start_backend
start_frontend
verify_started

cat <<EOF

Smart ERD started.
- Env:      $APP_ENV
- Backend:  http://localhost:$BACKEND_PORT
- Frontend: http://$FRONTEND_HOST:$FRONTEND_PORT
- Logs:     $LOG_DIR

Stop with: ./stop.sh --env $APP_ENV --backend-port $BACKEND_PORT --frontend-port $FRONTEND_PORT
EOF
