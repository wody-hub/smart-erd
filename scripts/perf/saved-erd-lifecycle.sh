#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
: "${ERD_PERF_ACTION:?ERD_PERF_ACTION is required}"
: "${ERD_PERF_RUN_DB:?ERD_PERF_RUN_DB is required}"
: "${ERD_PERF_BACKEND_PORT:?ERD_PERF_BACKEND_PORT is required}"
: "${CLONE_NAME:?CLONE_NAME is required}"
: "${CLONE_PASSWORD:?CLONE_PASSWORD is required}"
: "${CLONE_PORT:?CLONE_PORT is required}"
clone_user="${CLONE_USER:-smarterd}"

case "$ERD_PERF_ACTION" in
  start)
    CLONE_PASSWORD="$CLONE_PASSWORD" CLONE_USER="$clone_user" \
      "$script_dir/saved-erd-isolation.sh" create-run \
      --clone-name "$CLONE_NAME" \
      --clone-port "$CLONE_PORT" \
      --run-db "$ERD_PERF_RUN_DB"
    cd "$repo_root"
    exec env \
      SERVER_PORT="$ERD_PERF_BACKEND_PORT" \
      SPRING_PROFILES_ACTIVE=test \
      SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:$CLONE_PORT/$ERD_PERF_RUN_DB" \
      SPRING_DATASOURCE_USERNAME="$clone_user" \
      SPRING_DATASOURCE_PASSWORD="$CLONE_PASSWORD" \
      SPRING_DOCKER_COMPOSE_LIFECYCLE_MANAGEMENT=none \
      SMART_ERD_CORS_ORIGINS="http://127.0.0.1:4504,http://localhost:4504,http://127.0.0.1:4505,http://localhost:4505,http://127.0.0.1:$ERD_PERF_BACKEND_PORT" \
      ./gradlew bootRun --args='--spring.profiles.active=test --spring.docker.compose.lifecycle-management=none'
    ;;
  stop)
    CLONE_PASSWORD="$CLONE_PASSWORD" CLONE_USER="$clone_user" \
      "$script_dir/saved-erd-isolation.sh" drop-run \
      --clone-name "$CLONE_NAME" \
      --clone-port "$CLONE_PORT" \
      --run-db "$ERD_PERF_RUN_DB"
    ;;
  *)
    printf 'ERROR: ERD_PERF_ACTION must be start or stop\n' >&2
    exit 2
    ;;
esac
