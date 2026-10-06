// functions/econ.js — กล่องเงินฝั่งเซิร์ฟเวอร์ (เฟสแรกของระบบเศรษฐกิจฝั่งเซิร์ฟเวอร์)
// ใน functions/index.js เพิ่มบรรทัด:  Object.assign(exports, require('./econ'));
//
// หลักการ:
//  - ไคลเอนต์รายงานแค่ "ฆ่ามอนชนิดไหนกี่ตัวในด่านไหน" ทุก ~45 วินาที
//  - เซิร์ฟเวอร์เป็นคนสุ่มกล่อง (ฟ้า/แดง/ทอง) และเก็บจำนวนกล่องไว้ที่ econ/{uid}
//  - เปิดกล่องต้องมีครบตามที่กำหนดของสีนั้น (ฟ้า/แดง 20 ใบ, ทอง 5 ใบ) เซิร์ฟเวอร์สุ่มทองตอนเปิด แล้วคืนจำนวนทองให้ไคลเอนต์
//  - จำกัดอัตรา (kills/นาที) + เพดานกล่องต่อวัน กันบอทและการรายงานเกิน
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FV = admin.firestore.FieldValue;

// ---------- ค่าที่ปรับได้ ----------
const REGION = 'asia-southeast1';          // ต้องตรงกับฝั่งไคลเอนต์
const ENFORCE_APP_CHECK = false;           // เปิดเป็น true หลังตั้ง App Check
const OPT = { region: REGION, enforceAppCheck: ENFORCE_APP_CHECK };
const DAY = 24 * 3600000;

const COLORS = ['blue', 'red', 'gold'];
const BOX_RANGE = { blue: [100, 1000], red: [1000, 10000], gold: [10000, 100000] };   // ทองต่อกล่อง (สุ่มเท่าๆ กันในช่วง)
// โอกาสดรอป "ต่อการสุ่ม 1 ครั้ง" (มอนธรรมดา/ยิงไกล = 1 ครั้ง, บอส = BOSS_ROLLS ครั้ง) รวมกันต้องไม่เกิน 1
//   ฟ้า 10% | แดง 2% | ทอง 0.01% (0.0001)
const DROP = { gold: 0.0001, red: 0.02, blue: 0.10 };
const BOX_NEED = { blue: 20, red: 20, gold: 5 };   // ต้องมีกี่ใบต่อการเปิด 1 ชุด (แยกตามสี)
const MAX_SETS = 50;                       // เปิดได้สูงสุดกี่ชุดต่อครั้ง
const MAX_ZONE = 22;                       // ด่าน 1-9 + ด่านจุติ 10-22
const BOSS_ROLLS = 5;                      // บอส 1 ตัว = สุ่ม 5 ครั้ง (และกินโควตา 5)
const KILLS_PER_MIN = 40;                  // อัตราฆ่าสูงสุดที่ยอมรับ (ตั้งตามที่คนเล่นจริง/บอทออโต้ทำได้)
const BUCKET_START = 30;                   // โควตาตอนเริ่ม
const BUCKET_MAX = 120;                    // สะสมโควตาได้สูงสุด (ประมาณ 3 นาที)
const MIN_REPORT_GAP_MS = 10000;           // รายงานห่างกันอย่างน้อย
const MAX_REPORT_KILLS = 150;              // ต่อการรายงาน 1 ครั้ง
const DAY_CAP = { blue: 3000, red: 800, gold: 80 };   // เพดานกล่องที่ได้ต่อวัน (เวลาไทย)

// ---------- ตัวช่วย ----------
function bad(msg) { throw new HttpsError('invalid-argument', msg); }
function googleUid(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'ต้องล็อกอินด้วย Google ก่อน');
  const prov = req.auth.token && req.auth.token.firebase && req.auth.token.firebase.sign_in_provider;
  if (prov !== 'google.com') throw new HttpsError('permission-denied', 'ต้องล็อกอินด้วย Google ก่อน');
  return req.auth.uid;
}
function rnd() { return crypto.randomInt(0, 1000000) / 1000000; }
function rint(a, b) { return crypto.randomInt(a, b + 1); }           // รวมปลายทั้งสองข้าง
function dayKey(t) { return new Date(t + 7 * 3600000).toISOString().slice(0, 10); }
function cleanReq(v) { const s = String(v || ''); return /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : ''; }
function cnt(v) { const n = Math.floor(Number(v) || 0); return n < 0 ? -1 : n; }

// ---------- รายงานการฆ่า -> เซิร์ฟเวอร์สุ่มกล่อง ----------
// รับ { zone: 1-22, kills: { normal, ranged, boss } }
// คืน { ok:true, got:{blue,red,gold}, boxes:{...ยอดรวม}, used } หรือ { ok:false, retryIn } (ไคลเอนต์เก็บยอดไว้ส่งใหม่)
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

    // ถังโควตา (token bucket): เติมตามเวลาเซิร์ฟเวอร์ที่ผ่านไปจริง
    let tokens = e.killTokens === undefined ? BUCKET_START : e.killTokens;
    if (last) tokens += (now - last) / 60000 * KILLS_PER_MIN;
    tokens = Math.min(BUCKET_MAX, tokens);
    let t = Math.floor(tokens);
    const okBoss = Math.min(b, Math.floor(t / BOSS_ROLLS)); t -= okBoss * BOSS_ROLLS;
    const okNR = Math.min(n + r, t);
    const rolls = okNR + okBoss * BOSS_ROLLS;
    const over = (n + r + b * BOSS_ROLLS) - rolls;           // ส่วนที่รายงานเกินโควตา (ถูกทิ้ง)

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
    if (over > rolls * 2 + 10)                                 // รายงานเกินมากผิดปกติ: จดไว้ให้ตรวจ
      tx.set(db.collection('econ_audit').doc(), { at: now, uid: uid, type: 'over_report', zone: d.zone, n: n, r: r, b: b, rolls: rolls, over: over });
    return {
      ok: true, used: rolls, got: got,
      boxes: { blue: (have.blue || 0) + got.blue, red: (have.red || 0) + got.red, gold: (have.gold || 0) + got.gold }
    };
  });
});

// ---------- เปิดกล่อง ----------
// รับ { color, sets (ชุดละ BOX_NEED[color] ใบ), reqId } คืน { color, opened, gold, left }
// ทองที่ได้ "ไคลเอนต์เอาไปบวกเอง" ไปก่อน จนกว่าจะย้ายทองมาไว้ฝั่งเซิร์ฟเวอร์ (เฟสถัดไป) — goldFromBoxes ใช้เป็นสถิติตรวจสอบ
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
    if (dup && dup.exists) return dup.data().result;           // ยิงซ้ำ: คืนผลเดิม ไม่หักกล่องซ้ำ
    const have = (s.exists && s.data().boxes && s.data().boxes[color]) || 0;
    const need = BOX_NEED[color] * sets;
    if (have < need) throw new HttpsError('failed-precondition', 'ต้องมีกล่องครบ ' + BOX_NEED[color] + ' ใบถึงจะเปิดได้ (มี ' + have + ')');
    const rg = BOX_RANGE[color];
    let gold = 0;
    for (let i = 0; i < need; i++) gold += rint(rg[0], rg[1]);
    const result = { color: color, opened: need, gold: gold, left: have - need };
    tx.set(ref, { boxes: { [color]: FV.increment(-need) }, goldFromBoxes: FV.increment(gold) }, { merge: true });
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
