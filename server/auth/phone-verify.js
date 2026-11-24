// POST {phone, code} → existing account: signs in. New number: returns a 15-minute sign-up ticket,
// so the student only types a name and agrees to the terms once.
import { guard, body, send, normPhone, useCode, getJSON, startSession, publicUser, hmac, allow, clientIp } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const b = body(req), phone = normPhone(b.phone);
  if (!phone) return send(res, 400, { error: 'bad_phone' });
  if (!(await allow(`verify-ip:${clientIp(req)}`, 30, 3600))) return send(res, 429, { error: 'too_many_requests' });
  const r = await useCode('phone', phone, String(b.code || '').trim());
  if (!r.ok) return send(res, 400, { error: r.error, left: r.left });
  const user = await getJSON('user:' + phone);
  if (user) { await startSession(res, user); return send(res, 200, { user: publicUser(user) }); }
  const exp = Date.now() + 15 * 60 * 1000;
  send(res, 200, { signup: true, ticket: `${phone}.${exp}.${hmac(`signup|${phone}|${exp}`)}` });
}
