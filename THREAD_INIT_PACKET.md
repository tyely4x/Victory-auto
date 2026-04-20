# 🚗 VICTORY AUTO SALES — THREAD INITIALIZATION PACKET
## Handoff Document for Claude Code / Continuation Agent

---

## 1. PROJECT IDENTITY

| Field | Value |
|---|---|
| **App Name** | Victory Auto Sales — Lead Tracker CRM |
| **Client** | Victory Auto Sales, Memphis TN · victoryauto.org |
| **Local Path** | `C:\Users\tyely\OneDrive\Desktop\AntiGrav Workspaces\VictoryAutoSales\` |
| **Local Dev URL** | `http://localhost:3000/lead-tracker.html` |
| **OS** | Windows 11 |
| **Node version req** | ≥ 18.0.0 |

---

## 2. WHAT THIS APP IS

A full-stack **CRM lead tracker** for a used car dealership. It:

1. Captures leads from **Facebook Messenger**, **Instagram DMs**, **Instagram comments**, **TikTok comments**, and **manual entry**
2. **AI-analyzes** every incoming social media message (OpenAI GPT-4o-mini) to extract vehicle interest, financing signals, and buying intent
3. **Auto-scores** every lead 0–100 and tiers them (Hot/Warm/Cool/New) based on a weighted scoring engine
4. Displays everything in a **professional dark CRM dashboard** with sidebar navigation, live charts, pipeline board, and detail drawer
5. Is **PWA-installable** on iPhone and Android (Add to Home Screen)
6. Is designed to **deploy to Railway** for universal access from any device

---

## 3. COMPLETE FILE STRUCTURE

```
VictoryAutoSales/                        ← Project root (served as static by Express)
├── lead-tracker.html                    ← SINGLE FILE FRONTEND (all CSS + HTML + JS, ~1,970 lines)
├── manifest.json                        ← PWA Web App Manifest
├── sw.js                                ← PWA Service Worker (offline cache)
├── victory-logo.png                     ← Brand logo (oval chrome badge) — served at /victory-logo.png
├── icon-192.png                         ← PWA app icon 192px
├── icon-512.png                         ← PWA app icon 512px
├── SETUP.md                             ← Deployment & Meta webhook setup guide
│
└── backend/
    ├── index.js                         ← Express server entry point
    ├── package.json                     ← Dependencies: express, cors, sql.js, openai, dotenv
    ├── railway.toml                     ← Railway deploy config (NIXPACKS + persistent volume)
    ├── .env.example                     ← Template for secret env vars
    ├── .gitignore                       ← Excludes .env, node_modules, data/*.db
    │
    ├── routes/
    │   ├── webhook.js                   ← Meta webhook handler (FB Messenger, IG DM, IG/FB/TikTok comments)
    │   └── leads.js                     ← REST API for leads CRUD + /stats endpoint
    │
    ├── services/
    │   ├── db.js                        ← SQLite via sql.js (pure JS, no native build tools needed)
    │   ├── analyzer.js                  ← OpenAI GPT-4o-mini message analyzer + rule-based fallback
    │   └── scorer.js                    ← Lead scoring engine (weights by status/timeline/financing/platform)
    │
    └── data/
        └── leads.db                     ← SQLite binary database (auto-created on first run)
```

---

## 4. TECH STACK

### Frontend (`lead-tracker.html`)
- **Pure Vanilla HTML + CSS + JavaScript** — zero build step, zero npm dependencies
- **Chart.js v4.4.2** via CDN — activity line chart + lead sources donut chart
- **Google Fonts** — Inter typeface via CDN
- **Design System** — Glassmorphism (backdrop-filter blur), Victory Auto brand crimson red `#c8102e`, near-black backgrounds
- **Architecture** — SPA with JS-driven view switching (no router library), localStorage fallback when API offline

### Backend (`backend/`)
- **Express.js** — REST API + static file serving + webhook endpoint
- **sql.js** — Pure JavaScript SQLite (chosen specifically to avoid Python/Visual Studio C++ build tools on Windows)
- **OpenAI SDK v4** — GPT-4o-mini for message analysis
- **dotenv** — environment variable management
- **cors** — open CORS (allows any origin)

