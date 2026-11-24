// Mentor reviews.
// GET  /api/reviews?m=<mentor key>            → { reviews, mine }
// POST /api/reviews { m, rating 1–5, text }   → login required; one review per account per mentor (posting again edits it)
import { guard, body, send, currentUser, cleanText, redis, allow } from './_lib.js';

// Sample mentors shown in the app, plus real mentors registered when they publish (mkey:<key> → email).
const SAMPLE = new Set(['sample-yeon', 'sample-woo', 'sample-seo']);
const KEY = /^(sample-[a-z]{2,10}|m-[a-f0-9]{16})$/;
async function mentorEmail(m) {
  if (typeof m !== 'string' || !KEY.test(m)) return null;
  if (SAMPLE.has(m)) return 'sample';
  return (await redis('GET', 'mkey:' + m)) || null;
}
// "김민수" → "김**", "Kim Min" → "K**": reviews never show full names or emails.
const mask = name => (String(name || '?').trim()[0] || '?').toUpperCase() + '**';

export default async function handler(req, res) {
  if (!guard(req, res, ['GET', 'POST'])) return;
  const user = await currentUser(req);
  if (req.method === 'GET') {
    const m = new URL(req.url, 'http://x').searchParams.get('m');
    if (!(await mentorEmail(m))) return send(res, 404, { error: 'unknown_mentor' });
    const flat = (await redis('HGETALL', 'reviews:' + m)) || [];
    const list = [];
    for (let i = 0; i < flat.length; i += 2) {
      try { const r = JSON.parse(flat[i + 1]); list.push({ ...r, mine: !!user && flat[i] === user.email }); } catch {}
    }
    list.sort((a, b) => (a.at < b.at ? 1 : -1));
    return send(res, 200, { reviews: list.slice(0, 100) });
  }
  if (!user) return send(res, 401, { error: 'login_required' });
  const b = body(req), owner = await mentorEmail(b.m);
  if (!owner) return send(res, 404, { error: 'unknown_mentor' });
  if (owner === user.email) return send(res, 403, { error: 'own_profile' });
  const rating = Number(b.rating), text = cleanText(b.text, 500);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return send(res, 400, { error: 'bad_rating' });
  if (text.length < 10) return send(res, 400, { error: 'review_too_short' });
  if (!(await allow('review:' + user.email, 10, 86400))) return send(res, 429, { error: 'too_many_requests' });
  const p = user.profile || {};
  const r = { who: mask(user.name), home: cleanText(p.home, 100), major: cleanText(p.major, 60), rating, text, at: new Date().toISOString() };
  await redis('HSET', 'reviews:' + b.m, user.email, JSON.stringify(r));
  send(res, 200, { review: { ...r, mine: true } });
}
