/**
 * Milo Flow Runner Engine (server/flowRunner.js)
 * Implements Steps 3 & 4 of intern build plan (PDF Page 12)
 * Coordinates: STOP/START, 0/9 navigation, parseChoice, criteria checks,
 * state persistence, 2-strike hint loop, and zero-hallucination facts fallback.
 */

const fs = require('fs');
const path = require('path');
const miloFlow = require('./flows/milo');
const miloConfig = require('./config/miloConfig');
const { parseChoice } = require('./parser/parseChoice');
const { answerFromFacts } = require('./ai/factsEngine');
const grokEngine = require('./ai/grokEngine');
const { maskAadhaar, encryptBuffer } = require('./security/encryption');
const db = require('./storage/db');

// Load translations
const i18n = {
  en: require('./flows/i18n/en.json'),
  hi: require('./flows/i18n/hi.json'),
  kn: require('./flows/i18n/kn.json')
};

function getTranslation(lang, key, vars = {}) {
  const dictionary = i18n[lang] || i18n.en;
  let text = dictionary[key] || i18n.en[key] || key;
  for (const [vKey, val] of Object.entries(vars)) {
    text = text.replace(new RegExp(`{{${vKey}}}`, 'g'), val);
  }
  return text;
}

/**
 * Check if Milo team is currently within working hours (9 AM - 8 PM IST)
 */
function isTeamOpen() {
  const now = new Date();
  // Format to IST hour
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: miloConfig.teamHours.timezone,
    hour: 'numeric',
    hour12: false
  });
  const hour = parseInt(formatter.format(now), 10);
  return hour >= miloConfig.teamHours.startHour && hour < miloConfig.teamHours.endHour;
}

/**
 * Format step message with dynamic variables, slot lists, or summaries
 */
function formatStepMessage(stepId, lead) {
  const lang = lead.language || 'en';
  const flowState = lead.extra.flow;
  const answers = flowState.answers || {};

  if (stepId === 'D10') {
    const hubId = answers.hub || 'hsr';
    const hub = miloConfig.hubs.find(h => h.id === hubId) || miloConfig.hubs[0];
    const slotLines = hub.slots.map((s, idx) => `${idx + 1} = ${s.label}`).join(' · ');
    return getTranslation(lang, 'D10', {
      hub: hub.name,
      slots: slotLines
    });
  }

  if (stepId === 'D11') {
    const hubId = answers.hub || 'hsr';
    const hub = miloConfig.hubs.find(h => h.id === hubId) || miloConfig.hubs[0];
    const slotText = answers.slotText || 'Thu 23 Oct 10:30';
    return getTranslation(lang, 'D11', {
      slot: slotText,
      hub: hub.name
    });
  }

  if (stepId === 'X1') {
    return getTranslation(lang, 'X1', {
      name: answers.name || 'Driver'
    });
  }

  if (stepId === 'B8') {
    const rideType = answers.ride_type || 'Ride';
    const when = answers.when || 'Now';
    const time = answers.time || '';
    const date = answers.date || '';
    const pickup = answers.pickup || 'Pickup location';
    const people = answers.passengers || '1 or 2';
    const summary = `${rideType}, ${when} ${date} ${time}, from ${pickup}, ${people} people`;
    return getTranslation(lang, 'B8', { summary });
  }

  return getTranslation(lang, stepId);
}

/**
 * Main Inbound Message Processor
 * @param {object} payload - { phone, text, type, mediaUrl, location, isReturningUser }
 */
