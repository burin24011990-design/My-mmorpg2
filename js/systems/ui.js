// ===== UI หลัก: ปุ่ม, HUD, มินิแมป, toast =====
Object.assign(Main.prototype, {
  roundRect(depth, x, y, w, h, color, alpha, radius) {
    const gfx = this.add.graphics().setScrollFactor(0).setDepth(depth);
    gfx.fillStyle(color, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
    return gfx;
  },

  makeCircleBtn(x, y, r, color, label, onClick) {
    const c = this.add.circle(x, y, r, color, 0.88).setScrollFactor(0).setDepth(100).setInteractive();
    c.setStrokeStyle(3, 0xffffff, 0.85);
    const t = this.add.text(x, y, label, { fontSize: '13px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    c.on('pointerdown', onClick);
    return { c, t };
  },

  makeSlotBtn(x, y, r, idx) {
    const c = this.add.circle(x, y, r, 0x3a3a3a, 0.8).setScrollFactor(0).setDepth(100).setInteractive();
    c.setStrokeStyle(2, 0xffffff, 0.6);
    const icon = this.add.image(x, y - 4, 'ic_melee').setDisplaySize(20, 20).setScrollFactor(0).setDepth(101).setVisible(false);
    const t = this.add.text(x, y + 15, '', { fontSize: '9px', color: '#fff', align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    const cdText = this.add.text(x, y, '', { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
    let heldTimer = null, longPressed = false;
    c.on('pointerdown', () => {
      if (this.panel) return;
      if (!this.slots[idx]) { this.openSkillBook(idx); return; }
      longPressed = false;
      heldTimer = this.time.delayedCall(500, () => {
        longPressed = true;
        this.slots[idx] = null; this.computeCombo(); this.toastMsg('ถอดสกิลช่อง ' + (idx + 1));
      });
    });
    c.on('pointerup', () => { if (heldTimer) heldTimer.remove(); if (!longPressed && this.slots[idx]) this.useSkill(idx); });
    return { c, t, icon, cdText, idx };
  },

  makeUltiBtn(x, y, r) {
    const c = this.add.circle(x, y, r, 0xd4af37, 0.9).setScrollFactor(0).setDepth(100).setInteractive().setVisible(false);
    c.setStrokeStyle(3, 0xfff3c4, 0.95);
    const t = this.add.text(x, y, 'ULTI', { fontSize: '12px', color: '#3a2a00', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);
    c.on('pointerdown', () => this.useUlti());
    return { c, t };
  },

  makePillBtn(rightX, y, w, h, label, color, onClick) {
    const x = rightX - w / 2;
    const gfx = this.roundRect(100, x, y + h / 2, w, h, color, 0.85, 10);
    gfx.lineStyle(2, 0xffffff, 0.4).strokeRoundedRect(x - w / 2, y, w, h, 10);
    const zone = this.add.zone(x, y + h / 2, w, h).setScrollFactor(0).setDepth(101).setInteractive();
    const t = this.add.text(x, y + h / 2, label, { fontSize: '12px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
    zone.on('pointerdown', onClick);
    return { gfx, zone, t };
  },

  toastMsg(msg) {
    this.toast.setText(msg).setAlpha(1);
    this.tweens.add({ targets: this.toast, alpha: 0, duration: 1800, delay: 700 });
  },

  setupButtons() {
    const atkX = W - 72, atkY = H - 100;
    this.attackBtn = this.makeCircleBtn(atkX, atkY, 48, 0xcf3d3d, 'โจมตี', () => this.useBasicAttack());
    const arc = [{ dx: -108, dy: 15 }, { dx: -170, dy: -32 }, { dx: -182, dy: -100 }, { dx: -142, dy: -155 }];
    this.slotBtns = arc.map((pos, i) => this.makeSlotBtn(atkX + pos.dx, atkY + pos.dy, 27, i));
    this.ultiBtn = this.makeUltiBtn(atkX - 230, atkY - 125, 38);

    this.bagBtn = this.makePillBtn(W - 12, 16, 120, 32, '🎒 กระเป๋า', 0x2a4a2a, () => this.openInventory('bag'));
    this.bookBtn = this.makePillBtn(W - 12, 54, 120, 32, '📜 สกิล', 0x2a2a4a, () => this.openSkillBook());
    this.autoBtn = this.makePillBtn(W - 12, 92, 120, 32, 'บอท: ปิด', 0x4a3a2a, () => this.toggleAuto());
    this.equipBtn = this.makePillBtn(W - 12, 130, 120, 32, '🛡 อุปกรณ์', 0x2a2a5a, () => this.openInventory('equip'));
    this.stageBtn = this.makePillBtn(W - 12, 168, 120, 32, '🗺 เลือกด่าน', 0x2a4a5a, () => this.openStageSelect());
    this.statusBtn = this.makePillBtn(W - 12, 206, 120, 32, '📊 สเตตัส', 0x3a2a4a, () => this.openStatusPanel());
  },

  setupHud() {
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.hudNameText = this.add.text(16, 12, 'Lv.1', { fontSize: '14px', color: '#ffe066', fontStyle: 'bold' }).setScrollFactor(0).setDepth(101);
    this.hudText = this.add.text(16, 68, '', { fontSize: '12px', color: '#dddddd' }).setScrollFactor(0).setDepth(101);
    this.targetNameText = this.add.text(W / 2, 16, '', { fontSize: '13px', color: '#ffe066' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
    this.toast = this.add.text(W / 2, 100, '', { fontSize: '15px', color: '#ffe066' }).setOrigin(0.5).setScrollFactor(0).setDepth(300);

    this.mini = { x: 16, y: 114, w: 190, h: Math.round(190 * (WORLD_H / WORLD_W)) };
    this.miniBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.stageText = this.add.text(this.mini.x, this.mini.y + this.mini.h + 10, '', { fontSize: '12px', color: '#9fd98a', fontStyle: 'bold' }).setScrollFactor(0).setDepth(101);
    this.miniDots = this.add.graphics().setScrollFactor(0).setDepth(101);
  },

  drawMinimapFrame() {
    const m = this.mini, z = ZONES[this.stageIdx];
    this.miniBg.clear();
    this.miniBg.fillStyle(0x000000, 0.55).fillRoundedRect(m.x - 4, m.y - 4, m.w + 8, m.h + 8, 8);
    this.miniBg.lineStyle(1, 0x5a7a3a, 0.8).strokeRect(m.x, m.y, m.w, m.h);
    this.stageText.setText(z.name + '  (Lv.' + z.minLv + '-' + z.maxLv + ')');
  },

  updateSkillButtons(time) {
    const attackLeft = Math.max(0, (this.cdEnd.basic || 0) - time);
    this.attackBtn.c.setAlpha(attackLeft > 0 ? 0.4 : 0.9);
    this.slots.forEach((sid, i) => {
      const b = this.slotBtns[i];
      if (!sid) { b.t.setText(''); b.cdText.setText('+'); b.icon.setVisible(false); b.c.setFillStyle(0x3a3a3a, 0.5); return; }
      const def = SKILL_DEFS[sid];
      const left = Math.max(0, (this.cdEnd['slot' + i] || 0) - time);
      const noMana = this.stats.mp < def.mp;
      b.c.setFillStyle(CLASSES[def.class].color, (left > 0 || noMana) ? 0.3 : 0.85);
      b.icon.setTexture(skillIconKey(def.type)).setTint(0xffffff).setVisible(true);
      b.t.setText(def.name);
      b.cdText.setText(left > 0 ? (left / 1000).toFixed(1) : '');
    });
    if (this.ultiClass) {
      const left = Math.max(0, (this.cdEnd.ulti || 0) - time);
      this.ultiBtn.c.setAlpha(left > 0 ? 0.35 : 0.95);
    }
  },

  updateHud() {
    const p = this.player;
    this.miniDots.clear();
    const mx = this.mini.x + (p.x / WORLD_W) * this.mini.w, my = this.mini.y + (p.y / WORLD_H) * this.mini.h;
    this.enemies.getChildren().forEach(e => {
      if (e.isPvp) return;   // PvP: ไม่แสดงฝั่งตรงข้ามบนแผนที่ย่อ
      const ex = this.mini.x + (e.x / WORLD_W) * this.mini.w, ey = this.mini.y + (e.y / WORLD_H) * this.mini.h;
      const col = e.isBoss ? 0xb35ae0 : (e.ranged ? 0xe0883a : 0xe05a5a);
      this.miniDots.fillStyle(col, 0.95).fillCircle(ex, ey, e.isBoss ? 4 : 2);
    });
    this.miniDots.fillStyle(0xffe066, 1).fillCircle(mx, my, 3.5);

    const hpR = Phaser.Math.Clamp(this.stats.hp / this.maxHp(), 0, 1);
    this.hud.clear();
    this.hud.fillStyle(0x000000, 0.55).fillRoundedRect(10, 6, 230, 92, 10);
    this.hud.fillStyle(0x000000, 0.6).fillRoundedRect(18, 30, 180, 12, 6);
    this.hud.fillStyle(0xe03c3c).fillRoundedRect(19, 31, 178 * hpR, 10, 5);
    this.hud.fillStyle(0x000000, 0.6).fillRoundedRect(18, 46, 180, 8, 4);
    this.hud.fillStyle(0x3ca7e0).fillRoundedRect(19, 47, 176 * (this.stats.exp / this.stats.expNext), 6, 3);
    this.hud.fillStyle(0x000000, 0.6).fillRoundedRect(18, 58, 180, 10, 5);
    this.hud.fillStyle(0x9a5ae0).fillRoundedRect(19, 59, 178 * (this.stats.mp / this.maxMp()), 8, 4);
    this.hudNameText.setText('Lv.' + this.stats.level);
    this.hudText.setText('ทอง: ' + this.stats.gold + '   ฆ่าแล้ว: ' + this.kills);
  },
});
