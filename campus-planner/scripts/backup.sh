#!/bin/sh
# Database + uploaded PDFs backup. Run from the project folder:  ./scripts/backup.sh [keep_days]
# Cron example (every night at 02:30):  30 2 * * *  cd /opt/campus-planner && ./scripts/backup.sh 14
set -eu
KEEP="${1:-14}"; DIR="${BACKUP_DIR:-./backups}"; STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIR"
docker compose exec -T db pg_dump -U planner -d planner --no-owner | gzip > "$DIR/db-$STAMP.sql.gz"
docker compose exec -T api tar czf - -C /srv uploads > "$DIR/uploads-$STAMP.tgz"
find "$DIR" -type f \( -name 'db-*.sql.gz' -o -name 'uploads-*.tgz' \) -mtime +"$KEEP" -delete
echo "Backup written to $DIR ($STAMP)"
