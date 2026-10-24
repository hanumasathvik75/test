/**
 * Milo Facts Engine & AI Guardrail
 * Implements Rule 4 & 5 (PDF Page 3, 11, 13)
 * Strict zero-hallucination policy: Only quotes verified facts and allowed ₹ figures.
 */

const miloConfig = require('../config/miloConfig');

// Whitelist of allowed ₹ numbers strictly from Milo's facts sheet
const ALLOWED_RUPEE_FIGURES = ['₹6,300', '6300', '₹10,000', '10000', '₹1', '₹12'];

const TOPIC_KEYWORDS = {
  deposit: {
    patterns: [/deposit/i, /advance/i, /security/i, /जमा/i, /ಠೇವಣಿ/i],
    response: {
      en: "The refundable security deposit is ₹10,000, payable at vehicle handover.",
      hi: "रिफंडेबल सुरक्षा जमा ₹10,000 है, जो वाहन सौंपते समय देय है।",
      kn: "ಮರುಪಾವತಿಸಬಹುದಾದ ಭದ್ರತಾ ಠೇವಣಿ ₹10,000 ಆಗಿದೆ, ವಾಹನ ನೀಡುವ ಸಮಯದಲ್ಲಿ ಪಾವತಿಸಬೇಕು."
    }
  },
  rent: {
    patterns: [/rent/i, /weekly/i, /kiraya/i, /किराया/i, /ಕಿರಾ/i, /ಬಾಡಿಗೆ/i, /cost.*week/i],
    response: {
      en: "Rent is ₹6,300 a week. There is no platform commission on your trips.",
      hi: "किराया प्रति सप्ताह ₹6,300 है। आपकी ट्रिप पर कोई प्लेटफॉर्म कमीशन नहीं है।",
      kn: "ಬಾಡಿಗೆ ವಾರಕ್ಕೆ ₹6,300 ಆಗಿದೆ. ನಿಮ್ಮ ಟ್ರಿಪ್‌ಗಳ ಮೇಲೆ ಯಾವುದೇ ಕಮಿಷನ್ ಇರುವುದಿಲ್ಲ."
    }
  },
  charging: {
    patterns: [/charg/i, /battery/i, /power/i, /चार्ज/i, /बिजली/i, /ಚಾರ್ಜಿಂಗ್/i, /ಬ್ಯಾಟರಿ/i],
    response: {
      en: "Charging is 100% free at all Milo hubs. Partner public chargers are available at ₹12/kWh.",
      hi: "सभी Milo हब पर चार्जिंग 100% मुफ्त है। पार्टनर चार्जर ₹12/kWh पर उपलब्ध हैं।",
      kn: "ಎಲ್ಲಾ Milo ಹಬ್‌ಗಳಲ್ಲಿ ಚಾರ್ಜಿಂಗ್ 100% ಉಚಿತವಾಗಿದೆ. ಪಾಲುದಾರ ಚಾರ್ಜರ್‌ಗಳು ₹12/kWh ದರದಲ್ಲಿವೆ."
    }
  },
  shifts: {
    patterns: [/shift/i, /timing/i, /hours/i, /duty/i, /समय/i, /शिफ्ट/i, /ಶಿಫ್ಟ್/i, /ಗಂಟೆಗಳು/i],
    response: {
      en: "You can drive on flexible 12-hour shifts or take a dedicated 24-hour car.",
      hi: "आप 12 घंटे की फ्लेक्सिबल शिफ्ट में गाड़ी चला सकते हैं या 24 घंटे की समर्पित कार ले सकते हैं।",
      kn: "ನೀವು ಹೊಂದಿಕೊಳ್ಳುವ 12-ಗಂಟೆಗಳ ಶಿಫ್ಟ್‌ಗಳಲ್ಲಿ ಡ್ರೈವ್ ಮಾಡಬಹುದು ಅಥವಾ 24-ಗಂಟೆಗಳ ಕಾರನ್ನು ತೆಗೆದುಕೊಳ್ಳಬಹುದು."
    }
  },
  driveToOwn: {
    patterns: [/own/i, /buy/i, /drivetoown/i, /drive to own/i, /kharid/i, /खरीद/i, /ಖರೀದಿ/i, /ಸ್ವಂತ/i],
    response: {
      en: "Under Milo's Drive-to-Own program, after 36 months of weekly rent, ownership transfers to you for ₹1. Maintenance and insurance are fully covered by Milo.",
      hi: "Milo के ड्राइव-टू-ओन कार्यक्रम में 36 महीने बाद सिर्फ ₹1 में कार की ओनरशिप आपकी हो जाती है। रखरखाव और बीमा Milo द्वारा दिया जाता है।",
      kn: "Milo ನ ಡ್ರೈವ್-ಟು-ಓನ್ ಯೋಜನೆಯಲ್ಲಿ 36 ತಿಂಗಳ ನಂತರ ಕೇವಲ ₹1 ಕ್ಕೆ ಕಾರಿನ ಮಾಲೀಕತ್ವ ನಿಮಗೆ ವರ್ಗಾವಣೆಯಾಗುತ್ತದೆ."
    }
  },
  earnings: {
    patterns: [/earn/i, /income/i, /salary/i, /kamai/i, /कमाई/i, /ವೇತನ/i, /ಗಳಿಕೆ/i],
    response: {
      en: "You keep 100% of all customer fares. Milo only charges the weekly vehicle rent of ₹6,300 with zero trip commission.",
      hi: "आप सभी ग्राहक किराए का 100% अपने पास रखते हैं। Milo केवल ₹6,300 का साप्ताहिक किराया लेता है।",
      kn: "ನೀವು 100% ಪ್ರಯಾಣಿಕರ ದರವನ್ನು ನೀವೇ ಇಟ್ಟುಕೊಳ್ಳುತ್ತೀರಿ. Milo ಕೇವಲ ವಾರಕ್ಕೆ ₹6,300 ಬಾಡಿಗೆ ತೆಗೆದುಕೊಳ್ಳುತ್ತದೆ."
    }
  },
  documents: {
    patterns: [/document/i, /doc/i, /licen[sc]e/i, /aadhaar/i, /pan/i, /दस्तावेज़/i, /ದಾಖಲೆ/i],
    response: {
      en: "You will need: commercial badge driving licence, Aadhaar card, PAN card, and a bank passbook or cancelled cheque.",
      hi: "आपको चाहिए: कमर्शियल बैज ड्राइविंग लाइसेंस, आधार कार्ड, पैन कार्ड और बैंक पासबुक या चेक।",
      kn: "ನಿಮಗೆ ಬೇಕಾಗುವುದು: ಕಮರ್ಷಿಯಲ್ ಬ್ಯಾಡ್ಜ್ ಡ್ರೈವಿಂಗ್ ಲೈಸೆನ್ಸ್, ಆಧಾರ್ ಕಾರ್ಡ್, ಪ್ಯಾನ್ ಕಾರ್ಡ್ ಮತ್ತು ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್."
    }
  }
};

