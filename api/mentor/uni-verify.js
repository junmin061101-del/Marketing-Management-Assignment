// POST {code} → marks the university email as verified.
import { guard, body, send, currentUser, useCode, saveUser, publicUser } from '../_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });
  const r = await useCode('uni', user.email, body(req).code);
  if (!r.ok) return send(res, 400, { error: r.error, left: r.left });
  user.mentor = { ...(user.mentor || {}), uniEmail: r.rec.uni, uniVerified: true, status: user.mentor?.status || 'none' };
  await saveUser(user);
  send(res, 200, { user: publicUser(user) });
}
