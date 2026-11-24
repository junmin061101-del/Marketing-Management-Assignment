import { guard, send, endAdmin } from '../../api/_lib.js';
export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  await endAdmin(req, res);
  send(res, 200, { ok: true });
}