/**
 * Answer a free-text question from Milo facts sheet.
 * If answer not in facts sheet -> return escalation fallback.
 */
function answerFromFacts(questionText, lang = 'en') {
  if (!questionText || typeof questionText !== 'string') {
    return { answered: false, reply: getFallback(lang), escalate: true };
  }

  const clean = questionText.trim();

  // Search through facts categories
  for (const [key, category] of Object.entries(TOPIC_KEYWORDS)) {
    for (const pattern of category.patterns) {
      if (pattern.test(clean)) {
        const reply = category.response[lang] || category.response['en'];
        // Strict guardrail verification
        verifyReplyCompliance(reply);
        return {
          answered: true,
          topic: key,
          reply: reply,
          escalate: false
        };
      }
    }
  }

  // Not in facts sheet -> Route to Milo team
  return {
    answered: false,
    reply: getFallback(lang),
    escalate: true,
    unansweredQuestion: clean
  };
}

function getFallback(lang) {
  const fallbacks = {
    en: "I don't have that yet, I've asked Milo's team.",
    hi: "मेरे पास अभी यह जानकारी नहीं है, मैंने Milo टीम से पूछा है।",
    kn: "ನನ್ನ ಬಳಿ ಇನ್ನೂ ಈ ಮಾಹಿತಿ ಇಲ್ಲ, ನಾನು Milo ತಂಡವನ್ನು ಕೇಳಿದ್ದೇನೆ."
  };
  return fallbacks[lang] || fallbacks.en;
}

/**
 * Strict compliance check: No unapproved ₹ figure can ever be returned
 */
function verifyReplyCompliance(replyText) {
  const rupeeMatches = replyText.match(/(?:₹|rs\.?|inr)\s*([\d,]+)/gi);
  if (rupeeMatches) {
    for (const match of rupeeMatches) {
      const cleanNum = match.replace(/[^\d]/g, '');
      const isAllowed = ALLOWED_RUPEE_FIGURES.some(allowed => allowed.includes(cleanNum));
      if (!isAllowed) {
        throw new Error(`COMPLIANCE VIOLATION: Unauthorized figure '${match}' in reply: ${replyText}`);
      }
    }
  }
  // Check Rule 5: Never promise approval or arbitrary earnings
  if (/(you are selected|you will earn ₹|guaranteed income|selected for job)/i.test(replyText)) {
    throw new Error(`COMPLIANCE VIOLATION: Forbidden promise in reply: ${replyText}`);
  }
  return true;
}

module.exports = {
  answerFromFacts,
  verifyReplyCompliance,
  ALLOWED_RUPEE_FIGURES
};
