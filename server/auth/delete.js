// POST {password} → the signed-in student deletes their own account (required by the App Store and good practice).
// Removes the account, their reviews, any mentor proof file and their public mentor ID, then signs them out.
import { deletePostsOf } from '../../api/posts.js';
import { deleteFilesOf } from '../../api/upload.js';
import { guard, body, send, currentUser, checkPassword, redis, scanKeys, deleteProof, endSession, allow, uid, adminLog } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });
  if (!(await allow(`del:${uid(user)}`, 5, 900))) return send(res, 429, { error: 'too_many_requests' });
  const b = body(req);
  if (!user.pw || typeof b.password !== 'string' || !checkPassword(b.password, user.pw)) return send(res, 400, { error: 'wrong_password' });
  const id = uid(user);
  if (user.mentor?.profile?.key) await redis('DEL', 'mkey:' + user.mentor.profile.key);
  for (const k of await scanKeys('reviews:*')) await redis('HDEL', k, id);
  await deleteProof(id);
  await redis('DEL', 'user:' + id);
  await redis('DEL', 'push:' + id);
  await deletePostsOf(id);
  await redis('DEL', 'myrooms:' + id);
  await redis('DEL', 'mybk:' + id);  // the other side keeps the booking (masked name); fee records stay in admin:fees for tax law
  await deleteFilesOf(id);  // photos and videos sent in chats
  if (user.avatar?.id) await redis('DEL', 'avatar:' + user.avatar.id);
  await endSession(req, res);
  await adminLog('self_delete', id);
  send(res, 200, { ok: true });
}
