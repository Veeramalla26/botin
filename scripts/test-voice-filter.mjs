// Regression checks for System Listen auto-answers and transcript clarity scoring.
// Run: node scripts/test-voice-filter.mjs
import { createRequire } from 'module';
import { shouldProcessVoiceTranscript, classifyVoicePrompt } from '../frontend/src/utils/transcriptFilter.js';

const require = createRequire(import.meta.url);
const { assessTranscription } = require('../api/lib/transcriptClarity.js');

function autoAnswers(text, { clarity = 'clear', systemListen = true } = {}) {
  if (!shouldProcessVoiceTranscript(text, { systemListen, clarity })) return false;
  return !systemListen || classifyVoicePrompt(text) === 'question';
}

const SHOULD_ANSWER = [
  'Tell me about yourself.',
  'Can you introduce yourself?',
  'Introduce yourself.',
  'Please introduce yourself.',
  'Walk me through your resume.',
  'What is React?',
  'What are React hooks and why would you use them?',
  'Explain the event loop in JavaScript.',
  'How does garbage collection work in Java?',
  'Difference between abstract class and interface.',
  "What's the difference between let, const and var?",
  'Java vs Python.',
  'Java versus Python',
  'Example program of bubble sort.',
  'Example program of BubbleSort',
  'Write a program to reverse a string.',
  'Python',
  'Python.',
  'React hooks.',
  'SQL joins.',
  'Have you worked with Kafka?',
  'Do you know Docker?',
  'Are you familiar with Kubernetes?',
  'Are you comfortable with Java?',
  'Your experience with AWS?',
  "I see you've worked on an AI voice bot.",
  'So your current project is an AI voice bot.',
  "I'd like to know about your current project.",
  'I want you to design a URL shortener.',
  'Design a parking lot system.',
  "Let's talk about your last project.",
  "Let's start with your introduction.",
  'Which language would you be comfortable with?',
  'Basically, we are the only available. Which language would you be comfortable with?',
  'Why do you want to leave your current company?',
  'Where do you see yourself in five years?',
  'What are your strengths and weaknesses?',
  'How would you handle a conflict with a teammate?',
  'Okay, so what is polymorphism?',
  'Alright, next question. What is a closure?',
  'Next question is, what is Docker?',
  'My next question is how do you handle errors in Node.js',
  'Basically I want to understand how you handled scaling.',
  'So basically, how does your system handle failures?',
  'Coming to databases, what is indexing?',
  'Do you have any questions for me?',
  'Any questions for us?',
  'What is your notice period?',
  'What is your current CTC?',
  'Why should we hire you?',
  'Give me an example of a time you showed leadership.',
  'Describe a challenging bug you fixed.',
  'Talk about a challenge you faced.',
  'Implement a debounce function.',
  'Reverse a linked list.',
  'Find the second largest element in an array.',
  'Palindrome program in Java.',
  'OOPs concepts.',
  'SOLID principles.',
  'Microservices vs monolith.',
  'How do you ensure code quality?',
  "What's your approach to testing?",
  'Is JavaScript single threaded?',
  'Is it possible to use hooks inside class components',
  'Could you explain dependency injection?',
  'Would you be okay relocating to Bangalore?',
  'So the question is, how would you optimize this query?',
  "I'm curious about how you used Redis in your project.",
  'In your resume you mentioned Node.js.',
  'You mentioned you worked on Firebase, can you elaborate?',
  'Time complexity of binary search.',
  'What happens when you type a URL in the browser?',
  'Rate yourself in JavaScript out of ten.',
  'On a scale of 1 to 10, how would you rate your React skills?',
  'Your salary expectations?',
  'Kubernetes architecture.',
  'Event loop.',
  'Promises and async await.',
  'Normalization in DBMS.',
  'Okay, what do you know about Spring Boot?',
  'Tell me the difference between process and thread.',
  'How many years of experience do you have?',
  'Current company?',
  'What technologies have you worked on?',
  'How you will handle duplicate messages in Kafka',
  'What you have done in your current project and what is your role there?',
  'So I see you have worked on an AI voice bot at SmatBot, can you walk me through how you handled the real-time audio streaming and what challenges you faced?',
  'Can you explain the difference between state and props in React?',
  'What is the difference between an inner join and a left join?',
  'Hi, I am Rahul from Infosys. Can you tell me about yourself?',
  'Hi Pavan, how are you? Can you introduce yourself?',
  'Thank you. Next question, what is Docker?',
  'Interesting, tell me more.',
  'Can you elaborate?',
  'Could you give an example?',
  'Explain closures in JavaScript with an example.',
  'Say you have an array of numbers, find the duplicates.',
  'Suppose your API is slow, what would you do?',
  "I'll give you a problem. You need to reverse a string without using built-in functions.",
  "I'll share the code and you need to find the bug.",
  'Let me know your experience with microservices.',
  'Okay. Python.',
  'What is the use of it?',
  'Can you write the code for that?',
  'Share your screen and write a function to check if a string is a palindrome.',
  'What is SAP S/4HANA?',
  'Explain ABAP CDS views.',
  'Have you used Terraform?',
  'What is ingress in Kubernetes?',
  'Explain idempotency in REST APIs.',
  'Coming to databases, indexing.',
  'Java or Python?',
  'Stack and queue.',
  'Process vs thread.',
  'What is a closure in JavaScript',
  'Why React over Angular?',
];

