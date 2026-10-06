// functions/econ.js — กล่องเงิน + กระเป๋าทองฝั่งเซิร์ฟเวอร์
// ใน functions/index.js ต้องมี:  Object.assign(exports, require('./econ'));
// ชื่อฟังก์ชันต้องไม่ซ้ำกับของตลาด (ตลาดใช้ getWallet, listItem, buyItem, ... อยู่แล้ว)
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FV = admin.firestore.FieldValue;

// ---------- ค่าที่ปรับได้ ----------
const REGION = 'asia-southeast1';
const ENFORCE_APP_CHECK = false;
const OPT = { region: REGION, enforceAppCheck: ENFORCE_APP_CHECK, maxInstances: 3 };   // <-- แก้ (จำกัดจำนวนเครื่อง กันชนโควตา CPU)
const DAY = 24 * 3600000;

const COLORS = ['blue', 'red', 'gold'];
const BOX_RANGE = { blue: [100, 1000], red: [1000, 10000], gold: [10000, 100000] };
const DROP = { gold: 0.0001, red: 0.02, blue: 0.10 };
const BOX_NEED = { blue: 20, red: 20, gold: 5 };
const MAX_SETS = 50;
const MAX_ZONE = 22;
const BOSS_ROLLS = 5;
const KILLS_PER_MIN = 40;
const BUCKET_START = 30;
const BUCKET_MAX = 120;
const MIN_REPORT_GAP_MS = 10000;
const MAX_REPORT_KILLS = 150;
const DAY_CAP = { blue: 3000, red: 800, gold: 80 };

// ----- กระเป๋าทอง -----
const IMPORT_CAP = 1000000000;   // ทองสูงสุดที่ย้ายขึ้นเซิร์ฟเวอร์ "ครั้งเดียว" ตั้งให้มากกว่าผู้เล่นจริงที่รวยสุด
const GAIN_ENFORCE = false;      // false = แค่จดบันทึกทองที่เพิ่มผิดปกติ | true = ตัดส่วนเกินทิ้ง (เปิดหลังย้ายตลาดมาเครดิตที่เซิร์ฟเวอร์)
const GAIN_PER_MIN = 3000000;    // ทองที่ได้เพิ่มต่อนาทีที่ยอมรับ (ดูตัวเลขจริงจาก econ_audit แล้วปรับ)
const GAIN_START = 5000000;      // โควตาตอนเริ่ม
const GAIN_MAX = 50000000;       // สะสมโควตาได้สูงสุด

// ---------- ตัวช่วย ----------
function bad(msg) { throw new HttpsError('invalid-argument', msg); }
function googleUid(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'ต้องล็อกอินด้วย Google ก่อน');
  const prov = req.auth.token && req.auth.token.firebase && req.auth.token.firebase.sign_in_provider;
  if (prov !== 'google.com') throw new HttpsError('permission-denied', 'ต้องล็อกอินด้วย Google ก่อน');
  return req.auth.uid;
}
function rnd() { return crypto.randomInt(0, 1000000) / 1000000; }
function rint(a, b) { return crypto.randomInt(a, b + 1); }
function dayKey(t) { return new Date(t + 7 * 3600000).toISOString().slice(0, 10); }
function cleanReq(v) { const s = String(v || ''); return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : ''; }
function cnt(v) { const n = Math.floor(Number(v) || 0); return n < 0 ? -1 : n; }

