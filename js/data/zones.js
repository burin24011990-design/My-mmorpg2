// ===== ข้อมูลด่าน (แต่ละด่านเป็นแผนที่แยกกัน) =====
// x,y = จุดเกิดของผู้เล่น (กลางแผนที่ คำนวณจาก WORLD_W / WORLD_H ใน config.js อัตโนมัติ) / count = มอนธรรมดา / rangedCount = มอนยิงไกล (สุ่มกระจายทั่วแผนที่)
// มินิบอสตั้งค่าที่ config.js (BOSS_COUNT, BOSS_MULT, BOSS_RESPAWN_*)
// bg,line = สีพื้นและสีเส้นตารางของด่านนั้น
// แผนที่ใหญ่ขึ้น 2 เท่า (กว้าง+สูง = พื้นที่ 4 เท่า) ถ้ามอนดูโหรงเกินไป เพิ่ม count / rangedCount ได้ตรงนี้
const ZONE_CX = WORLD_W / 2, ZONE_CY = WORLD_H / 2;

const ZONES = [
  { id: 1, name: 'ด่าน 1', x: ZONE_CX, y: ZONE_CY, count: 45, rangedCount: 15, reqLv: 1, minLv: 1, maxLv: 10, boxLevel: 1, bg: 0x2b3a2b, line: 0x1f2b1f },
  { id: 2, name: 'ด่าน 2', x: ZONE_CX, y: ZONE_CY, count: 45, rangedCount: 15, reqLv: 11, minLv: 11, maxLv: 20, boxLevel: 10, bg: 0x2b3a3a, line: 0x1f2b2b },
  { id: 3, name: 'ด่าน 3', x: ZONE_CX, y: ZONE_CY, count: 45, rangedCount: 15, reqLv: 21, minLv: 21, maxLv: 30, boxLevel: 20, bg: 0x3a3a2b, line: 0x2b2b1f },
  { id: 4, name: 'ด่าน 4', x: ZONE_CX, y: ZONE_CY, count: 45, rangedCount: 15, reqLv: 31, minLv: 31, maxLv: 40, boxLevel: 30, bg: 0x3a2f2b, line: 0x2b211f },
  { id: 5, name: 'ด่าน 5', x: ZONE_CX, y: ZONE_CY, count: 60, rangedCount: 20, reqLv: 41, minLv: 41, maxLv: 50, boxLevel: 40, bg: 0x2b2b3a, line: 0x1f1f2b },
  { id: 6, name: 'ด่าน 6', x: ZONE_CX, y: ZONE_CY, count: 45, rangedCount: 15, reqLv: 51, minLv: 51, maxLv: 60, boxLevel: 50, bg: 0x3a2b3a, line: 0x2b1f2b },
  { id: 7, name: 'ด่าน 7', x: ZONE_CX, y: ZONE_CY, count: 45, rangedCount: 15, reqLv: 61, minLv: 61, maxLv: 70, boxLevel: 60, bg: 0x3a2b2b, line: 0x2b1f1f },
  { id: 8, name: 'ด่าน 8', x: ZONE_CX, y: ZONE_CY, count: 45, rangedCount: 15, reqLv: 71, minLv: 71, maxLv: 80, boxLevel: 70, bg: 0x33363b, line: 0x24272b },
  { id: 9, name: 'ด่าน 9', x: ZONE_CX, y: ZONE_CY, count: 60, rangedCount: 20, reqLv: 81, minLv: 81, maxLv: 90, boxLevel: 80, bg: 0x2b2b2b, line: 0x1a1a1a },
];

// ===== ด่านจุติ (ต้องจุติถึงขั้นที่กำหนดถึงเข้าได้) =====
// เปิดที่จุติขั้น: 1 3 5 7 9 11 13 15 17 19 21 23 24
// ปรับความโหดตรงนี้ (ต่อด่าน i = ลำดับด่านจุติ เริ่มที่ 0, r = ขั้นจุติของด่านนั้น):
const REBIRTH_ZONE_STEPS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 24];
const RZ_FIRST_LV = 100;      // เลเวลมอนของด่านจุติแรก
const RZ_LV_STEP = 3;         // ด่านถัดไปเลเวลมอนเพิ่มทีละเท่านี้ (ช่วงเลเวลมอนในด่าน = +4)
// v29: ความแรงมอนด่านจุติ = RZ_POWER_FIRST + i x RZ_POWER_STEP  ->  x25, x30, x35, x40 ... (ด่านจุติสุดท้าย x85)
const RZ_POWER_FIRST = 25;    // ด่านจุติแรกแรงกว่าฐาน (เลือด/ดาเมจ) กี่เท่า
const RZ_POWER_STEP = 5;      // ด่านจุติถัดไปเพิ่มทีละกี่เท่า
const RZ_EXP_K = 1;           // EXP ที่ได้ x (r+1) x ค่านี้ (เดิม 4 | หลอด EXP ต้องใช้ x2 x (r+1) เสมอ จึงยิ่งตัวเลขน้อย เก็บเลเวลยิ่งยาก)
const RZ_GOLD_K = 2;          // ทองที่ได้ x (r+1) x ค่านี้
// กล่องที่ดรอป: จุติ 1-9 = เลเวล 80 | จุติ 11-19 = เลเวล 90 | จุติ 21 ขึ้นไป = เลเวล 100
const rzBoxLevel = r => (r >= 21 ? 100 : (r >= 11 ? 90 : 80));

