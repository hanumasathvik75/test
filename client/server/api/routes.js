/**
 * Milo Express API Routes (server/api/routes.js)
 * Implements endpoints for WhatsApp Webhooks, Ride Bookings with Maya Call Taxi dispatch,
 * Driver Onboarding & Document Verification, Escalations, and Simulation controls.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { processInbound, formatStepMessage, getTranslation } = require('../flowRunner');
const scheduler = require('../reminders/scheduler');
const { encryptBuffer, maskAadhaar, isAllowedDocType } = require('../security/encryption');
const miloConfig = require('../config/miloConfig');
const grokEngine = require('../ai/grokEngine');
const db = require('../storage/db');

// Set up encrypted file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// Broadcast helper (injected from index.js)
let broadcastWs = () => {};
router.setBroadcaster = (fn) => { broadcastWs = fn; };

// -------------------------------------------------------------
// 1. INBOUND MESSAGE & WEBHOOKS
// -------------------------------------------------------------

// Webhook for Simulated WhatsApp Client and Meta API
router.post('/webhook/whatsapp', async (req, res) => {
  try {
    const { phone, text, type = 'text', mediaUrl, location } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const result = await processInbound({ phone, text, type, mediaUrl, location });

    // Notify connected WebSocket clients (WhatsApp view & Ops dashboard)
    broadcastWs({
      type: 'INBOUND_PROCESSED',
      phone,
      result,
      messages: db.getMessages(phone),
      lead: db.getLead(phone)
    });

    return res.json({ success: true, result });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Standard Twilio Webhook format emulator
router.post('/webhook/twilio', async (req, res) => {
  try {
    const from = req.body.From ? req.body.From.replace('whatsapp:', '') : req.body.phone;
    const body = req.body.Body || req.body.text || '';
    const mediaUrl = req.body.MediaUrl0;
    const numMedia = parseInt(req.body.NumMedia || '0', 10);

    const type = numMedia > 0 ? 'photo' : 'text';
    const result = await processInbound({
      phone: from,
      text: body,
      type,
      mediaUrl
    });

    broadcastWs({
      type: 'INBOUND_PROCESSED',
      phone: from,
      result,
      messages: db.getMessages(from)
    });

    // Return TwiML XML
    res.type('text/xml');
    if (result.reply) {
      return res.send(`<Response><Message>${result.reply}</Message></Response>`);
    }
    return res.send('<Response></Response>');
  } catch (err) {
    res.status(500).send(`<Response><Message>Error: ${err.message}</Message></Response>`);
  }
});

// Get messages for a phone number
router.get('/messages/:phone', (req, res) => {
  const messages = db.getMessages(req.params.phone);
  const lead = db.getLead(req.params.phone);
  res.json({ messages, lead });
});

// -------------------------------------------------------------
// 2. RIDE BOOKING & MAYA CALL TAXI DISPATCH SYSTEM
// -------------------------------------------------------------

// Get all ride bookings
router.get('/bookings', (req, res) => {
  res.json(db.getAllBookings());
});

/**
 * Dispatch / Confirm a Ride (Maya Call Taxi style confirmation!)
 * Generates an instant high-detail WhatsApp confirmation card:
 * Driver details, 4.9★ rating, EV model, plate number, trip OTP, and live progression.
 */