// ---------- รายงานการฆ่า -> เซิร์ฟเวอร์สุ่มกล่อง ----------
exports.reportKills = onCall(OPT, async (req) => {
  const uid = googleUid(req);
  const d = req.data || {};
  if (!Number.isInteger(d.zone) || d.zone < 1 || d.zone > MAX_ZONE) bad('ด่านไม่ถูกต้อง');
  const k = d.kills || {};
  const n = cnt(k.normal), r = cnt(k.ranged), b = cnt(k.boss);
  if (n < 0 || r < 0 || b < 0 || n + r + b < 1 || n + r + b > MAX_REPORT_KILLS) bad('ข้อมูลไม่ถูกต้อง');

  const ref = db.collection('econ').doc(uid);
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const e = s.exists ? s.data() : {};
    const last = e.lastReportAt || 0;
    if (last && now - last < MIN_REPORT_GAP_MS) return { ok: false, retryIn: MIN_REPORT_GAP_MS - (now - last) };

    let tokens = e.killTokens === undefined ? BUCKET_START : e.killTokens;
    if (last) tokens += (now - last) / 60000 * KILLS_PER_MIN;
    tokens = Math.min(BUCKET_MAX, tokens);
    let t = Math.floor(tokens);
    const okBoss = Math.min(b, Math.floor(t / BOSS_ROLLS)); t -= okBoss * BOSS_ROLLS;
    const okNR = Math.min(n + r, t);
    const rolls = okNR + okBoss * BOSS_ROLLS;
    const over = (n + r + b * BOSS_ROLLS) - rolls;

    const today = dayKey(now);
    const dayBoxes = (e.day === today && e.dayBoxes) || {};
    const got = { blue: 0, red: 0, gold: 0 };
    for (let i = 0; i < rolls; i++) {
      const x = rnd();
      let c = null;
      if (x < DROP.gold) c = 'gold';
      else if (x < DROP.gold + DROP.red) c = 'red';
      else if (x < DROP.gold + DROP.red + DROP.blue) c = 'blue';
      if (c && (dayBoxes[c] || 0) + got[c] < DAY_CAP[c]) got[c]++;
    }
    const have = e.boxes || {};
    tx.set(ref, {
      killTokens: tokens - rolls, lastReportAt: now,
      day: today,
      dayBoxes: { blue: (dayBoxes.blue || 0) + got.blue, red: (dayBoxes.red || 0) + got.red, gold: (dayBoxes.gold || 0) + got.gold },
      boxes: { blue: FV.increment(got.blue), red: FV.increment(got.red), gold: FV.increment(got.gold) }
    }, { merge: true });
    if (over > rolls * 2 + 10)
      tx.set(db.collection('econ_audit').doc(), { at: now, uid: uid, type: 'over_report', zone: d.zone, n: n, r: r, b: b, rolls: rolls, over: over });
    return {
      ok: true, used: rolls, got: got,
      boxes: { blue: (have.blue || 0) + got.blue, red: (have.red || 0) + got.red, gold: (have.gold || 0) + got.gold }
    };
  });
});

// ---------- เปิดกล่อง ----------
// ย้ายทองแล้ว (goldImported) -> บวกทองเข้ากระเป๋าเซิร์ฟเวอร์ คืน server:true | ยังไม่ย้าย -> server:false
exports.openBoxes = onCall(OPT, async (req) => {
  const uid = googleUid(req);
  const d = req.data || {};
  const color = String(d.color || '');
  if (COLORS.indexOf(color) < 0) bad('สีกล่องไม่ถูกต้อง');
  const sets = d.sets === undefined ? 1 : d.sets;
  if (!Number.isInteger(sets) || sets < 1 || sets > MAX_SETS) bad('จำนวนไม่ถูกต้อง');
  const reqId = cleanReq(d.reqId);
  const ref = db.collection('econ').doc(uid);
  const reqRef = reqId ? db.collection('econ_reqs').doc(uid + '_' + reqId) : null;
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const r = await Promise.all([tx.get(ref), reqRef ? tx.get(reqRef) : null]);
    const s = r[0], dup = r[1];
    if (dup && dup.exists) return dup.data().result;
    const e = s.exists ? s.data() : {};
    const have = (e.boxes && e.boxes[color]) || 0;
    const need = BOX_NEED[color] * sets;
    if (have < need) throw new HttpsError('failed-precondition', 'ต้องมีกล่องครบ ' + BOX_NEED[color] + ' ใบถึงจะเปิดได้ (มี ' + have + ')');
    const rg = BOX_RANGE[color];
    let gold = 0;
    for (let i = 0; i < need; i++) gold += rint(rg[0], rg[1]);
    const server = !!e.goldImported;
    const result = { color: color, opened: need, gold: gold, left: have - need, server: server, balance: (e.gold || 0) + (server ? gold : 0) };
    const upd = { boxes: { [color]: FV.increment(-need) }, goldFromBoxes: FV.increment(gold) };
    if (server) upd.gold = FV.increment(gold);
    tx.set(ref, upd, { merge: true });
    if (reqRef) tx.set(reqRef, { result: result, at: now, expireAt: new Date(now + 2 * DAY) });
    tx.set(db.collection('econ_audit').doc(), { at: now, uid: uid, type: 'open', color: color, opened: need, gold: gold });
    return result;
  });
});

