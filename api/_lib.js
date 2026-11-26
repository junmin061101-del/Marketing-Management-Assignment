// Shared helpers for the serverless API (Vercel Node runtime). No third-party packages.
// Files starting with "_" are not exposed as routes.
//
// Required environment variables (set them in Vercel → Project → Settings → Environment Variables):
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  (or KV_REST_API_URL / KV_REST_API_TOKEN from the Vercel integration)
//   RESEND_API_KEY      email delivery (resend.com); needs a verified domain to mail anyone but the Resend account owner
//   SMTP_USER / SMTP_PASS  or send through Gmail instead: the Gmail address and a Google app password (SMTP_HOST optional)
//   MAIL_FROM           sender, e.g. "교환가자 <no-reply@your-domain.com>" (domain verified in Resend)
//   APP_SECRET          long random string; signs codes, sessions and review links
//   REVIEW_EMAIL        inbox of the operations team that reviews mentor applications
//   SOLAPI_API_KEY / SOLAPI_API_SECRET / SMS_FROM   text-message login codes (solapi.com; SMS_FROM is the registered sender number)
//   ADMIN_EMAIL         addresses that can sign in to /admin, comma-separated (REVIEW_EMAIL can always sign in too)
import crypto from 'node:crypto';

const R_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const R_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const MAIL_URL = process.env.MAIL_API_URL || 'https://api.resend.com/emails';

const SMTP = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);
export const configured = () => !!(R_URL && R_TOKEN && (SMTP() || (process.env.RESEND_API_KEY && process.env.MAIL_FROM)) && process.env.APP_SECRET && process.env.APP_SECRET.length >= 32);

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
// The iOS / Android app (Capacitor) serves the page from these origins and signs in with a bearer token,
// never with the site cookie, so allowing them does not open a cookie-based CSRF hole.
const APP_ORIGINS = new Set(['capacitor://localhost', 'https://localhost', 'http://localhost']);
export const isApp = req => APP_ORIGINS.has(String(req.headers.origin || '')) || req.headers['x-gg-client'] === 'app';
// Method check, configuration check and CSRF protection for state-changing requests:
// the request must come from this site or the app (Origin header) and carry JSON.
export function guard(req, res, methods) {
  const origin = String(req.headers.origin || '');
  if (APP_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-GG-Client');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') { res.statusCode = APP_ORIGINS.has(origin) ? 204 : 403; res.end(); return false; }
  if (!methods.includes(req.method)) { send(res, 405, { error: 'method_not_allowed' }); return false; }
  if (!configured()) { send(res, 503, { error: 'not_configured' }); return false; }
  if (req.method !== 'GET') {
    let ok = APP_ORIGINS.has(origin);
    try { ok = ok || new URL(origin).host === req.headers.host; } catch {}
    if (!ok) { send(res, 403, { error: 'bad_origin' }); return false; }
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) { send(res, 415, { error: 'json_required' }); return false; }
  }
  return true;
}
export const body = req => (req.body && typeof req.body === 'object' ? req.body : {});
// Client IP for rate limits. Vercel sets x-vercel-forwarded-for / x-real-ip itself (clients can't forge them);
// x-forwarded-for is only a fallback for other hosts, and only its first entry is used.
const ipHeader = v => String(Array.isArray(v) ? v[0] : v || '').split(',')[0].trim().slice(0, 64);
export const clientIp = req => ipHeader(req.headers['x-vercel-forwarded-for']) || ipHeader(req.headers['x-real-ip']) || ipHeader(req.headers['x-forwarded-for']) || 'unknown';

