// ===== ชุดอุปกรณ์ตามระดับดาว + ชื่อความหายาก + ขายของ + แก้บั๊กถอดของตอนกระเป๋าเต็ม =====
// โหลดหลัง stats.js และก่อน main.js
(function () {
  const P = Main.prototype;

  // ---------- ความหายาก (อิงจากดาวเดิม ตรงกับสีใน rarityColor) ----------
  window.rarityName = function (item) {
    if (!item || item.kind !== 'equip') return '';
    const s = item.star || 0;
    if (s >= 60) return 'ตำนาน';
    if (s >= 30) return 'มหากาพย์';
    if (s >= 10) return 'หายาก';
    if (s >= 1) return 'ดี';
    return 'ธรรมดา';
  };

  // ---------- โบนัสชุด: สวมของดาว >= star ครบ 3 / 6 ชิ้น (ช่องสวมมี 8 ช่อง) ----------
  // ปรับตัวเลขได้ที่นี่ที่เดียว | ชื่อสเตตัสต้องตรงกับ STAT_DEFS ใน stats.js
  const TIERS = [
    { name: 'หายาก',    star: 10, bonus: { 3: { hp: 60,  pdef: 6,  mdef: 6 },
                                          6: { patk: 20, ap: 20, crit: 5 } } },
    { name: 'มหากาพย์', star: 30, bonus: { 3: { hp: 150, patk: 25, ap: 25 },
                                          6: { crit: 10, critdmg: 30, cdr: 5 } } },
    { name: 'ตำนาน',    star: 60, bonus: { 3: { hp: 300, patk: 60, ap: 60, aspd: 8 },
                                          6: { crit: 15, critdmg: 50, cdr: 10, lifesteal: 5, spellvamp: 5 } } },
  ];

  // คืนรายการโบนัสที่ติดอยู่ [{ tier, pieces, count, mods }]
  P.getSetBonuses = function () {
    const eq = this.equipment || {}, res = [];
    TIERS.forEach(t => {
      let n = 0;
      EQUIP_SLOT_KEYS.forEach(k => { if (eq[k] && (eq[k].star || 0) >= t.star) n++; });
      [3, 6].forEach(p => { if (n >= p) res.push({ tier: t.name, pieces: p, count: n, mods: t.bonus[p] }); });
    });
    return res;
  };

  // ข้อความสรุปสำหรับโชว์ใน UI เช่น "หายาก 3 ชิ้น: HP +60 ..."
  window.setBonusLines = function (scene) {
    return scene.getSetBonuses().map(b =>
      b.tier + ' (' + b.pieces + ' ชิ้น): ' +
      Object.keys(b.mods).map(k => window.statLine(k, b.mods[k])).join('  '));
  };

  // ต่อท้ายการคำนวณสเตตัสรวม
  const _recalc = P.recalcStats;
  P.recalcStats = function () {
    const out = _recalc.call(this);
    this.getSetBonuses().forEach(b => {
      Object.keys(b.mods).forEach(k => { out[k] = (out[k] || 0) + b.mods[k]; });
    });
    Object.keys(out).forEach(k => {
      const d = window.STAT_DEFS[k];
      if (d && d.cap != null && out[k] > d.cap) out[k] = d.cap;
    });
    const st = this.stats || {};
    this.equipHpBonus = out.hp - (st.maxHp || 0);
    this.equipMpBonus = out.mp - (st.maxMp || 0);
    return out;
  };

  // ---------- แก้บั๊ก: ถอดของตอนกระเป๋าเต็ม ของเดิมจะหายแลกเป็น 8 ทอง ----------
  P.unequipSlot = function (slotKey) {
    const it = this.equipment[slotKey];
    if (!it) return;
    if (this.findEmptyBagSlot() === -1) { this.toastMsg('กระเป๋าเต็ม ถอดไม่ได้'); return; }
    this.equipment[slotKey] = null;
    this.addItemToBag(it);
    this.computeAtk();
  };

  // ---------- ขายไอเทม ----------
  window.itemSellPrice = function (item) {
    if (!item || item.kind !== 'equip') return 0;
    return Math.round(item.level * 4 * (1 + (item.star || 0) * 0.5));
  };

  P.sellBagItem = function (idx) {
    const it = this.bag[idx];
    if (!it || it.kind !== 'equip') return false;
    const g = window.itemSellPrice(it);
    this.bag[idx] = null;
    this.stats.gold += g;
    this.toastMsg('ขาย ' + itemLabel(it) + ' ได้ +' + g + ' ทอง');
    return true;
  };

  // ขายของดาว <= maxStar ทั้งหมด (ค่าเริ่มต้น 0 = ของที่ยังไม่รวมดาว) คืนค่าทองรวม
  P.sellJunk = function (maxStar) {
    maxStar = maxStar || 0;
    let total = 0, n = 0;
    this.bag.forEach((it, i) => {
      if (it && it.kind === 'equip' && (it.star || 0) <= maxStar) {
        total += window.itemSellPrice(it); this.bag[i] = null; n++;
      }
    });
    this.stats.gold += total;
    this.toastMsg(n ? 'ขาย ' + n + ' ชิ้น ได้ +' + total + ' ทอง' : 'ไม่มีของให้ขาย');
    return total;
  };
})();
