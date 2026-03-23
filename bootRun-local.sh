#!/bin/sh
set -eu

exec gradle bootRun --args="--spring.profiles.active=local" "$@"