const SHOULD_SKIP = [
  // The three phantom questions from the bug report's screenshot (#3 is a genuine question, see SHOULD_ANSWER).
  'Hi, I am Lira, FEA Assistant from Rocky College.',
  'You speak English?',
  // Introductions, greetings, closings.
  'Hi, I am Lira, the AI assistant from Rocky College.',
  'Do you speak English?',
  'Hello, my name is Rahul and I am the hiring manager for this role.',
  "I'm Priya from the HR team.",
  'This is Rahul from TCS.',
  "Myself Rahul, I'll be taking your interview today.",
  'I will be your interviewer today.',
  'Rahul here, Java developer from Infosys.',
  'Good morning.',
  'Good morning everyone.',
  'Thank you for joining.',
  'Welcome to the interview.',
  "Thank you, that's all for today.",
  'Thanks for your time.',
  'Nice talking to you.',
  'Have a great day.',
  'See you.',
  'All the best.',
  'Bye.',
  // Acknowledgements and back-channel.
  'Okay, great.',
  'Hmm, interesting.',
  "That's a good answer.",
  "Perfect, that's all from my side.",
  'Yeah, yeah, right.',
  'Got it.',
  'Is it?',
  'Really?',
  'Right?',
  'No problem.',
  'Yes, I can hear you.',
  'Fair enough.',
  'Makes sense.',
  'Good answer.',
  // Logistics.
  'OK, great, that makes sense. Let me share my screen now.',
  'Let me share my screen.',
  'Can you see my screen?',
  'Can you hear me?',
  'Am I audible?',
  'Is my voice clear?',
  'Can you share your screen?',
  'Could you turn on your camera?',
  'Could you please unmute yourself?',
  'You are on mute.',
  'Your voice is breaking.',
  'Sorry, my internet is a bit slow.',
  'Network issue.',
  'Can you repeat that?',
  "Sorry, I didn't get you.",
  'Hello? Hello?',
  'Are you there?',
  "I'll paste the question in the chat.",
  'I am going to share a link in the chat.',
  'Give me a second.',
  'Just a moment.',
  'One second.',
  'Hold on.',
  'Okay, take your time.',
  'Go ahead.',
  'Please continue.',
  'Let me check.',
  // Small talk and readiness.
  'How are you?',
  'How are you doing today?',
  'Shall we start?',
  'Are you ready?',
  "Okay, so let's begin.",
  "Let's get started.",
  "Let's move to the next question.",
  'Is this a good time to talk?',
  'Where are you joining from?',
  // Interviewer narration and pre-announcements.
  'Basically, we are a fintech company and the team works mostly on payments.',
  'Okay, so basically what we do here is build payment APIs.',
  "We'll get back to you.",
  'The next round will be with the manager.',
  'So we have three rounds: technical, managerial and HR.',
  'We are looking for someone with React experience.',
  'Our stack is React, Node and AWS.',
  "I'm going to ask you a few questions on Java.",
  'Let me tell you about the role.',
  "I'll explain the interview process.",
  // Non-English speech and garbled transcripts.
  'Membantu',
  'rompega',
  'Obko kunsi basha main baitkarna pasand hai? Hindi ya English?',
  'Mi peru enti? Mi ru ekita nunci mat laji tuneru?',
  'mi ruweala un naru mi ku e e basi lo mat la dotom e sitama.',
  'नमस्ते, मेरो नाम लिरा है, मेन रकी कलेज एसई बाटकार रहीँ हूँ।',
  'Skai ir ne svarbneties niustips nervis Danielpskoyinich.',
  "Qu'est-ce que tu viens de discuter ?",
  '卡夫卡',
  '마리보',
  'ChatGPT',
  'ChatGPT, can you hear me?',
  'Interview question JavaScript Python React Node.js SAP SQL API.',
];

// Transcripts the transcribe API marked as misheard (calibrated on real gpt-4o-mini-transcribe output).
const SKIP_WHEN_UNCLEAR = [
  'So then, what you have done in the offering of it, and what is your debt?',
  'What is your most disputed ad on CDC?',
  'I am here to defend from Rocky College.',
  'Can you explain me the difference between usable and usableback?',
  'What is the difference between new and new contact?',
];

