// functions/market.js — ตลาดกลาง v2 (Cloud Functions v2) ฉบับรวมกฎและระบบป้องกัน
// ใน functions/index.js ต้องมีบรรทัดนี้อยู่แล้ว:  Object.assign(exports, require('./market'));
//
// ชั้นป้องกัน (ทั้งหมดบังคับที่เซิร์ฟเวอร์ ไคลเอนต์ข้ามไม่ได้):
//  1) ขายได้เฉพาะของแรร์ + ตรวจรูปแบบไอเทม + เพดานราคาต่อชิ้น + ราคารวมไม่เกิน 9,999,999
//  2) ต้องมี "ตั๋วลงขาย" (ยอดเก็บที่เซิร์ฟเวอร์ เติมได้เฉพาะตอนชำระเงินจริง/แอดมิน)
//  3) ลงขาย 6 รายการ/24 ชม. (เลื่อน) และห่างกันอย่างน้อย 20 วินาที
//  4) ซื้อรวมไม่เกิน BUY_DAILY_GOLD ต่อ 24 ชม. + ซื้อจากผู้ขายคนเดิมได้ไม่เกิน PAIR_LIMIT ครั้ง/24 ชม.
//  5) ต้องล็อกอิน Google (ไม่รับ anonymous) + บัญชีต้องมีอายุขั้นต่ำ (ของแพงต้องนานกว่า)
//  6) ผู้ขายนิรนามจริง: sellerId เก็บใน market_private ที่ไคลเอนต์อ่านไม่ได้
//  7) บันทึก market_audit ทุกการลง/ซื้อ/ยกเลิก + สวิตช์ปิดตลาด + รายชื่อแบน
//  8) รายการอยู่ 24 ชม. แล้วคืนของเข้ากล่องรับอัตโนมัติ
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FV = admin.firestore.FieldValue;

// ---------- ค่าที่ปรับได้ ----------
const REGION = 'asia-southeast1';            // ต้องตรงกับ REGION ใน js/market.js
const ENFORCE_APP_CHECK = false;             // เปิดเป็น true หลังตั้งค่า Firebase App Check ฝั่งเกมแล้ว
const TAX = 0.05;
const HOUR = 3600000;
const DAILY_LIMIT = 6;                       // ลงขายได้กี่รายการต่อ 24 ชม.
const LIST_HOURS = 24;                       // อายุรายการ
const MIN_LIST_GAP_MS = 20000;               // ลงขายห่างกันอย่างน้อย
const MAX_PRICE = 9999999;                   // ราคารวมสูงสุดต่อรายการ
const BUY_DAILY_GOLD = 20000000;             // ยอดซื้อรวมสูงสุดต่อ 24 ชม. ต่อบัญชี
const PAIR_LIMIT = 2;                        // ซื้อจากผู้ขายคนเดิมได้กี่ครั้งต่อ 24 ชม.
const MIN_AGE_H = 72;                        // อายุบัญชีขั้นต่ำเพื่อใช้ตลาด (ชม.)
const HIGH_VALUE = 5000000;                  // รายการราคาตั้งแต่นี้ถือเป็นของแพง
const HIGH_VALUE_AGE_H = 168;                // อายุบัญชีขั้นต่ำสำหรับของแพง (ชม.)
const STONE_STACK = 9999;                    // ต้องตรงกับ MAX_STONE_STACK ในเกม
const ADMIN_UIDS = [];                       // ใส่ uid ของคุณ (Firebase Console > Authentication) เพื่อใช้ adminGrantTickets

const TICKET_MAX = { 1: 2000000, 2: 5000000, 3: MAX_PRICE };   // ราคารวมสูงสุดที่ตั๋วแต่ละระดับรองรับ
const TIERS = ['white', 'blue', 'red', 'gold'];
const SLOTS = ['weapon', 'helmet', 'armor', 'gloves', 'shoes', 'ring', 'necklace'];
const WEAPON_CLASSES = ['sword', 'mage', 'archer', 'priest', 'rogue'];
const OPT_COLORS = ['red', 'green', 'purple', 'yellow'];

