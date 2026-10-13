// ===== ข้อมูลระบบบ้าน v2: วัตถุดิบ / ปลา / พืช / สมุดอาหาร 100 เมนู / ดรอปมอน =====
// ไฟล์: js/data/houseData.js (โหลดหลัง items.js)
// วัตถุดิบเก็บในกระเป๋าเป็น { kind:'material', mid:'<id>', count:N } ซ้อนได้ (id ต้องตรงกับ MAT_DEFS ด้านล่าง)
// ปรับสมดุลได้ที่ค่าคงที่ "ปรับตรงนี้" ด้านล่าง

// ===== ปรับตรงนี้ =====
const MAX_MAT_STACK = 999;     // วัตถุดิบซ้อนได้สูงสุดต่อช่อง
const COOK_MAX_BOOKS = 99;     // ทำได้สูงสุดกี่เล่มต่อเมนู
const COOK_STEP_PCT = 20;      // เล่มถัดไปใช้วัตถุดิบเพิ่ม 20% ของราคาตั้งต้น (บวกเพิ่มทีละเท่ากัน ไม่ทบต้น)
const COOK_BONUS_MUL = 1;      // ตัวคูณโบนัสสถานะอาหารทั้งหมด (แรงไป = 0.5 / เบาไป = 2)
const PLOT_COUNT = 6;          // จำนวนแปลงผัก
const SEED_RETURN_CHANCE = 0.25; // เก็บเกี่ยวแล้วมีโอกาสได้เมล็ดคืน 1 เม็ด
const MAT_DROP_MUL = 1;        // ตัวคูณโอกาสดรอปวัตถุดิบจากมอนทั้งหมด

const MAT_DEFS = {};
const CROPS = {};
const FISH_TABLE = [];
const FISH_CFG = {
  waitMin: 2000, waitMax: 5000,   // รอปลากิน (ms)
  zoneW: 0.26,                    // ความกว้างโซนเขียว (0-1) กว้าง = ง่าย
  speed: 1.3,                     // ความเร็วตัวชี้ (รอบ/วินาที)
  biteLimitMs: 5000,              // เวลาให้แตะหลังปลากิน
  baitRareMul: 2.5,               // เหยื่อคูณโอกาสปลาหายาก
  perfectDouble: true,            // แตะตรงกลางโซน = ได้ปลา 2 ตัว
  giftBait: 5,
};

