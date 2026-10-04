// ===== ข้อมูลและฟังก์ชันของไอเทม / อุปกรณ์ =====
const SLOT_LABELS = { weapon: 'อาวุธ', helmet: 'หมวก', armor: 'เกราะ', gloves: 'ถุงมือ', shoes: 'รองเท้า', ring: 'แหวน', necklace: 'สร้อยคอ' };
const EQUIP_SLOT_KEYS = ['weapon', 'helmet', 'armor', 'gloves', 'shoes', 'ring1', 'ring2', 'necklace'];
const STAT_GROWTH = {
  weapon: { atk: 4 }, helmet: { hp: 8 }, armor: { hp: 10, def: 1 }, gloves: { atk: 2 },
  shoes: { hp: 4, atk: 1 }, ring: { atk: 3 }, necklace: { mp: 6, hp: 4 },
};

// ---- ชุดเกราะอ่อน (variant: 'light') ใช้กับ หมวก/เกราะ/ถุงมือ/รองเท้า ----
const LIGHT_LABELS = { helmet: 'หมวกผ้า', armor: 'ชุดเกราะอ่อน', gloves: 'ถุงมือผ้า', shoes: 'รองเท้าผ้า' };
const LIGHT_SLOTS = ['helmet', 'armor', 'gloves', 'shoes'];
const LIGHT_DROP_CHANCE = 0.4;      // โอกาสที่ชิ้นเกราะจากกล่องจะเป็นแบบอ่อน

// ---- อาวุธที่เปิดกล่องได้ ----
const DROP_WEAPON_CLASSES = ['sword', 'mage', 'archer', 'priest', 'rogue'];
const EXTRA_WEAPON_LABELS = { priest: 'ไม้เท้าพระ', rogue: 'กริช' };

// ---- หินตีบวก ----
const MAX_STONE_STACK = 9999;

// ---- สีของอุปกรณ์/กล่อง 4 ระดับ (mult = ตัวคูณสเตตัสของอุปกรณ์สีนั้น) ----
const TIER_ORDER = ['white', 'blue', 'red', 'gold'];
const TIER_DEFS = {
  white: { name: 'ขาว', color: 0xeeeeee, mult: 1 },
  blue:  { name: 'ฟ้า', color: 0x4aa3ff, mult: 1.25 },
  red:   { name: 'แดง', color: 0xe0413a, mult: 1.6 },
  gold:  { name: 'ทอง', color: 0xffc83d, mult: 2.2 },
};
function tierOf(item) { return item && TIER_DEFS[item.tier] ? item.tier : 'white'; }
function tierMultOf(item) { return TIER_DEFS[tierOf(item)].mult; }

// ---- หินสุ่มออฟชั่น 4 สี (pool = ออฟที่สีนั้นสุ่มได้) ----
const OPT_COLOR_KEYS = ['red', 'green', 'purple', 'yellow'];
const OPT_COLORS = {
  red:    { name: 'แดง',    color: 0xe0413a, pool: ['patk', 'ap', 'lifesteal', 'spellvamp'] },
  green:  { name: 'เขียว',  color: 0x3fbf6f, pool: ['hp', 'dodge', 'hpregen', 'pdef', 'mdef'] },
  purple: { name: 'ม่วง',   color: 0xa25cff, pool: ['mp', 'mpregen', 'cdr', 'mspd'] },
  yellow: { name: 'เหลือง', color: 0xf2c94c, pool: ['crit', 'critdmg', 'aspd', 'ppen', 'mpen'] },
};
const OPT_STONE_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90];   // (ไม่ใช้แล้ว: หินสุ่มออฟไม่มีเลเวล)
const OPT_STONE_MAX_LV = 90;

// ---- รูปไอเทมจากไฟล์ (assets/items/*.png) ----
// ITEM_IMG_OK จะถูกเติมโดย js/systems/itemImages.js เมื่อรูปโหลดสำเร็จ
// รูปไหนยังไม่มี/โหลดไม่ขึ้น เกมจะใช้ไอคอนเดิมแทนอัตโนมัติ
const ITEM_IMG_OK = {};
function itemImgKey(name, fallback) {
  const key = 'img_' + name;
  return ITEM_IMG_OK[key] ? key : fallback;
}

function weaponClassLabel(cls) {
  if (typeof WEAPON_CLASS_LABEL !== 'undefined' && WEAPON_CLASS_LABEL[cls]) return WEAPON_CLASS_LABEL[cls];
  return EXTRA_WEAPON_LABELS[cls] || cls;
}

