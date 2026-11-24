// POST {email, code, purpose, password, name?, agree?} → signup: creates the account; reset: sets a new password. Starts a session.
import { guard, body, send, normEmail, validEmail, useCode, validPassword, hashPassword, getJSON, saveUser, startSession, publicUser, cleanText, allow, clientIp } from '../_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const b = body(req), email = normEmail(b.email), purpose = b.purpose === 'reset' ? 'reset' : 'signup';
  if (!validEmail(email)) return send(res, 400, { error: 'bad_email' });
  if (!(await allow(`verify-ip:${clientIp(req)}`, 30, 3600))) return send(res, 429, { error: 'too_many_requests' });
  if (!validPassword(b.password)) return send(res, 400, { error: 'weak_password' });
  if (purpose === 'signup') {
    if (b.agree !== true) return send(res, 400, { error: 'consent_required' });
    if (!cleanText(b.name, 40)) return send(res, 400, { error: 'name_required' });
  }
  const r = await useCode(purpose, email, b.code);
  if (!r.ok) return send(res, 400, { error: r.error, left: r.left });
  let user = await getJSON('user:' + email);
  if (purpose === 'signup') {
    if (user) return send(res, 409, { error: 'already_registered' });
    // Only these fields are ever set on signup. Roles or review status cannot be sent from the page.
    user = { email, name: cleanText(b.name, 40), pw: hashPassword(b.password), created: new Date().toISOString(), consent: { terms: '2026-11-24', privacy: '2026-11-24', at: new Date().toISOString() }, profile: {}, mentor: { status: 'none' } };
  } else {
    if (!user) return send(res, 400, { error: 'code_expired' });
    user.pw = hashPassword(b.password);
  }
  await saveUser(user);
  await startSession(res, email);
  send(res, 200, { user: publicUser(user) });
}
