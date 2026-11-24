// POST {ticket, name, agree} → creates the account for a number that was just verified by text message.
// The ticket is signed, expires in 15 minutes and works once. Roles or review status can never be sent from the page.
import { guard, body, send, normPhone, hmac, safeEqual, cleanText, getJSON, saveUser, startSession, publicUser, redis } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const b = body(req), [p, x, sig] = String(b.ticket || '').split('.'), phone = normPhone(p), exp = Number(x);
  if (!phone || !exp || Date.now() > exp || !safeEqual(sig || '', hmac(`signup|${phone}|${exp}`))) return send(res, 400, { error: 'code_expired' });
  if (b.agree !== true) return send(res, 400, { error: 'consent_required' });
  const name = cleanText(b.name, 40);
  if (!name) return send(res, 400, { error: 'name_required' });
  if (!(await redis('SET', 'ticket:' + sig.slice(0, 32), '1', 'NX', 'EX', 1800))) return send(res, 400, { error: 'code_expired' });
  let user = await getJSON('user:' + phone);
  if (!user) {
    const now = new Date().toISOString();
    user = { key: phone, phone, name, created: now, consent: { terms: '2026-11-24', privacy: '2026-11-24', at: now }, profile: {}, mentor: { status: 'none' } };
    await saveUser(user);
  }
  await startSession(res, user);
  send(res, 200, { user: publicUser(user) });
}
