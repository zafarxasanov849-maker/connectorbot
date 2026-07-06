## Connector Bot (Telegram)

Scalable content router and admin console for Telegram, built with TypeScript, grammY, MongoDB, and BullMQ. Handles deep-linked onboarding, content packages per source tag, and queue-backed broadcasts with rate limiting.

### Features
- Deep-link `/start <source>` tracking that stores users and serves source-specific content.
- Content packages with text, media, and inline buttons per `source_tag`, plus default welcome fallback.
- Admin-only in-bot tools: `/stats`, `/broadcast` (wizard, queued), `/setcontent <source_tag>` (wizard), `/export` (CSV of users).
- BullMQ worker honoring ~20 msgs/sec to keep broadcasts safe.

### Quickstart
1. Copy `.env.example` to `.env` and fill `BOT_TOKEN`, `MONGO_URI`, `REDIS_URL`, `ADMIN_IDS`.
2. Install deps: `npm install`.
3. Run bot: `npm run dev` (or `npm start` after `npm run build`).
4. Run broadcast worker in a separate process: `npm run worker`.

### Multiple Instances
- To load a non-default env file, start the process with `ENV_FILE=.env.bot2`.
- To isolate BullMQ queues inside the same Redis, set a unique `QUEUE_PREFIX` per bot, for example `QUEUE_PREFIX=bot2`.
- For production, build once and run `ENV_FILE=.env.bot2 npm run start:all`.

### Commands (Admin)
- `/stats` — total users and counts per source tag.
- `/broadcast` — wizard: pick target (`all` or source tag), send text/media, confirm to queue.
- `/setcontent <source_tag>` — wizard to save text/media/buttons for a source (buttons via lines like `BTN: Label|https://example.com`).
- `/export` — sends `users.csv`.
- `/links` — lists deep links for all content source tags.
- `/manage` — pick a tag, view messages, and edit/delete individual sequence entries.
- All bot replies (admin/user) are routed through BullMQ message worker; run `npm run message-worker` alongside other workers.

### Project Structure
- `src/config` — env, Mongo, Redis.
- `src/models` — Mongoose schemas (User, ContentPackage, AdminLog, AdminWhitelist).
- `src/services` — domain logic (content, users, admin logs, delivery, broadcast queue).
- `src/bot` — grammY bot setup, middleware, handlers, wizards.
- `src/queue` — BullMQ queue factory.
- `src/worker` — broadcast and sequence workers (rate limited).

### Notes
- All broadcast jobs go through BullMQ; worker limiter is set to 20 msgs/sec.
- Buttons parsing: include lines in your message like `BTN: Label|https://url`; they will be converted to inline buttons.
- Content packages accept a single media item per message (photo/video/document/voice/audio/animation) plus text/buttons.
- Seed admin whitelist via `ADMIN_IDS` (comma-separated). `/start` is public; admin commands are gated.
- Example broadcast text you can reuse:  
  `suniy intellekt orqali qanday qilib sotuvlarni oshirish\n\naaynana shu mavzuda bitta dars tayyorladik...`

### Sequences per Source Tag
- `/setcontent <source>` now supports multiple messages with per-message delay (minutes).
- To add a message: first line is the delay in minutes from user entry, following lines are the text; attach optional media; include buttons via any of:
  - `BTN: Label|https://url`
  - `Label|https://url`
  - `Label - https://url`
- Send multiple messages; type `/done` to finish and save. Messages are scheduled relative to the user's join time. Start the sequence worker with `npm run sequence-worker`.
# ConnectorBot
