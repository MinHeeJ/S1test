#!/bin/sh
set -eu
if [ -z "${DB_PASSWORD:-}" ] && [ -r /run/database-secret/password ]; then
  DB_PASSWORD=$(cat /run/database-secret/password)
  export DB_PASSWORD
fi
exec java -jar /app/app.jar
