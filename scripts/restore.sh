#!/usr/bin/env bash
# Tiklash: Telegram'dan olingan backup faylidan ma'lumotni tiklaydi.
# 1) Telegram'dagi backup faylni serverga yuklang (yoki wget bilan oling)
# 2) ./scripts/restore.sh /yo'l/connectorbot-backup-...archive.gz
set -euo pipefail

cd /opt/connectorbot
FILE="${1:?Foydalanish: ./scripts/restore.sh <backup-fayl.archive.gz>}"

echo "Tiklanmoqda: $FILE"
docker compose exec -T mongo mongorestore --archive --gzip --drop < "$FILE"
echo "Tayyor. Botlarni qayta ishga tushiring: docker compose restart bot bot-tikuv"
