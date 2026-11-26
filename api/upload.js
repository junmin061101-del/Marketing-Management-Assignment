// Photo and video attachments in chats, stored in Vercel Blob (store "gyohwan-gaja-chat-files", Seoul).
// The app uploads straight to Blob with a short-lived token from here, so large videos never pass through
// this function (Vercel limits request bodies to 4.5 MB).
// POST /api/upload  {type:'blob.generate-client-token', payload:{pathname, clientPayload:'{"room":…}'}} → token
//                   (also receives Blob's 'blob.upload-completed' callback, which needs nothing from us)
// Photos are turned into JPEG on the phone first (at most 2048 px); videos are MP4, MOV or WebM up to 50 MB.
import { handleUpload } from '@vercel/blob/client';
import { del } from '@vercel/blob';
import { guard, body, send, currentUser, allow, uid, redis } from './_lib.js';
import { roomFor, folderOf } from './chat.js';

const VIDEO_MAX = 50 * 1024 * 1024;
const TYPES = ['image/jpeg', 'video/mp4', 'video/quicktime', 'video/webm'];
export const blobConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export default async function handler(req, res) {
  const b = body(req);
  // Blob's completion callback comes from Vercel, not from the app: no Origin header, verified by signature inside handleUpload
  const callback = b.type === 'blob.upload-completed';
  if (!callback && !guard(req, res, ['POST'])) return;
  if (callback && req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  if (!blobConfigured()) return send(res, 503, { error: 'uploads_not_configured' });
  try {
    const out = await handleUpload({
      body: b, request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await currentUser(req);
        if (!user) throw Object.assign(new Error('login_required'), { status: 401 });
        if (!(await allow('upload:' + uid(user), 40, 3600))) throw Object.assign(new Error('too_many_requests'), { status: 429 });
        let room = '';
        try { room = String(JSON.parse(clientPayload || '{}').room || ''); } catch {}
        if (!(await roomFor(room, user))) throw Object.assign(new Error('room_not_found'), { status: 404 });
        // files live under chat/<room tag>/ so a file can be traced back to its room; the name itself is random
        const folder = folderOf(room);
        if (!pathname.startsWith(folder) || !/^[\w.-]{1,80}$/.test(pathname.slice(folder.length))) throw Object.assign(new Error('bad_path'), { status: 400 });
        return { allowedContentTypes: TYPES, maximumSizeInBytes: VIDEO_MAX, addRandomSuffix: true, tokenPayload: JSON.stringify({ u: uid(user), room }) };
      },
      onUploadCompleted: async () => {},
    });
    return send(res, 200, out);
  } catch (e) {
    return send(res, e.status || 400, { error: e.status ? e.message : 'upload_failed' });
  }
}
// removes every photo and video a member sent (account deletion); messages that pointed to them show "file deleted"
export async function deleteFilesOf(id) {
  const urls = (await redis('LRANGE', 'files:' + id, 0, -1)) || [];
  if (urls.length && blobConfigured()) { for (let i = 0; i < urls.length; i += 100) await del(urls.slice(i, i + 100)).catch(() => 0); }
  await redis('DEL', 'files:' + id);
}
