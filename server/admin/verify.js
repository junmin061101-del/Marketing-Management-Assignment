// POST {email, code} → starts a 12-hour admin session (cookie only sent to /api/admin).
import { guard, body, send, normEmail, adminEmails, isAdminEmail, useCode, startAdmin, allow, clientIp, adminLog } from '../../api/_lib.js';

export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  if (!adminEmails().length) return send(res, 503, { error: 'admin_not_configured' });
  if (!(await allow(`adm-verify-ip:${clientIp(req)}`, 20, 3600))) return send(res, 429, { error: 'too_many_requests' });
  const b = body(req), email = normEmail(b.email);
  if (!isAdminEmail(email)) return send(res, 400, { error: 'code_expired' });
  const r = await useCode('admin', email, b.code);
  if (!r.ok) return send(res, 400, { error: r.error, left: r.left });
  await startAdmin(res, email);
  await adminLog('sign_in', email);
  send(res, 200, { ok: true });
}
