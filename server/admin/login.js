// POST {email} → emails a 6-digit sign-in code, but only when the address is ADMIN_EMAIL.
// The answer is the same either way, so nobody can find out which address is the admin.
import { guard, body, send, normEmail, adminEmail, issueCode, sendMail, codeMail, allow, clientIp, redis } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  if (!adminEmail()) return send(res, 503, { error: 'admin_not_configured' });
  if (!(await allow(`adm-code-ip:${clientIp(req)}`, 10, 3600))) return send(res, 429, { error: 'too_many_requests' });
  const email = normEmail(body(req).email);
  if (email === adminEmail() && (await allow('adm-code', 6, 3600)) && (await redis('SET', 'cool:adm', '1', 'NX', 'EX', 30))) {
    const code = await issueCode('admin', email);
    await sendMail({ to: email, subject: '[교환가자] 관리자 로그인 코드', html: codeMail('관리자 로그인 코드', code) });
  }
  send(res, 200, { ok: true });
}
