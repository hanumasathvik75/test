/**
 * Milo WhatsApp Agent Configuration
 * Based on "What Milo gives us" (PDF page 11)
 * All values can be edited by Milo ops team without hardcoding in messages.
 */

const miloConfig = {
  hiringCriteria: {
    requiresBadgeLicence: true,
    minExperienceYears: 1, // at least 1 year driving
    minAge: 21,
    maxAge: 50,
    acceptedApps: ['Uber', 'Ola', 'Rapido', 'Other']
  },

  hubs: [
    {
      id: 'hsr',
      name: 'HSR Layout',
      address: '27th Main Rd, Sector 1, HSR Layout, Bengaluru, Karnataka 560102',
      mapUrl: 'https://maps.google.com/?q=HSR+Layout+Bengaluru',
      slots: [
        { id: 'hsr-1', label: 'Thu 23 Oct 10:30', time: '10:30', date: '2026-10-23', capacity: 3, booked: 0 },
        { id: 'hsr-2', label: 'Thu 23 Oct 15:00', time: '15:00', date: '2026-10-23', capacity: 3, booked: 0 },
        { id: 'hsr-3', label: 'Fri 24 Oct 11:00', time: '11:00', date: '2026-10-24', capacity: 3, booked: 0 }
      ]
    },
    {
      id: 'ecity',
      name: 'Electronic City',
      address: 'Velankani Tech Park Rd, Phase 1, Electronic City, Bengaluru, Karnataka 560100',
      mapUrl: 'https://maps.google.com/?q=Electronic+City+Bengaluru',
      slots: [
        { id: 'ec-1', label: 'Thu 23 Oct 11:00', time: '11:00', date: '2026-10-23', capacity: 3, booked: 0 },
        { id: 'ec-2', label: 'Thu 23 Oct 16:00', time: '16:00', date: '2026-10-23', capacity: 3, booked: 0 },
        { id: 'ec-3', label: 'Fri 24 Oct 14:00', time: '14:00', date: '2026-10-24', capacity: 3, booked: 0 }
      ]
    },
    {
      id: 'hebbal',
      name: 'Hebbal',
      address: 'Bellary Rd, Near Hebbal Flyover, Bengaluru, Karnataka 560024',
      mapUrl: 'https://maps.google.com/?q=Hebbal+Bengaluru',
      slots: [
        { id: 'heb-1', label: 'Thu 23 Oct 10:00', time: '10:00', date: '2026-10-23', capacity: 3, booked: 0 },
        { id: 'heb-2', label: 'Thu 23 Oct 14:30', time: '14:30', date: '2026-10-23', capacity: 3, booked: 0 },
        { id: 'heb-3', label: 'Fri 24 Oct 11:30', time: '11:30', date: '2026-10-24', capacity: 3, booked: 0 }
      ]
    }
  ],

  factsSheet: {
    rent: "Rent is ₹6,300 a week. There is no percentage commission taken from your rides.",
    deposit: "The refundable security deposit is ₹10,000, payable at vehicle handover.",
    charging: "Charging is 100% free at all Milo fast-charging hubs. Partner public chargers are ₹12/kWh.",
    shifts: "You can drive on flexible 12-hour shifts or opt for a dedicated 24-hour car.",
    driveToOwn: "Under the Drive-to-Own program, after 36 months of completed weekly rent, car ownership is transferred to you for ₹1. Milo covers full insurance and vehicle maintenance during this period.",
    earnings: "You keep 100% of all customer fares you collect. You only pay the weekly rent of ₹6,300.",
    maintenance: "All scheduled vehicle maintenance, tyre replacements, and insurance are 100% covered by Milo.",
    documentsNeeded: "Original commercial driving licence with badge, Aadhaar card, PAN card, and bank passbook/cheque."
  },

  teamHours: {
    startHour: 9, // 9 AM
    endHour: 20,  // 8 PM
    timezone: 'Asia/Kolkata',
    opsLeadWhatsApp: '+919988776655'
  },

  // Templates submitted to Meta for approval
  templates: {
    continue_application: {
      en: "Hi {{1}}, you started applying to drive with Milo. Reply 1 to continue.",
      hi: "नमस्ते {{1}}, आपने Milo के साथ गाड़ी चलाने के लिए आवेदन शुरू किया था। जारी रखने के लिए 1 लिखें।",
      kn: "ನಮಸ್ಕಾರ {{1}}, ನೀವು Milo ಜೊತೆ ಡ್ರೈವ್ ಮಾಡಲು ಅರ್ಜಿ ಸಲ್ಲಿಸಲು ಪ್ರಾರಂಭಿಸಿದ್ದೀರಿ. ಮುಂದುವರಿಸಲು 1 ಎಂದು ಉತ್ತರಿಸಿ."
    },
    test_drive_reminder: {
      en: "Reminder: your Milo test drive is {{1}} at {{2}} hub. Bring your original licence.",
      hi: "याद दिलाएं: आपका Milo टेस्ट ड्राइव {{1}} को {{2}} हब पर है। अपना मूल लाइसेंस साथ लाएं।",
      kn: "ನೆನಪಿಕೆ: ನಿಮ್ಮ Milo ಟೆಸ್ಟ್ ಡ್ರೈವ್ {{1}} ರಂದು {{2}} ಹಬ್‌ನಲ್ಲಿ ಇದೆ. ನಿಮ್ಮ ಮೂಲ ಚಾಲನಾ ಪರವಾನಗಿಯನ್ನು ತನ್ನಿ."
    },
    test_drive_result: {
      en: "Update on your Milo test drive: {{1}}",
      hi: "आपके Milo टेस्ट ड्राइव पर अपडेट: {{1}}",
      kn: "ನಿಮ್ಮ Milo ಟೆಸ್ಟ್ ಡ್ರೈವ್ ಕುರಿತು ಅಪ್ಡೇಟ್: {{1}}"
    },
    ride_request_update: {
      en: "Your ride on {{1}} is {{2}}. {{3}}",
      hi: "आपकी {{1}} की सवारी {{2}} है। {{3}}",
      kn: "ನಿಮ್ಮ {{1}} ರ ಸವಾರಿ {{2}} ಆಗಿದೆ. {{3}}"
    },
    notify_when_eligible: {
      en: "Hi {{1}}, Milo has expanded! Openings are now available at {{2}}. Reply 1 to apply.",
      hi: "नमस्ते {{1}}, Milo का विस्तार हुआ है! अब {{2}} पर अवसर उपलब्ध हैं। आवेदन के लिए 1 लिखें।",
      kn: "ನಮಸ್ಕಾರ {{1}}, Milo ವಿಸ್ತರಿಸಿದೆ! ಈಗ {{2}} ನಲ್ಲಿ ಅವಕಾಶಗಳಿವೆ. ಅರ್ಜಿ ಸಲ್ಲಿಸಲು 1 ಎಂದು ಉತ್ತರಿಸಿ."
    }
  }
};

module.exports = miloConfig;
