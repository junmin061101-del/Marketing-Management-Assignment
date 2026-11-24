// POST {current, next} → changes the signed-in student's password. The current password is required.
import { guard, body, send, currentUser, checkPassword, validPassword, hashPassword, saveUser, allow, uid } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });
  if (!(await allow(`pw:${uid(user)}`, 10, 900))) return send(res, 429, { error: 'too_many_requests' });
  const b = body(req);
  if (!user.pw || typeof b.current !== 'string' || !checkPassword(b.current, user.pw)) return send(res, 400, { error: 'wrong_password' });
  if (!validPassword(b.next)) return send(res, 400, { error: 'weak_password' });
  user.pw = hashPassword(b.next);
  await saveUser(user);
  send(res, 200, { ok: true });
}
