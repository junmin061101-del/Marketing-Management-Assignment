// One function serves every /api/auth/<op> route (the Hobby plan allows 12 functions per deployment).
import h0 from '../../server/auth/login.js';
import h1 from '../../server/auth/logout.js';
import h2 from '../../server/auth/password.js';
import h3 from '../../server/auth/signup.js';
const ROUTES = { 'login': h0, 'logout': h1, 'password': h2, 'signup': h3, };
export default function handler(req, res) {
  const op = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '').split('/').pop();
  const h = Object.hasOwn(ROUTES, op) ? ROUTES[op] : null;
  if (!h) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); return res.end('{"error":"not_found"}'); }
  return h(req, res);
}