// ---------- ดูจำนวนกล่อง ----------
exports.getBoxes = onCall(OPT, async (req) => {
  const uid = googleUid(req);
  const s = await db.collection('econ').doc(uid).get();
  const e = s.exists ? s.data() : {};
  const b = e.boxes || {};
  return {
    boxes: { blue: b.blue || 0, red: b.red || 0, gold: b.gold || 0 },
    need: BOX_NEED, range: BOX_RANGE, maxSets: MAX_SETS
  };
});

// ---------- กระเป๋าทองฝั่งเซิร์ฟเวอร์ ----------
exports.getGoldWallet = onCall(OPT, async (req) => {
  const uid = googleUid(req);
  const s = await db.collection('econ').doc(uid).get();
  const e = s.exists ? s.data() : {};
  return { imported: !!e.goldImported, gold: e.gold || 0 };
});

// ย้ายทองในเครื่องขึ้นเซิร์ฟเวอร์ "ครั้งเดียวต่อบัญชี" (เชื่อค่าจากเครื่องครั้งนี้ครั้งเดียว จึงมีเพดาน IMPORT_CAP)
exports.importGold = onCall(OPT, async (req) => {
  const uid = googleUid(req);
  const amt = Math.floor(Number((req.data || {}).amount));
  if (!Number.isFinite(amt) || amt < 0) bad('จำนวนไม่ถูกต้อง');
  const ref = db.collection('econ').doc(uid);
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const e = s.exists ? s.data() : {};
    if (e.goldImported) return { imported: true, gold: e.gold || 0, first: false };
    const g = Math.min(amt, IMPORT_CAP);
    tx.set(ref, { gold: g, goldImported: true, goldImportedAt: now }, { merge: true });
    tx.set(db.collection('econ_audit').doc(), { at: now, uid: uid, type: 'import', asked: amt, gold: g });
    return { imported: true, gold: g, first: true };
  });
});

// ไคลเอนต์ส่ง "ส่วนต่างทอง" (+ได้ / -ใช้) ทุก ~10 วินาที  reqId ซ้ำ = คืนผลเดิม ไม่นับซ้ำ
exports.syncGold = onCall(OPT, async (req) => {
  const uid = googleUid(req);
  const d = req.data || {};
  const delta = d.delta;
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1e12) bad('จำนวนไม่ถูกต้อง');
  const reqId = cleanReq(d.reqId);
  if (!reqId) bad('reqId ไม่ถูกต้อง');
  const ref = db.collection('econ').doc(uid);
  const reqRef = db.collection('econ_reqs').doc(uid + '_' + reqId);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const r = await Promise.all([tx.get(ref), tx.get(reqRef)]);
    const s = r[0], dup = r[1];
    if (dup.exists) return dup.data().result;
    const e = s.exists ? s.data() : {};
    if (!e.goldImported) throw new HttpsError('failed-precondition', 'ยังไม่ได้ย้ายทองขึ้นเซิร์ฟเวอร์');

    const bal = e.gold || 0;
    let tokens = e.goldTokens === undefined ? GAIN_START : e.goldTokens;
    if (e.goldTokAt) tokens += (now - e.goldTokAt) / 60000 * GAIN_PER_MIN;
    tokens = Math.min(GAIN_MAX, tokens);

    let granted = delta, over = 0;
    if (delta > 0) {
      over = Math.max(0, delta - Math.floor(tokens));
      if (over > 0 && GAIN_ENFORCE) granted = delta - over;
      tokens = Math.max(0, tokens - granted);
    }
    const newBal = Math.max(0, bal + granted);
    const result = { balance: newBal, granted: granted, over: over };

    tx.set(ref, { gold: newBal, goldTokens: tokens, goldTokAt: now }, { merge: true });
    tx.set(reqRef, { result: result, at: now, expireAt: new Date(now + 2 * DAY) });
    if (over > 0)
      tx.set(db.collection('econ_audit').doc(), { at: now, uid: uid, type: 'gold_over', delta: delta, over: over, balance: bal, enforced: GAIN_ENFORCE });
    return result;
  });
});
