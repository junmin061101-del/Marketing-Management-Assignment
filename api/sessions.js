// Mentoring sessions between a student and a verified mentor.
// The mentor offers in person and/or video. Price and place are agreed in chat; the mentor enters the agreed
// price when accepting (0 = free). The student pays the mentor directly;
// the app never holds that money. When a mentor accepts a paid request they pay a 5% service fee by card
// (Toss Payments, on the web page /pay). Free sessions have no fee. Until Toss keys are set, the fee is waived.
//
// GET  /api/sessions                                  → my sessions (as student and as mentor)
// GET  /api/sessions?paytok=<t>                       → the fee order behind a payment link (used by /pay)
// POST /api/sessions {action:'request', mentor, mode, date, time, note}   student
// POST /api/sessions {action:'accept', id, price}     mentor; price = the agreed session fee in won (0 = free).
//                                                     Also used to correct the price while the fee is still unpaid.
// POST /api/sessions {action:'agree' | 'disagree', id} student: confirms the amount the mentor entered, or sends it back.
//      The student has to confirm the amount before the mentor pays the fee, so a mentor cannot enter a lower
//      amount than the one agreed in chat to pay less fee.
// POST /api/sessions {action:'decline', id}           mentor
// POST /api/sessions {action:'pay', id}               mentor → {url} of the payment page
// POST /api/sessions {action:'confirm', t, paymentKey, orderId, amount}   /pay after Toss redirects back
// POST /api/sessions {action:'cancel', id}            either side, before it is done
// POST /api/sessions {action:'complete', id}          student, after the session time
// POST /api/sessions {action:'report', id, text}      either side → admin reports (no-show and the like)
import crypto from 'node:crypto';
import { guard, body, send, currentUser, cleanText, redis, allow, uid, hmac, getJSON, setJSON, sendPush, adminLog } from './_lib.js';
import { openDM, systemMessage } from './chat.js';

const FEE_RATE = 0.05;
const feeOf = price => (price > 0 ? Math.round(price * FEE_RATE) : 0);
const okPrice = v => Number.isInteger(v) && (v === 0 || (v >= 5000 && v <= 1000000));
const SITE = 'https://gyohwan-gaja-application-development.vercel.app';
const TOSS = () => process.env.TOSS_API_URL || 'https://api.tosspayments.com';
const payConfigured = () => !!(process.env.TOSS_CLIENT_KEY && process.env.TOSS_SECRET_KEY);
const payMode = () => (!payConfigured() ? 'off' : String(process.env.TOSS_CLIENT_KEY).startsWith('live_') ? 'live' : 'test');
const ID = /^[a-z0-9]{10,24}$/, DAY = /^\d{4}-\d{2}-\d{2}$/, HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const mask = name => (String(name || '?').trim()[0] || '?').toUpperCase() + '**';
const LABEL = { in_person: '대면', video: '화상' };
const won = n => n.toLocaleString('ko-KR') + '원';

// the moment the session starts, in Korean time
const startsAt = b => Date.parse(`${b.date}T${b.time}:00+09:00`);
function bizInfo() {
  const v = k => cleanText(process.env['BIZ_' + k] || '', 120);
  return { name: v('NAME'), ceo: v('CEO'), no: v('NO'), ecomm: v('ECOMM'), addr: v('ADDR'), tel: v('TEL'), mail: v('MAIL') || 'gyohwan.info@gmail.com' };
}
function view(b, me) {
  const role = b.s === me ? 'student' : 'mentor';
  return {
    id: b.id, role, status: b.status, mode: b.mode, date: b.date, time: b.time, note: b.note, price: b.price, fee: b.fee,
    feePaid: !!b.pay?.paidAt, feeWaived: !!b.waived, feeRefunded: !!b.pay?.refundedAt, length: b.length,
    peer: role === 'student' ? b.mName : b.sName, peerAv: role === 'student' ? b.mAv : b.sAv, mentorKey: b.mentorKey, room: b.room,
    at: b.at, by: b.cancelledBy === me ? 'me' : b.cancelledBy ? 'peer' : '', started: Date.now() >= startsAt(b), reviewed: !!b.reviewed,
  };
}
async function load(id, me) {
  if (!ID.test(String(id || ''))) return null;
  const b = await getJSON('bk:' + id);
  return b && (b.s === me || b.m === me) ? b : null;
}
const save = b => setJSON('bk:' + b.id, b);
async function note(b, to, title, text) { await sendPush(to, title, text, { go: 'sessions' }).catch(() => 0); }

