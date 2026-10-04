// ===== เลย์เอาต์ปุ่มสไตล์ ROV =====
// ปุ่มโจมตีใหญ่มุมขวาล่าง | สกิล 4 ปุ่ม + อัลติ เรียงต่อกันเป็นโค้งเดียวรอบปุ่มโจมตี (อัลติอยู่ปลายโค้งด้านบน)
// โหลดต่อจาก ui.js / skills.js และก่อน bot.js

const ROV = {
  ax: W - 150, ay: H - 120,      // ศูนย์กลางปุ่มโจมตี (ยิ่งลบมาก ยิ่งเข้ามาจากขอบขวา/ล่าง)
  attackR: 62, skillR: 38, ultiR: 38,   // ปุ่มสกิลกับอัลติขนาดเท่ากัน
  ring: 185,                     // รัศมีโค้ง (ยิ่งมากปุ่มยิ่งห่างกัน)
  startDeg: 170, stepDeg: 30,    // ปุ่มแรกที่ 170° แล้วไล่ขึ้นด้านบนทีละ 30°
};

// ปุ่มโจมตีใหญ่ + วงในตกแต่ง
Main.prototype.makeCircleBtn = function (x, y, r, color, label, onClick) {
  const c = this.add.circle(x, y, r, color, 0.9).setScrollFactor(0).setDepth(100).setInteractive();
  c.setStrokeStyle(5, 0xffffff, 0.9);
  this.add.circle(x, y, r - 9).setStrokeStyle(2, 0xffffff, 0.35).setScrollFactor(0).setDepth(100);
  const t = this.add.text(x, y, label, { fontSize: Math.round(r * 0.32) + 'px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 })
    .setOrigin(0.5).setScrollFactor(0).setDepth(101);
  c.on('pointerdown', onClick);
  return { c, t };
};

// ปุ่มสกิลใหญ่ (ไอคอน 32px, ชื่อ 11px, ตัวเลขคูลดาวน์ 20px)
Main.prototype.makeSlotBtn = function (x, y, r, idx) {
  const c = this.add.circle(x, y, r, 0x3a3a3a, 0.8).setScrollFactor(0).setDepth(100).setInteractive();
  c.setStrokeStyle(4, 0xffffff, 0.75);
  const icon = this.add.image(x, y - 7, 'ic_melee').setDisplaySize(32, 32).setScrollFactor(0).setDepth(101).setVisible(false);
  const t = this.add.text(x, y + 20, '', { fontSize: '11px', color: '#fff', align: 'center', stroke: '#000', strokeThickness: 3 })
    .setOrigin(0.5).setScrollFactor(0).setDepth(101);
  const cdText = this.add.text(x, y, '', { fontSize: '20px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 })
    .setOrigin(0.5).setScrollFactor(0).setDepth(102);
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
};

// ปุ่มอัลติ: ทอง + ขอบเรืองแสงเมื่อพร้อมใช้ + ตัวเลขคูลดาวน์ + วงจางๆ บอกตำแหน่งตอนยังไม่ปลดล็อก
Main.prototype.makeUltiBtn = function (x, y, r) {
  const slotRing = this.add.circle(x, y, r).setStrokeStyle(3, 0xffffff, 0.22).setScrollFactor(0).setDepth(99);
  const glow = this.add.circle(x, y, r + 8).setStrokeStyle(4, 0xffe066, 0.85).setScrollFactor(0).setDepth(99).setVisible(false);
  this.tweens.add({ targets: glow, alpha: 0.25, scale: 1.12, yoyo: true, repeat: -1, duration: 700 });
  const c = this.add.circle(x, y, r, 0xd4af37, 0.92).setScrollFactor(0).setDepth(100).setInteractive().setVisible(false);
  c.setStrokeStyle(5, 0xfff3c4, 0.95);
  const label = this.add.text(x, y - 15, '★ ULTI', { fontSize: '10px', color: '#3a2a00', fontStyle: 'bold' })
    .setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);
  const t = this.add.text(x, y + 5, 'ULTI', { fontSize: '11px', color: '#3a2a00', fontStyle: 'bold', align: 'center' })
    .setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);
  const cd = this.add.text(x, y, '', { fontSize: '24px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 })
    .setOrigin(0.5).setScrollFactor(0).setDepth(102).setVisible(false);
  c.on('pointerdown', () => this.useUlti());
  return { c, t, label, cd, glow, slotRing };
};

Main.prototype.rovPos = function (i) {
  const a = Phaser.Math.DegToRad(ROV.startDeg + i * ROV.stepDeg);
  return { x: ROV.ax + ROV.ring * Math.cos(a), y: ROV.ay + ROV.ring * Math.sin(a) };
};

Main.prototype.setupButtons = function () {
  // แถบโค้งจาง ๆ รองใต้ปุ่มทั้งหมด
  const deco = this.add.graphics().setScrollFactor(0).setDepth(99);
  deco.lineStyle(92, 0xffffff, 0.07);
  deco.beginPath();
  deco.arc(ROV.ax, ROV.ay, ROV.ring, Phaser.Math.DegToRad(155), Phaser.Math.DegToRad(305), false);
  deco.strokePath();

  this.attackBtn = this.makeCircleBtn(ROV.ax, ROV.ay, ROV.attackR, 0xcf3d3d, 'โจมตี', () => this.useBasicAttack());
  this.slotBtns = [0, 1, 2, 3].map(i => { const p = this.rovPos(i); return this.makeSlotBtn(p.x, p.y, ROV.skillR, i); });
  const up = this.rovPos(4);
  this.ultiBtn = this.makeUltiBtn(up.x, up.y, ROV.ultiR);

  // แถบเมนูด้านบน (กระเป๋า สกิล บอท อุปกรณ์ เลือกด่าน สเตตัส) อยู่ใน js/systems/topbar.js
  this.setupTopBar();
};

// สลับการแสดงผลส่วนเสริมของปุ่มอัลติตามคอมโบสกิล
(function () {
  const _computeCombo = Main.prototype.computeCombo;
  Main.prototype.computeCombo = function () {
    _computeCombo.call(this);
    const u = this.ultiBtn; if (!u) return;
    const on = !!this.ultiClass;
    if (u.label) u.label.setVisible(on);
    if (u.cd) u.cd.setVisible(on);
    if (u.slotRing) u.slotRing.setVisible(!on);
    if (!on && u.glow) u.glow.setVisible(false);
  };

  const _updateSkillButtons = Main.prototype.updateSkillButtons;
  Main.prototype.updateSkillButtons = function (time) {
    _updateSkillButtons.call(this, time);
    const u = this.ultiBtn;
    if (!u || !this.ultiClass || !u.cd) return;
    const left = Math.max(0, (this.cdEnd.ulti || 0) - time);
    u.cd.setText(left > 0 ? String(Math.ceil(left / 1000)) : '');
    u.glow.setVisible(left <= 0 && this.stats.mp >= ULTI_DEFS[this.ultiClass].mp);
  };
})();
