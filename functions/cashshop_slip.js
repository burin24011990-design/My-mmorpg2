// functions/cashshop_slip.js — ร้านค้าแคช: จ่ายด้วยพร้อมเพย์ QR + ตรวจสลิปอัตโนมัติด้วย SlipOK
// ใน functions/index.js ต้องมีเพิ่ม:  Object.assign(exports, require('./cashshop_slip'));
// ไม่ต้องเพิ่ม dependency ใหม่ใน package.json (ใช้ fetch/FormData/Blob ของ Node 18+ ที่มีอยู่แล้ว)
//
// ความลับ 3 ตัวใน Secret Manager (สร้างก่อน deploy! ห้ามใส่ในโค้ด):
//   PROMPTPAY_ID      = เบอร์พร้อมเพย์ 10 หลัก (ขึ้นต้น 0) หรือเลขบัตรประชาชน 13 หลัก (เฉพาะตัวเลข)
//   SLIPOK_API_KEY    = API Key ของสาขาใน SlipOK
//   SLIPOK_BRANCH_ID  = รหัสสาขาใน SlipOK
//
// หลักการ (ไม่เชื่อเครื่องผู้เล่น ตัดสินที่เซิร์ฟเวอร์ทั้งหมด):
//   1) สร้างออเดอร์ ยอดเงินมีเศษสตางค์ไม่ซ้ำกันในช่วงที่ออเดอร์ยังเปิด (เช่น 29.01) ผูกกับผู้เล่นคนเดียว
//   2) ผู้เล่นโอนตาม QR แล้วส่งรูปสลิป -> ส่งต่อให้ SlipOK (log=true: ตรวจบัญชีผู้รับ+สลิปซ้ำ, amount: ตรวจยอด)
//   3) เซิร์ฟเวอร์เช็กซ้ำ: ยอดตรงออเดอร์, เวลาโอนอยู่ในช่วงออเดอร์, เลขอ้างอิงสลิป (transRef) ไม่เคยใช้
//   4) ผ่านทั้งหมดจึงให้ตั๋วด้วย transaction เดียว (เหมือนฝั่ง Stripe)
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FV = admin.firestore.FieldValue;

const PP_ID = defineSecret('PROMPTPAY_ID');
const SLIP_KEY = defineSecret('SLIPOK_API_KEY');
const SLIP_BRANCH = defineSecret('SLIPOK_BRANCH_ID');

// ---------- ค่าที่ปรับได้ ----------
const REGION = 'asia-southeast1';
const DAY = 24 * 3600000;
const MAX_TICKETS_PER_DAY = 30;      // ให้ตรงกับ functions/cashshop.js
const ORDER_TTL = 15 * 60000;        // ออเดอร์เปิดให้โอน 15 นาที
const LOCK_EXTRA = 5 * 60000;        // กันยอดเศษสตางค์ซ้ำต่อหลังหมดเวลาอีก 5 นาที
const SLACK = 60000;                 // เผื่อนาฬิกาธนาคารเพี้ยน 1 นาที
const GRACE = 30 * 60000;            // หลังหมดเวลา ยังส่งสลิปได้อีก 30 นาที (กรณีโอนทันเวลาแต่ส่งสลิปช้า)
const MAX_ATTEMPTS = 5;              // ส่งสลิปได้สูงสุดกี่ครั้งต่อออเดอร์ (กันเผาโควต้า SlipOK)
const MAX_ORDERS_PER_HOUR = 10;      // สร้างออเดอร์ได้กี่ครั้งต่อชั่วโมงต่อผู้เล่น
const MAX_IMG_B64 = 6000000;         // ขนาดรูป base64 สูงสุด (~4.5MB)

// ต้องตรงกับตารางใน functions/cashshop.js (ราคา "บาท")
const PRODUCTS = {
  t1_x1:  { tk: 1, n: 1,  baht: 29,   name: 'ตั๋วลงขาย ระดับ 1 (ไม่เกิน 2 ล้าน) x1' },
  t1_x10: { tk: 1, n: 10, baht: 249,  name: 'ตั๋วลงขาย ระดับ 1 (ไม่เกิน 2 ล้าน) x10' },
  t2_x1:  { tk: 2, n: 1,  baht: 59,   name: 'ตั๋วลงขาย ระดับ 2 (ไม่เกิน 5 ล้าน) x1' },
  t2_x10: { tk: 2, n: 10, baht: 499,  name: 'ตั๋วลงขาย ระดับ 2 (ไม่เกิน 5 ล้าน) x10' },
  t3_x1:  { tk: 3, n: 1,  baht: 99,   name: 'ตั๋วลงขาย ระดับ 3 (ไม่เกิน 9,999,999) x1' },
  t3_x10: { tk: 3, n: 10, baht: 849,  name: 'ตั๋วลงขาย ระดับ 3 (ไม่เกิน 9,999,999) x10' }
};

