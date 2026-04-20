# Victory Auto Sales — Meta Integration Setup Guide

## What Was Built

```
VictoryAutoSales/
├── lead-tracker.html          ← Frontend (open in browser)
└── backend/
    ├── index.js               ← Express server (entry point)
    ├── package.json
    ├── railway.toml           ← Railway deployment config
    ├── .env.example           ← Copy to .env and fill in values
    ├── routes/
    │   ├── webhook.js         ← Receives Facebook/Instagram messages
    │   └── leads.js           ← REST API for the frontend
    └── services/
        ├── analyzer.js        ← OpenAI GPT-4o-mini message analysis
        ├── scorer.js          ← Lead scoring engine
        └── db.js              ← SQLite database
```

---

## STEP 1 — Install Node.js (if not installed)

Download from: **https://nodejs.org** → Install the LTS version.

Verify it worked by opening PowerShell and running:
```
node --version
```

---

## STEP 2 — Install Backend Dependencies

Open PowerShell, navigate to the backend folder and install:

```powershell
cd "C:\Users\tyely\OneDrive\Desktop\AntiGrav Workspaces\VictoryAutoSales\backend"
npm install
```

---

## STEP 3 — Create Your .env File

```powershell
copy .env.example .env
```

Open `.env` in a text editor and fill in:

| Variable | Where to get it |
|---|---|
| `META_VERIFY_TOKEN` | Make up any string (e.g. `victory-auto-webhook-2024`) — you'll use this in Meta setup |
| `META_APP_SECRET` | Meta Developer Portal → Your App → Settings → Basic |
| `PAGE_ACCESS_TOKEN` | Meta Developer Portal → Messenger Settings → Page Access Token |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |

---

## STEP 4 — Run the Backend Locally

```powershell
npm run dev
```

You should see:
```
🚗  Victory Auto Sales Backend
────────────────────────────────────────
   App:     http://localhost:3000
   API:     http://localhost:3000/api/leads
   Webhook: http://localhost:3000/webhook
   Mode:    AI-powered ✅
```

Open `lead-tracker.html` in your browser. The status pill in the top bar should turn green and say **"Live · API Connected"**.

---

## STEP 5 — Deploy to Railway (Public HTTPS URL)

Meta requires a **public HTTPS URL** for webhooks. Railway provides this for free.

### 5a. Create Railway account
Go to **https://railway.app** → Sign up with GitHub (free).

### 5b. Deploy
1. In Railway dashboard → **New Project** → **Deploy from GitHub repo**
2. Upload or connect the `VictoryAutoSales` folder to a GitHub repo
3. Set the root directory to `backend`
4. Add environment variables in Railway dashboard (same as your `.env`)
5. Railway auto-assigns a URL like `https://victory-auto-xxxx.railway.app`

### 5c. Add a persistent volume (keeps your database between deploys)
In Railway → your service → **Volumes** → Add volume → Mount at `/app/data`

### 5d. Update the frontend API_BASE
Open `lead-tracker.html` and find this line near the top of the `<script>`:
```js
const API_BASE = window.VICTORY_API || 'http://localhost:3000';
```
Change it to your Railway URL:
```js
const API_BASE = window.VICTORY_API || 'https://victory-auto-xxxx.railway.app';
```

---

## STEP 6 — Meta App Setup (Facebook + Instagram)

### 6a. Create a Meta App
1. Go to **https://developers.facebook.com**
2. **My Apps → Create App → Business**
3. App name: "Victory Auto Lead Tracker"
4. Add your business manager if you have one

### 6b. Add Messenger Product
1. Dashboard → **Add Product → Messenger → Set Up**
2. Under **Access Tokens** → Generate token for the **Victory Auto Sales** Facebook Page
3. Copy this token → paste into your `.env` as `PAGE_ACCESS_TOKEN`

### 6c. Register the Webhook (Messenger)
1. Messenger Settings → **Webhooks → Add Callback URL**
2. Callback URL: `https://your-railway-url.railway.app/webhook`
3. Verify Token: whatever you put in `META_VERIFY_TOKEN`
4. Subscribe to: `messages`, `messaging_postbacks`

### 6d. Subscribe to your Page
Under Messenger → Webhooks → Subscribe to your Page.

### 6e. Add Instagram Product
1. Dashboard → **Add Product → Instagram**
2. Connect your Instagram Professional account
3. Subscribe to webhook events: `messages`, `comments`
4. Same callback URL and verify token

### 6e. Submit for App Review
- `pages_messaging` permission → required for Messenger DMs
- `instagram_manage_messages` → required for Instagram DMs
- `instagram_manage_comments` → required for Instagram comments
- **Instagram comments and Facebook Page comments** often work with basic access while you wait for review

---

## STEP 7 — TikTok Setup (Separate)

TikTok uses its own developer platform. The backend has a `/webhook/tiktok` endpoint ready.

1. Go to **https://developers.tiktok.com**
2. Create an app → Add "Comment Management" scope
3. Set webhook URL to `https://your-railway-url.railway.app/webhook/tiktok`
4. TikTok requires App Review for DM access — comment webhooks are easier to get

---

## Testing the Integration

### Test Messenger
1. Open Facebook on your phone
2. Find the **Victory Auto Sales** Page
3. Send a message: `"Hey is the F-150 still available? I'm cash ready this weekend"`
4. Within a few seconds, a new **Hot** lead should appear in your tracker

### Test Instagram Comment
1. Comment on one of your Instagram posts: `"How much is this one? Do you finance?"`
2. A new lead should appear in the tracker automatically

### Test via curl (developer test)
```bash
# Test the API directly
curl http://localhost:3000/api/leads

# Manually create a test lead
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Lead","platform":"Facebook Messenger","status":"New","timeline":"Ready now","financing":"Cash","vehicle":"2020 F-150"}'
```

---

## How the AI Analysis Works

When a message comes in, GPT-4o-mini reads it and extracts:

| Field | Example |
|---|---|
| Vehicle interest | "2019 Hyundai Tucson" |
| Timeline | "Ready now" (detected "this weekend") |
| Financing | "Cash" (detected "pay cash") |
| Intent score | 4/5 (strong interest) |
| Notes | "Inquiring about the Tucson - mentioned cash and wants to come in soon" |

The lead is then scored using the same 0-100 scoring engine as manual leads, and appears in the tracker within seconds.

For messages that are not car inquiries (emoji reactions, spam, compliments), the AI returns `isLead: false` and nothing is created.

---

## Costs

| Service | Cost |
|---|---|
| Railway (backend hosting) | Free tier → ~$5/mo if you hit limits |
| Railway Volume (database persistence) | $0.25/GB/month |
| OpenAI GPT-4o-mini | ~$0.01–$0.05 per analyzed message |
| Meta API | Free |
| TikTok API | Free |

**Estimated monthly cost for a typical dealership:** $5–15/month total.
