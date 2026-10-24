/**
 * Milo WhatsApp Flow Definition (server/flows/milo.js)
 * Implements Step 1 of intern build plan (PDF Page 12)
 * Declarative state machine containing every step, type, options, transitions, and saves.
 */

const miloFlow = {
  // --- Step 0 & Fork ---
  L1: {
    id: 'L1',
    messageKey: 'L1',
    type: 'choice',
    options: [
      { id: '1', lang: 'en', label: 'English', next: 'M1' },
      { id: '2', lang: 'hi', label: 'हिन्दी', next: 'M1' },
      { id: '3', lang: 'kn', label: 'ಕನ್ನಡ', next: 'M1' }
    ],
    saves: 'language'
  },

  M1: {
    id: 'M1',
    messageKey: 'M1',
    type: 'choice',
    options: [
      { id: '1', branch: 'driver', label: 'I want to drive with Milo', next: 'D1' },
      { id: '2', branch: 'rider', label: 'Book a ride', next: 'B1' },
      { id: '3', branch: 'existing_driver', label: 'I already drive with Milo', next: 'E1' }
    ],
    saves: 'branch'
  },

  // --- Driver Onboarding Branch ---
  D1: {
    id: 'D1',
    messageKey: 'D1',
    type: 'choice',
    options: [
      { id: '1', value: 'yes', label: 'Yes', next: 'D2' },
      { id: '2', value: 'no', label: 'No', next: 'X1' },
      { id: '3', value: 'applied', label: 'I have applied', next: 'X1' }
    ],
    saves: 'badge'
  },

  D2: {
    id: 'D2',
    messageKey: 'D2',
    type: 'choice',
    options: [
      { id: '1', value: 'less_than_1_yr', label: 'Less than 1 year', next: 'D3' },
      { id: '2', value: '1_to_3_yrs', label: '1 to 3 years', next: 'D3' },
      { id: '3', value: 'more_than_3_yrs', label: 'More than 3 years', next: 'D3' }
    ],
    saves: 'experience_band'
  },

  D3: {
    id: 'D3',
    messageKey: 'D3',
    type: 'multi',
    options: [
      { id: '1', value: 'Uber', label: 'Uber' },
      { id: '2', value: 'Ola', label: 'Ola' },
      { id: '3', value: 'Rapido', label: 'Rapido' },
      { id: '4', value: 'Other', label: 'Other' },
      { id: '5', value: 'None', label: 'None' }
    ],
    next: 'D4',
    saves: 'platforms'
  },

  D4: {
    id: 'D4',
    messageKey: 'D4',
    type: 'choice',
    options: [
      { id: '1', value: 'under_21', label: 'Under 21', next: 'D5' },
      { id: '2', value: '21_30', label: '21–30', next: 'D5' },
      { id: '3', value: '31_40', label: '31–40', next: 'D5' },
      { id: '4', value: '41_50', label: '41–50', next: 'D5' },
      { id: '5', value: 'over_50', label: 'Over 50', next: 'D5' }
    ],
    saves: 'age_band'
  },

  D5: {
    id: 'D5',
    messageKey: 'D5',
    type: 'choice',
    options: [
      { id: '1', value: 'hsr', label: 'HSR Layout', next: 'CHECK_CRITERIA' },
      { id: '2', value: 'ecity', label: 'Electronic City', next: 'CHECK_CRITERIA' },
      { id: '3', value: 'hebbal', label: 'Hebbal', next: 'CHECK_CRITERIA' },
      { id: '4', value: 'none', label: 'None of these is near me', next: 'X2' }
    ],
    saves: 'hub'
  },

  D6: {
    id: 'D6',
    messageKey: 'D6',
    type: 'text',
    next: 'D7',
    saves: 'name'
  },

  D7: {
    id: 'D7',
    messageKey: 'D7',
    type: 'choice',
    options: [
      { id: '1', factKey: 'rent', label: 'Rent and deposit', repeat: true },
      { id: '2', factKey: 'charging', label: 'Charging', repeat: true },
      { id: '3', factKey: 'earnings', label: 'How earnings work', repeat: true },
      { id: '4', label: 'No, continue', next: 'D8' }
    ]
  },

  D8: {
    id: 'D8',
    messageKey: 'D8',
    type: 'choice',
    options: [
      { id: '1', value: 'agree', label: 'I agree', next: 'D9a' },
      { id: '2', value: 'not_now', label: 'Not now', pause: true }
    ],
    saves: 'doc_consent'
  },

  // Document uploads: D9a - D9f
  D9a: { id: 'D9a', messageKey: 'D9a', type: 'photo', docType: 'licence_front', next: 'D9b', skipOption: '8' },
  D9b: { id: 'D9b', messageKey: 'D9b', type: 'photo', docType: 'licence_back', next: 'D9c', skipOption: '8' },
  D9c: { id: 'D9c', messageKey: 'D9c', type: 'photo', docType: 'aadhaar', next: 'D9d', skipOption: '8' },
  D9d: { id: 'D9d', messageKey: 'D9d', type: 'photo', docType: 'pan', next: 'D9e', skipOption: '8' },
  D9e: { id: 'D9e', messageKey: 'D9e', type: 'photo', docType: 'cheque', next: 'D9f', skipOption: '8' },
  D9f: { id: 'D9f', messageKey: 'D9f', type: 'photo', docType: 'selfie', next: 'D10', skipOption: '8' },

  D10: {
    id: 'D10',
    messageKey: 'D10',
    type: 'choice',
    isSlotPicker: true,
    options: [
      { id: '1', label: 'Slot 1' },
      { id: '2', label: 'Slot 2' },
      { id: '3', label: 'Slot 3' },
      { id: '6', label: 'None of these work' }
    ],
    saves: 'slot',
    next: 'D11'
  },

  D11: {
    id: 'D11',
    messageKey: 'D11',
    type: 'choice',
    options: [
      { id: '1', value: 'confirm', label: 'Confirm', next: 'D12' },
      { id: '2', value: 'change_time', label: 'Pick another time', next: 'D10' }
    ],
    saves: 'test_drive'
  },

  D12: {
    id: 'D12',
    messageKey: 'D12',
    type: 'info',
    isEnd: true
  },

  // Exits
  X1: {
    id: 'X1',
    messageKey: 'X1',
    type: 'choice',
    options: [
      { id: '1', value: 'yes', label: 'Yes' },
      { id: '2', value: 'no', label: 'No' }
    ],
    saves: 'notify_ok'
  },

  X2: {
    id: 'X2',
    messageKey: 'X2',
    type: 'text',
    saves: 'area'
  },

  // --- Ride Booking Branch ---
  B1: {
    id: 'B1',
    messageKey: 'B1',
    type: 'choice',
    options: [
      { id: '1', value: 'Airport drop', label: 'Airport drop', next: 'B2' },
      { id: '2', value: 'Airport pickup', label: 'Airport pickup', next: 'B2' },
      { id: '3', value: 'Local, by the hour', label: 'Local, by the hour', next: 'B2' },
      { id: '4', value: 'Outstation', label: 'Outstation', next: 'B2' },
      { id: '5', value: 'Office account', label: 'Office account', next: 'B2' }
    ],
    saves: 'ride_type'
  },

  B2: {
    id: 'B2',
    messageKey: 'B2',
    type: 'choice',
    options: [
      { id: '1', value: 'Now, within 1 hour', label: 'Now, within 1 hour', next: 'B4', isNow: true },
      { id: '2', value: 'Later today', label: 'Later today', next: 'B3' },
      { id: '3', value: 'Tomorrow', label: 'Tomorrow', next: 'B3' },
      { id: '4', value: 'Another date', label: 'Another date', next: 'B2d' }
    ],
    saves: 'when'
  },

  B2d: {
    id: 'B2d',
    messageKey: 'B2d',
    type: 'date',
    next: 'B3',
    saves: 'date'
  },

  B3: {
    id: 'B3',
    messageKey: 'B3',
    type: 'time',
    next: 'B4',
    saves: 'time'
  },

  B4: {
    id: 'B4',
    messageKey: 'B4',
    type: 'location',
    next: 'B5',
    saves: 'pickup'
  },

  B5: {
    id: 'B5',
    messageKey: 'B5',
    type: 'location',
    next: 'B6',
    saves: 'drop'
  },

  B6: {
    id: 'B6',
    messageKey: 'B6',
    type: 'choice',
    options: [
      { id: '1', value: '1 or 2', label: '1 or 2', next: 'B7' },
      { id: '2', value: '3 or 4', label: '3 or 4', next: 'B7' },
      { id: '3', value: 'More than 4', label: 'More than 4', next: 'B7', note: 'needs 2 cars' }
    ],
    saves: 'passengers'
  },

  B7: {
    id: 'B7',
    messageKey: 'B7',
    type: 'text',
    next: 'B8',
    saves: 'name'
  },

  B8: {
    id: 'B8',
    messageKey: 'B8',
    type: 'choice',
    options: [
      { id: '1', value: 'send_request', label: 'Send request', next: 'B9' },
      { id: '2', value: 'change_something', label: 'Change something', next: 'B8c' }
    ]
  },

  B8c: {
    id: 'B8c',
    messageKey: 'B8c',
    type: 'choice',
    options: [
      { id: '1', targetStep: 'B1', label: 'Ride type' },
      { id: '2', targetStep: 'B2', label: 'Date or time' },
      { id: '3', targetStep: 'B4', label: 'Pickup' },
      { id: '4', targetStep: 'B5', label: 'Drop' },
      { id: '5', targetStep: 'B6', label: 'People' }
    ]
  },

  B9: {
    id: 'B9',
    messageKey: 'B9',
    type: 'info',
    isEnd: true,
    saves: 'booking_status'
  },

  // --- Existing Driver & Support ---
  E1: {
    id: 'E1',
    messageKey: 'E1',
    type: 'choice',
    options: [
      { id: '1', value: 'Payment or dues', label: 'Payment or dues' },
      { id: '2', value: 'Car problem or charging', label: 'Car problem or charging' },
      { id: '3', value: 'Leave or returning the car', label: 'Leave or returning the car' },
      { id: '4', value: 'Something else', label: 'Something else' }
    ],
    saves: 'topic'
  },

  H1: {
    id: 'H1',
    type: 'handoff'
  }
};

module.exports = miloFlow;
