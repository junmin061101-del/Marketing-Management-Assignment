// POST {where, cat, text, reason} → a report about a community post, queued for the operations team (admin dashboard).
// Anyone can report; 20 reports per network per hour. Only a short excerpt of the post is kept.
import { guard, body, send, cleanText, redis, allow, clientIp, currentUser, uid } from './_lib.js';

const REASONS = new Set(['spam', 'abuse', 'privacy', 'false', 'other']);
export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  if (!(await allow(`report-ip:${clientIp(req)}`, 20, 3600))) return send(res, 429, { error: 'too_many_requests' });
  const b = body(req), reason = REASONS.has(b.reason) ? b.reason : 'other';
  const user = await currentUser(req);
  const r = { at: new Date().toISOString(), where: cleanText(b.where, 120), cat: cleanText(b.cat, 30), text: cleanText(b.text, 300), id: typeof b.id === 'string' && /^[a-z0-9]{6,20}$/.test(b.id) ? b.id : '', cid: typeof b.cid === 'string' && /^[a-z0-9]{4,20}$/.test(b.cid) ? b.cid : '', reason, by: user ? uid(user) : '' };
  if (!r.text) return send(res, 400, { error: 'bad_request' });
  await redis('LPUSH', 'admin:reports', JSON.stringify(r));
  await redis('LTRIM', 'admin:reports', 0, 499);
  send(res, 200, { ok: true });
}
