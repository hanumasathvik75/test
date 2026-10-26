/**
 * Milo Reminders & Inactivity Scheduler (server/reminders/scheduler.js)
 * Implements PDF Page 10 (Drop-offs, reminders and edge cases)
 * - 2-hour inactivity nudge (free-form)
 * - 23-hour inactivity template (utility)
 * - R1: Evening before test drive reminder
 * - R2: 8:00 AM day-of test drive check-in + 9:30 AM unconfirmed escalation
 * - "Welcome back" return handling
 */

const db = require('../storage/db');
const miloConfig = require('../config/miloConfig');
const { getTranslation } = require('../flowRunner');

class MiloReminderScheduler {
  /**
   * Trigger 2-hour inactivity nudge for a lead
   * Message: "Shall we continue? 1 = Yes · 2 = Later"
   */
  trigger2HourNudge(phone) {
    const lead = db.getLead(phone);
    if (!lead || lead.optedOut || lead.handoffActive) return null;
    const lang = lead.language || 'en';

    // Only send if inside 24h window and no nudge sent today
    const nudgeMsg = getTranslation(lang, 'nudge_2h');
    db.logMessage(phone, {
      sender: 'bot',
      text: nudgeMsg,
      isNudge: true
    });
    lead.lastNudgeSent = new Date().toISOString();
    db.updateLead(phone, { lastNudgeSent: lead.lastNudgeSent });
    return nudgeMsg;
  }

  /**
   * Trigger 23-hour utility template for a lead
   * Template: continue_application
   */
  trigger23HourTemplate(phone) {
    const lead = db.getLead(phone);
    if (!lead || lead.optedOut) return null;
    const lang = lead.language || 'en';
    const name = lead.name || 'Driver';

    let tpl = miloConfig.templates.continue_application[lang] || miloConfig.templates.continue_application.en;
    tpl = tpl.replace('{{1}}', name);

    db.logMessage(phone, {
      sender: 'bot',
      text: tpl,
      isTemplate: true,
      templateName: 'continue_application'
    });
    lead.lastTemplateSent = new Date().toISOString();
    db.updateLead(phone, { lastTemplateSent: lead.lastTemplateSent });
    return tpl;
  }

  /**
   * Simulate user returning days later:
   * Sets step to WELCOME_BACK: "Welcome back. 1 = Continue where you left off · 2 = Start again"
   */
  triggerReturnDaysLater(phone) {
    const lead = db.getLead(phone);
    if (!lead || lead.optedOut) return null;
    const lang = lead.language || 'en';

    const currentStep = lead.extra.flow.step;
    lead.extra.flow.savedResumeStep = currentStep;
    lead.extra.flow.step = 'WELCOME_BACK';
    db.updateLead(phone, { extra: lead.extra });

    const returnMsg = getTranslation(lang, 'return_days_later');
    db.logMessage(phone, {
      sender: 'bot',
      text: returnMsg
    });
    return returnMsg;
  }

  /**
   * R1: Evening before test drive reminder
   */
  triggerR1EveningReminder(phone) {
    const lead = db.getLead(phone);
    if (!lead || !lead.testDrive || lead.optedOut) return null;
    const lang = lead.language || 'en';

    const hubId = lead.testDrive.hub || 'hsr';
    const hub = miloConfig.hubs.find(h => h.id === hubId) || miloConfig.hubs[0];
    const timeText = lead.testDrive.slotText || 'tomorrow';

    let tpl = miloConfig.templates.test_drive_reminder[lang] || miloConfig.templates.test_drive_reminder.en;
    tpl = tpl.replace('{{1}}', timeText).replace('{{2}}', hub.name);

    db.logMessage(phone, {
      sender: 'bot',
      text: tpl,
      isTemplate: true,
      templateName: 'test_drive_reminder'
    });
    return tpl;
  }