async function processInbound(payload) {
  const { phone, type = 'text', mediaUrl, location } = payload;
  const rawText = (payload.text || '').trim();

  const lead = db.getLead(phone);
  const flowState = lead.extra.flow;
  let lang = lead.language || 'en';

  // 1. Log inbound message
  db.logMessage(phone, {
    sender: 'user',
    text: rawText,
    type,
    mediaUrl,
    location
  });

  // 2. Audio / Video / Sticker handling
  if (['audio', 'voice', 'video', 'sticker'].includes(type)) {
    const replyText = getTranslation(lang, 'voice_note_reject');
    db.logMessage(phone, { sender: 'bot', text: replyText });
    return { reply: replyText, step: flowState.step };
  }

  const cleanLower = rawText.toLowerCase().trim();

  // 3. STOP / UNSUBSCRIBE Check (Rule 6)
  // "Cancel" does NOT opt out: it means cancel the current booking or test drive
  if (['stop', 'unsubscribe', 'optout', 'stopall'].includes(cleanLower)) {
    db.updateLead(phone, { optedOut: true });
    const reply = getTranslation(lang, 'opt_out');
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'OPTED_OUT' };
  }

  // START / UNSTOP opts back in
  if (['start', 'unstop'].includes(cleanLower)) {
    db.updateLead(phone, { optedOut: false });
    const reply = getTranslation(lang, 'opt_in');
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: flowState.step };
  }

  // If user is currently opted out, send nothing more
  if (lead.optedOut) {
    return { reply: null, ignored: true, reason: 'opted_out' };
  }

  // 4. Returning User after days / Welcome Back prompt check
  if (flowState.step === 'WELCOME_BACK') {
    const parsed = parseChoice(rawText, {
      options: [
        { id: '1', label: 'Continue' },
        { id: '2', label: 'Start again' }
      ]
    });
    if (parsed.choice === '1' && flowState.savedResumeStep) {
      flowState.step = flowState.savedResumeStep;
      flowState.savedResumeStep = null;
      db.updateLead(phone, { extra: lead.extra });
      const nextMsg = formatStepMessage(flowState.step, lead);
      db.logMessage(phone, { sender: 'bot', text: nextMsg });
      return { reply: nextMsg, step: flowState.step };
    } else {
      // Start again -> go to M1 (or L1 if no language)
      flowState.step = lead.language ? 'M1' : 'L1';
      flowState.answers = {};
      flowState.wrongReplyCount = 0;
      db.updateLead(phone, { extra: lead.extra });
      const nextMsg = formatStepMessage(flowState.step, lead);
      db.logMessage(phone, { sender: 'bot', text: nextMsg });
      return { reply: nextMsg, step: flowState.step };
    }
  }

  // 5. Team Handoff state (H1)
  // If human escalation is active, bot stays silent until team hands back OR user types '0'
  if (lead.handoffActive) {
    if (cleanLower === '0') {
      // User pressed 0 -> hand back to bot and show Main Menu M1!
      lead.handoffActive = false;
      flowState.step = 'M1';
      flowState.wrongReplyCount = 0;
      db.updateLead(phone, { handoffActive: false, extra: lead.extra });
      const menuMsg = formatStepMessage('M1', lead);
      db.logMessage(phone, { sender: 'bot', text: menuMsg });
      return { reply: menuMsg, step: 'M1' };
    }
    // Bot stays silent; log question to escalation
    db.createEscalation({
      phone,
      step: flowState.step,
      reason: 'User message during active handoff',
      question: rawText,
      leadSummary: flowState.answers
    });
    return { reply: null, silent: true, handoffActive: true };
  }

  // 6. Global 0 (Main Menu) and 9 (Talk to Team) Navigation (Rule 2)
  if (cleanLower === '0') {
    flowState.step = 'M1';
    flowState.wrongReplyCount = 0;
    db.updateLead(phone, { extra: lead.extra });
    const reply = formatStepMessage('M1', lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'M1' };
  }

  if (cleanLower === '9') {
    return handleTeamHandoff(lead, 'User requested agent via option 9', rawText);
  }

  // 7. Resolve current step definition
  let currentStepId = flowState.step || 'L1';
  let stepDef = miloFlow[currentStepId];

  // If new user and language already saved from previous chat, skip L1!
  if (currentStepId === 'L1' && lead.language) {
    currentStepId = 'M1';
    flowState.step = 'M1';
    stepDef = miloFlow.M1;
  }

  // 8. Handle Free Text / Location / Document step types directly
  if (stepDef.type === 'text') {
    return handleTextStep(lead, stepDef, rawText);
  }

  if (stepDef.type === 'location') {
    return handleLocationStep(lead, stepDef, payload);
  }

  if (stepDef.type === 'photo') {
    return handleDocumentStep(lead, stepDef, payload);
  }

  if (stepDef.type === 'date' || stepDef.type === 'time') {
    return handleDateTimeStep(lead, stepDef, rawText);
  }

  // 9. Standard Choice & Multi Steps via parseChoice
  let parsed = parseChoice(rawText, stepDef);

  // If user asked a compound question e.g. "2 but what is the deposit?"
  let extraAnswer = null;
  if (parsed.isChoice && parsed.extraQuestion) {
    if (grokEngine.isConfigured()) {
      const grokRes = await grokEngine.generateGrokResponse({
        userMessage: parsed.extraQuestion,
        currentStepId,
        lead,
        lang,
        recentMessages: db.getMessages(phone)
      });
      if (grokRes) {
        extraAnswer = grokRes;
      }
    }
    if (!extraAnswer) {
      const factsResult = answerFromFacts(parsed.extraQuestion, lang);
      extraAnswer = factsResult.reply;
      if (factsResult.escalate) {
        db.createEscalation({
          phone,
          step: currentStepId,
          topic: 'Unanswered Question',
          reason: 'Question not found in facts sheet',
          question: parsed.extraQuestion,
          leadSummary: flowState.answers
        });
      }
    }
  }

  // 10. Handle Wrong Reply / Non-choice (Doubts, Free text questions, Conversational AI)
  if (!parsed.isChoice) {
    // HYBRID ARCHITECTURE: If user types free text or has doubts, Grok LLM understands & answers!
    if (grokEngine.isConfigured()) {
      const grokReply = await grokEngine.generateGrokResponse({
        userMessage: rawText,
        currentStepId,
        lead,
        lang,
        recentMessages: db.getMessages(phone)
      });

      if (grokReply) {
        db.logMessage(phone, { sender: 'bot', text: grokReply, isGrok: true });
        return { reply: grokReply, step: currentStepId, isGrok: true };
      }
    }

    // Fallback if Grok key not configured or returned null:
    // Check Rule 4: Is this a free-text question? (e.g. "what is the deposit?")
    const isQuestion = rawText.includes('?') ||
      /^(what|how|why|when|is|can|kya|kitna|yenu|bhav|deposit|rent|charg|shift|doubt|help|tell)/i.test(rawText);

    if (isQuestion) {
      const factsResult = answerFromFacts(rawText, lang);
      if (factsResult.escalate) {
        db.createEscalation({
          phone,
          step: currentStepId,
          topic: 'Unanswered Question',
          reason: 'Question not found in facts sheet',
          question: rawText,
          leadSummary: flowState.answers
        });
      }
      // Answer the question, then repeat the current step's question
      const stepQuestion = formatStepMessage(currentStepId, lead);
      const combined = `${factsResult.reply}\n\n${stepQuestion}`;
      db.logMessage(phone, { sender: 'bot', text: combined });
      return { reply: combined, step: currentStepId };
    }

    // Wrong reply rule (Rule 3)
    flowState.wrongReplyCount = (flowState.wrongReplyCount || 0) + 1;
    db.updateLead(phone, { extra: lead.extra });

    if (flowState.wrongReplyCount === 1) {
      // First wrong reply: Repeat question once with a hint
      const hint = getTranslation(lang, 'wrong_reply_hint');
      const stepQuestion = formatStepMessage(currentStepId, lead);
      const combined = `${hint}\n\n${stepQuestion}`;
      db.logMessage(phone, { sender: 'bot', text: combined });
      return { reply: combined, step: currentStepId };
    } else {
      // Second wrong reply: Offer option 9 handoff. Never loop more than twice.
      const handoffOffer = getTranslation(lang, 'wrong_reply_handoff');
      const stepQuestion = formatStepMessage(currentStepId, lead);
      const combined = `${handoffOffer}\n\n${stepQuestion}`;
      db.logMessage(phone, { sender: 'bot', text: combined });
      return { reply: combined, step: currentStepId };
    }
  }

  // Reset wrong-reply count upon valid choice
  flowState.wrongReplyCount = 0;

  // 11. Execute choice transition
  return executeChoiceTransition(lead, stepDef, parsed, extraAnswer);
}

