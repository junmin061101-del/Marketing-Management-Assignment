// POST {phone} → texts a 6-digit login code. The same answer whether or not the number has an account.
// Limits protect both the student and the SMS bill: 1 per minute and 5 per hour per number,
// 20 per hour per network, and SMS_DAILY_LIMIT (default 500) for the whole service per day.
import { guard, body, send, normPhone, smsConfigured, sendSms, issueCode, allow, clientIp, redis } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  if (!smsConfigured()) return send(res, 503, { error: 'sms_not_configured' });
  const phone = normPhone(body(req).phone);
  if (!phone) return send(res, 400, { error: 'bad_phone' });
  if (!(await redis('SET', `cool:phone:${phone}`, '1', 'NX', 'EX', 60))) return send(res, 429, { error: 'wait_a_minute' });
  if (!(await allow(`sms:${phone}`, 5, 3600)) || !(await allow(`sms-ip:${clientIp(req)}`, 20, 3600))) return send(res, 429, { error: 'too_many_requests' });
  if (!(await allow(`sms-day:${new Date().toISOString().slice(0, 10)}`, Number(process.env.SMS_DAILY_LIMIT || 500), 90000))) return send(res, 429, { error: 'too_many_requests' });
  const code = await issueCode('phone', phone);
  try { await sendSms(phone, `[교환가자] 인증번호 ${code}\n10분 안에 입력하세요. 타인에게 알려주지 마세요.`); }
  catch (e) { await redis('DEL', `cool:phone:${phone}`); return send(res, 502, { error: 'sms_failed' }); }
  send(res, 200, { ok: true });
}
