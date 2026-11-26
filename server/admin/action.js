// POST {type, key, ...}   key = the account id (phone number; older accounts: email) → admin decisions. Every action is written to the admin log.
//   approve | reject {key, reason?}   pending mentor applications only
//   revoke {key, reason?}             take back an approved mentor and their public profile
//   delete_user {key, confirm}          account deletion request (privacy policy §5); confirm must repeat the key
//   reset_password {key}              returns a temporary password to pass on to the student
//   delete_review {mentor, key}       remove a review
//   refund_fee {id}                   give a mentor back the 5% fee of a session (after checking a report)
import crypto from 'node:crypto';
import { deletePostById, deleteComment } from '../../api/posts.js';
import { refundFee } from '../../api/sessions.js';
import { guard, body, send, isAdmin, hashPassword, saveUser, normEmail, normPhone, getJSON, redis, cleanText, decideMentor, deleteProof, adminLog, scanKeys, allow, sendPush, pushConfigured } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  if (!(await isAdmin(req))) return send(res, 401, { error: 'admin_login_required' });
  if (!(await allow('adm-action', 300, 3600))) return send(res, 429, { error: 'too_many_requests' });
  const b = body(req), type = b.type, email = normEmail(b.key ?? b.email), reason = cleanText(b.reason, 300);
  if (type === 'delete_review') {
    if (typeof b.mentor !== 'string' || !/^(sample-[a-z]{2,10}|m-[a-f0-9]{16})$/.test(b.mentor)) return send(res, 400, { error: 'bad_request' });
    const n = await redis('HDEL', 'reviews:' + b.mentor, email);
    await adminLog(type, `${b.mentor} / ${email}`);
    return send(res, 200, { ok: true, removed: n });
  }
  if (type === 'refund_fee') {
    const id = typeof b.id === 'string' && /^[a-z0-9]{10,24}$/.test(b.id) ? b.id : '';
    const bk = id ? await getJSON('bk:' + id) : null;
    if (!bk) return send(res, 404, { error: 'session_not_found' });
    if (!bk.pay?.paidAt) return send(res, 409, { error: 'no_fee_paid' });
    if (bk.pay.refundedAt) return send(res, 409, { error: 'already_refunded' });
    if (!(await refundFee(bk, reason || '운영자 환불'))) return send(res, 502, { error: 'refund_failed' });
    await adminLog(type, id, reason);
    return send(res, 200, { ok: true });
  }
  if (type === 'delete_comment') {
    const id = typeof b.id === 'string' && /^[a-z0-9]{6,20}$/.test(b.id) ? b.id : '', cid = typeof b.cid === 'string' ? b.cid.slice(0, 20) : '';
    if (!id || !cid) return send(res, 400, { error: 'bad_request' });
    const removed = await deleteComment(id, cid);
    await adminLog(type, `${id}/${cid}`, reason);
    return send(res, 200, { ok: true, removed });
  }
  if (type === 'delete_post') {
    const id = typeof b.id === 'string' && /^[a-z0-9]{6,20}$/.test(b.id) ? b.id : '';
    if (!id) return send(res, 400, { error: 'bad_request' });
    const removed = await deletePostById(id);
    await adminLog(type, id, reason);
    return send(res, 200, { ok: true, removed });
  }
  // announcement push to everyone who turned notifications on in the app
  if (type === 'broadcast') {
    const title = cleanText(b.title, 60), text = cleanText(b.text, 200);
    if (!title || !text) return send(res, 400, { error: 'bad_request' });
    if (!pushConfigured()) return send(res, 503, { error: 'push_not_configured' });
    let users = 0, sent = 0;
    for (const k of (await scanKeys('push:*')).slice(0, 2000)) { const n = await sendPush(k.slice(5), title, text, { go: 'home' }).catch(() => 0); users++; sent += n; }
    await adminLog(type, `${sent}대 발송`, title);
    return send(res, 200, { ok: true, users, sent });
  }
  const user = email ? await getJSON('user:' + email) : null;
  if (!user) return send(res, 404, { error: 'user_not_found' });
  if (type === 'approve' || type === 'reject') {
    if (user.mentor?.status !== 'pending') return send(res, 409, { error: 'not_pending' });
    await decideMentor(user, type, reason);
  } else if (type === 'revoke') {
    if (user.mentor?.status !== 'approved') return send(res, 409, { error: 'not_approved' });
    await decideMentor(user, 'revoke', reason);
  } else if (type === 'reset_password') {
    const temp = 'gg' + crypto.randomInt(10 ** 7, 10 ** 8);
    user.pw = hashPassword(temp);
    await saveUser(user);
    await adminLog(type, email);
    return send(res, 200, { ok: true, temp });
  } else if (type === 'delete_avatar') {
    if (user.avatar?.id) await redis('DEL', 'avatar:' + user.avatar.id);
    user.avatar = null;
    await saveUser(user);
  } else if (type === 'delete_user') {
    if (normEmail(b.confirm) !== email && normPhone(b.confirm) !== email) return send(res, 400, { error: 'confirm_mismatch' });
    if (user.avatar?.id) await redis('DEL', 'avatar:' + user.avatar.id);
    if (user.mentor?.profile?.key) await redis('DEL', 'mkey:' + user.mentor.profile.key);
    for (const k of await scanKeys('reviews:*')) await redis('HDEL', k, email);
    await deleteProof(email);
    await redis('DEL', 'user:' + email);
  } else return send(res, 400, { error: 'bad_request' });
  await adminLog(type, email, reason);
  send(res, 200, { ok: true });
}
