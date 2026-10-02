// ===== ระบบตีบวก (+1 ถึง +99) / หินตีบวก / ย่อยอุปกรณ์ =====
// โหลดหลัง bagWindow.js และ itemSets.js ก่อน main.js
(function () {
  const P = Main.prototype;

  // ---------- สวมใส่ / ถอดอุปกรณ์ (ย้ายมาจาก items.js เพราะ items.js โหลดก่อน Main) ----------
  P.equipItem = function (slotKey, item) {
    const old = this.equipment[slotKey];
    this.equipment[slotKey] = item;
    if (old) this.addItemToBag(old);
    this.computeAtk();
  };

  // ถ้ากระเป๋าเต็มจะไม่ถอด (กันของหายแลกเป็นทอง)
  P.unequipSlot = function (slotKey) {
    const it = this.equipment[slotKey];
    if (!it) return;
    if (this.findEmptyBagSlot() === -1) { this.toastMsg('กระเป๋าเต็ม ถอดไม่ได้'); return; }
    this.equipment[slotKey] = null;
    this.addItemToBag(it);
    this.computeAtk();
  };

  // ---------- ค่าที่ปรับได้ ----------
  const MAX_PLUS = 99;
  // แต่ละขั้นเพิ่มแบบเส้นตรง: ค่าใช้จ่าย = ค่าตั้งต้น x (1 + ขั้นที่ผ่านมา x STEP)
  const STONE_STEP = 0.5;       // หินเพิ่มขั้นละ 50% ของค่าตั้งต้น (2, 3, 4, 5, ...)
  const GOLD_STEP = 0.5;        // เงินเพิ่มขั้นละ 50% ของค่าตั้งต้น
  const GOLD_BASE_PER_LV = 20;  // เงินของ +1 = เลเวลไอเทม x ค่านี้
  const REFUND = 0.8;           // ย่อยของบวก ได้หินคืน 80% (เงินไม่คืน)
  window.MAX_PLUS = MAX_PLUS;

  // หินเริ่มต้นของ +1: เลเวล<10 = 2 | 10 = 3 | 20 = 4 | ... | 90 = 11
  function stoneStart(level) { return level < 10 ? 2 : 2 + Math.floor(level / 10); }

  // ค่าตีบวกจาก +p ไป +(p+1)
  function stoneCost(level, p) { return Math.ceil(stoneStart(level) * (1 + p * STONE_STEP)); }
  window.enhanceCost = function (item) {
    const p = item.plus || 0;
    return {
      stones: stoneCost(item.level, p),
      gold: Math.round(item.level * GOLD_BASE_PER_LV * (1 + p * GOLD_STEP)),
    };
  };

  // โอกาสสำเร็จตามเป้าหมาย: +1-20 = 100% | +21-50 = 70% | +51-80 = 30% | +81-99 = 5%
  // ล้มเหลว = เสียหินและทอง แต่ระดับ + ไม่ลด
  window.enhanceChance = function (item) {
    const t = (item.plus || 0) + 1;   // ระดับที่กำลังจะตีไปถึง
    if (t <= 20) return 1;
    if (t <= 50) return 0.7;
    if (t <= 80) return 0.3;
    return 0.05;
  };

  // หินที่ใช้ไปทั้งหมดจนถึง +plus ปัจจุบัน
  function stonesSpent(item) {
    let sum = 0;
    for (let p = 0; p < (item.plus || 0); p++) sum += stoneCost(item.level, p);
    return sum;
  }
  // หินที่ได้จากย่อยชิ้นนี้: ฐาน (ตามเลเวล/ดาว) + คืนจากตีบวก 80%
  function baseYield(item) {
    const tm = (typeof tierMultOf === 'function') ? tierMultOf(item) : 1;   // สีสูง ย่อยได้หินมากกว่า
    return Math.max(1, Math.round((1 + Math.floor(item.level / 10)) * (1 + (item.star || 0) * 0.5) * tm));
  }
  window.dismantleYield = function (item) {
    return baseYield(item) + Math.floor(stonesSpent(item) * REFUND);
  };

  const big = n => n >= 1e12 ? n.toExponential(2).replace('+', '') : Math.round(n).toLocaleString();

  // แถวข้อมูลตีบวกในหน้ารายละเอียดไอเทม (bagWindow.js เรียกใช้)
  window.enhanceInfoHTML = function (s, it) {
    const p = it.plus || 0;
    let h = '<div class="d-row"><span>ตีบวก</span><span>' + (p > 0 ? '+' + p : '-') + ' / ' + MAX_PLUS + '</span></div>';
    if (p < MAX_PLUS) {
      const c = window.enhanceCost(it);
      h += '<div class="d-row"><span>ตีเป็น +' + (p + 1) + ' (' + Math.round(window.enhanceChance(it) * 100) + '%)</span><span>หิน ' + big(s.countStones()) + '/' + big(c.stones)
        + ' · ทอง ' + big(c.gold) + '</span></div>';
    }
    h += '<div class="d-row"><span>ย่อยได้หิน</span><span>' + big(window.dismantleYield(it)) + ' ก้อน</span></div>';
    return h;
  };

  // ---------- หินในกระเป๋า (ซ้อนได้) ----------
  P.countStones = function () {
    let n = 0;
    this.bag.forEach(s => { if (s && s.kind === 'stone') n += s.count; });
    return n;
  };

  P.stoneRoom = function () {
    let room = 0;
    this.bag.forEach(s => {
      if (!s) room += MAX_STONE_STACK;
      else if (s.kind === 'stone') room += MAX_STONE_STACK - s.count;
    });
    return room;
  };

  P.addStonesToBag = function (n) {
    let left = n;
    this.bag.forEach(s => {
      if (left > 0 && s && s.kind === 'stone' && s.count < MAX_STONE_STACK) {
        const add = Math.min(left, MAX_STONE_STACK - s.count);
        s.count += add; left -= add;
      }
    });
    while (left > 0) {
      const idx = this.findEmptyBagSlot();
      if (idx === -1) break;
      const add = Math.min(left, MAX_STONE_STACK);
      this.bag[idx] = { kind: 'stone', count: add };
      left -= add;
    }
    return left;   // จำนวนที่ใส่ไม่ได้ (0 = ครบ)
  };

  P.consumeStones = function (n) {
    if (this.countStones() < n) return false;
    for (let i = 0; i < this.bag.length && n > 0; i++) {
      const s = this.bag[i];
      if (!s || s.kind !== 'stone') continue;
      const take = Math.min(n, s.count);
      s.count -= take; n -= take;
      if (s.count <= 0) this.bag[i] = null;
    }
    return true;
  };

  // ---------- ตีบวก (src = 'bag' | 'equip') ----------
  P.enhanceItem = function (src, id) {
    const it = src === 'bag' ? this.bag[id] : this.equipment[id];
    if (!it || it.kind !== 'equip') return false;
    const p = it.plus || 0;
    if (p >= MAX_PLUS) { this.toastMsg('ตีบวกสูงสุดแล้ว (+' + MAX_PLUS + ')'); return false; }
    const c = window.enhanceCost(it);
    if (this.countStones() < c.stones) { this.toastMsg('หินไม่พอ (ต้องการ ' + big(c.stones) + ' ก้อน)'); return false; }
    if (this.stats.gold < c.gold) { this.toastMsg('ทองไม่พอ (ต้องการ ' + big(c.gold) + ')'); return false; }
    this.consumeStones(c.stones);
    this.stats.gold -= c.gold;
    if (Math.random() >= window.enhanceChance(it)) {
      this.toastMsg('ตีบวกล้มเหลว! เสียหิน ' + big(c.stones) + ' ก้อน และทอง ' + big(c.gold) + ' (ยังเป็น +' + p + ')');
      return true;
    }
    const up = Object.assign({}, it, { plus: p + 1 });
    if (src === 'bag') this.bag[id] = up; else this.equipment[id] = up;
    this.computeAtk();
    this.toastMsg('ตีบวกสำเร็จ! ' + itemLabel(up));
    return true;
  };

  // ---------- ย่อยอุปกรณ์ในกระเป๋าเป็นหิน ----------
  P.dismantleBagItem = function (idx) {
    const it = this.bag[idx];
    if (!it || it.kind !== 'equip') return false;
    const n = window.dismantleYield(it);
    this.bag[idx] = null;
    if (this.stoneRoom() < n) {
      this.bag[idx] = it;
      this.toastMsg('กระเป๋าเต็ม ใส่หินไม่พอ');
      return false;
    }
    this.addStonesToBag(n);
    this.toastMsg('ย่อย ' + itemLabel(it) + ' ได้หิน ' + big(n) + ' ก้อน');
    return true;
  };

  // ---------- กล่องอุปกรณ์: เปิดหลายใบ / ย่อยเป็นหินโดยไม่ต้องเปิด ----------
  // หินต่อกล่อง 1 ใบ = เท่ากับย่อยอุปกรณ์ดาว 0 เลเวลเดียวกัน
  window.boxStoneYield = function (level, tier) { return baseYield({ level: level, star: 0, tier: tier }); };

  // เปิดกล่อง n ใบ: ได้อุปกรณ์แยกเป็นชิ้นๆ ไม่รวมดาวให้อัตโนมัติ | จำกัดตามช่องว่างในกระเป๋า
  P.openBoxes = function (idx, n) {
    const box = this.bag[idx];
    if (!box || box.kind !== 'box') return 0;
    const count = box.count || 1;
    n = Math.max(1, Math.min(n || 1, count));
    const free = this.bag.filter(s => !s).length;
    let k = Math.min(n, free);
    if (n === count && count <= free + 1) k = count;   // เปิดหมดกอง ช่องของกล่องว่างเพิ่ม 1
    if (k <= 0) { this.toastMsg('กระเป๋าเต็ม เปิดกล่องไม่ได้'); return 0; }
    box.count = count - k;
    if (box.count <= 0) this.bag[idx] = null;
    for (let i = 0; i < k; i++) this.bag[this.findEmptyBagSlot()] = randomEquipItem(box.level, box.tier);
    this.toastMsg('เปิดกล่อง ' + k + ' ใบ ได้อุปกรณ์ ' + k + ' ชิ้น' + (k < n ? ' (กระเป๋าเต็ม)' : ''));
    return k;
  };

  // ย่อยกล่อง n ใบเป็นหินทันที
  P.dismantleBoxes = function (idx, n) {
    const box = this.bag[idx];
    if (!box || box.kind !== 'box') return 0;
    const count = box.count || 1;
    n = Math.max(1, Math.min(n || 1, count));
    const total = window.boxStoneYield(box.level, box.tier) * n;
    box.count = count - n;
    if (box.count <= 0) this.bag[idx] = null;
    if (this.stoneRoom() < total) {
      if (!this.bag[idx]) this.bag[idx] = box;
      box.count = count;
      this.toastMsg('กระเป๋าเต็ม ใส่หินไม่พอ');
      return 0;
    }
    this.addStonesToBag(total);
    this.toastMsg('ย่อยกล่อง ' + n + ' ใบ ได้หิน ' + big(total) + ' ก้อน');
    return n;
  };

  // ---------- รวมดาวเฉพาะจำนวนที่เลือก ----------
  // จำนวนชิ้นในกระเป๋าที่รวมกับชิ้นนี้ได้ (นับรวมชิ้นนี้)
  P.countMatches = function (idx) {
    const it = this.bag[idx];
    if (!it || it.kind !== 'equip') return 0;
    let n = 0;
    this.bag.forEach(s => { if (itemsMatch(s, it)) n++; });
    return n;
  };

  // รวม n ครั้ง (ครั้งละ 2 ชิ้น -> 1 ชิ้นดาวเพิ่ม) คืนจำนวนครั้งที่รวมได้
  P.mergeSelectedCount = function (idx, n) {
    const it = this.bag[idx];
    if (!it || it.kind !== 'equip') { this.toastMsg('เลือกอุปกรณ์ในกระเป๋าก่อน'); return 0; }
    if ((it.star || 0) >= MAX_STAR) { this.toastMsg('ดาวสูงสุดแล้ว'); return 0; }
    const k = Math.min(n || 1, Math.floor(this.countMatches(idx) / 2));
    if (k <= 0) { this.toastMsg('ไม่พบไอเทมที่เหมือนกันสำหรับรวม'); return 0; }
    const slots = [];
    this.bag.forEach((s, i) => { if (itemsMatch(s, it)) slots.push(i); });
    const used = slots.slice(0, k * 2);
    const made = Object.assign({}, it, { star: Math.min(MAX_STAR, (it.star || 0) + 1) });
    used.forEach((slot, i) => { this.bag[slot] = i < k ? Object.assign({}, made) : null; });
    this.toastMsg('รวมสำเร็จ ' + k + ' ครั้ง ได้ ' + itemLabel(made) + ' x' + k);
    return k;
  };

  // ---------- รวมดาวจากรายการช่องที่ติ๊กไว้ (หลายชิ้น) ----------
  // ชิ้นที่เหมือนกันในรายการจะจับคู่ครั้งละ 2 ชิ้น -> 1 ชิ้นดาวเพิ่ม | dryRun = แค่นับจำนวนครั้งที่รวมได้
  P.mergeIndices = function (list, dryRun) {
    const groups = [];
    list.forEach(i => {
      const it = this.bag[i];
      if (!it || it.kind !== 'equip') return;
      const g = groups.find(g => itemsMatch(this.bag[g[0]], it));
      if (g) g.push(i); else groups.push([i]);
    });
    let made = 0;
    groups.forEach(g => {
      const first = this.bag[g[0]];
      if ((first.star || 0) >= MAX_STAR) return;
      const pairs = Math.floor(g.length / 2);
      for (let p = 0; p < pairs; p++) {
        made++;
        if (dryRun) continue;
        const a = g[p * 2], b = g[p * 2 + 1];
        this.bag[a] = Object.assign({}, this.bag[a], { star: Math.min(MAX_STAR, (this.bag[a].star || 0) + 1) });
        this.bag[b] = null;
      }
    });
    if (!dryRun) this.toastMsg(made > 0 ? 'รวมสำเร็จ ' + made + ' ครั้ง' : 'ในที่ติ๊กไม่มีคู่ที่รวมกันได้');
    return made;
  };

  // ---------- จัดกระเป๋า: รวมกองของที่ซ้อนได้ + เรียงตามชนิด ----------
  P.sortBag = function () {
    const stackMax = {
      box: typeof MAX_BOX_STACK !== 'undefined' ? MAX_BOX_STACK : 99,
      stone: MAX_STONE_STACK,
      optstone: MAX_STONE_STACK,
      cleanstone: MAX_STONE_STACK,
      skillbook: typeof MAX_SKILLBOOK_STACK !== 'undefined' ? MAX_SKILLBOOK_STACK : 999,
    };
    const totals = {}, order = [], equips = [];
    this.bag.forEach(s => {
      if (!s) return;
      if (s.kind === 'equip') { equips.push(s); return; }
      const key = s.kind === 'box' ? 'box:' + tierOf(s) + ':' + s.level
        : s.kind === 'optstone' ? 'optstone:' + s.color + ':' + s.level
        : s.kind === 'skillbook' ? 'skillbook:' + s.sid : s.kind;
      if (!totals[key]) { totals[key] = { proto: s, count: 0 }; order.push(key); }
      totals[key].count += (s.count || 1);
    });
    const kindRank = k => k.indexOf('box') === 0 ? 0 : k === 'stone' ? 1 : k.indexOf('optstone') === 0 ? 2 : k === 'cleanstone' ? 3 : 4;
    order.sort((a, b) => {
      const r = kindRank(a) - kindRank(b);
      if (r) return r;
      const pa = totals[a].proto, pb = totals[b].proto;
      if (kindRank(a) === 0) return TIER_ORDER.indexOf(tierOf(pb)) - TIER_ORDER.indexOf(tierOf(pa)) || pb.level - pa.level;
      if (kindRank(a) === 2) return OPT_COLOR_KEYS.indexOf(pa.color) - OPT_COLOR_KEYS.indexOf(pb.color) || pb.level - pa.level;
      return a < b ? -1 : a > b ? 1 : 0;
    });

    const out = [];
    order.forEach(key => {
      const t = totals[key], max = stackMax[t.proto.kind] || 999;
      let left = t.count;
      while (left > 0) {
        const add = Math.min(left, max);
        out.push(Object.assign({}, t.proto, { count: add }));
        left -= add;
      }
    });

    const slotRank = ['weapon', 'helmet', 'armor', 'gloves', 'shoes', 'ring', 'necklace'];
    equips.sort((a, b) =>
      slotRank.indexOf(a.baseSlot) - slotRank.indexOf(b.baseSlot)
      || String(a.class || '').localeCompare(String(b.class || ''))
      || String(a.variant || '').localeCompare(String(b.variant || ''))
      || b.level - a.level || (b.star || 0) - (a.star || 0) || (b.plus || 0) - (a.plus || 0));
    equips.forEach(e => out.push(e));

    for (let i = 0; i < this.bag.length; i++) this.bag[i] = out[i] || null;
    this.toastMsg('จัดกระเป๋าเรียบร้อย');
  };

  // ---------- ไอคอนหิน (วาดเองด้วยโค้ด ไม่ต้องมีไฟล์รูป) ----------
  function ensureStoneTexture(scene) {
    if (!scene.textures || scene.textures.exists('icon_stone')) return;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 32, 32);
    grad.addColorStop(0, '#bfeaff'); grad.addColorStop(1, '#3a86d6');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(16, 3); g.lineTo(28, 12); g.lineTo(24, 28); g.lineTo(8, 28); g.lineTo(4, 12); g.closePath();
    g.fill();
    g.strokeStyle = '#eaf7ff'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath(); g.moveTo(16, 6); g.lineTo(22, 12); g.lineTo(16, 14); g.lineTo(10, 12); g.closePath(); g.fill();
    scene.textures.addCanvas('icon_stone', c);
  }

  const _open = P.openInventory;
  P.openInventory = function () {
    ensureStoneTexture(this);
    return _open.apply(this, arguments);
  };
})();
