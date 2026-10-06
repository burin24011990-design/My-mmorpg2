// functions/market.js — ตลาดกลาง v3 (กันเปิดหลายบัญชีปั๊มของเข้าตัวหลัก)
// ใน functions/index.js ต้องมี:  Object.assign(exports, require('./market'));
//
// ของเดิม v2 (ยังอยู่ครบ): ตั๋วลงขาย, โควตาลงขาย, เพดานราคา, ผู้ขายนิรนาม, audit, คืนของหมดอายุ
// เพิ่มใน v3:
//  A) ราคาขั้นต่ำ (กันโอนของฟรี/ราคา 1 ทอง)
//  B) จำกัดจำนวน "คู่ค้าต่างคน" ต่อวัน (ตัวหลักรับของจากหลายบัญชีไม่ได้)
//  C) เพดานยอดซื้อ/ขายรวมต่อ 7 วัน
//  D) กันเทรดย้อนกลับ A->B แล้ว B->A (ล้างของวนกัน)
//  E) เทียบ IP: ผู้ซื้อ/ผู้ขายเคยใช้ IP เดียวกันภายใน 7 วัน = บล็อก + บันทึก flag
//  F) ของที่ได้จากการซื้อเข้ากล่องแบบ "พักไว้" (hold) ให้มีเวลาตรวจ/แบนก่อนรับได้
//  G) reqId กันเครดิต/ลงขาย/ซื้อซ้ำเมื่อเน็ตหลุดแล้วยิงใหม่ (กันบั๊กของหาย/ของเบิ้ล)
//  H) ยอมรับเฉพาะ provider google.com (เดิมกันแค่ anonymous)
//  I) market_flags (ให้คุณตรวจ) + adminBan (แบน/อายัดกล่องรับ)
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const crypto = require('crypto');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FV = admin.firestore.FieldValue;

// ---------- ค่าที่ปรับได้ ----------
const REGION = 'asia-southeast1';            // ต้องตรงกับ REGION ใน js/market.js
const ENFORCE_APP_CHECK = false;             // เปิดเป็น true หลังตั้งค่า Firebase App Check ฝั่งเกมแล้ว
const TAX = 0.05;
const HOUR = 3600000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const DAILY_LIMIT = 6;                       // ลงขายได้กี่รายการต่อ 24 ชม.
const LIST_HOURS = 24;                       // อายุรายการ
const MIN_LIST_GAP_MS = 20000;               // ลงขายห่างกันอย่างน้อย
const MAX_PRICE = 9999999;                   // ราคารวมสูงสุดต่อรายการ
const MIN_PRICE_RATIO = 0.10;                // ราคาต่อชิ้นต้องไม่ต่ำกว่า 10% ของเพดานไอเทมนั้น
const BUY_DAILY_GOLD = 20000000;             // ยอดซื้อรวมสูงสุดต่อ 24 ชม.
const BUY_WEEKLY_GOLD = 60000000;            // ยอดซื้อรวมสูงสุดต่อ 7 วัน
const SELL_WEEKLY_GOLD = 60000000;           // ยอดขายรวมสูงสุดต่อ 7 วัน (กันตัวหลักรับทองจากหลายบัญชี)
const PAIR_LIMIT = 2;                        // ซื้อจากผู้ขายคนเดิมได้กี่ครั้งต่อ 24 ชม.
const MAX_SELLERS_DAY = 4;                   // ซื้อจากผู้ขายต่างคนได้กี่คนต่อ 24 ชม.
const MAX_BUYERS_DAY = 4;                    // ขายให้ผู้ซื้อต่างคนได้กี่คนต่อ 24 ชม.
const REVERSE_BLOCK_MS = 72 * HOUR;          // เคยขายให้เขา -> ซื้อจากเขากลับไม่ได้ภายในเวลานี้
const BLOCK_SHARED_IP = true;                // บล็อกคู่ซื้อ-ขายที่เคยใช้ IP เดียวกันใน 7 วัน (เน็ตมือถือ CGNAT อาจชนกันได้บ้าง ปิดได้)
const IP_FLAG_UIDS = 3;                      // IP เดียวมีกี่บัญชีใน 7 วัน ถึงบันทึก flag (ไม่บล็อก)
const HOLD_MS = 30 * 60000;                  // พักของ/ทองที่ได้จากตลาดก่อนรับได้ (ปกติ)
const HOLD_HIGH_MS = 12 * HOUR;              // พักนานขึ้น: ของแพง หรือผู้ซื้ออายุบัญชีน้อย
const MIN_AGE_H = 72;                        // อายุบัญชีขั้นต่ำเพื่อใช้ตลาด (ชม.)
const HIGH_VALUE = 5000000;                  // รายการราคาตั้งแต่นี้ถือเป็นของแพง
const HIGH_VALUE_AGE_H = 168;                // อายุบัญชีขั้นต่ำสำหรับของแพง (ชม.)
const STONE_STACK = 9999;                    // ต้องตรงกับ MAX_STONE_STACK ในเกม
const IP_SALT = 'x7Kq2mVd9RtLp4Zw8NcB1yHs5Fg3JaUe';   // <-- แก้ (ใช้แฮช IP ไม่เก็บ IP ดิบ) ห้ามเปลี่ยนบ่อย เพราะข้อมูล IP เก่าจะใช้เทียบไม่ได้
const ADMIN_UIDS = [];                       // ใส่ uid ของคุณ เพื่อใช้ adminGrantTickets / adminBan  เช่น ['abc123...']

