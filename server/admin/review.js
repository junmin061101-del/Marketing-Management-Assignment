// Review link from the operations email: /api/admin/review?e=&d=approve|reject&x=&s=
// The link is signed with APP_SECRET and expires, so nobody can approve themselves by guessing a URL.
// GET only checks the signature and shows a confirm button; mail and security scanners that open
// (prefetch) links therefore can't approve or reject anyone. The decision happens on the POST from
// that button, which must come from this site and carry the same signed fields.
// The same decision can be made in /admin.
import { send, configured, hmac, safeEqual, normEmail, getJSON, escHtml, decideMentor, adminLog } from '../../api/_lib.js';

const CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";
const page = (res, code, inner) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>멘토 심사</title>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;background:#F2F4F6;color:#191F28;margin:0;padding:40px 20px">
<main style="max-width:440px;margin:0 auto;background:#fff;border-radius:20px;padding:28px">${inner}</main></body></html>`);
};
const msg = (res, code, text) => page(res, code, `<p style="margin:0;font-size:16px;line-height:1.6">${escHtml(text)}</p>`);

// form posts arrive parsed (Vercel) or as a raw string/stream
async function formBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString() : '';
  if (!raw && req.readable) { for await (const c of req) { raw += c; if (raw.length > 4096) break; } }
  return Object.fromEntries(new URLSearchParams(raw.slice(0, 4096)));
}
// The button posts from this same page. Browsers send Origin on form posts; some privacy settings send
// "Origin: null", so the browser-set Sec-Fetch-Site header is accepted as the fallback.
const sameSite = req => {
  const o = String(req.headers.origin || '');
  if (o && o !== 'null') { try { return new URL(o).host === req.headers.host; } catch { return false; } }
  return req.headers['sec-fetch-site'] === 'same-origin';
};

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  if (!configured()) return msg(res, 503, '서버 설정이 필요해요.');
  const q = req.method === 'GET' ? Object.fromEntries(new URL(req.url, 'http://x').searchParams) : await formBody(req);
  const e = normEmail(String(q.e || '')), d = String(q.d || ''), x = Number(q.x), s = String(q.s || '');
  if (!e || !['approve', 'reject'].includes(d) || !x || Date.now() > x || !safeEqual(s, hmac(`review|${e}|${d}|${x}`))) return msg(res, 403, '링크가 올바르지 않거나 만료됐어요.');
  const user = await getJSON('user:' + e);
  if (!user || user.mentor?.status !== 'pending') return msg(res, 409, '이미 처리됐거나 심사 대기 중인 신청이 없어요.');
  const label = d === 'approve' ? '승인' : '반려';

  if (req.method === 'GET') {
    const f = (k, v) => `<input type="hidden" name="${k}" value="${escHtml(v)}">`;
    return page(res, 200, `<h1 style="margin:0 0 8px;font-size:22px">정말 ${label}할까요?</h1>
<p style="margin:0 0 20px;color:#4E5968;line-height:1.6">대상: <b>${escHtml(user.name || '')}</b> (${escHtml(e)})<br>${d === 'approve' ? '승인하면 멘토 배지가 생기고 승인 메일이 발송돼요.' : '반려하면 신청자에게 반려 메일이 발송돼요.'} 결정 즉시 증빙 파일은 폐기돼요.</p>
<form method="post" action="/api/admin/review">${f('e', e)}${f('d', d)}${f('x', String(x))}${f('s', s)}
<button type="submit" style="width:100%;height:52px;border:0;border-radius:14px;background:${d === 'approve' ? '#2F6FED' : '#E5484D'};color:#fff;font-size:16px;font-weight:700;cursor:pointer">${label}하기</button></form>
<p style="margin:16px 0 0;font-size:13px;color:#8B95A1">관리자 대시보드(/admin)에서도 같은 결정을 할 수 있어요.</p>`);
  }

  if (!sameSite(req)) return msg(res, 403, '이 페이지의 버튼으로만 처리할 수 있어요.');
  await decideMentor(user, d);
  await adminLog(d, e, 'email link');
  msg(res, 200, d === 'approve' ? `${e} 승인 완료` : `${e} 반려 처리`);
}