/* ---------- validation ---------- */
export const normEmail = e => (typeof e === 'string' ? e.trim().toLowerCase() : '');
export const validEmail = e => e.length >= 6 && e.length <= 254 && /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(e);
// Korean mobile numbers only: 010-1234-5678, 01012345678, +82 10 1234 5678 → 01012345678
export function normPhone(v) {
  let d = String(v || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+82')) d = '0' + d.slice(3); else if (d.startsWith('82') && d.length >= 11) d = '0' + d.slice(2);
  d = d.replace(/\D/g, '');
  return /^01[016789]\d{7,8}$/.test(d) ? d : '';
}
// Login IDs: start with a letter, then letters, digits or _ (4–20). Case-insensitive.
export const normUsername = v => { const u = typeof v === 'string' ? v.trim().toLowerCase() : ''; return /^[a-z][a-z0-9_]{3,19}$/.test(u) ? u : ''; };
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
const COOKIE = 'gg_sid', DAYS = 365; // students stay signed in; every visit extends it
const cookieOf = req => Object.fromEntries(String(req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
// The site uses an HttpOnly cookie; the app sends the same session ID as "Authorization: Bearer <id>".
const sidOf = req => { const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(String(req.headers.authorization || '')); return m ? m[1] : cookieOf(req)[COOKIE]; };
// Returns the session ID; login and signup hand it to the app (only) as a token.
export async function startSession(res, user) {
  const sid = crypto.randomBytes(32).toString('base64url');
  await redis('SET', 'sess:' + hmac(sid), `${uid(user)}|${user.created || ''}`, 'EX', DAYS * 86400);
  res.setHeader('Set-Cookie', `${COOKIE}=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`);
  return sid;
}
export async function refreshSession(req, res) {
  const sid = sidOf(req);
  if (!sid || sid.length > 100) return;
  if (await redis('EXPIRE', 'sess:' + hmac(sid), DAYS * 86400) && !req.headers.authorization) res.setHeader('Set-Cookie', `${COOKIE}=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`);
}
export async function endSession(req, res) {
  const sid = sidOf(req);
  if (sid) await redis('DEL', 'sess:' + hmac(sid));
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
export async function currentUser(req) {
  const sid = sidOf(req);
  if (!sid || sid.length > 100) return null;
  const v = await redis('GET', 'sess:' + hmac(sid));
  if (!v) return null;
  const [email, created] = String(v).split('|');
  const user = await getJSON('user:' + email);
  return user && (created === undefined || created === (user.created || '')) ? user : null;
}
// Accounts are keyed by their login ID (u.key = username). Older test accounts may be keyed by phone number or email.
export const uid = u => u.key || u.email;
export const contactEmail = u => u.email || u.mentor?.uniEmail || '';
export const saveUser = u => setJSON('user:' + uid(u), u);
// What the page may see. Never the password hash.
export const publicUser = u => u && ({
  key: uid(u), username: u.username || '', phone: u.phone || '', email: u.email || '', name: u.name, profile: u.profile || {}, plan: u.plan || null, avatar: u.avatar || null, communities: u.communities || [],
  mentor: { uniEmail: u.mentor?.uniEmail || '', uniVerified: !!u.mentor?.uniVerified, status: u.mentor?.status || 'none',
    submittedAt: u.mentor?.submittedAt || null, draft: u.mentor?.draft || null, profile: u.mentor?.profile || null },
});

/* ---------- text messages (SOLAPI) ---------- */
export const smsConfigured = () => !!(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET && process.env.SMS_FROM);
export async function sendSms(to, text) {
  const date = new Date().toISOString(), salt = crypto.randomBytes(16).toString('hex');
  const sig = crypto.createHmac('sha256', process.env.SOLAPI_API_SECRET).update(date + salt).digest('hex');
  const r = await fetch(process.env.SMS_API_URL || 'https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: { Authorization: `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${sig}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { to, from: normPhone(process.env.SMS_FROM) || String(process.env.SMS_FROM).replace(/\D/g, ''), text } }),
  });
  const j = await r.json().catch(() => ({}));
  // SOLAPI answers 200 with statusCode 2000 when the message is accepted
  if (!r.ok || (j.statusCode && !String(j.statusCode).startsWith('2'))) {
    console.error('sms failed', r.status, JSON.stringify(j).slice(0, 500));
    throw Object.assign(new Error('sms failed'), { code: 'sms_failed' });
  }
}

/* ---------- email ---------- */
let smtp = null;
async function sendSmtp({ to, subject, html, attachments }) {
  if (!smtp) {
    const { default: nodemailer } = await import('nodemailer');
    smtp = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  }
  // Gmail always sends from the signed-in account; keep only the display name from MAIL_FROM
  const name = (String(process.env.MAIL_FROM || '').match(/^\s*"?([^"<]+?)"?\s*</) || [])[1] || '교환가자';
  try {
    await smtp.sendMail({ from: { name, address: process.env.SMTP_USER }, to, subject, html,
      attachments: (attachments || []).map(a => ({ filename: a.filename, content: Buffer.from(a.content, 'base64') })) });
  } catch (e) {
    console.error('mail failed smtp', e.responseCode || '', String(e.response || e.message).slice(0, 500));
    throw Object.assign(new Error('mail failed'), { code: 'mail_failed' });
  }
}
export async function sendMail({ to, subject, html, attachments }) {
  if (SMTP()) return sendSmtp({ to, subject, html, attachments });
  const r = await fetch(MAIL_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, html, ...(attachments ? { attachments } : {}) }),
  });
  if (!r.ok) {
    // the reason (unverified sender domain, sandbox recipient limit, bad key…) shows up in the Vercel function logs
    const detail = await r.text().catch(() => '');
    console.error('mail failed', r.status, detail.slice(0, 500));
    throw Object.assign(new Error('mail failed'), { code: 'mail_failed', status: r.status });
  }
}
export const mailLayout = (title, inner) => `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:24px;color:#191F28">
  <h2 style="font-size:20px;margin:0 0 16px">${escHtml(title)}</h2>${inner}
  <p style="color:#8B95A1;font-size:12px;margin-top:24px">교환가자 · 본인이 요청하지 않았다면 이 메일을 무시하세요.</p></div>`;
