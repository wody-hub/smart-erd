#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  saved-erd-isolation.sh prepare --clone-name NAME --clone-port PORT --output-dir DIR
  saved-erd-isolation.sh create-run --clone-name NAME --clone-port PORT --run-db DB
  saved-erd-isolation.sh drop-run --clone-name NAME --clone-port PORT --run-db DB
  saved-erd-isolation.sh hashes --host HOST --port PORT --db DB --user USER --output FILE

prepare environment:
  SOURCE_HOST (default 127.0.0.1), SOURCE_PORT (15432), SOURCE_DB (smarterd),
  SOURCE_USER (smarterd), SOURCE_PASSWORD (required), SOURCE_TEAM_ID,
  SOURCE_PROJECT_ID, SOURCE_DIAGRAM_ID, CLONE_USER (smarterd),
  CLONE_PASSWORD (required; can match the source), CLONE_NAME, CLONE_PORT,
  OUTPUT_DIR (private directory must not already exist).

The helper never removes a container or an existing database. Run databases must
start with saved_erd_run_. The seed database is restored from a custom-format
dump and should never be used by the application.
USAGE
}

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"; }

hash_query() {
  local sql
  sql="SELECT json_build_object('diagram_id',d.id,'project_id',p.id,'team_id',p.team_id,'row_md5',md5(to_jsonb(d)::text),'content_md5',md5(d.content),'snapshot_md5',md5(d.ydoc_snapshot),'content_bytes',octet_length(d.content),'snapshot_bytes',octet_length(d.ydoc_snapshot),'content_revision',d.content_revision,'snapshot_revision',d.snapshot_revision,'snapshot_updated_at',d.snapshot_updated_at)::text FROM diagrams d JOIN projects p ON p.id=d.project_id WHERE d.id=:'diagram_id'::bigint AND d.project_id=:'project_id'::bigint AND p.team_id=:'team_id'::bigint"
  PGPASSWORD="$SOURCE_PASSWORD" psql -X -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$SOURCE_DB" -v team_id="$SOURCE_TEAM_ID" -v project_id="$SOURCE_PROJECT_ID" -v diagram_id="$SOURCE_DIAGRAM_ID" -v ON_ERROR_STOP=1 -qAt -c "$sql"
}