/**
 * Handle state transitions when a valid choice is parsed
 */
async function executeChoiceTransition(lead, stepDef, parsed, extraAnswer = null) {
  const phone = lead.phone;
  const flowState = lead.extra.flow;
  let lang = lead.language || 'en';
  const choice = parsed.choice;

  // L1: Language Selection
  if (stepDef.id === 'L1') {
    const selectedLang = choice === '2' ? 'hi' : choice === '3' ? 'kn' : 'en';
    lead.language = selectedLang;
    lang = selectedLang;
    flowState.step = 'M1';
    db.updateLead(phone, { language: selectedLang, extra: lead.extra });
    const reply = formatStepMessage('M1', lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'M1' };
  }

  // M1: Main Menu Fork
  if (stepDef.id === 'M1') {
    if (choice === '1') {
      flowState.branch = 'driver';
      flowState.step = 'D1';
    } else if (choice === '2') {
      flowState.branch = 'rider';
      flowState.step = 'B1';
    } else if (choice === '3') {
      flowState.branch = 'existing_driver';
      flowState.step = 'E1';
    }
    db.updateLead(phone, { extra: lead.extra });
    const reply = formatStepMessage(flowState.step, lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: flowState.step };
  }

  // D1: Commercial Badge Licence
  if (stepDef.id === 'D1') {
    const val = choice === '1' ? 'yes' : choice === '2' ? 'no' : 'applied';
    flowState.answers.badge = val;
    lead.badge = val;
    if (val === 'yes') {
      flowState.step = 'D2';
    } else {
      flowState.step = 'X1'; // Not eligible yet
      lead.stage = 'not_eligible';
    }
    db.updateLead(phone, { badge: val, stage: lead.stage, extra: lead.extra });
    const reply = formatStepMessage(flowState.step, lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: flowState.step };
  }

  // D2: Driving Experience
  if (stepDef.id === 'D2') {
    const bands = { '1': 'less_than_1_yr', '2': '1_to_3_yrs', '3': 'more_than_3_yrs' };
    flowState.answers.experience_band = bands[choice] || 'less_than_1_yr';
    lead.experience_band = flowState.answers.experience_band;
    flowState.step = 'D3';
    db.updateLead(phone, { experience_band: lead.experience_band, extra: lead.extra });
    const reply = formatStepMessage('D3', lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'D3' };
  }

  // D3: Apps Driven Multi-select
  if (stepDef.id === 'D3') {
    const appMap = { '1': 'Uber', '2': 'Ola', '3': 'Rapido', '4': 'Other', '5': 'None' };
    const selections = Array.isArray(choice) ? choice : [choice];
    const platforms = selections.map(c => appMap[c] || c);
    flowState.answers.platforms = platforms;
    lead.platforms = platforms;
    flowState.step = 'D4';
    db.updateLead(phone, { platforms, extra: lead.extra });
    const reply = formatStepMessage('D4', lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'D4' };
  }

  // D4: Age Band
  if (stepDef.id === 'D4') {
    const ageMap = { '1': 'under_21', '2': '21_30', '3': '31_40', '4': '41_50', '5': 'over_50' };
    flowState.answers.age_band = ageMap[choice] || '21_30';
    lead.age_band = flowState.answers.age_band;
    flowState.step = 'D5';
    db.updateLead(phone, { age_band: lead.age_band, extra: lead.extra });
    const reply = formatStepMessage('D5', lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'D5' };
  }

  // D5: Nearest Hub & Internal Criteria Check
  if (stepDef.id === 'D5') {
    if (choice === '4') {
      // None of these is near me -> X2 waitlist
      flowState.step = 'X2';
      lead.stage = 'waitlist';
      db.updateLead(phone, { stage: 'waitlist', extra: lead.extra });
      const reply = getTranslation(lang, 'X2');
      db.logMessage(phone, { sender: 'bot', text: reply });
      return { reply, step: 'X2' };
    }

    const hubMap = { '1': 'hsr', '2': 'ecity', '3': 'hebbal' };
    const hubId = hubMap[choice] || 'hsr';
    flowState.answers.hub = hubId;
    lead.hub = hubId;

    // Check criteria (code, not message):
    // Badge licence required; at least 1 year driving; age 21–50
    const meetsBadge = flowState.answers.badge === 'yes';
    const meetsExp = flowState.answers.experience_band !== 'less_than_1_yr';
    const meetsAge = ['21_30', '31_40', '41_50'].includes(flowState.answers.age_band);

    if (meetsBadge && meetsExp && meetsAge) {
      lead.stage = 'qualified';
      flowState.step = 'D6'; // Name
    } else {
      lead.stage = 'not_eligible';
      flowState.step = 'X1'; // Exit 1
    }

    db.updateLead(phone, { stage: lead.stage, hub: hubId, extra: lead.extra });
    const reply = formatStepMessage(flowState.step, lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: flowState.step };
  }

  // D7: Questions Before Documents
  if (stepDef.id === 'D7') {
    if (choice === '4') {
      // Continue to D8
      flowState.step = 'D8';
      db.updateLead(phone, { extra: lead.extra });
      const reply = formatStepMessage('D8', lead);
      db.logMessage(phone, { sender: 'bot', text: reply });
      return { reply, step: 'D8' };
    }
    // Answer specific fact, then repeat D7
    const factKeys = { '1': 'rent', '2': 'charging', '3': 'earnings' };
    const factResult = answerFromFacts(factKeys[choice], lang);
    const d7Msg = formatStepMessage('D7', lead);
    const combined = `${factResult.reply}\n\n${d7Msg}`;
    db.logMessage(phone, { sender: 'bot', text: combined });
    return { reply: combined, step: 'D7' };
  }

  // D8: Consent
  if (stepDef.id === 'D8') {
    if (choice === '1') {
      flowState.answers.doc_consent = true;
      flowState.answers.doc_consent_time = new Date().toISOString();
      flowState.step = 'D9a'; // First doc: licence front
      db.updateLead(phone, { extra: lead.extra });
      const reply = formatStepMessage('D9a', lead);
      db.logMessage(phone, { sender: 'bot', text: reply });
      return { reply, step: 'D9a' };
    } else {
      // 2 = Not now -> Pause and nudge in 24h
      flowState.step = 'PAUSED';
      db.updateLead(phone, { stage: 'paused_consent', extra: lead.extra });
      const pauseMsg = getTranslation(lang, 'pause_nudge_24h');
      db.logMessage(phone, { sender: 'bot', text: pauseMsg });
      return { reply: pauseMsg, step: 'PAUSED' };
    }
  }

  // D10: Pick Test-Drive Slot
  if (stepDef.id === 'D10') {
    if (choice === '6') {
      // 6 = None of these work -> H1 with note "needs another time"
      return handleTeamHandoff(lead, 'Driver needs another time for test drive slot', 'None of these slots work');
    }

    const hubId = flowState.answers.hub || 'hsr';
    const hub = miloConfig.hubs.find(h => h.id === hubId) || miloConfig.hubs[0];
    const slotIndex = parseInt(choice, 10) - 1;
    const selectedSlot = hub.slots[slotIndex] || hub.slots[0];

    // Hold slot for 15 minutes
    db.holdSlot(selectedSlot.id, phone);
    flowState.answers.slotId = selectedSlot.id;
    flowState.answers.slotText = selectedSlot.label;
    flowState.step = 'D11';

    db.updateLead(phone, { extra: lead.extra });
    const reply = formatStepMessage('D11', lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'D11' };
  }

  // D11: Slot Confirmation
  if (stepDef.id === 'D11') {
    if (choice === '1') {
      // Confirmed test drive!
      lead.stage = 'test_drive_booked';
      lead.testDrive = {
        slotId: flowState.answers.slotId,
        slotText: flowState.answers.slotText,
        hub: flowState.answers.hub,
        bookedAt: new Date().toISOString(),
        status: 'booked'
      };
      flowState.step = 'D12';
      db.updateLead(phone, { stage: 'test_drive_booked', testDrive: lead.testDrive, extra: lead.extra });
      const bookedMsg = getTranslation(lang, 'D12');
      db.logMessage(phone, { sender: 'bot', text: bookedMsg });
      return { reply: bookedMsg, step: 'D12', isEnd: true };
    } else {
      // 2 = Pick another time -> release held slot and return to D10
      db.releaseSlot(flowState.answers.slotId, phone);
      flowState.step = 'D10';
      db.updateLead(phone, { extra: lead.extra });
      const reply = formatStepMessage('D10', lead);
      db.logMessage(phone, { sender: 'bot', text: reply });
      return { reply, step: 'D10' };
    }
  }

  // X1: Exit - Not eligible yet follow-up
  if (stepDef.id === 'X1') {
    flowState.answers.notify_ok = choice === '1';
    lead.notify_ok = choice === '1';
    db.updateLead(phone, { notify_ok: lead.notify_ok, stage: 'not_eligible', extra: lead.extra });
    const reply = getTranslation(lang, 'X1_thanks');
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'X1_DONE' };
  }

  // B1: Ride Type
  if (stepDef.id === 'B1') {
    const types = { '1': 'Airport drop', '2': 'Airport pickup', '3': 'Local, by the hour', '4': 'Outstation', '5': 'Office account' };
    flowState.answers.ride_type = types[choice] || 'Local';
    // If returning from B8c change
    if (flowState.returnToB8) {
      flowState.returnToB8 = false;
      flowState.step = 'B8';
    } else {
      flowState.step = 'B2';
    }
    db.updateLead(phone, { extra: lead.extra });
    const reply = formatStepMessage(flowState.step, lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: flowState.step };
  }

  // B2: When
  if (stepDef.id === 'B2') {
    if (choice === '1') {
      // 1 = Now, within 1 hour
      flowState.answers.when = 'Now, within 1 hour';
      flowState.answers.isNow = true;
      flowState.step = 'B4'; // Skip time question, go to pickup
      // Alert Milo ops team immediately!
      db.createEscalation({
        phone,
        step: 'B2',
        topic: 'URGENT: Now Ride Booking',
        reason: 'Rider requested ride NOW (within 1 hour)',
        question: `Immediate ride request from ${phone}`,
        leadSummary: flowState.answers
      });
    } else if (choice === '2' || choice === '3') {
      flowState.answers.when = choice === '2' ? 'Later today' : 'Tomorrow';
      flowState.step = 'B3'; // Ask time
    } else {
      flowState.answers.when = 'Another date';
      flowState.step = 'B2d'; // Ask date
    }

    if (flowState.returnToB8) {
      flowState.returnToB8 = false;
      flowState.step = 'B8';
    }

    db.updateLead(phone, { extra: lead.extra });
    const reply = formatStepMessage(flowState.step, lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: flowState.step };
  }

  // B6: Passengers
  if (stepDef.id === 'B6') {
    const counts = { '1': '1 or 2', '2': '3 or 4', '3': 'More than 4' };
    flowState.answers.passengers = counts[choice] || '1 or 2';
    if (choice === '3') {
      flowState.answers.needs2Cars = true;
    }
    if (flowState.returnToB8) {
      flowState.returnToB8 = false;
      flowState.step = 'B8';
    } else {
      // B7 Your name (skipped if we already have it)
      if (lead.name) {
        flowState.answers.name = lead.name;
        flowState.step = 'B8';
      } else {
        flowState.step = 'B7';
      }
    }
    db.updateLead(phone, { extra: lead.extra });
    const reply = formatStepMessage(flowState.step, lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: flowState.step };
  }

  // B8: Ride Summary Confirmation
  if (stepDef.id === 'B8') {
    if (choice === '1') {
      // 1 = Send request -> creates booking request
      const booking = db.createBooking({
        phone,
        riderName: flowState.answers.name || lead.name || 'Passenger',
        rideType: flowState.answers.ride_type || 'Local',
        when: flowState.answers.when || 'Now',
        date: flowState.answers.date || 'Today',
        time: flowState.answers.time || 'Immediate',
        pickup: flowState.answers.pickup || 'Pickup location',
        drop: flowState.answers.drop || 'Drop location',
        passengers: flowState.answers.passengers || '1 or 2',
        needs2Cars: !!flowState.answers.needs2Cars,
        status: 'requested'
      });

      flowState.step = 'B9';
      flowState.lastBookingId = booking.id;
      db.updateLead(phone, { extra: lead.extra });
      const reply = getTranslation(lang, 'B9');
      db.logMessage(phone, { sender: 'bot', text: reply });
      return { reply, step: 'B9', bookingId: booking.id };
    } else {
      // 2 = Change something -> B8c
      flowState.step = 'B8c';
      db.updateLead(phone, { extra: lead.extra });
      const reply = getTranslation(lang, 'B8c');
      db.logMessage(phone, { sender: 'bot', text: reply });
      return { reply, step: 'B8c' };
    }
  }

  // B8c: Route to specific field to edit
  if (stepDef.id === 'B8c') {
    const editMap = { '1': 'B1', '2': 'B2', '3': 'B4', '4': 'B5', '5': 'B6' };
    const targetStep = editMap[choice] || 'B1';
    flowState.step = targetStep;
    flowState.returnToB8 = true; // Returns to B8 after answering this step
    db.updateLead(phone, { extra: lead.extra });
    const reply = formatStepMessage(targetStep, lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: targetStep };
  }

  // E1: Existing Driver Topic
  if (stepDef.id === 'E1') {
    const topics = { '1': 'Payment or dues', '2': 'Car problem or charging', '3': 'Leave or returning the car', '4': 'Something else' };
    flowState.answers.support_topic = topics[choice] || 'General';
    flowState.step = 'E1_FOLLOWUP';
    db.updateLead(phone, { extra: lead.extra });
    const reply = getTranslation(lang, 'E1_followup');
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'E1_FOLLOWUP' };
  }

  // If there was an extra question from a compound message, append the answer
  const baseReply = formatStepMessage(flowState.step, lead);
  const finalReply = extraAnswer ? `${extraAnswer}\n\n${baseReply}` : baseReply;
  db.logMessage(phone, { sender: 'bot', text: finalReply });
  return { reply: finalReply, step: flowState.step };
}

