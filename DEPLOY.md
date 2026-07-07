# DigitalOcean'ga Deploy (Droplet + Docker)

Bu bot uzun-polling (long polling) ishlatadi — tashqi port, domen yoki nginx **kerak emas**.
MongoDB va Redis o'sha serverning ichida Docker konteyner sifatida ishlaydi.

## 1. Serverga ulanish

```bash
ssh root@SERVER_IP
```

## 2. Docker o'rnatilganini tekshirish

```bash
docker --version
docker compose version
```

Agar o'rnatilmagan bo'lsa (Ubuntu):

```bash
curl -fsSL https://get.docker.com | sh
```

## 3. Kodni serverga yuklab olish

```bash
cd /opt
git clone https://github.com/zafarxasanov849-maker/connectorbot.git
cd connectorbot
```

## 4. `.env` faylini yaratish

```bash
cp .env.example .env
nano .env
```

To'ldirilishi shart bo'lgan qiymatlar:

| O'zgaruvchi | Izoh |
|-------------|------|
| `BOT_TOKEN` | @BotFather'dan olingan token |
| `ADMIN_IDS` | Admin Telegram ID'lari, vergul bilan (masalan `12345678,98765432`) |
| `DEFAULT_WELCOME` | Standart xush kelibsiz matni |

> **Diqqat:** `MONGO_URI` va `REDIS_URL` ni o'zgartirmang — ular `docker-compose.yml`
> ichida avtomatik `mongo`/`redis` konteynerlariga yo'naltiriladi.

## 5. Ishga tushirish

```bash
docker compose up -d --build
```

Bu quyidagilarni ko'taradi:
- `mongo` — MongoDB (ma'lumotlar `mongo_data` volume'da saqlanadi)
- `redis` — Redis (navbatlar uchun, `redis_data` volume'da)
- `bot` — bot + broadcast/sequence/message workerlar (bitta jarayonda)

## 6. Tekshirish

```bash
docker compose ps          # holat
docker compose logs -f bot # loglar (Ctrl+C bilan chiqish)
```

Loglarda `Bot started (all-in-one).` va `Workers started ...` ko'rinsa — tayyor.
Telegram'da botga `/start` yuborib sinang.

## Foydali buyruqlar

```bash
docker compose restart bot        # botni qayta ishga tushirish
docker compose down               # to'xtatish (ma'lumotlar saqlanadi)
docker compose up -d --build      # yangilanishdan keyin qayta build

# Kodni yangilash:
git pull
docker compose up -d --build
```

## Ma'lumotlarni zaxiralash (backup)

```bash
# MongoDB dump
docker compose exec mongo mongodump --db connector-bot --archive=/tmp/backup.gz --gzip
docker compose cp mongo:/tmp/backup.gz ./backup-$(date +%F).gz
```