// เพดานราคาต่อชิ้น (ค่าตั้งต้นที่ผมเดา — ปรับตามเศรษฐกิจจริงของเกม) ไคลเอนต์อ่านค่านี้จาก getWallet จึงแก้ที่เดียว
const CAP = {
  box:   { white: 300000, blue: 1000000, red: 3000000, gold: 9999999 },
  equip: { white: 500000, blue: 1500000, red: 4000000, gold: 9999999 },
  equipPlusBonus: 0.10, equipStarBonus: 0.15,   // เพดานอุปกรณ์เพิ่มตามค่า + และ ★
  optstone: 150000, cleanstone: 200000,
  stone: 1000,                                  // ต่อก้อน (กอง 9,999 × 1,000 = 9,999,000)
  book: 3000000                                 // สมุดสกิล ต่อเล่ม
};
const RULES = { dailyLimit: DAILY_LIMIT, listHours: LIST_HOURS, maxPrice: MAX_PRICE, tax: TAX, stoneStack: STONE_STACK, ticketMax: TICKET_MAX, cap: CAP };

const OPT = { region: REGION, enforceAppCheck: ENFORCE_APP_CHECK };

// ---------- ตัวช่วย ----------
function bad(msg) { throw new HttpsError('invalid-argument', msg); }
function authOnly(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'ต้องล็อกอินด้วย Google ก่อน');
  return req.auth.uid;
}
function tierOfItem(it) { return TIERS.indexOf(it.tier) >= 0 ? it.tier : 'white'; }
function ticketFor(price) { return price <= TICKET_MAX[1] ? 1 : (price <= TICKET_MAX[2] ? 2 : 3); }
function sig(it) { return [it.kind, it.tier || '', it.level || '', it.baseSlot || it.color || it.sid || ''].join(':'); }
function audit(tx, rec) { tx.set(db.collection('market_audit').doc(), Object.assign({ at: Date.now() }, rec)); }

// ตรวจก่อนใช้ตลาด: ไม่ใช่ anonymous, ตลาดเปิดอยู่, ไม่ถูกแบน, อายุบัญชีพอ
// minAgeH ใส่ค่าอื่นได้ (เช่น ของแพง) — คืนอายุบัญชีเป็นชั่วโมง
async function guard(req, minAgeH) {
  const uid = authOnly(req);
  const prov = req.auth.token && req.auth.token.firebase && req.auth.token.firebase.sign_in_provider;
  if (prov === 'anonymous') throw new HttpsError('permission-denied', 'ต้องล็อกอินด้วย Google ก่อนใช้ตลาด');
  const [cfg, ban, user] = await Promise.all([
    db.collection('market_config').doc('main').get(),
    db.collection('market_bans').doc(uid).get(),
    admin.auth().getUser(uid)
  ]);
  if (cfg.exists && cfg.data().enabled === false) throw new HttpsError('failed-precondition', 'ตลาดปิดปรับปรุงชั่วคราว');
  if (ban.exists) throw new HttpsError('permission-denied', 'บัญชีนี้ถูกจำกัดการใช้ตลาด');
  const created = Date.parse(user.metadata.creationTime);
  const ageH = isFinite(created) ? (Date.now() - created) / HOUR : 0;
  const need = minAgeH === undefined ? MIN_AGE_H : minAgeH;
  if (ageH < need) throw new HttpsError('failed-precondition', 'บัญชีใหม่ใช้ตลาดได้เมื่อสร้างครบ ' + Math.ceil(need) + ' ชม. (อีก ' + Math.ceil(need - ageH) + ' ชม.)');
  return { uid: uid, ageH: ageH };
}

