#!/usr/bin/env bash
# Tashqi backup: MongoDB dump'ini Telegram orqali admin(lar)ga yuboradi.
# Server o'chib ketsa ham, backup Telegram'da saqlanib qoladi — ma'lumot yo'qolmaydi.
set -euo pipefail

cd /opt/connectorbot

# .env dan faqat kerakli qiymatlarni xavfsiz o'qiymiz (source ishlatmaymiz,
# chunki DEFAULT_WELCOME kabi bo'sh joyli qiymatlar uni buzadi).
BOT_TOKEN="$(grep -E '^BOT_TOKEN=' .env | head -1 | cut -d= -f2- | tr -d '\r')"
ADMIN_IDS="$(grep -E '^ADMIN_IDS=' .env | head -1 | cut -d= -f2- | tr -d '\r')"

STAMP="$(date +%F-%H%M)"
TMP="/tmp/connectorbot-backup-$STAMP.archive.gz"

# Ikkala bazani (connector-bot va connector-bot-tikuv) bitta arxivga.
docker compose exec -T mongo mongodump --archive --gzip > "$TMP"

SIZE="$(du -h "$TMP" | cut -f1)"

IFS=',' read -ra ADMINS <<< "$ADMIN_IDS"
for a in "${ADMINS[@]}"; do
  a="$(echo "$a" | tr -d ' ')"
  [ -z "$a" ] && continue
  curl -s -F chat_id="$a" \
       -F document=@"$TMP" \
       -F caption="🗄 ConnectorBot backup — $STAMP ($SIZE)" \
       "https://api.telegram.org/bot${BOT_TOKEN}/sendDocument" >/dev/null
done

rm -f "$TMP"
echo "Backup yuborildi: $STAMP ($SIZE)"