const failures = [];
for (const text of SHOULD_ANSWER) {
  if (!autoAnswers(text)) failures.push(`should answer: ${text}  [${classifyVoicePrompt(text)}]`);
}
for (const text of SHOULD_SKIP) {
  if (autoAnswers(text)) failures.push(`should skip:   ${text}  [${classifyVoicePrompt(text)}]`);
}
for (const text of SKIP_WHEN_UNCLEAR) {
  if (autoAnswers(text, { clarity: 'unclear' })) failures.push(`should skip (unclear audio): ${text}`);
  if (!autoAnswers(text, { clarity: 'unclear', systemListen: false })) {
    failures.push(`mic Listen should keep unclear text: ${text}`);
  }
}
if (autoAnswers('What is React?', { clarity: 'garbled', systemListen: false })) {
  failures.push('garbled transcripts must be skipped in every mode');
}

// Microphone Listen keeps its existing behaviour: anything that is not noise is sent.
for (const text of ["Let me share my screen.", 'Okay, so basically what we do here is build payment APIs.']) {
  if (!autoAnswers(text, { systemListen: false })) failures.push(`mic Listen should still send: ${text}`);
}

function tokens(spec) {
  // "Word:-0.1 word:-0.2 ?:0" -> logprob entries with gpt-4o style leading spaces.
  return spec.split(' ').map((pair, i) => {
    const at = pair.lastIndexOf(':');
    const text = pair.slice(0, at);
    const glued = /^[^\p{L}\p{N}]/u.test(text) || text.startsWith('~');
    return { token: `${i && !glued ? ' ' : ''}${text.replace(/^~/, '')}`, logprob: Number(pair.slice(at + 1)) };
  });
}

const CLARITY_CASES = [
  // Real API output: clean, accented-with-jargon, misheard, and gibberish transcripts.
  ['Which language would you be comfortable with?', 'Which:0 language:0 would:0 you:0 be:0 comfortable:0 with:0 ?:0', 'clear'],
  ['Can you explain me the difference between useMemo and useCallback?', 'Can:0 you:0 explain:0 me:-0.53 the:0 difference:0 between:0 use:-0.9 ~Memo:-0.8 and:0 use:0 ~Callback:0 ?:-0.01', 'clear'],
  ['What is the difference between useMemo and useCallback?', 'What:0 is:0 the:0 difference:0 between:0 use:0 ~Memo:0 and:0 use:0 ~Callback:0 ?:0', 'clear'],
  ['Basically, we have only English available.', 'Basically:-0.06 ,:-0.52 we:0 have:0 only:0 English:0 available:-0.02 .:-0.48', 'clear'],
  ['What is your most disputed ad on CDC?', 'What:-0.01 is:0 your:-0.01 most:-0.38 disputed:-0.02 ad:-1.27 on:-0.23 CDC:-0.1 ?:-0.02', 'unclear'],
  ['I am here, and I have descended from Rocky College.', 'I:-0.09 am:-0.01 here:-0.52 ,:-0.84 and:-0.76 I:0 have:-0.05 descended:-0.66 from:0 Rocky:-1.18 College:-0.02 .:0', 'unclear'],
  ['Obko kunci basa main baitkarna pasand hai?', 'Ob:-1.35 ~ko:-0.82 kun:-0.1 ~ci:-0.79 basa:-0.89 main:-0.02 bait:-0.11 ~kar:-0.46 ~na:-0.01 pas:0 ~and:0 hai:-0.01 ?:-0.03', 'unclear'],
  ['What is nothing that is nothing.', 'What:-0.7 is:-0.5 nothing:-0.9 that:-0.6 is:-0.4 nothing:-0.8 .:0', 'garbled'],
  ['Skai ir ne svarbneties', 'Sk:-2.1 ~ai:-1.2 ir:-1.5 ne:-0.9 svarb:-1.4 ~neties:-0.8', 'garbled'],
  ['Kafka', 'Kafka:-1.13', 'clear'],
];

for (const [text, spec, expected] of CLARITY_CASES) {
  const { clarity } = assessTranscription({ text, logprobs: tokens(spec) });
  if (clarity !== expected) failures.push(`clarity ${clarity} != ${expected}: ${text}`);
}

const whisperSilence = assessTranscription({
  text: ' you',
  segments: [{ text: ' you', no_speech_prob: 0.943, avg_logprob: -0.515, compression_ratio: 0.27 }],
});
if (whisperSilence.text || whisperSilence.clarity !== 'garbled') failures.push('whisper-1 "you" on silence must be dropped');
const whisperSpeech = assessTranscription({
  text: ' Which language would you be comfortable with?',
  segments: [{ text: ' Which language would you be comfortable with?', no_speech_prob: 0.348, avg_logprob: -0.47, compression_ratio: 0.87 }],
});
if (whisperSpeech.text !== 'Which language would you be comfortable with?' || whisperSpeech.clarity !== 'clear') {
  failures.push('whisper-1 real speech must be kept');
}

const total = SHOULD_ANSWER.length + SHOULD_SKIP.length + SKIP_WHEN_UNCLEAR.length * 2 + CLARITY_CASES.length + 5;
if (failures.length) {
  console.error(`${failures.length} of ${total} checks failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`All ${total} voice filter checks passed.`);
