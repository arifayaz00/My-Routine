#!/bin/sh
# Restore a database backup:  ./scripts/restore.sh backups/db-YYYYMMDD-HHMMSS.sql.gz
# This REPLACES the current database. Stop traffic first:  docker compose stop web api
set -eu
[ $# -eq 1 ] || { echo "usage: $0 <db-backup.sql.gz>"; exit 1; }
docker compose up -d db
docker compose exec -T db psql -U planner -d postgres -c "DROP DATABASE IF EXISTS planner" -c "CREATE DATABASE planner"
gunzip -c "$1" | docker compose exec -T db psql -U planner -d planner -v ON_ERROR_STOP=1
docker compose up -d
echo "Restored from $1"