const TICKET_MAX = { 1: 2000000, 2: 5000000, 3: MAX_PRICE };
const TIERS = ['white', 'blue', 'red', 'gold'];
const SLOTS = ['weapon', 'helmet', 'armor', 'gloves', 'shoes', 'ring', 'necklace'];
const WEAPON_CLASSES = ['sword', 'mage', 'archer', 'priest', 'rogue'];
const OPT_COLORS = ['red', 'green', 'purple', 'yellow'];

const CAP = {
  box:   { white: 300000, blue: 1000000, red: 3000000, gold: 9999999 },
  equip: { white: 500000, blue: 1500000, red: 4000000, gold: 9999999 },
  equipPlusBonus: 0.10, equipStarBonus: 0.15,
  optstone: 150000, cleanstone: 200000,
  stone: 1000,
  book: 3000000
};
const RULES = { dailyLimit: DAILY_LIMIT, listHours: LIST_HOURS, maxPrice: MAX_PRICE, tax: TAX, stoneStack: STONE_STACK, ticketMax: TICKET_MAX, cap: CAP, minPriceRatio: MIN_PRICE_RATIO };

const OPT = { region: REGION, enforceAppCheck: ENFORCE_APP_CHECK, maxInstances: 3 };   // <-- แก้ (จำกัดจำนวนเครื่อง กันชนโควตา CPU)

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
function sum(a) { return a.reduce(function (x, y) { return x + y.amt; }, 0); }
function cleanReq(v) { const s = String(v || ''); return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : ''; }

// บันทึกเหตุน่าสงสัยให้เจ้าของเกมตรวจ (ดูที่ Firestore > market_flags) — ห้ามทำให้ฟังก์ชันหลักล้ม
async function flag(uid, type, data) {
  try { await db.collection('market_flags').add(Object.assign({ at: Date.now(), uid: uid, type: type }, data || {})); } catch (e) {}
}

// IP -> แฮช (IPv6 ใช้แค่ 4 ส่วนแรก เพราะมือถือเปลี่ยนท้ายที่อยู่ตลอด)
function ipHash(req) {
  let ip = String((req.rawRequest && req.rawRequest.ip) || 'unknown').replace(/^::ffff:/, '');
  if (ip.indexOf(':') >= 0 && ip.indexOf('.') < 0) ip = ip.split(':').slice(0, 4).join(':');
  return crypto.createHash('sha256').update(IP_SALT + ip).digest('hex').slice(0, 24);
}

// จดว่าบัญชีนี้ใช้ IP นี้ (เก็บ 7 วัน) และ flag ถ้า IP เดียวมีหลายบัญชี
async function touchIp(uid, h) {
  const now = Date.now();
  const linkRef = db.collection('market_links').doc(uid);
  const ipRef = db.collection('market_ips').doc(h);
  const [ls, is] = await Promise.all([linkRef.get(), ipRef.get()]);
  const ips = ls.exists ? (ls.data().ips || {}) : {};
  const u = is.exists ? (is.data().u || {}) : {};
  const isNew = !(u[uid] > now - WEEK);
  Object.keys(ips).forEach(function (k) { if (!(ips[k] > now - WEEK)) delete ips[k]; });
  Object.keys(u).forEach(function (k) { if (!(u[k] > now - WEEK)) delete u[k]; });
  ips[h] = now; u[uid] = now;
  await Promise.all([linkRef.set({ ips: ips }), ipRef.set({ u: u })]);
  if (isNew && Object.keys(u).length >= IP_FLAG_UIDS) await flag(uid, 'ip_many_accounts', { ip: h, uids: Object.keys(u) });
}