export const codeMail = (title, code) => mailLayout(title, `<p>아래 인증 코드를 10분 안에 입력하세요.</p>
  <p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:16px 0">${code}</p>`);

/* ---------- proof files: kept only until the review is decided (then destroyed); unreviewed uploads expire after 30 days ---------- */
const PROOF_TTL = 30 * 86400, CHUNK = 600000;
export async function saveProof(email, buf, type, name) {
  const b64 = buf.toString('base64'), n = Math.ceil(b64.length / CHUNK);
  for (let i = 0; i < n; i++) await redis('SET', `proof:${email}:${i}`, b64.slice(i * CHUNK, (i + 1) * CHUNK), 'EX', PROOF_TTL);
  await setJSON(`proof:${email}:m`, { type, name, n, size: buf.length, at: new Date().toISOString() }, 'EX', PROOF_TTL);
}
export async function loadProof(email) {
  const m = await getJSON(`proof:${email}:m`);
  if (!m) return null;
  let b64 = '';
  for (let i = 0; i < m.n; i++) { const part = await redis('GET', `proof:${email}:${i}`); if (part == null) return null; b64 += part; }
  return { ...m, buf: Buffer.from(b64, 'base64') };
}
export async function expireProof(email, seconds = PROOF_TTL) {
  const m = await getJSON(`proof:${email}:m`);
  if (!m) return;
  for (let i = 0; i < m.n; i++) await redis('EXPIRE', `proof:${email}:${i}`, seconds);
  await redis('EXPIRE', `proof:${email}:m`, seconds);
}
export async function deleteProof(email) {
  const m = await getJSON(`proof:${email}:m`);
  for (let i = 0; i < (m?.n || 0); i++) await redis('DEL', `proof:${email}:${i}`);
  await redis('DEL', `proof:${email}:m`);
}

/* ---------- mentor review decision, shared by the email links and the admin dashboard ---------- */
const DECISION = {
  approve: ['[교환가자] 멘토 심사를 통과했어요', '멘토 심사를 통과했어요', '이제 멘토 프로필을 공개할 수 있어요. 앱에서 프로필을 확인하고 공개하세요.'],
  reject: ['[교환가자] 멘토 심사 결과', '멘토 심사 결과', '제출한 증빙으로는 수료를 확인하지 못했어요. 수료증이나 파견교 성적증명서를 다시 제출해 주세요.'],
  revoke: ['[교환가자] 멘토 자격 안내', '멘토 자격이 취소됐어요', '운영 정책에 따라 멘토 자격과 공개 프로필이 내려갔어요. 궁금한 점은 답장으로 문의해 주세요.'],
};
export async function decideMentor(user, d, reason = '') {
  const m = { ...(user.mentor || {}) };
  if (d === 'revoke') {
    if (m.profile?.key) await redis('DEL', 'mkey:' + m.profile.key);
    m.profile = null;
  }
  m.status = d === 'approve' ? 'approved' : 'rejected';
  m.reviewedAt = new Date().toISOString();
  m.reason = reason || '';
  user.mentor = m;
  await saveUser(user);
  await deleteProof(uid(user));   // the proof is used for this review only and destroyed once it is decided
  const [subject, title, text] = DECISION[d];
  if (user.phone && smsConfigured()) await sendSms(user.phone, `[교환가자] ${title}. ${reason ? '메모: ' + reason.slice(0, 40) + ' ' : ''}자세한 내용은 앱에서 확인하세요.`).catch(() => {});
  await sendPush(uid(user), '교환가자', title, { go: d === 'approve' ? 'mentorApply' : 'me' }).catch(() => 0);
  if (contactEmail(user)) await sendMail({ to: contactEmail(user), subject, html: mailLayout(title, `<p>${text}</p>${reason ? `<p style="background:#F2F4F6;padding:12px;border-radius:8px">운영팀 메모: ${escHtml(reason)}</p>` : ''}`) }).catch(() => {});
}

