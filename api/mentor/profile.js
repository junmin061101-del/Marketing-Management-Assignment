// POST {action:'draft'|'publish', profile} → saves a draft any time; publishing needs an approved review.
import { guard, body, send, currentUser, saveUser, publicUser, cleanText } from '../_lib.js';

function clean(p = {}) {
  const n = Number(p.sessions);
  return {
    act: cleanText(p.act, 2000), club: cleanText(p.club, 2000), lab: cleanText(p.lab, 2000), course: cleanText(p.course, 2000), offer: cleanText(p.offer, 2000),
    length: cleanText(p.length, 30), format: cleanText(p.format, 30),
    sessions: Number.isInteger(n) && n >= 1 && n <= 20 ? n : null, // no zero, negative or fractional counts
  };
}
export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });
  const b = body(req), p = clean(b.profile);
  user.mentor = { ...(user.mentor || { status: 'none' }) };
  if (b.action === 'publish') {
    if (user.mentor.status !== 'approved') return send(res, 403, { error: 'review_not_approved' });
    if (!p.offer || !p.length || !p.format || !p.sessions) return send(res, 400, { error: 'profile_incomplete' });
    user.mentor.profile = { ...p, publishedAt: new Date().toISOString() };
  }
  user.mentor.draft = { ...p, savedAt: new Date().toISOString() };
  await saveUser(user);
  send(res, 200, { user: publicUser(user) });
}
