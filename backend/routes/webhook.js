// ============================================================
//  META WEBHOOK HANDLER
//  Handles: Facebook Messenger · FB Page Comments
//           Instagram DMs · Instagram Comments
//           TikTok Comments (stub — separate TikTok app)
// ============================================================
const express  = require('express');
const crypto   = require('crypto');
const router   = express.Router();

const { analyzeMessage }              = require('../services/analyzer');
const { computeScore, tierFromScore } = require('../services/scorer');
const {
  createLead, getLeadByExternalId, appendToNotes
} = require('../services/db');

function uid() {
  return 'l_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ── SIGNATURE VERIFICATION ────────────────────────────────────
function isSignatureValid(req) {
  const secret = process.env.META_APP_SECRET;
  const sig    = req.headers['x-hub-signature-256'];
  if (!secret || !sig) return true; // not enforced in dev
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.rawBody || '')
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch { return false; }
}

// ── WEBHOOK VERIFICATION (GET) ────────────────────────────────
router.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('✅ Webhook verified by Meta');
    return res.status(200).send(challenge);
  }
  res.status(403).send('Forbidden — verify token mismatch');
});

// ── TikTok VERIFICATION (GET) ─────────────────────────────────
// TikTok uses a different challenge format at /webhook/tiktok
router.get('/tiktok', (req, res) => {
  const challenge = req.query.challenge;
  if (challenge) return res.status(200).send(challenge);
  res.status(403).send('No challenge provided');
});

// ── INCOMING EVENTS (POST) ────────────────────────────────────
router.post('/', async (req, res) => {
  // Respond to Meta immediately — must reply within 20s or Meta retries
  res.sendStatus(200);

  if (!isSignatureValid(req)) {
    console.warn('⚠️  Invalid webhook signature — ignoring');
    return;
  }

  const body = req.body;
  if (!body?.object) return;

  for (const entry of (body.entry || [])) {
    try {
      // ── Facebook Messenger messages ──────────────────────
      if (body.object === 'page' && Array.isArray(entry.messaging)) {
        for (const event of entry.messaging) {
          if (event.message?.is_echo) continue; // Skip our own outgoing messages
          if (!event.message?.text)  continue;
          await handleMessenger(event);
        }
      }

      // ── Facebook Page feed (comments on posts) ───────────
      if (body.object === 'page' && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if (change.field === 'feed'
            && change.value?.item === 'comment'
            && change.value?.verb === 'add') {
            await handleFBComment(change.value);
          }
        }
      }

      // ── Instagram (DMs + comments) ────────────────────────
      if (body.object === 'instagram') {
        if (Array.isArray(entry.messaging)) {
          for (const event of entry.messaging) {
            if (event.message?.is_echo) continue;
            if (!event.message?.text)  continue;
            await handleInstagramDM(event);
          }
        }
        if (Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change.field === 'comments') {
              await handleInstagramComment(change.value);
            }
          }
        }
      }
    } catch (err) {
      console.error('❌ Error processing webhook entry:', err.message);
    }
  }
});

// TikTok comment webhook (POST)
router.post('/tiktok', async (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  if (!body) return;

  // TikTok comment event structure (TikTok for Business Events API)
  try {
    const comment = body.event?.comment || body.comment;
    if (comment?.text) {
      await processMessage({
        externalId:  comment.id || uid(),
        message:     comment.text,
        platform:    'TikTok',
        source:      'tiktok_comment',
        senderName:  comment.user?.display_name || comment.username || null,
        isDMThread:  false
      });
    }
  } catch (err) {
    console.error('❌ TikTok webhook error:', err.message);
  }
});

// ── HANDLERS ─────────────────────────────────────────────────
async function fetchFBProfile(userId) {
  if (!process.env.PAGE_ACCESS_TOKEN) return {};
  try {
    const r = await fetch(
      `https://graph.facebook.com/v19.0/${userId}?fields=first_name,last_name,name,username,profile_pic&access_token=${process.env.PAGE_ACCESS_TOKEN}`
    );
    return await r.json();
  } catch { return {}; }
}

