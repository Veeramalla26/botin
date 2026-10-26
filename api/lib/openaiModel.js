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

function extractErrorMessage(err) {
  if (!err) return 'Request failed';
  if (err.lastError?.message) return err.lastError.message;
  if (Array.isArray(err.errors) && err.errors.length) {
    const last = err.errors[err.errors.length - 1];
    if (last?.message) return last.message;
  }
  if (typeof err.message === 'string' && err.message.trim()) return err.message.trim();
  return 'Request failed';
}

module.exports = {
  resolveOpenAIModel,
  extractErrorMessage,
  FALLBACK_MODEL,
};
