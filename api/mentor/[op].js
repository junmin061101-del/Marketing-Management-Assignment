// One function serves every /api/mentor/<op> route (the Hobby plan allows 12 functions per deployment).
import h0 from '../../server/mentor/apply.js';
import h1 from '../../server/mentor/profile.js';
const ROUTES = { 'apply': h0, 'profile': h1, };
export default function handler(req, res) {
  const op = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '').split('/').pop();
  const h = Object.hasOwn(ROUTES, op) ? ROUTES[op] : null;
  if (!h) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); return res.end('{"error":"not_found"}'); }
  return h(req, res);
}
