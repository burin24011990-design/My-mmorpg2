// ===== ข้อมูลสกิล / โจมตีปกติ / อัลติ =====
const WEAPON_CLASS_LABEL = { sword: 'ดาบ', mage: 'คทา', archer: 'ธนู' };

// ---- ตั้งค่าระบบเลเวลสกิล (ปรับได้ตรงนี้) ----
const SKILL_MAX_LV = 15;          // เลเวลสูงสุดของสกิล
const SKILL_DROP_CHANCE = 0.05;   // โอกาสมินิบอสดรอปหนังสือสกิล (5%)
// หนังสือที่ใช้อัปจาก lv -> lv+1 : 1, 2, 4, 8, ... (x2 ทุกเลเวล)
function booksNeeded(lv) { return Math.pow(2, lv - 1); }
// ตัวคูณดาเมจตามเลเวลสกิล (Lv.1 = x1.0, Lv.15 = x2.4)
function skillLvMul(lv) { return 1 + ((lv || 1) - 1) * 0.1; }

const BASIC_ATTACKS = {
  sword: { name: 'โจมตี', dmg: 10, range: 60, cd: 650, type: 'melee', class: 'sword' },
  mage: { name: 'โจมตี', dmg: 8, range: 380, cd: 700, type: 'proj', class: 'mage' },
  archer: { name: 'โจมตี', dmg: 9, range: 360, cd: 650, type: 'proj', class: 'archer' },
};

const SKILL_DEFS = {
  sw_slash: { name: 'ฟันตรง', class: 'sword', dmg: 12, range: 60, cd: 650, mp: 8, type: 'melee' },
  sw_spin: { name: 'ฟันหมุน', class: 'sword', dmg: 18, range: 100, cd: 2800, mp: 16, type: 'aoe' },
  sw_dash: { name: 'พุ่งทะยาน', class: 'sword', dmg: 16, range: 150, cd: 3600, mp: 14, type: 'dash' },
  sw_cross: { name: 'ฟันไขว้', class: 'sword', dmg: 22, range: 70, cd: 2400, mp: 12, type: 'melee' },

  mg_fire: { name: 'ลูกไฟ', class: 'mage', dmg: 14, range: 420, cd: 1400, mp: 10, type: 'proj' },
  mg_ice: { name: 'ธารน้ำแข็ง', class: 'mage', dmg: 12, range: 120, cd: 2400, mp: 16, type: 'aoe' },
  mg_bolt: { name: 'สายฟ้า', class: 'mage', dmg: 20, range: 350, cd: 2800, mp: 18, type: 'proj' },
  mg_nova: { name: 'คลื่นเวท', class: 'mage', dmg: 16, range: 140, cd: 3200, mp: 16, type: 'aoe' },

  ar_shot: { name: 'ยิงธนู', class: 'archer', dmg: 11, range: 380, cd: 800, mp: 8, type: 'proj' },
  ar_rain: { name: 'ฝนลูกศร', class: 'archer', dmg: 10, range: 160, cd: 2600, mp: 16, type: 'aoe' },
  ar_pierce: { name: 'ธนูเจาะเกราะ', class: 'archer', dmg: 24, range: 420, cd: 3000, mp: 18, type: 'proj' },
  ar_multi: { name: 'ยิงกระจาย', class: 'archer', dmg: 13, range: 300, cd: 2200, mp: 14, type: 'proj' },
};

const ULTI_DEFS = {
  sword: { name: 'ดาบสังหาร', dmg: 70, range: 130, cd: ULTI_CD, mp: 50, type: 'aoe' },
  mage: { name: 'อุกกาบาต', dmg: 80, range: 170, cd: ULTI_CD, mp: 50, type: 'aoe' },
  archer: { name: 'สายฝนมรณะ', dmg: 75, range: 200, cd: ULTI_CD, mp: 50, type: 'aoe' },
};

function skillIconKey(type) { return type === 'melee' ? 'ic_melee' : type === 'aoe' ? 'ic_aoe' : type === 'dash' ? 'ic_dash' : 'ic_proj'; }
