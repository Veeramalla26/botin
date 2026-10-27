const { assessTranscription, supportsLogprobs } = require('./lib/transcriptClarity');

const FAST_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';
const FALLBACK_TRANSCRIBE_MODEL = 'whisper-1';

let logprobsRejected = false;

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function buildForm(bytes, filename, contentType, model, withLogprobs) {
  const formData = new FormData();
  if (typeof File !== 'undefined') {
    formData.append('file', new File([bytes], filename, { type: contentType }));
  } else {
    formData.append('file', new Blob([bytes], { type: contentType }), filename);
  }
  formData.append('model', model);
  formData.append('language', 'en');
  // whisper-1 only reports per-segment no-speech and confidence scores in verbose_json.
  formData.append('response_format', model === FALLBACK_TRANSCRIBE_MODEL ? 'verbose_json' : 'json');
  formData.append('temperature', '0');
  if (withLogprobs) {
    formData.append('include[]', 'logprobs');
  }
  const vocabHint = (process.env.WHISPER_PROMPT || '').trim();
  if (vocabHint) {
    formData.append('prompt', vocabHint);
  }
  return formData;
}

function shouldFallbackModel(status, body) {
  if (status === 404) return true;
  const msg = String(body || '').toLowerCase();
  return (
    msg.includes('model') &&
    (msg.includes('not found') || msg.includes('does not exist') || msg.includes('invalid_model') || msg.includes('unsupported'))
  );
}

function rejectedLogprobs(status, body) {
  const msg = String(body || '').toLowerCase();
  return status === 400 && (msg.includes('logprobs') || msg.includes('include'));
}

async function postTranscription(bytes, filename, contentType, model, withLogprobs) {
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: buildForm(bytes, filename, contentType, model, withLogprobs),
  });
  const body = await response.text();
  return { response, body };
}

async function transcribeBuffer(bytes, filename, contentType, model) {
  const withLogprobs = !logprobsRejected && supportsLogprobs(model);
  let result = await postTranscription(bytes, filename, contentType, model, withLogprobs);

  if (withLogprobs && !result.response.ok && rejectedLogprobs(result.response.status, result.body)) {
    console.warn(`Transcribe model "${model}" rejected logprobs; transcribing without confidence scores`);
    logprobsRejected = true;
    result = await postTranscription(bytes, filename, contentType, model, false);
  }

  return result;
}

module.exports = async (req, res) => {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server' });
  }

  try {
    const { audio, mimeType = 'audio/webm' } = req.body || {};

    if (!audio) {
      return res.status(400).json({ error: 'audio is required (base64)' });
    }

    const buffer = Buffer.from(audio, 'base64');
    if (buffer.length < 2000) {
      return res.status(200).json({ text: '' });
    }

    const isWav = mimeType.includes('wav');
    const filename = isWav ? 'speech.wav' : 'speech.webm';
    const contentType = isWav ? 'audio/wav' : mimeType || 'audio/webm';
    const bytes = new Uint8Array(buffer);
    const preferred = (process.env.OPENAI_TRANSCRIBE_MODEL || FAST_TRANSCRIBE_MODEL).trim();

    let { response, body } = await transcribeBuffer(bytes, filename, contentType, preferred);

    if (!response.ok && preferred !== FALLBACK_TRANSCRIBE_MODEL && shouldFallbackModel(response.status, body)) {
      console.warn(`Transcribe model "${preferred}" unavailable; falling back to ${FALLBACK_TRANSCRIBE_MODEL}`);
      ({ response, body } = await transcribeBuffer(bytes, filename, contentType, FALLBACK_TRANSCRIBE_MODEL));
    }

    if (!response.ok) {
      console.error('Whisper API error:', body);
      return res.status(500).json({ error: 'Transcription failed' });
    }

    let data = {};
    try {
      data = JSON.parse(body);
    } catch {
      data = { text: body };
    }
    const heard = (data.text || '').trim();
    const { text, clarity, avgLogprob } = assessTranscription(data);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 10 && buffer.length / wordCount < 320) {
      console.warn('Skipping likely transcribe hallucination', {
        bytes: buffer.length,
        wordCount,
        text: text.slice(0, 120),
      });
      return res.status(200).json({ text: '' });
    }
    if (clarity === 'garbled') {
      console.warn('Skipping garbled transcription', { avgLogprob, text: heard.slice(0, 120) });
      return res.status(200).json({ text: '', clarity: 'garbled', heard });
    }
    return res.status(200).json({ text, clarity });
  } catch (err) {
    console.error('Transcribe API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to transcribe audio' });
  }
};
