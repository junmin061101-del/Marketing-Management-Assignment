// POST {action:'draft'|'publish', profile} → saves a draft any time; publishing needs an approved review.
import { guard, body, send, currentUser, saveUser, publicUser, cleanText, redis, hmac, uid, allow } from '../../api/_lib.js';

// mode: how sessions run (the mentor chooses). Price and meeting place are agreed with each student in chat;
// the mentor enters the agreed price when accepting a request (see api/sessions.js).
const MODES = ['in_person', 'video', 'both'];
// where, when and how long the mentor went (students search mentors by these)
const PROGS = ['exS', 'exY', 'ss', 'ws', 'visit'];
// whether the mentor offers free or paid mentoring (the amount itself is agreed in chat)
const PAYS = ['free', 'paid', 'both'];
function clean(p = {}) {
  const n = Number(p.sessions), year = Number(p.year), thisYear = new Date().getFullYear();
  return {
    home: cleanText(p.home, 100), major: cleanText(p.major, 60),
    act: cleanText(p.act, 2000), club: cleanText(p.club, 2000), lab: cleanText(p.lab, 2000), course: cleanText(p.course, 2000), offer: cleanText(p.offer, 2000),
    length: cleanText(p.length, 30), format: cleanText(p.format, 30),
    sessions: Number.isInteger(n) && n >= 1 && n <= 20 ? n : null, // no zero, negative or fractional counts
    mode: MODES.includes(p.mode) ? p.mode : '',
    host: cleanText(p.host, 200), hostCC: /^[A-Z]{2}$/.test(p.hostCC || '') ? p.hostCC : '',
    year: Number.isInteger(year) && year >= 2000 && year <= thisYear + 1 ? year : null, prog: PROGS.includes(p.prog) ? p.prog : '',
    pay: PAYS.includes(p.pay) ? p.pay : '',
  };
}
export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });
  if (!(await allow(`mprofile:${uid(user)}`, 60, 3600))) return send(res, 429, { error: 'too_many_requests' });
  const b = body(req), p = clean(b.profile);
  user.mentor = { ...(user.mentor || { status: 'none' }) };
  if (b.action === 'publish') {
    if (user.mentor.status !== 'approved') return send(res, 403, { error: 'review_not_approved' });
    if (!p.home || !p.major || !p.offer || !p.length || !p.mode || !p.sessions || !p.host || !p.year || !p.prog || !p.pay) return send(res, 400, { error: 'profile_incomplete' });
    p.format = { in_person: 'In person', video: 'Video call', both: 'In person or video call' }[p.mode];
    const key = 'm-' + hmac('mentor|' + uid(user)).slice(0, 16); // public id for reviews; does not reveal the email
    await redis('SET', 'mkey:' + key, uid(user));
    user.mentor.profile = { ...p, key, publishedAt: new Date().toISOString() };
  }
  user.mentor.draft = { ...p, savedAt: new Date().toISOString() };
  await saveUser(user);
  send(res, 200, { user: publicUser(user) });
}
