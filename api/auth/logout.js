import { guard, send, endSession } from '../_lib.js';
export default async function handler(req, res) {
  if (!guard(req, res, ['POST'])) return;
  await endSession(req, res);
  send(res, 200, { ok: true });
}
