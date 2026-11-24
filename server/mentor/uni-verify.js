// POST {code} → marks the university email as verified (6 digits, 10 minutes, 5 tries, single use).
import { guard, body, send, currentUser, useCode, saveUser, publicUser, uid, allow } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });
  if (!(await allow(`univ:${uid(user)}`, 20, 3600))) return send(res, 429, { error: 'too_many_requests' });
  const r = await useCode('uni', uid(user), String(body(req).code || '').trim());
  if (!r.ok) return send(res, 400, { error: r.error, left: r.left });
  user.mentor = { ...(user.mentor || {}), uniEmail: r.rec.uni, uniVerified: true, status: user.mentor?.status || 'none' };
  await saveUser(user);
  send(res, 200, { user: publicUser(user) });
}
