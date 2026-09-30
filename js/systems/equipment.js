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