async function handleMessenger(event) {
  const senderId = event.sender.id;
  let senderName = null, profilePic = null;

  const d = await fetchFBProfile(senderId);
  if (d.first_name) senderName = [d.first_name, d.last_name].filter(Boolean).join(' ');
  if (d.profile_pic) profilePic = d.profile_pic;

  console.log(`💬 Messenger: ${senderName || senderId} → "${event.message.text.slice(0, 80)}"`);
  await processMessage({
    externalId: senderId,
    message:    event.message.text,
    platform:   'Facebook Messenger',
    source:     'messenger',
    senderName, profilePic,
    isDMThread: true
  });
}

async function handleFBComment(value) {
  const comment = value.message;
  const name    = value.from?.name || null;
  const fromId  = value.from?.id   || null;
  if (!comment) return;

  let profilePic = null;
  if (fromId) {
    const d = await fetchFBProfile(fromId);
    if (d.profile_pic) profilePic = d.profile_pic;
  }

  console.log(`👍 FB Comment: ${name || 'unknown'} → "${comment.slice(0, 80)}"`);
  await processMessage({
    externalId: value.comment_id,
    message:    comment,
    platform:   'Facebook',
    source:     'facebook_comment',
    senderName: name, profilePic,
    isDMThread: false
  });
}

async function handleInstagramDM(event) {
  const senderId = event.sender.id;
  let senderName = null, profilePic = null;

  const d = await fetchFBProfile(senderId);
  senderName = d.name || (d.username ? '@' + d.username : null);
  if (d.profile_pic) profilePic = d.profile_pic;

  console.log(`📸 Instagram DM: ${senderName || senderId} → "${event.message.text.slice(0, 80)}"`);
  await processMessage({
    externalId: senderId,
    message:    event.message.text,
    platform:   'Instagram',
    source:     'instagram_dm',
    senderName, profilePic,
    isDMThread: true
  });
}

async function handleInstagramComment(value) {
  const text     = value.text;
  const username = value.from?.username || null;
  const fromId   = value.from?.id       || null;
  if (!text) return;

  let profilePic = null;
  if (fromId) {
    const d = await fetchFBProfile(fromId);
    if (d.profile_pic) profilePic = d.profile_pic;
  }

  console.log(`📸 IG Comment: @${username || 'unknown'} → "${text.slice(0, 80)}"`);
  await processMessage({
    externalId: value.id,
    message:    text,
    platform:   'Instagram',
    source:     'instagram_comment',
    senderName: username ? '@' + username : null,
    profilePic,
    isDMThread: false
  });
}

// ── CORE PROCESSING ───────────────────────────────────────────
async function processMessage({ externalId, message, platform, source, senderName, profilePic, isDMThread }) {
  // Analyze the message
  const analysis = await analyzeMessage({ message, platform, senderName });

  if (!analysis.isLead) {
    console.log(`   ↳ Not a lead (intent: ${analysis.intentScore}) — skipped`);
    return;
  }

  // For DM threads: if we already have a lead for this sender, append and update
  if (isDMThread && externalId) {
    const existing = getLeadByExternalId(externalId);
    if (existing) {
      const ts   = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
      const note = `[${ts} CDT] New message: "${message.slice(0, 400)}"`;
      appendToNotes(existing.id, note);
      console.log(`   ↳ Appended to existing lead "${existing.name}" (${existing.id})`);
      return;
    }
  }

  // Build and save new lead
  const now    = new Date().toISOString();
  const lead   = {
    id:         uid(),
    name:       analysis.name || senderName || `${platform} Inquiry`,
    phone:      '',
    email:      '',
    platform,
    status:     'New',
    timeline:   analysis.timeline  || 'Browsing',
    financing:  analysis.financing || 'Financing',
    vehicle:    analysis.vehicle   || '',
    assignedTo: '',
    followUp:   analysis.suggestedFollowUp ? 1 : 0,
    notes:      analysis.notes     || '',
    source,
    rawMessage:  message.slice(0, 2000),
    externalId:  externalId || '',
    profile_pic: profilePic || '',
    createdAt:   now,
    updatedAt:   now,
    score:      0,
    tier:       'New'
  };

  lead.score = computeScore(lead);
  lead.tier  = tierFromScore(lead.score);

  createLead(lead);
  console.log(`   ↳ ✅ Lead created: "${lead.name}" | ${lead.tier} | Score ${lead.score}`);
}

module.exports = router;