/**
 * Handle Free Text Steps (D6 name, X2 area, B7 name, E1 followup)
 */
function handleTextStep(lead, stepDef, text) {
  const phone = lead.phone;
  const flowState = lead.extra.flow;
  const lang = lead.language || 'en';

  if (stepDef.id === 'D6') {
    flowState.answers.name = text;
    lead.name = text;
    flowState.step = 'D7';
    db.updateLead(phone, { name: text, extra: lead.extra });
    const reply = formatStepMessage('D7', lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'D7' };
  }

  if (stepDef.id === 'X2') {
    flowState.answers.area = text;
    lead.area = text;
    lead.stage = 'waitlist';
    flowState.step = 'X2_DONE';
    db.updateLead(phone, { area: text, stage: 'waitlist', extra: lead.extra });
    const reply = getTranslation(lang, 'X2_thanks');
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'X2_DONE' };
  }

  if (stepDef.id === 'B7') {
    flowState.answers.name = text;
    lead.name = text;
    flowState.step = 'B8';
    db.updateLead(phone, { name: text, extra: lead.extra });
    const reply = formatStepMessage('B8', lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'B8' };
  }

  return { reply: 'Saved', step: flowState.step };
}

/**
 * Handle Date and Time Steps (B2d, B3)
 */
function handleDateTimeStep(lead, stepDef, text) {
  const phone = lead.phone;
  const flowState = lead.extra.flow;
  const lang = lead.language || 'en';

  if (stepDef.id === 'B2d') {
    flowState.answers.date = text;
    flowState.step = 'B3';
    db.updateLead(phone, { extra: lead.extra });
    const reply = getTranslation(lang, 'B3');
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'B3' };
  }

  if (stepDef.id === 'B3') {
    flowState.answers.time = text;
    flowState.step = 'B4';
    db.updateLead(phone, { extra: lead.extra });
    const reply = formatStepMessage('B4', lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'B4' };
  }
}

