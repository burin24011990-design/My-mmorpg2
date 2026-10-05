// ===== จำกัดเลเวลอุปกรณ์ =====
// 1) สวมของที่เลเวลสูงกว่าตัวละครไม่ได้
// 2) จุติแล้วเลเวลกลับเป็น 1 -> ถอดอุปกรณ์ที่เลเวลเกินกลับเข้ากระเป๋าทั้งหมด
// 3) เซฟเก่าที่ใส่ของเกินเลเวลอยู่ จะถูกถอดตอนโหลดเกม
// โหลดหลัง rebirth.js และก่อน main.js (ไม่ต้องแก้ไฟล์เดิม)
(function () {
  const P = Main.prototype;
  const SLOTS = (typeof EQUIP_SLOT_KEYS !== 'undefined') ? EQUIP_SLOT_KEYS
    : ['weapon', 'helmet', 'armor', 'gloves', 'shoes', 'ring1', 'ring2', 'necklace'];

  const playerLv = sc => Math.max(1, Math.floor((sc.stats && sc.stats.level) || 1));
  const tooHigh = (sc, it) => !!(it && it.kind === 'equip' && (it.level || 1) > playerLv(sc));
  const toast = (sc, msg) => { try { if (sc.toastMsg) sc.toastMsg(msg); } catch (e) { /* ignore */ } };

  // ---- สวมใส่: เลเวลไม่ถึงให้ปฏิเสธ ----
  const _equipItem = P.equipItem;
  P.equipItem = function (slotKey, item) {
    if (tooHigh(this, item)) {
      toast(this, 'ต้องการเลเวล ' + item.level + ' ถึงจะสวมได้');
      // กันของหาย: ถ้าฝั่งเรียกหยิบของออกจากกระเป๋าไปแล้ว ให้คืนกลับช่องว่าง
      if (this.bag && this.bag.indexOf(item) === -1) {
        const i = this.findEmptyBagSlot();
        if (i !== -1) this.bag[i] = item;
      }
      return false;
    }
    return _equipItem.apply(this, arguments);
  };

  // ---- ถอดทุกชิ้นที่เลเวลเกิน (คืนจำนวนที่ถอดได้) ----
  P.enforceEquipLevels = function () {
    if (!this.equipment || !this.bag || !this.stats) return 0;
    let n = 0, stuck = 0;
    SLOTS.forEach(k => {
      const it = this.equipment[k];
      if (!tooHigh(this, it)) return;
      const i = this.findEmptyBagSlot();
      if (i === -1) { stuck++; return; }     // กระเป๋าเต็ม: ยังไม่ถอด (ไม่ให้ของหาย) จะลองใหม่ตอนเปลี่ยนด่าน/โหลดเกม
      this.bag[i] = it; this.equipment[k] = null; n++;
    });
    if (n > 0) {
      this.computeAtk();
      if (this.maxHp && this.stats.hp > this.maxHp()) this.stats.hp = this.maxHp();
      if (this.maxMp && this.stats.mp > this.maxMp()) this.stats.mp = this.maxMp();
      toast(this, 'ถอดอุปกรณ์ที่เลเวลไม่ถึง ' + n + ' ชิ้น');
      if (this.saveSoon) this.saveSoon();
    }
    if (stuck > 0) toast(this, 'กระเป๋าเต็ม! ถอดอุปกรณ์เกินเลเวลไม่ได้ ' + stuck + ' ชิ้น');
    return n;
  };

  // ---- จุติ: เช็กช่องว่างก่อน (ไม่งั้นของหาย) แล้วถอดทั้งหมดหลังจุติสำเร็จ ----
  const _doRebirth = P.doRebirth;
  if (typeof _doRebirth === 'function') {
    P.doRebirth = function () {
      const need = SLOTS.filter(k => this.equipment && this.equipment[k] && (this.equipment[k].level || 1) > 1).length;
      const free = this.bag ? this.bag.filter(s => s === null).length : 0;
      if (free < need) {
        toast(this, 'กระเป๋าต้องว่างอย่างน้อย ' + need + ' ช่อง เพื่อถอดอุปกรณ์ก่อนจุติ');
        return false;
      }
      const ok = _doRebirth.apply(this, arguments);
      if (ok) {
        this.enforceEquipLevels();
        toast(this, 'จุติแล้ว อุปกรณ์ถูกถอดเก็บในกระเป๋า สวมใหม่ตามเลเวล');
      }
      return ok;
    };
  }

  // ---- โหลดเซฟเก่า / เปลี่ยนด่าน: ตรวจซ้ำ ----
  const _loadGame = P.loadGame;
  if (typeof _loadGame === 'function') {
    P.loadGame = function () {
      const res = _loadGame.apply(this, arguments);
      try { this.enforceEquipLevels(); } catch (e) { console.warn('[equipLevel]', e); }
      return res;
    };
  }
  const _loadStage = P.loadStage;
  if (typeof _loadStage === 'function') {
    P.loadStage = function () {
      const r = _loadStage.apply(this, arguments);
      try { this.enforceEquipLevels(); } catch (e) { console.warn('[equipLevel]', e); }
      return r;
    };
  }
})();
