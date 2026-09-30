// ===== แผงกระเป๋า / อุปกรณ์ / รายละเอียดไอเทม =====
Object.assign(Main.prototype, {
  // แผงรายละเอียดไอเทมสไตล์ RO: กรอบไอคอนสีตามเรทของไอเทม + แถบค่าพลัง + ตารางคุณสมบัติ
  renderItemDetail(items, item, cx, topY) {
    const color = rarityColor(item);
    const iconX = cx - 118, iconY = topY + 54;
    items.push(this.roundRect(251, iconX, iconY, 88, 88, 0x0e1014, 0.9, 10));
    items.push(this.add.graphics().setScrollFactor(0).setDepth(251).lineStyle(3, color, 1).strokeRoundedRect(iconX - 44, iconY - 44, 88, 88, 10));
    items.push(this.add.image(iconX, iconY, iconKeyForItem(item)).setDisplaySize(58, 58).setScrollFactor(0).setDepth(252));

    const nameX = cx - 56;
    items.push(this.add.text(nameX, iconY - 20, itemLabel(item), { fontSize: '15px', color: '#fff', fontStyle: 'bold', wordWrap: { width: 230 } }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(252));
    const typeLabel = item.kind === 'box' ? 'กล่องอุปกรณ์' : (item.baseSlot === 'weapon' ? 'อาวุธ (' + CLASSES[item.class].label + ')' : SLOT_LABELS[item.baseSlot]);
    items.push(this.add.text(nameX, iconY + 6, typeLabel, { fontSize: '11px', color: '#' + color.toString(16).padStart(6, '0') }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(252));

    let y = topY + 116;
    if (item.kind === 'equip') {
      const s = computeItemStats(item);
      const parts = Object.keys(s).map(k => k.toUpperCase() + ' +' + s[k]);
      const statStr = parts.length ? parts.join('   ·   ') : 'ไม่มีค่าพลังพิเศษ';
      items.push(this.roundRect(251, cx, y, 340, 40, 0x18314e, 0.9, 8));
      items.push(this.add.text(cx, y, statStr, { fontSize: '12px', color: '#bfe3ff', wordWrap: { width: 320 } }).setOrigin(0.5).setScrollFactor(0).setDepth(252));
      y += 36;
    } else {
      items.push(this.add.text(cx, y, 'เปิดแล้วจะได้อุปกรณ์สุ่ม 1 ชิ้น (เลเวล ' + item.level + ')', { fontSize: '12px', color: '#bbb' }).setOrigin(0.5).setScrollFactor(0).setDepth(252));
      y += 22;
    }

    const rows = item.kind === 'equip'
      ? [['ระดับ', 'Lv.' + item.level], ['ระดับดาว', item.star > 0 ? item.star + ' ★ / ' + MAX_STAR : '- (ยังไม่อัพดาว)'], ['อัพดาว', 'รวมของเหมือนกัน 2 ชิ้น']]
      : [['เลเวลกล่อง', 'Lv.' + item.level], ['จำนวนคงเหลือ', 'x' + (item.count || 1)]];
    let ry = y + 16;
    rows.forEach(r => {
      items.push(this.add.text(cx - 165, ry, r[0], { fontSize: '11px', color: '#999' }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(252));
      items.push(this.add.text(cx + 165, ry, r[1], { fontSize: '11px', color: '#fff' }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(252));
      ry += 19;
    });
    return ry + 6;
  },

  // สร้างกรอบ popup + ปุ่มปิด ใช้ร่วมกันระหว่างป๊อปอัพไอเทมและอุปกรณ์
  popupFrame(title) {
    const items = [];
    items.push(this.roundRect(250, W / 2, H / 2, 380, 340, 0x1c1f24, 0.98, 14));
    items.push(this.add.graphics().setScrollFactor(0).setDepth(250).lineStyle(2, 0xffe066, 0.5).strokeRoundedRect(W / 2 - 190, H / 2 - 170, 380, 340, 14));
    items.push(this.add.text(W / 2, H / 2 - 155, title, { fontSize: '13px', color: '#ffe066', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(251));
    return items;
  },

  popupCloseBtn(items) {
    const noY = H / 2 + 150;
    const noZone = this.add.zone(W / 2, noY, 130, 24).setScrollFactor(0).setDepth(252).setInteractive();
    items.push(this.add.text(W / 2, noY, 'ปิด', { fontSize: '12px', color: '#ffcccc' }).setOrigin(0.5).setScrollFactor(0).setDepth(253));
    noZone.on('pointerdown', () => this.closeSub());
    items.push(noZone);
  },

  popupBtn(items, x, y, w, h, bg, label, textColor, fontSize, onClick) {
    items.push(this.roundRect(251, x, y, w, h, bg, 0.95, 8));
    const z = this.add.zone(x, y, w, h).setScrollFactor(0).setDepth(252).setInteractive();
    items.push(this.add.text(x, y, label, { fontSize, color: textColor }).setOrigin(0.5).setScrollFactor(0).setDepth(253));
    z.on('pointerdown', onClick);
    items.push(z);
  },

  openItemConfirm(idx, item) {
    this.closeSub();
    const items = this.popupFrame('รายละเอียดไอเทม');
    let btnY = this.renderItemDetail(items, item, W / 2, H / 2 - 155 + 18);
    const refresh = () => { this.closeSub(); this.openInventory('bag', this.invPage); };
    const wear = (slotKey) => () => { this.bag[idx] = null; this.equipItem(slotKey, item); this.toastMsg('สวมใส่: ' + itemLabel(item)); refresh(); };
    const merge = () => { if (this.mergeSingleItem(idx)) refresh(); };

    if (item.kind === 'box') {
      this.popupBtn(items, W / 2, btnY, 140, 32, 0x2a5a2a, 'เปิดกล่อง', '#c6ffc6', '13px', () => {
        item.count -= 1;
        if (item.count <= 0) this.bag[idx] = null;
        this.addEquipItemToBag(randomEquipItem(item.level));
        refresh();
      });
    } else if (item.baseSlot === 'ring') {
      this.popupBtn(items, W / 2 - 90, btnY, 120, 30, 0x2a5a2a, 'ใส่แหวนซ้าย', '#c6ffc6', '11px', wear('ring1'));
      this.popupBtn(items, W / 2 + 90, btnY, 120, 30, 0x2a5a2a, 'ใส่แหวนขวา', '#c6ffc6', '11px', wear('ring2'));
      btnY += 36;
      this.popupBtn(items, W / 2, btnY, 140, 28, 0x2a3a5a, '🔗 รวมดาว', '#bcd6ff', '11px', merge);
    } else {
      this.popupBtn(items, W / 2 - 78, btnY, 140, 30, 0x2a5a2a, 'สวมใส่', '#c6ffc6', '12px', wear(item.baseSlot));
      this.popupBtn(items, W / 2 + 78, btnY, 140, 30, 0x2a3a5a, '🔗 รวมดาว', '#bcd6ff', '11px', merge);
    }
    this.popupCloseBtn(items);
    this.subPanel = items;
  },

  openEquipPopup(slotKey) {
    this.closeSub();
    const it = this.equipment[slotKey];
    const items = this.popupFrame('รายละเอียดอุปกรณ์');
    if (!it) {
      items.push(this.add.text(W / 2, H / 2, 'ช่อง ' + SLOT_LABELS[baseSlotOf(slotKey)] + ' ยังว่างอยู่', { fontSize: '13px', color: '#999' }).setOrigin(0.5).setScrollFactor(0).setDepth(251));
    } else {
      const btnY = this.renderItemDetail(items, it, W / 2, H / 2 - 155 + 18);
      this.popupBtn(items, W / 2, btnY, 140, 32, 0x5a2a2a, 'ถอดอุปกรณ์', '#ffcccc', '12px', () => { this.unequipSlot(slotKey); this.closeSub(); this.openInventory('equip'); });
    }
    this.popupCloseBtn(items);
    this.subPanel = items;
  },

  openInventory(tab, page) {
    this.invTab = tab || this.invTab || 'bag';
    this.invPage = page !== undefined ? page : (this.invPage || 0);
    this.closePanel();
    const items = this.panelFrame(this.invTab === 'bag' ? 'กระเป๋า (แตะไอเทมเพื่อดู/สวมใส่/เปิดกล่อง)' : 'อุปกรณ์ที่สวมใส่ (แตะเพื่อดูค่าพลัง/ถอด)');
    items.push(...this.tabBtn(W / 2 - 130, H / 2 - 155, 'กระเป๋า', this.invTab === 'bag', () => this.openInventory('bag', 0)));
    items.push(...this.tabBtn(W / 2, H / 2 - 155, 'อุปกรณ์', this.invTab === 'equip', () => this.openInventory('equip')));

    if (this.invTab === 'bag') this.buildBagGrid(items);
    else this.buildEquipGrid(items);
    this.panel = items;
  },

  buildBagGrid(items) {
    const cols = 10, cell = 34;
    const gx0 = W / 2 - (cols * cell) / 2 + cell / 2, gy0 = H / 2 - 108;
    for (let i = 0; i < PAGE_SIZE; i++) {
      const idx = this.invPage * PAGE_SIZE + i;
      const col = i % cols, row = Math.floor(i / cols);
      const x = gx0 + col * cell, y = gy0 + row * cell;
      const it = this.bag[idx];
      items.push(this.roundRect(201, x, y, cell - 4, cell - 4, it ? 0x232630 : 0x1b1d21, 1, 5));
      if (it) items.push(this.add.graphics().setScrollFactor(0).setDepth(201).lineStyle(2, rarityColor(it), 1).strokeRoundedRect(x - (cell - 4) / 2, y - (cell - 4) / 2, cell - 4, cell - 4, 5));
      const zone = this.add.zone(x, y, cell - 4, cell - 4).setScrollFactor(0).setDepth(203).setInteractive();
      items.push(zone);
      if (it) {
        items.push(this.add.image(x, y - 3, iconKeyForItem(it)).setDisplaySize(22, 22).setScrollFactor(0).setDepth(203));
        if (it.kind === 'equip') items.push(this.add.text(x, y + 12, 'Lv' + it.level + (it.star > 0 ? ' ' + it.star + '★' : ''), { fontSize: '7px', color: '#ffe066' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
        if (it.kind === 'box' && it.count > 1) items.push(this.add.text(x, y + 12, 'x' + it.count, { fontSize: '8px', color: '#ffe066' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
        zone.on('pointerdown', () => this.openItemConfirm(idx, it));
      }
    }
    const y2 = H / 2 + 140;
    items.push(...this.tabBtn(W / 2 - 90, y2, '◀ ก่อนหน้า', false, () => this.openInventory('bag', Math.max(0, this.invPage - 1))));
    items.push(this.add.text(W / 2, y2, 'หน้า ' + (this.invPage + 1) + ' / ' + PAGES, { fontSize: '12px', color: '#ccc' }).setOrigin(0.5).setScrollFactor(0).setDepth(202));
    items.push(...this.tabBtn(W / 2 + 90, y2, 'ถัดไป ▶', false, () => this.openInventory('bag', Math.min(PAGES - 1, this.invPage + 1))));
    items.push(...this.tabBtn(W / 2 + 210, H / 2 - 155, '🔗 รวมอุปกรณ์', false, () => {
      const n = this.mergeAllInBag();
      this.toastMsg(n > 0 ? 'รวมอุปกรณ์สำเร็จ ' + n + ' ครั้ง' : 'ไม่มีของที่รวมกันได้');
      this.openInventory('bag', this.invPage);
    }));
  },

  buildEquipGrid(items) {
    const cols = 4, cell = 100;
    const gx0 = W / 2 - (cols * cell) / 2 + cell / 2, gy0 = H / 2 - 110;
    const emptyIcons = { weapon: 'icon_sword', helmet: 'icon_helmet', armor: 'icon_armor', gloves: 'icon_gloves', shoes: 'icon_shoes', ring1: 'icon_ring', ring2: 'icon_ring', necklace: 'icon_necklace' };
    EQUIP_SLOT_KEYS.forEach((slotKey, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = gx0 + col * cell, y = gy0 + row * cell;
      const it = this.equipment[slotKey];
      items.push(this.roundRect(201, x, y, cell - 12, cell - 12, it ? 0x22262e : 0x1b1d21, 1, 8));
      if (it) items.push(this.add.graphics().setScrollFactor(0).setDepth(201).lineStyle(2, rarityColor(it), 1).strokeRoundedRect(x - (cell - 12) / 2, y - (cell - 12) / 2, cell - 12, cell - 12, 8));
      const zone = this.add.zone(x, y, cell - 12, cell - 12).setScrollFactor(0).setDepth(203).setInteractive();
      items.push(zone);
      const iconKey = it ? iconKeyForItem(it) : emptyIcons[slotKey];
      items.push(this.add.image(x, y - 12, iconKey).setDisplaySize(30, 30).setScrollFactor(0).setDepth(203).setAlpha(it ? 1 : 0.35));
      items.push(this.add.text(x, y + 14, SLOT_LABELS[baseSlotOf(slotKey)] + (slotKey === 'ring1' ? '(ซ้าย)' : slotKey === 'ring2' ? '(ขวา)' : ''), { fontSize: '9px', color: '#ccc' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
      if (it) items.push(this.add.text(x, y + 28, 'Lv' + it.level + (it.star > 0 ? ' ' + it.star + '★' : ''), { fontSize: '8px', color: '#ffe066' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
      zone.on('pointerdown', () => this.openEquipPopup(slotKey));
    });
  },
});
