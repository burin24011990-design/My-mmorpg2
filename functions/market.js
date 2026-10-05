// functions/market.js  — ตลาดกลาง (Cloud Functions v2)
// ใน functions/index.js เพิ่มบรรทัดเดียว:  Object.assign(exports, require('./market'));
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const OPT = { region: 'asia-southeast1' };   // ต้องตรงกับ REGION ใน market.js
const TAX = 0.05, MAX_ACTIVE = 20, MAX_PRICE = 1e9;
const KINDS = ['equip', 'box', 'skillbook', 'stone', 'cleanstone', 'optstone', 'potion'];

function uidOf(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'ต้องล็อกอินด้วย Google ก่อน');
  return req.auth.uid;
}

exports.listItem = onCall(OPT, async (req) => {
  const uid = uidOf(req);
  const { item, price, sellerName } = req.data || {};
  if (!item || typeof item !== 'object' || KINDS.indexOf(item.kind) < 0)
    throw new HttpsError('invalid-argument', 'ไอเทมไม่ถูกต้อง');
  if (!Number.isInteger(price) || price < 1 || price > MAX_PRICE)
    throw new HttpsError('invalid-argument', 'ราคาไม่ถูกต้อง');
  if (item.count !== undefined && (!Number.isInteger(item.count) || item.count < 1 || item.count > 999))
    throw new HttpsError('invalid-argument', 'จำนวนไม่ถูกต้อง');
  const act = await db.collection('market_listings')
    .where('sellerId', '==', uid).where('status', '==', 'active').get();
  if (act.size >= MAX_ACTIVE) throw new HttpsError('failed-precondition', 'ลงขายได้สูงสุด ' + MAX_ACTIVE + ' รายการ');
  const ref = await db.collection('market_listings').add({
    sellerId: uid, sellerName: String(sellerName || 'ผู้เล่น').slice(0, 12),
    item, price, status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
});

exports.buyItem = onCall(OPT, async (req) => {
  const uid = uidOf(req);
  const id = String((req.data || {}).id || '');
  if (!id) throw new HttpsError('invalid-argument', 'ไม่มี id');
  const ref = db.collection('market_listings').doc(id);
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists || s.data().status !== 'active') throw new HttpsError('not-found', 'สินค้านี้ถูกขายหรือยกเลิกแล้ว');
    const L = s.data();
    if (L.sellerId === uid) throw new HttpsError('failed-precondition', 'ซื้อของตัวเองไม่ได้');
    const gain = L.price - Math.floor(L.price * TAX);
    tx.update(ref, { status: 'sold', buyerId: uid, soldAt: admin.firestore.FieldValue.serverTimestamp() });
    tx.set(db.collection('market_inbox').doc(uid).collection('entries').doc(),
      { type: 'item', item: L.item, note: 'ซื้อจากตลาด', at: Date.now() });
    tx.set(db.collection('market_inbox').doc(L.sellerId).collection('entries').doc(),
      { type: 'gold', amount: gain, note: 'ขาย ' + (L.item.kind) + ' (หักภาษี 5%)', at: Date.now() });
  });
  return { ok: true };
});

exports.cancelListing = onCall(OPT, async (req) => {
  const uid = uidOf(req);
  const id = String((req.data || {}).id || '');
  const ref = db.collection('market_listings').doc(id);
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists || s.data().status !== 'active') throw new HttpsError('not-found', 'รายการนี้ไม่อยู่แล้ว');
    if (s.data().sellerId !== uid) throw new HttpsError('permission-denied', 'ไม่ใช่ของคุณ');
    tx.update(ref, { status: 'cancelled' });
    tx.set(db.collection('market_inbox').doc(uid).collection('entries').doc(),
      { type: 'item', item: s.data().item, note: 'ยกเลิกการขาย', at: Date.now() });
  });
  return { ok: true };
});

// ดูกล่องรับของ
exports.listInbox = onCall(OPT, async (req) => {
  const uid = uidOf(req);
  const q = await db.collection('market_inbox').doc(uid).collection('entries').limit(100).get();
  return { entries: q.docs.map(d => ({ id: d.id, ...d.data() })) };
});

// รับของทีละรายการ (ลบออกจากกล่องแล้วคืนข้อมูลให้เกมใส่กระเป๋า)
exports.claimInbox = onCall(OPT, async (req) => {
  const uid = uidOf(req);
  const id = String((req.data || {}).id || '');
  const ref = db.collection('market_inbox').doc(uid).collection('entries').doc(id);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError('not-found', 'รับไปแล้ว');
    tx.delete(ref);
    return { entry: s.data() };
  });
});