// สีกรอบ: อุปกรณ์/กล่อง = สีตามระดับ (ขาว/ฟ้า/แดง/ทอง) | หินสุ่มออฟ = สีของหิน
function rarityColor(item) {
  if (item.kind === 'box' || item.kind === 'equip') return TIER_DEFS[tierOf(item)].color;
  if (item.kind === 'stone') return 0x6fc3ff;
  if (item.kind === 'optstone') return (OPT_COLORS[item.color] || OPT_COLORS.red).color;
  if (item.kind === 'cleanstone') return 0xdfe6ee;
  return 0x9a9a9a;
}

function baseSlotOf(slotKey) { return slotKey.indexOf('ring') === 0 ? 'ring' : slotKey; }
function weaponIconKeyForClass(cls) {
  if (cls === 'sword' || cls === 'rogue') return 'icon_sword';
  if (cls === 'mage' || cls === 'priest') return 'icon_staff';
  return 'icon_bow';
}

function computeItemStats(item) {
  const g = STAT_GROWTH[item.baseSlot] || {};
  const mult = 1 + item.star * 0.08;
  const out = {};
  Object.keys(g).forEach(k => { out[k] = Math.round(g[k] * item.level * mult); });
  return out;
}

function itemLabel(item) {
  if (item.kind === 'box') {
    const t = tierOf(item);
    return 'กล่องอุปกรณ์' + (t !== 'white' ? ' (' + TIER_DEFS[t].name + ')' : '') + ' เลเวล ' + item.level + (item.count > 1 ? '  x' + item.count : '');
  }
  if (item.kind === 'stone') return 'หินตีบวก' + (item.count > 1 ? '  x' + item.count : '');
  if (item.kind === 'cleanstone') return 'หินลบออฟ' + (item.count > 1 ? '  x' + item.count : '');
  if (item.kind === 'optstone') {
    return 'หินสุ่มออฟ' + (OPT_COLORS[item.color] || OPT_COLORS.red).name + (item.count > 1 ? '  x' + item.count : '');
  }
  const base = item.baseSlot === 'weapon'
    ? weaponClassLabel(item.class)
    : ((item.variant === 'light' && LIGHT_LABELS[item.baseSlot]) || SLOT_LABELS[item.baseSlot]);
  return base + ' Lv.' + item.level + (item.plus > 0 ? ' +' + item.plus : '') + (item.star > 0 ? '  ' + item.star + '★' : '');
}

function iconKeyForItem(item) {
  if (item.kind === 'box') return itemImgKey('box', 'box');
  if (item.kind === 'stone') return itemImgKey('stone', 'icon_stone');
  if (item.kind === 'optstone') {
    const c = item.color || 'red';
    return itemImgKey('opt_' + c, 'icon_opt_' + c);
  }
  if (item.kind === 'cleanstone') return itemImgKey('cleanstone', 'icon_cleanstone');
  if (item.baseSlot === 'weapon') return itemImgKey('weapon_' + item.class, weaponIconKeyForClass(item.class));

  const old = { helmet: 'icon_helmet', armor: 'icon_armor', gloves: 'icon_gloves', shoes: 'icon_shoes', ring: 'icon_ring', necklace: 'icon_necklace' }[item.baseSlot];
  const normal = itemImgKey(item.baseSlot, old);
  if (item.variant === 'light') return itemImgKey(item.baseSlot + '_light', normal);
  return normal;
}

// tier = สีของอุปกรณ์ที่สุ่มได้ (มาจากสีของกล่อง) ไม่ใส่ = ขาว
function randomEquipItem(level, tier) {
  const slots = ['weapon', 'helmet', 'armor', 'gloves', 'shoes', 'ring', 'necklace'];
  const baseSlot = Phaser.Utils.Array.GetRandom(slots);
  const item = { kind: 'equip', baseSlot, level, star: 0, plus: 0, tier: TIER_DEFS[tier] ? tier : 'white' };
  if (baseSlot === 'weapon') item.class = Phaser.Utils.Array.GetRandom(DROP_WEAPON_CLASSES);
  else if (LIGHT_SLOTS.indexOf(baseSlot) !== -1 && Math.random() < LIGHT_DROP_CHANCE) item.variant = 'light';
  return item;
}

// รวมดาวได้เฉพาะของเหมือนกัน สีเดียวกัน และ "ยังไม่ตีบวก/ไม่มีออฟชั่น" (กันของที่ลงทุนไปหายตอนรวม ให้ย่อยแทน)
function itemsMatch(a, b) {
  if (!a || !b || a.kind !== 'equip' || b.kind !== 'equip') return false;
  if (a.baseSlot !== b.baseSlot || a.level !== b.level || a.star !== b.star) return false;
  if ((a.plus || 0) > 0 || (b.plus || 0) > 0) return false;
  if ((a.opts && a.opts.length) || (b.opts && b.opts.length)) return false;
  if (tierOf(a) !== tierOf(b)) return false;
  if ((a.variant || '') !== (b.variant || '')) return false;
  if (a.baseSlot === 'weapon' && a.class !== b.class) return false;
  return true;
}