router.post('/bookings/:id/dispatch', (req, res) => {
  const { id } = req.params;
  const {
    driverName = 'Rajesh Kumar',
    driverPhone = '+91 98450 12345',
    driverRating = '4.9 ★',
    vehicle = 'Tata Tigor EV (Emerald Green)',
    plateNumber = 'KA 01 MJ 8821',
    fare = '₹480',
    distance = '14.5 km',
    otp = String(Math.floor(1000 + Math.random() * 9000))
  } = req.body;

  const booking = db.getBooking(id);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const updatedBooking = db.updateBooking(id, {
    status: 'dispatched',
    assignedDriver: {
      name: driverName,
      phone: driverPhone,
      rating: driverRating,
      vehicle,
      plateNumber
    },
    fareQuote: fare,
    distance,
    otp,
    dispatchedAt: new Date().toISOString()
  });

  const lead = db.getLead(booking.phone);
  const lang = lead.language || 'en';

  // Construct Rich Maya Call Taxi style confirmation card
  const confirmationCardText = [
    `🚖 *MILO RIDE CONFIRMED* (Booking #${booking.id})`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *Driver:* ${driverName} (${driverRating})`,
    `📞 *Contact:* ${driverPhone}`,
    `🚗 *Cab:* ${vehicle}`,
    `🔢 *Plate:* ${plateNumber}`,
    `🔑 *Start Ride OTP:* ${otp}`,
    `📍 *Pickup:* ${booking.pickup}`,
    `🎯 *Destination:* ${booking.drop}`,
    `💵 *Estimated Fare:* ${fare} (${distance})`,
    `⏱️ *ETA:* Driver is 4 mins away`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `Live status: 🟢 *DRIVER EN ROUTE*`
  ].join('\n');

  // Deliver confirmation card directly to rider's WhatsApp
  db.logMessage(booking.phone, {
    sender: 'bot',
    text: confirmationCardText,
    isMayaTaxiCard: true,
    bookingDetails: updatedBooking
  });

  broadcastWs({
    type: 'RIDE_DISPATCHED',
    booking: updatedBooking,
    phone: booking.phone,
    messages: db.getMessages(booking.phone)
  });

  res.json({ success: true, booking: updatedBooking });
});

// Update Ride Status (en_route -> arrived -> in_progress -> completed)
router.post('/bookings/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled'

  const booking = db.getBooking(id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const updated = db.updateBooking(id, { status });

  const statusLabels = {
    en_route: '🚕 Driver is en route to your location (ETA 3 mins)',
    arrived: '📍 Driver has arrived at pickup point!',
    in_progress: '🟢 Ride in progress. Have a safe journey!',
    completed: '🏁 Ride completed! Thank you for riding with Milo. Total fare: ' + (booking.fareQuote || '₹480'),
    cancelled: '❌ Ride has been cancelled.'
  };

  const statusMessage = statusLabels[status] || `Ride status updated to: ${status}`;

  db.logMessage(booking.phone, {
    sender: 'bot',
    text: statusMessage,
    isRideStatusUpdate: true,
    bookingId: id,
    status
  });

  broadcastWs({
    type: 'RIDE_STATUS_UPDATED',
    booking: updated,
    phone: booking.phone,
    messages: db.getMessages(booking.phone)
  });

  res.json({ success: true, booking: updated });
});

// -------------------------------------------------------------
// 3. ESCALATIONS & OPERATOR REPLIES (H1)
// -------------------------------------------------------------

router.get('/escalations', (req, res) => {
  res.json(db.getAllEscalations());
});

// Operator sends reply to customer
router.post('/escalations/:id/reply', (req, res) => {
  const { id } = req.params;
  const { replyText, operatorName = "Milo Ops" } = req.body;

  const esc = db.getAllEscalations().find(e => e.id === id);
  if (!esc) return res.status(404).json({ error: 'Escalation not found' });

  db.logMessage(esc.phone, {
    sender: 'operator',
    operatorName,
    text: replyText
  });

  broadcastWs({
    type: 'OPERATOR_REPLY',
    phone: esc.phone,
    messages: db.getMessages(esc.phone)
  });

  res.json({ success: true });
});

// Hand chat back to bot
router.post('/escalations/:id/handback', (req, res) => {
  const { id } = req.params;
  const esc = db.resolveEscalation(id, 'Chat handed back to bot by operator');
  if (!esc) return res.status(404).json({ error: 'Escalation not found' });

  const lead = db.getLead(esc.phone);
  lead.handoffActive = false;
  db.updateLead(esc.phone, { handoffActive: false });

  const handbackMsg = "Thank you for chatting with Milo's team! The bot is ready to help you again. Reply 0 for the main menu.";
  db.logMessage(esc.phone, { sender: 'bot', text: handbackMsg });

  broadcastWs({
    type: 'HANDBACK_COMPLETE',
    phone: esc.phone,
    messages: db.getMessages(esc.phone)
  });

  res.json({ success: true, escalation: esc });
});

// -------------------------------------------------------------
// 4. DRIVER ONBOARDING & DOCUMENT VERIFICATION
// -------------------------------------------------------------

router.get('/drivers', (req, res) => {
  const leads = db.getAllLeads();
  // Filter for driver onboarding leads
  const drivers = leads.filter(l => l.extra && l.extra.flow && (l.extra.flow.branch === 'driver' || l.stage !== 'new'));
  res.json(drivers);
});

// Mark test drive result from dashboard
// PDF Page 7 & 12: "After the test drive Milo's team marks the result on the dashboard (showed up, passed, car handed over). The bot then sends the next-steps template for that result."
router.post('/drivers/:phone/mark-test-drive', (req, res) => {
  const { phone } = req.params;
  const { result } = req.body; // 'showed_up' | 'passed' | 'car_handed_over' | 'no_show'

  const lead = db.getLead(phone);
  if (!lead) return res.status(404).json({ error: 'Driver lead not found' });

  const stageMap = {
    showed_up: 'test_drive_showed_up',
    passed: 'test_drive_passed',
    car_handed_over: 'car_handed_over',
    no_show: 'test_drive_no_show'
  };

  lead.stage = stageMap[result] || 'test_drive_completed';
  if (lead.testDrive) {
    lead.testDrive.result = result;
  }
  db.updateLead(phone, { stage: lead.stage, testDrive: lead.testDrive });

  // Send next-steps template to driver on WhatsApp
  const lang = lead.language || 'en';
  const resultTemplates = {
    passed: {
      en: "Congratulations {{name}}! You passed your Milo test drive. Your electric car handover is scheduled for next Monday. Welcome to Milo!",
      hi: "बधाई हो {{name}}! आपने Milo टेस्ट ड्राइव पास कर लिया है। आपकी इलेक्ट्रिक कार सौंपने का समय अगले सोमवार है। Milo में आपका स्वागत है!",
      kn: "ಅಭಿನಂದನೆಗಳು {{name}}! ನೀವು Milo ಟೆಸ್ಟ್ ಡ್ರೈವ್‌ನಲ್ಲಿ ಉತ್ತೀರ್ಣರಾಗಿದ್ದೀರಿ. ಮುಂದಿನ ಸೋಮವಾರ ಕಾರು ಹಸ್ತಾಂತರವಾಗಲಿದೆ. Milo ಗೆ ಸುಸ್ವಾಗತ!"
    },
    car_handed_over: {
      en: "Vehicle handed over successfully! Tata Tigor EV is now assigned to you. Drive safe!",
      hi: "वाहन सफलतापूर्वक सौंप दिया गया! Tata Tigor EV अब आपको सौंपा गया है। सुरक्षित ड्राइव करें!",
      kn: "ವಾಹನವನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಹಸ್ತಾಂತರಿಸಲಾಗಿದೆ! Tata Tigor EV ಈಗ ನಿಮ್ಮ ಬಳಿ ಇದೆ. ಸುರಕ್ಷಿತವಾಗಿ ಚಾಲನೆ ಮಾಡಿ!"
    },
    no_show: {
      en: "Hi {{name}}, we missed you at your scheduled Milo test drive. Would you like to reschedule? Reply 1 to pick a new slot.",
      hi: "नमस्ते {{name}}, आप अपनी तय Milo टेस्ट ड्राइव पर नहीं पहुंचे। क्या आप नया समय चुनना चाहते हैं? 1 लिखें।",
      kn: "ನಮಸ್ಕಾರ {{name}}, ನಿಗದಿತ Milo ಟೆಸ್ಟ್ ಡ್ರೈವ್‌ಗೆ ನೀವು ಹಾಜರಾಗಲಿಲ್ಲ. ಮರುನಿಗದಿ ಮಾಡಲು 1 ಎಂದು ಉತ್ತರಿಸಿ."
    }
  };

  const tplGroup = resultTemplates[result] || resultTemplates.passed;
  let tplText = (tplGroup[lang] || tplGroup.en).replace('{{name}}', lead.name || 'Driver');

  db.logMessage(phone, {
    sender: 'bot',
    text: tplText,
    isTemplate: true,
    templateName: 'test_drive_result'
  });

  broadcastWs({
    type: 'TEST_DRIVE_RESULT_MARKED',
    phone,
    result,
    lead: db.getLead(phone),
    messages: db.getMessages(phone)
  });

  res.json({ success: true, lead: db.getLead(phone) });
});

// Upload document with encryption
router.post('/ingestion/upload', upload.single('file'), (req, res) => {
  const { phone, docType, aadhaarNumber } = req.body;
  if (!phone || !docType) return res.status(400).json({ error: 'Missing phone or docType' });

  const lead = db.getLead(phone);
  const fileId = `doc_${docType}_${Date.now()}`;

  // Encrypt file buffer with AES-256-GCM
  let encrypted = null;
  if (req.file) {
    encrypted = encryptBuffer(req.file.buffer);
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, `${fileId}.enc`), encrypted);
  }

  lead.docs[docType] = {
    fileId,
    type: docType,
    status: 'uploaded',
    uploadedAt: new Date().toISOString(),
    encrypted: true,
    maskedDisplay: docType === 'aadhaar' ? maskAadhaar(aadhaarNumber || '987654321012') : undefined
  };

  db.updateLead(phone, { docs: lead.docs });

  res.json({ success: true, doc: lead.docs[docType] });
});

// -------------------------------------------------------------
// 5. CONFIGURATION & FACTS SHEET API
// -------------------------------------------------------------

router.get('/grok/status', (req, res) => {
  res.json({
    configured: grokEngine.isConfigured(),
    model: grokEngine.GROK_MODEL
  });
});

router.post('/grok/key', (req, res) => {
  const { key } = req.body;
  if (key && typeof key === 'string') {
    grokEngine.setApiKey(key);
    return res.json({ success: true, configured: grokEngine.isConfigured(), model: grokEngine.GROK_MODEL });
  }
  return res.status(400).json({ error: 'Valid API key is required' });
});

router.get('/config', (req, res) => {
  res.json({
    config: miloConfig,
    slots: db.getSlots()
  });
});

router.put('/config/facts', (req, res) => {
  const { factsSheet } = req.body;
  if (factsSheet) {
    Object.assign(miloConfig.factsSheet, factsSheet);
  }
  res.json({ success: true, factsSheet: miloConfig.factsSheet });
});

// -------------------------------------------------------------
// 6. SIMULATION CONTROLS FOR TESTING
// -------------------------------------------------------------

router.post('/simulate/nudge-2h', (req, res) => {
  const msg = scheduler.trigger2HourNudge(req.body.phone);
  broadcastWs({ type: 'SIMULATION_EVENT', phone: req.body.phone, messages: db.getMessages(req.body.phone) });
  res.json({ success: true, message: msg });
});

router.post('/simulate/template-23h', (req, res) => {
  const msg = scheduler.trigger23HourTemplate(req.body.phone);
  broadcastWs({ type: 'SIMULATION_EVENT', phone: req.body.phone, messages: db.getMessages(req.body.phone) });
  res.json({ success: true, message: msg });
});

router.post('/simulate/return-days-later', (req, res) => {
  const msg = scheduler.triggerReturnDaysLater(req.body.phone);
  broadcastWs({ type: 'SIMULATION_EVENT', phone: req.body.phone, messages: db.getMessages(req.body.phone) });
  res.json({ success: true, message: msg });
});

router.post('/simulate/r1-reminder', (req, res) => {
  const msg = scheduler.triggerR1EveningReminder(req.body.phone);
  broadcastWs({ type: 'SIMULATION_EVENT', phone: req.body.phone, messages: db.getMessages(req.body.phone) });
  res.json({ success: true, message: msg });
});

router.post('/simulate/r2-checkin', (req, res) => {
  const msg = scheduler.triggerR2MorningCheckin(req.body.phone);
  broadcastWs({ type: 'SIMULATION_EVENT', phone: req.body.phone, messages: db.getMessages(req.body.phone) });
  res.json({ success: true, message: msg });
});

router.post('/simulate/r2-timeout', (req, res) => {
  const triggered = scheduler.checkR2Timeout930AM(req.body.phone);
  broadcastWs({ type: 'SIMULATION_EVENT', phone: req.body.phone, escalations: db.getAllEscalations() });
  res.json({ success: true, flaggedTimeout: triggered });
});

router.post('/simulate/reset', (req, res) => {
  db.resetAll();
  broadcastWs({ type: 'RESET_COMPLETE' });
  res.json({ success: true, message: 'All database records reset to initial state' });
});

module.exports = router;