### Infrastructure
- **Deployment target**: Railway (configured in `railway.toml`)
- **Database**: SQLite file at `backend/data/leads.db`, persisted via Railway volume at `/app/data`
- **PWA**: `manifest.json` + `sw.js` = installable on iOS/Android

---

## 5. HOW TO START LOCALLY

```powershell
cd "C:\Users\tyely\OneDrive\Desktop\AntiGrav Workspaces\VictoryAutoSales\backend"
npm install           # first time only
npm start             # or: node index.js
```

Then open: `http://localhost:3000/lead-tracker.html`

Click **"Load Sample"** button to populate with 10 demo leads.

> The frontend works in offline/localStorage mode even if the backend is not running.
> The connection pill in the topbar shows "Live · API Connected" (green) or "Offline Mode" (gray).

---

## 6. BACKEND API REFERENCE

**Base URL**: `http://localhost:3000` (local) or `https://YOUR-APP.railway.app` (production)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/leads` | Returns `{ leads: [...] }` — all leads sorted by score desc |
| `POST` | `/api/leads` | Create a lead. Body: lead object (see schema below) |
| `PUT` | `/api/leads/:id` | Update a lead. Body: partial lead object |
| `DELETE` | `/api/leads/:id` | Delete a lead |
| `GET` | `/api/leads/stats` | Returns pipeline statistics |
| `GET` | `/webhook` | Meta webhook verification (GET challenge) |
| `POST` | `/webhook` | Meta webhook event receiver |
| `GET` | `/health` | Returns `{ status: 'ok', timestamp, version }` |

### Lead Schema

```json
{
  "id": "l_abc123_xyz789",
  "name": "John Smith",
  "phone": "901-555-0100",
  "email": "john@example.com",
  "platform": "Facebook Messenger",
  "source": "messenger",
  "status": "New",
  "timeline": "Within a week",
  "financing": "Financing",
  "vehicle": "2019 Ford F-150",
  "assignedTo": "Sales Rep 1",
  "followUp": false,
  "notes": "Interested in trucks",
  "rawMessage": "hey is the f150 still available?",
  "externalId": "fb_1234567890",
  "score": 87,
  "tier": "Hot",
  "createdAt": "2026-04-18T19:00:00.000Z",
  "updatedAt": "2026-04-18T19:00:00.000Z"
}
```

### Source field values
`manual` | `messenger` | `instagram_dm` | `instagram_comment` | `facebook_comment` | `tiktok_comment`

### Status field values
`New` | `Contacted` | `Qualified` | `Handed Off` | `Closed Won` | `Closed Lost`

### Platform field values
`Walk-in` | `Phone` | `Facebook Messenger` | `Facebook` | `Instagram` | `TikTok` | `Website` | `Referral` | `Other`

---

## 7. SCORING ENGINE

Located in `backend/services/scorer.js` and duplicated client-side in `lead-tracker.html` (JS section, function `computeScore()`).

```javascript
// Score weights (max 100 pts):
status:    { New:10, Contacted:20, Qualified:30, 'Handed Off':40, 'Closed Won':40, 'Closed Lost':0 }
timeline:  { 'Ready now':35, 'Within a week':25, 'Within a month':10, 'Browsing':-10 }
financing: { 'Cash':25, 'Financing':15 }
platform:  { 'Walk-in':20, 'Phone':15, 'Referral':15, 'Facebook Marketplace':12, 'Facebook':10,
             'Facebook Messenger':10, 'Instagram':8, 'TikTok':6, 'Website':8, 'Other':5 }
bonuses:   phone present +10, email present +8, vehicle specified +7

