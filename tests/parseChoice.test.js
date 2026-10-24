const assert = require('assert');
const { parseChoice, normalizeIndicNumerals } = require('../server/parser/parseChoice');

console.log('🧪 Running parseChoice Unit Tests based on PDF Page 9 Table...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

const mockStep = {
  id: 'D5',
  type: 'choice',
  options: [
    { id: '1', text: 'HSR Layout' },
    { id: '2', text: 'Electronic City' },
    { id: '3', text: 'Hebbal' },
    { id: '4', text: 'None of these is near me' }
  ]
};

const mockMultiStep = {
  id: 'D3',
  type: 'multi',
  options: [
    { id: '1', text: 'Uber' },
    { id: '2', text: 'Ola' },
    { id: '3', text: 'Rapido' },
    { id: '4', text: 'Other' },
    { id: '5', text: 'None' }
  ]
};

// 1. Standard digit formats
['2', ' 2 ', '2.', '2)', '#2', 'option 2', 'Option 2'].forEach(input => {
  test(`Digit format '${input}' resolves to choice '2'`, () => {
    const res = parseChoice(input, mockStep);
    assert.strictEqual(res.isChoice, true);
    assert.strictEqual(res.choice, '2');
  });
});

// 2. Indic numerals
test(`Devanagari '२' resolves to '2'`, () => {
  const res = parseChoice('२', mockStep);
  assert.strictEqual(res.isChoice, true);
  assert.strictEqual(res.choice, '2');
});

test(`Kannada '೨' resolves to '2'`, () => {
  const res = parseChoice('೨', mockStep);
  assert.strictEqual(res.isChoice, true);
  assert.strictEqual(res.choice, '2');
});

// 3. Word representations
['two', 'do', 'दो', 'ಎರಡು', 'eradu'].forEach(word => {
  test(`Word '${word}' resolves to '2'`, () => {
    const res = parseChoice(word, mockStep);
    assert.strictEqual(res.isChoice, true);
    assert.strictEqual(res.choice, '2');
  });
});

// 4. Option's own words
test(`Option word 'Hebbal' matches option '3'`, () => {
  const res = parseChoice('Hebbal', mockStep);
  assert.strictEqual(res.isChoice, true);
  assert.strictEqual(res.choice, '3');
});

test(`Option word 'electronic city' matches option '2'`, () => {
  const res = parseChoice('electronic city', mockStep);
  assert.strictEqual(res.isChoice, true);
  assert.strictEqual(res.choice, '2');
});

// 5. WhatsApp button payload
test(`WhatsApp button click { id: '2' } resolves directly to '2'`, () => {
  const res = parseChoice({ id: '2' }, mockStep);
  assert.strictEqual(res.isChoice, true);
  assert.strictEqual(res.choice, '2');
});

// 6. Multi-select variations
['1 3', '1,3', '1 and 3', '1, 3'].forEach(multiStr => {
  test(`Multi-select '${multiStr}' on D3 returns ['1', '3']`, () => {
    const res = parseChoice(multiStr, mockMultiStep);
    assert.strictEqual(res.isChoice, true);
    assert.strictEqual(res.isMulti, true);
    assert.deepStrictEqual(res.choice, ['1', '3']);
  });
});

test(`Multi-select '1 3' on single-choice step is not allowed`, () => {
  const res = parseChoice('1 3', mockStep);
  assert.strictEqual(res.isChoice, false);
  assert.strictEqual(res.reason, 'multi_not_allowed');
});

// 7. Compound message
test(`Compound message '2 but what is the deposit?' returns choice '2' and extra question`, () => {
  const res = parseChoice('2 but what is the deposit?', mockStep);
  assert.strictEqual(res.isChoice, true);
  assert.strictEqual(res.choice, '2');
  assert.strictEqual(res.extraQuestion, 'what is the deposit?');
});

// 8. Number out of range
test(`Number '7' on 4-option step returns isChoice: false (out of range)`, () => {
  const res = parseChoice('7', mockStep);
  assert.strictEqual(res.isChoice, false);
  assert.strictEqual(res.reason, 'out_of_range');
});

// 9. Free-text questions / general text
test(`Question 'what is the deposit?' is not a choice`, () => {
  const res = parseChoice('what is the deposit?', mockStep);
  assert.strictEqual(res.isChoice, false);
});

// 10. Global 0 and 9 options
test(`Global '0' (Main menu) is always valid choice`, () => {
  const res = parseChoice('0', mockStep);
  assert.strictEqual(res.isChoice, true);
  assert.strictEqual(res.choice, '0');
});

test(`Global '9' (Talk to team) is always valid choice`, () => {
  const res = parseChoice('9', mockStep);
  assert.strictEqual(res.isChoice, true);
  assert.strictEqual(res.choice, '9');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