/* ---------- admin: one address, email code sign-in, a separate short cookie that only /api/admin receives ---------- */
const ADM = 'gg_adm', ADM_HOURS = 12;
export const adminEmails = () => [...new Set([...String(process.env.ADMIN_EMAIL || '').split(','), process.env.REVIEW_EMAIL || ''].map(normEmail).filter(Boolean))];
export const isAdminEmail = e => !!e && adminEmails().includes(normEmail(e));
export async function startAdmin(res, email) {
  const sid = crypto.randomBytes(32).toString('base64url');
  await redis('SET', 'asess:' + hmac('adm|' + sid), normEmail(email), 'EX', ADM_HOURS * 3600);
  res.setHeader('Set-Cookie', `${ADM}=${sid}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${ADM_HOURS * 3600}`);
}
export async function endAdmin(req, res) {
  const sid = cookieOf(req)[ADM];
  if (sid) await redis('DEL', 'asess:' + hmac('adm|' + sid));
  res.setHeader('Set-Cookie', `${ADM}=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}
export async function isAdmin(req) {
  const sid = cookieOf(req)[ADM];
  if (!sid || sid.length > 100 || !adminEmails().length) return false;
  const v = await redis('GET', 'asess:' + hmac('adm|' + sid));
  return isAdminEmail(v); // removing an address from ADMIN_EMAIL ends its sessions at once
}
export async function adminLog(type, target, detail = '') {
  await redis('LPUSH', 'admin:log', JSON.stringify({ at: new Date().toISOString(), type, target, detail: String(detail).slice(0, 200) }));
  await redis('LTRIM', 'admin:log', 0, 499);
}
export async function scanKeys(pattern, max = 20000) {
  let cur = '0'; const keys = [];
  do { const [next, k] = await redis('SCAN', cur, 'MATCH', pattern, 'COUNT', 500); cur = String(next); keys.push(...k); } while (cur !== '0' && keys.length < max);
  return keys;
}

/* ---------- push notifications (Firebase Cloud Messaging, HTTP v1) ----------
   FIREBASE_SERVICE_ACCOUNT = the service-account JSON from Firebase (raw or base64). Without it nothing is sent.
   Device tokens are kept per account in push:<id> (at most 5 devices) and removed when the student turns
   notifications off, logs out or deletes the account, or when Google reports the token as gone. */
const FCM_PROJECT = 'gyohwan-gaja';
function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (!raw) return null;
  try { return JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')); } catch { return null; }
}
export const pushConfigured = () => !!serviceAccount();
// 'ok' | 'missing' (no env) | 'bad_key' (not a service-account JSON) | 'auth_failed' (Google refused the key).
// Checked against Google at most every 10 minutes; tells the operator whether push is really connected.
export async function pushHealth() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (!raw) return 'missing';
  const sa = serviceAccount();
  if (!sa || !sa.client_email || !sa.private_key) return 'bad_key';
  const cached = await redis('GET', 'fcm:health').catch(() => null);
  if (cached) return cached;
  let state = 'auth_failed';
  try { state = (await fcmAccessToken()) ? 'ok' : 'auth_failed'; } catch { state = 'bad_key'; }
  await redis('SET', 'fcm:health', state, 'EX', 600).catch(() => null);
  return state;
}
let fcmToken = { v: '', exp: 0 };
async function fcmAccessToken() {
  if (fcmToken.v && Date.now() < fcmToken.exp - 60000) return fcmToken.v;
  const sa = serviceAccount(); if (!sa) return '';
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url'), now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const jwt = unsigned + '.' + crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) { console.error('fcm auth failed', r.status, j.error); return ''; }
  fcmToken = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return fcmToken.v;
}
export async function pushTokens(id) { return (await getJSON('push:' + id)) || []; }
export async function savePushToken(id, token, platform) {
  const list = (await pushTokens(id)).filter(x => x.t !== token);
  list.unshift({ t: token, p: platform, at: new Date().toISOString() });
  await setJSON('push:' + id, list.slice(0, 5));
}
export async function removePushToken(id, token) {
  const list = (await pushTokens(id)).filter(x => x.t !== token);
  if (list.length) await setJSON('push:' + id, list); else await redis('DEL', 'push:' + id);
}
// title/body are shown as-is; data (string values) tells the app where to open, e.g. { go: 'mentorApply' }
export async function sendPush(id, title, body, data = {}) {
  const tokens = await pushTokens(id);
  if (!tokens.length) return 0;
  const access = await fcmAccessToken();
  if (!access) return 0;
  let sent = 0;
  for (const { t } of tokens) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT}/messages:send`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token: t, notification: { title, body }, data, android: { notification: { icon: 'ic_stat_notify', color: '#2F6FED' } }, apns: { payload: { aps: { sound: 'default' } } } } }),
    }).catch(() => null);
    if (r && r.ok) { sent++; continue; }
    const j = r ? await r.json().catch(() => ({})) : {};
    const code = JSON.stringify(j.error || '');
    if (r && (r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(code))) await removePushToken(id, t); // the app was removed or the token rotated
  }
  return sent;
}