// ตรวจก่อนใช้ตลาด: ต้องเป็น Google, ตลาดเปิด, ไม่ถูกแบน, อายุบัญชีพอ
async function guard(req, minAgeH) {
  const uid = authOnly(req);
  const prov = req.auth.token && req.auth.token.firebase && req.auth.token.firebase.sign_in_provider;
  if (prov !== 'google.com') throw new HttpsError('permission-denied', 'ต้องล็อกอินด้วย Google ก่อนใช้ตลาด');
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
  const h = ipHash(req);
  await touchIp(uid, h);
  return { uid: uid, ageH: ageH, ipH: h };
}

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
  const spent = (ld.buys || []).filter(function (b) { return b.t > now - DAY; }).reduce(function (a, b) { return a + b.amt; }, 0);
  return {
    tickets: (w.exists && w.data().tickets) || {},
    listedToday: times.length, dailyLimit: DAILY_LIMIT,
    boughtToday: spent, buyDailyGold: BUY_DAILY_GOLD,
    rules: RULES
  };
});

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
async function creditTickets(uid, tk, n, payId) {
  if (!uid || !(tk >= 1 && tk <= 3) || !Number.isInteger(n) || n < 1 || n > 1000) throw new HttpsError('invalid-argument', 'ข้อมูลไม่ถูกต้อง');
  await db.runTransaction(async (tx) => {
    if (payId) {
      const pref = db.collection('market_payments').doc(payId);
      const ps = await tx.get(pref);
      if (ps.exists) return;
      tx.set(pref, { uid: uid, tk: tk, n: n, at: Date.now() });
    }
    tx.set(db.collection('market_wallets').doc(uid), { tickets: { [tk]: FV.increment(n) } }, { merge: true });
    audit(tx, { type: 'ticket_credit', uid: uid, tk: tk, n: n, payId: payId || '' });
  });
}

exports.adminGrantTickets = onCall(OPT, async (req) => {
  const uid = authOnly(req);
  if (ADMIN_UIDS.indexOf(uid) < 0) throw new HttpsError('permission-denied', 'ไม่มีสิทธิ์');
  const d = req.data || {};
  await creditTickets(String(d.target || ''), Number(d.tk), Number(d.n), d.ref ? String(d.ref) : '');
  return { ok: true };
});

// แบน/อายัด: { target: uid, on: true|false, freeze: true|false, note }
//  on:true  = ใช้ตลาดไม่ได้ | freeze:true (ค่าเริ่มต้น) = รับของจากกล่องไม่ได้ด้วย | on:false = ปลดแบน
exports.adminBan = onCall(OPT, async (req) => {
  const uid = authOnly(req);
  if (ADMIN_UIDS.indexOf(uid) < 0) throw new HttpsError('permission-denied', 'ไม่มีสิทธิ์');
  const d = req.data || {};
  const target = String(d.target || '');
  if (!target) bad('ไม่มี target');
  const ref = db.collection('market_bans').doc(target);
  if (d.on === false) await ref.delete();
  else await ref.set({ freeze: d.freeze !== false, at: Date.now(), by: uid, note: String(d.note || '').slice(0, 200) });
  return { ok: true };
});