async function tossCall(path, data, key) {
  const r = await fetch(TOSS() + path, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64'), 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify(data),
  });
  let j = {}; try { j = await r.json(); } catch {}
  return { ok: r.ok, j };
}
// gives the fee back to the mentor (student cancelled in time, or the operator decided so)
export async function refundFee(b, reason) {
  if (!b.pay?.paidAt || b.pay.refundedAt) return false;
  const { ok, j } = await tossCall(`/v1/payments/${encodeURIComponent(b.pay.paymentKey)}/cancel`, { cancelReason: reason.slice(0, 200) }, 'refund-' + b.id);
  if (!ok && j.code !== 'ALREADY_CANCELED_PAYMENT') return false;
  b.pay.refundedAt = new Date().toISOString();
  await save(b);
  await redis('LPUSH', 'admin:fees', JSON.stringify({ at: b.pay.refundedAt, id: b.id, orderId: b.pay.orderId, amount: -b.fee, kind: 'refund', reason }));
  return true;
}
async function confirmed(b) {
  b.status = 'confirmed'; b.confirmedAt = new Date().toISOString();
  await save(b);
  await systemMessage(b.room, `멘토링이 확정됐어요 · ${b.date} ${b.time} · ${LABEL[b.mode]} · ${b.price ? '세션비 ' + won(b.price) + ' (학생이 멘토에게 직접 지급)' : '무료'}. ${b.mode === 'in_person' ? '만날 장소' : '화상 링크'}는 이 채팅에서 정해 주세요.`);
  await note(b, b.s, '교환가자 · 멘토링 확정', `${b.mName} 멘토와 ${b.date} ${b.time} 세션이 확정됐어요.`);
}

