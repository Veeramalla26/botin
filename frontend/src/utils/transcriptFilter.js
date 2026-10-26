const SPURIOUS_PHRASES = new Set([
  'thank you',
  'thanks',
  'thank u',
  'thankyou',
  'thank',
  'thank you for joining us',
  'thanks for joining us',
  'thank you for your time',
  'thanks for your time',
  'thank you for listening',
  'thanks for listening',
  'thank you so much',
  'thanks so much',
  'thanks for having me',
  'thank you for having me',
  'nice to meet you',
  'good to meet you',
  'pleasure to meet you',
  'great to meet you',
  'good morning',
  'good afternoon',
  'good evening',
  'welcome',
  'welcome everyone',
  'have a good day',
  'have a nice day',
  'have a great day',
  'take care',
  'see you later',
  'see you soon',
  'looking forward to it',
  'meet google com is sharing a window',
  'sharing meet google com to this tab',
  'sharing this tab to',
  'sharing a window',
  'speech detected',
  'transcribing',
  'ok',
  'okay',
  'k',
  'yeah',
  'yep',
  'yes',
  'no',
  'nope',
  'hmm',
  'hm',
  'um',
  'uh',
  'uh huh',
  'uh-huh',
  'right',
  'sure',
  'got it',
  'mm hmm',
  'mm-hmm',
  'mhm',
  'hello',
  'hi',
  'hey',
  'bye',
  'goodbye',
  'see you',
  'you',
  'great',
  'perfect',
  'cool',
  'nice',
  'alright',
  'all right',
  'sounds good',
  'i see',
  'understood',
  'noted',
  'please',
  'sorry',
  'excuse me',
  'pardon',
  'interview question javascript python react node js sap sql api',
  'interview question javascript python react nodejs sap sql api',
  'job interview question technical terms javascript python react node js sap sql api cloud system design',
  'chatgpt can you hear me',
  'chat gpt can you hear me',
  'chatgpt can you hear me?',
  'can you hear me',
  'can you hear me chatgpt',
  'hello chatgpt',
  'hey chatgpt',
  'hi chatgpt',
  'chatgpt',
  'chat gpt',
  'are you there',
  'are you listening',
  'testing testing',
  'test test',
  'check check',
  'hello hello',
]);

const SPURIOUS_PREFIXES = [
  'thank you for',
  'thanks for',
  'thank you so much',
  'thanks so much',
  'good morning',
  'good afternoon',
  'good evening',
  'nice to meet',
  'good to meet',
  'pleasure to meet',
  'great to meet',
  'welcome to',
  'welcome everyone',
  'hello everyone',
  'hi everyone',
  'hey everyone',
  'have a good',
  'have a nice',
  'have a great',
  'looking forward',
  'i appreciate',
  'appreciate your',
  'thanks everyone',
  'thank you everyone',
  'my name is',
  'i am a software engineer',
  'i m a software engineer',
  'i m here to talk',
  'i m here to',
  'meet google com is sharing',
  'sharing this tab to',
  'sharing a window',
  'you re welcome',
  "you're welcome",
  'interview question javascript',
  'job interview question',
  'chatgpt',
  'chat gpt',
  'hello chatgpt',
  'hey chatgpt',
  'hi chatgpt',
  'okay chatgpt',
  'can you hear me',
];

const CLOSING_PATTERNS = [
  /^thank you\b/,
  /^thanks\b/,
  /^good (morning|afternoon|evening)\b/,
  /^nice to meet\b/,
  /^good to meet\b/,
  /^pleasure to meet\b/,
  /^great to meet\b/,
  /^welcome\b/,
  /^i appreciate\b/,
  /^appreciate it\b/,
  /^joining us\b/,
  /^for joining\b/,
  /^you re welcome\b/,
  /^you're welcome\b/,
];

const PRESENTATION_PREFIXES = [
  'hello everyone',
  'hi everyone',
  'hey everyone',
  'welcome to this webinar',
  'welcome to the webinar',
  'welcome to today s',
  'in this video',
  'in today s video',
  'today we will',
  'today i will',
  'let s get started',
  'without further ado',
];

export function normalizeTranscript(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasQuestionIntent(text, normalized = normalizeTranscript(text)) {
  return (
    /[?]/.test(text) ||
    /\b(what|why|how|when|where|who|which|can|could|would|should|do|does|did|is|are|was|were|tell|describe|explain|have|has|had|walk|talk|share|give|list|name|define|compare|discuss|introduce|implement|versus|vs|write|program|code|function|algorithm|example|sort|search|walk me through|tell me|talk about|difference between|example of|your experience)\b/i.test(
      normalized
    )
  );
}

function hasExcessiveRepetition(normalized) {
  if (!normalized) return false;

  const sentences = normalized
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);

  const sentenceCounts = new Map();
  for (const sentence of sentences) {
    sentenceCounts.set(sentence, (sentenceCounts.get(sentence) || 0) + 1);
    // Interviewers often repeat a question once; drop only webinar-style loops.
    if (sentenceCounts.get(sentence) >= 3) {
      return true;
    }
  }

  const words = normalized.split(' ');
  if (words.length < 16) return false;

  for (let size = 4; size <= 8; size += 1) {
    const phraseCounts = new Map();
    for (let i = 0; i <= words.length - size; i += 1) {
      const phrase = words.slice(i, i + size).join(' ');
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
      if (phraseCounts.get(phrase) >= 3) {
        return true;
      }
    }
  }

  return false;
}