(function () {
  const add = function (id, name, icon, cat, color, extra) {
    MAT_DEFS[id] = Object.assign({ name: name, icon: icon, cat: cat, color: color }, extra || {});
  };

  // ---- น้ำ / เหยื่อ ----
  add('water', 'น้ำสะอาด', '💧', 'water', 0x4aa3ff);
  add('bait_basic', 'เหยื่อธรรมดา', '🪱', 'bait', 0xa67c52, { price: 20 });

  // ---- เครื่องปรุง (ซื้อด้วยทอง) ----
  [
    ['sp_salt', 'เกลือ', '🧂', 30],
    ['sp_sugar', 'น้ำตาล', '🍬', 40],
    ['sp_sauce', 'ซอสปรุงรส', '🍶', 60],
    ['sp_spice', 'เครื่องเทศ', '🌰', 80],
    ['sp_oil', 'น้ำมันพืช', '🧴', 60],
  ].forEach(function (r) { add(r[0], r[1], r[2], 'spice', 0xe8dcc0, { price: r[3] }); });

  // ---- ปลา: [id, ชื่อ, ไอคอน, สี, น้ำหนักโอกาส, หายาก] ----
  [
    ['fish_minnow',  'ปลาซิว',    '🐟', 0xcfd8dc, 28,  false],
    ['fish_carp',    'ปลาคาร์ป',  '🐠', 0x4aa3ff, 20,  false],
    ['fish_catfish', 'ปลาดุก',    '🐡', 0x4aa3ff, 14,  false],
    ['fish_eel',     'ปลาไหล',    '🐍', 0x4aa3ff, 10,  false],
    ['fish_shrimp',  'กุ้ง',       '🦐', 0xffa07a, 10,  false],
    ['fish_crab',    'ปู',         '🦀', 0xe0413a, 8,   false],
    ['fish_squid',   'หมึก',       '🦑', 0xa25cff, 4,   true],
    ['fish_koi',     'ปลาโคอิ',   '🎏', 0xe0413a, 3,   true],
    ['fish_golden',  'ปลาทองคำ',  '✨', 0xffc83d, 0.6, true],
    ['fish_lobster', 'กุ้งมังกร', '🦞', 0xffc83d, 1.4, true],
  ].forEach(function (r) {
    add(r[0], r[1], r[2], 'fish', r[3]);
    FISH_TABLE.push({ id: r[0], w: r[4], rare: r[5] });
  });

  // ---- พืช: [key, ชื่อผัก, ไอคอนผัก, ไอคอนต้น, นาทีโต, ผลผลิตต่ำ, สูง, ราคาเมล็ด] ----
  [
    ['cabbage',  'กะหล่ำปลี', '🥬', 8,  2, 4, 40],
    ['carrot',   'แครอท',     '🥕', 10, 2, 4, 40],
    ['tomato',   'มะเขือเทศ', '🍅', 12, 2, 4, 50],
    ['corn',     'ข้าวโพด',   '🌽', 15, 3, 5, 50],
    ['potato',   'มันฝรั่ง',  '🥔', 15, 3, 5, 50],
    ['pumpkin',  'ฟักทอง',    '🎃', 20, 2, 4, 60],
    ['eggplant', 'มะเขือยาว', '🍆', 12, 2, 4, 50],
    ['onion',    'หัวหอม',    '🧅', 10, 3, 5, 40],
    ['garlic',   'กระเทียม',  '🧄', 10, 3, 5, 40],
    ['mushroom', 'เห็ด',       '🍄', 18, 3, 5, 60],
    ['chili',    'พริก',       '🌶️', 14, 3, 5, 50],
    ['rice',     'ข้าวสาร',   '🌾', 20, 4, 6, 60],
  ].forEach(function (r) {
    const seed = 'seed_' + r[0], veg = 'veg_' + r[0];
    add(seed, 'เมล็ด' + r[1], '🌱', 'seed', 0x6bd66b, { price: r[6] });
    add(veg, r[1], r[2], 'veg', 0x6bd66b);
    CROPS[seed] = { veg: veg, growMs: r[3] * 60 * 1000, yieldMin: r[4], yieldMax: r[5], price: r[6] };
  });

  // ---- ชิ้นส่วนมอนสเตอร์ ----
  [
    ['meat_raw',    'เนื้อดิบ',        '🥩', 0xd9544d],
    ['bone',        'กระดูก',          '🦴', 0xe8e8d8],
    ['blood',       'เลือดมอนสเตอร์', '🩸', 0xc0301a],
    ['monster_egg', 'ไข่มอนสเตอร์',   '🥚', 0xf0e6c8],
    ['herb',        'สมุนไพร',        '🌿', 0x3fbf6f],
    ['jelly',       'เมือกสไลม์',      '🍮', 0x9acd32],
    ['fang',        'เขี้ยวมอน',       '🦷', 0xf0f0f0],
    ['hide',        'หนังมอน',         '🐾', 0xa0703a],
  ].forEach(function (r) { add(r[0], r[1], r[2], 'mat', r[3]); });
})();

