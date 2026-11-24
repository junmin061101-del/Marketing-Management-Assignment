// Shared helpers for the serverless API (Vercel Node runtime). No third-party packages.
// Files starting with "_" are not exposed as routes.
//
// Required environment variables (set them in Vercel → Project → Settings → Environment Variables):
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  (or KV_REST_API_URL / KV_REST_API_TOKEN from the Vercel integration)
//   RESEND_API_KEY      email delivery (resend.com)
//   MAIL_FROM           sender, e.g. "교환가자 <no-reply@your-domain.com>" (domain verified in Resend)
//   APP_SECRET          long random string; signs codes, sessions and review links
//   REVIEW_EMAIL        inbox of the operations team that reviews mentor applications
import crypto from 'node:crypto';

const R_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const R_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const MAIL_URL = process.env.MAIL_API_URL || 'https://api.resend.com/emails';

export const configured = () => !!(R_URL && R_TOKEN && process.env.RESEND_API_KEY && process.env.MAIL_FROM && process.env.APP_SECRET && process.env.APP_SECRET.length >= 32);

/* ---------- storage (Upstash Redis REST) ---------- */
export async function redis(...cmd) {
  const r = await fetch(R_URL, { method: 'POST', headers: { Authorization: `Bearer ${R_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error('storage error');
  return j.result;
}
export const getJSON = async k => { const v = await redis('GET', k); return v ? JSON.parse(v) : null; };
export const setJSON = (k, v, ...opt) => redis('SET', k, JSON.stringify(v), ...opt);

/* ---------- request / response ---------- */
export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(body));
}
// Method check, configuration check and CSRF protection for state-changing requests:
// the request must come from this site (Origin header) and carry JSON.
export function guard(req, res, methods) {
  if (!methods.includes(req.method)) { send(res, 405, { error: 'method_not_allowed' }); return false; }
  if (!configured()) { send(res, 503, { error: 'not_configured' }); return false; }
  if (req.method !== 'GET') {
    let ok = false;
    try { ok = new URL(req.headers.origin).host === req.headers.host; } catch {}
    if (!ok) { send(res, 403, { error: 'bad_origin' }); return false; }
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) { send(res, 415, { error: 'json_required' }); return false; }
  }
  return true;
}
export const body = req => (req.body && typeof req.body === 'object' ? req.body : {});
export const clientIp = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

/* ---------- validation ---------- */
export const normEmail = e => (typeof e === 'string' ? e.trim().toLowerCase() : '');
export const validEmail = e => e.length >= 6 && e.length <= 254 && /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(e);
export const isUniEmail = e => /\.(ac\.kr|edu)$/.test(e) || /\.edu\.[a-z]{2}$/.test(e);
// Plain text only: strip control characters and angle brackets, trim, cap length. The page also escapes on render.
export const cleanText = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g, '').trim().slice(0, max) : '');
export const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- crypto ---------- */
export const hmac = s => crypto.createHmac('sha256', process.env.APP_SECRET).update(s).digest('hex');
export const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${h.toString('base64')}`;
}
export function checkPassword(pw, stored) {
  const [alg, s, h] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const calc = crypto.scryptSync(pw, Buffer.from(s, 'base64'), 64, { N: 16384, r: 8, p: 1 });
  const want = Buffer.from(h, 'base64');
  return calc.length === want.length && crypto.timingSafeEqual(calc, want);
}
export const validPassword = pw => typeof pw === 'string' && pw.length >= 8 && pw.length <= 72 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

/* ---------- rate limits ---------- */
export async function allow(key, limit, seconds) {
  const n = await redis('INCR', 'rl:' + key);
  if (n === 1) await redis('EXPIRE', 'rl:' + key, seconds);
  return n <= limit;
}

/* ---------- one-time email codes: 6 digits, 10 minutes, 5 attempts, single use ---------- */
export async function issueCode(purpose, email, extra = {}) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await setJSON(`code:${purpose}:${email}`, { h: hmac(`${purpose}|${email}|${code}`), tries: 0, ...extra }, 'EX', 600);
  return code;
}
export async function useCode(purpose, email, code) {
  const key = `code:${purpose}:${email}`;
  const rec = await getJSON(key);
  if (!rec) return { ok: false, error: 'code_expired' };
  if (rec.tries >= 5) { await redis('DEL', key); return { ok: false, error: 'too_many_attempts' }; }
  if (!/^\d{6}$/.test(String(code)) || !safeEqual(rec.h, hmac(`${purpose}|${email}|${code}`))) {
    rec.tries += 1;
    if (rec.tries >= 5) await redis('DEL', key); else await setJSON(key, rec, 'KEEPTTL');
    return { ok: false, error: 'code_wrong', left: Math.max(0, 5 - rec.tries) };
  }
  await redis('DEL', key);
  return { ok: true, rec };
}

/* ---------- sessions: random id in an HttpOnly cookie, only its HMAC is stored ---------- */
const COOKIE = 'gg_sid', DAYS = 30;
const cookieOf = req => Object.fromEntries(String(req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
export async function startSession(res, email) {
  const sid = crypto.randomBytes(32).toString('base64url');
  await redis('SET', 'sess:' + hmac(sid), email, 'EX', DAYS * 86400);
  res.setHeader('Set-Cookie', `${COOKIE}=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`);
}
export async function endSession(req, res) {
  const sid = cookieOf(req)[COOKIE];
  if (sid) await redis('DEL', 'sess:' + hmac(sid));
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
export async function currentUser(req) {
  const sid = cookieOf(req)[COOKIE];
  if (!sid || sid.length > 100) return null;
  const email = await redis('GET', 'sess:' + hmac(sid));
  return email ? getJSON('user:' + email) : null;
}
export const saveUser = u => setJSON('user:' + u.email, u);
// What the page may see. Never the password hash.
export const publicUser = u => u && ({
  email: u.email, name: u.name, profile: u.profile || {},
  mentor: { uniEmail: u.mentor?.uniEmail || '', uniVerified: !!u.mentor?.uniVerified, status: u.mentor?.status || 'none',
    submittedAt: u.mentor?.submittedAt || null, draft: u.mentor?.draft || null, profile: u.mentor?.profile || null },
});

/* ---------- email ---------- */
export async function sendMail({ to, subject, html, attachments }) {
  const r = await fetch(MAIL_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, html, ...(attachments ? { attachments } : {}) }),
  });
  if (!r.ok) throw new Error('mail failed');
}
export const mailLayout = (title, inner) => `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:24px;color:#191F28">
  <h2 style="font-size:20px;margin:0 0 16px">${escHtml(title)}</h2>${inner}
  <p style="color:#8B95A1;font-size:12px;margin-top:24px">교환가자 · 본인이 요청하지 않았다면 이 메일을 무시하세요.</p></div>`;
export const codeMail = (title, code) => mailLayout(title, `<p>아래 인증 코드를 10분 안에 입력하세요.</p>
  <p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:16px 0">${code}</p>`);
