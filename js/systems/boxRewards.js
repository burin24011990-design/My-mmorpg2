
// ===== กล่องวัตถุดิบ: กล่องธรรมดา / กล่องบอส =====
// ไฟล์: js/systems/boxRewards.js
// โหลด "หลัง" directDrop.js (และหลัง enhance.js / lootOptions.js / roomMonsters.js / fashionCraft.js) ก่อน js/main.js
// - กล่องไม่ให้อุปกรณ์แล้ว: เปิดแล้วได้ ชิ้นส่วนแฟชั่น / วัตถุดิบอาหาร / เมล็ดพันธุ์ / หินตีบวก (อุปกรณ์ดรอปตรงจาก directDrop.js)
// - กล่องที่ตกจากบอส = "กล่องบอส" (item.boss = true) แยกกองกับกล่องธรรมดา
//   กล่องบอส: ได้วัตถุดิบบอส (แก่นบอสประจำด่านเสมอ + หัวใจ/วิญญาณ/มงกุฎมีโอกาส)
//   กล่องธรรมดา: มีโอกาส 0.05% ที่จะได้วัตถุดิบบอส
// - โซนของที่ได้ = ตามเลเวลกล่อง (1-9 = ด่าน 1, 10-19 = ด่าน 2, ... 80 ขึ้นไป = ด่าน 9) | สีกล่องคูณจำนวนของ
(function () {
  const P = Main.prototype;

  // ===== ปรับตรงนี้ =====
  const CFG = {
    tierQty: { white: 1, blue: 1.5, red: 2.5, gold: 4 },   // ตัวคูณจำนวนของตามสีกล่อง
    normalBossMatChance: 0.0005,          // กล่องธรรมดา: โอกาสได้วัตถุดิบบอส 0.05%
    bossMatWeights: { core: 80, heart: 15, soul: 4, crown: 1 },   // ถ้าสุ่มได้วัตถุดิบบอสจากกล่องธรรมดา จะได้ชนิดไหน (น้ำหนัก)
    foodExtraChance: 0.3,                 // โอกาสที่ของอาหาร 1 ชิ้นจะเป็นผัก/ปลา แทนชิ้นส่วนมอนของด่าน

    normal: {
      fashionZone: [1, 3],                // ของแฟชั่นประจำด่าน (fm_z)
      fashionCat: { chance: 0.5, qty: [1, 2] },   // ขนปีก/ขนหาง/ไข่
      food: { picks: 2, qty: [1, 3] },    // วัตถุดิบอาหาร กี่ชนิด x จำนวน
      seed: { chance: 0.6, qty: [1, 3] },
      stone: { base: 2, perZone: 1 },     // หินตีบวก = base + perZone x (ด่าน-1)
    },
    boss: {
      fashionZone: [3, 6],
      fashionCat: { chance: 1, qty: [2, 4] },
      food: { picks: 3, qty: [2, 5] },
      seed: { chance: 1, qty: [2, 4] },
      stone: { base: 6, perZone: 3 },
      core: [1, 2],                       // แก่นบอสประจำด่าน (fb_z) ได้เสมอ
      heart: 0.20, soul: 0.08, crown: 0.03,   // ของหายากจากบอส (ด่านสูงโอกาสเพิ่มด่านละ 8% เหมือน fashionCraft.js)
    },
  };

  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const zoneOf = level => Math.max(1, Math.min(9, Math.floor((Number(level) || 1) / 10) + 1));
  const maxBox = () => (typeof MAX_BOX_STACK !== 'undefined' ? MAX_BOX_STACK : 99);
  const maxMat = () => (typeof MAX_MAT_STACK !== 'undefined' ? MAX_MAT_STACK : 999);
  const maxStone = () => (typeof MAX_STONE_STACK !== 'undefined' ? MAX_STONE_STACK : 9999);
  const sv = sc => { if (sc && sc.saveSoon) sc.saveSoon(); };

  // ---------- ชื่อกล่อง ----------
  try {
    const _label = itemLabel;
    itemLabel = function (item) {
      if (item && item.kind === 'box') {
        const t = tierOf(item);
        return (item.boss ? '👑 กล่องบอส' : 'กล่องวัตถุดิบ') + (t !== 'white' ? ' (' + TIER_DEFS[t].name + ')' : '')
          + ' เลเวล ' + item.level + (item.count > 1 ? '  x' + item.count : '');
      }
      return _label(item);
    };
  } catch (e) { console.warn('boxRewards: ครอบ itemLabel ไม่ได้', e); }

  // ข้อความอธิบายกล่องในหน้ารายละเอียด (bagWindow.js เรียกใช้ ถ้าแก้ตามคำแนะนำ)
  window.boxNoteText = function (it) {
    const t = TIER_DEFS[tierOf(it)].name;
    return (it.boss ? 'กล่องจากบอส: ' : 'กล่องจากมอนสเตอร์: ')
      + 'เปิดแล้วได้ชิ้นส่วนแฟชั่น วัตถุดิบอาหาร เมล็ดพันธุ์ และหินตีบวก'
      + (it.boss ? ' (ได้วัตถุดิบบอสเสมอ)' : ' (มีโอกาส 0.05% ได้วัตถุดิบบอส)')
      + ' | สี' + t + ' (ยิ่งสูงยิ่งได้เยอะ) | ของจากด่าน ' + zoneOf(it.level);
  };

  // ---------- สุ่มของในกล่อง ----------
  function foodExtraPool() {
    const out = [];
    try {
      Object.keys(CROPS).forEach(k => out.push(CROPS[k].veg));
      FISH_TABLE.forEach(f => out.push(f.id));
    } catch (e) { /* ไม่มีข้อมูล = ใช้แต่ชิ้นส่วนมอน */ }
    return out;
  }

  function rollSeed(zone, boss) {
    try {
      const tiers = SEED_DROP.tiers;
      const ws = tiers.map(t => {
        let w = Math.max(1, t.w + t.shift * (zone - 1));
        if (boss && t.key === 'rare') w *= SEED_DROP.bossRareMul;
        return w;
      });
      let r = Math.random() * ws.reduce((a, b) => a + b, 0);
      for (let i = 0; i < tiers.length; i++) { r -= ws[i]; if (r <= 0) return 'seed_' + pick(tiers[i].seeds); }
      return 'seed_' + pick(tiers[tiers.length - 1].seeds);
    } catch (e) { return 'seed_cabbage'; }
  }

  function rollBossMat(zone) {
    const w = CFG.bossMatWeights, ids = { core: 'fb_z' + zone, heart: 'fb_heart', soul: 'fb_soul', crown: 'fb_crown' };
    const keys = Object.keys(w);
    let r = Math.random() * keys.reduce((a, k) => a + w[k], 0);
    for (let i = 0; i < keys.length; i++) { r -= w[keys[i]]; if (r <= 0) return ids[keys[i]]; }
    return ids.core;
  }

  // คืน { รหัสวัตถุดิบ: จำนวน, __stone: จำนวนหินตีบวก }
  function rollBoxContents(zone, boss, mul) {
    const c = boss ? CFG.boss : CFG.normal, out = {};
    const add = (id, n) => { if (n > 0) out[id] = (out[id] || 0) + n; };
    const q = r => Math.max(1, Math.round(rnd(r[0], r[1]) * mul));

    // แฟชั่น
    add('fm_z' + zone, q(c.fashionZone));
    if (Math.random() < c.fashionCat.chance) add(pick(['fm_feather', 'fm_fur', 'fm_egg']), q(c.fashionCat.qty));

    // อาหาร: ชิ้นส่วนมอนตามธีมด่าน (บางชิ้นเป็นผัก/ปลา)
    const theme = (typeof DROP_THEMES !== 'undefined' && DROP_THEMES[zone - 1]) ? DROP_THEMES[zone - 1].map(d => d.id) : ['meat_raw'];
    const extra = foodExtraPool();
    for (let i = 0; i < c.food.picks; i++) {
      add((Math.random() < CFG.foodExtraChance && extra.length) ? pick(extra) : pick(theme), q(c.food.qty));
    }

    // เมล็ดพันธุ์
    if (Math.random() < c.seed.chance) add(rollSeed(zone, boss), q(c.seed.qty));

    // หินตีบวก
    add('__stone', Math.max(1, Math.round((c.stone.base + c.stone.perZone * (zone - 1)) * mul)));

    // วัตถุดิบบอส
    if (boss) {
      add('fb_z' + zone, rnd(c.core[0], c.core[1]));
      const bias = 1 + 0.08 * (zone - 1);
      if (Math.random() < c.heart * bias) add('fb_heart', 1);
      if (Math.random() < c.soul * bias) add('fb_soul', 1);
      if (Math.random() < c.crown * bias) add('fb_crown', 1);
    } else if (Math.random() < CFG.normalBossMatChance) {
      add(rollBossMat(zone), 1);
    }

    // ตัดรหัสที่ไม่มีในระบบ (กัน error)
    Object.keys(out).forEach(id => { if (id !== '__stone' && !(typeof MAT_DEFS !== 'undefined' && MAT_DEFS[id])) delete out[id]; });
    return out;
  }

  // ใส่ของทั้งหมดลงกระเป๋าได้ไหม (นับช่องว่างที่ต้องใช้รวมทุกชนิด)
  function feasible(sc, totals) {
    const free = sc.bag.filter(s => !s).length;
    let need = 0;
    Object.keys(totals).forEach(id => {
      const n = totals[id];
      const isStone = id === '__stone', max = isStone ? maxStone() : maxMat();
      let room = 0;
      sc.bag.forEach(s => {
        if (!s) return;
        if (isStone ? s.kind === 'stone' : (s.kind === 'material' && s.mid === id)) room += max - (s.count || 0);
      });
      if (n > room) need += Math.ceil((n - room) / max);
    });
    return need <= free;
  }

  // ---------- เปิดกล่อง (แทนของเดิมใน enhance.js) ----------
  P.openBoxes = function (idx, n) {
    const box = this.bag[idx];
    if (!box || box.kind !== 'box') return 0;
    if (typeof this.addMat !== 'function') { this.toastMsg('ระบบวัตถุดิบยังไม่พร้อม (house.js)'); return 0; }
    const count = box.count || 1;
    n = Math.max(1, Math.min(n || 1, count));
    const boss = !!box.boss, zone = zoneOf(box.level), mul = CFG.tierQty[tierOf(box)] || 1;

    let totals = {}, opened = 0;
    for (let i = 0; i < n; i++) {
      const r = rollBoxContents(zone, boss, mul), t = Object.assign({}, totals);
      Object.keys(r).forEach(k => { t[k] = (t[k] || 0) + r[k]; });
      if (!feasible(this, t)) break;
      totals = t; opened++;
    }
    if (!opened) { this.toastMsg('กระเป๋าเต็ม เปิดกล่องไม่ได้'); return 0; }

    box.count = count - opened;
    if (box.count <= 0) this.bag[idx] = null;

    const got = [];
    Object.keys(totals).forEach(id => {
      const qty = totals[id];
      if (id === '__stone') { this.addStonesToBag(qty); got.push({ boss: false, txt: '💎 หินตีบวก x' + qty }); return; }
      this.addMat(id, qty);
      const d = MAT_DEFS[id];
      got.push({ boss: !!d.boss, txt: d.icon + ' ' + d.name + ' x' + qty });
    });
    got.sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0));
    const shown = got.slice(0, 6).map(g => g.txt).join(' ');
    this.toastMsg((got.some(g => g.boss) ? '🌟 ' : '') + 'เปิด ' + opened + ' กล่อง ได้ ' + shown + (got.length > 6 ? ' และอีก ' + (got.length - 6) + ' อย่าง' : ''));
    sv(this);
    return opened;
  };

  // ---------- เพิ่มกล่องลงกระเป๋า (แยกกองบอส/ธรรมดา) คืนจำนวนที่ใส่ไม่ได้ ----------
  function addBoxItem(sc, level, tier, boss, n) {
    let left = n;
    sc.bag.forEach(s => {
      if (left > 0 && s && s.kind === 'box' && s.level === level && tierOf(s) === tier && !!s.boss === !!boss && (s.count || 1) < maxBox()) {
        const a = Math.min(left, maxBox() - (s.count || 1));
        s.count = (s.count || 1) + a; left -= a;
      }
    });
    while (left > 0) {
      const idx = sc.findEmptyBagSlot();
      if (idx === -1) break;
      const a = Math.min(left, maxBox());
      const item = { kind: 'box', level: level, tier: tier, count: a };
      if (boss) item.boss = true;
      sc.bag[idx] = item;
      left -= a;
    }
    return left;
  }

  // ---------- ติดป้ายกล่องที่ตกจากบอส ----------
  const _make = P.makeLoot;
  if (typeof _make === 'function') {
    P.makeLoot = function (x, y, name) {
      const s = _make.apply(this, arguments);
      if (this._brBoss && name === 'box' && s && typeof s.setData === 'function') s.setData('boss', true);
      return s;
    };
  }
  const _drop = P.dropLoot;
  P.dropLoot = function (x, y, lv, boxLevel, isBoss) {
    this._brBoss = !!isBoss;
    try { return _drop.apply(this, arguments); }
    finally { this._brBoss = false; }
  };

  // ---------- เก็บกล่องเข้ากระเป๋า (แทนของ lootOptions.js เฉพาะกล่อง) ----------
  // ถ้าอยู่ในปาร์ตี้ที่ตั้งโหมดแชร์ของ ให้ระบบเดิมจัดการ (ธง "บอส" จะหายตอนแชร์ กลายเป็นกล่องธรรมดา)
  function wouldShare(sc, it) {
    const pt = sc.party;
    return !!(it.getData('shareable') && !it.getData('shared') && pt && pt.members && pt.members.length >= 2
      && (pt.lootMode || 'own') !== 'own' && sc.socket && sc.socket.connected);
  }
  const _pickup = P.pickup;
  P.pickup = function (item) {
    try {
      if (item && typeof item.getData === 'function' && item.getData('kind') === 'box' && !wouldShare(this, item)) {
        const level = item.getData('level'), tier = item.getData('tier') || 'white', boss = !!item.getData('boss');
        if (addBoxItem(this, level, tier, boss, 1) > 0) {
          if (this.time.now > (this._brFullAt || 0)) {
            this._brFullAt = this.time.now + 1500;
            this.toastMsg('กระเป๋าเต็ม! เก็บกล่องไม่ได้');
          }
          return;                       // ปล่อยกล่องไว้บนพื้น
        }
        this.toastMsg('ได้รับ ' + itemLabel({ kind: 'box', level: level, tier: tier, boss: boss, count: 1 }));
        item.destroy();
        return;
      }
    } catch (e) { console.warn('boxRewards pickup', e); }
    return _pickup.apply(this, arguments);
  };

  // ---------- กล่องแดง/ทองที่ lootOptions.js ใส่ตรงเข้ากระเป๋าตอนฆ่าบอส -> นับเป็นกล่องบอส ----------
  function boxTotals(sc) {
    const m = {};
    sc.bag.forEach(s => { if (s && s.kind === 'box' && !s.boss) { const k = s.level + '|' + tierOf(s); m[k] = (m[k] || 0) + (s.count || 1); } });
    return m;
  }
  const _rk = P.rollKillLoot;
  if (typeof _rk === 'function') {
    P.rollKillLoot = function (e) {
      if (!(e && e.isBoss)) return _rk.apply(this, arguments);
      const before = boxTotals(this);
      const r = _rk.apply(this, arguments);
      const after = boxTotals(this);
      Object.keys(after).forEach(k => {
        const diff = after[k] - (before[k] || 0);
        if (diff <= 0) return;
        const parts = k.split('|'), level = Number(parts[0]), tier = parts[1];
        let rem = diff;
        for (let i = this.bag.length - 1; i >= 0 && rem > 0; i--) {
          const s = this.bag[i];
          if (s && s.kind === 'box' && !s.boss && s.level === level && tierOf(s) === tier) {
            const t = Math.min(rem, s.count || 1);
            s.count = (s.count || 1) - t; rem -= t;
            if (s.count <= 0) this.bag[i] = null;
          }
        }
        addBoxItem(this, level, tier, true, diff - rem);
      });
      return r;
    };
  }

  // ---------- จัดกระเป๋า: ไม่ให้กล่องบอสไปรวมกับกล่องธรรมดา ----------
  const _sort = P.sortBag;
  if (typeof _sort === 'function') {
    P.sortBag = function () {
      const had = Object.prototype.hasOwnProperty.call(this, 'saveSoon'), orig = this.saveSoon;
      this.saveSoon = function () {};   // กันเซฟระหว่างที่เลเวลกล่องบอสถูกบวกชั่วคราว
      this.bag.forEach(s => { if (s && s.kind === 'box' && s.boss) s.level += 10000; });
      try { return _sort.apply(this, arguments); }
      finally {
        this.bag.forEach(s => { if (s && s.kind === 'box' && s.level >= 10000) s.level -= 10000; });
        if (had) this.saveSoon = orig; else delete this.saveSoon;
        sv(this);
      }
    };
  }
})();
