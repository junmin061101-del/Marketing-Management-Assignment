// GET ?e=&d=approve|reject&x=&s= → opened from the review email. The link is signed with APP_SECRET and expires,
// so nobody can approve themselves by guessing a URL. There is no admin page.
import { send, configured, hmac, safeEqual, normEmail, getJSON, saveUser, sendMail, mailLayout, escHtml } from '../_lib.js';

const page = (res, code, msg) => { res.statusCode = code; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>심사</title><body style="font-family:sans-serif;padding:32px"><p>${escHtml(msg)}</p></body>`); };

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  if (!configured()) return page(res, 503, '서버 설정이 필요해요.');
  const u = new URL(req.url, `https://${req.headers.host}`), e = normEmail(u.searchParams.get('e')), d = u.searchParams.get('d'), x = Number(u.searchParams.get('x')), s = u.searchParams.get('s') || '';
  if (!['approve', 'reject'].includes(d) || !x || Date.now() > x || !safeEqual(s, hmac(`review|${e}|${d}|${x}`))) return page(res, 403, '링크가 올바르지 않거나 만료됐어요.');
  const user = await getJSON('user:' + e);
  if (!user || user.mentor?.status !== 'pending') return page(res, 409, '이미 처리됐거나 심사 대기 중인 신청이 없어요.');
  user.mentor.status = d === 'approve' ? 'approved' : 'rejected';
  user.mentor.reviewedAt = new Date().toISOString();
  await saveUser(user);
  await sendMail({ to: user.email, subject: d === 'approve' ? '[교환가자] 멘토 심사를 통과했어요' : '[교환가자] 멘토 심사 결과',
    html: mailLayout(d === 'approve' ? '멘토 심사를 통과했어요' : '멘토 심사 결과', d === 'approve' ? '<p>이제 멘토 프로필을 공개할 수 있어요. 앱에서 프로필을 확인하고 공개하세요.</p>' : '<p>제출한 증빙으로는 수료를 확인하지 못했어요. 수료증이나 파견교 성적증명서를 다시 제출해 주세요.</p>') }).catch(() => {});
  page(res, 200, d === 'approve' ? `${e} 승인 완료` : `${e} 반려 처리`);
}
