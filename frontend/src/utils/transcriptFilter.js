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
    /\b(what|why|how|when|where|who|which|can|could|would|should|do|does|did|is|are|was|were|tell|describe|explain|have|has|had|walk|talk|share|give|list|name|define|compare|walk me through)\b/i.test(
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
    if (sentenceCounts.get(sentence) >= 2) {
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

export function isSpuriousTranscript(text) {
  const normalized = normalizeTranscript(text);
  if (!normalized) return true;

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

  if (hasExcessiveRepetition(normalized)) {
    return true;
  }

  const wordCount = normalized.split(' ').length;

  if (!hasQuestion && wordCount <= 3 && normalized.length <= 24) {
    return true;
  }

  if (!hasQuestion && normalized.length <= 6) {
    return true;
  }

  if (
    !hasQuestion &&
    wordCount <= 8 &&
    /^(thank|thanks|welcome|hello|hi|hey|good|nice|great|pleasure)\b/.test(normalized)
  ) {
    return true;
  }

  return false;
}

export function shouldProcessVoiceTranscript(text, { systemListen = false } = {}) {
  if (isSpuriousTranscript(text)) {
    return false;
  }

  const normalized = normalizeTranscript(text);

  if (systemListen && !hasQuestionIntent(text, normalized)) {
    return false;
  }

  if (systemListen && normalized.split(' ').length < 3) {
    return false;
  }

  return true;
}
