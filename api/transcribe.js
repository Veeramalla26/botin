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

    const isWav = mimeType.includes('wav');
    const filename = isWav ? 'speech.wav' : 'speech.webm';

    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: isWav ? 'audio/wav' : mimeType }), filename);
    formData.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'json');
    formData.append('temperature', '0');
    formData.append(
      'prompt',
      process.env.WHISPER_PROMPT ||
        'Job interview question. Technical terms: JavaScript, Python, React, Node.js, SAP, SQL, API, cloud, system design.'
    );

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Whisper API error:', errBody);
      return res.status(500).json({ error: 'Transcription failed' });
    }

    const data = await response.json();
    const text = (data.text || '').trim();
    return res.status(200).json({ text });
  } catch (err) {
    console.error('Transcribe API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to transcribe audio' });
  }
};
