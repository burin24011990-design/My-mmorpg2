// ===== ควบคุม: คีย์บอร์ด, จอยสติ๊ก, บอทออโต้ =====
Object.assign(Main.prototype, {
  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.input.keyboard.on('keydown-SPACE', () => this.useBasicAttack());
    this.input.keyboard.on('keydown-ONE', () => this.useSkill(0));
    this.input.keyboard.on('keydown-TWO', () => this.useSkill(1));
    this.input.keyboard.on('keydown-THREE', () => this.useSkill(2));
    this.input.keyboard.on('keydown-FOUR', () => this.useSkill(3));
    this.input.keyboard.on('keydown-U', () => this.useUlti());
    this.input.keyboard.on('keydown-B', () => this.toggleAuto());

    this.input.addPointer(2);
    this.joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.joyBase = this.add.circle(0, 0, 50, 0xffffff, 0.15).setScrollFactor(0).setDepth(100).setVisible(false);
    this.joyKnob = this.add.circle(0, 0, 22, 0xffffff, 0.4).setScrollFactor(0).setDepth(101).setVisible(false);
    this.input.on('pointerdown', p => {
      if (this.panel) return; // แก้บั๊ก: ไม่สร้างจอยขณะเปิดแผงเมนู
      if (p.x < W * 0.4 && this.joy.id === null) {
        this.joy.id = p.id; this.joy.ox = p.x; this.joy.oy = p.y;
        this.joyBase.setPosition(p.x, p.y).setVisible(true);
        this.joyKnob.setPosition(p.x, p.y).setVisible(true);
      }
    });
    this.input.on('pointermove', p => {
      if (p.id !== this.joy.id) return;
      const v = new Phaser.Math.Vector2(p.x - this.joy.ox, p.y - this.joy.oy);
      if (v.length() > 50) v.setLength(50);
      this.joy.dx = v.x / 50; this.joy.dy = v.y / 50;
      this.joyKnob.setPosition(this.joy.ox + v.x, this.joy.oy + v.y);
    });
    const release = p => {
      if (p.id !== this.joy.id) return;
      this.joy.id = null; this.joy.dx = 0; this.joy.dy = 0;
      this.joyBase.setVisible(false); this.joyKnob.setVisible(false);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  },

  toggleAuto() {
    this.autoMode = !this.autoMode;
    this.autoBtn.t.setText(this.autoMode ? 'บอท: เปิด' : 'บอท: ปิด');
    this.toastMsg(this.autoMode ? 'เปิดบอทออโต้ (ล่ามอน+เก็บของอัตโนมัติ)' : 'ปิดบอทออโต้');
  },

  updateMovement() {
    const p = this.player;
    // แก้บั๊ก: หยุดเดินขณะเปิดแผงเมนู (บอทก็หยุดด้วย)
    if (this.panel) { p.setVelocity(0, 0); return; }

    if (this.autoMode) { this.updateAuto(); return; }

    let vx = this.joy.dx, vy = this.joy.dy;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;
    const v = new Phaser.Math.Vector2(vx, vy);
    if (v.length() > 1) v.normalize();
    p.setVelocity(v.x * 190, v.y * 190);
    if (v.length() > 0.2 && !this.target) this.facing.copy(v).normalize();
  },

  updateAuto() {
    const p = this.player;
    let bestLoot = null, bestLd = Infinity;
    this.loot.getChildren().forEach(it => {
      const d = Phaser.Math.Distance.Between(p.x, p.y, it.x, it.y);
      if (d < bestLd) { bestLd = d; bestLoot = it; }
    });
    if (bestLoot && bestLd < 260) {
      this.physics.moveTo(p, bestLoot.x, bestLoot.y, 190);
    } else if (this.target) {
      const cls = this.currentClass();
      const approach = Math.max(50, BASIC_ATTACKS[cls].range - 40);
      const d = Phaser.Math.Distance.Between(p.x, p.y, this.target.x, this.target.y);
      if (d > approach) {
        this.physics.moveTo(p, this.target.x, this.target.y, 190);
      } else {
        p.setVelocity(0, 0);
        this.useBasicAttack();
        this.slots.forEach((sid, i) => { if (sid) this.useSkill(i); });
        this.useUlti();
      }
    } else if (bestLoot) {
      this.physics.moveTo(p, bestLoot.x, bestLoot.y, 190);
    } else {
      // ไม่มีเป้าในระยะ: เดินไปหามอนที่ใกล้ที่สุดในแผนที่
      const far = this.nearestEnemy();
      if (far) this.physics.moveTo(p, far.x, far.y, 190);
      else p.setVelocity(0, 0);
    }
  },
});
