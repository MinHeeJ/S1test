#!/bin/sh
set -eu
mkdir -p /run/database-secret
if [ -n "${DB_PASSWORD:-}" ]; then
  printf '%s' "$DB_PASSWORD" > /run/database-secret/password
elif [ ! -s /run/database-secret/password ]; then
  umask 077
  od -An -N32 -tx1 /dev/urandom | tr -d ' \n' > /run/database-secret/password
fi
chown 10001:10001 /run/database-secret/password
chmod 0400 /run/database-secret/password
POSTGRES_PASSWORD=$(cat /run/database-secret/password)
export POSTGRES_PASSWORD
exec /usr/local/bin/docker-entrypoint.sh postgres
