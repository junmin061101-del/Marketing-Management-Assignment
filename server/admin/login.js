// POST {email} → emails a 6-digit sign-in code, but only to an admin address (ADMIN_EMAIL or REVIEW_EMAIL).
// Limits apply to every address the same way, so the answer never reveals which address is the admin.
import { guard, body, send, normEmail, validEmail, adminEmails, isAdminEmail, issueCode, sendMail, codeMail, allow, clientIp, redis } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  if (!adminEmails().length) return send(res, 503, { error: 'admin_not_configured' });
  const email = normEmail(body(req).email);
  if (!validEmail(email)) return send(res, 400, { error: 'bad_email' });
  if (!(await allow(`adm-code-ip:${clientIp(req)}`, 10, 3600))) return send(res, 429, { error: 'too_many_requests' });
  if (!(await redis('SET', `cool:adm:${email}`, '1', 'NX', 'EX', 30))) return send(res, 429, { error: 'wait_a_minute' });
  if (!(await allow(`adm-code:${email}`, 6, 3600))) return send(res, 429, { error: 'too_many_requests' });
  if (isAdminEmail(email)) {
    const code = await issueCode('admin', email);
    try { await sendMail({ to: email, subject: `[교환가자] 관리자 로그인 코드 ${code}`, html: codeMail('관리자 로그인 코드', code) }); }
    catch (e) { return send(res, 502, { error: 'mail_failed' }); }
  }
  send(res, 200, { ok: true });
}
