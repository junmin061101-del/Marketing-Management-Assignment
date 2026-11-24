// GET ?e=&d=approve|reject&x=&s= → opened from the review email. The link is signed with APP_SECRET and expires,
// so nobody can approve themselves by guessing a URL. The same decision can be made in /admin.
import { send, configured, hmac, safeEqual, normEmail, getJSON, escHtml, decideMentor, adminLog } from '../_lib.js';

const page = (res, code, msg) => { res.statusCode = code; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>심사</title><body style="font-family:sans-serif;padding:32px"><p>${escHtml(msg)}</p></body>`); };

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  if (!configured()) return page(res, 503, '서버 설정이 필요해요.');
  const u = new URL(req.url, `https://${req.headers.host}`), e = normEmail(u.searchParams.get('e')), d = u.searchParams.get('d'), x = Number(u.searchParams.get('x')), s = u.searchParams.get('s') || '';
  if (!['approve', 'reject'].includes(d) || !x || Date.now() > x || !safeEqual(s, hmac(`review|${e}|${d}|${x}`))) return page(res, 403, '링크가 올바르지 않거나 만료됐어요.');
  const user = await getJSON('user:' + e);
  if (!user || user.mentor?.status !== 'pending') return page(res, 409, '이미 처리됐거나 심사 대기 중인 신청이 없어요.');
  await decideMentor(user, d);
  await adminLog(d, e, 'email link');
  page(res, 200, d === 'approve' ? `${e} 승인 완료` : `${e} 반려 처리`);
}
