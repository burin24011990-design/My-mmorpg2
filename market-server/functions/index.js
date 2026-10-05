'use strict';
// ===== ตลาดกลาง: เซิร์ฟเวอร์เป็นผู้ตัดสินทุกธุรกรรม =====
// ฟังก์ชันที่เรียกได้: marketSync, buyPass, deposit, withdraw, listItem, buyItem, cancelItem, ackMail
// เปิด App Check บังคับ: ตั้งค่า ENFORCE_APP_CHECK=true ใน functions/.env (หลังตั้ง App Check ฝั่งเกมแล้วเท่านั้น)

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const FV = admin.firestore.FieldValue;

// ---------- ค่าปรับแต่งทั้งหมดอยู่ที่นี่ ----------
const C = {
  PASS_PRICE: 100e6,          // ใบอนุญาตขาย (ใช้ 1 ใบต่อการลงขาย 1 ครั้ง)
  FEE_RATE: 0.05,             // ค่าธรรมเนียมตลาด หักจากผู้ขายตอนขายได้
  LIST_FEE_RATE: 0.02,        // ค่าลงขาย หักตอนลงขาย (ไม่คืนเมื่อยกเลิก)
  MAX_PRICE: 5e9,             // เพดานราคาต่อชิ้น
  MAX_ACTIVE: 10,             // ลงขายพร้อมกันได้สูงสุดต่อคน
  MAX_LIST_PER_DAY: 30,       // ลงขายได้สูงสุดต่อวัน
  DEPOSIT_CAP_PER_DAY: 200e6, // ทองที่ฝากเข้ากระเป๋าตลาดได้ต่อวัน (ด่านสำคัญที่สุดกันทองปลอม)
  // ขีดจำกัดของไอเทม: ปรับให้ตรงกับ LEVEL_CAP / MAX_STAR / เพดานตีบวกในเกมจริง
  LEVEL_CAP: 200, MAX_STAR: 10, MAX_PLUS: 20, MAX_OPTS: 6,
  // ตรวจทองในเซฟ: เพดานรายได้ที่ "เป็นไปได้" (ผู้เล่นจริง ~20 ล้าน/วัน ≈ 0.83 ล้าน/ชม.)
  GOLD_PER_HOUR: 5e6, GOLD_BURST: 30e6,
  SAVE_FRESH_MS: 120000,      // เซฟบนคลาวด์ต้องใหม่กว่านี้ตอนทำธุรกรรม
  GRACE_MS: 180000,           // เวลาเผื่อให้เกมลบไอเทมออกจากเซฟหลังลงขาย/ขายได้
  COOLDOWN_MS: 1500,          // ห่างกันอย่างน้อยระหว่างธุรกรรมของคนเดียวกัน
};
const OPTS = {
  region: 'asia-southeast1',
  maxInstances: 10,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
};
const SAVE_KEY = 'my_mmorpg_save_v1';
const UID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAIL_ID_RE = /^[A-Za-z0-9]{20}$/;

const fail = (code, msg) => new HttpsError(code, msg);
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const dayKey = now => new Date(now + 7 * 3600e3).toISOString().slice(0, 10);   // วันตามเวลาไทย
const mailCol = uid => db.collection('mailbox').doc(uid).collection('items');

// ---------- ตรวจไอเทม (ปฏิเสธ field ที่ไม่รู้จัก เพื่อไม่ให้ข้อมูลไอเทมหายเงียบๆ) ----------
const SLOTS = ['weapon', 'helmet', 'armor', 'gloves', 'shoes', 'ring', 'necklace'];
const LIGHT_SLOTS = ['helmet', 'armor', 'gloves', 'shoes'];
const CLASSES = ['sword', 'mage', 'archer', 'priest', 'rogue'];
const TIERS = ['white', 'blue', 'red', 'gold'];
const ALLOWED_KEYS = ['uid', 'kind', 'baseSlot', 'level', 'star', 'plus', 'tier', 'variant', 'class', 'opts'];

