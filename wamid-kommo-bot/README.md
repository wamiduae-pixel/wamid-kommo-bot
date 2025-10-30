# Wamid Kommo Bot (Starter)

Minimal, production-ready skeleton to integrate a custom chatbot with **Kommo CRM**.
- OAuth callback to capture `code` and safely show a cURL to exchange tokens.
- Chat webhook endpoint with HMAC-SHA1 signature verification.
- Minimal reply logic (English/Arabic-friendly).

## 1) Configure environment
Copy `.env.example` to your hosting platform (Render/Fly/Heroku) as environment variables.

Required:
- `KOMMO_BASE_URL` (e.g., `https://wamid.kommo.com`)
- `KOMMO_CLIENT_ID`, `KOMMO_CLIENT_SECRET` (from Kommo → Settings → API & Integrations)
- `KOMMO_REDIRECT_URI` (must match in Kommo and here)

## 2) Deploy
Any Node 18+ host works. Example Render:
- New Web Service → Public Git or Manual repo upload
- Build: (none needed) → `npm ci`
- Start: `node server.js`
- Add environment variables from `.env.example`

## 3) Authorize
In Kommo → your integration → click **Authorize**.
Kommo redirects to: `https://YOUR_DOMAIN/oauth/callback?code=...`

The callback page shows a **cURL** you can run locally to exchange the code for tokens:
- Set `KOMMO_ACCESS_TOKEN` and `KOMMO_REFRESH_TOKEN` on your host afterwards.

## 4) Register Chat Channel (one time)
Use this cURL (replace your domain & token):

```bash
curl -sS -X POST "$KOMMO_BASE_URL/api/v4/chats/channel" \
  -H "Authorization: Bearer $KOMMO_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": {
      "name": "Wamid Bot",
      "webhook_url": "https://YOUR_DOMAIN/chat/webhook"
    }
  }'
```

Save `channel_id` and `channel_secret` as env vars:
- `CHAT_CHANNEL_ID`
- `CHAT_CHANNEL_SECRET`

## 5) Connect IG/TikTok/WhatsApp (in Kommo)
- Settings → Integrations → connect channels.
- Messages will arrive to Kommo Chat → forwarded to your `webhook_url`.

## 6) Testing
- `GET /health` should respond `ok`.
- Send a test message from a connected channel (or Kommo chat test).
- The webhook returns a friendly reply (if `KOMMO_ACCESS_TOKEN` is set).

## 7) Security
- Never log tokens or secrets.
- Use HTTPS only.
- Verify `X-Signature` with `CHAT_CHANNEL_SECRET`.
- Rotate secrets periodically and separate envs for dev/stage/prod.
