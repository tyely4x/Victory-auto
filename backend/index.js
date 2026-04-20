// ============================================================
//  VICTORY AUTO SALES — LEAD TRACKER BACKEND
//  Express server · Meta Webhooks · OpenAI · SQLite
// ============================================================
require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const { initDb }  = require('./services/db');
const webhookRouter = require('./routes/webhook');
const leadsRouter   = require('./routes/leads');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ─────────────────────────────────────────────────
app.use(cors({ origin: '*' }));

// Raw body needed for Meta webhook signature verification
app.use((req, res, next) => {
  if (req.path === '/webhook' && req.method === 'POST') {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      req.rawBody = raw;
      try { req.body = JSON.parse(raw); } catch { req.body = {}; }
      next();
    });
  } else {
    express.json()(req, res, next);
  }
});

// ── STATIC FRONTEND ───────────────────────────────────────────
// Serves lead-tracker.html at the root when accessed via the backend URL
app.use(express.static(path.join(__dirname, '..')));

// ── ROUTES ───────────────────────────────────────────────────
app.use('/webhook', webhookRouter);
app.use('/api/leads', leadsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Privacy policy (required by Meta for webhook/app approval)
app.get('/privacy', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Privacy Policy — Victory Auto Sales</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 24px;color:#222;line-height:1.7}
  h1{font-size:1.6rem;margin-bottom:4px}
  h2{font-size:1.1rem;margin-top:32px}
  p,li{font-size:.95rem}
  a{color:#c8102e}
</style>
</head>
<body>
<h1>Privacy Policy</h1>
<p><strong>Victory Auto Sales</strong> · Memphis, TN · <a href="https://victoryauto.org">victoryauto.org</a></p>
<p><em>Last updated: ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</em></p>

<h2>Information We Collect</h2>
<p>When you contact Victory Auto Sales through Facebook Messenger, Instagram, or other social media platforms, we may collect your name, message content, and publicly available profile information solely for the purpose of responding to your inquiry.</p>

<h2>How We Use Your Information</h2>
<ul>
  <li>To respond to your vehicle inquiries and sales questions</li>
  <li>To follow up on your interest in our inventory</li>
  <li>We do not sell, rent, or share your personal information with third parties</li>
</ul>

<h2>Data Retention</h2>
<p>Inquiry data is retained only as long as necessary to service your request. You may request deletion of your data at any time by contacting us.</p>

<h2>Contact</h2>
<p>Victory Auto Sales · Memphis, TN<br>
Website: <a href="https://victoryauto.org">victoryauto.org</a></p>
</body></html>`);
});

// ── START ────────────────────────────────────────────────────
(async () => {
  await initDb();
  app.listen(PORT, () => {
    console.log('\n🚗  Victory Auto Sales Backend');
    console.log('─'.repeat(40));
    console.log(`   App:     http://localhost:${PORT}`);
    console.log(`   API:     http://localhost:${PORT}/api/leads`);
    console.log(`   Webhook: http://localhost:${PORT}/webhook`);
    console.log(`   Mode:    ${process.env.OPENAI_API_KEY ? 'AI-powered ✅' : 'Rule-based only (add OPENAI_API_KEY)'}`);
    console.log('─'.repeat(40) + '\n');
  });
})();
