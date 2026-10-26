/**
 * Milo Persistent Database
 * Handles Leads, Test-drive slots, Ride Bookings, Escalations, and Messages.
 * Backed by atomic persistent storage in server/storage/milo_db.json.
 */

const fs = require('fs');
const path = require('path');
const miloConfig = require('../config/miloConfig');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DB_PATH = isServerless 
  ? path.join('/tmp', 'milo_db.json')
  : path.join(__dirname, 'milo_db.json');

const INITIAL_STATE = {
  leads: {},
  bookings: {},
  escalations: [],
  messages: {},
  slots: {}
};

// Initialize slots from config
miloConfig.hubs.forEach(hub => {
  hub.slots.forEach(slot => {
    INITIAL_STATE.slots[slot.id] = {
      ...slot,
      hubId: hub.id,
      hubName: hub.name,
      bookedLeads: []
    };
  });
});

class MiloDatabase {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return { ...INITIAL_STATE, ...parsed };
      }
      // Seed fallback in serverless
      const seedPath = path.join(__dirname, 'milo_db.json');
      if (fs.existsSync(seedPath)) {
        const raw = fs.readFileSync(seedPath, 'utf8');
        const parsed = JSON.parse(raw);
        return { ...INITIAL_STATE, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load DB, initializing fresh:', e.message);
    }
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  save(dataToSave = this.data) {
    try {
      const tempPath = DB_PATH + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(dataToSave, null, 2), 'utf8');
      fs.renameSync(tempPath, DB_PATH);
    } catch (e) {
      console.warn('Storage warning (safe in-memory fallback):', e.message);
    }
  }

  // --- Lead Methods ---
  getLead(phone) {
    const cleanPhone = String(phone).trim();
    if (!this.data.leads[cleanPhone]) {
      this.data.leads[cleanPhone] = {
        phone: cleanPhone,
        language: null, // null until chosen in L1
        stage: 'new',
        optedOut: false,
        handoffActive: false,
        extra: {
          flow: {
            branch: null,
            step: 'L1',
            answers: {},
            wrongReplyCount: 0,
            updatedTime: new Date().toISOString()
          }
        },
        docs: {},
        testDrive: null,
        createdAt: new Date().toISOString()
      };
      this.save();
    }
    return this.data.leads[cleanPhone];
  }

  updateLead(phone, updates) {
    const lead = this.getLead(phone);
    Object.assign(lead, updates);
    if (lead.extra && lead.extra.flow) {
      lead.extra.flow.updatedTime = new Date().toISOString();
    }
    this.save();
    return lead;
  }

  getAllLeads() {
    return Object.values(this.data.leads);
  }

  // --- Booking Methods ---
  createBooking(bookingData) {
    const id = bookingData.id || `MLO-${Math.floor(1000 + Math.random() * 9000)}`;
    const booking = {
      id,
      status: 'requested',
      createdAt: new Date().toISOString(),
      ...bookingData
    };
    this.data.bookings[id] = booking;
    this.save();
    return booking;
  }

  getBooking(id) {
    return this.data.bookings[id];
  }

  updateBooking(id, updates) {
    if (this.data.bookings[id]) {
      Object.assign(this.data.bookings[id], updates);
      this.save();
      return this.data.bookings[id];
    }
    return null;
  }

  getAllBookings() {
    return Object.values(this.data.bookings).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // --- Escalation Methods ---
  createEscalation({ phone, step, topic, reason, question, leadSummary }) {
    const escalation = {
      id: `ESC-${Date.now().toString(36)}`,
      phone,
      step,
      topic: topic || 'General Support',
      reason: reason || 'Handoff to Milo Team',
      question: question || '',
      leadSummary: leadSummary || {},
      status: 'open',
      createdAt: new Date().toISOString(),
      notes: ''
    };
    this.data.escalations.unshift(escalation);
    this.save();
    return escalation;
  }

  resolveEscalation(id, note) {
    const esc = this.data.escalations.find(e => e.id === id);
    if (esc) {
      esc.status = 'resolved';
      esc.notes = note || 'Resolved by ops agent';
      esc.resolvedAt = new Date().toISOString();
      this.save();
      return esc;
    }
    return null;
  }

  getAllEscalations() {
    return this.data.escalations;
  }

  // --- Slot Management ---
  getSlots() {
    return this.data.slots;
  }

  holdSlot(slotId, phone) {
    const slot = this.data.slots[slotId];
    if (!slot) return false;
    if (slot.bookedLeads && slot.bookedLeads.includes(phone)) return true;
    if (slot.capacity - (slot.booked || 0) <= 0) return false;
    slot.booked = (slot.booked || 0) + 1;
    slot.bookedLeads = slot.bookedLeads || [];
    slot.bookedLeads.push(phone);
    slot.heldUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min hold
    this.save();
    return true;
  }

  releaseSlot(slotId, phone) {
    const slot = this.data.slots[slotId];
    if (!slot) return false;
    if (slot.bookedLeads && slot.bookedLeads.includes(phone)) {
      slot.bookedLeads = slot.bookedLeads.filter(p => p !== phone);
      slot.booked = Math.max(0, (slot.booked || 1) - 1);
      this.save();
      return true;
    }
    return false;
  }

  // --- Messages Log ---
  logMessage(phone, message) {
    const cleanPhone = String(phone).trim();
    if (!this.data.messages[cleanPhone]) {
      this.data.messages[cleanPhone] = [];
    }
    const msgObj = {
      id: `MSG-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString(),
      status: 'delivered',
      ...message
    };
    this.data.messages[cleanPhone].push(msgObj);
    this.save();
    return msgObj;
  }

  getMessages(phone) {
    return this.data.messages[String(phone).trim()] || [];
  }

  resetAll() {
    this.data = JSON.parse(JSON.stringify(INITIAL_STATE));
    this.save();
  }
}

const db = new MiloDatabase();
module.exports = db;