// Tiers:
Hot  ≥ 80 | Warm 55-79 | Cool 30-54 | New 0-29
```

---

## 8. META WEBHOOK INTEGRATION (Built, Config Pending)

### What the code does (`backend/routes/webhook.js`):
1. **GET /webhook** — Returns the `hub.challenge` for Meta verification
2. **POST /webhook** — Receives events, routes by type, calls analyzer, creates/updates leads
3. Handles: `messages` (Messenger + IG DM), `feed` events (FB comments), `instagram` comments
4. **De-duplication**: Uses `externalId` (sender's platform ID) to thread conversations — same sender = appends to existing lead notes, does NOT create a duplicate
5. **Signature verification**: Validates `X-Hub-Signature-256` header using `META_APP_SECRET`

### What still needs external configuration:
1. Deploy backend to Railway → get public HTTPS URL
2. Create Meta Developer App at developers.facebook.com
3. Add products: **Messenger** + **Instagram Graph API**
4. Register webhook: URL = `https://YOUR-RAILWAY-URL/webhook`, Verify Token = `META_VERIFY_TOKEN` from `.env`
5. Subscribe to fields: `messages`, `messaging_postbacks`, `feed`, `comments`, `live_comments`
6. Generate **Page Access Token** → add to `.env` as `PAGE_ACCESS_TOKEN`
7. Subscribe Facebook Page to app via Graph API call
8. Optionally add OpenAI key to `.env` for AI analysis (falls back to rule-based if missing)

---

## 9. FRONTEND UI ARCHITECTURE (`lead-tracker.html`)

### Views (JS-driven, no router)
| View ID | Nav Item | Description |
|---|---|---|
| `view-dashboard` | Dashboard | KPI cards + activity chart + source donut + recent leads + follow-up queue + pipeline status |
| `view-leads` | All Leads | Full sortable/filterable table + card view toggle |
| `view-pipeline` | Pipeline | Kanban board with 6 status columns |

### Key JS Functions
| Function | Purpose |
|---|---|
| `loadData()` | Fetches from API, falls back to localStorage |
| `render()` | Recalculates scores, saves local, calls view-specific render |
| `renderDashboard()` | KPIs + charts + recent leads + follow-up + pipeline stages |
| `buildActivityChart()` | Chart.js line chart — leads over 30/60/90 days |
| `buildSourceChart()` | Chart.js donut — lead source distribution |
| `renderLeads()` | Leads table with sort/filter |
| `renderPipeline()` | Kanban board |
| `openDrawer(id)` | Opens right-slide lead detail drawer |
| `saveDrawer()` | Saves drawer edits to API or localStorage |
| `openModal()` | Opens new lead creation modal |
| `pollLeads()` | Called every 30s to auto-fetch new social media leads |
| `computeScore(lead)` | Client-side scoring engine (mirrors backend) |
| `exportCSV()` | Downloads all leads as CSV |
| `makeSamples()` | Generates 10 demo leads (Load Sample button) |

### State Object
```javascript
const state = {
  leads: [],          // All lead objects in memory
  connected: false,   // API connection status
  lastCount: 0,       // For detecting new auto-created leads
  sort: { key: 'score', dir: 'desc' },
  filters: { status:'', platform:'', source:'', tier:'', follow:'', search:'' },
  editingId: null,    // Currently open lead in drawer
  currentView: 'dashboard'
};
```

### Design System
- **Primary accent**: `#c8102e` (Victory Auto crimson red)
- **Background**: `#080809` near-black with 4 very subtle red radial gradient orbs
- **Cards**: `rgba(14,14,18,0.62)` + `backdrop-filter: blur(24px) saturate(160%)` = frosted glass
- **Font**: Inter (Google Fonts CDN)
- **Sidebar width**: 228px expanded / 64px collapsed

---

## 10. ENVIRONMENT VARIABLES REQUIRED

Create `backend/.env` (copy from `backend/.env.example`):

```env
PORT=3000
META_VERIFY_TOKEN=your-chosen-secret-string
META_APP_SECRET=from-meta-developer-portal
PAGE_ACCESS_TOKEN=from-meta-messenger-settings
OPENAI_API_KEY=sk-...   # Optional — falls back to rule-based analysis
```

---

## 11. DEPLOYMENT PLAN (Railway)

### Steps:
1. Push project to GitHub (initialize git in the root `VictoryAutoSales/` folder)
2. Go to railway.app → New Project → Deploy from GitHub Repo → select repo
3. Railway auto-detects Node.js from `backend/package.json`

> [!IMPORTANT]
> Railway's root directory must be set to `backend/` OR the `railway.toml` start command must be `node backend/index.js`

4. Add environment variables in Railway dashboard (all 4 vars from section 10)
5. Railway provides HTTPS URL: `https://victory-auto-xxxx.railway.app`
6. Use that URL as:
   - Meta webhook callback URL
   - The `window.VICTORY_API` override in `lead-tracker.html` (currently defaults to `http://localhost:3000`)

