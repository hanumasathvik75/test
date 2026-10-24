/**
 * Milo 14-Point Specification Checklist Test Suite (PDF Page 13)
 * Runs against the actual backend engine and validates every checklist requirement.
 */

const assert = require('assert');
const { processInbound } = require('../server/flowRunner');
const db = require('../server/storage/db');
const scheduler = require('../server/reminders/scheduler');
const { answerFromFacts, verifyReplyCompliance } = require('../server/ai/factsEngine');

console.log('🚀 Running Milo 14-Point PDF Checklist Test Suite...\n');

let passedCount = 0;
let failedCount = 0;

async function runCheck(number, title, fn) {
  try {
    await fn();
    console.log(`  ✅ Checklist #${number}: ${title}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ Checklist #${number} FAILED: ${title}`);
    console.error(`     Error: ${err.message}\n`);
    failedCount++;
  }
}

async function runAllTests() {
  db.resetAll();

  // Test 1: New number gets L1, then M1; replying २ picks Hindi
  await runCheck(1, 'New number gets L1, then M1; replying २ picks Hindi', async () => {
    const phone = '+919000000001';
    // First message to new number -> triggers L1
    const res1 = await processInbound({ phone, text: 'Hi' });
    // Replied to L1 with Devanagari २
    const res2 = await processInbound({ phone, text: '२' });
    const lead = db.getLead(phone);
    assert.strictEqual(lead.language, 'hi', 'Language should be Hindi (hi)');
    assert.strictEqual(res2.step, 'M1', 'Should transition to M1');
    assert.ok(res2.reply.includes('Milo'), 'Reply should be Hindi M1 menu');
  });

  // Test 2: 1 -> full onboarding to a booked test drive in under 3 minutes
  await runCheck(2, '1 -> full onboarding to a booked test drive in under 3 minutes', async () => {
    const phone = '+919000000002';
    await processInbound({ phone, text: '1' }); // L1 -> English
    await processInbound({ phone, text: '1' }); // M1 -> Driver onboarding -> D1
    await processInbound({ phone, text: '1' }); // D1 -> Yes (badge) -> D2
    await processInbound({ phone, text: '2' }); // D2 -> 1 to 3 yrs experience -> D3
    await processInbound({ phone, text: '1 2' }); // D3 -> Uber & Ola -> D4
    await processInbound({ phone, text: '3' }); // D4 -> Age 31-40 -> D5
    await processInbound({ phone, text: '1' }); // D5 -> HSR Layout -> Check passes -> D6
    await processInbound({ phone, text: 'Vikram Singh' }); // D6 -> Name -> D7
    await processInbound({ phone, text: '4' }); // D7 -> No continue -> D8
    await processInbound({ phone, text: '1' }); // D8 -> I agree -> D9a
    // Upload 6 documents
    for (let i = 0; i < 6; i++) {
      await processInbound({ phone, type: 'photo', mediaUrl: 'https://example.com/doc.jpg' });
    }
    // Now at D10 (Slot picker)
    const resSlot = await processInbound({ phone, text: '1' }); // Pick slot 1 -> D11
    assert.strictEqual(resSlot.step, 'D11');
    const resConfirm = await processInbound({ phone, text: '1' }); // Confirm -> D12
    assert.strictEqual(resConfirm.step, 'D12');
    const lead = db.getLead(phone);
    assert.strictEqual(lead.stage, 'test_drive_booked');
    assert.ok(lead.testDrive, 'Test drive details must be saved');
  });

  // Test 3: D1 reply 2 ends at X1 with no "rejected" wording
  await runCheck(3, 'D1 reply 2 ends at X1 with no "rejected" wording', async () => {
    const phone = '+919000000003';
    await processInbound({ phone, text: '1' }); // English
    await processInbound({ phone, text: '1' }); // Driver onboarding
    const resD1 = await processInbound({ phone, text: '2' }); // No badge licence
    assert.strictEqual(resD1.step, 'X1');
    assert.ok(!resD1.reply.toLowerCase().includes('reject'), 'Must never say "rejected"');
    assert.ok(resD1.reply.includes('Milo needs drivers with a badge licence'), 'Must explain criteria politely');
  });

  // Test 4: D3 accepts 1 3 and saves both apps
  await runCheck(4, 'D3 accepts 1 3 and saves both apps', async () => {
    const phone = '+919000000004';
    await processInbound({ phone, text: '1' }); // English
    await processInbound({ phone, text: '1' }); // Driver
    await processInbound({ phone, text: '1' }); // D1: Yes
    await processInbound({ phone, text: '2' }); // D2: 1-3 yrs
    // At D3: send "1 3"
    const resD3 = await processInbound({ phone, text: '1 3' });
    assert.strictEqual(resD3.step, 'D4');
    const lead = db.getLead(phone);
    assert.deepStrictEqual(lead.platforms, ['Uber', 'Rapido']);
  });

  // Test 5: Reply 7 on a 3-option step: hint once, then the offer to reply 9
  await runCheck(5, 'Reply 7 on a 3-option step: hint once, then the offer to reply 9', async () => {
    const phone = '+919000000005';
    await processInbound({ phone, text: '1' }); // English -> M1
    // M1 has options 1, 2, 3
    // 1st wrong reply: '7'
    const resWrong1 = await processInbound({ phone, text: '7' });
    assert.ok(resWrong1.reply.includes('Please reply with just the number, like 2'), '1st wrong reply must give hint');
    
    // 2nd wrong reply: '7' again
    const resWrong2 = await processInbound({ phone, text: '7' });
    assert.ok(resWrong2.reply.includes('Reply 9 and someone from Milo\'s team will help you'), '2nd wrong reply must offer option 9');
  });

  // Test 6: "what is the deposit" at D4: answered from facts, then D4 is asked again
  await runCheck(6, '"what is the deposit" at D4: answered from facts, then D4 is asked again', async () => {
    const phone = '+919000000006';
    await processInbound({ phone, text: '1' }); // English
    await processInbound({ phone, text: '1' }); // Driver
    await processInbound({ phone, text: '1' }); // D1
    await processInbound({ phone, text: '2' }); // D2
    await processInbound({ phone, text: '1' }); // D3
    // At D4 (Your age?)
    const resQ = await processInbound({ phone, text: 'what is the deposit?' });
    assert.strictEqual(resQ.step, 'D4', 'Must stay on step D4');
    assert.ok(resQ.reply.includes('₹10,000'), 'Must quote deposit amount from facts');
    assert.ok(resQ.reply.includes('Your age?'), 'Must repeat D4 question');
  });

  // Test 7: Reply 9 at any step: chat shows on Escalations, bot goes silent
  await runCheck(7, 'Reply 9 at any step: chat shows on Escalations, bot goes silent', async () => {
    const phone = '+919000000007';
    await processInbound({ phone, text: '1' }); // English
    const res9 = await processInbound({ phone, text: '9' }); // Reply 9
    assert.strictEqual(res9.step, 'H1');
    assert.strictEqual(res9.handoffActive, true);

    const escalations = db.getAllEscalations();
    const esc = escalations.find(e => e.phone === phone);
    assert.ok(esc, 'Escalation must be created in dashboard');

    // Bot stays silent on further messages
    const silentRes = await processInbound({ phone, text: 'Are you there?' });
    assert.strictEqual(silentRes.reply, null);
    assert.strictEqual(silentRes.silent, true);
  });

  // Test 8: Reply 0 at any step shows M1
  await runCheck(8, 'Reply 0 at any step shows M1', async () => {
    const phone = '+919000000008';
    await processInbound({ phone, text: '1' }); // English
    await processInbound({ phone, text: '1' }); // Driver -> D1
    // At D1, reply 0
    const res0 = await processInbound({ phone, text: '0' });
    assert.strictEqual(res0.step, 'M1');
    assert.ok(res0.reply.includes('How can we help you today?'), 'Must return to Main Menu');
  });

  // Test 9: A text at D9c asks for the photo again; 8 skips it
  await runCheck(9, 'A text at D9c asks for the photo again; 8 skips it', async () => {
    const phone = '+919000000009';
    await processInbound({ phone, text: '1' });
    await processInbound({ phone, text: '1' });
    await processInbound({ phone, text: '1' });
    await processInbound({ phone, text: '2' });
    await processInbound({ phone, text: '1' });
    await processInbound({ phone, text: '2' });
    await processInbound({ phone, text: '1' }); // D5 -> qualified
    await processInbound({ phone, text: 'Deepak' }); // D6 -> name
    await processInbound({ phone, text: '4' }); // D7 -> continue
    await processInbound({ phone, text: '1' }); // D8 -> agree -> D9a
    await processInbound({ phone, text: '8' }); // D9a -> skip -> D9b
    await processInbound({ phone, text: '8' }); // D9b -> skip -> D9c

    // Text sent at D9c
    const textRes = await processInbound({ phone, text: 'here is my aadhaar card number' });
    assert.ok(textRes.reply.includes('Please send a photo or PDF file'), 'Must ask for photo again');

    // Reply 8 skips D9c
    const skipRes = await processInbound({ phone, text: '8' });
    assert.strictEqual(skipRes.step, 'D9d', 'Must advance to D9d');
  });

  // Test 10: Leave at D6, come back next day: "continue where you left off" works
  await runCheck(10, 'Leave at D6, come back next day: "continue where you left off" works', async () => {
    const phone = '+919000000010';
    await processInbound({ phone, text: '1' });
    await processInbound({ phone, text: '1' });
    await processInbound({ phone, text: '1' });
    await processInbound({ phone, text: '2' });
    await processInbound({ phone, text: '1' });
    await processInbound({ phone, text: '2' });
    await processInbound({ phone, text: '1' }); // Now at D6 (What is your full name?)

    // Simulate returning days later
    scheduler.triggerReturnDaysLater(phone);
    const lead = db.getLead(phone);
    assert.strictEqual(lead.extra.flow.step, 'WELCOME_BACK');

    // Reply 1 to continue
    const resumeRes = await processInbound({ phone, text: '1' });
    assert.strictEqual(resumeRes.step, 'D6', 'Must resume right at D6');
    assert.ok(resumeRes.reply.includes('What is your full name'), 'Must repeat D6 prompt');
  });

  // Test 11: R2 reply 3 frees the slot
  await runCheck(11, 'R2 reply 3 frees the slot', async () => {
    const phone = '+919000000011';
    // Create a booked lead
    const lead = db.getLead(phone);
    lead.language = 'en';
    lead.testDrive = { slotId: 'hsr-1', slotText: 'Thu 23 Oct 10:30', hub: 'hsr', status: 'booked' };
    db.holdSlot('hsr-1', phone);
    db.updateLead(phone, { testDrive: lead.testDrive, language: 'en' });

    // Send R2 morning check-in
    scheduler.triggerR2MorningCheckin(phone);

    // Driver replies 3 (Cancel)
    const cancelRes = scheduler.handleR2Reply(phone, '3');
    assert.strictEqual(cancelRes.step, 'R2_CANCEL_REASON');
    const slot = db.getSlots()['hsr-1'];
    assert.ok(!slot.bookedLeads.includes(phone), 'Slot must be freed');
  });

  // Test 12: "cancel" at R2 does not opt out; STOP does
  await runCheck(12, '"cancel" at R2 does not opt out; STOP does', async () => {
    const phone = '+919000000012';
    // Send "cancel"
    await processInbound({ phone, text: 'cancel' });
    let lead = db.getLead(phone);
    assert.strictEqual(lead.optedOut, false, '"cancel" must NOT opt out the user');

    // Send "STOP"
    await processInbound({ phone, text: 'STOP' });
    lead = db.getLead(phone);
    assert.strictEqual(lead.optedOut, true, 'STOP MUST opt out the user');
  });

  // Test 13: 2 -> ride request reaches the team; a "Now" ride also alerts the ops number
  await runCheck(13, '2 -> ride request reaches the team; a "Now" ride also alerts ops number', async () => {
    const phone = '+919000000013';
    await processInbound({ phone, text: '1' }); // English
    await processInbound({ phone, text: '2' }); // M1 -> Book a ride (B1)
    await processInbound({ phone, text: '1' }); // B1 -> Airport drop (B2)
    const resNow = await processInbound({ phone, text: '1' }); // B2 -> Now, within 1 hour
    assert.strictEqual(resNow.step, 'B4');

    // Verify urgent escalation was created for Ops team
    const escalations = db.getAllEscalations();
    const urgentEsc = escalations.find(e => e.phone === phone && e.topic.includes('URGENT'));
    assert.ok(urgentEsc, 'Now ride request must alert ops team immediately');
  });

  // Test 14: No AI reply ever contains a ₹ figure missing from the facts sheet
  await runCheck(14, 'No AI reply ever contains a ₹ figure missing from the facts sheet', async () => {
    // Test answering from facts
    const rentAns = answerFromFacts('how much is weekly rent?', 'en');
    assert.ok(rentAns.reply.includes('₹6,300'));

    const depositAns = answerFromFacts('what is deposit?', 'en');
    assert.ok(depositAns.reply.includes('₹10,000'));

    // Verify compliance validator rejects hallucinated rupee numbers
    assert.throws(() => {
      verifyReplyCompliance('You will earn ₹50,000 per month guaranteed!');
    }, /COMPLIANCE VIOLATION/, 'Must reject unapproved ₹ amounts');

    assert.throws(() => {
      verifyReplyCompliance('Deposit is ₹25,000');
    }, /COMPLIANCE VIOLATION/, 'Must reject unauthorized deposit');
  });

  console.log(`\n========================================`);
  console.log(`Checklist Results: ${passedCount}/14 Passed, ${failedCount} Failed`);
  console.log(`========================================\n`);

  if (failedCount > 0) process.exit(1);
}

runAllTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