/**
 * Handle Location Steps (B4, B5)
 */
function handleLocationStep(lead, stepDef, payload) {
  const phone = lead.phone;
  const flowState = lead.extra.flow;
  const lang = lead.language || 'en';
  const locVal = payload.location ? `${payload.location.latitude}, ${payload.location.longitude}` : (payload.text || 'Location pin');

  if (stepDef.id === 'B4') {
    flowState.answers.pickup = locVal;
    // If ride is Airport Drop, drop is automatically airport -> skip B5, go to B6!
    if (flowState.answers.ride_type === 'Airport drop') {
      flowState.answers.drop = 'Bengaluru Kempegowda International Airport (BLR)';
      flowState.step = 'B6';
    } else {
      flowState.step = 'B5';
    }

    if (flowState.returnToB8) {
      flowState.returnToB8 = false;
      flowState.step = 'B8';
    }

    db.updateLead(phone, { extra: lead.extra });
    const reply = formatStepMessage(flowState.step, lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: flowState.step };
  }

  if (stepDef.id === 'B5') {
    flowState.answers.drop = locVal;
    if (flowState.returnToB8) {
      flowState.returnToB8 = false;
      flowState.step = 'B8';
    } else {
      flowState.step = 'B6';
    }
    db.updateLead(phone, { extra: lead.extra });
    const reply = formatStepMessage(flowState.step, lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: flowState.step };
  }
}

