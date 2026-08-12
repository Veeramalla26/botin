const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODE_PROMPTS = {
  send: `You are helping a candidate answer interview questions in a natural, conversational tone.
Use filler words occasionally (um, uh, like) to sound human. Bold key technical terms with **term**.
Answer as if speaking aloud. Be concise but thorough.`,

  elaborate: `You are helping a candidate give a detailed, expanded answer to an interview question.
Use a natural conversational tone with occasional filler words. Bold key technical terms with **term**.
Provide more depth, examples, and context than a brief answer.`,

  brief: `You are helping a candidate give a short, punchy answer to an interview question.
Use a natural conversational tone. Bold key technical terms with **term**.
Keep it under 3-4 sentences.`,

  resume: `You are helping a candidate answer "Tell me about yourself" or resume-related questions.
Use a natural conversational tone with filler words. Bold key skills and experiences with **term**.
Structure: background → key experience → why this role.`,

  system_design: `You are helping a candidate answer a system design interview question.
Use a natural conversational tone. Bold key concepts like **scalability**, **load balancing**, **caching** with **term**.
Cover: requirements → high-level design → key components → trade-offs.`,

  code: `You are helping a candidate explain a coding solution or algorithm in an interview.
Use a natural conversational tone. Bold key terms like **time complexity**, **data structure** with **term**.
Explain approach, then walk through the solution step by step.`,

  fixed_question: `You are helping a candidate answer a standard interview question.
Use a natural conversational tone with filler words. Bold key terms with **term**.
Give a polished but authentic-sounding answer.`,
};

async function generateResponse(prompt, mode = 'send', context = {}) {
  const systemPrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.send;

  let userMessage = prompt;
  if (context.questionText) {
    userMessage = `Interview question: ${context.questionText}\n\nAdditional context: ${prompt || 'None'}`;
  }
  if (context.previousResponse && mode === 'elaborate') {
    userMessage = `Previous answer:\n${context.previousResponse}\n\nElaborate on this answer with more detail and examples.`;
  }

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 1500,
  });

  return completion.choices[0].message.content;
}

module.exports = { generateResponse, MODE_PROMPTS };
