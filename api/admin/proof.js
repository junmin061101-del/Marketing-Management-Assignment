// GET ?e=<email> → the proof file a mentor applicant uploaded, for the admin only.
// Only PDF, JPEG or PNG (checked by file signature on upload) is ever stored or served.
import { send, configured, isAdmin, normEmail, loadProof } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  if (!configured()) return send(res, 503, { error: 'not_configured' });
  if (!(await isAdmin(req))) return send(res, 401, { error: 'admin_login_required' });
  const e = normEmail(new URL(req.url, 'http://x').searchParams.get('e'));
  const p = e ? await loadProof(e) : null;
  if (!p || !['application/pdf', 'image/jpeg', 'image/png'].includes(p.type)) return send(res, 404, { error: 'not_found' });
  res.statusCode = 200;
  res.setHeader('Content-Type', p.type);
  res.setHeader('Content-Length', p.buf.length);
  res.setHeader('Cache-Control', 'private, no-store');
  // images are fully sandboxed; Chrome's PDF viewer does not run inside a sandbox, and a verified PDF needs no scripts
  res.setHeader('Content-Security-Policy', p.type === 'application/pdf' ? "frame-ancestors 'none'" : "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `inline; filename="proof.${p.type.split('/')[1].replace('jpeg', 'jpg')}"`);
  res.end(p.buf);
}
