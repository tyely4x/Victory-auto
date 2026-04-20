// ============================================================
//  LEADS REST API
//  GET /api/leads          - list all leads
//  GET /api/leads/:id      - get one lead
//  POST /api/leads         - create lead (manual)
//  PUT /api/leads/:id      - update lead
//  DELETE /api/leads/:id   - delete lead
//  GET /api/leads/stats    - dashboard stats
// ============================================================
const express = require('express');
const router  = express.Router();

const { getAllLeads, getLeadById, createLead, updateLead, deleteLead } = require('../services/db');
const { computeScore, tierFromScore } = require('../services/scorer');
const { savePushSubscription, removePushSubscription } = require('../services/notifier');

function uid() {
  return 'l_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ── GET /api/leads/stats  (must be before /:id) ───────────────
router.get('/stats', (req, res) => {
  try {
    const leads  = getAllLeads();
    const active = leads.filter(l => !['Closed Won', 'Closed Lost'].includes(l.status));
    const won    = leads.filter(l => l.status === 'Closed Won').length;
    const closed = won + leads.filter(l => l.status === 'Closed Lost').length;

    res.json({
      total:   leads.length,
      hot:     active.filter(l => l.tier === 'Hot').length,
      warm:    active.filter(l => l.tier === 'Warm').length,
      cool:    active.filter(l => l.tier === 'Cool').length,
      newTier: active.filter(l => l.tier === 'New').length,
      follow:  active.filter(l => l.followUp).length,
      handed:  active.filter(l => l.status === 'Handed Off').length,
      won,
      closeRate: closed > 0 ? Math.round((won / closed) * 100) : 0,
      activeCount: active.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/leads ────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    res.json({ leads: getAllLeads() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/leads/:id ────────────────────────────────────────
router.get('/:id', (req, res) => {
  const lead = getLeadById(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

// ── POST /api/leads ───────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const data = req.body || {};
    if (!data.name?.trim()) return res.status(400).json({ error: 'name is required' });

    const now  = new Date().toISOString();
    const lead = {
      id:         data.id        || uid(),
      name:       data.name.trim(),
      phone:      data.phone     || '',
      email:      data.email     || '',
      platform:   data.platform  || 'Manual',
      status:     data.status    || 'New',
      timeline:   data.timeline  || 'Browsing',
      financing:  data.financing || 'Financing',
      vehicle:    data.vehicle   || '',
      assignedTo: data.assignedTo|| '',
      followUp:   data.followUp  || false,
      notes:      data.notes     || '',
      source:     data.source    || 'manual',
      rawMessage: data.rawMessage|| '',
      externalId: data.externalId|| '',
      createdAt:  data.createdAt || now,
      updatedAt:  now,
      score:      0,
      tier:       'New'
    };

    lead.score = computeScore(lead);
    lead.tier  = tierFromScore(lead.score);

    res.status(201).json(createLead(lead));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/leads/:id ────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const existing = getLeadById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Lead not found' });

    const updates = { ...req.body };
    delete updates.id;
    delete updates.createdAt;
    delete updates.externalId;

    // Recalculate score on every update
    const merged  = { ...existing, ...updates };
    updates.score = computeScore(merged);
    updates.tier  = tierFromScore(updates.score);

    res.json(updateLead(req.params.id, updates));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/leads/:id ─────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    if (!getLeadById(req.params.id)) return res.status(404).json({ error: 'Lead not found' });
    deleteLead(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Push subscription management
router.post('/push/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  savePushSubscription(sub);
  res.json({ success: true });
});

router.post('/push/unsubscribe', (req, res) => {
  removePushSubscription(req.body);
  res.json({ success: true });
});

router.get('/push/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

module.exports = router;
