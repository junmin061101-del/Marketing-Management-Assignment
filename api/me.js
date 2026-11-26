// GET → the signed-in user (or null); each visit extends the one-year login.
// POST {name?, profile?:{home, major, year}, plan?:{host, progId, dep, ret, done}} → updates the user's own data only.
// The user is always taken from the session cookie, never from an id in the request.
import { guard, send, body, configured, currentUser, redis, refreshSession, saveUser, publicUser, cleanText, allow, uid, savePushToken, removePushToken, pushHealth } from './_lib.js';

const PROGS = new Set(['exS', 'exF', 'exY', 'visit', 'ss', 'ws']);
const day = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
function cleanPlan(p) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.host)) return null;
  const [name, cc, url] = p.host;
  const host = [cleanText(name, 200), /^[A-Z]{2}$/.test(cc) ? cc : '', /^https?:\/\/[^\s"'<>]{1,300}$/.test(url || '') ? url : ''];
  if (!host[0] || !host[1]) return null;
  return {
    host, progId: PROGS.has(p.progId) ? p.progId : 'exS', dep: day(p.dep), ret: day(p.ret),
    done: Array.isArray(p.done) ? p.done.filter(x => typeof x === 'string' && /^[\w-]{1,40}$/.test(x)).slice(0, 200) : [],
    at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET' && !configured()) return send(res, 200, { user: null, configured: false });
  if (!guard(req, res, ['GET', 'POST'])) return;
  const user = await currentUser(req);
  if (req.method === 'GET') {
    if (user) await refreshSession(req, res);
    return send(res, 200, { user: publicUser(user), configured: true, push: await pushHealth() });
  }
  if (!user) return send(res, 401, { error: 'login_required' });
  if (!(await allow(`me:${uid(user)}`, 600, 3600))) return send(res, 429, { error: 'too_many_requests' });
  const b = body(req), p = b.profile;
  if (b.name !== undefined) user.name = cleanText(b.name, 40) || user.name;
  if (p) user.profile = { home: cleanText(p.home, 80), major: cleanText(p.major, 60), year: cleanText(p.year, 20) };
  if (b.plan !== undefined) user.plan = cleanPlan(b.plan);
  // joined school communities: [{k:'CC|University', st:'soon'|'now'|'done'}], at most 20
  const before = new Set((user.communities || []).map(c => c.k));
  if (Array.isArray(b.communities)) user.communities = b.communities.filter(c => c && typeof c.k === 'string' && /^[A-Z]{2}\|[^|<>]{2,200}$/.test(c.k))
    .slice(0, 20).map(c => ({ k: c.k, st: ['soon', 'now', 'done'].includes(c.st) ? c.st : 'soon' }));
  // joined communities are the members of their group chats: they count as readers until they read (unread "1" marks)
  if (Array.isArray(b.communities)) {
    const now = new Set(user.communities.map(c => c.k)), id = uid(user);
    for (const k of now) if (!before.has(k) && !(await redis('HGET', 'seen:g:' + k, id))) await redis('HSET', 'seen:g:' + k, id, '0');
    for (const k of before) if (!now.has(k)) await redis('HDEL', 'seen:g:' + k, id);
  }
  // push: {add: token, platform: 'android'|'ios'} when notifications are turned on, {remove: token} when turned off or on logout
  const tok = v => typeof v === 'string' && /^[\w:.-]{20,4096}$/.test(v) ? v : '';
  if (b.push && tok(b.push.add) && ['android', 'ios'].includes(b.push.platform)) await savePushToken(uid(user), b.push.add, b.push.platform);
  if (b.push && tok(b.push.remove)) await removePushToken(uid(user), b.push.remove);
  if (b.push && !b.name && !p && b.plan === undefined && !b.communities) return send(res, 200, { ok: true });
  await saveUser(user);
  send(res, 200, { user: publicUser(user) });
}
