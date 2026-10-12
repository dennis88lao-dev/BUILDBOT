import { DB, CATS, byId, validateBuild, okWith, optimize, total } from '../public/core.js';
import CFG from '../llm.config.js';

const SYS = `You are BuildBot, a friendly PC building expert. You ONLY recommend parts that exist in the database via your tools, never invent parts or prices. Before recommending, ask about: budget, main use (gaming, editing, streaming, general), target resolution/FPS, and any parts they already want. If the user names a must-have part (e.g. 'I want an RTX 5070 under $2000'), lock that part in first (search_parts then add_to_build), then build the best compatible system around it that fits the remaining budget (get_compatible_parts, or optimize_for_budget with must_have_part_ids). Always run validate_build before presenting a final build. Explain every pick in one sentence in plain English. If the budget is unrealistic, say so honestly and offer tradeoffs (e.g. a cheaper GPU tier or smaller case). Always state your assumptions and show the total price (budgets include sales tax). Never claim a build is compatible unless validate_build passed. Ask before sending any email; only call send_build_email after the user agrees and gives an address. Be concise.`;

const catEnum = { type: 'string', enum: CATS };
const TOOLS = [
  { name: 'search_parts', description: 'Search the parts database. Returns up to 8 parts sorted by price.', parameters: { type: 'object', properties: { category: catEnum, max_price: { type: 'number' }, min_price: { type: 'number' }, brand: { type: 'string' }, query: { type: 'string', description: 'text in part name, e.g. 5070' }, socket: { type: 'string' } }, required: ['category'] } },
  { name: 'get_compatible_parts', description: 'Parts in a category that are compatible with the current build.', parameters: { type: 'object', properties: { category: catEnum }, required: ['category'] } },
  { name: 'add_to_build', description: 'Add or replace a part (by id) in its category slot.', parameters: { type: 'object', properties: { category: catEnum, part_id: { type: 'string' } }, required: ['category', 'part_id'] } },
  { name: 'remove_from_build', description: 'Remove the part in a category.', parameters: { type: 'object', properties: { category: catEnum }, required: ['category'] } },
  { name: 'validate_build', description: 'Run the deterministic compatibility engine on the current build.' },
  { name: 'optimize_for_budget', description: 'Auto-generate and load a full compatible build for a budget (tax included).', parameters: { type: 'object', properties: { budget: { type: 'number' }, use_case: { type: 'string', enum: ['gaming', 'editing', 'streaming', 'general'] }, must_have_part_ids: { type: 'array', items: { type: 'string' } } }, required: ['budget'] } },
  { name: 'send_build_email', description: 'Show the user an email confirmation dialog. Only after the user agreed.', parameters: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] } },
];