// ตรวจรูปแบบไอเทม (ไม่ตัดฟิลด์ที่ไม่รู้จัก เพราะเกมอาจมีฟิลด์เพิ่ม แต่จำกัดขนาดรวม)
function validateItem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) bad('ไอเทมไม่ถูกต้อง');
  const json = JSON.stringify(raw);
  if (json.length > 2000) bad('ไอเทมไม่ถูกต้อง');
  const it = JSON.parse(json);
  const int = function (v, lo, hi) { return Number.isInteger(v) && v >= lo && v <= hi; };
  if (it.tier !== undefined && TIERS.indexOf(it.tier) < 0) bad('ไอเทมไม่ถูกต้อง');
  if (it.opts !== undefined && (!Array.isArray(it.opts) || it.opts.length > 10)) bad('ไอเทมไม่ถูกต้อง');
  switch (it.kind) {
    case 'equip':
      if (SLOTS.indexOf(it.baseSlot) < 0 || !int(it.level, 1, 300) || !int(it.star, 0, 50)) bad('อุปกรณ์ไม่ถูกต้อง');
      if (it.plus !== undefined && !int(it.plus, 0, 100)) bad('อุปกรณ์ไม่ถูกต้อง');
      if (it.baseSlot === 'weapon' && WEAPON_CLASSES.indexOf(it.class) < 0) bad('อุปกรณ์ไม่ถูกต้อง');
      if (it.count !== undefined) bad('อุปกรณ์ไม่ถูกต้อง');
      break;
    case 'box':
      if (!int(it.level, 1, 300) || !int(it.count, 1, 999)) bad('กล่องไม่ถูกต้อง');
      break;
    case 'stone':
      if (it.count !== STONE_STACK) bad('หินตีบวกต้องขายยกกองเต็ม ' + STONE_STACK + ' ก้อน');
      break;
    case 'cleanstone':
      if (!int(it.count, 1, 9999)) bad('จำนวนไม่ถูกต้อง');
      break;
    case 'optstone':
      if (OPT_COLORS.indexOf(it.color) < 0 || !int(it.count, 1, 9999)) bad('หินออฟไม่ถูกต้อง');
      break;
    case 'skillbook':
      if (typeof it.sid !== 'string' || !it.sid || it.sid.length > 40 || !int(it.count, 1, 999)) bad('สมุดสกิลไม่ถูกต้อง');
      break;
    default:
      bad('ไอเทมชนิดนี้ขายในตลาดไม่ได้');
  }
  if ((it.kind === 'box' || it.kind === 'equip') && TIERS.indexOf(tierOfItem(it)) < 2) bad('ขายได้เฉพาะสีแดงขึ้นไป');
  return it;
}

function maxUnitPrice(it) {
  const t = tierOfItem(it);
  let c;
  if (it.kind === 'box') c = CAP.box[t];
  else if (it.kind === 'equip') c = CAP.equip[t] * (1 + CAP.equipPlusBonus * (it.plus || 0) + CAP.equipStarBonus * (it.star || 0));
  else if (it.kind === 'optstone') c = CAP.optstone;
  else if (it.kind === 'cleanstone') c = CAP.cleanstone;
  else if (it.kind === 'stone') c = CAP.stone;
  else c = CAP.book;
  return Math.min(MAX_PRICE, Math.floor(c));
}

// ---------- ข้อมูลของฉัน ----------
exports.getWallet = onCall(OPT, async (req) => {
  const uid = authOnly(req);
  const [w, l] = await Promise.all([
    db.collection('market_wallets').doc(uid).get(),
    db.collection('market_limits').doc(uid).get()
  ]);
  const now = Date.now();
  const ld = l.exists ? l.data() : {};
  const times = (ld.times || []).filter(function (t) { return t > now - LIST_HOURS * HOUR; });
  const spent = (ld.buys || []).filter(function (b) { return b.t > now - 24 * HOUR; }).reduce(function (a, b) { return a + b.amt; }, 0);
  return {
    tickets: (w.exists && w.data().tickets) || {},
    listedToday: times.length, dailyLimit: DAILY_LIMIT,
    boughtToday: spent, buyDailyGold: BUY_DAILY_GOLD,
    rules: RULES
  };
});

