// Local test server: serves the site and the /api functions with in-memory stand-ins for
// Upstash Redis, email and text messages, so everything runs without real accounts or keys.
//   node scripts/dev-server.mjs            → http://localhost:8790
//   GET /__mails, /__sms                   → messages the app "sent"
//   GET /__keys                            → keys currently in the fake Redis
// Never deploy this file; Vercel only runs files under /api.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL, fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), PORT = Number(process.env.PORT || 8790);
const db = new Map(), exp = new Map(), mails = [], sms = [];
const alive = k => { if (exp.has(k) && Date.now() > exp.get(k)) { db.delete(k); exp.delete(k); } return db.has(k); };
const J = k => (alive(k) ? JSON.parse(db.get(k)) : null);
function cmd([c, ...x]) {
  const C = c.toUpperCase();
  if (C === 'GET') return alive(x[0]) ? db.get(x[0]) : null;
  if (C === 'SET') { const [k, v, ...o] = x; const O = o.map(String); if (O.includes('NX') && alive(k)) return null; db.set(k, String(v)); const i = O.indexOf('EX'); if (i >= 0) exp.set(k, Date.now() + Number(O[i + 1]) * 1000); else if (!O.includes('KEEPTTL')) exp.delete(k); return 'OK'; }
  if (C === 'DEL') { const h = alive(x[0]); db.delete(x[0]); exp.delete(x[0]); return h ? 1 : 0; }
  if (C === 'INCR') { const v = (alive(x[0]) ? Number(db.get(x[0])) : 0) + 1; db.set(x[0], String(v)); return v; }
  if (C === 'EXPIRE') { if (!alive(x[0])) return 0; exp.set(x[0], Date.now() + Number(x[1]) * 1000); return 1; }
  if (C === 'MGET') return x.map(k => (alive(k) ? db.get(k) : null));
  if (C === 'HSET') { const h = J(x[0]) || {}; const n = x[1] in h ? 0 : 1; h[x[1]] = String(x[2]); db.set(x[0], JSON.stringify(h)); return n; }
  if (C === 'HGETALL') { const h = J(x[0]); return h ? Object.entries(h).flat() : []; }
  if (C === 'HDEL') { const h = J(x[0]); if (!h) return 0; const n = x[1] in h ? 1 : 0; delete h[x[1]]; db.set(x[0], JSON.stringify(h)); return n; }
  if (C === 'SCAN') { const re = new RegExp('^' + String(x[2]).split('*').map(p => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'); return ['0', [...db.keys()].filter(k => alive(k) && re.test(k))]; }
  if (C === 'LPUSH') { const l = J(x[0]) || []; l.unshift(...x.slice(1).map(String).reverse()); db.set(x[0], JSON.stringify(l)); return l.length; }
  if (C === 'LTRIM') { const l = J(x[0]); if (l) db.set(x[0], JSON.stringify(l.slice(+x[1], +x[2] + 1))); return 'OK'; }
  if (C === 'LRANGE') { const l = J(x[0]); return l ? l.slice(+x[1], +x[2] + 1) : []; }
  throw new Error('unsupported ' + C);
}
Object.assign(process.env, {
  UPSTASH_REDIS_REST_URL: `http://localhost:${PORT}/__redis`, UPSTASH_REDIS_REST_TOKEN: 'dev',
  RESEND_API_KEY: 'dev', MAIL_FROM: '교환가자 <dev@example.com>', MAIL_API_URL: `http://localhost:${PORT}/__mail`,
  SOLAPI_API_KEY: 'dev', SOLAPI_API_SECRET: 'dev', SMS_FROM: '01000000000', SMS_API_URL: `http://localhost:${PORT}/__smsapi`,
  APP_SECRET: 'dev-secret-'.padEnd(40, 'x'), REVIEW_EMAIL: 'ops@example.com',
});
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); let raw = ''; for await (const c of req) raw += c;
  const json = v => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(v)); };
  if (u.pathname === '/__redis') { try { return json({ result: cmd(JSON.parse(raw)) }); } catch (e) { return json({ error: e.message }); } }
  if (u.pathname === '/__mail') { mails.push(JSON.parse(raw)); return json({ id: '1' }); }
  if (u.pathname === '/__smsapi') { const m = JSON.parse(raw).message; sms.push({ to: m.to, from: m.from, text: m.text, auth: /^HMAC-SHA256 apiKey=/.test(req.headers.authorization || '') }); return json({ statusCode: '2000' }); }
  if (u.pathname === '/__mails') return json(mails.map(m => ({ to: m.to, subject: m.subject, html: m.html, att: (m.attachments || []).map(a => a.filename) })));
  if (u.pathname === '/__sms') return json(sms);
  if (u.pathname === '/__keys') return json([...db.keys()].filter(alive));
  if (u.pathname.startsWith('/api/')) {
    let f = path.join(ROOT, u.pathname + '.js'); if (!fs.existsSync(f)) f = path.join(ROOT, path.dirname(u.pathname), '[op].js');
    if (!fs.existsSync(f)) { res.statusCode = 404; return res.end('{}'); }
    try { const ct = String(req.headers['content-type'] || ''); req.body = !raw ? {} : ct.includes('json') ? JSON.parse(raw) : ct.includes('x-www-form-urlencoded') ? Object.fromEntries(new URLSearchParams(raw)) : {}; } catch { req.body = {}; }
    try { await (await import(pathToFileURL(f).href)).default(req, res); } catch (e) { console.error(e); res.statusCode = 500; res.end('{"error":"crash"}'); }
    return;
  }
  let p = u.pathname === '/' ? '/index.html' : u.pathname; if (!path.extname(p)) p += '.html';
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`dev server on http://localhost:${PORT}`));