function isWhisperHintHallucination(normalized) {
  if (!normalized) return false;
  if (normalized.startsWith('interview question javascript')) return true;
  if (normalized.startsWith('job interview question')) return true;
  if (normalized.startsWith('interview question') && /\bjavascript\b/.test(normalized) && /\bpython\b/.test(normalized) && /\breact\b/.test(normalized)) {
    return true;
  }
  if (/\b(chatgpt|chat gpt|openai|gpt-?4)\b/.test(normalized)) return true;
  if (/\bcan you hear me\b/.test(normalized)) return true;
  if (/\bare you (there|listening|working|ready)\b/.test(normalized)) return true;
  if (/^(testing|test test|check check|hello hello)\b/.test(normalized)) return true;

  const hintTerms = ['javascript', 'python', 'react', 'sap', 'sql', 'api'];
  const hits = hintTerms.filter((term) => normalized.includes(term)).length;
  const words = normalized.split(' ').filter(Boolean);
  return hits >= 5 && words.length <= 22;
}

export function isSpuriousTranscript(text) {
  const normalized = normalizeTranscript(text);
  if (!normalized) return true;

  if (isWhisperHintHallucination(normalized)) {
    return true;
  }

  if (SPURIOUS_PHRASES.has(normalized)) {
    return true;
  }

  if (SPURIOUS_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }

  if (PRESENTATION_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }

  const hasQuestion = hasQuestionIntent(text, normalized);

  if (!hasQuestion && CLOSING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (!hasQuestion && hasExcessiveRepetition(normalized)) {
    return true;
  }

  const wordCount = normalized.split(' ').filter(Boolean).length;

  if (
    !hasQuestion &&
    wordCount <= 8 &&
    /^(thank|thanks|welcome|hello|hi|hey|good|nice|great|pleasure)\b/.test(normalized)
  ) {
    return true;
  }

  return false;
}

const CONTINUATION_PREFIX =
  /^(of|and|or|for|in|on|with|using|like|about|from|to|the|a|an|it|this|that|also|then|now|please|just|same)\b/;

export function looksIncompleteQuestion(text) {
  const normalized = normalizeTranscript(text);
  if (!normalized) return true;
  if (/[?]/.test(text)) return false;
  if (/\b(of|a|an|the|and|or|for|about|asking)$/.test(normalized)) {
    return true;
  }
  const words = normalized.split(' ').filter(Boolean);
  return (
    words.length <= 3 &&
    /^(write|tell|give|example|program|code|explain|i am asking|i m asking|can you|could you|please)\b/.test(
      normalized
    )
  );
}

export function isVoiceContinuation(previous, next) {
  const prev = normalizeTranscript(previous);
  const nextN = normalizeTranscript(next);
  if (!prev || !nextN) return false;
  if (nextN === prev) return true;
  if (prev.includes(nextN) || nextN.includes(prev)) return true;

  const nextWords = nextN.split(' ').filter(Boolean).length;
  if (nextWords > 12) return false;
  if (CONTINUATION_PREFIX.test(nextN) && nextWords <= 10) return true;
  if (looksIncompleteQuestion(previous) && nextWords <= 10) return true;
  if (/\b(it|this|that|same|previous)\b/.test(nextN) && nextWords <= 10) return true;
  return false;
}

export function mergeVoiceTranscripts(previous, next) {
  const prev = (previous || '').trim();
  const nxt = (next || '').trim();
  if (!prev) return nxt;
  if (!nxt) return prev;
  const prevN = normalizeTranscript(prev);
  const nextN = normalizeTranscript(nxt);
  if (prevN.includes(nextN)) return prev;
  if (nextN.includes(prevN)) return nxt;
  return `${prev} ${nxt}`.replace(/\s+/g, ' ');
}

export function shouldProcessVoiceTranscript(text, { systemListen = false } = {}) {
  if (isSpuriousTranscript(text)) {
    return false;
  }

  const normalized = normalizeTranscript(text);
  const wordCount = normalized.split(' ').filter(Boolean).length;

  if (wordCount >= 2) {
    return true;
  }

  // Allow a single technical term ("Python", "React") but not filler already in SPURIOUS_PHRASES.
  if (wordCount === 1 && normalized.length >= 4) {
    return true;
  }

  if (systemListen) {
    return false;
  }

  return normalized.length >= 3;
}
