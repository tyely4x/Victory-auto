// ============================================================
//  LEAD SCORING ENGINE
//  Mirrors the scoring logic in lead-tracker.html exactly
// ============================================================

const SCORE_MAP = {
  status: {
    'New': 10, 'Contacted': 20, 'Qualified': 30,
    'Handed Off': 40, 'Closed Won': 40, 'Closed Lost': 0
  },
  timeline: {
    'Ready now': 35, 'Within a week': 25, 'Within a month': 10, 'Browsing': -10
  },
  financing: {
    'Cash': 25, 'Financing': 15
  },
  platform: {
    'Walk-in': 20, 'Phone': 15, 'Referral': 15,
    'Facebook Marketplace': 12,
    'Facebook': 10, 'Facebook Messenger': 10,
    'Instagram': 8,  'Instagram DM': 8, 'Instagram Comment': 6,
    'TikTok': 6,     'TikTok Comment': 5,
    'Website': 8, 'YouTube': 5, 'Other': 5, 'Manual': 5
  }
};

function computeScore(lead) {
  let s = 0;
  s += SCORE_MAP.status[lead.status]       ?? 10;
  s += SCORE_MAP.timeline[lead.timeline]   ?? -10;
  s += SCORE_MAP.financing[lead.financing] ?? 15;
  s += SCORE_MAP.platform[lead.platform]   ?? 5;
  if (lead.phone?.trim())   s += 10;
  if (lead.email?.trim())   s += 8;
  if (lead.vehicle?.trim()) s += 7;
  return Math.max(0, Math.min(100, s));
}

function tierFromScore(score) {
  if (score >= 80) return 'Hot';
  if (score >= 55) return 'Warm';
  if (score >= 30) return 'Cool';
  return 'New';
}

module.exports = { computeScore, tierFromScore };
