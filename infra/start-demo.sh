#!/bin/sh
# Development launcher never writes or logs the generated database credential.
set +x
set -eu
cd "$(dirname "$0")"
if [ -z "${DB_PASSWORD:-}" ]; then
    existing=$(docker compose ps -aq db)
    if [ -n "$existing" ]; then
        DB_PASSWORD=$(docker inspect "$existing" --format '{{range .Config.Env}}{{println .}}{{end}}' \
            | python3 -c 'import sys; print(next((v.split("=",1)[1].strip() for v in sys.stdin if v.startswith("POSTGRES_PASSWORD=")), ""))')
    fi
    if [ -z "${DB_PASSWORD:-}" ]; then
        DB_PASSWORD=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
    fi
fi
export DB_PASSWORD
docker compose up -d --build --wait
unset DB_PASSWORD
