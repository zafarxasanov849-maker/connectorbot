#!/usr/bin/env bash
# MongoDB'ni kunlik zaxiralash. Oxirgi 14 ta nusxa saqlanadi.
set -euo pipefail

PROJECT_DIR="/opt/connectorbot"
BACKUP_DIR="$PROJECT_DIR/backups"
STAMP="$(date +%F-%H%M)"

mkdir -p "$BACKUP_DIR"
cd "$PROJECT_DIR"

# mongo konteyneridan gzip-arxiv sifatida dump olamiz (-T: TTY siz, redirect uchun)
docker compose exec -T mongo mongodump --db connector-bot --archive --gzip \
  > "$BACKUP_DIR/connector-bot-$STAMP.gz"

# 14 tadan ortiq eski nusxalarni o'chiramiz
ls -1t "$BACKUP_DIR"/connector-bot-*.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "Backup tayyor: $BACKUP_DIR/connector-bot-$STAMP.gz"
