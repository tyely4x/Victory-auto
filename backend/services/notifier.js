// ============================================================
//  NOTIFIER — SMS (Twilio) + Web Push
//  Fires when a new lead is created via webhook
// ============================================================
const webPush = require('web-push');

// ── VAPID setup ───────────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    'mailto:ty.ely4@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// In-memory push subscription store (survives restarts via DB in production)
const pushSubscriptions = new Set();

function savePushSubscription(sub) {
  pushSubscriptions.add(JSON.stringify(sub));
}

function removePushSubscription(sub) {
  pushSubscriptions.delete(JSON.stringify(sub));
}

// ── SMS via Twilio ────────────────────────────────────────────
async function sendSMS(lead) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, ALERT_PHONE } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM || !ALERT_PHONE) return;

  try {
    const twilio = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const emoji  = lead.tier === 'Hot' ? '🔥' : lead.tier === 'Warm' ? '⚡' : '📋';
    const body   = [
      `${emoji} ${lead.tier} Lead — Victory Auto`,
      `Name: ${lead.name}`,
      lead.vehicle ? `Vehicle: ${lead.vehicle}` : null,
      `Score: ${lead.score}/100`,
      lead.financing ? `Financing: ${lead.financing}` : null,
      `Source: ${lead.platform}`,
      `CRM: https://victory-auto-production.up.railway.app/lead-tracker.html`
    ].filter(Boolean).join('\n');

    await twilio.messages.create({ body, from: TWILIO_FROM, to: ALERT_PHONE });
    console.log(`📱 SMS sent → ${ALERT_PHONE}`);
  } catch (err) {
    console.warn('⚠️  SMS failed:', err.message);
  }
}

// ── Web Push ──────────────────────────────────────────────────
async function sendPushNotification(lead) {
  if (!process.env.VAPID_PUBLIC_KEY || pushSubscriptions.size === 0) return;

  const emoji   = lead.tier === 'Hot' ? '🔥' : lead.tier === 'Warm' ? '⚡' : '📋';
  const payload = JSON.stringify({
    title: `${emoji} New ${lead.tier} Lead — Victory Auto`,
    body:  `${lead.name}${lead.vehicle ? ' · ' + lead.vehicle : ''} · Score ${lead.score}`,
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    url:   '/lead-tracker.html'
  });

  const dead = [];
  for (const subStr of pushSubscriptions) {
    try {
      await webPush.sendNotification(JSON.parse(subStr), payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) dead.push(subStr);
    }
  }
  dead.forEach(s => pushSubscriptions.delete(s));
  if (pushSubscriptions.size > 0) console.log(`🔔 Push sent to ${pushSubscriptions.size} device(s)`);
}

// ── Main export ───────────────────────────────────────────────
async function notifyNewLead(lead) {
  // Only notify for New/Cool/Warm/Hot — skip Closed
  if (['Closed Won', 'Closed Lost'].includes(lead.status)) return;
  await Promise.all([sendSMS(lead), sendPushNotification(lead)]);
}

module.exports = { notifyNewLead, savePushSubscription, removePushSubscription };
