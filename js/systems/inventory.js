// ===== กระเป๋า / เก็บของ / รวมดาว =====
Object.assign(Main.prototype, {
  findEmptyBagSlot() { return this.bag.findIndex(s => s === null); },

  addItemToBag(item) {
    const idx = this.findEmptyBagSlot();
    if (idx === -1) { this.stats.gold += 8; this.toastMsg('กระเป๋าเต็ม! แลกเป็น +8 ทองแทน'); return -1; }
    this.bag[idx] = item; return idx;
  },

  addEquipItemToBag(item) {
    const matchIdx = this.bag.findIndex(s => itemsMatch(s, item));
    if (matchIdx !== -1) {
      this.bag[matchIdx] = null;
      item = { ...item, star: Math.min(MAX_STAR, item.star + 1) };
      this.addItemToBag(item);
      this.toastMsg('รวมไอเทมสำเร็จ! ได้ ' + itemLabel(item));
    } else {
      this.addItemToBag(item);
      this.toastMsg('ได้รับ: ' + itemLabel(item));
    }
  },

  pickup(item) {
    const kind = item.getData('kind');
    if (kind === 'gold') {
      this.stats.gold += item.getData('amount');
      this.toastMsg('+' + item.getData('amount') + ' ทอง');
    } else if (kind === 'box') {
      const lvl = item.getData('level');
      const stack = this.bag.find(s => s && s.kind === 'box' && s.level === lvl && s.count < MAX_BOX_STACK);
      if (stack) { stack.count++; this.toastMsg('กล่องอุปกรณ์ เลเวล ' + lvl + '  x' + stack.count); }
      else { this.addItemToBag({ kind: 'box', level: lvl, count: 1 }); this.toastMsg('ได้รับกล่องอุปกรณ์ เลเวล ' + lvl); }
    } else if (kind === 'skill') {
      const sid = item.getData('sid'); const sd = SKILL_DEFS[sid];
      if (this.learnedSkills.has(sid)) { this.stats.gold += 5; this.toastMsg('สกิลซ้ำ แลกเป็น +5 ทอง'); }
      else { this.learnedSkills.add(sid); this.toastMsg('เรียนรู้สกิลใหม่: ' + sd.name); }
    }
    item.destroy();
  },

  mergeSingleItem(idx) {
    const item = this.bag[idx];
    if (!item || item.kind !== 'equip') return false;
    const j = this.bag.findIndex((s, k) => k !== idx && itemsMatch(s, item));
    if (j === -1) { this.toastMsg('ไม่พบไอเทมที่เหมือนกันสำหรับรวม'); return false; }
    this.bag[idx] = { ...item, star: Math.min(MAX_STAR, item.star + 1) };
    this.bag[j] = null;
    this.toastMsg('รวมดาวสำเร็จ! ได้ ' + itemLabel(this.bag[idx]));
    return true;
  },

  mergeAllInBag() {
    let merges = 0, changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < this.bag.length; i++) {
        if (!this.bag[i] || this.bag[i].kind !== 'equip') continue;
        for (let j = i + 1; j < this.bag.length; j++) {
          if (itemsMatch(this.bag[i], this.bag[j])) {
            this.bag[i] = { ...this.bag[i], star: Math.min(MAX_STAR, this.bag[i].star + 1) };
            this.bag[j] = null;
            merges++; changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }
    return merges;
  },
});
