// ===== กระเป๋า / เก็บของ / รวมดาว / หนังสือสกิล =====
const MAX_SKILLBOOK_STACK = 999; // หนังสือสกิลซ้อนได้สูงสุดต่อช่อง

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

  // ---------- หนังสือสกิล (ไอเทมซ้อนได้) ----------
  // ใส่หนังสือ n เล่มลงกระเป๋า คืนค่าจำนวนที่ใส่ไม่ได้ (0 = ใส่ครบ)
  addSkillBookToBag(sid, n) {
    let left = n || 1;
    this.bag.forEach(s => {
      if (left > 0 && s && s.kind === 'skillbook' && s.sid === sid && s.count < MAX_SKILLBOOK_STACK) {
        const add = Math.min(left, MAX_SKILLBOOK_STACK - s.count);
        s.count += add; left -= add;
      }
    });
    while (left > 0) {
      const idx = this.findEmptyBagSlot();
      if (idx === -1) break;
      const add = Math.min(left, MAX_SKILLBOOK_STACK);
      this.bag[idx] = { kind: 'skillbook', sid, count: add };
      left -= add;
    }
    return left;
  },

  // จำนวนหนังสือสกิลนั้นทั้งหมดในกระเป๋า (รวมทุกกอง)
  countSkillBooks(sid) {
    let n = 0;
    this.bag.forEach(s => { if (s && s.kind === 'skillbook' && s.sid === sid) n += s.count; });
    return n;
  },

  // หักหนังสือ n เล่ม (เริ่มจากช่อง preferIdx ก่อน) คืน true ถ้าหักครบ
  consumeSkillBooks(sid, n, preferIdx) {
    if (this.countSkillBooks(sid) < n) return false;
    const order = [];
    if (preferIdx !== undefined) order.push(preferIdx);
    for (let i = 0; i < this.bag.length; i++) if (i !== preferIdx) order.push(i);
    for (const i of order) {
      if (n <= 0) break;
      const s = this.bag[i];
      if (!s || s.kind !== 'skillbook' || s.sid !== sid) continue;
      const take = Math.min(n, s.count);
      s.count -= take; n -= take;
      if (s.count <= 0) this.bag[i] = null;
    }
    return true;
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
      if (this.addSkillBookToBag(sid, 1) > 0) {
        // กระเป๋าเต็ม: ปล่อยหนังสือไว้บนพื้น (เตือนไม่ถี่เกินไป)
        if (this.time.now > (this._bookFullToastAt || 0)) {
          this._bookFullToastAt = this.time.now + 1500;
          this.toastMsg('กระเป๋าเต็ม! เก็บหนังสือ ' + sd.name + ' ไม่ได้');
        }
        return;
      }
      this.toastMsg('📕 ได้รับหนังสือสกิล: ' + sd.name + ' (มี ' + this.countSkillBooks(sid) + ' เล่ม)');
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
