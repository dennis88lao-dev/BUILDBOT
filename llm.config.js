// ONE place to switch the AI provider. In Vercel, set LLM_PROVIDER = gemini (default) or anthropic.
// Optional: set LLM_MODEL to override the model name without touching code.
const provider = process.env.LLM_PROVIDER || 'gemini';
const D = {
  gemini: { model: 'gemini-3-flash-preview', keyEnv: 'GEMINI_API_KEY' },
  anthropic: { model: 'claude-sonnet-5-5', keyEnv: 'ANTHROPIC_API_KEY' },
};
export default { provider, model: process.env.LLM_MODEL || D[provider].model, keyEnv: D[provider].keyEnv };
