// Community boards, shared by every student.
// GET  /api/posts?board=all|<CC|University name>&page=0 → { posts }   ("all" lists every post on every board)
// POST /api/posts {action:'create', board, school, cat, text, anon, status} → login required
// POST /api/posts {action:'delete', id}  → your own post only
// POST /api/posts {action:'like', id}    → toggles your like
// GET  /api/posts?id=<id>                → one post with its comments (for the post view and shared links)
// POST /api/posts {action:'comment', id, text, anon} · {action:'uncomment', id, cid} → comments (yours to delete)
// Reports go to /api/report (with the post id); the operator removes posts from the admin dashboard.
import { guard, body, send, currentUser, cleanText, redis, allow, uid, hmac, getJSON, setJSON, sendPush } from './_lib.js';

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
    by: tagOf(p.author, p.anon), nc: p.nc || 0, likes: (p.likes || []).length, liked: !!me && (p.likes || []).includes(likeTag(me)), mine: !!me && p.author === me,
  };
}
const cview = (c, me) => ({ cid: c.cid, text: c.text, at: c.at, anon: !!c.anon, who: c.anon ? '' : c.who, meta: c.anon ? '' : c.meta, av: c.anon ? '' : c.av,
  by: tagOf(c.author, c.anon), mine: !!me && c.author === me });
async function comments(id) { return ((await redis('LRANGE', 'cmts:' + id, 0, 199)) || []).map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean).reverse(); }
export async function deleteComment(id, cid, onlyAuthor) {
  const p = await getJSON('post:' + id); if (!p) return false;
  const raw = (await redis('LRANGE', 'cmts:' + id, 0, -1)) || [];
  const hit = raw.find(v => { try { const c = JSON.parse(v); return c.cid === cid && (!onlyAuthor || c.author === onlyAuthor); } catch { return false; } });
  if (!hit) return false;
  await redis('LREM', 'cmts:' + id, 0, hit);
  p.nc = Math.max(0, (p.nc || 1) - 1); await setJSON('post:' + id, p);
  return true;
}
async function removePost(p) {
  await redis('DEL', 'post:' + p.id);
  await redis('DEL', 'cmts:' + p.id);
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
    const q0 = new URL(req.url, 'http://x').searchParams;
    if (q0.get('id')) {
      const one = /^[a-z0-9]{6,20}$/.test(q0.get('id')) ? await getJSON('post:' + q0.get('id')) : null;
      if (!one) return send(res, 404, { error: 'post_not_found' });
      const me0 = user ? uid(user) : '';
      return send(res, 200, { post: view(one, user), comments: (await comments(one.id)).map(c => cview(c, me0)) });
    }
    const q = q0, board = q.get('board') || 'all', page = Math.max(0, Math.min(30, Number(q.get('page')) || 0));
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
  if (b.action === 'comment') {
    if (!(await allow('cmt:' + me, 60, 3600))) return send(res, 429, { error: 'too_many_requests' });
    const text = cleanText(b.text, 500);
    if (text.length < 1) return send(res, 400, { error: 'empty_message' });
    const pf = user.profile || {};
    const c = { cid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), author: me, anon: b.anon === true, who: mask(user.name),
      meta: [cleanText(pf.major, 40), cleanText(pf.year, 20)].filter(Boolean).join(' · '), av: user.avatar?.id || '', text, at: new Date().toISOString() };
    await redis('LPUSH', 'cmts:' + id, JSON.stringify(c)); await redis('LTRIM', 'cmts:' + id, 0, 499);
    p.nc = (p.nc || 0) + 1; await setJSON('post:' + id, p);
    if (p.author !== me) await sendPush(p.author, '교환가자 · 새 댓글', text.slice(0, 80), { go: 'post', id }).catch(() => 0);
    return send(res, 200, { comment: cview(c, me), post: view(p, user) });
  }
  if (b.action === 'uncomment') {
    const ok = typeof b.cid === 'string' && await deleteComment(id, b.cid, me);
    return ok ? send(res, 200, { ok: true }) : send(res, 404, { error: 'comment_not_found' });
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
