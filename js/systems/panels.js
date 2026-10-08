// ===== แผงเมนูทั่วไป: กรอบ, สเตตัส, เลือกด่าน, สมุดสกิล =====
const STAGES_PER_PAGE = 9;   // เลือกด่าน: ต่อหน้ากี่ด่าน (3 x 3)

Object.assign(Main.prototype, {
  closePanel() { if (this.panel) { this.panel.forEach(o => o.destroy()); this.panel = null; } this.closeSub(); },
  closeSub() { if (this.subPanel) { this.subPanel.forEach(o => o.destroy()); this.subPanel = null; } },

  panelFrame(title) {
    const items = [];
    items.push(this.roundRect(200, W / 2, H / 2, 560, 420, 0x14161a, 0.95, 16));
    items.push(this.add.graphics().setScrollFactor(0).setDepth(200).lineStyle(2, 0x444a55, 1).strokeRoundedRect(W / 2 - 280, H / 2 - 210, 560, 420, 16));
    items.push(this.add.text(W / 2, H / 2 - 192, title, { fontSize: '15px', color: '#ffe066', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(201));
    const closeZone = this.add.zone(W / 2 + 260, H / 2 - 192, 30, 30).setScrollFactor(0).setDepth(202).setInteractive();
    const closeText = this.add.text(W / 2 + 260, H / 2 - 192, '✕', { fontSize: '16px', color: '#ff8888' }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    closeZone.on('pointerdown', () => this.closePanel());
    items.push(closeZone, closeText);
    return items;
  },

  tabBtn(x, y, label, active, onClick) {
    const items = [];
    const w = 100, h = 28;
    items.push(this.roundRect(201, x, y, w, h, active ? 0x3a5a3a : 0x24262b, 0.95, 8));
    const zone = this.add.zone(x, y, w, h).setScrollFactor(0).setDepth(202).setInteractive();
    const t = this.add.text(x, y, label, { fontSize: '12px', color: active ? '#c6ffc6' : '#aaaaaa' }).setOrigin(0.5).setScrollFactor(0).setDepth(203);
    zone.on('pointerdown', onClick);
    items.push(zone, t);
    return items;
  },

  openStatusPanel() {
    this.closePanel();
    const items = this.panelFrame('สถานะตัวละคร');
    const rows = [
      ['เลเวล', this.stats.level + ' / ' + LEVEL_CAP],
      ['ค่าประสบการณ์ (EXP)', Math.floor(this.stats.exp) + ' / ' + this.stats.expNext],
      ['พลังชีวิต (HP)', Math.max(0, Math.floor(this.stats.hp)) + ' / ' + this.maxHp()],
      ['มานา (MP)', Math.floor(this.stats.mp) + ' / ' + this.maxMp()],
      ['พลังโจมตี (ATK)', String(this.atk)],
      ['ค่าป้องกัน (DEF)', String(this.equipDefBonus)],
      ['ทองที่มี', String(this.stats.gold)],
      ['จำนวนมอนที่ฆ่าแล้ว', String(this.kills)],
      ['อาชีพปัจจุบัน', CLASSES[this.currentClass()].label],
    ];
    let y = H / 2 - 130;
    rows.forEach(r => {
      items.push(this.roundRect(201, W / 2, y, 460, 30, 0x24262b, 0.9, 6));
      items.push(this.add.text(W / 2 - 210, y, r[0], { fontSize: '12px', color: '#aaa' }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(202));
      items.push(this.add.text(W / 2 + 210, y, r[1], { fontSize: '13px', color: '#ffe066', fontStyle: 'bold' }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(202));
      y += 34;
    });
    this.panel = items;
  },

  // เลือกด่าน: แบ่งหน้า หน้าละ 9 ด่าน (หน้า 1 = ด่านปกติ, หน้าถัดไป = ด่านจุติ)
  // page = เลขหน้า (ไม่ใส่ = หน้า 1 เสมอ)
  openStageSelect(page) {
    this.closePanel();
    const pages = Math.max(1, Math.ceil(ZONES.length / STAGES_PER_PAGE));
    if (typeof page !== 'number') page = 0;   // แก้: เปิดครั้งแรกเริ่มหน้า 1 เสมอ
    page = Phaser.Math.Clamp(page, 0, pages - 1);

    const items = this.panelFrame('เลือกด่าน (ต้องเลเวล/ขั้นจุติถึงเกณฑ์ถึงจะไปได้)');
    const cols = 3, cellW = 160, cellH = 100;
    const gx0 = W / 2 - (cols * cellW) / 2 + cellW / 2, gy0 = H / 2 - 112;
    const start = page * STAGES_PER_PAGE;
    ZONES.slice(start, start + STAGES_PER_PAGE).forEach((z, k) => {
      const i = start + k;
      const col = k % cols, row = Math.floor(k / cols);
      const x = gx0 + col * cellW, y = gy0 + row * cellH;
      const unlocked = this.stats.level >= z.reqLv;
      const need = z.reqRebirth ? 'ต้องจุติขั้น ' + z.reqRebirth : 'ต้องการ Lv.' + z.reqLv;
      items.push(this.roundRect(201, x, y, cellW - 14, 86, unlocked ? (z.reqRebirth ? 0x3a2a4a : 0x24402a) : 0x2a2424, 0.95, 10));
      const zone = this.add.zone(x, y, cellW - 14, 86).setScrollFactor(0).setDepth(202).setInteractive();
      items.push(zone);
      items.push(this.add.text(x, y - 24, z.name, { fontSize: '13px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
      items.push(this.add.text(x, y - 3, 'มอนสเตอร์ Lv.' + z.minLv + '-' + z.maxLv, { fontSize: '11px', color: '#bbb' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
      items.push(this.add.text(x, y + 18, unlocked ? (i === this.stageIdx ? 'อยู่ที่นี่' : 'แตะเพื่อเดินทาง') : need, { fontSize: '11px', color: unlocked ? '#9adf9a' : '#e08a8a' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
      zone.on('pointerdown', () => {
        if (!unlocked) { this.toastMsg('ยังเข้าไม่ได้! ' + need); return; }
        this.closePanel();
        if (i === this.stageIdx) { this.toastMsg('คุณอยู่ที่ ' + z.name + ' แล้ว'); return; }
        this.loadStage(i);
        this.toastMsg('เดินทางไปยัง ' + z.name);
      });
    });

    // ปุ่มเปลี่ยนหน้า
    if (pages > 1) {
      const py = H / 2 + 178;
      const arrow = (x, label, to) => {
        const on = to >= 0 && to < pages;
        items.push(this.roundRect(201, x, py, 70, 30, on ? 0x3a5a3a : 0x24262b, 0.95, 8));
        items.push(this.add.text(x, py, label, { fontSize: '16px', color: on ? '#c6ffc6' : '#555' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
        if (on) {
          const zn = this.add.zone(x, py, 70, 30).setScrollFactor(0).setDepth(204).setInteractive();
          zn.on('pointerdown', () => this.openStageSelect(to));
          items.push(zn);
        }
      };
      arrow(W / 2 - 110, '◀', page - 1);
      arrow(W / 2 + 110, '▶', page + 1);
      const lab = page === 0 ? 'ด่านปกติ' : 'ด่านจุติ';
      items.push(this.add.text(W / 2, py, lab + '  (หน้า ' + (page + 1) + '/' + pages + ')', { fontSize: '13px', color: '#ffe066' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
    }
    this.panel = items;
  },

  openSkillBook(targetSlot) {
    this.closePanel();
    const items = this.panelFrame(targetSlot !== undefined ? 'เลือกสกิลใส่ช่อง ' + (targetSlot + 1) : 'สกิลที่เรียนรู้แล้ว');
    let row = 0;
    [...this.learnedSkills].forEach(sid => {
      const sd = SKILL_DEFS[sid];
      const y = H / 2 - 140 + row * 30;
      items.push(this.roundRect(201, W / 2, y, 480, 26, 0x24262b, 0.95, 6));
      const zone = this.add.zone(W / 2, y, 480, 26).setScrollFactor(0).setDepth(202).setInteractive();
      items.push(this.add.text(W / 2, y, sd.name + '  (' + CLASSES[sd.class].label + ')  dmg ' + sd.dmg + '  มานา ' + sd.mp, { fontSize: '12px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
      zone.on('pointerdown', () => {
        if (targetSlot !== undefined) { this.slots[targetSlot] = sid; this.computeCombo(); this.closePanel(); }
        else this.openSkillBook(0);
      });
      items.push(zone); row++;
    });
    if (row === 0) items.push(this.add.text(W / 2, H / 2 - 60, '(ยังไม่มีสกิล ลองเก็บม้วนสกิลจากมอนสเตอร์)', { fontSize: '12px', color: '#999' }).setOrigin(0.5).setScrollFactor(0).setDepth(202));
    this.panel = items;
  },
});
