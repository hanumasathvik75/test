/**
 * parseChoice(text, step)
 * Implements the specification from PDF Page 9 & 10.
 * Runs before any AI call, turning a message into an option number or "not a choice".
 */

// Indic digit translations
const DEVANAGARI_DIGITS = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
};

const KANNADA_DIGITS = {
  '೦': '0', '೧': '1', '೨': '2', '೩': '3', '೪': '4',
  '೫': '5', '೬': '6', '೭': '7', '೮': '8', '೯': '9'
};

// Word representations for 0-9 across English, Hindi, and Kannada
const WORD_TO_DIGIT = {
  // English
  'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
  'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
  
  // Hindi (Latin transliteration & Devanagari)
  'ek': '1', 'एक': '1',
  'do': '2', 'दो': '2',
  'teen': '3', 'tin': '3', 'तीन': '3',
  'chaar': '4', 'char': '4', 'चार': '4',
  'paanch': '5', 'panch': '5', 'पाँच': '5', 'पांच': '5',
  'chhe': '6', 'che': '6', 'छह': '6',
  'saat': '7', 'sat': '7', 'सात': '7',
  'aath': '8', 'ath': '8', 'आठ': '8',
  'nau': '9', 'नौ': '9',
  'shunya': '0', 'शून्य': '0',

  // Kannada (Latin transliteration & Kannada script)
  'ondu': '1', 'ondhu': '1', 'ಒಂದು': '1',
  'eradu': '2', 'yeradu': '2', 'ಎರಡು': '2',
  'mooru': '3', 'muru': '3', 'ಮೂರು': '3',
  'naalku': '4', 'nalku': '4', 'ನಾಲ್ಕು': '4',
  'aidu': '5', 'ಐದು': '5',
  'aaru': '6', 'ಆರು': '6',
  'elu': '7', 'eelu': '7', 'ಏಳು': '7',
  'entu': '8', 'ಎಂಟು': '8',
  'ombattu': '9', 'ಒಂಬತ್ತು': '9',
  'sonne': '0', 'ಸೊನ್ನೆ': '0'
};

/**
 * Normalize Indic numerals to standard Arabic digits
 */
