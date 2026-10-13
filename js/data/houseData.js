// ===== ข้อมูลระบบบ้าน: วัตถุดิบ ปลา พืช สูตรอาหาร =====
// ไฟล์: js/data/houseData.js (โหลดหลัง items.js)
// ไอเทมวัตถุดิบทั้งหมดเก็บในกระเป๋าเป็น { kind:'material', mid:'<id>', count:N } (ซ้อนได้)
// id ที่ใช้ในตารางดรอปของมอน / สูตรอาหาร / ตารางปลา ต้องเป็น id เดียวกับ MAT_DEFS นี้

const MAX_MAT_STACK = 999;

// cat: bait เหยื่อ | fish ปลา | seed เมล็ด | veg ผัก | mat ชิ้นส่วนมอน | food อาหาร
const MAT_DEFS = {
  // เหยื่อ
  bait_basic:   { name: 'เหยื่อธรรมดา',   icon: '🪱', cat: 'bait', color: 0xa67c52 },
  // ปลา
  fish_minnow:  { name: 'ปลาซิว',         icon: '🐟', cat: 'fish', color: 0xcfd8dc },
  fish_carp:    { name: 'ปลาคาร์ป',       icon: '🐠', cat: 'fish', color: 0x4aa3ff },
  fish_catfish: { name: 'ปลาดุก',         icon: '🐡', cat: 'fish', color: 0x4aa3ff },
  fish_koi:     { name: 'ปลาโคอิ',        icon: '🎏', cat: 'fish', color: 0xe0413a },
  fish_golden:  { name: 'ปลาทองคำ',       icon: '✨', cat: 'fish', color: 0xffc83d },
  // เมล็ด + ผัก (ใช้ในขั้นปลูกผัก)
  seed_cabbage: { name: 'เมล็ดกะหล่ำ',    icon: '🌱', cat: 'seed', color: 0x6bd66b },
  veg_cabbage:  { name: 'กะหล่ำปลี',      icon: '🥬', cat: 'veg',  color: 0x6bd66b },
  seed_carrot:  { name: 'เมล็ดแครอท',     icon: '🌱', cat: 'seed', color: 0xff9a3c },
  veg_carrot:   { name: 'แครอท',          icon: '🥕', cat: 'veg',  color: 0xff9a3c },
  // ชิ้นส่วนมอน (ใช้ในตารางดรอปของ monsterDefs ภายหลัง)
  meat_raw:     { name: 'เนื้อดิบ',        icon: '🥩', cat: 'mat',  color: 0xd9544d },
  herb:         { name: 'สมุนไพร',        icon: '🌿', cat: 'mat',  color: 0x3fbf6f },
  monster_egg:  { name: 'ไข่มอนสเตอร์',   icon: '🥚', cat: 'mat',  color: 0xf0e6c8 },
  // อาหาร (heal = ฟื้น HP, buff ไว้ต่อยอด)
  food_grilled_fish: { name: 'ปลาย่าง',     icon: '🍢', cat: 'food', color: 0xffb070, heal: 120 },
  food_veg_soup:     { name: 'ซุปผัก',      icon: '🍲', cat: 'food', color: 0x9acd32, heal: 200 },
  food_fish_stew:    { name: 'ต้มปลารวมผัก', icon: '🍜', cat: 'food', color: 0xffd23d, heal: 450 },
};

// ===== ตกปลา =====
// w = น้ำหนักโอกาส | rare = ได้โบนัสเมื่อใช้เหยื่อ
const FISH_TABLE = [
  { id: 'fish_minnow',  w: 55 },
  { id: 'fish_carp',    w: 25 },
  { id: 'fish_catfish', w: 12, rare: true },
  { id: 'fish_koi',     w: 7,  rare: true },
  { id: 'fish_golden',  w: 1,  rare: true },
];
const FISH_CFG = {
  waitMin: 2000, waitMax: 5000,   // รอปลากิน (ms)
  zoneW: 0.26,                    // ความกว้างโซนเขียว (0-1) กว้าง = ง่าย
  speed: 1.3,                     // ความเร็วตัวชี้ (รอบ/วินาที)
  biteLimitMs: 5000,              // เวลาให้แตะหลังปลากิน
  baitRareMul: 2.5,               // เหยื่อคูณโอกาสปลาหายาก
  perfectDouble: true,            // แตะตรงกลางโซน = ได้ปลา 2 ตัว
  giftBait: 5,                    // แจกเหยื่อครั้งแรกที่เข้าบ้าน (จนกว่ามอนจะดรอป)
};

// ===== ปลูกผัก (ใช้ในขั้นถัดไป) growMs = เวลาโต (เวลาจริง) =====
const CROPS = {
  seed_cabbage: { veg: 'veg_cabbage', growMs: 10 * 60 * 1000, yieldMin: 2, yieldMax: 3 },
  seed_carrot:  { veg: 'veg_carrot',  growMs: 20 * 60 * 1000, yieldMin: 2, yieldMax: 4 },
};
const PLOT_COUNT = 4;

// ===== สูตรอาหาร (ใช้ในขั้นถัดไป) =====
const RECIPES = [
  { out: 'food_grilled_fish', need: { fish_minnow: 2 } },
  { out: 'food_veg_soup',     need: { veg_cabbage: 2, veg_carrot: 1 } },
  { out: 'food_fish_stew',    need: { veg_cabbage: 2, fish_carp: 1 } },
];