// ---------- ลงขาย ----------
exports.listItem = onCall(OPT, async (req) => {
  authOnly(req);
  const d = req.data || {};
  const item = validateItem(d.item);
  const price = d.price;
  if (!Number.isInteger(price) || price < 1 || price > MAX_PRICE) bad('ราคาไม่ถูกต้อง (สูงสุด ' + MAX_PRICE.toLocaleString() + ')');
  const qty = item.count === undefined ? 1 : item.count;
  const cap = maxUnitPrice(item);
  if (Math.ceil(price / qty) > cap) bad('ราคาต่อชิ้นสูงเกินเพดานของไอเทมนี้ (สูงสุด ' + cap.toLocaleString() + ')');
  const floor = Math.max(1, Math.floor(cap * MIN_PRICE_RATIO));
  if (price < floor * qty) bad('ราคาต่ำเกินไป (ต่ำสุดชิ้นละ ' + floor.toLocaleString() + ')');

  const g = await guard(req, price >= HIGH_VALUE ? HIGH_VALUE_AGE_H : MIN_AGE_H);
  const uid = g.uid;
  const reqId = cleanReq(d.reqId);
  const reqRef = reqId ? db.collection('market_reqs').doc(uid + '_' + reqId) : null;
  const tk = ticketFor(price);
  const walletRef = db.collection('market_wallets').doc(uid);
  const limitRef = db.collection('market_limits').doc(uid);
  const pubRef = db.collection('market_listings').doc();
  const privRef = db.collection('market_private').doc(pubRef.id);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const r = await Promise.all([tx.get(walletRef), tx.get(limitRef), reqRef ? tx.get(reqRef) : null]);
    const w = r[0], l = r[1], dup = r[2];
    if (dup && dup.exists) return { id: dup.data().listingId, expiresAt: dup.data().expiresAt, dup: true };   // ยิงซ้ำ: ลงไปแล้ว ไม่หักตั๋วซ้ำ
    const tickets = (w.exists && w.data().tickets) || {};
    if (!(tickets[tk] > 0)) throw new HttpsError('failed-precondition', 'ต้องมีตั๋วลงขายระดับ ' + tk + ' (ราคาไม่เกิน ' + TICKET_MAX[tk].toLocaleString() + ')');
    const times = ((l.exists && l.data().times) || []).filter(function (t) { return t > now - LIST_HOURS * HOUR; });
    if (times.length >= DAILY_LIMIT) throw new HttpsError('resource-exhausted', 'ลงขายครบ ' + DAILY_LIMIT + ' รายการใน 24 ชม. แล้ว');
    if (times.length && now - times[times.length - 1] < MIN_LIST_GAP_MS) throw new HttpsError('resource-exhausted', 'ลงขายถี่เกินไป รอสักครู่');
    times.push(now);
    const expiresAt = now + LIST_HOURS * HOUR;
    tx.update(walletRef, { ['tickets.' + tk]: FV.increment(-1) });
    tx.set(limitRef, { times: times }, { merge: true });
    tx.set(pubRef, { item: item, price: price, status: 'active', createdAt: FV.serverTimestamp(), expiresAt: expiresAt });
    tx.set(privRef, { sellerId: uid, status: 'active', createdAt: now });
    if (reqRef) tx.set(reqRef, { at: now, listingId: pubRef.id, expiresAt: expiresAt, expireAt: new Date(now + 2 * DAY) });
    audit(tx, { type: 'list', uid: uid, listingId: pubRef.id, price: price, sig: sig(item), qty: qty, tk: tk, ip: g.ipH });
    return { id: pubRef.id, expiresAt: expiresAt };
  });
});

// ---------- ซื้อ ----------
// ข้อความปฏิเสธทุกกรณีของด่านกันปั๊มเป็นข้อความกลางเดียวกัน ไม่บอกว่าติดเงื่อนไขไหน/ผู้ขายเป็นใคร
const NEUTRAL = 'ซื้อรายการนี้ไม่ได้ในขณะนี้';

