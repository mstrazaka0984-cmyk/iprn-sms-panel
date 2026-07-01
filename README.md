# IPRN SMS Panel

Admin panel for an IPRN SMS/OTP business: receives OTP messages via webhook, filters by number range / date range / payout, and exports to Excel and PDF.

**Stack:** Node.js (Express) + PostgreSQL backend, React (Vite) frontend.

## Project structure

```
iprn-sms-panel/
  backend/
    server.js            Express entry point, route registration
    .env                 Configuration (DB, webhook secrets)
    db/
      pool.js            PostgreSQL connection pool
      schema.sql         Full schema reference
      migrate.js         Creates tables from schema.sql
      migrate_v2.js      Adds provider-specific columns
      seed.js            Sample data for demo
    routes/
      messages.js        Filtering, pagination, summary APIs
      export.js          Excel / PDF export
      webhook.js         Generic shared-secret webhook
      webhooks/
        meta.js          Meta/WhatsApp/Facebook Messenger webhook
        telegram.js      Telegram bot webhook
        gmail.js         Gmail / Google Pub/Sub webhook
    middleware/
      verifyMeta.js      HMAC-SHA256 signature verification
      verifyTelegram.js  Secret-token verification
      verifyGoogle.js    JWT verification (Google JWKS)
    utils/
      storeMessage.js    Shared message insertion + OTP detection + dedup
  frontend/
    src/
      api.js             API client functions
      App.jsx            Dashboard UI (filters, table, export, pagination)
      main.jsx           React entry point
      styles.css         Dark-theme styling
    vite.config.js       Dev server + /api proxy to :4000
```

## 1. Backend setup

Requires Node 18+ and a running PostgreSQL instance.

```bash
cd backend
cp .env.example .env      # edit DB credentials and portal secrets
npm install
npm run migrate           # creates tables + indexes
npm run migrate:v2        # adds raw_payload, idempotency_key, source_provider
npm run seed              # inserts ~60 sample OTP messages for demo
npm run dev               # starts API on http://localhost:4000
```

Health check: `GET http://localhost:4000/api/health`

## 2. Webhook endpoints

Each portal has a dedicated endpoint with provider-specific auth and payload parsing:

| Endpoint | Provider | Auth method | Config vars |
|----------|----------|-------------|-------------|
| `POST /api/webhook/receive` | Generic / any | `x-webhook-token` header | `WEBHOOK_TOKEN` |
| `GET+POST /api/webhooks/meta` | Meta/WhatsApp/FB | `X-Hub-Signature-256` (HMAC-SHA256) + verify token | `META_APP_SECRET`, `META_VERIFY_TOKEN` |
| `POST /api/webhooks/telegram` | Telegram Bot | `X-Telegram-Bot-Api-Secret-Token` | `TELEGRAM_WEBHOOK_SECRET` |
| `POST /api/webhooks/gmail` | Gmail / Google Pub/Sub | JWT (Google OAuth2 public keys) | `GOOGLE_PUBSUB_AUDIENCE` |

### Generic webhook

```
POST /api/webhook/receive
Header: x-webhook-token: <WEBHOOK_TOKEN>
Body:
{
  "platform": "WhatsApp",
  "sender": "WA-OTP",
  "receiver": "923001234567",
  "messageText": "482913 is your WhatsApp code",
  "otpCode": "482913",       // optional — auto-detected from messageText
  "payout": 0.12,
  "currency": "USD",
  "countryCode": "92",
  "idempotencyKey": "abc123" // optional — prevents duplicate inserts
}
```

### Meta / WhatsApp / Facebook Messenger

Two-step setup:

1. **Verify challenge** — Meta sends a GET with `hub.verify_token`. If it matches `META_VERIFY_TOKEN`, the webhook is subscribed.
2. **Inbound messages** — Meta POSTs payloads where `object` is either `whatsapp_business_account` or `page` (Messenger). The route parses the provider format automatically.

Set webhook URL to `https://yourdomain.com/api/webhooks/meta`.

### Telegram Bot

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://yourdomain.com/api/webhooks/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Handles `message`, `channel_post`, and `edited_message` update types.

### Gmail / Google Pub/Sub

1. Set up Gmail Watch API on the mailbox you want to monitor.
2. Create a Pub/Sub push subscription targeting `https://yourdomain.com/api/webhooks/gmail`.
3. The middleware verifies the JWT delivered in the `Authorization: Bearer` header against Google's OAuth2 public keys (cached for 1 hour).

## 3. Environment variables

```ini
PORT=4000

# PostgreSQL
PGHOST=localhost
PGPORT=5432
PGDATABASE=iprn_sms_panel
PGUSER=postgres
PGPASSWORD=postgres

# Generic webhook
WEBHOOK_TOKEN=change-this-secret

# Meta / WhatsApp / Facebook
META_APP_SECRET=change-me-meta-app-secret
META_VERIFY_TOKEN=change-me-meta-verify-token

# Telegram
TELEGRAM_WEBHOOK_SECRET=change-me-telegram-secret
TELEGRAM_BOT_TOKEN=change-me-telegram-bot-token

# Gmail / Google Pub/Sub
GOOGLE_PUBSUB_AUDIENCE=change-me-google-pubsub-audience
GOOGLE_WEBHOOK_SECRET=change-me-google-secret
```

## 4. Filtering API

`GET /api/messages` accepts: `numberFrom`, `numberTo`, `dateFrom`, `dateTo`, `payoutMin`, `payoutMax`, `platform`, `status`, `search`, `page`, `pageSize`.

Also: `GET /api/messages/summary` (dashboard counts) and `GET /api/messages/meta/platforms` (filter dropdown).

## 5. Exports

`GET /api/export/excel?...filters` and `GET /api/export/pdf?...filters` stream files respecting any applied filters (capped at 10,000 rows).

## 6. Frontend setup

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173, proxies /api to :4000
```

## 7. Database schema

Tables: `platforms` (SMS sources/apps) and `messages` (OTP records). The `number_value` column is a BIGINT derived from `receiver_number` for fast indexed range queries. Provider-specific fields: `raw_payload` (JSONB), `idempotency_key` (unique, nullable — prevents duplicate webhook inserts), `source_provider` (e.g. `meta_whatsapp`, `telegram`). See `backend/db/schema.sql`.

## What's intentionally left out

- **Authentication & roles** (admin vs. operator vs. client)
- **Fraud detection** (velocity checks, blacklist ranges)
- **Pagination-safe large exports** (background jobs for >10K rows)
- **Audit logging** of who viewed/exported what
- **Multi-tenant isolation**
- **Rate limiting & input validation hardening**
- **Deployment**: Docker, reverse proxy/TLS, managed Postgres with backups