function sanitizeItem(it) {
  if (!it || typeof it !== 'object' || it.kind !== 'equip') throw fail('invalid-argument', 'ขายได้เฉพาะอุปกรณ์');
  const unknown = Object.keys(it).find(k => !ALLOWED_KEYS.includes(k));
  if (unknown) throw fail('invalid-argument', 'ไอเทมมีข้อมูล "' + unknown + '" ที่ตลาดยังไม่รองรับ');
  if (!SLOTS.includes(it.baseSlot)) throw fail('invalid-argument', 'ประเภทไอเทมไม่ถูกต้อง');
  const star = it.star === undefined ? 0 : it.star, plus = it.plus === undefined ? 0 : it.plus;
  if (!isInt(it.level, 1, C.LEVEL_CAP) || !isInt(star, 0, C.MAX_STAR) || !isInt(plus, 0, C.MAX_PLUS)) {
    throw fail('invalid-argument', 'ค่าเลเวล/ดาว/ตีบวกของไอเทมผิดปกติ');
  }
  const tier = it.tier === undefined ? 'white' : it.tier;
  if (!TIERS.includes(tier)) throw fail('invalid-argument', 'สีไอเทมไม่ถูกต้อง');
  const out = { uid: it.uid, kind: 'equip', baseSlot: it.baseSlot, level: it.level, star, plus, tier };
  if (it.baseSlot === 'weapon') {
    if (!CLASSES.includes(it.class)) throw fail('invalid-argument', 'คลาสอาวุธไม่ถูกต้อง');
    out.class = it.class;
  } else if (it.class !== undefined) throw fail('invalid-argument', 'ไอเทมไม่ใช่อาวุธแต่มีคลาส');
  if (it.variant !== undefined) {
    if (it.variant !== 'light' || !LIGHT_SLOTS.includes(it.baseSlot)) throw fail('invalid-argument', 'variant ไม่ถูกต้อง');
    out.variant = 'light';
  }
  if (it.opts !== undefined) {
    if (!Array.isArray(it.opts) || it.opts.length > C.MAX_OPTS) throw fail('invalid-argument', 'ออฟชั่นผิดปกติ');
    // TODO: ตรวจค่าออฟชั่นให้ละเอียดตาม lootOptions.js (ชนิด/ช่วงค่าที่สุ่มได้จริงของแต่ละสีหิน)
    const okPrim = v => (typeof v === 'number' && isFinite(v)) || (typeof v === 'string' && v.length <= 20);
    for (const o of it.opts) {
      if (!o || typeof o !== 'object' || Array.isArray(o) || !Object.values(o).every(okPrim)) {
        throw fail('invalid-argument', 'รูปแบบออฟชั่นไม่ถูกต้อง');
      }
    }
    out.opts = it.opts;
  }
  return out;
}

// ---------- กระเป๋าเงินตลาด + ตรวจเซฟ ----------
function blankWallet(now) {
  return { gold: 0, passes: 0, mailGold: 0, baseline: null, dep: { day: '', amount: 0 }, lst: { day: '', count: 0 }, lastOp: 0, created: now };
}

// ทองสูงสุดที่ "เป็นไปได้" ในเซฟ นับจากฐานที่ตรวจครั้งก่อน
function allowance(w, now, burst) {
  const b = w.baseline;
  const hrs = Math.max(0, (now - b.at) / 3600000);
  return b.gold + (w.mailGold || 0) + (burst ? C.GOLD_BURST : 0) + hrs * C.GOLD_PER_HOUR;
}

async function readSave(uid) {
  const snap = await db.doc('saves/' + uid).get();
  if (!snap.exists) throw fail('failed-precondition', 'ยังไม่มีเซฟบนคลาวด์ (ล็อกอิน Google แล้วเล่นสักพัก)');
  if (Date.now() - snap.updateTime.toMillis() > C.SAVE_FRESH_MS) throw fail('failed-precondition', 'เซฟบนคลาวด์ยังไม่อัปเดต ลองใหม่อีกครั้ง');
  let g;
  try { g = JSON.parse(JSON.parse(snap.get('data'))[SAVE_KEY]); } catch (e) { g = null; }
  if (!g || !g.stats) throw fail('failed-precondition', 'อ่านเซฟเกมไม่ได้');
  return {
    gold: Number(g.stats.gold) || 0,
    bag: Array.isArray(g.bag) ? g.bag : [],
    equipment: g.equipment && typeof g.equipment === 'object' ? g.equipment : {},
    charName: String(snap.get('charName') || '').slice(0, 12),
  };
}

function sanity(save, w, now) {
  if (!w.baseline) return null;
  const max = allowance(w, now, true);
  if (save.gold > max) return 'gold ' + save.gold + ' > ' + Math.round(max);
  return null;
}

