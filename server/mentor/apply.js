// POST {file:{name, data(base64)}} → checks the proof of completion really is a PDF, JPG or PNG (by its bytes, not its name),
// keeps it for the admin dashboard (deleted after 30 days), emails it to the operations team with signed
// approve / reject links, and sets the status to "pending".
import { guard, body, send, currentUser, saveUser, publicUser, allow, sendMail, mailLayout, escHtml, hmac, cleanText, saveProof, uid, contactEmail, sendSms, smsConfigured } from '../../api/_lib.js';

const MAX = 3 * 1024 * 1024; // Vercel functions accept about 4.5 MB per request; base64 adds a third
const kind = buf => buf.subarray(0, 5).toString('latin1') === '%PDF-' ? ['pdf', 'application/pdf']
  : buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff ? ['jpg', 'image/jpeg']
  : buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? ['png', 'image/png'] : null;

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });
  if (!user.mentor?.uniVerified) return send(res, 400, { error: 'verify_university_email_first' });
  if (user.mentor.status === 'approved') return send(res, 400, { error: 'already_approved' });
  if (!(await allow(`apply:${uid(user)}`, 3, 86400))) return send(res, 429, { error: 'too_many_requests' });
  const f = body(req).file || {};
  if (typeof f.data !== 'string' || f.data.length > Math.ceil(MAX / 3) * 4 + 8) return send(res, 413, { error: 'file_too_large' });
  const buf = Buffer.from(f.data, 'base64');
  if (!buf.length || buf.length > MAX) return send(res, 413, { error: 'file_too_large' });
  const k = kind(buf);
  if (!k) return send(res, 415, { error: 'pdf_jpg_png_only' });
  const id = uid(user), filename = `proof-${id.replace(/[^a-z0-9]/g, '_')}.${k[0]}`;
  await saveProof(id, buf, k[1], cleanText(f.name, 120));
  const exp = Date.now() + 7 * 86400 * 1000, base = `https://${req.headers.host}/api/admin/review`;
  const link = d => `${base}?e=${encodeURIComponent(id)}&d=${d}&x=${exp}&s=${hmac(`review|${id}|${d}|${exp}`)}`;
  await sendMail({
    to: process.env.REVIEW_EMAIL, subject: `[교환가자 심사] 멘토 신청 ${user.name} (${user.phone || id})`,
    attachments: [{ filename, content: buf.toString('base64') }],
    html: mailLayout('멘토 신청 심사', `<p>이름: ${escHtml(user.name)}<br>계정(휴대폰): ${escHtml(user.phone || id)}<br>학교 이메일(인증 완료): ${escHtml(user.mentor.uniEmail)}<br>원래 파일 이름: ${escHtml(cleanText(f.name, 120))}</p>
      <p>첨부한 수료 증빙을 확인하고 24시간 안에 결정해 주세요. 관리자 대시보드(https://${req.headers.host}/admin)에서도 처리할 수 있어요. 링크는 7일 동안 유효해요.</p>
      <p><a href="${link('approve')}" style="background:#2F6FED;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">승인</a>
      &nbsp; <a href="${link('reject')}" style="color:#C2410C">반려</a></p>`),
  });
  user.mentor = { ...user.mentor, status: 'pending', submittedAt: new Date().toISOString() };
  await saveUser(user);
  if (user.phone && smsConfigured()) await sendSms(user.phone, '[교환가자] 멘토 신청이 접수됐어요. 운영팀 심사는 최대 24시간 걸려요.').catch(() => {});
  if (contactEmail(user)) await sendMail({ to: contactEmail(user), subject: '[교환가자] 멘토 신청이 접수됐어요', html: mailLayout('멘토 신청이 접수됐어요', '<p>운영팀 심사는 최대 24시간 걸려요. 결과는 이메일로 알려드려요. 그동안 멘토 프로필을 미리 작성해 임시저장할 수 있어요.</p>') }).catch(() => {});
  send(res, 200, { user: publicUser(user) });
}