REBIRTH_ZONE_STEPS.forEach(function (r, i) {
  const lv = RZ_FIRST_LV + i * RZ_LV_STEP;
  const power = RZ_POWER_FIRST + i * RZ_POWER_STEP;
  const z = {
    id: 10 + i, name: 'ด่านจุติ ' + r, x: ZONE_CX, y: ZONE_CY, count: 60, rangedCount: 20,
    minLv: lv, maxLv: lv + 4, boxLevel: rzBoxLevel(r),
    reqRebirth: r,                       // ขั้นจุติที่ต้องมี
    hpMul: power, dmgMul: power,
    expMul: RZ_EXP_K * (r + 1), goldMul: RZ_GOLD_K * (r + 1),
    look: i % 9,                         // ใช้หน้าตา/ชื่อมอนของด่านเดิมลำดับนี้ (0-8) ไม่ต้องมีรูปใหม่
    bg: ((0x20 + i * 4) << 16) | (0x16 << 8) | (0x30 + i * 2),
    line: ((0x14 + i * 3) << 16) | (0x0e << 8) | (0x20 + i * 2),
  };
  // reqLv เป็นตัวคำนวณ: จุติถึงขั้นแล้ว = 1 (เข้าได้ทันทีที่เลเวล 1) | ยังไม่ถึง = 999 (ล็อก)
  // ทำให้หน้าเลือกด่านเดิมที่เช็ก level >= reqLv ใช้ได้เลยโดยไม่ต้องแก้
  Object.defineProperty(z, 'reqLv', {
    enumerable: true,
    get: function () {
      const sc = window.__mainScene;
      return (sc && sc.stats && (sc.stats.rebirth || 0) >= r) ? 1 : 999;
    },
  });
  ZONES.push(z);
});

// ===== เมือง (ด่านสุดท้ายของรายการ: ปลอดภัย ไม่มีมอน เจอผู้เล่นคนอื่นได้ ใช้ระบบแชนแนลร่วมกับด่านอื่น) =====
// ต้องอยู่นอกวงวนด้านบน และมีแค่ครั้งเดียว | town.js หาด่านนี้จาก town:true
// x,y = จุดเกิด (town.js ตั้งตำแหน่งเกิดเองตามผังเมืองอีกที)
ZONES.push({
  id: 99, name: 'เมือง', town: true, safe: true, look: 0,
  x: ZONE_CX, y: 1535, count: 0, rangedCount: 0,
  reqLv: 1, minLv: 1, maxLv: 1, boxLevel: 1,
  bg: 0x1b241b, line: 0x1b241b,
});

// ===== ความโหดมอนเพิ่มตามด่าน (ด่าน 1-9) =====
// ด่านที่ n (n = 0 คือด่าน 1) = 1 + n x STEP
// v29: STEP = 2 -> x1, x3, x5, x7, x9, x11, x13, x15, x17 (ด่าน1 ... ด่าน9) ทั้งเลือดและดาเมจ
//   (เดิม เลือด STEP 0.2 / ดาเมจ STEP 0.25)
// ด่านจุติ/เมือง (ดัชนี 9 ขึ้นไป) ได้ x1 เพราะมี hpMul / dmgMul ของตัวเองอยู่แล้ว (ดู RZ_POWER_* ด้านบน)
// ** ค่า STEP ต้องตรงกับ STAGE_HP_STEP / STAGE_DMG_STEP ใน server.js **
const STAGE_HP_STEP = 2;       // เลือดมอนเพิ่มด่านละเท่านี้
const STAGE_DMG_STEP = 2;      // พลังโจมตีมอนเพิ่มด่านละเท่านี้
function stageHpMul(zi)  { return zi < 9 ? 1 + zi * STAGE_HP_STEP  : 1; }
function stageDmgMul(zi) { return zi < 9 ? 1 + zi * STAGE_DMG_STEP : 1; }
