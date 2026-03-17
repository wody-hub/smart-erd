#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

has_violation=0

run_check() {
  local title="$1"
  local command="$2"
  local output
  output="$(bash -lc "$command" || true)"

  if [[ -n "$output" ]]; then
    has_violation=1
    echo "[FAIL] $title"
    echo "$output"
    echo
  else
    echo "[PASS] $title"
  fi
}

run_check \
  "StringUtils 직접 사용 금지 (AppStringUtils 내부 제외)" \
  "rg -n \"org\\.apache\\.commons\\.lang3\\.StringUtils|\\bStringUtils\\.\" src/main/java --glob '!src/main/java/com/smarterd/utils/AppStringUtils.java'"

run_check \
  "ArrayUtils 직접 사용 금지 (AppArrayUtils 내부 제외)" \
  "rg -n \"org\\.apache\\.commons\\.lang3\\.ArrayUtils|\\bArrayUtils\\.\" src/main/java --glob '!src/main/java/com/smarterd/utils/AppArrayUtils.java'"

run_check \
  "직접 trim() 사용 금지" \
  "rg -n \"\\.trim\\(\\)\" src/main/java"

run_check \
  "직접 toLowerCase(Locale.ROOT) 사용 금지" \
  "rg -n \"toLowerCase\\(Locale\\.ROOT\\)\" src/main/java"

run_check \
  "null + isBlank 결합 패턴 금지" \
  "rg -n \"== null \\|\\| .*\\.isBlank\\(|!= null && !.*\\.isBlank\\(\" src/main/java"

if [[ "$has_violation" -eq 1 ]]; then
  echo "String utils check failed."
  exit 1
fi

echo "String utils check passed."
