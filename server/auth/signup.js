// POST {username, password, name, agree} → creates an account and signs in. No email or text-message step.
// Only these fields are ever set on sign-up; roles or review status cannot be sent from the page.
import { guard, body, send, normUsername, validPassword, hashPassword, cleanText, getJSON, saveUser, startSession, publicUser, allow, clientIp , isApp } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const b = body(req), username = normUsername(b.username);
  if (!username) return send(res, 400, { error: 'bad_username' });
  if (!validPassword(b.password)) return send(res, 400, { error: 'weak_password' });
  const name = cleanText(b.name, 40);
  if (!name) return send(res, 400, { error: 'name_required' });
  if (b.agree !== true) return send(res, 400, { error: 'consent_required' });
  if (!(await allow(`signup-ip:${clientIp(req)}`, 10, 3600))) return send(res, 429, { error: 'too_many_requests' });
  if (await getJSON('user:' + username)) return send(res, 409, { error: 'username_taken' });
  const now = new Date().toISOString();
  const user = { key: username, username, name, pw: hashPassword(b.password), created: now, consent: { terms: '2026-11-24', privacy: '2026-11-24', at: now }, profile: {}, mentor: { status: 'none' } };
  await saveUser(user);
  const sid = await startSession(res, user);
  send(res, 200, isApp(req) ? { user: publicUser(user), token: sid } : { user: publicUser(user) });
}
