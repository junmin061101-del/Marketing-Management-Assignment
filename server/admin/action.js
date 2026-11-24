// POST {type, key, ...}   key = the account id (phone number; older accounts: email) → admin decisions. Every action is written to the admin log.
//   approve | reject {key, reason?}   pending mentor applications only
//   revoke {key, reason?}             take back an approved mentor and their public profile
//   delete_user {key, confirm}          account deletion request (privacy policy §5); confirm must repeat the key
//   delete_review {mentor, key}       remove a review
import { guard, body, send, isAdmin, normEmail, normPhone, getJSON, redis, cleanText, decideMentor, deleteProof, adminLog, scanKeys } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  if (!(await isAdmin(req))) return send(res, 401, { error: 'admin_login_required' });
  const b = body(req), type = b.type, email = normEmail(b.key ?? b.email), reason = cleanText(b.reason, 300);
  if (type === 'delete_review') {
    if (typeof b.mentor !== 'string' || !/^(sample-[a-z]{2,10}|m-[a-f0-9]{16})$/.test(b.mentor)) return send(res, 400, { error: 'bad_request' });
    const n = await redis('HDEL', 'reviews:' + b.mentor, email);
    await adminLog(type, `${b.mentor} / ${email}`);
    return send(res, 200, { ok: true, removed: n });
  }
  const user = email ? await getJSON('user:' + email) : null;
  if (!user) return send(res, 404, { error: 'user_not_found' });
  if (type === 'approve' || type === 'reject') {
    if (user.mentor?.status !== 'pending') return send(res, 409, { error: 'not_pending' });
    await decideMentor(user, type, reason);
  } else if (type === 'revoke') {
    if (user.mentor?.status !== 'approved') return send(res, 409, { error: 'not_approved' });
    await decideMentor(user, 'revoke', reason);
  } else if (type === 'delete_user') {
    if (normEmail(b.confirm) !== email && normPhone(b.confirm) !== email) return send(res, 400, { error: 'confirm_mismatch' });
    if (user.mentor?.profile?.key) await redis('DEL', 'mkey:' + user.mentor.profile.key);
    for (const k of await scanKeys('reviews:*')) await redis('HDEL', k, email);
    await deleteProof(email);
    await redis('DEL', 'user:' + email);
  } else return send(res, 400, { error: 'bad_request' });
  await adminLog(type, email, reason);
  send(res, 200, { ok: true });
}
