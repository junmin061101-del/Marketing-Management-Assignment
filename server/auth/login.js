// POST {email, password}. 10 attempts per address per 15 minutes; the same error for a wrong email or password.
import { guard, body, send, normEmail, allow, clientIp, getJSON, checkPassword, startSession, publicUser } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const b = body(req), email = normEmail(b.email);
  if (!(await allow(`login:${email}`, 10, 900)) || !(await allow(`login-ip:${clientIp(req)}`, 50, 900))) return send(res, 429, { error: 'too_many_requests' });
  const user = email ? await getJSON('user:' + email) : null;
  if (!user || typeof b.password !== 'string' || !checkPassword(b.password, user.pw)) return send(res, 401, { error: 'invalid_login' });
  await startSession(res, user);
  send(res, 200, { user: publicUser(user) });
}
