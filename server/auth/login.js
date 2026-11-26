// POST {username, password} → signs in for a year. 10 tries per ID and 50 per network every 15 minutes;
// the same error for an unknown ID or a wrong password.
import { guard, body, send, normUsername, checkPassword, getJSON, startSession, publicUser, allow, clientIp , isApp } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const b = body(req), username = normUsername(b.username);
  if (!(await allow(`login:${username || 'x'}`, 10, 900)) || !(await allow(`login-ip:${clientIp(req)}`, 50, 900))) return send(res, 429, { error: 'too_many_requests' });
  const user = username ? await getJSON('user:' + username) : null;
  if (!user || !user.pw || typeof b.password !== 'string' || !checkPassword(b.password, user.pw)) return send(res, 401, { error: 'invalid_login' });
  const sid = await startSession(res, user);
  send(res, 200, isApp(req) ? { user: publicUser(user), token: sid } : { user: publicUser(user) });
}
