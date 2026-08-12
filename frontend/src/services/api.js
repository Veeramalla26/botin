const API_BASE = '/api';

export async function transcribeAudio(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const audio = btoa(binary);

  const res = await fetch(`${API_BASE}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio, mimeType: blob.type || 'audio/webm' }),
  });

  if (!res.ok) {
    const body = await res.text();
    let message = 'Transcription failed';
    try {
      const err = JSON.parse(body);
      message = err.error || message;
    } catch {
      message = body || message;
    }
    throw new Error(message);
  }

  const data = await res.json();
  return data.text || '';
}

export async function generateChatResponse({ prompt, mode, questionText, previousResponse }) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, mode, questionText, previousResponse }),
  });

  if (!res.ok) {
    const body = await res.text();
    let message = 'Generation failed';
    try {
      const err = JSON.parse(body);
      message = err.error || message;
    } catch {
      message = body || message;
    }
    throw new Error(message);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    return data.response || data.text || '';
  }

  return res.text();
}

export function buildHeading(prompt, mode, questionText) {
  if (mode === 'fixed_question' && questionText) {
    return `[Fixed Question] ${questionText}`;
  }
  const text = prompt || questionText || '';
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}
