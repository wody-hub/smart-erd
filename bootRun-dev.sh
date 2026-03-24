#!/bin/sh
set -eu

: "${SERVER_PORT:=9503}"
export SERVER_PORT

exec ./gradlew bootRun "$@"
