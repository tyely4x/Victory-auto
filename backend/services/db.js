// ============================================================
//  DATABASE SERVICE — sql.js (pure-JS SQLite, no build tools)
//  Persists to: backend/data/leads.db  (binary file)
// ============================================================
const initSqlJs = require('sql.js');
const path      = require('path');
const fs        = require('fs');

// Use DATA_DIR env var (set in Railway to the mounted volume path), else local fallback
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const DB_PATH = path.join(dataDir, 'leads.db');

let db; // sql.js Database instance

// ── INIT ──────────────────────────────────────────────────────
async function initDb() {
  const SQL = await initSqlJs();
  
  // Load existing DB file or create new
  if (fs.existsSync(DB_PATH)) {
    const file = fs.readFileSync(DB_PATH);
    db = new SQL.Database(file);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL DEFAULT '',
      phone       TEXT          DEFAULT '',
      email       TEXT          DEFAULT '',
      platform    TEXT          DEFAULT 'Manual',
      status      TEXT          DEFAULT 'New',
      timeline    TEXT          DEFAULT 'Browsing',
      financing   TEXT          DEFAULT 'Financing',
      vehicle     TEXT          DEFAULT '',
      assignedTo  TEXT          DEFAULT '',
      followUp    INTEGER       DEFAULT 0,
      notes       TEXT          DEFAULT '',
      score       INTEGER       DEFAULT 0,
      tier        TEXT          DEFAULT 'New',
      source      TEXT          DEFAULT 'manual',
      rawMessage  TEXT          DEFAULT '',
      externalId  TEXT          DEFAULT '',
      profile_pic TEXT          DEFAULT '',
      createdAt   TEXT          NOT NULL,
      updatedAt   TEXT          NOT NULL
    );
  `);

  // Add profile_pic column to existing databases that predate this field
  try { db.run(`ALTER TABLE leads ADD COLUMN profile_pic TEXT DEFAULT ''`); } catch { /* already exists */ }

  persist(); // Save initial schema
  console.log('✅ Database ready →', DB_PATH);
}

// Write in-memory DB to disk
function persist() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ── HELPERS ───────────────────────────────────────────────────
function rowsToObjects(results) {
  if (!results.length) return [];
  const { columns, values } = results[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return normalizeLead(obj);
  });
}

function normalizeLead(row) {
  return { ...row, followUp: !!row.followUp };
}

// ── QUERIES ───────────────────────────────────────────────────
function getAllLeads() {
  const res = db.exec('SELECT * FROM leads ORDER BY createdAt DESC');
  return rowsToObjects(res);
}

function getLeadById(id) {
  const res = db.exec('SELECT * FROM leads WHERE id = ?', [id]);
  const rows = rowsToObjects(res);
  return rows[0] || null;
}

function getLeadByExternalId(externalId) {
  if (!externalId) return null;
  const res = db.exec('SELECT * FROM leads WHERE externalId = ? AND externalId != ""', [externalId]);
  const rows = rowsToObjects(res);
  return rows[0] || null;
}

function createLead(lead) {
  db.run(`
    INSERT INTO leads
      (id, name, phone, email, platform, status, timeline, financing, vehicle,
       assignedTo, followUp, notes, score, tier, source, rawMessage, externalId, profile_pic, createdAt, updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, [
    lead.id, lead.name, lead.phone||'', lead.email||'', lead.platform||'Manual',
    lead.status||'New', lead.timeline||'Browsing', lead.financing||'Financing',
    lead.vehicle||'', lead.assignedTo||'', lead.followUp ? 1 : 0,
    lead.notes||'', lead.score||0, lead.tier||'New',
    lead.source||'manual', lead.rawMessage||'', lead.externalId||'',
    lead.profile_pic||'', lead.createdAt, lead.updatedAt
  ]);
  persist();
  return getLeadById(lead.id);
}

function updateLead(id, updates) {
  updates = { ...updates, updatedAt: new Date().toISOString() };
  if (typeof updates.followUp === 'boolean') updates.followUp = updates.followUp ? 1 : 0;
  
  const cols  = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const vals  = [...Object.values(updates), id];
  db.run(`UPDATE leads SET ${cols} WHERE id = ?`, vals);
  persist();
  return getLeadById(id);
}

function deleteLead(id) {
  db.run('DELETE FROM leads WHERE id = ?', [id]);
  persist();
}

function appendToNotes(id, text) {
  const lead = getLeadById(id);
  if (!lead) return null;
  const notes = lead.notes
    ? lead.notes + '\n─────────────────────────\n' + text
    : text;
  return updateLead(id, { notes, followUp: 1 });
}

module.exports = {
  initDb, getAllLeads, getLeadById, getLeadByExternalId,
  createLead, updateLead, deleteLead, appendToNotes
};