// รายการที่ฉันลงขายอยู่ (ผู้ขายไม่อยู่ในเอกสารสาธารณะ จึงต้องถามผ่านฟังก์ชันนี้)
exports.myListings = onCall(OPT, async (req) => {
  const uid = authOnly(req);
  const q = await db.collection('market_private').where('sellerId', '==', uid).where('status', '==', 'active').limit(50).get();
  if (q.empty) return { listings: [] };
  const snaps = await db.getAll.apply(db, q.docs.map(function (d) { return db.collection('market_listings').doc(d.id); }));
  return {
    listings: snaps.filter(function (s) { return s.exists; })
      .map(function (s) { const d = s.data(); return { id: s.id, item: d.item, price: d.price, expiresAt: d.expiresAt }; })
  };
});

// ---------- ตั๋ว ----------
// เพิ่มตั๋วให้ผู้เล่น — เรียกเมื่อชำระเงินสำเร็จ (เว็บฮุกจะเรียกฟังก์ชันนี้) payId กันเครดิตซ้ำ
async function creditTickets(uid, tk, n, payId) {
  if (!uid || !(tk >= 1 && tk <= 3) || !Number.isInteger(n) || n < 1 || n > 1000) throw new HttpsError('invalid-argument', 'ข้อมูลไม่ถูกต้อง');
  await db.runTransaction(async (tx) => {
    if (payId) {
      const pref = db.collection('market_payments').doc(payId);
      const ps = await tx.get(pref);
      if (ps.exists) return;                       // เครดิตไปแล้ว
      tx.set(pref, { uid: uid, tk: tk, n: n, at: Date.now() });
    }
    tx.set(db.collection('market_wallets').doc(uid), { tickets: { [tk]: FV.increment(n) } }, { merge: true });
    audit(tx, { type: 'ticket_credit', uid: uid, tk: tk, n: n, payId: payId || '' });
  });
}

// ให้ตั๋วด้วยมือ (ช่วงยังไม่มีระบบชำระเงิน เช่น รับโอนเองแล้วเติมให้) — เฉพาะ uid ใน ADMIN_UIDS
exports.adminGrantTickets = onCall(OPT, async (req) => {
  const uid = authOnly(req);
  if (ADMIN_UIDS.indexOf(uid) < 0) throw new HttpsError('permission-denied', 'ไม่มีสิทธิ์');
  const d = req.data || {};
  await creditTickets(String(d.target || ''), Number(d.tk), Number(d.n), d.ref ? String(d.ref) : '');
  return { ok: true };
});

// ---------- ลงขาย ----------
exports.listItem = onCall(OPT, async (req) => {
  const d = req.data || {};
  const item = validateItem(d.item);
  const price = d.price;
  if (!Number.isInteger(price) || price < 1 || price > MAX_PRICE) bad('ราคาไม่ถูกต้อง (สูงสุด ' + MAX_PRICE.toLocaleString() + ')');
  const qty = item.count === undefined ? 1 : item.count;
  const cap = maxUnitPrice(item);
  if (Math.ceil(price / qty) > cap) bad('ราคาต่อชิ้นสูงเกินเพดานของไอเทมนี้ (สูงสุด ' + cap.toLocaleString() + ')');

  const g = await guard(req, price >= HIGH_VALUE ? HIGH_VALUE_AGE_H : MIN_AGE_H);
  const uid = g.uid;
  const tk = ticketFor(price);
  const walletRef = db.collection('market_wallets').doc(uid);
  const limitRef = db.collection('market_limits').doc(uid);
  const pubRef = db.collection('market_listings').doc();
  const privRef = db.collection('market_private').doc(pubRef.id);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const [w, l] = await Promise.all([tx.get(walletRef), tx.get(limitRef)]);
    const tickets = (w.exists && w.data().tickets) || {};
    if (!(tickets[tk] > 0)) throw new HttpsError('failed-precondition', 'ต้องมีตั๋วลงขายระดับ ' + tk + ' (ราคาไม่เกิน ' + TICKET_MAX[tk].toLocaleString() + ')');
    const times = ((l.exists && l.data().times) || []).filter(function (t) { return t > now - LIST_HOURS * HOUR; });
    if (times.length >= DAILY_LIMIT) throw new HttpsError('resource-exhausted', 'ลงขายครบ ' + DAILY_LIMIT + ' รายการใน 24 ชม. แล้ว');
    if (times.length && now - times[times.length - 1] < MIN_LIST_GAP_MS) throw new HttpsError('resource-exhausted', 'ลงขายถี่เกินไป รอสักครู่');
    times.push(now);
    tx.update(walletRef, { ['tickets.' + tk]: FV.increment(-1) });
    tx.set(limitRef, { times: times }, { merge: true });
    tx.set(pubRef, { item: item, price: price, status: 'active', createdAt: FV.serverTimestamp(), expiresAt: now + LIST_HOURS * HOUR });
    tx.set(privRef, { sellerId: uid, status: 'active', createdAt: now });
    audit(tx, { type: 'list', uid: uid, listingId: pubRef.id, price: price, sig: sig(item), qty: qty, tk: tk });
  });
  return { id: pubRef.id, expiresAt: now + LIST_HOURS * HOUR };
});

