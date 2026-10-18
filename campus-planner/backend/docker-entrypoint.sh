#!/bin/sh
# Apply database migrations, then start the API. Fails fast (container restarts) if the DB is unreachable.
set -e
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'
