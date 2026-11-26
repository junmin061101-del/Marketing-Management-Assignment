// GET → everything the dashboard shows: counts, members, the review queue, reviews and the action log.
// Password hashes, consent details and session data never leave the server.
import { guard, send, isAdmin, redis, scanKeys, pushConfigured } from '../../api/_lib.js';

const SAMPLE = { 'sample-yeon': 'Yeon L. (예시)', 'sample-woo': 'Woo J. (예시)', 'sample-seo': 'Seo H. (예시)' };
async function mget(keys) {
  const out = [];
  for (let i = 0; i < keys.length; i += 100) out.push(...(await redis('MGET', ...keys.slice(i, i + 100))));
  return out;
}

export default async function handler(req, res) {
  if (!guard(req, res, ['GET'])) return;
  if (!(await isAdmin(req))) return send(res, 401, { error: 'admin_login_required' });
  const userKeys = await scanKeys('user:*');
  const users = (await mget(userKeys)).map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean).map(u => ({
    key: u.key || u.email, username: u.username || '', phone: u.phone || '', email: u.email || '', name: u.name, created: u.created, home: u.profile?.home || '', major: u.profile?.major || '', year: u.profile?.year || '',
    uniEmail: u.mentor?.uniEmail || '', uniVerified: !!u.mentor?.uniVerified, status: u.mentor?.status || 'none',
    submittedAt: u.mentor?.submittedAt || null, reviewedAt: u.mentor?.reviewedAt || null, reason: u.mentor?.reason || '',
    published: !!u.mentor?.profile, mentorKey: u.mentor?.profile?.key || '',
    mentorProfile: u.mentor?.profile ? { home: u.mentor.profile.home, major: u.mentor.profile.major, offer: u.mentor.profile.offer, length: u.mentor.profile.length, sessions: u.mentor.profile.sessions, format: u.mentor.profile.format } : null,
  })).sort((a, b) => (a.created < b.created ? 1 : -1));
  for (const u of users) if (u.status === 'pending') u.proof = await redis('GET', `proof:${u.key}:m`).then(v => v ? JSON.parse(v) : null);
  const names = Object.fromEntries(users.filter(u => u.mentorKey).map(u => [u.mentorKey, `${u.name} (${u.phone || u.email || u.key})`]));
  const reviews = [];
  for (const k of await scanKeys('reviews:*')) {
    const m = k.slice(8), flat = (await redis('HGETALL', k)) || [];
    for (let i = 0; i < flat.length; i += 2) { try { reviews.push({ mentor: m, mentorName: SAMPLE[m] || names[m] || m, key: flat[i], ...JSON.parse(flat[i + 1]) }); } catch {} }
  }
  reviews.sort((a, b) => (a.at < b.at ? 1 : -1));
  const reports = ((await redis('LRANGE', 'admin:reports', 0, 199)) || []).map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean);
  const log = ((await redis('LRANGE', 'admin:log', 0, 99)) || []).map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean);
  const now = Date.now(), day = 864e5;
  const pushUsers = (await scanKeys('push:*')).length;
  const stats = {
    pushOn: pushConfigured(), pushUsers,
    users: users.length,
    new1: users.filter(u => now - Date.parse(u.created) < day).length,
    new7: users.filter(u => now - Date.parse(u.created) < 7 * day).length,
    pending: users.filter(u => u.status === 'pending').length,
    overdue: users.filter(u => u.status === 'pending' && now - Date.parse(u.submittedAt) > day).length,
    approved: users.filter(u => u.status === 'approved').length,
    published: users.filter(u => u.published).length,
    applied: users.filter(u => u.uniEmail).length,
    reviews: reviews.length,
    reports: reports.length,
  };
  send(res, 200, { stats, users, reviews, reports, log, admin: true, now: new Date().toISOString() });
}
