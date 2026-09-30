// ===== ข้อมูลและฟังก์ชันของไอเทม / อุปกรณ์ =====
const SLOT_LABELS = { weapon: 'อาวุธ', helmet: 'หมวก', armor: 'เกราะ', gloves: 'ถุงมือ', shoes: 'รองเท้า', ring: 'แหวน', necklace: 'สร้อยคอ' };
const EQUIP_SLOT_KEYS = ['weapon', 'helmet', 'armor', 'gloves', 'shoes', 'ring1', 'ring2', 'necklace'];
const STAT_GROWTH = {
  weapon: { atk: 4 }, helmet: { hp: 8 }, armor: { hp: 10, def: 1 }, gloves: { atk: 2 },
  shoes: { hp: 4, atk: 1 }, ring: { atk: 3 }, necklace: { mp: 6, hp: 4 },
};

function rarityColor(item) {
  if (item.kind === 'box') return 0xd9a13d;
  const st = item.star;
  if (st >= 60) return 0xffb84d;
  if (st >= 30) return 0xb35ae0;
  if (st >= 10) return 0x5a9cf0;
  if (st >= 1) return 0x6bd66b;
  return 0x9a9a9a;
}

function baseSlotOf(slotKey) { return slotKey.indexOf('ring') === 0 ? 'ring' : slotKey; }
function weaponIconKeyForClass(cls) { return cls === 'sword' ? 'icon_sword' : cls === 'mage' ? 'icon_staff' : 'icon_bow'; }

function computeItemStats(item) {
  const g = STAT_GROWTH[item.baseSlot] || {};
  const mult = 1 + item.star * 0.08;
  const out = {};
  Object.keys(g).forEach(k => { out[k] = Math.round(g[k] * item.level * mult); });
  return out;
}

function itemLabel(item) {
  if (item.kind === 'box') return 'กล่องอุปกรณ์ เลเวล ' + item.level + (item.count > 1 ? '  x' + item.count : '');
  const base = item.baseSlot === 'weapon' ? WEAPON_CLASS_LABEL[item.class] : SLOT_LABELS[item.baseSlot];
  return base + ' Lv.' + item.level + (item.star > 0 ? '  ' + item.star + '★' : '');
}

function iconKeyForItem(item) {
  if (item.kind === 'box') return 'box';
  if (item.baseSlot === 'weapon') return weaponIconKeyForClass(item.class);
  return { helmet: 'icon_helmet', armor: 'icon_armor', gloves: 'icon_gloves', shoes: 'icon_shoes', ring: 'icon_ring', necklace: 'icon_necklace' }[item.baseSlot];
}

function randomEquipItem(level) {
  const slots = ['weapon', 'helmet', 'armor', 'gloves', 'shoes', 'ring', 'necklace'];
  const baseSlot = Phaser.Utils.Array.GetRandom(slots);
  const item = { kind: 'equip', baseSlot, level, star: 0 };
  if (baseSlot === 'weapon') item.class = Phaser.Utils.Array.GetRandom(['sword', 'mage', 'archer']);
  return item;
}

function itemsMatch(a, b) {
  if (!a || !b || a.kind !== 'equip' || b.kind !== 'equip') return false;
  if (a.baseSlot !== b.baseSlot || a.level !== b.level || a.star !== b.star) return false;
  if (a.baseSlot === 'weapon' && a.class !== b.class) return false;
  return true;
}