// ไอเทมที่ขายไปแล้ว/กำลังลงขาย แต่ยังอยู่ในเซฟ = ก๊อปปี้
async function dupeCheck(uid, save, now) {
  const uids = new Set();
  save.bag.concat(Object.values(save.equipment)).forEach(it => {
    if (it && it.kind === 'equip' && typeof it.uid === 'string' && UID_RE.test(it.uid)) uids.add(it.uid);
  });
  if (!uids.size) return null;
  const snaps = await db.getAll(...[...uids].slice(0, 300).map(u => db.doc('items/' + u)));
  for (const s of snaps) {
    if (!s.exists) continue;
    const d = s.data();
    if (now - d.since > C.GRACE_MS && (d.ownerUid !== uid || d.state === 'listed')) return 'dupe item ' + s.id;
  }
  return null;
}

async function flagUser(uid, reason) {
  await db.doc('flags/' + uid).set({ blocked: true, reason, at: FV.serverTimestamp() }, { merge: true });
  await db.collection('marketLogs').add({ type: 'flag', uid, reason, at: FV.serverTimestamp() });
}

async function assertOpen(uid) {
  const [cfg, flag] = await Promise.all([db.doc('config/market').get(), db.doc('flags/' + uid).get()]);
  if (cfg.exists && cfg.get('enabled') === false) throw fail('unavailable', 'ตลาดปิดปรับปรุงชั่วคราว');
  if (flag.exists && flag.get('blocked') === true) throw fail('permission-denied', 'บัญชีนี้ถูกระงับสิทธิ์ตลาด');
}

// ---------- ตัวห่อธุรกรรม: ตรวจทุกอย่าง -> ทำใน transaction เดียว -> อัปเดตฐานตรวจทอง ----------
async function run(req, fn) {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw fail('unauthenticated', 'ต้องล็อกอินก่อน');
  const data = req.data || {};
  await assertOpen(uid);
  const save = await readSave(uid);
  const now = Date.now();
  const wref = db.doc('marketWallets/' + uid);

  const w0 = (await wref.get()).data();
  if (w0) {
    const bad = sanity(save, w0, now) || await dupeCheck(uid, save, now);
    if (bad) {
      await flagUser(uid, bad);
      throw fail('permission-denied', 'ตรวจพบความผิดปกติของบัญชี สิทธิ์ตลาดถูกระงับ');
    }
  }

  return db.runTransaction(async tx => {
    const ws = await tx.get(wref);
    const w = ws.exists ? ws.data() : blankWallet(now);
    if (now - (w.lastOp || 0) < C.COOLDOWN_MS) throw fail('resource-exhausted', 'ช้าลงหน่อย ลองใหม่อีกครั้ง');
    const ctx = { uid, save, now, tx, w, logs: [] };
    const out = (await fn(ctx, data)) || {};          // fn ต้องอ่านทั้งหมดก่อนเขียน
    w.lastOp = now;
    w.baseline = { gold: save.gold, at: now };
    tx.set(wref, w);
    ctx.logs.forEach(l => tx.set(db.collection('marketLogs').doc(), Object.assign({ uid, at: FV.serverTimestamp() }, l)));
    return Object.assign(out, { wallet: { gold: w.gold, passes: w.passes, mailGold: w.mailGold } });
  });
}

// ---------- ฟังก์ชัน ----------
exports.marketSync = onCall(OPTS, req => run(req, async () => ({})));

exports.buyPass = onCall(OPTS, req => run(req, async ({ w, logs }, data) => {
  const n = data.count === undefined ? 1 : data.count;
  if (!isInt(n, 1, 10)) throw fail('invalid-argument', 'จำนวนไม่ถูกต้อง');
  const cost = C.PASS_PRICE * n;
  if (w.gold < cost) throw fail('failed-precondition', 'ทองในกระเป๋าตลาดไม่พอ');
  w.gold -= cost; w.passes += n;
  logs.push({ type: 'buyPass', n, cost });
}));

