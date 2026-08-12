const { createOpenAI } = require('@ai-sdk/openai');
const { generateText } = require('ai');
const { MODE_PROMPTS, buildUserMessage } = require('./lib/prompts');

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
    const { prompt, mode = 'send', questionText, previousResponse } = req.body || {};

    if (!prompt && !questionText) {
      return res.status(400).json({ error: 'prompt or questionText is required' });
    }

    const systemPrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.send;
    const userMessage = buildUserMessage(prompt, mode, { questionText, previousResponse });

    const { text } = await generateText({
      model: openai(process.env.OPENAI_MODEL || 'gpt-4o-mini'),
      system: systemPrompt,
      prompt: userMessage,
      temperature: 0.7,
      maxTokens: 1500,
    });

    return res.status(200).send(text);
  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate response' });
  }
};
