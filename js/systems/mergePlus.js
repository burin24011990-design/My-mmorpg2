// ===== รวมอุปกรณ์ที่ตีบวกแล้ว: ผลลัพธ์ใช้ +สูงสุดของชิ้นที่รวม =====
// ตัวอย่าง: ดาบ+3 รวม ดาบ+1 = ดาบ+3 เพิ่ม 1 ดาว (ชิ้น +1 ถูกใช้เป็นวัตถุดิบ)
// ยังต้องเป็นของเหมือนกัน (ชนิด/เลเวล/ดาว/สี/คลาส) และ "ไม่มีออฟชั่น" เหมือนเดิม
// โหลดหลัง enhance.js (และไฟล์อื่นๆ ทั้งหมด) ก่อน main.js
(function () {
  const P = Main.prototype;
  const plusOf = it => (it && it.plus) || 0;
  const starCap = () => (typeof MAX_STAR !== 'undefined' ? MAX_STAR : 5);
  const sv = sc => { if (sc && sc.saveSoon) sc.saveSoon(); };

  // ---- เงื่อนไขรวมได้: เหมือนของเดิม แต่ไม่ห้ามของที่ตีบวกแล้ว ----
  window.itemsMatch = function (a, b) {
    if (!a || !b || a.kind !== 'equip' || b.kind !== 'equip') return false;
    if (a.baseSlot !== b.baseSlot || a.level !== b.level || a.star !== b.star) return false;
    if ((a.opts && a.opts.length) || (b.opts && b.opts.length)) return false;
    if (tierOf(a) !== tierOf(b)) return false;
    if ((a.variant || '') !== (b.variant || '')) return false;
    if (a.baseSlot === 'weapon' && a.class !== b.class) return false;
    return true;
  };

  // จัดกลุ่มช่องในกระเป๋า (จากรายการ indices) ตามความเหมือน แต่ละกลุ่มเรียง + สูง -> ต่ำ
  function groupByMatch(bag, indices) {
    const groups = [];
    indices.forEach(i => {
      const it = bag[i];
      if (!it || it.kind !== 'equip') return;
      const g = groups.find(g => itemsMatch(bag[g[0]], it));
      if (g) g.push(i); else groups.push([i]);
    });
    groups.forEach(g => g.sort((x, y) => plusOf(bag[y]) - plusOf(bag[x])));
    return groups;
  }

  // รวม pairs คู่ในกลุ่ม g (เรียง + สูงสุดก่อน): ชิ้น + สูงสุด k ชิ้นแรกอัปดาว | + ต่ำสุด k ชิ้นท้ายเป็นวัตถุดิบ
  // จึงได้ผลลัพธ์ + สูงที่สุด และเสียชิ้น + ต่ำไปก่อน
  function mergeGroup(bag, g, pairs) {
    for (let p = 0; p < pairs; p++) {
      const keep = g[p], fodder = g[g.length - 1 - p];
      const k = bag[keep];
      bag[keep] = Object.assign({}, k, { star: Math.min(starCap(), (k.star || 0) + 1), plus: Math.max(plusOf(k), plusOf(bag[fodder])) });
      bag[fodder] = null;
    }
  }

  // ---- เก็บของเข้ากระเป๋าแล้วรวมอัตโนมัติ: ส่ง + สูงสุดให้ฟังก์ชันเดิม ----
  const _addEquip = P.addEquipItemToBag;
  P.addEquipItemToBag = function (item) {
    const m = this.bag.find(s => itemsMatch(s, item));
    if (m && plusOf(m) > plusOf(item)) item = Object.assign({}, item, { plus: plusOf(m) });
    return _addEquip.call(this, item);
  };

  // ---- รวมชิ้นที่เลือก (กดที่ไอเทม): จับคู่กับชิ้น + ต่ำสุดที่เหมือนกัน ผลลัพธ์เป็น + สูงสุดของสองชิ้น ----
  P.mergeSingleItem = function (idx) {
    const item = this.bag[idx];
    if (!item || item.kind !== 'equip') return false;
    let j = -1;
    this.bag.forEach((s, k) => {
      if (k !== idx && itemsMatch(s, item) && (j === -1 || plusOf(s) < plusOf(this.bag[j]))) j = k;
    });
    if (j === -1) { this.toastMsg('ไม่พบไอเทมที่เหมือนกันสำหรับรวม'); return false; }
    this.bag[idx] = Object.assign({}, item, { star: Math.min(starCap(), (item.star || 0) + 1), plus: Math.max(plusOf(item), plusOf(this.bag[j])) });
    this.bag[j] = null;
    this.toastMsg('รวมดาวสำเร็จ! ได้ ' + itemLabel(this.bag[idx]));
    sv(this);
    return true;
  };

  // ---- รวมทั้งกระเป๋า (รวมต่อเนื่องจนไม่มีคู่) ----
  P.mergeAllInBag = function () {
    let merges = 0, changed = true;
    while (changed) {
      changed = false;
      const all = this.bag.map((_, i) => i);
      groupByMatch(this.bag, all).forEach(g => {
        if ((this.bag[g[0]].star || 0) >= starCap()) return;
        const pairs = Math.floor(g.length / 2);
        if (pairs > 0) { mergeGroup(this.bag, g, pairs); merges += pairs; changed = true; }
      });
    }
    if (merges > 0) sv(this);
    return merges;
  };

  // ---- รวมกี่ครั้งก็ได้จากชิ้นที่เลือก ----
  P.mergeSelectedCount = function (idx, n) {
    const it = this.bag[idx];
    if (!it || it.kind !== 'equip') { this.toastMsg('เลือกอุปกรณ์ในกระเป๋าก่อน'); return 0; }
    if ((it.star || 0) >= starCap()) { this.toastMsg('ดาวสูงสุดแล้ว'); return 0; }
    const slots = [];
    this.bag.forEach((s, i) => { if (itemsMatch(s, it)) slots.push(i); });
    slots.sort((x, y) => plusOf(this.bag[y]) - plusOf(this.bag[x]));
    const k = Math.min(n || 1, Math.floor(slots.length / 2));
    if (k <= 0) { this.toastMsg('ไม่พบไอเทมที่เหมือนกันสำหรับรวม'); return 0; }
    mergeGroup(this.bag, slots, k);
    const best = this.bag[slots[0]];
    this.toastMsg('รวมสำเร็จ ' + k + ' ครั้ง ได้ ' + itemLabel(best) + ' x' + k);
    sv(this);
    return k;
  };

  // ---- รวมจากช่องที่ติ๊กไว้ ----
  P.mergeIndices = function (list, dryRun) {
    let made = 0;
    groupByMatch(this.bag, list).forEach(g => {
      if ((this.bag[g[0]].star || 0) >= starCap()) return;
      const pairs = Math.floor(g.length / 2);
      if (pairs <= 0) return;
      made += pairs;
      if (!dryRun) mergeGroup(this.bag, g, pairs);
    });
    if (!dryRun) {
      this.toastMsg(made > 0 ? 'รวมสำเร็จ ' + made + ' ครั้ง' : 'ในที่ติ๊กไม่มีคู่ที่รวมกันได้');
      if (made > 0) sv(this);
    }
    return made;
  };
})();