  /**
   * R2: 8:00 AM on the day of test drive
   * "Your test drive is today at 10:30. 1 = I'm coming · 2 = Change the time · 3 = Cancel"
   */
  triggerR2MorningCheckin(phone) {
    const lead = db.getLead(phone);
    if (!lead || !lead.testDrive || lead.optedOut) return null;
    const lang = lead.language || 'en';

    const timeText = lead.testDrive.slotText || '10:30';
    let msg = getTranslation(lang, 'r2_reminder', { time: timeText });

    lead.r2SentAt = new Date().toISOString();
    lead.r2Status = 'awaiting_reply';
    db.updateLead(phone, { r2SentAt: lead.r2SentAt, r2Status: 'awaiting_reply' });

    db.logMessage(phone, {
      sender: 'bot',
      text: msg,
      isR2: true
    });
    return msg;
  }

  /**
   * R2 Inactivity check by 9:30 AM:
   * If driver has not replied to R2 by 9:30 AM, flag booking as 'not confirmed' on dashboard so hub calls them
   */
  checkR2Timeout930AM(phone) {
    const lead = db.getLead(phone);
    if (!lead || !lead.testDrive) return false;

    if (lead.r2Status === 'awaiting_reply') {
      lead.testDrive.status = 'unconfirmed';
      lead.r2Status = 'timeout_unconfirmed';
      db.updateLead(phone, { testDrive: lead.testDrive, r2Status: 'timeout_unconfirmed' });

      // Create high-priority escalation for hub staff to call driver
      db.createEscalation({
        phone,
        step: 'R2_TIMEOUT',
        topic: 'Hub Call Required: Test Drive Not Confirmed',
        reason: 'Driver did not reply to 8:00 AM check-in by 9:30 AM',
        question: `Call driver ${lead.name || ''} (${phone}) for slot ${lead.testDrive.slotText}`,
        leadSummary: lead.testDrive
      });
      return true;
    }
    return false;
  }

  /**
   * Handle R2 Reply from driver:
   * 1 -> confirmed
   * 2 -> change time (route back to D10)
   * 3 -> cancel -> free slot and ask reason
   */
  handleR2Reply(phone, choice) {
    const lead = db.getLead(phone);
    if (!lead || !lead.testDrive) return null;
    const lang = lead.language || 'en';

    if (choice === '1') {
      lead.testDrive.status = 'confirmed';
      lead.r2Status = 'confirmed';
      db.updateLead(phone, { testDrive: lead.testDrive, r2Status: 'confirmed' });
      const confMsg = lang === 'hi' ? 'पुष्टि के लिए धन्यवाद! हम हब पर आपका इंतज़ार करेंगे।' :
        lang === 'kn' ? 'ಖಚಿತಪಡಿಸಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು! ಹಬ್‌ನಲ್ಲಿ ನಿಮ್ಮನ್ನು ಸ್ವಾಗತಿಸುತ್ತೇವೆ.' :
        'Thank you for confirming! We look forward to seeing you at the hub.';
      db.logMessage(phone, { sender: 'bot', text: confMsg });
      return { reply: confMsg, status: 'confirmed' };
    }

    if (choice === '2') {
      // 2 = Change the time -> D10
      db.releaseSlot(lead.testDrive.slotId, phone);
      lead.extra.flow.step = 'D10';
      lead.testDrive = null;
      db.updateLead(phone, { testDrive: null, extra: lead.extra });
      const { formatStepMessage } = require('../flowRunner');
      const d10Msg = formatStepMessage('D10', lead);
      db.logMessage(phone, { sender: 'bot', text: d10Msg });
      return { reply: d10Msg, step: 'D10' };
    }

    if (choice === '3') {
      // 3 = Cancel -> Free the slot, ask cancellation reason (numbered)
      db.releaseSlot(lead.testDrive.slotId, phone);
      lead.testDrive.status = 'cancelled';
      lead.testDrive = null;
      lead.extra.flow.step = 'R2_CANCEL_REASON';
      db.updateLead(phone, { testDrive: null, extra: lead.extra });

      const reasonPrompt = getTranslation(lang, 'r2_cancel_reason');
      db.logMessage(phone, { sender: 'bot', text: reasonPrompt });
      return { reply: reasonPrompt, step: 'R2_CANCEL_REASON' };
    }

    return null;
  }
}

const scheduler = new MiloReminderScheduler();
module.exports = scheduler;