// ---------- ซื้อ ----------
exports.buyItem = onCall(OPT, async (req) => {
  const g = await guard(req);
  const uid = g.uid;
  const id = String((req.data || {}).id || '');
  if (!id) throw new HttpsError('invalid-argument', 'ไม่มี id');
  const pubRef = db.collection('market_listings').doc(id);
  const privRef = db.collection('market_private').doc(id);
  const limitRef = db.collection('market_limits').doc(uid);

  await db.runTransaction(async (tx) => {
    const pub = await tx.get(pubRef);
    const priv = await tx.get(privRef);
    if (!pub.exists || !priv.exists || pub.data().status !== 'active') throw new HttpsError('not-found', 'สินค้านี้ถูกขายหรือยกเลิกแล้ว');
    const L = pub.data(), P = priv.data();
    if (P.sellerId === uid) throw new HttpsError('failed-precondition', 'ซื้อของตัวเองไม่ได้');
    if (L.expiresAt && L.expiresAt <= Date.now()) throw new HttpsError('failed-precondition', 'รายการนี้หมดอายุแล้ว');
    if (L.price >= HIGH_VALUE && g.ageH < HIGH_VALUE_AGE_H) throw new HttpsError('failed-precondition', 'ของราคานี้ต้องใช้บัญชีที่สร้างครบ ' + HIGH_VALUE_AGE_H + ' ชม.');

    const pairRef = db.collection('market_pairs').doc(P.sellerId + '_' + uid);
    const lim = await tx.get(limitRef);
    const pr = await tx.get(pairRef);
    const now = Date.now();
    const buys = ((lim.exists && lim.data().buys) || []).filter(function (b) { return b.t > now - 24 * HOUR; });
    const spent = buys.reduce(function (a, b) { return a + b.amt; }, 0);
    if (spent + L.price > BUY_DAILY_GOLD) throw new HttpsError('resource-exhausted', 'ซื้อได้ไม่เกิน ' + BUY_DAILY_GOLD.toLocaleString() + ' ทองต่อ 24 ชม.');
    const ptimes = ((pr.exists && pr.data().times) || []).filter(function (t) { return t > now - 24 * HOUR; });
    if (ptimes.length >= PAIR_LIMIT) throw new HttpsError('failed-precondition', 'ซื้อรายการนี้ไม่ได้ในขณะนี้');   // ข้อความกลางๆ ไม่เปิดเผยผู้ขาย
    buys.push({ t: now, amt: L.price });
    ptimes.push(now);

    const gain = L.price - Math.floor(L.price * TAX);
    tx.update(pubRef, { status: 'sold' });
    tx.update(privRef, { status: 'sold', buyerId: uid, soldAt: now });
    tx.set(limitRef, { buys: buys }, { merge: true });
    tx.set(pairRef, { times: ptimes });
    tx.set(db.collection('market_inbox').doc(uid).collection('entries').doc(),
      { type: 'item', item: L.item, note: 'ซื้อจากตลาด', at: now });
    tx.set(db.collection('market_inbox').doc(P.sellerId).collection('entries').doc(),
      { type: 'gold', amount: gain, note: 'ขาย ' + L.item.kind + ' (หักภาษี 5%)', at: now });
    audit(tx, { type: 'buy', uid: uid, sellerId: P.sellerId, listingId: id, price: L.price, sig: sig(L.item) });
  });
  return { ok: true };
});