function normalizeIndicNumerals(str) {
  if (!str) return '';
  let result = '';
  for (const char of str) {
    if (DEVANAGARI_DIGITS[char] !== undefined) {
      result += DEVANAGARI_DIGITS[char];
    } else if (KANNADA_DIGITS[char] !== undefined) {
      result += KANNADA_DIGITS[char];
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Main parseChoice implementation
 * @param {string|object} rawInput - Text message or button payload
 * @param {object} step - The current step configuration from flow
 * @returns {object} { isChoice: boolean, choice: string|string[], extraQuestion?: string, isMulti: boolean, raw: string, reason?: string }
 */
function parseChoice(rawInput, step = {}) {
  // 1. Direct interactive WhatsApp button or list row selection
  if (typeof rawInput === 'object' && rawInput !== null) {
    const buttonId = rawInput.id || rawInput.button_id || rawInput.list_reply_id;
    if (buttonId !== undefined) {
      return {
        isChoice: true,
        choice: String(buttonId).trim(),
        isMulti: false,
        raw: String(buttonId)
      };
    }
    rawInput = rawInput.text || '';
  }

  let text = String(rawInput || '').trim();
  if (!text) {
    return { isChoice: false, reason: 'empty_input' };
  }

  // Normalize Unicode Indic digits first
  text = normalizeIndicNumerals(text);

  const isMultiStep = step.type === 'multi';
  const validOptions = (step.options || []).map(opt => String(opt.id || opt.value || opt));
  // Universal global navigation options
  const allowedSet = new Set([...validOptions, '0', '9']);

  // 2. Check for compound message: e.g. "2 but what is the deposit?" or "1, and what is rent?"
  // Regex looks for leading choice token followed by optional separator / conjunction and then question
  const compoundMatch = text.match(/^([0-9]|#?[0-9]|option\s*[0-9])\s*(?:[,\.\)\-–—\s]+|\s+(?:but|and|aur|kintu|mathu|ಮತ್ತು|ಆದರೆ|और|पर)\s+|\s+)\s*(?:(?:but|and|aur|kintu|mathu|ಮತ್ತು|ಆದರೆ|और|पर)\s+)?(.*\?|what.*|how.*|kya.*|yenu.*|where.*|is.*|can.*)/i);
  if (compoundMatch) {
    const rawPrefix = compoundMatch[1];
    let questionPart = (compoundMatch[2] || compoundMatch[1]).trim();
    // Strip leading connector words if still present
    questionPart = questionPart.replace(/^(?:but|and|aur|kintu|mathu|ಮತ್ತು|ಆದರೆ|और|पर)\s+/i, '').trim();
    const cleanNum = rawPrefix.replace(/[^0-9]/g, '');
    if (cleanNum && allowedSet.has(cleanNum)) {
      return {
        isChoice: true,
        choice: cleanNum,
        extraQuestion: questionPart,
        isMulti: false,
        raw: text
      };
    }
  }

  // 3. Multi-select parsing: e.g. "1 3", "1,3", "1 and 3", "1, 3", "1 & 3"
  // Split on delimiters (space, comma, 'and', '&', 'aur', 'mathu')
  const multiTokens = text.split(/[\s,]+|(?:and|&|aur|mathu|ಮತ್ತು|और)+/i)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);

  if (multiTokens.length > 1) {
    // Check if all tokens represent valid numbers / words
    const parsedDigits = [];
    let allTokensAreChoices = true;

    for (const token of multiTokens) {
      const normalizedToken = WORD_TO_DIGIT[token] || token.replace(/[^0-9]/g, '');
      if (normalizedToken && /^\d+$/.test(normalizedToken)) {
        parsedDigits.push(normalizedToken);
      } else {
        allTokensAreChoices = false;
        break;
      }
    }

    if (allTokensAreChoices && parsedDigits.length > 1) {
      if (isMultiStep) {
        // Validate each choice is in allowed set
        const validSelections = [...new Set(parsedDigits.filter(d => allowedSet.has(d)))];
        if (validSelections.length > 0) {
          return {
            isChoice: true,
            choice: validSelections,
            isMulti: true,
            raw: text
          };
        }
      } else {
        // If not a multi-select step, multiple numbers are invalid -> ask again / wrong reply
        return {
          isChoice: false,
          reason: 'multi_not_allowed',
          raw: text
        };
      }
    }
  }

  // 4. Exact Single Word match: e.g. "two", "do", "दो", "eradu", "ಎರಡು"
  const cleanWord = text.toLowerCase().trim();
  if (WORD_TO_DIGIT[cleanWord] !== undefined) {
    const digit = WORD_TO_DIGIT[cleanWord];
    if (allowedSet.has(digit)) {
      return {
        isChoice: true,
        choice: digit,
        isMulti: false,
        raw: text
      };
    } else {
      return {
        isChoice: false,
        reason: 'out_of_range',
        rawNumber: digit,
        raw: text
      };
    }
  }

  // 5. Standard digit formats: "2", " 2 ", "2.", "2)", "#2", "option 2", "Option 2"
  const standardDigitMatch = text.match(/^(?:option\s*|#\s*)?(\d+)[\.\)]?$/i);
  if (standardDigitMatch) {
    const digit = standardDigitMatch[1];
    if (allowedSet.has(digit)) {
      return {
        isChoice: true,
        choice: digit,
        isMulti: false,
        raw: text
      };
    } else {
      return {
        isChoice: false,
        reason: 'out_of_range',
        rawNumber: digit,
        raw: text
      };
    }
  }

  // 6. Option's own words matching: e.g. "Hebbal", "yes", "Uber", "Airport drop"
  // Matches if exactly ONE option matches the text (case-insensitive substring or exact match)
  if (step.options && step.options.length > 0) {
    const cleanLower = text.toLowerCase().trim();
    // Exclude very long messages or questions
    if (!cleanLower.includes('?') && cleanLower.length < 50) {
      const matches = [];
      for (const opt of step.options) {
        const optText = (opt.text || opt.label || '').toLowerCase().trim();
        const optValue = (opt.value || opt.id || '').toLowerCase().trim();
        if (optText && (optText === cleanLower || optText.includes(cleanLower) || cleanLower.includes(optText))) {
          matches.push(String(opt.id || opt.value));
        } else if (optValue && optValue === cleanLower) {
          matches.push(String(opt.id || opt.value));
        }
      }

      // Check common affirmative / negative words
      if (matches.length === 0) {
        if (/^(yes|ha|haan|हाँ|ಹೌದು|agree|confirm)$/i.test(cleanLower)) {
          const yesOpt = step.options.find(o => /(yes|agree|confirm|haan|ಹೌದು)/i.test(o.text || ''));
          if (yesOpt) matches.push(String(yesOpt.id || '1'));
        } else if (/^(no|nah|nahi|नहीं|ಇಲ್ಲ|reject|decline)$/i.test(cleanLower)) {
          const noOpt = step.options.find(o => /(no|nahi|ಇಲ್ಲ)/i.test(o.text || ''));
          if (noOpt) matches.push(String(noOpt.id || '2'));
        }
      }

      const uniqueMatches = [...new Set(matches)];
      if (uniqueMatches.length === 1 && allowedSet.has(uniqueMatches[0])) {
        return {
          isChoice: true,
          choice: uniqueMatches[0],
          isMulti: false,
          matchedByText: true,
          raw: text
        };
      }
    }
  }

  // 7. Not a choice
  return {
    isChoice: false,
    reason: 'not_a_choice',
    raw: text
  };
}

module.exports = {
  parseChoice,
  normalizeIndicNumerals,
  WORD_TO_DIGIT
};
