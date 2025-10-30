import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import crypto from "crypto";

const app = express();

// capture raw body for signature verification
app.use(bodyParser.json({
  type: "*/*",
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));

// ---- env ----
const BASE = process.env.KOMMO_BASE_URL || "";           // e.g. https://wamiduae.kommo.com
const CLIENT_ID = process.env.KOMMO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.KOMMO_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.KOMMO_REDIRECT_URI || "";
const CHAT_CHANNEL_SECRET = process.env.CHAT_CHANNEL_SECRET || "";

// health
app.get("/health", (_req, res) => res.status(200).send("ok"));

// OAuth callback (always 200 so Kommo sees it as active)
app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!code) {
    return res.status(200).end(`
      <html><body style="font-family:system-ui;padding:24px">
        <h1>Wamid Kommo OAuth</h1>
        <p>Endpoint is <b>Ready ?</b>. Click <b>Authorize</b> in Kommo to get a code.</p>
      </body></html>
    `);
  }

  const curlMint = `curl -sS -X POST "${BASE}/oauth2/access_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_id":"${CLIENT_ID}",
    "client_secret":"${CLIENT_SECRET}",
    "grant_type":"authorization_code",
    "code":"${code}",
    "redirect_uri":"${REDIRECT_URI}"
  }'`;

  return res.status(200).end(`
    <html><body style="font-family:system-ui;padding:24px">
      <h1>Authorization code received ?</h1>
      <p><b>code:</b> <code>${code}</code></p>
      <p>Run this locally to mint tokens:</p>
      <pre>${curlMint}</pre>
    </body></html>
  `);
});

// signature check helper
function verifySignature(req) {
  if (!CHAT_CHANNEL_SECRET) return true; // allow until set
  const sig = req.headers["x-signature"];
  const digest = crypto.createHmac("sha1", CHAT_CHANNEL_SECRET)
    .update(req.rawBody || Buffer.from(""))
    .digest("hex");
  return sig === digest;
}

// webhook
app.post("/chat/webhook", async (req, res) => {
  if (!verifySignature(req)) return res.status(401).send("invalid signature");

  const event = req.body || {};
  const conversationId = event?.conversation_id;
  const text = event?.message?.text || "";

  let reply = "Welcome to Wamid ? Share your car model & year, and preferred edition (Sihoub/Sukoon/Shuhub).";
  const low = (text || "").toLowerCase();
  if (/(price|???)/i.test(low)) {
    reply = "Kindly share your car model and year ? I?ll prepare an estimate ?";
  } else if (/(catalog|??????|???)/i.test(low)) {
    reply = "Here?s our digital showroom link ??? Explore first, then I?ll tailor your customization.";
  }

  const ACCESS_TOKEN = process.env.KOMMO_ACCESS_TOKEN || "";
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
    } catch {
      console.error("Send message failed");
    }
  }

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log("Wamid bot server listening on", PORT));