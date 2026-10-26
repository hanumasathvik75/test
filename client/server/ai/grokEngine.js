/**
 * Milo Grok LLM Engine (server/ai/grokEngine.js)
 * Implements xAI Grok hybrid intelligence layer.
 * Resolves driver and customer doubts, questions, and edge cases
 * while respecting Milo's strict verified business facts.
 */

const miloConfig = require('../config/miloConfig');

// In-memory API key store with fallback to environment variables
let runtimeApiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY || '';
const GROK_MODEL = process.env.GROK_MODEL || 'grok-2-latest';
const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

/**
 * Update or set runtime Grok API key
 */
function setApiKey(key) {
  if (typeof key === 'string') {
    runtimeApiKey = key.trim();
  }
}

/**
 * Get current Grok API key (masked for security if needed)
 */
function getApiKey() {
  return runtimeApiKey;
}

/**
 * Check if Grok LLM is active and configured
 */
function isConfigured() {
  return Boolean(runtimeApiKey && runtimeApiKey.length > 5);
}

/**
 * Build comprehensive system prompt with Milo facts and instructions
 */
function buildSystemPrompt(lang = 'en', currentStepId = 'M1') {
  return `You are Milo AI, the official conversational assistant for Milo EV Fleet & Taxi on WhatsApp.

### Milo Business Facts (STRICT & VERIFIED - NEVER HALLUCINATE DIFFERENT PRICES):
1. **Vehicle Rental:**
   - Weekly rent: ₹6,300 per week.
   - Platform commission: 0% (drivers keep 100% of customer trip fares).
   - Security deposit: ₹10,000 refundable, payable upon vehicle handover.
2. **Drive-to-Own Program:**
   - Ownership transfers to the driver after 36 months of weekly rent for only ₹1.
   - Scheduled maintenance, servicing, and comprehensive insurance are 100% paid by Milo.
3. **EV Charging:**
   - 100% FREE unlimited charging at all official Milo charging hubs.
   - Partner fast-chargers available across the city at ₹12/kWh.
4. **Hub Locations & Timings:**
   - Hubs in Bengaluru: HSR Layout, Electronic City, Hebbal.
   - Open daily from 8:00 AM to 8:00 PM IST.
5. **Driver Hiring Criteria:**
   - Commercial badge driving licence required (yellow board badge).
   - Minimum 1 year of taxi/commercial driving experience.
   - Age requirement: 21 to 50 years old.
   - Required onboarding documents: Badge Driving Licence (front & back), Aadhaar Card (first 8 digits masked), PAN Card, Bank Passbook / Cancelled Cheque, Selfie.
6. **Ride Booking & Fleet (Maya Call Taxi Integration):**
   - Fleet model: Tata Tigor EV (Emerald Green), 4.9★ top-rated verified professional drivers.
   - Services: Airport drop, Airport pickup, Local hourly rental, Outstation trips, Corporate accounts.
   - Features: Real-time ride dispatching, trip OTP verification, live vehicle tracking.
7. **Human Support (Milo Operations Team):**
   - Operations desk is active from 9:00 AM to 8:00 PM IST.
   - Inquiries outside these hours are answered next morning after 9:00 AM.

### Behavior Guidelines:
- The customer or driver has a question or doubt while interacting on WhatsApp.
- Current conversation step: ${currentStepId}.
- Respond warmly, clearly, and concisely in WhatsApp format (2 to 4 sentences or brief bullet points).
- If the user asks in Hindi, reply in natural Hindi (Devanagari or Romanized). If Kannada, reply in Kannada. Otherwise English.
- Always be helpful and address their exact doubt directly.
- At the end of your answer, provide a short 1-line guidance on how they can continue the flow (e.g. "To continue with your application, reply with your choice, or reply 0 for the Main Menu.").`;
}

/**
 * Generate Grok response for user's question or doubt
 */
async function generateGrokResponse({ userMessage, currentStepId = 'M1', lead = {}, lang = 'en', recentMessages = [] }) {
  if (!isConfigured()) {
    return null;
  }

  const systemPrompt = buildSystemPrompt(lang, currentStepId);

  // Build message history
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Include last 3 relevant user/assistant messages for conversational context
  if (Array.isArray(recentMessages)) {
    const recent = recentMessages.slice(-4);
    for (const msg of recent) {
      if (msg.sender === 'user' && msg.text) {
        messages.push({ role: 'user', content: msg.text });
      } else if (msg.sender === 'bot' && msg.text && !msg.isMayaTaxiCard) {
        messages.push({ role: 'assistant', content: msg.text });
      }
    }
  }

  // Add the current user message if not already the last message
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.content !== userMessage) {
    messages.push({ role: 'user', content: userMessage });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${runtimeApiKey}`
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 450
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Grok API Error] ${response.status}: ${errorText}`);
      return null;
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (reply && typeof reply === 'string') {
      return reply.trim();
    }
    return null;
  } catch (err) {
    console.error('[Grok Engine Exception]:', err.message);
    return null;
  }
}

module.exports = {
  setApiKey,
  getApiKey,
  isConfigured,
  generateGrokResponse,
  GROK_MODEL
};
