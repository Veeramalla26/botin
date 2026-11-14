// Scores how sure the transcribe model was about what it heard, so garbled Meet audio,
// other languages, or background chatter are not passed on as interview questions.

// Average token logprob over ordinary words. Clean and accented questions score 0 to -0.17;
// misheard audio ("What is your most disputed ad on CDC?") scores -0.23 and below.
const UNCLEAR_AVG_LOGPROB = -0.22;
const GARBLED_AVG_LOGPROB = -0.5;
// One or two tokens swing a lot, so short transcripts need a lower average to be flagged.
const SHORT_UNCLEAR_AVG_LOGPROB = -0.45;
const SHORT_GARBLED_AVG_LOGPROB = -1;
const MIN_TOKENS_FOR_AVERAGE = 4;

// whisper-1 reports these per segment in verbose_json; it invents "you" or ". . ." on silence.
const WHISPER_NO_SPEECH_PROB = 0.6;
const WHISPER_NO_SPEECH_MAX_LOGPROB = -0.3;
const WHISPER_MIN_AVG_LOGPROB = -1.1;
const WHISPER_MAX_COMPRESSION_RATIO = 2.4;

const FILLER_WORDS = new Set(['um', 'umm', 'uh', 'uhm', 'erm', 'er', 'ah', 'eh', 'oh', 'hmm', 'hm', 'mm', 'mhm']);

function supportsLogprobs(model = '') {
  return model !== 'whisper-1' && !/diarize/.test(model);
}

// Names and tech terms (useMemo, AWS, Node.js, C#, S3, Kubernetes mid-sentence) are often
// spelled uncertainly even when heard correctly, so they do not count against the transcript.
function isNameOrJargon(word) {
  const text = word.text;
  if (/[a-z][A-Z]/.test(text)) return true;
  if (/\d/.test(text)) return true;
  if (/^[A-Z]{2,}s?$/.test(text)) return true;
  if (/[#+.]/.test(text)) return true;
  return !word.sentenceStart && /^[A-Z][a-z]/.test(text);
}

function groupTokensIntoWords(logprobs) {
  const words = [];
  let current = null;
  let sentenceStart = true;

  for (const entry of logprobs) {
    const token = typeof entry?.token === 'string' ? entry.token : '';
    const piece = token.trim();
    if (!piece || typeof entry.logprob !== 'number') continue;

    if (!/[\p{L}\p{N}]/u.test(piece)) {
      // Punctuation confidence says nothing about the words that were heard.
      if (/[.?!]/.test(piece)) sentenceStart = true;
      continue;
    }

    if (!current || /^\s/.test(token)) {
      current = { text: '', logprobs: [], sentenceStart };
      words.push(current);
      sentenceStart = false;
    }
    current.text += piece;
    current.logprobs.push(entry.logprob);
  }

  return words;
}

function assessTokenLogprobs(logprobs, text) {
  const words = groupTokensIntoWords(logprobs);
  // A lone word ("Kafka") is often scored low even when heard right; the app's
  // single-word rules decide those instead.
  if (words.length <= 1) {
    return { text, clarity: 'clear' };
  }

  const counted = words.filter(
    (word) => !isNameOrJargon(word) && !FILLER_WORDS.has(word.text.toLowerCase())
  );
  const values = counted.flatMap((word) => word.logprobs);
  if (!values.length) {
    return { text, clarity: 'clear' };
  }

  const avgLogprob = values.reduce((sum, value) => sum + value, 0) / values.length;
  const enoughTokens = values.length >= MIN_TOKENS_FOR_AVERAGE;
  let clarity = 'clear';

  if (avgLogprob < SHORT_GARBLED_AVG_LOGPROB || (enoughTokens && avgLogprob < GARBLED_AVG_LOGPROB)) {
    clarity = 'garbled';
  } else if (avgLogprob < SHORT_UNCLEAR_AVG_LOGPROB || (enoughTokens && avgLogprob < UNCLEAR_AVG_LOGPROB)) {
    clarity = 'unclear';
  }

  return { text, clarity, avgLogprob: Number(avgLogprob.toFixed(3)) };
}

function assessWhisperSegments(segments, text) {
  const kept = segments.filter((segment) => {
    const noSpeech = Number(segment?.no_speech_prob) || 0;
    const avgLogprob = Number(segment?.avg_logprob) || 0;
    const compression = Number(segment?.compression_ratio) || 0;
    if (noSpeech > WHISPER_NO_SPEECH_PROB && avgLogprob < WHISPER_NO_SPEECH_MAX_LOGPROB) return false;
    if (avgLogprob < WHISPER_MIN_AVG_LOGPROB) return false;
    return compression <= WHISPER_MAX_COMPRESSION_RATIO;
  });

  if (kept.length === segments.length) {
    return { text, clarity: 'clear' };
  }

  const keptText = kept
    .map((segment) => segment.text || '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return keptText ? { text: keptText, clarity: 'clear' } : { text: '', clarity: 'garbled' };
}

function assessTranscription(data) {
  const text = String(data?.text || '').trim();
  if (!text) return { text: '', clarity: 'clear' };

  if (Array.isArray(data.segments) && data.segments.length) {
    return assessWhisperSegments(data.segments, text);
  }
  if (Array.isArray(data.logprobs) && data.logprobs.length) {
    return assessTokenLogprobs(data.logprobs, text);
  }
  return { text, clarity: 'clear' };
}

module.exports = {
  assessTranscription,
  supportsLogprobs,
};
