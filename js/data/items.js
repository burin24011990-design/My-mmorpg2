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

function weaponClassLabel(cls) {
  if (typeof WEAPON_CLASS_LABEL !== 'undefined' && WEAPON_CLASS_LABEL[cls]) return WEAPON_CLASS_LABEL[cls];
  return EXTRA_WEAPON_LABELS[cls] || cls;
}

function rarityColor(item) {
  if (item.kind === 'box') return 0xd9a13d;
  if (item.kind === 'stone') return 0x6fc3ff;
  const st = item.star;
  if (st >= 60) return 0xffb84d;
  if (st >= 30) return 0xb35ae0;
  if (st >= 10) return 0x5a9cf0;
  if (st >= 1) return 0x6bd66b;
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
  if (item.kind === 'box') return 'กล่องอุปกรณ์ เลเวล ' + item.level + (item.count > 1 ? '  x' + item.count : '');
  if (item.kind === 'stone') return 'หินตีบวก' + (item.count > 1 ? '  x' + item.count : '');
  const base = item.baseSlot === 'weapon'
    ? weaponClassLabel(item.class)
    : ((item.variant === 'light' && LIGHT_LABELS[item.baseSlot]) || SLOT_LABELS[item.baseSlot]);
  return base + ' Lv.' + item.level + (item.plus > 0 ? ' +' + item.plus : '') + (item.star > 0 ? '  ' + item.star + '★' : '');
}

function iconKeyForItem(item) {
  if (item.kind === 'box') return 'box';
  if (item.kind === 'stone') return 'icon_stone';
  if (item.baseSlot === 'weapon') return weaponIconKeyForClass(item.class);
  return { helmet: 'icon_helmet', armor: 'icon_armor', gloves: 'icon_gloves', shoes: 'icon_shoes', ring: 'icon_ring', necklace: 'icon_necklace' }[item.baseSlot];
}

function randomEquipItem(level) {
  const slots = ['weapon', 'helmet', 'armor', 'gloves', 'shoes', 'ring', 'necklace'];
  const baseSlot = Phaser.Utils.Array.GetRandom(slots);
  const item = { kind: 'equip', baseSlot, level, star: 0, plus: 0 };
  if (baseSlot === 'weapon') item.class = Phaser.Utils.Array.GetRandom(DROP_WEAPON_CLASSES);
  else if (LIGHT_SLOTS.indexOf(baseSlot) !== -1 && Math.random() < LIGHT_DROP_CHANCE) item.variant = 'light';
  return item;
}

// รวมดาวได้เฉพาะของเหมือนกันและ "ยังไม่ตีบวก" (กันของบวกหายตอนรวม ให้ย่อยแทน)
function itemsMatch(a, b) {
  if (!a || !b || a.kind !== 'equip' || b.kind !== 'equip') return false;
  if (a.baseSlot !== b.baseSlot || a.level !== b.level || a.star !== b.star) return false;
  if ((a.plus || 0) > 0 || (b.plus || 0) > 0) return false;
  if ((a.variant || '') !== (b.variant || '')) return false;
  if (a.baseSlot === 'weapon' && a.class !== b.class) return false;
  return true;
}

// ===== สวมใส่ / ถอดอุปกรณ์ =====
Object.assign(Main.prototype, {
  equipItem(slotKey, item) {
    const old = this.equipment[slotKey];
    this.equipment[slotKey] = item;
    if (old) this.addItemToBag(old);
    this.computeAtk();
  },

  unequipSlot(slotKey) {
    const it = this.equipment[slotKey];
    if (!it) return;
    this.addItemToBag(it);
    this.equipment[slotKey] = null;
    this.computeAtk();
  },
});
