import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import axios from "axios";

const app = express();

// Preserve raw JSON for signature verification
app.use(bodyParser.json({
  type: "*/*",
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));

// ---- Config (from environment) ----
const BASE = process.env.KOMMO_BASE_URL || "";
const CLIENT_ID = process.env.KOMMO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.KOMMO_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.KOMMO_REDIRECT_URI || "";
const CHAT_CHANNEL_SECRET = process.env.CHAT_CHANNEL_SECRET || "";
const ACCESS_TOKEN = process.env.KOMMO_ACCESS_TOKEN || ""; // optional at first

// ---- Health ----
app.get("/health", (_req, res) => res.send("ok"));

// ---- OAuth callback ----
// After you click "Authorize in Kommo", Kommo redirects here with ?code=...
app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing ?code param");

  // We do NOT auto-exchange here to avoid exposing secrets on the server logs.
  // Instead, show the exact curl you should run locally (or on your CI) to mint tokens safely.
  const curlMint = `curl -sS -X POST "${BASE}/oauth2/access_token" \\n  -H "Content-Type: application/json" \\n  -d '{\n    "client_id":"${CLIENT_ID}",\n    "client_secret":"${CLIENT_SECRET}",\n    "grant_type":"authorization_code",\n    "code":"${code}",\n    "redirect_uri":"${REDIRECT_URI}"\n  }'`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Kommo OAuth Code</title>
      <style>
        body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; padding:24px; max-width:900px; margin:auto; line-height:1.5}
        code,pre{background:#111; color:#eee; padding:12px; border-radius:8px; display:block; overflow:auto}
        .box{background:#f6f6f7; padding:16px; border-radius:10px; border:1px solid #e5e7eb}
        h1{margin-top:0}
      </style>
      </head>
      <body>
        <h1>Authorization code received ✅</h1>
        <div class="box">
          <p><b>Code:</b> <code>${code}</code></p>
          <p>Run this cURL <i>on your machine</i> to exchange the code for <b>access_token</b> and <b>refresh_token</b>:</p>
          <pre>${curlMint}</pre>
          <p>Then set the tokens as environment variables on your host:</p>
          <pre>KOMMO_ACCESS_TOKEN=...\nKOMMO_REFRESH_TOKEN=...</pre>
          <p><b>Security note:</b> Do not print or share tokens in chats or logs.</p>
        </div>
        <p>Next steps:</p>
        <ol>
          <li>Use the cURL above to mint tokens.</li>
          <li>In your hosting dashboard, add <code>KOMMO_ACCESS_TOKEN</code> and <code>KOMMO_REFRESH_TOKEN</code>.</li>
          <li>Register a Chat Channel via API and save <code>CHAT_CHANNEL_ID</code> / <code>CHAT_CHANNEL_SECRET</code>.</li>
        </ol>
      </body>
    </html>
  `);
});

// ---- Webhook endpoint for Kommo Chat (placeholder) ----
function verifySignature(req) {
  if (!CHAT_CHANNEL_SECRET) return true; // allow until set
  const sig = req.headers["x-signature"];
  const digest = crypto.createHmac("sha1", CHAT_CHANNEL_SECRET)
    .update(req.rawBody || Buffer.from(""))
    .digest("hex");
  return sig === digest;
}

app.post("/chat/webhook", async (req, res) => {
  if (!verifySignature(req)) return res.status(401).send("invalid signature");

  const event = req.body || {};
  const conversationId = event?.conversation_id;
  const text = event?.message?.text || "";

  // Minimal reply logic (customize freely)
  let reply = "Welcome to Wamid ✨ Share your car model & year, and preferred edition (Sihoub/Sukoon/Shuhub).";
  const low = (text || "").toLowerCase();
  if (/(price|سعر)/i.test(low)) {
    reply = "Kindly share your car model and year — I’ll prepare an estimate ✨";
  } else if (/(catalog|كتالوج|عرض)/i.test(low)) {
    reply = "Here’s our digital showroom link 🏜️ Explore first, then I’ll tailor your customization.";
  }

  // Send message back to Kommo chat (requires KOMMO_ACCESS_TOKEN set)
  if (ACCESS_TOKEN && conversationId) {
    try {
      await axios.post(`${BASE}/api/v4/chats/messages`, {
        messages: [{
          type: "outgoing",
          message: { text: reply },
          conversation_id: conversationId,
          msgid: `wamid-${Date.now()}`
        }]
      }, {
        headers: {
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      });
    } catch (e) {
      // Avoid leaking tokens; keep logs minimal
      console.error("Send message failed");
    }
  }

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Wamid bot server listening on", PORT));
