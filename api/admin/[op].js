// One function serves every /api/admin/<op> route (the Hobby plan allows 12 functions per deployment).
import h0 from '../../server/admin/action.js';
import h1 from '../../server/admin/data.js';
import h2 from '../../server/admin/login.js';
import h3 from '../../server/admin/logout.js';
import h4 from '../../server/admin/proof.js';
import h5 from '../../server/admin/review.js';
import h6 from '../../server/admin/verify.js';
import h7 from '../../server/admin/reset.js';
const ROUTES = { 'action': h0, 'data': h1, 'login': h2, 'logout': h3, 'proof': h4, 'review': h5, 'verify': h6, 'reset': h7, };
export default function handler(req, res) {
  const op = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '').split('/').pop();
  const h = Object.hasOwn(ROUTES, op) ? ROUTES[op] : null;
  if (!h) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); return res.end('{"error":"not_found"}'); }
  return h(req, res);
}