// ฝากทองเข้ากระเป๋าตลาด: เกมต้องหักทองในเซฟ + อัปโหลดคลาวด์ก่อน แล้วค่อยเรียก
exports.deposit = onCall(OPTS, req => run(req, async ({ w, save, now, logs }, data) => {
  const amount = data.amount;
  if (!isInt(amount, 1, C.DEPOSIT_CAP_PER_DAY)) throw fail('invalid-argument', 'จำนวนทองไม่ถูกต้อง');
  if (!w.baseline) throw fail('failed-precondition', 'ต้องเปิดตลาด (marketSync) ก่อน');
  const day = dayKey(now);
  if (!w.dep || w.dep.day !== day) w.dep = { day, amount: 0 };
  if (w.dep.amount + amount > C.DEPOSIT_CAP_PER_DAY) throw fail('resource-exhausted', 'ฝากทองเกินโควตาของวันนี้');
  if (save.gold > allowance(w, now, false) - amount) throw fail('failed-precondition', 'ทองในเซฟคลาวด์ยังไม่ถูกหัก ลองใหม่อีกครั้ง');
  w.gold += amount; w.dep.amount += amount;
  logs.push({ type: 'deposit', amount });
}));

// ถอนทองออกจากกระเป๋าตลาด: ส่งเข้ากล่องจดหมาย ให้เกมรับแล้วเรียก ackMail
exports.withdraw = onCall(OPTS, req => run(req, async ({ w, uid, now, tx, logs }, data) => {
  const amount = data.amount;
  if (!isInt(amount, 1, 9e12) || amount > w.gold) throw fail('invalid-argument', 'จำนวนทองไม่ถูกต้อง');
  w.gold -= amount; w.mailGold += amount;
  tx.set(mailCol(uid).doc(), { type: 'gold', amount, at: now });
  logs.push({ type: 'withdraw', amount });
}));

exports.listItem = onCall(OPTS, req => run(req, async ({ w, uid, save, now, tx, logs }, data) => {
  const itemUid = String(data.itemUid || ''), price = data.price;
  if (!UID_RE.test(itemUid)) throw fail('invalid-argument', 'ไอเทมนี้ยังไม่มีรหัส uid');
  if (!isInt(price, 1, C.MAX_PRICE)) throw fail('invalid-argument', 'ราคาไม่ถูกต้อง (1 - ' + C.MAX_PRICE + ')');
  const raw = save.bag.find(it => it && it.uid === itemUid);
  if (!raw) throw fail('failed-precondition', 'ไม่พบไอเทมในเซฟคลาวด์ (ต้องอยู่ในกระเป๋า ไม่ใช่ที่สวมใส่)');
  const item = sanitizeItem(raw);
  const fee = Math.ceil(price * C.LIST_FEE_RATE);
  if (w.passes < 1) throw fail('failed-precondition', 'ไม่มีใบอนุญาตขาย');
  if (w.gold < fee) throw fail('failed-precondition', 'ทองในกระเป๋าตลาดไม่พอจ่ายค่าลงขาย ' + fee);
  const day = dayKey(now);
  if (!w.lst || w.lst.day !== day) w.lst = { day, count: 0 };
  if (w.lst.count >= C.MAX_LIST_PER_DAY) throw fail('resource-exhausted', 'ลงขายครบโควตาของวันนี้แล้ว');

  const regRef = db.doc('items/' + itemUid);
  const [reg, act] = await Promise.all([
    tx.get(regRef),
    tx.get(db.collection('market').where('sellerUid', '==', uid).where('status', '==', 'active')),
  ]);
  if (act.size >= C.MAX_ACTIVE) throw fail('resource-exhausted', 'ลงขายพร้อมกันได้ไม่เกิน ' + C.MAX_ACTIVE + ' ชิ้น');
  if (reg.exists && (reg.get('ownerUid') !== uid || reg.get('state') !== 'free')) {
    throw fail('already-exists', 'ไอเทมชิ้นนี้ลงขายไม่ได้ (ถูกใช้ไปแล้วหรืออยู่ระหว่างขั้นตอน)');
  }

  const lref = db.collection('market').doc();
  w.passes -= 1; w.gold -= fee; w.lst.count += 1;
  tx.set(regRef, { ownerUid: uid, state: 'listed', since: now, listingId: lref.id });
  tx.set(lref, {
    sellerUid: uid, sellerName: save.charName || 'ผู้เล่น', item, itemUid, price,
    status: 'active', createdAt: FV.serverTimestamp(), createdMs: now,
  });
  logs.push({ type: 'list', listingId: lref.id, itemUid, price, fee });
  return { listingId: lref.id };       // เกมลบไอเทมออกจากกระเป๋าแล้วเซฟทันที
}));