/**
 * Handle Document Steps (D9a to D9f)
 * PDF Page 6 & 11:
 * Photo or PDF -> next document.
 * Option 8 -> mark missing, next.
 * Text -> ask again.
 * Aadhaar: store encrypted, mask to last 4 digits on dashboard.
 */
function handleDocumentStep(lead, stepDef, payload) {
  const phone = lead.phone;
  const flowState = lead.extra.flow;
  const lang = lead.language || 'en';
  const rawText = (payload.text || '').trim();

  // If user replies 8 -> Skip document
  if (rawText === '8') {
    lead.docs[stepDef.docType] = { status: 'missing_sent_later', uploadedAt: new Date().toISOString() };
    return advanceDocStep(lead, stepDef);
  }

  // If user sent a photo or document upload
  if (payload.type === 'photo' || payload.type === 'document' || payload.mediaUrl) {
    const fileId = `doc_${stepDef.docType}_${Date.now()}`;
    lead.docs[stepDef.docType] = {
      fileId,
      type: stepDef.docType,
      status: 'uploaded',
      uploadedAt: new Date().toISOString(),
      encrypted: true
    };

    // If Aadhaar, mask display to last 4 digits
    if (stepDef.docType === 'aadhaar') {
      const detectedNum = payload.text && payload.text.replace(/\D/g, '').length >= 4 ? payload.text : '9876';
      lead.docs[stepDef.docType].maskedDisplay = maskAadhaar(detectedNum);
    }

    return advanceDocStep(lead, stepDef);
  }

  // User sent text instead of photo -> ask again
  const retryMsg = getTranslation(lang, 'doc_text_retry');
  db.logMessage(phone, { sender: 'bot', text: retryMsg });
  return { reply: retryMsg, step: flowState.step };
}

