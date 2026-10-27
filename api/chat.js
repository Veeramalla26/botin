const { createOpenAI } = require('@ai-sdk/openai');
const { streamText } = require('ai');
const { MODE_PROMPTS, buildUserMessage, inferMode, isFollowUpQuestion } = require('./lib/prompts');

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    const result = streamText({
      model: openai(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
      system: systemPrompt,
      prompt: userMessage,
      temperature,
      maxTokens,
    });

    result.pipeTextStreamToResponse(res);
  } catch (err) {
    console.error('Chat API error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || 'Failed to generate response' });
    }
  }
};
