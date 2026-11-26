// Community boards, shared by every student.
// GET  /api/posts?board=all|<CC|University name>&page=0 → { posts }   ("all" lists every post on every board)
// POST /api/posts {action:'create', board, school, cat, text, anon, status} → login required
// POST /api/posts {action:'delete', id}  → your own post only
// POST /api/posts {action:'like', id}    → toggles your like
// Reports go to /api/report (with the post id); the operator removes posts from the admin dashboard.
import { guard, body, send, currentUser, cleanText, redis, allow, uid, hmac, getJSON, setJSON } from './_lib.js';

const CATS = new Set(['visa', 'apply', 'life', 'activity', 'ask', 'free']);
const STAT = new Set(['soon', 'now', 'done']);
const SCHOOL_BOARD = /^[A-Z]{2}\|[^|<>]{2,200}$/;
const PAGE = 30, KEEP = 1000;
const validBoard = b => b === 'all' || SCHOOL_BOARD.test(b);
// Public, non-reversible author tags so readers can hide someone. Anonymous posts get a separate tag,
// so hiding an anonymous writer never reveals which named account wrote them.
const tagOf = (id, anon) => hmac((anon ? 'anon|' : 'author|') + id).slice(0, 12);
const likeTag = id => hmac('like|' + id).slice(0, 16);
// "김민지" → "김**": boards never show full names
const mask = name => (String(name || '?').trim()[0] || '?').toUpperCase() + '**';

function view(p, user) {
  const me = user ? uid(user) : '';
  return {
    id: p.id, board: p.board, school: p.school, cat: p.cat, text: p.text, at: p.at, anon: !!p.anon,
    who: p.anon ? '' : p.who, meta: p.anon ? '' : p.meta, av: p.anon ? '' : p.av, st: p.anon ? '' : p.st,
    by: tagOf(p.author, p.anon), likes: (p.likes || []).length, liked: !!me && (p.likes || []).includes(likeTag(me)), mine: !!me && p.author === me,
  };
}
async function removePost(p) {
  await redis('DEL', 'post:' + p.id);
  await redis('LREM', 'board:all', 0, p.id);
  if (p.board !== 'all') await redis('LREM', 'board:' + p.board, 0, p.id);
  await redis('LREM', 'uposts:' + p.author, 0, p.id);
}
export async function deletePostById(id) { const p = await getJSON('post:' + id); if (p) await removePost(p); return !!p; }
export async function deletePostsOf(author) {
  for (const id of (await redis('LRANGE', 'uposts:' + author, 0, -1)) || []) await deletePostById(id);
  await redis('DEL', 'uposts:' + author);
}

export default async function handler(req, res) {
  if (!guard(req, res, ['GET', 'POST'])) return;
  const user = await currentUser(req);
  if (req.method === 'GET') {
    const q = new URL(req.url, 'http://x').searchParams, board = q.get('board') || 'all', page = Math.max(0, Math.min(30, Number(q.get('page')) || 0));
    if (!validBoard(board)) return send(res, 400, { error: 'bad_board' });
    const ids = (await redis('LRANGE', 'board:' + board, page * PAGE, page * PAGE + PAGE - 1)) || [];
    const raw = ids.length ? (await redis('MGET', ...ids.map(i => 'post:' + i))) || [] : [];
    const posts = raw.map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean).map(p => view(p, user));
    return send(res, 200, { posts, more: ids.length === PAGE });
  }
  if (!user) return send(res, 401, { error: 'login_required' });
  const b = body(req), me = uid(user);
  if (b.action === 'create') {
    if (!(await allow('post:' + me, 20, 3600))) return send(res, 429, { error: 'too_many_requests' });
    const board = String(b.board || ''), text = cleanText(b.text, 1000);
    if (!validBoard(board)) return send(res, 400, { error: 'bad_board' });
    if (!CATS.has(b.cat)) return send(res, 400, { error: 'choose_category' });
    if (text.length < 2) return send(res, 400, { error: 'post_too_short' });
    const pf = user.profile || {}, id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const p = { id, board, school: board === 'all' ? '' : cleanText(b.school, 80), cat: b.cat, text, anon: b.anon === true, author: me,
      who: mask(user.name), meta: [cleanText(pf.major, 40), cleanText(pf.year, 20)].filter(Boolean).join(' · '), av: user.avatar?.id || '',
      st: STAT.has(b.status) ? b.status : '', at: new Date().toISOString(), likes: [] };
    await setJSON('post:' + id, p);
    await redis('LPUSH', 'board:all', id); await redis('LTRIM', 'board:all', 0, KEEP - 1);
    if (board !== 'all') { await redis('LPUSH', 'board:' + board, id); await redis('LTRIM', 'board:' + board, 0, KEEP - 1); }
    await redis('LPUSH', 'uposts:' + me, id);
    return send(res, 200, { post: view(p, user) });
  }
  const id = typeof b.id === 'string' && /^[a-z0-9]{6,20}$/.test(b.id) ? b.id : '';
  const p = id ? await getJSON('post:' + id) : null;
  if (!p) return send(res, 404, { error: 'post_not_found' });
  if (b.action === 'delete') {
    if (p.author !== me) return send(res, 403, { error: 'not_yours' });
    await removePost(p);
    return send(res, 200, { ok: true });
  }
  if (b.action === 'like') {
    if (!(await allow('like:' + me, 200, 3600))) return send(res, 429, { error: 'too_many_requests' });
    const t = likeTag(me), likes = p.likes || [];
    p.likes = likes.includes(t) ? likes.filter(x => x !== t) : [...likes, t].slice(-5000);
    await setJSON('post:' + id, p);
    return send(res, 200, { post: view(p, user) });
  }
  send(res, 400, { error: 'bad_request' });
}
