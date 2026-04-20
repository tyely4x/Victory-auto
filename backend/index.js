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
