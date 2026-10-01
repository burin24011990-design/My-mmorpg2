// ===== ข้อมูลกลางของระบบสกิล =====
// สกิล / โจมตีปกติ / อัลติ ของแต่ละอาชีพอยู่ในโฟลเดอร์ js/classes/ (sword, mage, archer, priest, rogue)
const WEAPON_CLASS_LABEL = { sword: 'ดาบ', mage: 'คทา', archer: 'ธนู' };

// ---- ตั้งค่าระบบเลเวลสกิล (ปรับได้ตรงนี้) ----
const SKILL_MAX_LV = 15;          // เลเวลสูงสุดของสกิล
const SKILL_DROP_CHANCE = 0.05;   // (ไม่ได้ใช้แล้ว ดูโอกาสดรอปจริงที่ต้นไฟล์ monsters.js)
// หนังสือที่ใช้อัปจาก lv -> lv+1 : 1, 2, 4, 8, ... (x2 ทุกเลเวล)
function booksNeeded(lv) { return Math.pow(2, lv - 1); }
// ตัวคูณดาเมจตามเลเวลสกิล (Lv.1 = x1.0, Lv.15 = x2.4)
function skillLvMul(lv) { return 1 + ((lv || 1) - 1) * 0.1; }

// เติมโดยไฟล์ในโฟลเดอร์ js/classes/
const BASIC_ATTACKS = {};
const SKILL_DEFS = {};
const ULTI_DEFS = {};

function skillIconKey(type) { return type === 'melee' ? 'ic_melee' : type === 'aoe' ? 'ic_aoe' : type === 'dash' ? 'ic_dash' : 'ic_proj'; }
