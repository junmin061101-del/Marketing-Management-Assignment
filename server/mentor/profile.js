// POST {action:'draft'|'publish', profile} → saves a draft any time; publishing needs an approved review.
import { guard, body, send, currentUser, saveUser, publicUser, cleanText, redis, hmac, uid, allow } from '../../api/_lib.js';

// mode: how sessions run (the mentor chooses). price: what the student pays the mentor directly, in KRW;
// 0 = free, otherwise 5,000–1,000,000 won. The app charges the mentor a 5% fee when they accept a paid request.
export const MODES = ['in_person', 'video', 'both'];
export const okPrice = v => Number.isInteger(v) && (v === 0 || (v >= 5000 && v <= 1000000));
function clean(p = {}) {
  const n = Number(p.sessions), price = Number(p.price);
  return {
    home: cleanText(p.home, 100), major: cleanText(p.major, 60),
    act: cleanText(p.act, 2000), club: cleanText(p.club, 2000), lab: cleanText(p.lab, 2000), course: cleanText(p.course, 2000), offer: cleanText(p.offer, 2000),
    length: cleanText(p.length, 30), format: cleanText(p.format, 30),
    sessions: Number.isInteger(n) && n >= 1 && n <= 20 ? n : null, // no zero, negative or fractional counts
    mode: MODES.includes(p.mode) ? p.mode : '', area: cleanText(p.area, 40),
    price: p.price === '' || p.price == null ? null : okPrice(price) ? price : NaN,
  };
}
export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });
  if (!(await allow(`mprofile:${uid(user)}`, 60, 3600))) return send(res, 429, { error: 'too_many_requests' });
  const b = body(req), p = clean(b.profile);
  if (Number.isNaN(p.price)) return send(res, 400, { error: 'bad_price' });
  user.mentor = { ...(user.mentor || { status: 'none' }) };
  if (b.action === 'publish') {
    if (user.mentor.status !== 'approved') return send(res, 403, { error: 'review_not_approved' });
    if (!p.home || !p.major || !p.offer || !p.length || !p.mode || p.price === null || !p.sessions) return send(res, 400, { error: 'profile_incomplete' });
    if (p.mode !== 'video' && !p.area) return send(res, 400, { error: 'area_required' });
    p.format = { in_person: 'In person', video: 'Video call', both: 'In person or video call' }[p.mode];
    const key = 'm-' + hmac('mentor|' + uid(user)).slice(0, 16); // public id for reviews; does not reveal the email
    await redis('SET', 'mkey:' + key, uid(user));
    user.mentor.profile = { ...p, key, publishedAt: new Date().toISOString() };
  }
  user.mentor.draft = { ...p, savedAt: new Date().toISOString() };
  await saveUser(user);
  send(res, 200, { user: publicUser(user) });
}