prepare() {
  : "${CLONE_NAME:?CLONE_NAME required}"
  : "${CLONE_PORT:?CLONE_PORT required}"
  : "${OUTPUT_DIR:?OUTPUT_DIR required}"
  : "${SOURCE_PASSWORD:?SOURCE_PASSWORD required}"
  : "${SOURCE_TEAM_ID:?SOURCE_TEAM_ID required}"
  : "${SOURCE_PROJECT_ID:?SOURCE_PROJECT_ID required}"
  : "${SOURCE_DIAGRAM_ID:?SOURCE_DIAGRAM_ID required}"
  : "${CLONE_PASSWORD:?CLONE_PASSWORD required}"
  SOURCE_HOST="${SOURCE_HOST:-127.0.0.1}"
  SOURCE_PORT="${SOURCE_PORT:-15432}"
  SOURCE_DB="${SOURCE_DB:-smarterd}"
  SOURCE_USER="${SOURCE_USER:-smarterd}"
  CLONE_USER="${CLONE_USER:-smarterd}"
  local seed_db="saved_erd_seed" dump before after

  [[ "$CLONE_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || fail 'invalid clone container name'
  [[ "$CLONE_PORT" =~ ^[0-9]+$ ]] && (( CLONE_PORT > 0 && CLONE_PORT < 65536 )) || fail 'invalid clone port'
  [[ ! -e "$OUTPUT_DIR" ]] || fail "output directory already exists: $OUTPUT_DIR"
  docker inspect "$CLONE_NAME" >/dev/null 2>&1 && fail "container name already exists: $CLONE_NAME"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$CLONE_PORT" -sTCP:LISTEN >/dev/null 2>&1 && fail "port already listening: $CLONE_PORT"
  fi

  need docker; need pg_dump; need pg_restore; need psql
  umask 077
  mkdir -m 700 -p "$(dirname "$OUTPUT_DIR")"
  mkdir -m 700 "$OUTPUT_DIR"
  dump="$OUTPUT_DIR/source.dump"
  before="$OUTPUT_DIR/original-before.json"
  after="$OUTPUT_DIR/clone-seed.json"
  hash_query > "$before" || fail 'source identity query failed; expected diagram row was not found'
  [[ -s "$before" ]] || fail 'source identity query returned no row'
  PGPASSWORD="$SOURCE_PASSWORD" pg_dump --format=custom --no-owner --no-acl -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$SOURCE_DB" -f "$dump"
  chmod 600 "$dump" "$before"

  docker run -d --name "$CLONE_NAME" --restart=no -e "POSTGRES_DB=$seed_db" -e "POSTGRES_USER=$CLONE_USER" -e "POSTGRES_PASSWORD=$CLONE_PASSWORD" -p "127.0.0.1:$CLONE_PORT:5432" postgres:17 >/dev/null
  local ready=0 i
  for i in {1..60}; do
    if pg_isready -h 127.0.0.1 -p "$CLONE_PORT" -U "$CLONE_USER" -d "$seed_db" >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
  done
  (( ready == 1 )) || fail 'clone PostgreSQL did not become ready; container left intact for inspection'
  PGPASSWORD="$CLONE_PASSWORD" createdb -h 127.0.0.1 -p "$CLONE_PORT" -U "$CLONE_USER" -T template0 saved_erd_restore
  PGPASSWORD="$CLONE_PASSWORD" pg_restore --no-owner --no-acl -h 127.0.0.1 -p "$CLONE_PORT" -U "$CLONE_USER" -d saved_erd_restore "$dump"
  PGPASSWORD="$CLONE_PASSWORD" dropdb -h 127.0.0.1 -p "$CLONE_PORT" -U "$CLONE_USER" saved_erd_seed
  PGPASSWORD="$CLONE_PASSWORD" psql -X -h 127.0.0.1 -p "$CLONE_PORT" -U "$CLONE_USER" -d postgres -v ON_ERROR_STOP=1 -qAt -c 'ALTER DATABASE saved_erd_restore RENAME TO saved_erd_seed'
  SOURCE_HOST=127.0.0.1 SOURCE_PORT="$CLONE_PORT" SOURCE_DB="$seed_db" SOURCE_USER="$CLONE_USER" SOURCE_PASSWORD="$CLONE_PASSWORD" hash_query > "$after"
  chmod 600 "$after"
  if ! cmp -s "$before" "$after"; then fail "source/seed identity mismatch; inspect private files in $OUTPUT_DIR; no browser run is allowed"; fi
  cat > "$OUTPUT_DIR/manifest.txt" <<MANIFEST
source=postgresql://$SOURCE_HOST:$SOURCE_PORT/$SOURCE_DB
clone_container=$CLONE_NAME
clone_image=postgres:17
clone_bind=127.0.0.1:$CLONE_PORT:5432
clone_seed_db=$seed_db
clone_user=$CLONE_USER
source_dump=$dump
original_before=$before
clone_seed_hashes=$after
run_db_create=PGPASSWORD='[private]' createdb -h 127.0.0.1 -p $CLONE_PORT -U $CLONE_USER -T saved_erd_seed saved_erd_run_<unique>
MANIFEST
  chmod 600 "$OUTPUT_DIR/manifest.txt"
  printf 'source hashes and clone seed hashes match\nprivate output: %s\nclone: %s on 127.0.0.1:%s, seed DB saved_erd_seed\n' "$OUTPUT_DIR" "$CLONE_NAME" "$CLONE_PORT"
}

run_db() {
  local action="$1" clone_name="$2" clone_port="$3" run_db="$4" clone_user="${CLONE_USER:-smarterd}"
  : "${CLONE_PASSWORD:?CLONE_PASSWORD required}"
  [[ "$run_db" =~ ^saved_erd_run_[A-Za-z0-9_]+$ ]] || fail 'run DB must start with saved_erd_run_'
  docker inspect "$clone_name" >/dev/null 2>&1 || fail "clone container does not exist: $clone_name"
  if [[ "$action" == create-run ]]; then
    PGPASSWORD="$CLONE_PASSWORD" createdb -h 127.0.0.1 -p "$clone_port" -U "$clone_user" -T saved_erd_seed "$run_db"
  else
    [[ "$run_db" != saved_erd_seed ]] || fail 'refusing to drop seed database'
    PGPASSWORD="$CLONE_PASSWORD" dropdb -h 127.0.0.1 -p "$clone_port" -U "$clone_user" --if-exists "$run_db"
  fi
}

hashes() {
  local host="$2" port="$4" db="$6" user="$8" output="${10}"
  : "${SOURCE_TEAM_ID:?SOURCE_TEAM_ID required}"
  : "${SOURCE_PROJECT_ID:?SOURCE_PROJECT_ID required}"
  : "${SOURCE_DIAGRAM_ID:?SOURCE_DIAGRAM_ID required}"
  SOURCE_HOST="$host" SOURCE_PORT="$port" SOURCE_DB="$db" SOURCE_USER="$user" SOURCE_PASSWORD="${SOURCE_PASSWORD:?SOURCE_PASSWORD required}" hash_query > "$output"
  chmod 600 "$output"
}

[[ $# -gt 0 ]] || { usage; exit 2; }
cmd="$1"; shift
case "$cmd" in
  prepare)
    while (($#)); do case "$1" in
      --clone-name) CLONE_NAME="$2"; shift 2;;
      --clone-port) CLONE_PORT="$2"; shift 2;;
      --output-dir) OUTPUT_DIR="$2"; shift 2;;
      *) fail "unknown prepare argument: $1";;
    esac; done
    prepare;;
  create-run|drop-run)
    [[ $# -eq 6 && "$1" == --clone-name && "$3" == --clone-port && "$5" == --run-db ]] || { usage; exit 2; }
    run_db "$cmd" "$2" "$4" "$6";;
  hashes)
    [[ $# -eq 10 && "$1" == --host && "$3" == --port && "$5" == --db && "$7" == --user && "$9" == --output ]] || { usage; exit 2; }
    hashes "$@";;
  *) usage; exit 2;;
esac
