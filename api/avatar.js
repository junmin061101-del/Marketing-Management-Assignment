// Profile photos.
// GET  /api/avatar?id=<public id>      → the JPEG/PNG (public id is a keyed hash, so the URL does not reveal the login ID)
// POST /api/avatar { image: data URL } → set your own photo
//   Spec: JPEG only, exactly 320×320 px, at most 150 KB. The app crops the chosen JPEG to a square and
//   re-encodes it to this size (quality 0.85) before sending; anything else is refused.
// POST /api/avatar { remove: true }    → remove your photo
import { guard, body, send, currentUser, saveUser, publicUser, redis, allow, uid, hmac } from './_lib.js';

const MAX = 150 * 1024, SIZE = 320;
const avatarId = u => 'a-' + hmac('avatar|' + uid(u)).slice(0, 20);
// A complete JPEG (starts FF D8, ends FF D9); returns its pixel size from the frame header, or null.
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

export default async function handler(req, res) {
  if (!guard(req, res, ['GET', 'POST'])) return;
  if (req.method === 'GET') {
    const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
    if (!/^a-[a-f0-9]{20}$/.test(id)) return send(res, 400, { error: 'bad_request' });
    const v = await redis('GET', 'avatar:' + id);
    if (!v) return send(res, 404, { error: 'not_found' });
    const [type, data] = String(v).split('|');
    const buf = Buffer.from(data, 'base64');
    res.statusCode = 200;
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // the app adds ?v=<version>, so a new photo shows at once
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // the iOS/Android app shows it from its own origin
    return res.end(buf);
  }
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });
  if (!(await allow('avatar:' + uid(user), 20, 86400))) return send(res, 429, { error: 'too_many_requests' });
  const b = body(req), id = avatarId(user);
  if (b.remove === true) {
    await redis('DEL', 'avatar:' + id);
    user.avatar = null;
  } else {
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(typeof b.image === 'string' ? b.image : '');
    if (!m) return send(res, 415, { error: 'jpeg_only' });
    const buf = Buffer.from(m[1], 'base64'), dim = jpegSize(buf);
    if (!dim) return send(res, 415, { error: 'jpeg_only' });
    if (dim.w !== SIZE || dim.h !== SIZE) return send(res, 400, { error: 'bad_image_size' });
    if (buf.length > MAX) return send(res, 413, { error: 'file_too_large' });
    await redis('SET', 'avatar:' + id, 'image/jpeg|' + buf.toString('base64'));
    user.avatar = { id, v: Date.now() };
  }
  await saveUser(user);
  send(res, 200, { user: publicUser(user) });
}
