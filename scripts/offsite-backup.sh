#!/usr/bin/env bash
# Tashqi backup: har bot o'z bazasini o'z boti orqali admin(lar)ga yuboradi.
#   - Asosiy bot bazasi  -> asosiy bot (.env)
#   - Tikuv bot bazasi   -> tikuv bot (.env.tikuv)
# Server o'chib ketsa ham, backup Telegram'da saqlanib qoladi.
set -euo pipefail

cd /opt/connectorbot
STAMP="$(date +%F-%H%M)"

backup_one() {
  local envfile="$1" db="$2" label="$3"
  [ -f "$envfile" ] || { echo "$label: $envfile yo'q, o'tkazildi"; return; }

  local token admins tmp size
  token="$(grep -E '^BOT_TOKEN=' "$envfile" | head -1 | cut -d= -f2- | tr -d '\r ')"
  admins="$(grep -E '^ADMIN_IDS=' "$envfile" | head -1 | cut -d= -f2- | tr -d '\r')"
  [ -z "$token" ] && { echo "$label: BOT_TOKEN yo'q, o'tkazildi"; return; }

  tmp="/tmp/${db}-$STAMP.archive.gz"
  docker compose exec -T mongo mongodump --db "$db" --archive --gzip > "$tmp"
  size="$(du -h "$tmp" | cut -f1)"

  IFS=',' read -ra list <<< "$admins"
  for a in "${list[@]}"; do
    a="$(echo "$a" | tr -d ' ')"
    [ -z "$a" ] && continue
    curl -s -F chat_id="$a" -F document=@"$tmp" \
         -F caption="🗄 $label backup — $STAMP ($size)" \
         "https://api.telegram.org/bot${token}/sendDocument" >/dev/null
  done
  rm -f "$tmp"
  echo "$label backup yuborildi: $STAMP ($size)"
}

backup_one ".env"       "connector-bot"       "Asosiy bot"
backup_one ".env.tikuv" "connector-bot-tikuv" "Tikuv bot"