// ===== ดรอปวัตถุดิบจากมอน: ตามธีมด่าน (ดัชนี 0-8 = ด่าน 1-9, ด่านจุติใช้ look ของด่านเดิม) =====
// p = โอกาสต่อการฆ่า 1 ตัว | บอส x4 + ได้หลายชิ้น | Epic x2
const DROP_THEMES = [
  [{ id: 'jelly', p: 0.10 }, { id: 'herb', p: 0.06 }, { id: 'monster_egg', p: 0.04 }],                                 // 1 สไลม์
  [{ id: 'monster_egg', p: 0.08 }, { id: 'jelly', p: 0.05 }, { id: 'herb', p: 0.06 }, { id: 'meat_raw', p: 0.04 }],  // 2 แมงมุม
  [{ id: 'meat_raw', p: 0.08 }, { id: 'jelly', p: 0.06 }, { id: 'herb', p: 0.06 }, { id: 'blood', p: 0.03 }],        // 3 หนอง
  [{ id: 'meat_raw', p: 0.08 }, { id: 'blood', p: 0.06 }, { id: 'fang', p: 0.04 }, { id: 'bone', p: 0.04 }],         // 4 ถ้ำ
  [{ id: 'meat_raw', p: 0.07 }, { id: 'bone', p: 0.06 }, { id: 'fang', p: 0.05 }, { id: 'hide', p: 0.03 }],          // 5 ทะเลทราย
  [{ id: 'bone', p: 0.07 }, { id: 'blood', p: 0.06 }, { id: 'fang', p: 0.05 }, { id: 'hide', p: 0.05 }],             // 6 ภูเขาไฟ
  [{ id: 'meat_raw', p: 0.07 }, { id: 'hide', p: 0.06 }, { id: 'herb', p: 0.05 }, { id: 'blood', p: 0.04 }],         // 7 น้ำแข็ง
  [{ id: 'bone', p: 0.12 }, { id: 'blood', p: 0.06 }, { id: 'fang', p: 0.05 }, { id: 'herb', p: 0.04 }],             // 8 สุสาน
  [{ id: 'blood', p: 0.10 }, { id: 'fang', p: 0.07 }, { id: 'hide', p: 0.06 }, { id: 'bone', p: 0.06 }],             // 9 ปราสาท
];
const BAIT_DROP_CHANCE = 0.06;   // มอนทุกตัวมีโอกาสดรอปเหยื่อ

// ===== ดรอปเมล็ดผักจากมอน (มีระดับความหายาก) =====
// chance = โอกาสต่อการฆ่า 1 ตัวที่จะมีเมล็ดดรอป (บอส x4, Epic x2) จากนั้นสุ่มระดับ แล้วสุ่มชนิดเมล็ดในระดับนั้น
// w = น้ำหนักระดับที่ด่านแรก | shift = น้ำหนักที่เปลี่ยนต่อด่าน (ด่านสูงเจอของหายากง่ายขึ้น) | บอสได้น้ำหนักระดับ "หายาก" x bossRareMul
const SEED_DROP = {
  chance: 0.01,   // 1% = ตีเฉลี่ย 100 ตัวได้เมล็ด 1 เม็ด
  bossRareMul: 3,
  tiers: [
    { key: 'common',   name: 'ธรรมดา', color: 0x6bd66b, w: 70, shift: -3,  seeds: ['cabbage', 'carrot', 'potato', 'onion', 'garlic'] },
    { key: 'uncommon', name: 'พบน้อย', color: 0x4aa3ff, w: 25, shift: 1.5, seeds: ['tomato', 'corn', 'eggplant', 'chili'] },
    { key: 'rare',     name: 'หายาก',  color: 0xa25cff, w: 5,  shift: 1.5, seeds: ['pumpkin', 'mushroom', 'rice'] },
  ],
};
SEED_DROP.tiers.forEach(function (t) {   // สีกรอบเมล็ดในกระเป๋าตามความหายาก
  t.seeds.forEach(function (k) { const d = MAT_DEFS['seed_' + k]; if (d) { d.color = t.color; d.rarity = t.name; } });
});

// ===== สมุดอาหาร 100 เมนู =====
// ทำสำเร็จ 1 ครั้ง = ได้ 1 เล่ม (สถานะถาวรบวกทันที) | เล่มถัดไปใช้วัตถุดิบเพิ่ม COOK_STEP_PCT% | สูงสุด COOK_MAX_BOOKS เล่ม
// โบนัสต่อเล่ม = STAT_PER_BOOK x ตัวคูณระดับเมนู (สถานะรองได้ครึ่งหนึ่ง) | ระดับ 1-5 ยิ่งสูงยิ่งแรงและใช้ของหายาก
const STAT_PER_BOOK = {
  patk: 1, ap: 1, hp: 10, mp: 8, pdef: 0.5, mdef: 0.5,
  crit: 0.1, critdmg: 0.2, aspd: 0.1, cdr: 0.05, mspd: 0.05, dodge: 0.05,
  hpregen: 0.3, mpregen: 0.1, ppen: 0.05, mpen: 0.05, lifesteal: 0.03, spellvamp: 0.03,
};
const COOK_TIER = {
  mul:    [0, 1, 1.5, 2, 3, 4],                       // ตัวคูณโบนัสตามระดับ
  mains:  [[], [10, 6], [12, 8, 4], [14, 10, 6], [18, 12, 8], [24, 16, 10, 4]],   // จำนวนวัตถุดิบหลัก (ตัวที่ 1, 2, 3, 4)
  water:  [0, 10, 12, 15, 20, 25],
  season: [0, 2, 3, 4, 6, 8],
};
const COOK_RECIPES = [];
const COOK_BY_ID = {};