### Critical: Update API_BASE for production
In `lead-tracker.html` line ~1130:
```javascript
const API_BASE = window.VICTORY_API || 'http://localhost:3000';
```
Override this by injecting `window.VICTORY_API = 'https://your-railway-url.railway.app'` from the backend before serving the HTML — or hardcode the Railway URL once deployed.

---

## 12. REMAINING TODO LIST

### High Priority
- [ ] Push code to GitHub (git init + first commit)
- [ ] Deploy backend to Railway
- [ ] Set `API_BASE` to production Railway URL in `lead-tracker.html`
- [ ] Create Meta Developer App + configure webhooks
- [ ] Get Page Access Token → add to Railway env vars
- [ ] End-to-end test: send a Facebook message → verify it creates a lead in the CRM
- [ ] Share Railway URL with sales team + add to phones as PWA

### Nice to Have / Future
- [ ] Add TikTok Developer App registration (separate portal from Meta)
- [ ] Role-based access (owner vs. sales rep views)
- [ ] Email/SMS notification when a new Hot lead comes in
- [ ] Lead assignment workflow (assign lead to rep directly from CRM)
- [ ] Monthly/weekly report export (currently exports all leads as CSV)
- [ ] Dark/light mode toggle

---

## 13. KNOWN ISSUES & GOTCHAS

1. **`sql.js` load**: Database init is async — server won't accept requests until `initDb()` resolves. This is handled correctly in `index.js` with the async IIFE.

2. **Windows build tools**: We specifically chose `sql.js` (pure JS SQLite) over `better-sqlite3` because `better-sqlite3` requires Python + Visual Studio C++ build tools on Windows. **Do not switch back to `better-sqlite3`.**

3. **Meta App Review**: Full Instagram DM access for business accounts requires Meta App Review (1–4 weeks approval process). Instagram comments and Facebook Messenger work immediately in Development Mode for testing.

4. **Score sync**: The scoring engine is duplicated in both `backend/services/scorer.js` and frontend JS (`lead-tracker.html`). If scoring weights change, update **both** files.

5. **Chart.js canvas colors**: CSS `backdrop-filter` and CSS overrides do not affect `<canvas>` elements. Chart colors must be set in the JS chart config directly (not via CSS variables).

6. **PWA service worker**: Must be served over HTTPS (or localhost) to activate. Will not work on local file:// URLs. Works correctly when served by the Express backend.

7. **Port conflict**: If localhost:3000 is in use, change `PORT` in `.env` — the frontend hardcodes `http://localhost:3000` as fallback.

---

## 14. QUICK REFERENCE — KEY LINES IN lead-tracker.html

| Line(s) | What's there |
|---|---|
| 1–18 | `<head>` — PWA meta tags, manifest, font, Chart.js CDN |
| 19–720 | `<style>` — Full CSS design system |
| 720–882 | Brand color override CSS block (red palette, logo sizing) |
| 883–885 | `</style></head><body>` |
| 886–1100 | HTML structure (sidebar, topbar, dashboard view, leads view, pipeline view) |
| 1101–1115 | Lead drawer HTML |
| 1116–1135 | New lead modal HTML |
| 1136–1970 | `<script>` — all application JavaScript |
| ~1138 | `const API_BASE` — change this for production |
| ~1155 | `computeScore()` — client-side scoring engine |
| ~1185 | `state` object |
| ~1200 | `apiFetch()` — generic API wrapper |
| ~1215 | `loadData()` — API fetch with localStorage fallback |
| ~1240 | `buildActivityChart()` — Chart.js line chart |
| ~1265 | `buildSourceChart()` — Chart.js donut chart |
| ~1285 | `renderDashboard()` |
| ~1360 | `renderLeads()` — table rendering |
| ~1430 | `renderPipeline()` — kanban board |
| ~1460 | `openDrawer()` — lead detail slide panel |
| ~1560 | `saveDrawer()` |
| ~1580 | `openModal()` / `closeModal()` |
| ~1620 | Event listeners (all of them) |
| ~1770 | `makeSamples()` — 10 demo leads |
| ~1960 | `(async()=>{...})()` — init block + service worker registration |
