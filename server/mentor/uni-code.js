// POST {uniEmail} → sends a code to the mentor's university email (.ac.kr / .edu).
import { guard, body, send, currentUser, normEmail, validEmail, isUniEmail, allow, redis, issueCode, sendMail, codeMail, uid } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });
  const uni = normEmail(body(req).uniEmail);
  if (!validEmail(uni) || !isUniEmail(uni)) return send(res, 400, { error: 'not_university_email' });
  if (!(await redis('SET', `cool:uni:${uid(user)}`, '1', 'NX', 'EX', 60))) return send(res, 429, { error: 'wait_a_minute' });
  if (!(await allow(`uni:${uid(user)}`, 5, 3600))) return send(res, 429, { error: 'too_many_requests' });
  const code = await issueCode('uni', uid(user), { uni });
  await sendMail({ to: uni, subject: `[교환가자] 학교 이메일 인증 코드 ${code}`, html: codeMail('학교 이메일 인증 코드', code) });
  send(res, 200, { ok: true });
}
