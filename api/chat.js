const { createOpenAI } = require('@ai-sdk/openai');
const { streamText, generateText } = require('ai');
const { MODE_PROMPTS, buildUserMessage, inferMode, isFollowUpQuestion } = require('./lib/prompts');
const { resolveOpenAIModel, extractErrorMessage } = require('./lib/openaiModel');

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function beginTextResponse(res) {
  if (res.headersSent) return;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
}

function endResponse(res) {
  if (!res.writableEnded) {
    res.end();
  }
}

function writeChunk(res, chunk) {
  const text = typeof chunk === 'string' ? chunk : String(chunk);
  if (!text) return;
  beginTextResponse(res);
  res.write(text);
  if (typeof res.flush === 'function') {
    res.flush();
  }
}

async function generateFullText(params) {
  const generated = await generateText(params);
  return (generated.text || '').trim();
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
    const {
      prompt,
      mode = 'send',
      questionText,
      previousResponse,
      conversationHistory,
      resumeText,
    } = req.body || {};

    if (!prompt && !questionText) {
      return res.status(400).json({ error: 'prompt or questionText is required' });
    }

    const effectiveMode = inferMode(prompt, mode);
    const followUp = isFollowUpQuestion(prompt);
    const systemPrompt = MODE_PROMPTS[effectiveMode] || MODE_PROMPTS.send;
    const userMessage = buildUserMessage(prompt, effectiveMode, {
      questionText,
      previousResponse,
      conversationHistory,
      resumeText,
    });

    const maxTokens =
      effectiveMode === 'brief' ? 350 : effectiveMode === 'code' ? 900 : effectiveMode === 'send' ? 500 : 800;
    const temperature = followUp ? 0.6 : effectiveMode === 'code' ? 0.65 : effectiveMode === 'brief' ? 0.75 : 0.82;

    const modelParams = {
      model: openai(resolveOpenAIModel()),
      system: systemPrompt,
      prompt: userMessage,
      temperature,
      maxTokens,
      maxRetries: 2,
    };

    let started = false;

    try {
      const result = streamText(modelParams);

      for await (const delta of result.textStream) {
        if (!delta) continue;
        started = true;
        writeChunk(res, delta);
      }
    } catch (streamErr) {
      console.error('Chat stream error:', streamErr);
      if (started) {
        endResponse(res);
        return;
      }
    }

    if (!started) {
      try {
        const text = await generateFullText(modelParams);
        if (!text) {
          return res.status(500).json({
            error:
              'Model returned no output. Set Vercel OPENAI_MODEL to gpt-4o-mini and verify OpenAI billing/credits.',
          });
        }
        writeChunk(res, text);
      } catch (genErr) {
        console.error('Chat generate error:', genErr);
        if (!res.headersSent) {
          return res.status(500).json({ error: extractErrorMessage(genErr) });
        }
        endResponse(res);
        return;
      }
    }

    endResponse(res);
  } catch (err) {
    console.error('Chat API error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: extractErrorMessage(err) });
    }
    endResponse(res);
  }
};