(function () {
  const AL = {
    mi: 'fish_minnow', ca: 'fish_carp', cf: 'fish_catfish', ee: 'fish_eel', sh: 'fish_shrimp',
    cr: 'fish_crab', sq: 'fish_squid', ko: 'fish_koi', go: 'fish_golden', lo: 'fish_lobster',
    cab: 'veg_cabbage', car: 'veg_carrot', tom: 'veg_tomato', cor: 'veg_corn', pot: 'veg_potato',
    pum: 'veg_pumpkin', epl: 'veg_eggplant', oni: 'veg_onion', gar: 'veg_garlic', mus: 'veg_mushroom',
    chi: 'veg_chili', ric: 'veg_rice',
    meat: 'meat_raw', bone: 'bone', blood: 'blood', egg: 'monster_egg', herb: 'herb', jel: 'jelly', fang: 'fang', hide: 'hide',
    salt: 'sp_salt', sug: 'sp_sugar', sau: 'sp_sauce', spi: 'sp_spice', oil: 'sp_oil',
  };
  // [ชื่อ, ไอคอน, ระดับ, สถานะหลัก, สถานะรอง, [วัตถุดิบหลัก], เครื่องปรุง]
  const ROWS = [
    // ---- ระดับ 1 (ทำง่าย) ----
    ['ต้มปลาซิว', '🍲', 1, 'patk', '', ['mi'], 'salt'],
    ['ปลาคาร์ปทอด', '🍤', 1, 'hp', '', ['ca'], 'oil'],
    ['สลัดกะหล่ำ', '🥗', 1, 'mdef', '', ['cab'], 'oil'],
    ['ซุปแครอท', '🥕', 1, 'ap', '', ['car'], 'salt'],
    ['มะเขือเทศอบ', '🍅', 1, 'mp', '', ['tom'], 'spi'],
    ['ข้าวโพดต้ม', '🌽', 1, 'hp', '', ['cor'], 'sug'],
    ['มันฝรั่งบด', '🥔', 1, 'pdef', '', ['pot'], 'salt'],
    ['ซุปฟักทอง', '🎃', 1, 'mp', '', ['pum'], 'sug'],
    ['มะเขือยาวผัด', '🍆', 1, 'pdef', '', ['epl'], 'sau'],
    ['หัวหอมทอด', '🧅', 1, 'hp', '', ['oni'], 'oil'],
    ['กระเทียมเจียว', '🧄', 1, 'patk', '', ['gar'], 'oil'],
    ['เห็ดผัดซอส', '🍄', 1, 'ap', '', ['mus'], 'sau'],
    ['ข้าวสวยร้อน', '🍚', 1, 'hp', '', ['ric'], 'salt'],
    ['ยำพริกปลา', '🌶️', 1, 'crit', '', ['chi', 'mi'], 'spi'],
    ['ไข่เจียว', '🍳', 1, 'hp', '', ['egg'], 'salt'],
    ['ซุปสมุนไพร', '🍵', 1, 'hpregen', '', ['herb'], 'salt'],
    ['เนื้อย่างเกลือ', '🥩', 1, 'patk', '', ['meat'], 'salt'],
    ['ซุปกระดูก', '🍖', 1, 'pdef', '', ['bone'], 'salt'],
    ['ซุปเลือดอุ่น', '🩸', 1, 'hpregen', '', ['blood'], 'spi'],
    ['เยลลี่เมือกสไลม์', '🍮', 1, 'mp', '', ['jel'], 'sug'],
    // ---- ระดับ 2 ----
    ['ปลาย่างสมุนไพร', '🍢', 2, 'patk', '', ['ca', 'herb'], 'salt'],
    ['แกงส้มปลาดุก', '🥘', 2, 'hp', '', ['cf', 'chi'], 'spi'],
    ['ต้มยำกุ้ง', '🍲', 2, 'ap', '', ['sh', 'mus'], 'spi'],
    ['ปูผัดผงกะหรี่', '🦀', 2, 'crit', '', ['cr', 'oni'], 'spi'],
    ['หมึกย่างซีอิ๊ว', '🦑', 2, 'aspd', '', ['sq', 'gar'], 'sau'],
    ['ปลาไหลย่าง', '🍣', 2, 'hpregen', '', ['ee'], 'sau'],
    ['สตูว์เนื้อมันฝรั่ง', '🍲', 2, 'hp', '', ['meat', 'pot'], 'salt'],
    ['ซุปกระดูกแครอท', '🍜', 2, 'pdef', '', ['bone', 'car'], 'salt'],
    ['ข้าวผัดไข่', '🍛', 2, 'mp', '', ['ric', 'egg'], 'oil'],
    ['ข้าวหน้าเนื้อ', '🍱', 2, 'patk', '', ['ric', 'meat'], 'sau'],
    ['ซุปฟักทองครีม', '🥣', 2, 'mdef', '', ['pum', 'egg'], 'sug'],
    ['พริกแกงเนื้อ', '🍛', 2, 'critdmg', '', ['chi', 'meat'], 'spi'],
    ['เห็ดอบกระเทียม', '🍄', 2, 'mpregen', '', ['mus', 'gar'], 'oil'],
    ['ราตาตูย', '🥘', 2, 'ap', '', ['epl', 'tom'], 'oil'],
    ['ข้าวโพดเนยอบ', '🌽', 2, 'mspd', '', ['cor', 'egg'], 'sug'],
    ['ซุปเขี้ยวมอน', '🦷', 2, 'ppen', '', ['fang', 'bone'], 'salt'],
    ['หนังกรอบทอด', '🥓', 2, 'dodge', '', ['hide', 'meat'], 'oil'],
    ['ข้าวมันฝรั่งเลือด', '🩸', 2, 'lifesteal', '', ['blood', 'pot'], 'salt'],
    ['ยำเยลลี่มะเขือเทศ', '🍧', 2, 'cdr', '', ['jel', 'tom'], 'sug'],
    ['ต้มจืดปลาซิวเห็ด', '🍲', 2, 'spellvamp', '', ['mi', 'mus'], 'salt'],
    // ---- ระดับ 3 (มีสถานะรอง) ----
    ['ปลาดุกฟูผัดเผ็ด', '🌶️', 3, 'patk', 'crit', ['cf', 'chi', 'gar'], 'spi'],
    ['กุ้งอบวุ้นเส้น', '🦐', 3, 'ap', 'mp', ['sh', 'mus', 'oni'], 'oil'],
    ['ปูนึ่งซอสเปรี้ยว', '🦀', 3, 'pdef', 'mdef', ['cr', 'tom', 'gar'], 'sau'],
    ['หมึกยัดไส้', '🦑', 3, 'hp', 'hpregen', ['sq', 'meat', 'ric'], 'sau'],
    ['ปลาไหลหน้าซอส', '🍣', 3, 'aspd', 'crit', ['ee', 'ric', 'gar'], 'sau'],
    ['สเต็กเนื้อซอสพริกไทย', '🥩', 3, 'patk', 'ppen', ['meat', 'pot', 'gar'], 'spi'],
    ['ซี่โครงอบ', '🍖', 3, 'pdef', 'hp', ['bone', 'meat', 'car'], 'sug'],
    ['ซุปเลือดสมุนไพร', '🩸', 3, 'lifesteal', 'hpregen', ['blood', 'herb', 'mus'], 'spi'],
    ['ข้าวผัดเขี้ยวป่า', '🦷', 3, 'ppen', 'patk', ['fang', 'ric', 'oni'], 'oil'],
    ['พายหนังกรอบ', '🥧', 3, 'dodge', 'mspd', ['hide', 'pot', 'egg'], 'oil'],
    ['ไข่ตุ๋นเยลลี่', '🍮', 3, 'mp', 'mpregen', ['egg', 'jel', 'mus'], 'sug'],
    ['พุดดิ้งฟักทอง', '🍮', 3, 'mdef', 'mp', ['pum', 'egg', 'jel'], 'sug'],
    ['ซุปข้าวโพดกุ้ง', '🥣', 3, 'cdr', 'ap', ['cor', 'sh', 'egg'], 'sug'],
    ['มะเขือยาวยัดปู', '🍆', 3, 'mpen', 'ap', ['epl', 'cr', 'gar'], 'sau'],
    ['ผัดเผ็ดเห็ดป่า', '🍄', 3, 'critdmg', 'crit', ['mus', 'chi', 'meat'], 'spi'],
    ['ข้าวต้มปลาสมุนไพร', '🍲', 3, 'hpregen', 'hp', ['ca', 'herb', 'ric'], 'salt'],
    ['ซุปเขี้ยวเลือด', '🧛', 3, 'spellvamp', 'ap', ['fang', 'blood', 'herb'], 'spi'],
    ['สลัดทะเล', '🥗', 3, 'mspd', 'dodge', ['sq', 'sh', 'cab'], 'oil'],
    ['หม้อไฟกระดูก', '🍲', 3, 'hp', 'pdef', ['bone', 'cab', 'car'], 'salt'],
    ['เนื้ออบสมุนไพร', '🍖', 3, 'mpregen', 'mp', ['meat', 'herb', 'oni'], 'spi'],
    // ---- ระดับ 4 (ของหายาก) ----
    ['ปลาโคอินึ่งซีอิ๊ว', '🎏', 4, 'patk', 'crit', ['ko', 'gar', 'mus'], 'sau'],
    ['กุ้งมังกรอบเนย', '🦞', 4, 'ap', 'cdr', ['lo', 'gar', 'egg'], 'oil'],
    ['ซุปปลาโคอิสมุนไพร', '🍲', 4, 'hp', 'hpregen', ['ko', 'herb', 'mus'], 'salt'],
    ['ปูผัดพริกเผา', '🦀', 4, 'critdmg', 'crit', ['cr', 'chi', 'oni'], 'spi'],
    ['หมึกย่างถ่าน', '🦑', 4, 'aspd', 'mspd', ['sq', 'gar', 'chi'], 'sau'],
    ['เบอร์เกอร์เนื้อมอน', '🍔', 4, 'patk', 'lifesteal', ['meat', 'hide', 'tom'], 'sau'],
    ['สเต็กซี่โครงเขี้ยว', '🍖', 4, 'ppen', 'patk', ['fang', 'meat', 'bone'], 'spi'],
    ['ข้าวมันหนังกรอบ', '🍚', 4, 'dodge', 'mspd', ['hide', 'ric', 'egg'], 'oil'],
    ['ซุปเลือดมังกร', '🩸', 4, 'lifesteal', 'hp', ['blood', 'fang', 'herb'], 'spi'],
    ['โจ๊กกระดูกสมุนไพร', '🥣', 4, 'pdef', 'mdef', ['bone', 'ric', 'herb'], 'salt'],
    ['เยลลี่ทองมงคล', '🍮', 4, 'mp', 'mpregen', ['jel', 'egg', 'pum'], 'sug'],
    ['ฟักทองอบน้ำตาล', '🎃', 4, 'mdef', 'mp', ['pum', 'jel', 'egg'], 'sug'],
    ['สปาเกตตีซอสมะเขือเทศ', '🍝', 4, 'cdr', 'mp', ['tom', 'meat', 'oni'], 'oil'],
    ['พิซซ่าเห็ด', '🍕', 4, 'ap', 'mpen', ['mus', 'tom', 'egg'], 'oil'],
    ['ซุปมิโสะปลาไหล', '🍜', 4, 'hpregen', 'mpregen', ['ee', 'mus', 'oni'], 'sau'],
    ['ข้าวห่อสาหร่ายกุ้ง', '🍙', 4, 'spellvamp', 'ap', ['sh', 'ric', 'sq'], 'sau'],
    ['ปลาโคอิย่างเกลือ', '🔥', 4, 'mpen', 'cdr', ['ko', 'herb', 'gar'], 'salt'],
    ['สเต็กปูยักษ์', '🦀', 4, 'pdef', 'hp', ['cr', 'pot', 'bone'], 'sau'],
    ['หม้อไฟทะเลรวม', '🍲', 4, 'hp', 'pdef', ['sh', 'sq', 'cr'], 'spi'],
    ['ต้มเลือดเนื้อรสจัด', '🍖', 4, 'crit', 'critdmg', ['blood', 'meat', 'chi'], 'spi'],
    // ---- ระดับ 5 (ตำรับเทพ) ----
    ['ปลาทองคำนึ่งซีอิ๊ว', '🐠', 5, 'patk', 'critdmg', ['go', 'ko', 'gar', 'herb'], 'sau'],
    ['กุ้งมังกรราชา', '🦞', 5, 'ap', 'cdr', ['lo', 'sh', 'egg', 'gar'], 'oil'],
    ['ซุปปลาทองมังกร', '🍲', 5, 'hp', 'hpregen', ['go', 'bone', 'herb', 'mus'], 'salt'],
    ['ซาซิมิรวมมิตร', '🍣', 5, 'crit', 'aspd', ['ko', 'sq', 'sh', 'ee'], 'sau'],
    ['เนื้อมังกรย่างเตาถ่าน', '🍖', 5, 'patk', 'ppen', ['meat', 'fang', 'hide', 'blood'], 'spi'],
    ['ซุปเลือดเทพอสูร', '🩸', 5, 'lifesteal', 'spellvamp', ['blood', 'fang', 'herb', 'jel'], 'spi'],
    ['ข้าวหน้าปลาไหลทอง', '🍱', 5, 'aspd', 'mspd', ['ee', 'go', 'ric', 'gar'], 'sau'],
    ['พายฟักทองราชา', '🥧', 5, 'mp', 'mpregen', ['pum', 'egg', 'jel', 'herb'], 'sug'],
    ['สเต็กปูยักษ์ทองคำ', '🦀', 5, 'pdef', 'mdef', ['cr', 'go', 'pot', 'bone'], 'sau'],
    ['ราเมนกระดูกเขี้ยว', '🍜', 5, 'critdmg', 'crit', ['bone', 'fang', 'egg', 'oni'], 'sau'],
    ['บุฟเฟ่ต์ทะเล', '🦐', 5, 'dodge', 'mspd', ['lo', 'sq', 'cr', 'sh'], 'oil'],
    ['หม้อไฟพันธุ์ผัก', '🥘', 5, 'mdef', 'pdef', ['cab', 'car', 'mus', 'pum'], 'spi'],
    ['ข้าวอบสมุนไพรทิพย์', '🍚', 5, 'hpregen', 'mpregen', ['ric', 'herb', 'mus', 'egg'], 'spi'],
    ['เนื้อเคี่ยวไวน์เลือด', '🍷', 5, 'spellvamp', 'lifesteal', ['meat', 'blood', 'tom', 'oni'], 'sug'],
    ['เกี๊ยวทะเลวิญญาณ', '🥟', 5, 'mpen', 'ap', ['sh', 'lo', 'gar', 'cab'], 'sau'],
    ['ข้าวเหนียวฟักทองทอง', '🍡', 5, 'cdr', 'mp', ['ric', 'jel', 'pum', 'egg'], 'sug'],
    ['สเต็กหนังมังกรกรอบ', '🥓', 5, 'ppen', 'dodge', ['hide', 'meat', 'fang', 'gar'], 'oil'],
    ['ตำรับฟื้นฟูชีวิต', '💖', 5, 'hp', 'mp', ['go', 'herb', 'blood', 'mus'], 'salt'],
    ['ตำรับสรรพกำลัง', '⚡', 5, 'patk', 'ap', ['lo', 'meat', 'fang', 'blood'], 'spi'],
    ['ตำรับเทพเจ้า', '👑', 5, 'hp', 'patk', ['go', 'lo', 'blood', 'fang'], 'sau'],
  ];

  const r3 = function (v) { return Math.round(v * 1000) / 1000; };
  ROWS.forEach(function (row, i) {
    const t = row[2];
    const need = {};
    const cnts = COOK_TIER.mains[t];
    row[5].forEach(function (a, j) { need[AL[a]] = cnts[Math.min(j, cnts.length - 1)]; });
    need.water = COOK_TIER.water[t];
    need[AL[row[6]]] = COOK_TIER.season[t];
    const bonus = {};
    bonus[row[3]] = r3(STAT_PER_BOOK[row[3]] * COOK_TIER.mul[t] * COOK_BONUS_MUL);
    if (row[4]) bonus[row[4]] = r3(STAT_PER_BOOK[row[4]] * COOK_TIER.mul[t] * 0.5 * COOK_BONUS_MUL);
    const r = { id: 'dish_' + String(i + 1).padStart(3, '0'), name: row[0], icon: row[1], tier: t, need: need, bonus: bonus };
    COOK_RECIPES.push(r);
    COOK_BY_ID[r.id] = r;
  });
})();
