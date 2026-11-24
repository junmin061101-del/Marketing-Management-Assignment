// POST {email, purpose: 'signup'|'reset'} → emails a 6-digit code. Always answers the same way so it does not reveal who has an account.
import { guard, body, send, normEmail, validEmail, allow, clientIp, getJSON, issueCode, sendMail, codeMail, mailLayout, redis } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const b = body(req), email = normEmail(b.email), purpose = b.purpose === 'reset' ? 'reset' : 'signup';
  if (!validEmail(email)) return send(res, 400, { error: 'bad_email' });
  // one email per minute per address, 5 per hour per address, 20 per hour per network
  if (!(await redis('SET', `cool:${purpose}:${email}`, '1', 'NX', 'EX', 60))) return send(res, 429, { error: 'wait_a_minute' });
  if (!(await allow(`code:${email}`, 5, 3600)) || !(await allow(`code-ip:${clientIp(req)}`, 20, 3600))) return send(res, 429, { error: 'too_many_requests' });
  const user = await getJSON('user:' + email);
  if (purpose === 'signup' && user) {
    await sendMail({ to: email, subject: '[교환가자] 이미 가입된 이메일이에요', html: mailLayout('이미 가입된 이메일이에요', '<p>이 주소로 만든 계정이 있어요. 로그인하거나 비밀번호 찾기를 이용하세요.</p>') });
  } else if (purpose === 'signup' || user) {
    const code = await issueCode(purpose, email);
    await sendMail({ to: email, subject: `[교환가자] 인증 코드 ${code}`, html: codeMail(purpose === 'signup' ? '이메일 인증 코드' : '비밀번호 재설정 코드', code) });
  }
  send(res, 200, { ok: true });
}