exports.buyItem = onCall(OPTS, req => run(req, async ({ w, uid, now, tx, logs }, data) => {
  const id = String(data.id || '');
  if (!id || id.length > 40 || id.includes('/')) throw fail('invalid-argument', 'รหัสประกาศไม่ถูกต้อง');
  const lref = db.doc('market/' + id);
  const lsnap = await tx.get(lref);
  if (!lsnap.exists) throw fail('not-found', 'ไม่พบประกาศ');
  const L = lsnap.data();
  const sref = db.doc('marketWallets/' + L.sellerUid);
  const sw = await tx.get(sref);
  if (L.status !== 'active') throw fail('failed-precondition', 'ประกาศนี้ปิดแล้ว');
  if (L.sellerUid === uid) throw fail('failed-precondition', 'ซื้อของตัวเองไม่ได้');
  if (w.gold < L.price) throw fail('failed-precondition', 'ทองในกระเป๋าตลาดไม่พอ');

  const net = Math.floor(L.price * (1 - C.FEE_RATE));
  const seller = sw.exists ? sw.data() : blankWallet(now);
  w.gold -= L.price;
  seller.gold += net;
  tx.set(sref, seller);
  tx.update(lref, { status: 'sold', buyerUid: uid, soldAt: FV.serverTimestamp() });
  tx.set(db.doc('items/' + L.itemUid), { ownerUid: uid, state: 'mail', since: now });
  tx.set(mailCol(uid).doc(), { type: 'item', item: L.item, itemUid: L.itemUid, at: now });
  logs.push({ type: 'buy', listingId: id, itemUid: L.itemUid, price: L.price, sellerUid: L.sellerUid, net });
  return { listingId: id };
}));

exports.cancelItem = onCall(OPTS, req => run(req, async ({ uid, now, tx, logs }, data) => {
  const id = String(data.id || '');
  if (!id || id.length > 40 || id.includes('/')) throw fail('invalid-argument', 'รหัสประกาศไม่ถูกต้อง');
  const lref = db.doc('market/' + id);
  const lsnap = await tx.get(lref);
  if (!lsnap.exists) throw fail('not-found', 'ไม่พบประกาศ');
  const L = lsnap.data();
  if (L.sellerUid !== uid) throw fail('permission-denied', 'ไม่ใช่ประกาศของคุณ');
  if (L.status !== 'active') throw fail('failed-precondition', 'ประกาศนี้ปิดแล้ว');
  tx.update(lref, { status: 'cancelled' });
  tx.set(db.doc('items/' + L.itemUid), { ownerUid: uid, state: 'mail', since: now });
  tx.set(mailCol(uid).doc(), { type: 'item', item: L.item, itemUid: L.itemUid, at: now });
  logs.push({ type: 'cancel', listingId: id, itemUid: L.itemUid });
}));

// ยืนยันรับจดหมาย: เกมต้องใส่ของ/ทองลงเซฟ + อัปโหลดคลาวด์ให้เสร็จก่อน แล้วจึงเรียก
exports.ackMail = onCall(OPTS, req => run(req, async ({ w, uid, now, tx, logs }, data) => {
  const ids = Array.isArray(data.ids) ? data.ids : [];
  if (!ids.length || ids.length > 20 || !ids.every(i => typeof i === 'string' && MAIL_ID_RE.test(i))) {
    throw fail('invalid-argument', 'รายการจดหมายไม่ถูกต้อง');
  }
  const snaps = await Promise.all(ids.map(i => tx.get(mailCol(uid).doc(i))));
  const itemRegs = [];
  snaps.forEach(s => { if (s.exists && s.get('type') === 'item') itemRegs.push(db.doc('items/' + s.get('itemUid'))); });
  const regSnaps = await Promise.all(itemRegs.map(r => tx.get(r)));
  const regMap = {};
  regSnaps.forEach(r => { regMap[r.id] = r; });

  snaps.forEach(s => {
    if (!s.exists) return;
    const m = s.data();
    if (m.type === 'gold') {
      w.mailGold = Math.max(0, w.mailGold - m.amount);
    } else if (m.type === 'item') {
      const r = regMap[m.itemUid];
      if (r && r.exists && r.get('ownerUid') === uid) tx.set(r.ref, { ownerUid: uid, state: 'free', since: now });
    }
    tx.delete(s.ref);
  });
  logs.push({ type: 'ack', n: snaps.filter(s => s.exists).length });
}));
