const API_BASE = '/api';

export async function transcribeAudio(blob, mimeType = 'audio/webm') {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  const audio = btoa(binary);

  const res = await fetch(`${API_BASE}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio, mimeType: mimeType || blob.type || 'audio/webm' }),
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

export async function streamChatResponse(
  { prompt, mode, questionText, previousResponse, conversationHistory },
  onChunk
) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, mode, questionText, previousResponse, conversationHistory }),
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

  if (!res.body) {
    return res.text();
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onChunk(text);
  }

  return text;
}

export function buildHeading(prompt, mode, questionText) {
  if (mode === 'fixed_question' && questionText) {
    return `[Fixed Question] ${questionText}`;
  }
  const text = prompt || questionText || '';
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}
