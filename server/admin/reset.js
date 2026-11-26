// TEMPORARY (removed right after use): clears every chat and every community post.
// POST /api/admin/reset with header x-reset-token = RESET_TOKEN (a one-off Vercel env var); ?dry=1 only counts.
// Keeps accounts, joined communities, mentor bookings and reports.
import { list, del } from '@vercel/blob';
import { send, redis, scanKeys, safeEqual, adminLog } from '../../api/_lib.js';

const PATTERNS = ['msgs:*', 'room:*', 'myrooms:*', 'files:*', 'post:*', 'board:*', 'uposts:*', 'cmts:*'];
export default async function handler(req, res) {
  const t = process.env.RESET_TOKEN || '';
  if (req.method !== 'POST' || t.length < 32 || !safeEqual(String(req.headers['x-reset-token'] || ''), t)) return send(res, 403, { error: 'forbidden' });
  const dry = new URL(req.url, 'http://x').searchParams.get('dry') === '1';
  const counts = {};
  for (const p of PATTERNS) {
    const keys = await scanKeys(p);
    counts[p] = keys.length;
    if (!dry) for (const k of keys) await redis('DEL', k);
  }
  let files = 0, cursor;
  if (process.env.BLOB_READ_WRITE_TOKEN) do {
    const r = await list({ prefix: 'chat/', cursor, limit: 1000 });
    files += r.blobs.length;
    if (!dry && r.blobs.length) await del(r.blobs.map(b => b.url));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  counts.chatFiles = files;
  counts.bookings = (await scanKeys('bk:*')).length;
  if (!dry) await adminLog('reset_community', 'chats and posts', JSON.stringify(counts).slice(0, 200));
  send(res, 200, { dry, counts });
}