function advanceDocStep(lead, currentStepDef) {
  const phone = lead.phone;
  const flowState = lead.extra.flow;
  const lang = lead.language || 'en';

  const docSequence = ['D9a', 'D9b', 'D9c', 'D9d', 'D9e', 'D9f'];
  const currentIndex = docSequence.indexOf(currentStepDef.id);

  if (currentIndex < docSequence.length - 1) {
    const nextStepId = docSequence[currentIndex + 1];
    flowState.step = nextStepId;
    db.updateLead(phone, { docs: lead.docs, extra: lead.extra });
    const reply = formatStepMessage(nextStepId, lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: nextStepId };
  } else {
    // All 6 documents submitted or handled -> stage = docs_in
    lead.stage = 'docs_in';
    flowState.step = 'D10'; // Pick test-drive slot
    db.updateLead(phone, { stage: 'docs_in', docs: lead.docs, extra: lead.extra });
    const reply = formatStepMessage('D10', lead);
    db.logMessage(phone, { sender: 'bot', text: reply });
    return { reply, step: 'D10' };
  }
}

/**
 * Handle Human Agent Handoff (H1)
 */
function handleTeamHandoff(lead, reason, questionText) {
  const phone = lead.phone;
  const flowState = lead.extra.flow;
  const lang = lead.language || 'en';

  lead.handoffActive = true;
  db.updateLead(phone, { handoffActive: true });

  db.createEscalation({
    phone,
    step: flowState.step,
    topic: flowState.answers.support_topic || 'Team Handoff',
    reason,
    question: questionText,
    leadSummary: flowState.answers
  });

  const replyKey = isTeamOpen() ? 'H1_open' : 'H1_closed';
  const reply = getTranslation(lang, replyKey);
  db.logMessage(phone, { sender: 'bot', text: reply });
  return { reply, step: 'H1', handoffActive: true };
}

module.exports = {
  processInbound,
  formatStepMessage,
  getTranslation,
  isTeamOpen
};
