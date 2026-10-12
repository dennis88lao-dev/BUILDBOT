import { CATS, byId, validateBuild, total } from '../public/core.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
    const { email, build_name = 'My BuildBot build', build = {}, budget = 0, tax = 8.5 } = req.body || {};
    if (!/^\S+@\S+\.\S+$/.test(email || '')) return res.status(400).json({ ok: false, error: 'Please enter a valid email.' });
    const b = {};
    for (const [c, id] of Object.entries(build)) { const p = byId(id); if (p && p.category === c) b[c] = p; }
    if (!Object.keys(b).length) return res.status(400).json({ ok: false, error: 'The build is empty.' });
    const url = process.env.MAKE_WEBHOOK_URL;
    if (!url) return res.status(500).json({ ok: false, error: 'MAKE_WEBHOOK_URL is not set in Vercel.' });
    const v = validateBuild(b);
    const parts = CATS.filter((c) => b[c]).map((c) => ({ name: b[c].name, category: c, price: b[c].price, purchase_url: b[c].purchase_url }));
    const t = +total(b, tax).toFixed(2);
    const status = v.verified ? 'verified compatible' : 'NOT verified';
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px"><h2>${esc(build_name)}</h2><p>Compatibility: <b>${status}</b></p><table style="width:100%;border-collapse:collapse">${parts.map((p) => `<tr><td style="padding:6px;border-bottom:1px solid #ddd;text-transform:capitalize">${p.category}</td><td style="padding:6px;border-bottom:1px solid #ddd"><a href="${esc(p.purchase_url)}">${esc(p.name)}</a></td><td style="padding:6px;border-bottom:1px solid #ddd;text-align:right">$${p.price}</td></tr>`).join('')}</table><p><b>Total incl. ${tax}% tax: $${t}</b> (budget $${budget})</p><p style="color:#888;font-size:12px">Prices are estimates; verify all parts and prices before purchase.</p></div>`;
    const payload = { user_email: email, build_name, parts, total_price: t, budget, compatibility_status: status, timestamp: new Date().toISOString(), html };
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) return res.status(502).json({ ok: false, error: `Make.com returned ${r.status}. Is the scenario switched ON?` });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
}
