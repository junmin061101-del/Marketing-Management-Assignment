// Chats between real students, stored on the server.
//   Group chat: one room per school community ("g:<CC|University name>"), open to signed-in students.
//   1:1 chat:   a student and a published mentor ("d:<hash>"); only the two members can read it.
// GET  /api/chat?mentors=1&host=<University name>   → published mentors (host first, then everyone)
// GET  /api/chat?list=1                              → my 1:1 rooms with the last message
// GET  /api/chat?room=<id>&after=<ISO time>          → messages (newest 100, or only those after a time for polling)
// POST /api/chat {action:'open', mentor:<public key>} → the 1:1 room with that mentor
// POST /api/chat {action:'send', room, text}          → posts a message (1:1 rooms also send a push to the other member)
import { guard, body, send, currentUser, cleanText, redis, allow, uid, hmac, getJSON, setJSON, scanKeys, sendPush } from './_lib.js';

const GROUP = /^g:[A-Z]{2}\|[^|<>]{2,200}$/, DIRECT = /^d:[a-f0-9]{24}$/;
const KEEP = 300, PAGE = 100;
const mask = name => (String(name || '?').trim()[0] || '?').toUpperCase() + '**';
const tag = id => hmac('chat|' + id).slice(0, 12);

async function mentorList(host) {
  const out = [];
  for (const k of (await scanKeys('mkey:*')).slice(0, 500)) {
    const id = await redis('GET', k); if (!id) continue;
    const u = await getJSON('user:' + id);
    const p = u?.mentor?.profile;
    if (!u || u.mentor?.status !== 'approved' || !p) continue;
    out.push({ key: p.key, name: mask(u.name), av: u.avatar?.id || '', home: p.home || '', major: p.major || '', host: u.plan?.host?.[0] || '',
      offer: p.offer || '', act: p.act || '', club: p.club || '', lab: p.lab || '', course: p.course || '', length: p.length || '', format: p.format || '', sessions: p.sessions || null,
      mode: p.mode || '' });
  }
  return out.sort((a, b) => (b.host === host) - (a.host === host));
}
// the 1:1 room between a student and a mentor (created on first use; also used by session bookings)
export async function openDM(user, mentor, mentorKey) {
  const me = uid(user), mid = uid(mentor);
  const id = 'd:' + hmac('dm|' + [me, mid].sort().join('|')).slice(0, 24);
  if (!(await getJSON('room:' + id))) {
    await setJSON('room:' + id, { members: [me, mid], names: [mask(user.name), mask(mentor.name)], avs: [user.avatar?.id || '', mentor.avatar?.id || ''], mentorKey, mentorUid: mid, at: new Date().toISOString() });
    for (const u of [me, mid]) { await redis('LPUSH', 'myrooms:' + u, id); await redis('LTRIM', 'myrooms:' + u, 0, 99); }
  }
  return id;
}
// a notice from the app inside a 1:1 room (booking updates), shown to both members
export async function systemMessage(room, text) {
  const m = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), u: 'sys', who: '교환가자', av: '', sys: true, text: cleanText(text, 300), at: new Date().toISOString() };
  await redis('LPUSH', 'msgs:' + room, JSON.stringify(m));
  await redis('LTRIM', 'msgs:' + room, 0, KEEP - 1);
}
// members may read; group rooms are open to any signed-in student
async function roomFor(id, user) {
  if (GROUP.test(id)) return { id, kind: 'g' };
  if (!DIRECT.test(id)) return null;
  const r = await getJSON('room:' + id);
  return r && r.members.includes(uid(user)) ? { ...r, id, kind: 'd' } : null;
}
const view = (m, me) => ({ id: m.id, who: m.who, av: m.av, text: m.text, at: m.at, mine: m.u === tag(me), ...(m.sys ? { sys: true } : {}) });

export default async function handler(req, res) {
  if (!guard(req, res, ['GET', 'POST'])) return;
  const user = await currentUser(req);
  if (req.method === 'GET') {
    const q = new URL(req.url, 'http://x').searchParams;
    if (q.get('mentors')) return send(res, 200, { mentors: await mentorList(cleanText(q.get('host'), 200)) });
    if (!user) return send(res, 401, { error: 'login_required' });
    const me = uid(user);
    if (q.get('list')) {
      const ids = [...new Set((await redis('LRANGE', 'myrooms:' + me, 0, 99)) || [])];
      const rooms = [];
      for (const id of ids) {
        const r = await getJSON('room:' + id); if (!r || !r.members.includes(me)) continue;
        const last = (await redis('LRANGE', 'msgs:' + id, 0, 0) || [])[0];
        const peer = r.members[0] === me ? 1 : 0;
        rooms.push({ id, title: r.names[peer], av: r.avs[peer] || '', mentor: r.mentorKey, iAmMentor: r.mentorUid === me, last: last ? view(JSON.parse(last), me) : null });
      }
      return send(res, 200, { rooms });
    }
    const room = await roomFor(String(q.get('room') || ''), user);
    if (!room) return send(res, 404, { error: 'room_not_found' });
    const raw = (await redis('LRANGE', 'msgs:' + room.id, 0, PAGE - 1)) || [];
    const after = q.get('after') || '';
    const msgs = raw.map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(m => m && (!after || m.at > after)).reverse().map(m => view(m, me));
    return send(res, 200, { messages: msgs, title: room.kind === 'd' ? room.names[room.members[0] === me ? 1 : 0] : '' });
  }
  if (!user) return send(res, 401, { error: 'login_required' });
  const b = body(req), me = uid(user);
  if (b.action === 'open') {
    if (typeof b.mentor !== 'string' || !/^m-[a-f0-9]{16}$/.test(b.mentor)) return send(res, 400, { error: 'bad_request' });
    const mid = await redis('GET', 'mkey:' + b.mentor);
    const mentor = mid ? await getJSON('user:' + mid) : null;
    if (!mentor || mentor.mentor?.status !== 'approved') return send(res, 404, { error: 'unknown_mentor' });
    if (mid === me) return send(res, 400, { error: 'own_profile' });
    return send(res, 200, { room: await openDM(user, mentor, b.mentor) });
  }
  if (b.action === 'send') {
    if (!(await allow('chat:' + me, 120, 3600))) return send(res, 429, { error: 'too_many_requests' });
    const room = await roomFor(String(b.room || ''), user);
    if (!room) return send(res, 404, { error: 'room_not_found' });
    const text = cleanText(b.text, 1000);
    if (!text) return send(res, 400, { error: 'empty_message' });
    const m = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), u: tag(me), who: mask(user.name), av: user.avatar?.id || '', text, at: new Date().toISOString() };
    await redis('LPUSH', 'msgs:' + room.id, JSON.stringify(m));
    await redis('LTRIM', 'msgs:' + room.id, 0, KEEP - 1);
    if (room.kind === 'd') {
      const other = room.members.find(x => x !== me);
      await redis('LREM', 'myrooms:' + other, 0, room.id); await redis('LPUSH', 'myrooms:' + other, room.id);
      await redis('LREM', 'myrooms:' + me, 0, room.id); await redis('LPUSH', 'myrooms:' + me, room.id);
      await sendPush(other, `교환가자 · ${m.who}`, text.slice(0, 80), { go: 'chat', room: room.id }).catch(() => 0);
    }
    return send(res, 200, { message: view(m, me) });
  }
  send(res, 400, { error: 'bad_request' });
}
