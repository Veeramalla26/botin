const DEFAULT_TRANSCRIBE_MODELS = [
  'gpt-4o-mini-transcribe-2025-12-15',
  'gpt-4o-mini-transcribe',
  'whisper-1',
];

function parseOpenAIError(body) {
  try {
    const data = JSON.parse(body);
    return data?.error?.message || data?.message || '';
  } catch {
    return String(body || '').slice(0, 300);
  }
}

function transcribeModelsToTry() {
  const fromEnv = (process.env.OPENAI_TRANSCRIBE_MODEL || '').trim();
  const ordered = fromEnv ? [fromEnv] : [];
  for (const model of DEFAULT_TRANSCRIBE_MODELS) {
    if (model !== fromEnv) ordered.push(model);
  }
  return ordered;
}

function shouldTryNextModel(status, body) {
  if (status === 403 || status === 404) return true;
  const msg = String(body || '').toLowerCase();
  if (msg.includes('does not have access to model')) return true;
  if (msg.includes('model') && (msg.includes('not found') || msg.includes('invalid'))) {
    return true;
  }
  return false;
}

function buildFormData(buffer, mimeType) {
  const isWav = mimeType.includes('wav');
  const filename = isWav ? 'speech.wav' : 'speech.webm';
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: isWav ? 'audio/wav' : mimeType }), filename);
  formData.append('language', 'en');
  formData.append('response_format', 'json');
  formData.append('temperature', '0');
  formData.append(
    'prompt',
    process.env.WHISPER_PROMPT ||
      'Job interview question. Technical terms: JavaScript, Python, React, Node.js, SAP, SQL, API, cloud, system design.'
  );
  return { formData, filename };
}

async function requestTranscription(buffer, mimeType, model) {
  const { formData } = buildFormData(buffer, mimeType);
  formData.append('model', model);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  const body = await response.text();
  return { response, body };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

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

    const models = transcribeModelsToTry();
    let lastResponse;
    let lastBody;

    for (let i = 0; i < models.length; i += 1) {
      const model = models[i];
      const { response, body } = await requestTranscription(buffer, mimeType, model);
      if (response.ok) {
        let data = {};
        try {
          data = JSON.parse(body);
        } catch {
          data = { text: body };
        }
        const text = (data.text || '').trim();
        return res.status(200).json({ text });
      }

      lastResponse = response;
      lastBody = body;

      const hasNext = i < models.length - 1;
      if (!hasNext || !shouldTryNextModel(response.status, body)) {
        break;
      }
      console.warn(`Transcribe model "${model}" failed (${response.status}); trying ${models[i + 1]}`);
    }

    console.error('OpenAI transcription error:', lastBody);
    const detail = parseOpenAIError(lastBody);
    return res.status(500).json({
      error: detail ? `Transcription failed: ${detail}` : 'Transcription failed',
    });
  } catch (err) {
    console.error('Transcribe API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to transcribe audio' });
  }
};
