// Chats between real students, stored on the server.
//   Group chat: one room per school community ("g:<CC|University name>"), open to signed-in students.
//   1:1 chat:   a student and a published mentor ("d:<hash>"); only the two members can read it.
// GET  /api/chat?mentors=1&host=<University name>   → published mentors (host first, then everyone)
// GET  /api/chat?list=1&groups=["CC|Name",…]        → my 1:1 rooms and my group chats, each with the last message and my unread count
// Read receipts (like KakaoTalk): seen:<room> holds, per member who opened the room, when they last read it.
// Opening or polling a room marks it read; each message shows how many members have not read it yet.
// GET  /api/chat?room=<id>&after=<ISO time>          → messages (newest 100, or only those after a time for polling)
// POST /api/chat {action:'open', mentor:<public key>} → the 1:1 room with that mentor
// POST /api/chat {action:'notice', room, text | poll}  → pins a notice (or a poll) at the top of the room (anyone in the room; empty removes it)
// POST /api/chat {action:'poll', room, q, opts, multi, anon, notice} → posts a poll (2–6 options); it closes by itself after 24 hours;
//      anon = only counts are shown (otherwise who chose what); notice = also pin it as the room notice
// POST /api/chat {action:'vote', room, id, choice:[i]} → my choice in a poll ([] withdraws it) · {action:'closePoll', room, id} (its maker)
// POST /api/chat {action:'send', room, text, file? | files?} → posts a message (files = up to 30 photos shown together) (1:1 rooms also send a push to the other member);
//      file = {url, kind:'image'|'video', w, h, name} of a photo or video uploaded to Blob through /api/upload
import { guard, body, send, currentUser, cleanText, redis, allow, uid, hmac, getJSON, setJSON, scanKeys, sendPush } from './_lib.js';

const GROUP = /^g:[A-Z]{2}\|[^|<>]{2,200}$/, DIRECT = /^d:[a-f0-9]{24}$/;
const KEEP = 300, PAGE = 100;
// students are shown as 김**; verified mentors by their full name (they passed the university and transcript checks)
const fullName = u => String(u?.name || '').trim() || '?';
const mask = name => (String(name || '?').trim()[0] || '?').toUpperCase() + '**';
const tag = id => hmac('chat|' + id).slice(0, 12);

