const FALLBACK_MODEL = 'gpt-4o-mini';

const DEPRECATED_MODELS = new Set([
  'gpt-4.1-nano-2025-04-14',
]);

function resolveOpenAIModel() {
  const configured = (process.env.OPENAI_MODEL || FALLBACK_MODEL).trim();
  if (!configured || DEPRECATED_MODELS.has(configured)) {
    if (configured && DEPRECATED_MODELS.has(configured)) {
      console.warn(`OPENAI_MODEL "${configured}" is deprecated; using ${FALLBACK_MODEL}`);
    }
    return FALLBACK_MODEL;
  }
  return configured;
}

module.exports = {
  resolveOpenAIModel,
  FALLBACK_MODEL,
};
