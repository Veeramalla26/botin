const SPURIOUS_PHRASES = new Set([
  'thank you',
  'thanks',
  'thank u',
  'thankyou',
  'thank',
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
  'welcome',
  'please',
  'sorry',
  'excuse me',
  'pardon',
]);

function normalizeTranscript(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSpuriousTranscript(text) {
  const normalized = normalizeTranscript(text);
  if (!normalized) return true;

  if (SPURIOUS_PHRASES.has(normalized)) {
    return true;
  }

  const wordCount = normalized.split(' ').length;
  const hasQuestion = /[?]/.test(text) || /\b(what|why|how|when|where|who|which|can|could|would|should|do|does|did|is|are|was|were|tell|describe|explain|have|has|had)\b/i.test(normalized);

  if (!hasQuestion && wordCount <= 3 && normalized.length <= 24) {
    return true;
  }

  if (!hasQuestion && normalized.length <= 6) {
    return true;
  }

  return false;
}
