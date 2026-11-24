// GET → the signed-in user (or null). POST {name?, profile:{home, major, year}} → updates the user's own profile only.
// The user is always taken from the session cookie, never from an id in the request.
import { guard, send, body, configured, currentUser, saveUser, publicUser, cleanText } from './_lib.js';

export default async function handler(req, res) {
  if (req.method === 'GET' && !configured()) return send(res, 200, { user: null, configured: false });
  if (!guard(req, res, ['GET', 'POST'])) return;
  const user = await currentUser(req);
  if (req.method === 'GET') return send(res, 200, { user: publicUser(user), configured: true });
  if (!user) return send(res, 401, { error: 'login_required' });
  const b = body(req), p = b.profile || {};
  if (b.name !== undefined) user.name = cleanText(b.name, 40) || user.name;
  user.profile = { home: cleanText(p.home, 80), major: cleanText(p.major, 60), year: cleanText(p.year, 20) };
  await saveUser(user);
  send(res, 200, { user: publicUser(user) });
}
