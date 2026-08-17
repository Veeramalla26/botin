require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

const API = process.env.API_URL || 'http://localhost:3001/api/chat';
const {
  isFollowUpQuestion,
  fixFollowUpTypos,
} = require('../api/lib/prompts');

async function chat(body) {
  const start = Date.now();
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { text, ms: Date.now() - start };
}

async function run() {
  console.log('=== Unit: typo + follow-up detection ===');
  const cases = [
    'what is the useofit',
    'write program ofit',
    'what is sap s4hana',
  ];
  for (const c of cases) {
    console.log(`"${c}" -> "${fixFollowUpTypos(c)}" | followUp=${isFollowUpQuestion(c)}`);
  }

  console.log('\n=== Test 3: Code follow-up "write program ofit" ===');
  const arrayQ = await chat({ prompt: 'write number swap array program in python', mode: 'send' });
  const arrayHistory = [{ prompt: 'write number swap array program in python', response: arrayQ.text.slice(0, 1000) }];
  const codeFollowUp = await chat({
    prompt: 'write program ofit',
    mode: 'send',
    conversationHistory: arrayHistory,
  });

  const hasCodeBlock = /```/.test(codeFollowUp.text);
  const mentionsSwap = /swap/i.test(codeFollowUp.text);
  const wrongTopic = /\bping\b|\bserver\b|\bIT\b/i.test(codeFollowUp.text) && !mentionsSwap;

  console.log(`Time: ${(codeFollowUp.ms / 1000).toFixed(1)}s`);
  console.log(codeFollowUp.text.slice(0, 500));
  console.log(`Has code block: ${hasCodeBlock ? 'PASS' : 'FAIL'}`);
  console.log(`About swap/array: ${mentionsSwap ? 'PASS' : 'FAIL'}`);
  console.log(`Wrong topic (IT/ping): ${wrongTopic ? 'FAIL' : 'PASS'}`);

  console.log('\n=== Test 4: No-context baseline speed ===');
  const brief = await chat({ prompt: 'what is node js', mode: 'brief' });
  console.log(`Brief mode time: ${(brief.ms / 1000).toFixed(1)}s | ${brief.text.split(/\s+/).length} words`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