export default async function handler(req, res) {
  if (!guard(req, res, ['GET', 'POST'])) return;
  const q = new URL(req.url, 'http://x').searchParams;
  const b0 = req.method === 'POST' ? body(req) : {};

  // business details for /pay and /terms (set BIZ_* in Vercel once the business is registered)
  if (req.method === 'GET' && q.get('biz')) return send(res, 200, bizInfo());
  // the payment page works with a one-time link instead of a login (it opens in the phone's browser)
  if (req.method === 'GET' && q.get('paytok') || b0.action === 'confirm') {
    const t = String(q.get('paytok') || b0.t || '');
    const ref = /^[a-f0-9]{40}$/.test(t) ? await getJSON('paytok:' + t) : null;
    const b = ref ? await getJSON('bk:' + ref.id) : null;
    if (!b || b.m !== ref.u) return send(res, 404, { error: 'link_expired' });
    const base = { id: b.id, status: b.status, date: b.date, time: b.time, mode: b.mode, price: b.price, fee: b.fee, student: b.sName, biz: bizInfo(), payMode: payMode() };
    if (req.method === 'GET') {
      if (b.status !== 'awaiting_fee') return send(res, 200, { ...base, done: b.status === 'confirmed' || b.status === 'completed' });
      return send(res, 200, { ...base, clientKey: process.env.TOSS_CLIENT_KEY || '', orderId: b.pay.orderId, orderName: '교환가자 멘토링 수수료 (5%)', customerKey: 'c' + hmac('toss|' + b.m).slice(0, 40) });
    }
    if (b.status === 'confirmed' || b.status === 'completed') return send(res, 200, { ...base, done: true });
    if (b.status !== 'awaiting_fee') return send(res, 409, { error: 'not_awaiting_fee' });
    const amount = Number(b0.amount), paymentKey = String(b0.paymentKey || '');
    if (b0.orderId !== b.pay.orderId || amount !== b.fee || !/^[\w-]{10,200}$/.test(paymentKey)) return send(res, 400, { error: 'payment_mismatch' });
    if (!(await redis('SET', 'paylock:' + b.id, '1', 'NX', 'EX', 60))) return send(res, 409, { error: 'in_progress' });
    try {
      const { ok, j } = await tossCall('/v1/payments/confirm', { paymentKey, orderId: b.pay.orderId, amount }, 'confirm-' + b.pay.orderId);
      if (!ok || j.status !== 'DONE' || j.totalAmount !== b.fee) return send(res, 402, { error: 'payment_failed', message: cleanText(j.message, 200) });
      b.pay = { ...b.pay, paymentKey, paidAt: new Date().toISOString(), method: cleanText(j.method, 20), receipt: cleanText(j.receipt?.url, 300) };
      await redis('LPUSH', 'admin:fees', JSON.stringify({ at: b.pay.paidAt, id: b.id, orderId: b.pay.orderId, amount: b.fee, kind: 'fee', mode: payMode() }));
      await confirmed(b);
      return send(res, 200, { ...base, status: 'confirmed', done: true, receipt: b.pay.receipt });
    } finally { await redis('DEL', 'paylock:' + b.id); }
  }

  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'login_required' });
  const me = uid(user);
  if (req.method === 'GET') {
    const ids = [...new Set((await redis('LRANGE', 'mybk:' + me, 0, 99)) || [])];
    const list = [];
    for (const id of ids) { const b = await getJSON('bk:' + id); if (b && (b.s === me || b.m === me)) list.push(view(b, me)); }
    return send(res, 200, { sessions: list, feeRate: FEE_RATE, payMode: payMode() });
  }
  const b = b0;
  if (!(await allow('sess:' + me, 60, 3600))) return send(res, 429, { error: 'too_many_requests' });

  if (b.action === 'request') {
    if (typeof b.mentor !== 'string' || !/^m-[a-f0-9]{16}$/.test(b.mentor)) return send(res, 400, { error: 'bad_request' });
    const mid = await redis('GET', 'mkey:' + b.mentor);
    const mentor = mid ? await getJSON('user:' + mid) : null, p = mentor?.mentor?.profile;
    if (!mentor || mentor.mentor?.status !== 'approved' || !p) return send(res, 404, { error: 'unknown_mentor' });
    if (mid === me) return send(res, 400, { error: 'own_profile' });
    const mode = (p.mode || 'both') === 'both' ? b.mode : p.mode;
    if (!['in_person', 'video'].includes(mode)) return send(res, 400, { error: 'pick_mode' });
    if (!DAY.test(b.date || '') || !HM.test(b.time || '')) return send(res, 400, { error: 'pick_time' });
    const start = Date.parse(`${b.date}T${b.time}:00+09:00`);
    if (!(start > Date.now() + 3600e3 && start < Date.now() + 180 * 86400e3)) return send(res, 400, { error: 'bad_time' });
    const open = [];
    for (const id of ((await redis('LRANGE', 'mybk:' + me, 0, 99)) || [])) { const x = await getJSON('bk:' + id); if (x && x.s === me && x.m === mid && ['requested', 'awaiting_student', 'awaiting_fee'].includes(x.status)) open.push(x); }
    if (open.length) return send(res, 409, { error: 'request_pending' });
    const room = await openDM(user, mentor, b.mentor);
    const bk = {
      id: Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      s: me, m: mid, mentorKey: b.mentor, sName: mask(user.name), mName: String(mentor.name || '').trim() || '?', sAv: user.avatar?.id || '', mAv: mentor.avatar?.id || '',
      mode, length: p.length || '', date: b.date, time: b.time, note: cleanText(b.note, 500),
      price: null, fee: 0, status: 'requested', room, at: new Date().toISOString(),
    };
    await save(bk);
    for (const u of [me, mid]) { await redis('LPUSH', 'mybk:' + u, bk.id); await redis('LTRIM', 'mybk:' + u, 0, 99); }
    await systemMessage(room, `멘토링 신청 · ${bk.date} ${bk.time} · ${LABEL[mode]}${bk.note ? `\n“${bk.note}”` : ''}\n세션비${mode === 'in_person' ? '와 장소' : ''}는 이 채팅에서 정하고, 멘토가 수락할 때 합의한 금액을 입력해요.`);
    await note(bk, mid, '교환가자 · 멘토링 신청', `${bk.sName} 학생이 ${bk.date} ${bk.time} ${LABEL[mode]} 멘토링을 신청했어요.`);
    return send(res, 200, { session: view(bk, me) });
  }

  const bk = await load(b.id, me);
  if (!bk) return send(res, 404, { error: 'session_not_found' });
  const isMentor = bk.m === me;

  if (b.action === 'accept' || b.action === 'decline') {
    if (!isMentor) return send(res, 403, { error: 'mentor_only' });
    // accept again while the fee is unpaid = correct the agreed price
    if (bk.status !== 'requested' && !(b.action === 'accept' && ['awaiting_student', 'awaiting_fee'].includes(bk.status))) return send(res, 409, { error: 'not_requested' });
    if (b.action === 'decline') {
      bk.status = 'declined'; await save(bk);
      await systemMessage(bk.room, '멘토가 이번 신청을 거절했어요. 다른 시간으로 다시 신청할 수 있어요.');
      await note(bk, bk.s, '교환가자 · 멘토링', `${bk.mName} 멘토가 이번 신청을 거절했어요.`);
    } else {
      const price = Number(b.price);
      if (!okPrice(price)) return send(res, 400, { error: 'bad_price' });
      bk.price = price; bk.fee = feeOf(price);
      if (!bk.fee) await confirmed(bk);  // a free session needs no amount check
      else {
        // the student checks the amount against what was agreed in chat before anything is paid
        bk.status = 'awaiting_student'; delete bk.pay;
        await save(bk);
        await systemMessage(bk.room, `멘토가 세션비 ${won(bk.price)}으로 수락했어요. 학생이 채팅에서 합의한 금액과 같은지 확인하면 다음 단계로 넘어가요.`);
        await note(bk, bk.s, '교환가자 · 금액 확인', `${bk.mName} 멘토가 세션비 ${won(bk.price)}으로 수락했어요. 금액이 맞는지 확인해 주세요.`);
      }
    }
    return send(res, 200, { session: view(bk, me) });
  }
  if (b.action === 'agree' || b.action === 'disagree') {
    if (isMentor) return send(res, 403, { error: 'student_only' });
    if (bk.status !== 'awaiting_student') return send(res, 409, { error: 'not_awaiting_student' });
    if (b.action === 'disagree') {
      bk.status = 'requested'; bk.price = null; bk.fee = 0; bk.disputes = (bk.disputes || 0) + 1;
      await save(bk);
      await systemMessage(bk.room, '학생이 입력된 세션비가 채팅에서 합의한 금액과 다르다고 했어요. 금액을 다시 맞춘 뒤 멘토가 다시 수락해 주세요.');
      await note(bk, bk.m, '교환가자 · 금액 확인', `${bk.sName} 학생이 세션비가 합의한 금액과 다르다고 했어요.`);
    } else if (!payConfigured()) {
      bk.waived = true; bk.agreedAt = new Date().toISOString();
      await confirmed(bk);  // the fee is waived until card payments are set up
    } else {
      bk.status = 'awaiting_fee'; bk.agreedAt = new Date().toISOString(); bk.pay = { orderId: 'gg-' + bk.id + '-' + crypto.randomBytes(3).toString('hex') };
      await save(bk);
      await systemMessage(bk.room, `학생이 세션비 ${won(bk.price)}을 확인했어요. 멘토가 앱 수수료(${won(bk.fee)})를 결제하면 세션이 확정돼요.`);
      await note(bk, bk.m, '교환가자 · 수수료 결제', `${bk.sName} 학생이 금액을 확인했어요. 수수료 ${won(bk.fee)}를 결제하면 확정돼요.`);
    }
    return send(res, 200, { session: view(bk, me) });
  }
  if (b.action === 'pay') {
    if (!isMentor) return send(res, 403, { error: 'mentor_only' });
    if (bk.status !== 'awaiting_fee') return send(res, 409, { error: 'not_awaiting_fee' });
    const t = crypto.randomBytes(20).toString('hex');
    bk.pay = { orderId: 'gg-' + bk.id + '-' + crypto.randomBytes(3).toString('hex') };  // a fresh order for every attempt
    await save(bk);
    await setJSON('paytok:' + t, { id: bk.id, u: me }, 'EX', 3600);
    const site = /^localhost:\d+$/.test(req.headers.host || '') ? 'http://' + req.headers.host : SITE;  // the local test server serves its own /pay
    return send(res, 200, { url: `${site}/pay?t=${t}` });
  }
  if (b.action === 'cancel') {
    // after the start time a confirmed session can only be marked done or reported
    if (!['requested', 'awaiting_student', 'awaiting_fee', 'confirmed'].includes(bk.status) || bk.status === 'confirmed' && Date.now() >= startsAt(bk)) return send(res, 409, { error: 'cannot_cancel' });
    const was = bk.status;
    bk.status = 'cancelled'; bk.cancelledBy = me; bk.cancelledAt = new Date().toISOString();
    await save(bk);
    // a student cancelling before the start gives the mentor their fee back; a mentor cancelling does not
    let refunded = false;
    if (!isMentor && was === 'confirmed' && Date.now() < startsAt(bk)) refunded = await refundFee(bk, '학생 취소');
    await systemMessage(bk.room, `${isMentor ? '멘토' : '학생'}가 ${bk.date} ${bk.time} 멘토링을 취소했어요.${refunded ? ' 멘토 수수료는 환불됐어요.' : ''}`);
    await note(bk, isMentor ? bk.s : bk.m, '교환가자 · 멘토링 취소', `${bk.date} ${bk.time} 멘토링이 취소됐어요.`);
    return send(res, 200, { session: view(bk, me) });
  }
  if (b.action === 'complete') {
    if (isMentor) return send(res, 403, { error: 'student_only' });
    if (bk.status !== 'confirmed') return send(res, 409, { error: 'not_confirmed' });
    if (Date.now() < startsAt(bk)) return send(res, 409, { error: 'not_started' });
    bk.status = 'completed'; bk.completedAt = new Date().toISOString();
    await save(bk);
    await redis('SET', `done:${bk.mentorKey}:${me}`, bk.id);  // lets this student review the mentor
    await systemMessage(bk.room, '학생이 멘토링을 완료로 표시했어요. 감사합니다!');
    return send(res, 200, { session: view(bk, me) });
  }
  if (b.action === 'report') {
    const text = cleanText(b.text, 300);
    if (!text) return send(res, 400, { error: 'bad_request' });
    if (bk.reported?.includes(me)) return send(res, 409, { error: 'already_reported' });
    bk.reported = [...(bk.reported || []), me]; await save(bk);
    await redis('LPUSH', 'admin:reports', JSON.stringify({ at: new Date().toISOString(), where: `멘토링 ${bk.date} ${bk.time} · ${isMentor ? '멘토' : '학생'} 신고`, cat: 'session', text, sid: bk.id, mentor: bk.m, reason: 'other', by: me }));
    await redis('LTRIM', 'admin:reports', 0, 499);
    await adminLog('session_report', bk.id, text.slice(0, 80));
    return send(res, 200, { ok: true });
  }
  send(res, 400, { error: 'bad_request' });
}