async function mentorList(host) {
  const out = [];
  for (const k of (await scanKeys('mkey:*')).slice(0, 500)) {
    const id = await redis('GET', k); if (!id) continue;
    const u = await getJSON('user:' + id);
    const p = u?.mentor?.profile;
    if (!u || u.mentor?.status !== 'approved' || !p) continue;
    out.push({ key: p.key, name: fullName(u), av: u.avatar?.id || '', home: p.home || '', major: p.major || '', host: p.host || u.plan?.host?.[0] || '', hostCC: p.hostCC || u.plan?.host?.[1] || '',
      year: p.year || (u.plan?.dep ? Number(u.plan.dep.slice(0, 4)) : null), prog: p.prog || '',
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
    await setJSON('room:' + id, { members: [me, mid], names: [mask(user.name), fullName(mentor)], avs: [user.avatar?.id || '', mentor.avatar?.id || ''], mentorKey, mentorUid: mid, at: new Date().toISOString() });
    for (const u of [me, mid]) { await redis('LPUSH', 'myrooms:' + u, id); await redis('LTRIM', 'myrooms:' + u, 0, 99); }
    await redis('HSET', 'seen:' + id, mid, '0');  // both members count as readers from the start
    await markRead(id, me);
  }
  return id;
}
// a notice from the app inside a 1:1 room (booking updates), shown to both members
export async function systemMessage(room, text) {
  const m = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), u: 'sys', who: '교환가자', av: '', sys: true, text: cleanText(text, 300), at: new Date().toISOString() };
  await redis('LPUSH', 'msgs:' + room, JSON.stringify(m));
  await redis('LTRIM', 'msgs:' + room, 0, KEEP - 1);
}
// the Blob folder a room's attachments go into (the app gets it with the messages)
export const folderOf = room => 'chat/' + hmac('files|' + room).slice(0, 16) + '/';
// members may read; group rooms are open to any signed-in student
export async function roomFor(id, user) {
  if (GROUP.test(id)) return { id, kind: 'g' };
  if (!DIRECT.test(id)) return null;
  const r = await getJSON('room:' + id);
  return r && r.members.includes(uid(user)) ? { ...r, id, kind: 'd' } : null;
}
const view = (m, me) => ({ id: m.id, by: m.u, who: m.who, av: m.av, text: m.text, at: m.at, mine: m.u === tag(me), ...(m.sys ? { sys: true } : {}), ...(m.file ? { file: m.file } : {}), ...(m.files ? { files: m.files } : {}), ...(m.poll ? { poll: true } : {}) });
// when each member last read a room: {account id: ISO time}
async function seenOf(room) { const f = (await redis('HGETALL', 'seen:' + room)) || [], o = {}; for (let i = 0; i < f.length; i += 2) o[f[i]] = f[i + 1]; return o; }
const markRead = (room, me) => redis('HSET', 'seen:' + room, me, new Date().toISOString());
// messages from others I have not read yet (newest 100 checked; shown as 99+ in the app beyond that)
async function unreadOf(room, me, seen) {
  const read = (seen || await seenOf(room))[me] || '', mine = tag(me);
  return ((await redis('LRANGE', 'msgs:' + room, 0, 99)) || []).reduce((n, v) => { try { const m = JSON.parse(v); return n + (m.at > read && m.u !== mine ? 1 : 0); } catch { return n; } }, 0);
}
// polls: pollm:<room>:<id> = {q, opts, multi, anon, by(tag), at, closed}; pollv:<room>:<id> = {account id: JSON {c:[option indexes], w:name}}
const POLL_HOURS = 24;
const pollEnds = m => Date.parse(m.at) + POLL_HOURS * 3600e3;
const pollClosed = m => !!m.closed || Date.now() >= pollEnds(m);
async function pollView(room, id, me) {
  const m = await getJSON(`pollm:${room}:${id}`); if (!m) return null;
  const f = (await redis('HGETALL', `pollv:${room}:${id}`)) || [], counts = m.opts.map(() => 0), names = m.opts.map(() => []); let voters = 0, mine = [];
  for (let i = 0; i < f.length; i += 2) {
    let v = {}; try { v = JSON.parse(f[i + 1]); } catch {} if (Array.isArray(v)) v = { c: v };  // older votes were a bare list
    const c = v.c || []; if (!c.length) continue;
    voters++; c.forEach(x => { counts[x]++; if (!m.anon) names[x].push(v.w || '?'); }); if (f[i] === me) mine = c;
  }
  return { q: m.q, opts: m.opts, multi: !!m.multi, anon: !!m.anon, closed: pollClosed(m), ends: new Date(pollEnds(m)).toISOString(), counts, voters, mine, maker: m.by === tag(me), ...(m.anon ? {} : { names }) };
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
async function post(room, m) { await redis('LPUSH', 'msgs:' + room, JSON.stringify(m)); await redis('LTRIM', 'msgs:' + room, 0, KEEP - 1); }
// an attachment must be a file this room's folder holds in our Blob store
function cleanFile(f, room) {
  if (!f || typeof f !== 'object' || typeof f.url !== 'string') return null;
  let u; try { u = new URL(f.url); } catch { return null; }
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.public.blob.vercel-storage.com') || !u.pathname.startsWith('/' + folderOf(room)) || u.search) return null;
  const kind = f.kind === 'video' ? 'video' : f.kind === 'image' ? 'image' : '';
  const n = v => (Number.isInteger(v) && v > 0 && v <= 10000 ? v : 0);
  return kind ? { url: u.href, kind, w: n(f.w), h: n(f.h), name: cleanText(f.name, 80) } : null;
}

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
        if (r.members[peer] === r.mentorUid) r.names[peer] = fullName(await getJSON('user:' + r.mentorUid)) || r.names[peer];
        rooms.push({ id, title: r.names[peer], av: r.avs[peer] || '', mentor: r.mentorKey, iAmMentor: r.mentorUid === me, last: last ? view(JSON.parse(last), me) : null, unread: last ? await unreadOf(id, me) : 0 });
      }
      // the last message of each joined school community group chat (groups = JSON list of "CC|University")
      const groups = {}, unread = {};
      let keys = []; try { keys = JSON.parse(q.get('groups') || '[]'); } catch {}
      for (const k of (Array.isArray(keys) ? keys : []).slice(0, 20)) {
        const id = 'g:' + k; if (typeof k !== 'string' || !GROUP.test(id)) continue;
        if ((user.communities || []).some(c => c.k === k) && !(await redis('HGET', 'seen:' + id, me))) await redis('HSET', 'seen:' + id, me, '0');  // members who joined earlier
        const last = (await redis('LRANGE', 'msgs:' + id, 0, 0) || [])[0];
        if (last) { groups[id] = view(JSON.parse(last), me); unread[id] = await unreadOf(id, me); }
      }
      return send(res, 200, { rooms, groups, unread });
    }
    const room = await roomFor(String(q.get('room') || ''), user);
    if (!room) return send(res, 404, { error: 'room_not_found' });
    const raw = (await redis('LRANGE', 'msgs:' + room.id, 0, PAGE - 1)) || [];
    const after = q.get('after') || '';
    const msgs = raw.map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(m => m && (!after || m.at > after)).reverse().map(m => view(m, me));
    await markRead(room.id, me);
    // who has read up to when, by message tag (never account ids): the app counts unread readers per message
    const seen = {}; for (const [u, at] of Object.entries(await seenOf(room.id))) if (room.kind === 'g' || room.members.includes(u)) seen[tag(u)] = at;
    let title = '', peerMentor = false;
    if (room.kind === 'd') { const peer = room.members[0] === me ? 1 : 0; peerMentor = room.members[peer] === room.mentorUid; title = peerMentor ? fullName(await getJSON('user:' + room.mentorUid)) : room.names[peer]; }
    // polls among the latest messages (counts change, so they come with every poll of the room) and the pinned notice
    const polls = {};
    for (const v of raw) { try { const m = JSON.parse(v); if (m.poll) polls[m.id] = await pollView(room.id, m.id, me); } catch {} }
    return send(res, 200, { messages: msgs, seen, title, peerMentor, folder: folderOf(room.id), polls, notice: await getJSON('notice:' + room.id) });
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
  if (['notice', 'poll', 'vote', 'closePoll'].includes(b.action)) {
    if (!(await allow('chat:' + me, 120, 3600))) return send(res, 429, { error: 'too_many_requests' });
    const room = await roomFor(String(b.room || ''), user);
    if (!room) return send(res, 404, { error: 'room_not_found' });
    const who = room.kind === 'd' && room.mentorUid === me && user.mentor?.status === 'approved' ? fullName(user) : mask(user.name);
    if (b.action === 'notice') {
      let text = cleanText(b.text, 300), poll = '';
      if (b.poll) { const pm = /^[a-z0-9]{6,20}$/.test(String(b.poll)) ? await getJSON(`pollm:${room.id}:${b.poll}`) : null; if (!pm) return send(res, 404, { error: 'poll_not_found' }); poll = String(b.poll); text = '투표: ' + pm.q; }
      if (text) await setJSON('notice:' + room.id, { text, who, at: new Date().toISOString(), ...(poll ? { poll } : {}) }); else await redis('DEL', 'notice:' + room.id);
      await post(room.id, { id: newId(), u: 'sys', who: '교환가자', av: '', sys: true, text: text ? `${who} 님이 공지를 등록했어요: ${text.slice(0, 80)}` : `${who} 님이 공지를 내렸어요.`, at: new Date().toISOString() });
      return send(res, 200, { notice: text ? await getJSON('notice:' + room.id) : null });
    }
    if (b.action === 'poll') {
      const q = cleanText(b.q, 120), opts = (Array.isArray(b.opts) ? b.opts : []).map(o => cleanText(o, 60)).filter(Boolean).slice(0, 6);
      if (!q || opts.length < 2 || new Set(opts).size !== opts.length) return send(res, 400, { error: 'bad_poll' });
      const m = { id: newId(), u: tag(me), who, av: user.avatar?.id || '', text: '', poll: true, at: new Date().toISOString() };
      await setJSON(`pollm:${room.id}:${m.id}`, { q, opts, multi: b.multi === true, anon: b.anon === true, by: tag(me), at: m.at });
      await post(room.id, m); await markRead(room.id, me);
      if (b.notice === true) await setJSON('notice:' + room.id, { text: '투표: ' + q, who, at: m.at, poll: m.id });
      if (room.kind === 'd') await sendPush(room.members.find(x => x !== me), `교환가자 · ${who}`, `투표: ${q}`, { go: 'chat', room: room.id }).catch(() => 0);
      return send(res, 200, { message: view(m, me), poll: await pollView(room.id, m.id, me) });
    }
    const id = String(b.id || ''), meta = /^[a-z0-9]{6,20}$/.test(id) ? await getJSON(`pollm:${room.id}:${id}`) : null;
    if (!meta) return send(res, 404, { error: 'poll_not_found' });
    if (b.action === 'closePoll') {
      if (meta.by !== tag(me)) return send(res, 403, { error: 'not_yours' });
      meta.closed = true; await setJSON(`pollm:${room.id}:${id}`, meta);
    } else {
      if (pollClosed(meta)) return send(res, 409, { error: 'poll_closed' });
      const c = [...new Set((Array.isArray(b.choice) ? b.choice : []).filter(x => Number.isInteger(x) && x >= 0 && x < meta.opts.length))].sort();
      if (!meta.multi && c.length > 1) return send(res, 400, { error: 'bad_poll' });
      if (c.length) await redis('HSET', `pollv:${room.id}:${id}`, me, JSON.stringify({ c, w: who })); else await redis('HDEL', `pollv:${room.id}:${id}`, me);
    }
    return send(res, 200, { poll: await pollView(room.id, id, me) });
  }
  if (b.action === 'send') {
    if (!(await allow('chat:' + me, 120, 3600))) return send(res, 429, { error: 'too_many_requests' });
    const room = await roomFor(String(b.room || ''), user);
    if (!room) return send(res, 404, { error: 'room_not_found' });
    const text = cleanText(b.text, 1000), file = b.file ? cleanFile(b.file, room.id) : null;
    const files = Array.isArray(b.files) ? b.files.slice(0, 30).map(f => cleanFile(f, room.id)) : null;  // several photos in one message
    if ((b.file && !file) || (files && (!files.length || files.some(f => !f || f.kind !== 'image')))) return send(res, 400, { error: 'bad_file' });
    if (!text && !file && !files) return send(res, 400, { error: 'empty_message' });
    const asMentor = room.kind === 'd' && room.mentorUid === me && user.mentor?.status === 'approved';
    const m = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), u: tag(me), who: asMentor ? fullName(user) : mask(user.name), av: user.avatar?.id || '', text, ...(file ? { file } : {}), ...(files ? { files } : {}), at: new Date().toISOString() };
    for (const f of file ? [file] : files || []) await redis('LPUSH', 'files:' + me, f.url);  // removed with the account
    if (file || files) await redis('LTRIM', 'files:' + me, 0, 1999);
    await redis('LPUSH', 'msgs:' + room.id, JSON.stringify(m));
    await redis('LTRIM', 'msgs:' + room.id, 0, KEEP - 1);
    await markRead(room.id, me);
    if (room.kind === 'd') {
      const other = room.members.find(x => x !== me);
      await redis('LREM', 'myrooms:' + other, 0, room.id); await redis('LPUSH', 'myrooms:' + other, room.id);
      await redis('LREM', 'myrooms:' + me, 0, room.id); await redis('LPUSH', 'myrooms:' + me, room.id);
      await sendPush(other, `교환가자 · ${m.who}`, text.slice(0, 80) || (files ? `사진 ${files.length}장을 보냈어요` : file.kind === 'video' ? '동영상을 보냈어요' : '사진을 보냈어요'), { go: 'chat', room: room.id }).catch(() => 0);
    }
    return send(res, 200, { message: view(m, me) });
  }
  send(res, 400, { error: 'bad_request' });
}