function needGoogle(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'ต้องล็อกอินด้วย Google ก่อน');
  const prov = req.auth.token && req.auth.token.firebase && req.auth.token.firebase.sign_in_provider;
  if (prov !== 'google.com') throw new HttpsError('permission-denied', 'ต้องล็อกอินด้วย Google ก่อนซื้อ');
  return req.auth.uid;
}
async function alertAdmin(type, data) {
  try { await db.collection('cash_alerts').add(Object.assign({ at: Date.now(), type: type }, data || {})); } catch (e) {}
}

// <payload>
// สร้างข้อความ QR พร้อมเพย์ (EMVCo) แบบมียอดเงิน
function tlv(id, val) { var v = String(val); return id + ('0' + v.length).slice(-2) + v; }
function crc16(s) {
  var crc = 0xFFFF;
  for (var i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (var j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    crc &= 0xFFFF;
  }
  return ('000' + crc.toString(16).toUpperCase()).slice(-4);
}
function promptPayPayload(id, amount) {
  var t = String(id).replace(/[^0-9]/g, ''), sub;
  if (t.length === 10 && t[0] === '0') sub = tlv('01', '0066' + t.slice(1));
  else if (t.length === 13) sub = tlv('02', t);
  else throw new Error('PROMPTPAY_ID ต้องเป็นเบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก');
  var p = tlv('00', '01') + tlv('01', amount ? '12' : '11') +
    tlv('29', tlv('00', 'A000000677010111') + sub) + tlv('53', '764');
  if (amount) p += tlv('54', Number(amount).toFixed(2));
  p += tlv('58', 'TH') + '6304';
  return p + crc16(p);
}
// </payload>

function orderView(id, o, live) {
  const p = PRODUCTS[o.productId] || {};
  return {
    orderId: id, productId: o.productId, name: p.name || o.productId, baht: o.baht,
    amount: o.cents / 100, expiresAt: o.expiresAt, expired: !live,
    qrPayload: live ? promptPayPayload(PP_ID.value(), o.cents / 100) : null
  };
}

// ---------- สร้างออเดอร์ (ได้ QR + ยอดที่ต้องโอน) ----------
exports.createPromptPayOrder = onCall({ region: REGION, secrets: [PP_ID], maxInstances: 5 }, async (req) => {
  const uid = needGoogle(req);
  const pid = String((req.data || {}).productId || '');
  const p = PRODUCTS[pid];
  if (!p) throw new HttpsError('invalid-argument', 'ไม่พบสินค้านี้');
  const now = Date.now();
  const lref = db.collection('cash_limits').doc(uid);
  const oref = db.collection('pay_orders').doc();

  const res = await db.runTransaction(async (tx) => {
    const ls = await tx.get(lref);
    const ld = ls.exists ? ls.data() : {};

    // มีออเดอร์ค้างอยู่ไหม: ชนิดเดียวกัน -> ใช้ต่อ | คนละชนิด -> ให้ยกเลิก/รอหมดเวลาก่อน
    let stale = null;
    if (ld.pendingOrder) {
      const ps = await tx.get(db.collection('pay_orders').doc(ld.pendingOrder));
      if (ps.exists && ps.data().status === 'pending') {
        const po = ps.data();
        if (po.expiresAt > now) {
          if (po.productId === pid) return { id: ps.id, data: po };
          throw new HttpsError('failed-precondition', 'มีออเดอร์ที่ยังไม่หมดเวลาอยู่ ส่งสลิปหรือยกเลิกออเดอร์เดิมก่อน');
        }
        stale = ps.ref;
      }
    }

    const buys = (ld.buys || []).filter(function (x) { return x.t > now - DAY; });
    const used = buys.reduce(function (a, b) { return a + b.n; }, 0);
    if (used + p.n > MAX_TICKETS_PER_DAY) {
      throw new HttpsError('resource-exhausted', 'ซื้อตั๋วได้ไม่เกิน ' + MAX_TICKETS_PER_DAY + ' ใบต่อ 24 ชม. (ซื้อไปแล้ว ' + used + ')');
    }
    const recent = (ld.orderTs || []).filter(function (t) { return t > now - 3600000; });
    if (recent.length >= MAX_ORDERS_PER_HOUR) {
      throw new HttpsError('resource-exhausted', 'สร้างออเดอร์ถี่เกินไป รอสักครู่แล้วลองใหม่');
    }

    // หายอดเศษสตางค์ที่ยังไม่มีใครใช้ (สุ่ม 12 ค่าจาก .01-.99)
    const ks = [];
    for (let k = 1; k <= 99; k++) ks.push(k);
    for (let i = ks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = ks[i]; ks[i] = ks[j]; ks[j] = t;
    }
    const pick = ks.slice(0, 12);
    const refs = pick.map(function (k) { return db.collection('pay_amounts').doc(String(p.baht * 100 + k)); });
    const snaps = await tx.getAll(...refs);
    let idx = -1;
    for (let i = 0; i < snaps.length; i++) {
      if (!snaps[i].exists || snaps[i].data().until <= now) { idx = i; break; }
    }
    if (idx < 0) throw new HttpsError('unavailable', 'มีคนซื้ออยู่หลายคน ลองใหม่อีกครั้งในอีกสักครู่');

    const cents = p.baht * 100 + pick[idx];
    const data = {
      uid: uid, productId: pid, tk: p.tk, n: p.n, baht: p.baht, cents: cents,
      status: 'pending', createdAt: now, expiresAt: now + ORDER_TTL, attempts: 0
    };
    tx.set(refs[idx], { orderId: oref.id, until: now + ORDER_TTL + LOCK_EXTRA });
    tx.set(oref, data);
    if (stale) tx.update(stale, { status: 'expired' });
    tx.set(lref, { pendingOrder: oref.id, orderTs: recent.concat([now]) }, { merge: true });
    return { id: oref.id, data: data };
  });

  return { order: orderView(res.id, res.data, true) };
});

// ---------- ดูออเดอร์ค้างของตัวเอง (เปิดร้านใหม่แล้วกลับมาส่งสลิปต่อได้) ----------
exports.getMyPayOrder = onCall({ region: REGION, secrets: [PP_ID], maxInstances: 5 }, async (req) => {
  const uid = needGoogle(req);
  const ls = await db.collection('cash_limits').doc(uid).get();
  const id = ls.exists && ls.data().pendingOrder;
  if (!id) return { order: null };
  const os = await db.collection('pay_orders').doc(id).get();
  if (!os.exists) return { order: null };
  const o = os.data();
  const now = Date.now();
  if (o.uid !== uid || (o.status !== 'pending' && o.status !== 'expired') || now > o.expiresAt + GRACE) return { order: null };
  return { order: orderView(os.id, o, o.status === 'pending' && now < o.expiresAt) };
});

// ---------- ยกเลิกออเดอร์ ----------
exports.cancelPayOrder = onCall({ region: REGION, maxInstances: 5 }, async (req) => {
  const uid = needGoogle(req);
  const id = String((req.data || {}).orderId || '');
  if (!id) throw new HttpsError('invalid-argument', 'ไม่พบออเดอร์');
  const oref = db.collection('pay_orders').doc(id);
  const lref = db.collection('cash_limits').doc(uid);
  await db.runTransaction(async (tx) => {
    const r = await Promise.all([tx.get(oref), tx.get(lref)]);
    if (!r[0].exists || r[0].data().uid !== uid) throw new HttpsError('not-found', 'ไม่พบออเดอร์');
    const st = r[0].data().status;
    if (st !== 'pending' && st !== 'expired') throw new HttpsError('failed-precondition', 'ออเดอร์นี้ปิดไปแล้ว');
    tx.update(oref, { status: 'cancelled', cancelledAt: Date.now() });
    if (r[1].exists && r[1].data().pendingOrder === id) tx.set(lref, { pendingOrder: FV.delete() }, { merge: true });
  });
  return { ok: true };
});

// ---------- แปลรหัสผิดพลาดของ SlipOK ----------
// คืน [รหัส HttpsError, ข้อความถึงผู้เล่น, คืนสิทธิ์ส่งสลิปไหม, แจ้งแอดมินไหม]
function slipErr(code, body) {
  const m = body && body.message ? String(body.message) : '';
  switch (Number(code)) {
    case 1000: case 1005: case 1006: case 1007: case 1008:
      return ['invalid-argument', 'อ่าน QR ในรูปสลิปไม่ได้ ใช้ภาพสลิปเต็มใบจากแอปธนาคาร (ไม่ครอป)', false, false];
    case 1009: return ['unavailable', 'ระบบธนาคารขัดข้องชั่วคราว ลองใหม่ในอีก 15 นาที', true, false];
    case 1010: return ['unavailable', m || 'สลิปยังไม่พร้อมตรวจ รอสักครู่แล้วลองใหม่', true, false];
    case 1011: return ['failed-precondition', 'QR ในสลิปหมดอายุ หรือไม่มีรายการโอนจริง', false, false];
    case 1012: return ['already-exists', 'สลิปนี้เคยถูกส่งเข้าระบบแล้ว (ถ้าเพิ่งส่งครั้งแรกแล้วตั๋วไม่เข้า แจ้งผู้ดูแล)', false, true];
    case 1013: return ['failed-precondition', 'ยอดในสลิปไม่ตรงกับออเดอร์ ต้องโอนตามยอดที่แสดงเป๊ะ', false, false];
    case 1014: return ['failed-precondition', 'โอนเข้าบัญชีไม่ถูกต้อง ต้องโอนตาม QR ของร้านเท่านั้น', false, false];
    case 1001: case 1002: case 1003: case 1004:
      return ['internal', 'ระบบตรวจสลิปขัดข้อง แจ้งผู้ดูแล', true, true];
    default: return ['internal', 'ตรวจสลิปไม่สำเร็จ ลองใหม่ หรือแจ้งผู้ดูแล', false, true];
  }
}

// ---------- ส่งสลิป -> ตรวจ -> ให้ตั๋ว ----------
exports.submitSlip = onCall({
  region: REGION, secrets: [SLIP_KEY, SLIP_BRANCH], maxInstances: 5, memory: '512MiB', timeoutSeconds: 60
}, async (req) => {
  const uid = needGoogle(req);
  const d = req.data || {};
  const orderId = String(d.orderId || '');
  const b64 = String(d.image || '').replace(/^data:image\/[a-zA-Z+.-]+;base64,/, '');
  if (!orderId || !b64) throw new HttpsError('invalid-argument', 'ข้อมูลไม่ครบ');
  if (b64.length > MAX_IMG_B64) throw new HttpsError('invalid-argument', 'รูปใหญ่เกินไป');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 1000) throw new HttpsError('invalid-argument', 'ไฟล์รูปไม่ถูกต้อง');

  const oref = db.collection('pay_orders').doc(orderId);
  const now = Date.now();

  // 1) จองสิทธิ์ส่งสลิป 1 ครั้ง + ตรวจสถานะออเดอร์
  const pre = await db.runTransaction(async (tx) => {
    const s = await tx.get(oref);
    if (!s.exists || s.data().uid !== uid) throw new HttpsError('not-found', 'ไม่พบออเดอร์');
    const x = s.data();
    if (x.status === 'paid') return { already: true };
    if (x.status === 'cancelled') throw new HttpsError('failed-precondition', 'ออเดอร์ถูกยกเลิกแล้ว ถ้าโอนไปแล้วแจ้งผู้ดูแล');
    if (now > x.expiresAt + GRACE) throw new HttpsError('deadline-exceeded', 'ออเดอร์หมดอายุแล้ว ถ้าโอนไปแล้วแจ้งผู้ดูแล');
    if ((x.attempts || 0) >= MAX_ATTEMPTS) throw new HttpsError('resource-exhausted', 'ส่งสลิปครบจำนวนครั้งแล้ว แจ้งผู้ดูแล');
    tx.update(oref, { attempts: FV.increment(1) });
    return { order: x };
  });
  if (pre.already) return { ok: true, already: true };
  const o = pre.order;
  const refund = function () { return oref.update({ attempts: FV.increment(-1) }).catch(function () {}); };

  // 2) ส่งให้ SlipOK ตรวจ (log=true ตรวจบัญชีผู้รับ+สลิปซ้ำ, amount ตรวจยอด)
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const fd = new FormData();
  fd.append('files', new Blob([buf], { type: isPng ? 'image/png' : 'image/jpeg' }), isPng ? 'slip.png' : 'slip.jpg');
  fd.append('log', 'true');
  fd.append('amount', (o.cents / 100).toFixed(2));
  let body = null;
  try {
    const r = await fetch('https://api.slipok.com/api/line/apikey/' + encodeURIComponent(SLIP_BRANCH.value().trim()), {
      method: 'POST',
      headers: { 'x-authorization': SLIP_KEY.value().trim() },
      body: fd
    });
    body = await r.json().catch(function () { return null; });
  } catch (e) {
    await refund();
    throw new HttpsError('unavailable', 'ระบบตรวจสลิปไม่ตอบสนอง ลองใหม่อีกครั้ง');
  }
  const ok = body && body.success === true && body.data && body.data.success === true;
  if (!ok) {
    const code = body && (body.code || (body.data && body.data.code));
    const er = slipErr(code, body);
    if (er[2]) await refund();
    if (er[3]) await alertAdmin('slipok_error', { orderId: orderId, uid: uid, code: code || null, message: (body && body.message) || null });
    throw new HttpsError(er[0], er[1]);
  }

  // 3) เช็กซ้ำฝั่งเรา แล้วให้ตั๋วใน transaction เดียว
  const sd = body.data;
  const ref = String(sd.transRef || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!ref) {
    await alertAdmin('slip_no_ref', { orderId: orderId, uid: uid });
    throw new HttpsError('internal', 'อ่านเลขอ้างอิงสลิปไม่ได้ แจ้งผู้ดูแล');
  }
  const paidCents = Math.round(Number(sd.amount) * 100);
  // เวลาโอน: ใช้วันที่+เวลาบนสลิป (เวลาไทย) ก่อน ถ้าไม่ได้ค่อยใช้ transTimestamp
  let ts = Date.parse(String(sd.transDate || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3') + 'T' + String(sd.transTime || '') + '+07:00');
  if (isNaN(ts)) ts = Date.parse(sd.transTimestamp);
  const inWindow = !isNaN(ts) && ts >= o.createdAt - SLACK && ts <= o.expiresAt + SLACK;

  const lref = db.collection('cash_limits').doc(uid);
  const pref = db.collection('market_payments').doc('slip_' + ref);
  const sref = db.collection('pay_slips').doc(ref);
  const res = await db.runTransaction(async (tx) => {
    const r = await Promise.all([tx.get(oref), tx.get(pref), tx.get(lref)]);
    if (!r[0].exists) return { bad: 'order' };
    const x = r[0].data();
    if (r[1].exists) return { dup: true };
    if (x.status === 'paid') return { already: true };
    if (x.status !== 'pending' && x.status !== 'expired') return { bad: 'status' };
    const why = paidCents !== x.cents ? 'amount' : (!inWindow ? 'time' : null);
    if (why) {
      tx.set(sref, { status: 'rejected', reason: why, uid: uid, orderId: orderId, at: Date.now(), amount: paidCents, slipTs: isNaN(ts) ? null : ts });
      return { bad: why };
    }
    const t = Date.now();
    const ld = r[2].exists ? r[2].data() : {};
    const buys = (ld.buys || []).filter(function (b) { return b.t > t - DAY; });
    buys.push({ t: t, n: x.n });
    const lu = { buys: buys };
    if (ld.pendingOrder === orderId) lu.pendingOrder = FV.delete();
    tx.set(pref, { uid: uid, tk: x.tk, n: x.n, at: t, src: 'promptpay_slip', amount: paidCents, orderId: orderId, transRef: ref });
    tx.set(sref, { status: 'credited', uid: uid, orderId: orderId, at: t, amount: paidCents });
    tx.set(db.collection('market_wallets').doc(uid), { tickets: { [x.tk]: FV.increment(x.n) } }, { merge: true });
    tx.set(lref, lu, { merge: true });
    tx.update(oref, { status: 'paid', paidAt: t, transRef: ref });
    tx.set(db.collection('market_audit').doc(), { at: t, type: 'ticket_credit', uid: uid, tk: x.tk, n: x.n, payId: 'slip_' + ref });
    return { ok: true, tk: x.tk, n: x.n };
  });

  if (res.dup) throw new HttpsError('already-exists', 'สลิปนี้ถูกใช้ไปแล้ว');
  if (res.already) { await alertAdmin('extra_slip', { orderId: orderId, uid: uid, transRef: ref }); return { ok: true, already: true }; }
  if (res.bad) {
    await alertAdmin('slip_rejected', { orderId: orderId, uid: uid, transRef: ref, reason: res.bad });
    if (res.bad === 'amount') throw new HttpsError('failed-precondition', 'ยอดในสลิปไม่ตรงกับออเดอร์ แจ้งผู้ดูแลพร้อมรหัสอ้างอิง ' + ref);
    if (res.bad === 'time') throw new HttpsError('failed-precondition', 'เวลาโอนไม่ตรงกับช่วงของออเดอร์นี้ แจ้งผู้ดูแลพร้อมรหัสอ้างอิง ' + ref);
    throw new HttpsError('failed-precondition', 'ออเดอร์ไม่พร้อมรับสลิป แจ้งผู้ดูแลพร้อมรหัสอ้างอิง ' + ref);
  }
  return { ok: true, tk: res.tk, n: res.n };
});