exports.buyItem = onCall(OPT, async (req) => {
  const g = await guard(req);
  const uid = g.uid;
  const d = req.data || {};
  const id = String(d.id || '');
  if (!id) throw new HttpsError('invalid-argument', 'ไม่มี id');
  const reqId = cleanReq(d.reqId);
  const reqRef = reqId ? db.collection('market_reqs').doc(uid + '_' + reqId) : null;
  const pubRef = db.collection('market_listings').doc(id);
  const privRef = db.collection('market_private').doc(id);
  const limitRef = db.collection('market_limits').doc(uid);
  const myLinkRef = db.collection('market_links').doc(uid);
  let pendingFlag = null;

  try {
    await db.runTransaction(async (tx) => {
      pendingFlag = null;
      const first = await Promise.all([tx.get(pubRef), tx.get(privRef), reqRef ? tx.get(reqRef) : null]);
      const pub = first[0], priv = first[1], dup = first[2];
      if (dup && dup.exists) return;                                  // ยิงซ้ำ: ซื้อสำเร็จไปแล้ว
      if (!pub.exists || !priv.exists || pub.data().status !== 'active') throw new HttpsError('not-found', 'สินค้านี้ถูกขายหรือยกเลิกแล้ว');
      const L = pub.data(), P = priv.data();
      const sellerId = P.sellerId;
      if (sellerId === uid) throw new HttpsError('failed-precondition', 'ซื้อของตัวเองไม่ได้');
      if (L.expiresAt && L.expiresAt <= Date.now()) throw new HttpsError('failed-precondition', 'รายการนี้หมดอายุแล้ว');
      if (L.price >= HIGH_VALUE && g.ageH < HIGH_VALUE_AGE_H) throw new HttpsError('failed-precondition', 'ของราคานี้ต้องใช้บัญชีที่สร้างครบ ' + HIGH_VALUE_AGE_H + ' ชม.');

      const pairRef = db.collection('market_pairs').doc(sellerId + '_' + uid);
      const revRef = db.collection('market_pairs').doc(uid + '_' + sellerId);
      const sLimRef = db.collection('market_limits').doc(sellerId);
      const sLinkRef = db.collection('market_links').doc(sellerId);
      const r = await Promise.all([tx.get(limitRef), tx.get(pairRef), tx.get(revRef), tx.get(sLimRef), tx.get(myLinkRef), tx.get(sLinkRef)]);
      const lim = r[0], pr = r[1], rv = r[2], slim = r[3], myLink = r[4], sLink = r[5];
      const now = Date.now();
      const block = function (type, extra) {
        pendingFlag = Object.assign({ type: type, uid: uid, sellerId: sellerId, listingId: id, price: L.price }, extra || {});
        throw new HttpsError('failed-precondition', NEUTRAL);
      };

      // E) IP เดียวกัน
      if (BLOCK_SHARED_IP) {
        const a = (myLink.exists && myLink.data().ips) || {}, b = (sLink.exists && sLink.data().ips) || {};
        if (Object.keys(a).some(function (h) { return a[h] > now - WEEK && b[h] > now - WEEK; })) block('shared_ip');
      }
      // D) เทรดย้อนกลับ
      const rtimes = (rv.exists && rv.data().times) || [];
      if (rtimes.some(function (t) { return t > now - REVERSE_BLOCK_MS; })) block('reverse_trade');

      // ฝั่งผู้ซื้อ: ยอดรายวัน/รายสัปดาห์ + จำนวนผู้ขายต่างคน
      const buys = ((lim.exists && lim.data().buys) || []).filter(function (x) { return x.t > now - WEEK; });
      const buysDay = buys.filter(function (x) { return x.t > now - DAY; });
      if (sum(buysDay) + L.price > BUY_DAILY_GOLD) throw new HttpsError('resource-exhausted', 'ซื้อได้ไม่เกิน ' + BUY_DAILY_GOLD.toLocaleString() + ' ทองต่อ 24 ชม.');
      if (sum(buys) + L.price > BUY_WEEKLY_GOLD) throw new HttpsError('resource-exhausted', 'ถึงเพดานการซื้อรายสัปดาห์แล้ว');
      const sellersDay = {}; buysDay.forEach(function (x) { if (x.s) sellersDay[x.s] = 1; }); sellersDay[sellerId] = 1;
      if (Object.keys(sellersDay).length > MAX_SELLERS_DAY) block('fan_in', { n: Object.keys(sellersDay).length });

      // ฝั่งผู้ขาย: ยอดขายรายสัปดาห์ + จำนวนผู้ซื้อต่างคน
      const sales = ((slim.exists && slim.data().sales) || []).filter(function (x) { return x.t > now - WEEK; });
      const salesDay = sales.filter(function (x) { return x.t > now - DAY; });
      if (sum(sales) + L.price > SELL_WEEKLY_GOLD) block('sell_weekly_cap');
      const buyersDay = {}; salesDay.forEach(function (x) { if (x.b) buyersDay[x.b] = 1; }); buyersDay[uid] = 1;
      if (Object.keys(buyersDay).length > MAX_BUYERS_DAY) block('fan_out', { n: Object.keys(buyersDay).length });

      // คู่เดิมซ้ำ
      const ptimes = ((pr.exists && pr.data().times) || []).filter(function (t) { return t > now - WEEK; });
      if (ptimes.filter(function (t) { return t > now - DAY; }).length >= PAIR_LIMIT) throw new HttpsError('failed-precondition', NEUTRAL);

      buys.push({ t: now, amt: L.price, s: sellerId });
      sales.push({ t: now, amt: L.price, b: uid });
      ptimes.push(now);

      // F) พักของ
      const hold = (L.price >= HIGH_VALUE || g.ageH < HIGH_VALUE_AGE_H) ? HOLD_HIGH_MS : HOLD_MS;
      const availableAt = now + hold;
      const gain = L.price - Math.floor(L.price * TAX);

      tx.update(pubRef, { status: 'sold' });
      tx.update(privRef, { status: 'sold', buyerId: uid, soldAt: now });
      tx.set(limitRef, { buys: buys }, { merge: true });
      tx.set(sLimRef, { sales: sales }, { merge: true });
      tx.set(pairRef, { times: ptimes });
      tx.set(db.collection('market_inbox').doc(uid).collection('entries').doc(),
        { type: 'item', item: L.item, note: 'ซื้อจากตลาด', at: now, availableAt: availableAt });
      tx.set(db.collection('market_inbox').doc(sellerId).collection('entries').doc(),
        { type: 'gold', amount: gain, note: 'ขาย ' + L.item.kind + ' (หักภาษี 5%)', at: now, availableAt: availableAt });
      if (reqRef) tx.set(reqRef, { at: now, listingId: id, expireAt: new Date(now + 2 * DAY) });
      audit(tx, { type: 'buy', uid: uid, sellerId: sellerId, listingId: id, price: L.price, sig: sig(L.item), ip: g.ipH, hold: hold });
    });
  } catch (e) {
    if (pendingFlag) await flag(pendingFlag.uid, pendingFlag.type, pendingFlag);
    throw e;
  }
  return { ok: true };
});

