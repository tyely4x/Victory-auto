// ============================================================
//  AI MESSAGE ANALYZER
//  Primary: OpenAI GPT-4o-mini
//  Fallback: Rule-based keyword analysis
// ============================================================
const OpenAI = require('openai');

let _client = null;
function getClient() {
  if (!_client && process.env.OPENAI_API_KEY) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

// ── SYSTEM PROMPT ────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an AI assistant for Victory Auto Sales, a used car dealership in Memphis, TN (4885 Elmore Rd · 901-380-5800 · victoryauto.org).

Your job is to analyze inbound social media messages and comments from potential customers and determine if they represent a genuine car purchase inquiry.

Victory Auto Sales sells used cars, trucks, SUVs, vans, and RVs. They are active on Facebook, Instagram, and TikTok.

Analyze the provided message and return ONLY a valid JSON object with these exact fields:
{
  "isLead": boolean,
  "name": string | null,
  "vehicle": string | null,
  "timeline": "Ready now" | "Within a week" | "Within a month" | "Browsing" | null,
  "financing": "Cash" | "Financing" | null,
  "notes": string,
  "intentScore": number,
  "suggestedFollowUp": boolean
}

Field guidance:
- isLead: true if the person is genuinely interested in buying a vehicle or requesting info about one.
- name: Customer's name if mentioned in the message.
- vehicle: Vehicle they're interested in. Include year/make/model if stated (e.g. "2019 Ford F-150"). Use a general descriptor if vague (e.g. "SUV under $15K", "pickup truck").
- timeline: How soon are they ready? Default to "Browsing" if unclear.
- financing: "Cash" if they mention cash. "Financing" if they mention payments, financing, credit, or down payment. null if unclear.
- notes: A concise 1-2 sentence summary of what they said and what they want.
- intentScore: 1-5 scale.
  1 = Spam, reaction, or irrelevant (🔥 fire, "nice", "lol")
  2 = Casual interest, no specific intent ("how much are you guys usually?")
  3 = Moderate interest, asking about a vehicle ("is this still available?")
  4 = Strong interest, mentions timeline or specific needs ("need something this weekend")
  5 = Ready to buy / urgent ("I want to come in today, I have cash")
- suggestedFollowUp: true if intentScore >= 3.

NOT a lead (isLead: false) examples:
- Emoji-only reactions  
- Generic compliments with zero purchase intent ("fire page!", "goals 🙌")
- Clearly spam or bot messages
- Employees commenting on their own posts

ALWAYS return valid JSON only. No explanation or markdown.`;

// ── MAIN EXPORT ──────────────────────────────────────────────
async function analyzeMessage({ message, platform, senderName }) {
  const client = getClient();

  // Use OpenAI if available
  if (client) {
    try {
      return await analyzeWithAI(client, { message, platform, senderName });
    } catch (err) {
      console.warn('⚠️  OpenAI failed, falling back to rule-based:', err.message);
    }
  }

  // Fallback rule-based
  return ruleBasedAnalysis({ message, platform, senderName });
}

async function analyzeWithAI(client, { message, platform, senderName }) {
  const userMsg = [
    `Platform: ${platform}`,
    `Sender: ${senderName || 'Unknown'}`,
    `Message: "${message}"`
  ].join('\n');

  const response = await client.chat.completions.create({
    model:           'gpt-4o-mini',
    messages:        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
    response_format: { type: 'json_object' },
    temperature:     0.15,
    max_tokens:      450
  });

  const result = JSON.parse(response.choices[0].message.content);
  console.log(`🤖 OpenAI → isLead=${result.isLead} | intent=${result.intentScore} | vehicle="${result.vehicle || '—'}"`);
  return result;
}

// ── RULE-BASED FALLBACK ──────────────────────────────────────
function ruleBasedAnalysis({ message, platform, senderName }) {
  const text = (message || '').toLowerCase();
  const len  = text.trim().length;

  //  Very short or emoji-only → not a lead
  if (len < 4) return notLead(message, senderName);

  // Spam patterns
  if (/^(🔥+|❤️+|😍+|🙌+|👏+|💯+|dope|fire|fye|nice|lit|omg|lmao|lol|haha|😂+|fr fr|no 🧢|fr)$/i.test(text.trim())) {
    return notLead(message, senderName);
  }

  // ── Intent detection ──────────────────────────────────
  const highIntent = /available|how much|price|interested|wanna buy|want to buy|looking to buy|purchase|trade.?in|down payment|financ|monthly|cash|this weekend|today|asap|right now|ready|test drive|can i (come|see|look|get|schedule)|appointment|need a car|need a truck/i.test(text);
  const medIntent  = /still for sale|still available|info|more info|interested|looking for|need a|want a|what.s the price|how.s the price|what year|what miles|mileage|carfax|any issues|does it run|does it drive/i.test(text);
  const emojiOnly  = /^[\p{Emoji}\s]+$/u.test(text.trim());
  const casual     = /just (looking|browsing)|maybe|someday|one day|eventually|not ready yet/i.test(text);

  let intentScore = 1;
  if (emojiOnly) intentScore = 1;
  else if (highIntent) intentScore = 4;
  else if (medIntent)  intentScore = 3;
  else if (casual)     intentScore = 2;
  else if (len > 15)   intentScore = 2; // meaningful sentence, assume mild interest

  const isLead = intentScore >= 2 && !emojiOnly;

  if (!isLead) return notLead(message, senderName);

  // ── Vehicle extraction ────────────────────────────────
  const yearMakeMatch = text.match(/\b(19|20)\d{2}\b.{0,25}(ford|chevy|chevrolet|dodge|jeep|toyota|honda|hyundai|kia|nissan|gmc|ram|subaru|mazda|vw|volkswagen|bmw|mercedes|tesla|audi|lexus|cadillac|buick|chrysler|mitsubishi|acura|infiniti|lincoln|volvo|mini|pontiac|oldsmobile)/i);
  const genericMatch  = text.match(/\b(f-?150|f150|silverado|sierra|ram|tacoma|tundra|camry|accord|civic|altima|malibu|equinox|pathfinder|explorer|traverse|tahoe|suburban|yukon|escalade|4runner|highlander|cx-5|rav4|cr-v|pilot|odyssey|sienna|durango|charger|challenger|mustang|wrangler|gladiator|bronco|maverick|ridgeline|colorado|canyon|frontier|titan)\b/i);
  const classMatch    = text.match(/\b(suv|truck|pickup|van|minivan|sedan|coupe|hatchback|wagon|convertible|rv|camper)\b/i);

  const vehicle = yearMakeMatch
    ? yearMakeMatch[0].trim()
    : genericMatch
    ? genericMatch[0]
    : classMatch
    ? classMatch[0]
    : null;

  // ── Timeline ──────────────────────────────────────────
  const timeline =
    /today|asap|right now|this weekend|tomorrow|immediately|ready (now|to buy)/i.test(text) ? 'Ready now' :
    /this week|next week|few days|couple days/i.test(text) ? 'Within a week' :
    /this month|end of (the )?month|next month|few weeks/i.test(text) ? 'Within a month' :
    /just looking|browsing|eventually|not sure yet|maybe/i.test(text) ? 'Browsing' :
    null;

  // ── Financing ─────────────────────────────────────────
  const financing =
    /\bcash\b|\bpay cash\b|\bfull price\b/i.test(text) ? 'Cash' :
    /\bfinance\b|\bloan\b|\bcredit\b|\bmonthly\b|\bpayment\b|\bdown\b|\bpre.?approv/i.test(text) ? 'Financing' :
    null;

  return {
    isLead:           true,
    name:             senderName || null,
    vehicle,
    timeline,
    financing,
    notes:            `${platform} inquiry: "${message.slice(0, 150)}${message.length > 150 ? '…' : ''}"`,
    intentScore,
    suggestedFollowUp: intentScore >= 3
  };
}

function notLead(message, senderName) {
  return { isLead: false, name: senderName || null, vehicle: null, timeline: null, financing: null, notes: '', intentScore: 1, suggestedFollowUp: false };
}

module.exports = { analyzeMessage };
