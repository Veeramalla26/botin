require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

const API = process.env.API_URL || 'http://localhost:3001/api/chat';

async function chat(body) {
  const start = Date.now();
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }

  const text = await res.text();
  const ms = Date.now() - start;
  return { text, ms, words: text.split(/\s+/).length };
}

async function run() {
  console.log('=== Test 1: First question (SAP S/4HANA) ===\n');
  const q1 = await chat({ prompt: 'what is sap s4hana', mode: 'send' });
  console.log(`Time: ${(q1.ms / 1000).toFixed(1)}s | Words: ${q1.words}`);
  console.log(q1.text.slice(0, 400) + (q1.text.length > 400 ? '...' : ''));
  console.log('\n');

  const conversationHistory = [
    {
      prompt: 'what is sap s4hana',
      response: q1.text.slice(0, 1000),
    },
  ];

  console.log('=== Test 2: Follow-up "what is the useofit" (typo + pronoun) ===\n');
  const q2 = await chat({
    prompt: 'what is the useofit',
    mode: 'send',
    conversationHistory,
  });
  console.log(`Time: ${(q2.ms / 1000).toFixed(1)}s | Words: ${q2.words}`);
  console.log(q2.text);

  const badPatterns = [
    /could you clarify/i,
    /not (entirely )?sure what ['"]?it['"]? is/i,
    /what do you mean by/i,
    /I'm not sure/i,
    /can you clarify/i,
  ];
  const hasBad = badPatterns.some((p) => p.test(q2.text));
  const mentionsSap =
    /\bsap\b/i.test(q2.text) ||
    /\bs\/4hana\b/i.test(q2.text) ||
    /\berp\b/i.test(q2.text);

  console.log('\n=== Results ===');
  console.log(`Q1 time: ${(q1.ms / 1000).toFixed(1)}s`);
  console.log(`Q2 time: ${(q2.ms / 1000).toFixed(1)}s`);
  console.log(`Follow-up asks for clarification: ${hasBad ? 'FAIL' : 'PASS'}`);
  console.log(`Follow-up mentions SAP/ERP topic: ${mentionsSap ? 'PASS' : 'FAIL'}`);
  console.log(`Overall: ${!hasBad && mentionsSap ? 'PASS' : 'FAIL'}`);
}

run().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
