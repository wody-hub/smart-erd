#!/bin/sh
set -eu

: "${SERVER_PORT:=9502}"
export SERVER_PORT

exec ./gradlew bootRun --args="--spring.profiles.active=test" "$@"
