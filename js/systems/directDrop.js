// ===== ดรอปตรงเข้ากระเป๋า: อุปกรณ์ (เลเวล 1/10/50/80/99) + หินตีบวก + เก็บของที่ตกพื้นอัตโนมัติ =====
// ไฟล์: js/systems/directDrop.js
// โหลด "หลัง" lootOptions.js / roomMonsters.js / fashionCraft.js / monsterTune.js และก่อน js/main.js
// ทำงานโดยครอบ dropLoot (ไม่แก้ monsters.js) จึงใช้ได้ทั้งมอนในเครื่องและโหมดห้องออนไลน์
(function () {
  const P = Main.prototype;

  // ===== ปรับตรงนี้ =====
  const CFG = {
    // เลเวลอุปกรณ์ที่ดรอปได้ + เงื่อนไข (เลเวลมอนขั้นต่ำ) | เวล 99 ใช้เงื่อนไขด่านจุติแทน
    levels: [1, 10, 50, 80, 99],
    minMonsterLv: { 1: 0, 10: 10, 50: 50, 80: 80 },
    rebirthFor99: 9,                     // ด่านจุติที่เริ่มดรอปเวล 99

    // โอกาสดรอปอุปกรณ์ "ธรรมดา" (ขาว/ฟ้า) ต่อการฆ่า 1 ครั้ง
    equipChance: { normal: 0.08, boss: 1.0 },
    bossEquipCount: 2,                   // บอสดรอปกี่ชิ้น (ชิ้นธรรมดา)
    blueChance: { normal: 0.05, boss: 0.15 },   // สัดส่วนที่ชิ้นธรรมดาจะเป็นสีฟ้า (ที่เหลือขาว)

    // สีแดง/ทอง: สุ่มแยกต่อการฆ่า 1 ครั้ง (ได้เพิ่มจากชิ้นธรรมดา) | 0.0001 = 0.01%
    redChance:  { normal: 0.0001, boss: 0.001 },
    goldChance: { boss: 0.0001 },        // ทอง: บอสเท่านั้น

    // หินตีบวก: โอกาส = base + perZone x (ลำดับด่าน) | จำนวน = qtyBase + floor(ลำดับด่าน / qtyStep)
    stone: {
      normal: { base: 0.03, perZone: 0.012, qtyBase: 1, qtyStep: 3 },
      boss:   { base: 0.30, perZone: 0.050, qtyBase: 3, qtyStep: 1 },
      maxZone: 14,                       // ลำดับด่านสูงสุดที่ใช้คำนวณ (กันเกินเพดาน)
    },
  };

  // ด่านจุติของโซนนี้ (zones.js เก็บไว้ที่ z.reqRebirth | ด่านปกติ/เมือง = 0)
  function rebirthTier(z) {
    return Number(z && z.reqRebirth) || 0;   // zones.js: ด่านปกติ = 0, "ด่านจุติ 9" = 9
  }

  function pickLevel(monsterLv, z) {
    const ok = [];
    CFG.levels.forEach(function (L) {
      if (L === 99) { if (rebirthTier(z) >= CFG.rebirthFor99) ok.push(L); }
      else if (monsterLv >= (CFG.minMonsterLv[L] || 0)) ok.push(L);
    });
    if (!ok.length) return 1;
    // ถ่วงน้ำหนัก: เลเวลสูงที่ปลดล็อกแล้วออกบ่อยกว่าเล็กน้อย
    let total = 0;
    ok.forEach(function (_, i) { total += i + 1; });
    let r = Math.random() * total;
    for (let i = 0; i < ok.length; i++) { r -= i + 1; if (r <= 0) return ok[i]; }
    return ok[ok.length - 1];
  }

  function giveEquip(sc, level, tier) {
    const item = randomEquipItem(level, tier);          // จาก items.js
    const label = itemLabel(item);
    if (sc.findEmptyBagSlot() === -1) { sc.toastMsg('กระเป๋าเต็ม! พลาด ' + label); return; }
    sc.addItemToBag(item);
    const mark = tier === 'gold' ? '🌟 ' : (tier === 'red' ? '🟥 ' : '');
    sc.toastMsg(mark + 'ได้รับ ' + TIER_DEFS[tier].name + ' ' + label);
  }

  function rollEquip(sc, lv, z, isBoss) {
    // ทอง (บอสเท่านั้น)
    if (isBoss && Math.random() < CFG.goldChance.boss) giveEquip(sc, pickLevel(lv, z), 'gold');
    // แดง
    if (Math.random() < (isBoss ? CFG.redChance.boss : CFG.redChance.normal)) giveEquip(sc, pickLevel(lv, z), 'red');
    // ชิ้นธรรมดา ขาว/ฟ้า
    const n = isBoss ? CFG.bossEquipCount : 1;
    for (let i = 0; i < n; i++) {
      if (Math.random() >= (isBoss ? CFG.equipChance.boss : CFG.equipChance.normal)) continue;
      const tier = Math.random() < (isBoss ? CFG.blueChance.boss : CFG.blueChance.normal) ? 'blue' : 'white';
      giveEquip(sc, pickLevel(lv, z), tier);
    }
  }

  function rollStone(sc, isBoss) {
    const c = isBoss ? CFG.stone.boss : CFG.stone.normal;
    const zi = Math.max(0, Math.min(CFG.stone.maxZone, sc.stageIdx || 0));
    if (Math.random() >= Math.min(1, c.base + c.perZone * zi)) return;
    const n = c.qtyBase + Math.floor(zi / c.qtyStep);
    if (sc.stoneRoom() < n) { sc.toastMsg('กระเป๋าเต็ม! พลาดหินตีบวก x' + n); return; }
    sc.addStonesToBag(n);
    sc.toastMsg('ได้รับ หินตีบวก x' + n);
  }

  // เก็บรายการของที่ตกพื้นระหว่าง dropLoot เพื่อเด้งเข้าตัวทันที
  const _make = P.makeLoot;
  if (typeof _make === 'function') {
    P.makeLoot = function () {
      const s = _make.apply(this, arguments);
      if (this._ddCollect && s) this._ddCollect.push(s);
      return s;
    };
  }

  const _drop = P.dropLoot;
  P.dropLoot = function (x, y, monsterLv, boxLevel, isBoss, isEpic) {
    this._ddCollect = [];
    let r, list;
    try { r = _drop.apply(this, arguments); }
    finally { list = this._ddCollect; this._ddCollect = null; }

    // กล่อง/หนังสือสกิลที่ตกพื้น -> เก็บเข้ากระเป๋าเลย (ผ่านระบบ pickup เดิม รวมการแชร์ปาร์ตี้)
    (list || []).forEach(function (s) {
      try { if (s && s.active && isBoss && s.getData && s.getData('kind') === 'box') s.setData('boss', true); if (s && s.active && this.pickup) this.pickup(s); } catch (e) { console.warn('directDrop pickup', e); }
    }, this);

    try {
      const z = ZONES[this.stageIdx];
      if (z && !z.town) {
        rollEquip(this, monsterLv || 1, z, !!isBoss);
        rollStone(this, !!isBoss);
      }
    } catch (e) { console.warn('directDrop', e); }
    return r;
  };
})();