// ---------- ยกเลิก / รับคืน (ไม่คืนตั๋ว ไม่คืนโควตา) ----------
// ของที่ยกเลิก (หรือหมดอายุแล้วกด "รับคืน") จะถูกส่งกลับเข้ากล่องรับของผู้ขายทันที
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
    const now = Date.now();
    tx.update(pubRef, { status: 'cancelled' });
    tx.update(privRef, { status: 'cancelled', cancelledAt: now });
    tx.set(db.collection('market_inbox').doc(uid).collection('entries').doc(),
      { type: 'item', item: pub.data().item, note: 'คืนจากตลาด', at: now, availableAt: now });
    audit(tx, { type: 'cancel', uid: uid, listingId: id });
  });
  return { ok: true };
});

// ---------- กล่องรับ ----------
exports.listInbox = onCall(OPT, async (req) => {
  const uid = authOnly(req);
  const q = await db.collection('market_inbox').doc(uid).collection('entries').limit(100).get();
  return {
    entries: q.docs.map(function (d) {
      const e = d.data();
      return { id: d.id, type: e.type, item: e.item, amount: e.amount, note: e.note, at: e.at, availableAt: e.availableAt };
    })
  };
});

exports.claimInbox = onCall(OPT, async (req) => {
  const uid = authOnly(req);
  const id = String((req.data || {}).id || '');
  if (!id) bad('ไม่มี id');
  const ban = await db.collection('market_bans').doc(uid).get();
  if (ban.exists && ban.data().freeze) throw new HttpsError('permission-denied', 'บัญชีนี้ถูกอายัดการรับของ');
  const ref = db.collection('market_inbox').doc(uid).collection('entries').doc(id);
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) return { entry: null };
    const e = s.data();
    if ((e.availableAt || 0) > now) return { entry: null, wait: e.availableAt - now };   // ยังอยู่ในช่วงพัก
    tx.delete(ref);
    audit(tx, { type: 'claim', uid: uid, entryId: id, kind: e.type });
    return { entry: { type: e.type, item: e.item || null, amount: e.amount || 0 } };
  });
});

// ---------- คืนของหมดอายุอัตโนมัติ (ทุก 60 นาที) ----------
// ชื่อต้องเป็น expireListings (ชื่อเดิมที่ deploy ค้างอยู่ในระบบ)
exports.expireListings = onSchedule({ schedule: 'every 60 minutes', region: REGION, timeZone: 'Asia/Bangkok', maxInstances: 1 }, async () => {
  const now = Date.now();
  const q = await db.collection('market_listings').where('expiresAt', '<=', now).limit(100).get();
  for (const doc of q.docs) {
    if (doc.data().status !== 'active') continue;
    const pubRef = doc.ref;
    const privRef = db.collection('market_private').doc(doc.id);
    try {
      await db.runTransaction(async (tx) => {
        const pub = await tx.get(pubRef);
        const priv = await tx.get(privRef);
        if (!pub.exists || !priv.exists || pub.data().status !== 'active') return;
        const t = Date.now();
        const sellerId = priv.data().sellerId;
        tx.update(pubRef, { status: 'expired' });
        tx.update(privRef, { status: 'expired', cancelledAt: t });
        tx.set(db.collection('market_inbox').doc(sellerId).collection('entries').doc(),
          { type: 'item', item: pub.data().item, note: 'คืนจากตลาด (หมดอายุ)', at: t, availableAt: t });
        audit(tx, { type: 'expire', uid: sellerId, listingId: doc.id });
      });
    } catch (e) {}
  }
});