const sum = (p) => { const { image_url, purchase_url, category, ...r } = p; return r; };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const { messages = [], build: ids = {}, budget = 1500, tax = 8.5 } = req.body || {};
    const key = process.env[CFG.keyEnv];
    if (!key) return res.status(500).json({ error: `Missing ${CFG.keyEnv}. Add it in Vercel → Settings → Environment Variables, then redeploy.` });
    const st = { build: {}, budget, tax, email: null };
    for (const [c, id] of Object.entries(ids)) { const p = byId(id); if (p && p.category === c) st.build[c] = p; }
    const T = {
      search_parts: (a) => DB[a.category].filter((p) => (!a.max_price || p.price <= a.max_price) && (!a.min_price || p.price >= a.min_price) && (!a.brand || p.brand?.toLowerCase() === a.brand.toLowerCase()) && (!a.query || p.name.toLowerCase().includes(a.query.toLowerCase())) && (!a.socket || p.socket === a.socket || p.supported_sockets?.includes(a.socket))).sort((x, y) => x.price - y.price).slice(0, 8).map(sum),
      get_compatible_parts: (a) => DB[a.category].filter((p) => okWith(st.build, a.category, p)).map(sum),
      add_to_build: (a) => { const p = byId(a.part_id); if (!p || p.category !== a.category) throw new Error('Unknown part_id for that category'); st.build[a.category] = p; const v = validateBuild(st.build); return { added: p.name, errors: v.errors.map((x) => x.msg), total_with_tax: +total(st.build, st.tax).toFixed(2) }; },
      remove_from_build: (a) => { delete st.build[a.category]; return 'removed'; },
      validate_build: () => { const v = validateBuild(st.build); return { verified: v.verified, complete: v.complete, errors: v.errors.map((x) => x.msg), warnings: v.warnings, total_with_tax: +total(st.build, st.tax).toFixed(2), budget: st.budget }; },
      optimize_for_budget: (a) => { st.budget = a.budget; const must = {}; (a.must_have_part_ids || []).forEach((id) => { const p = byId(id); if (p) must[p.category] = id; }); const b = optimize(a.budget, a.use_case || 'gaming', must, st.tax); if (!b) return { error: 'No compatible build fits that budget/constraints. Suggest tradeoffs.' }; st.build = b; const v = validateBuild(b); return { parts: CATS.map((c) => `${c}: ${b[c].name} $${b[c].price}`), verified: v.verified, warnings: v.warnings, total_with_tax: +total(b, st.tax).toFixed(2) }; },
      send_build_email: (a) => { st.email = a.email; return 'Confirmation dialog shown to the user. Do NOT say the email was sent; tell them to click Confirm.'; },
    };
    const act = [];
    const run = (n, a) => { let r; try { r = T[n](a || {}); } catch (e) { r = { error: e.message }; } act.push(`${n}(${Object.values(a || {}).join(', ')}) → ${r?.error ? 'error: ' + r.error : 'ok'}`); return r; };
    const ctx = `\n\n[Live context] Budget: $${budget} (tax ${tax}%). Current build: ${CATS.filter((c) => st.build[c]).map((c) => `${c}=${st.build[c].id} (${st.build[c].name})`).join('; ') || 'empty'}.`;
    const msgs = messages.slice(-20).map((m) => ({ role: m.role, content: String(m.content) }));
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();
    const reply = await (CFG.provider === 'anthropic' ? anthropic : gemini)(SYS + ctx, msgs, run, key);
    res.json({ reply, build: Object.fromEntries(Object.entries(st.build).map(([c, p]) => [c, p.id])), budget: st.budget, activity: act, email: st.email });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function gemini(sys, msgs, run, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CFG.model}:generateContent`;
  const contents = msgs.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const decl = TOOLS.map((t) => ({ name: t.name, description: t.description, ...(t.parameters ? { parameters: t.parameters } : {}) }));
  for (let i = 0; i < 8; i++) {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, tools: [{ functionDeclarations: decl }] }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || 'Gemini error');
    const c = j.candidates?.[0]?.content;
    if (!c) throw new Error('Gemini returned an empty response');
    const parts = c.parts || [];
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) return parts.map((p) => p.text || '').join('') || '(no reply)';
    contents.push(c);
    contents.push({ role: 'user', parts: calls.map((p) => ({ functionResponse: { name: p.functionCall.name, response: { result: run(p.functionCall.name, p.functionCall.args) } } })) });
  }
  return 'Sorry, I got stuck. Please try again.';
}

async function anthropic(sys, msgs, run, key) {
  const m = [...msgs];
  const tools = TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters || { type: 'object', properties: {} } }));
  for (let i = 0; i < 8; i++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: CFG.model, max_tokens: 1500, system: sys, tools, messages: m }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || 'Anthropic error');
    const calls = j.content.filter((b) => b.type === 'tool_use');
    if (!calls.length) return j.content.map((b) => b.text || '').join('') || '(no reply)';
    m.push({ role: 'assistant', content: j.content });
    m.push({ role: 'user', content: calls.map((c) => ({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(run(c.name, c.input)) })) });
  }
  return 'Sorry, I got stuck. Please try again.';
}
