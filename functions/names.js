// functions/names.js — ตั้งชื่อตัวละคร: ต้องล็อกอิน / ไม่ซ้ำ / 2-15 ตัวอักษร / ไม่มีคำหยาบ / ตั้งแล้วเปลี่ยนไม่ได้ (v2, asia-southeast1)
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();

const MIN_LEN = 2;
const MAX_LEN = 15;

// อนุญาต: ไทย, อังกฤษ, ตัวเลข, ช่องว่าง, _
const ALLOWED = /^[\u0E00-\u0E7Fa-zA-Z0-9 _]+$/;

// ชื่อที่สงวนไว้
const RESERVED = ['admin', 'gm', 'mod', 'moderator', 'system', 'xianhe', 'แอดมิน', 'ระบบ', 'ผู้ดูแล'];

// คำหยาบ: ตรวจแบบ "มีคำนี้อยู่ในชื่อ" (เพิ่ม/ลบคำได้เอง)
const BAD_SUBSTR = [
  // ไทย
  'ควย', 'เหี้ย', 'สัส', 'เย็ด', 'แม่ง', 'แมร่ง', 'เงี่ยน', 'กระหรี่', 'ส้นตีน',
  'ระยำ', 'ชาติชั่ว', 'ชาติหมา', 'อีดอก', 'ไอ้สัตว์', 'อีสัตว์', 'ไอสัตว์', 'ตอแหล',
  // อังกฤษ
  'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'pussy', 'asshole', 'whore', 'slut', 'nigg', 'faggot', 'bastard', 'porn',
];
// คำสั้น ตรวจเฉพาะกรณีชื่อ "ตรงทั้งคำ"
const BAD_EXACT = ['หี', 'ห่า', 'ควาย', 'ชั่ว', 'ass', 'tit', 'tits', 'fag', 'dick', 'cock', 'sex', 'rape'];

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

function squash(s) {
  let t = s.normalize('NFC').toLowerCase().replace(/[\s_.\-]+/g, '');
  t = t.replace(/[0134579@$]/g, (c) => LEET[c] || c);
  t = t.replace(/(.)\1{2,}/g, '$1');
  return t;
}

function isProfane(name) {
  const t = squash(name);
  const raw = name.normalize('NFC').toLowerCase().replace(/\s+/g, '');
  if (BAD_EXACT.includes(t) || BAD_EXACT.includes(raw)) return true;
  return BAD_SUBSTR.some((w) => t.includes(w) || raw.includes(w));
}

function validate(rawName) {
  const name = String(rawName || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  const len = [...name].length;
  if (len < MIN_LEN) return { err: 'ชื่อต้องมีอย่างน้อย ' + MIN_LEN + ' ตัวอักษร' };
  if (len > MAX_LEN) return { err: 'ชื่อต้องไม่เกิน ' + MAX_LEN + ' ตัวอักษร' };
  if (!ALLOWED.test(name)) return { err: 'ใช้ได้เฉพาะตัวอักษรไทย อังกฤษ ตัวเลข และช่องว่าง' };
  if (RESERVED.includes(name.toLowerCase())) return { err: 'ชื่อนี้ถูกสงวนไว้' };
  if (isProfane(name)) return { err: 'ชื่อนี้ไม่เหมาะสม กรุณาเลือกชื่ออื่น' };
  const key = name.toLowerCase().replace(/\s+/g, '');
  return { name, key };
}

// ต้องล็อกอินเท่านั้น: ตรวจ + จองชื่อ (ครั้งแรกครั้งเดียว แล้วล็อกถาวร)
exports.claimName = onCall({ region: 'asia-southeast1' }, async (request) => {
  const data = request.data;
  const auth = request.auth;

  if (!auth) throw new HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบก่อน');

  const db = admin.firestore();
  const uid = auth.uid;
  const userRef = db.collection('users').doc(uid);

  // เคยตั้งชื่อแล้ว -> ส่งชื่อเดิมกลับ ไม่สนชื่อที่ส่งมา (เปลี่ยนไม่ได้)
  const existing = await userRef.get();
  if (existing.exists && existing.data().nameKey) {
    return { ok: true, name: existing.data().name, reserved: true, locked: true };
  }

  const v = validate(data && data.name);
  if (v.err) throw new HttpsError('invalid-argument', v.err);

  const ref = db.collection('names').doc(v.key);
  let result;
  await db.runTransaction(async (t) => {
    const u = await t.get(userRef);
    // กันกรณีสองคำขอชนกัน: ถ้ามีชื่อแล้ว ใช้ชื่อเดิม
    if (u.exists && u.data().nameKey) {
      result = { ok: true, name: u.data().name, reserved: true, locked: true };
      return;
    }
    const snap = await t.get(ref);
    if (snap.exists && snap.data().uid !== uid) {
      throw new HttpsError('already-exists', 'ชื่อนี้มีคนใช้แล้ว');
    }
    t.set(ref, { uid, name: v.name });
    t.set(userRef, { name: v.name, nameKey: v.key }, { merge: true });
    result = { ok: true, name: v.name, reserved: true, locked: false };
  });
  return result;
});
