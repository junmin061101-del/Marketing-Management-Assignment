// One function serves every /api/auth/<op> route (the Hobby plan allows 12 functions per deployment).
import h0 from '../../server/auth/logout.js';
import h1 from '../../server/auth/phone-code.js';
import h2 from '../../server/auth/phone-signup.js';
import h3 from '../../server/auth/phone-verify.js';
const ROUTES = { 'logout': h0, 'phone-code': h1, 'phone-signup': h2, 'phone-verify': h3, };
export default function handler(req, res) {
  const op = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '').split('/').pop();
  const h = Object.hasOwn(ROUTES, op) ? ROUTES[op] : null;
  if (!h) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); return res.end('{"error":"not_found"}'); }
  return h(req, res);
}