// ---------- ยกเลิก (ไม่คืนตั๋ว ไม่คืนโควตา) ----------
exports.cancelListing = onCall(OPT, async (req) => {
  const uid = authOnly(req);
  const id = String((req.data || {}).id || '');
  if (!id) throw new HttpsError('invalid-argument', 'ไม่มี id');
  const pubRef = db.collection('market_listings').doc(id);
  const privRef = db.collection('market_private').doc(id);
  await db.runTransaction(async (tx) => {
    const pub = await tx.get(pubRef);
    const priv = await tx.get(privRef);
    if (!pub.exists || !priv.exists || pub.data().status !== 'active') throw new HttpsError('not-found', 'รายการนี้ไม่อยู่แล้ว');
    if (priv.data().sellerId !== uid) throw new HttpsError('permission-denied', 'ไม่ใช่ของคุณ');
    tx.update(pubRef, { status: 'cancelled' });
    tx.update(privRef, { status: 'cancelled' });
    tx.set(db.collection('market_inbox').doc(uid).collection('entries').doc(),
      { type: 'item', item: pub.data().item, note: 'ยกเลิกการขาย', at: Date.now() });
    audit(tx, { type: 'cancel', uid: uid, listingId: id });
  });
  return { ok: true };
});

// ---------- คืนของอัตโนมัติเมื่อหมดอายุ (ทุกชั่วโมง) ----------
// ครั้งแรกที่ deploy อาจมี error ขอสร้าง index (status + expiresAt) ใน log ให้กดลิงก์ที่แสดงเพื่อสร้าง
exports.expireListings = onSchedule({ region: REGION, schedule: 'every 60 minutes', timeZone: 'Asia/Bangkok' }, async () => {
  const q = await db.collection('market_listings')
    .where('status', '==', 'active').where('expiresAt', '<=', Date.now()).limit(200).get();
  for (const doc of q.docs) {
    const privRef = db.collection('market_private').doc(doc.id);
    await db.runTransaction(async (tx) => {
      const pub = await tx.get(doc.ref);
      const priv = await tx.get(privRef);
      if (!pub.exists || !priv.exists || pub.data().status !== 'active') return;
      tx.update(doc.ref, { status: 'expired' });
      tx.update(privRef, { status: 'expired' });
      tx.set(db.collection('market_inbox').doc(priv.data().sellerId).collection('entries').doc(),
        { type: 'item', item: pub.data().item, note: 'หมดอายุ คืนของ', at: Date.now() });
      audit(tx, { type: 'expire', uid: priv.data().sellerId, listingId: doc.id });
    });
  }
});

// ---------- กล่องรับของ (ไม่ผ่าน guard เพื่อไม่ให้ของของผู้ถูกแบนค้าง) ----------
exports.listInbox = onCall(OPT, async (req) => {
  const uid = authOnly(req);
  const q = await db.collection('market_inbox').doc(uid).collection('entries').limit(100).get();
  return { entries: q.docs.map(d => ({ id: d.id, ...d.data() })) };
});

// รับของทีละรายการ (ลบออกจากกล่องแล้วคืนข้อมูลให้เกมใส่กระเป๋า)
exports.claimInbox = onCall(OPT, async (req) => {
  const uid = authOnly(req);
  const id = String((req.data || {}).id || '');
  const ref = db.collection('market_inbox').doc(uid).collection('entries').doc(id);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw new HttpsError('not-found', 'รับไปแล้ว');
    tx.delete(ref);
    return { entry: s.data() };
  });
});
