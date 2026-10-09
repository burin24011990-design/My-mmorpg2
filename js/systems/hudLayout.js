// ===== เลย์เอาต์ปุ่มสไตล์ ROV =====
// ปุ่มโจมตีใหญ่มุมขวาล่าง | สกิล 4 ปุ่ม + อัลติ เรียงต่อกันเป็นโค้งเดียวรอบปุ่มโจมตี (อัลติอยู่ปลายโค้งด้านบน)
// โหลดต่อจาก ui.js / skills.js และก่อน bot.js
//
// แนวตั้ง: ย่อปุ่มทั้งหมดลงด้วยตัวคูณ PORTRAIT_SCALE (แนวนอนใช้ 1 = ขนาดเดิมทุกอย่าง)
// ถ้าปุ่มในแนวตั้งยังใหญ่/เล็กไป ให้ปรับเลข PORTRAIT_SCALE ด้านล่าง (0.7 = เล็กลง, 0.9 = ใหญ่ขึ้น)

const PORTRAIT_SCALE = 0.8;
const ROV_PORTRAIT = (typeof PORTRAIT !== 'undefined' && !!PORTRAIT) || (W < H);
const ROV_S = ROV_PORTRAIT ? PORTRAIT_SCALE : 1;

const ROV = {
  s: ROV_S,                      // ตัวคูณขนาด (ไฟล์อื่นใช้ได้ เช่น flexSlot.js)
  ax: W - 150, ay: H - 120,      // ศูนย์กลางปุ่มโจมตี (ยิ่งลบมาก ยิ่งเข้ามาจากขอบขวา/ล่าง)
  attackR: Math.round(62 * ROV_S), skillR: Math.round(38 * ROV_S), ultiR: Math.round(38 * ROV_S),   // ปุ่มสกิลกับอัลติขนาดเท่ากัน
  ring: Math.round(185 * ROV_S), // รัศมีโค้ง (ยิ่งมากปุ่มยิ่งห่างกัน)
  startDeg: 170, stepDeg: 30,    // ปุ่มแรกที่ 170° แล้วไล่ขึ้นด้านบนทีละ 30°
};
const rs = n => Math.round(n * ROV.s);   // ย่อขนาดตามแนวจอ (แนวนอน = ค่าเดิม)

// ปุ่มโจมตีใหญ่ + วงในตกแต่ง
Main.prototype.makeCircleBtn = function (x, y, r, color, label, onClick) {
  const c = this.add.circle(x, y, r, color, 0.9).setScrollFactor(0).setDepth(100).setInteractive();
  c.setStrokeStyle(rs(5), 0xffffff, 0.9);
  this.add.circle(x, y, r - rs(9)).setStrokeStyle(2, 0xffffff, 0.35).setScrollFactor(0).setDepth(100);
  const t = this.add.text(x, y, label, { fontSize: Math.round(r * 0.32) + 'px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 })
    .setOrigin(0.5).setScrollFactor(0).setDepth(101);
  c.on('pointerdown', onClick);
  return { c, t };
};

// ปุ่มสกิล (ไอคอน 32px, ชื่อ 11px, ตัวเลขคูลดาวน์ 20px — ย่อตามแนวจอ)
Main.prototype.makeSlotBtn = function (x, y, r, idx) {
  const c = this.add.circle(x, y, r, 0x3a3a3a, 0.8).setScrollFactor(0).setDepth(100).setInteractive();
  c.setStrokeStyle(rs(4), 0xffffff, 0.75);
  const icon = this.add.image(x, y - rs(7), 'ic_melee').setDisplaySize(rs(32), rs(32)).setScrollFactor(0).setDepth(101).setVisible(false);
  const t = this.add.text(x, y + rs(20), '', { fontSize: Math.max(8, rs(11)) + 'px', color: '#fff', align: 'center', stroke: '#000', strokeThickness: 3 })
    .setOrigin(0.5).setScrollFactor(0).setDepth(101);
  const cdText = this.add.text(x, y, '', { fontSize: rs(20) + 'px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 })
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
  const glow = this.add.circle(x, y, r + rs(8)).setStrokeStyle(4, 0xffe066, 0.85).setScrollFactor(0).setDepth(99).setVisible(false);
  this.tweens.add({ targets: glow, alpha: 0.25, scale: 1.12, yoyo: true, repeat: -1, duration: 700 });
  const c = this.add.circle(x, y, r, 0xd4af37, 0.92).setScrollFactor(0).setDepth(100).setInteractive().setVisible(false);
  c.setStrokeStyle(rs(5), 0xfff3c4, 0.95);
  const icon = this.add.image(x, y - rs(4), 'ic_aoe').setScrollFactor(0).setDepth(100.5).setVisible(false);
  const label = this.add.text(x, y - rs(15), '★ ULTI', { fontSize: Math.max(8, rs(10)) + 'px', color: '#3a2a00', fontStyle: 'bold' })
    .setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);
  const t = this.add.text(x, y + rs(5), 'ULTI', { fontSize: Math.max(8, rs(11)) + 'px', color: '#3a2a00', fontStyle: 'bold', align: 'center' })
    .setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);
  const cd = this.add.text(x, y, '', { fontSize: rs(24) + 'px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 })
    .setOrigin(0.5).setScrollFactor(0).setDepth(102).setVisible(false);
  c.on('pointerdown', () => this.useUlti());
  return { c, t, label, cd, glow, slotRing, icon };
};

Main.prototype.rovPos = function (i) {
  const a = Phaser.Math.DegToRad(ROV.startDeg + i * ROV.stepDeg);
  return { x: ROV.ax + ROV.ring * Math.cos(a), y: ROV.ay + ROV.ring * Math.sin(a) };
};

Main.prototype.setupButtons = function () {
  // แถบโค้งจาง ๆ รองใต้ปุ่มทั้งหมด
  const deco = this.add.graphics().setScrollFactor(0).setDepth(99);
  deco.lineStyle(rs(92), 0xffffff, 0.07);
  deco.beginPath();
  deco.arc(ROV.ax, ROV.ay, ROV.ring, Phaser.Math.DegToRad(155), Phaser.Math.DegToRad(305), false);
  deco.strokePath();

  this.attackBtn = this.makeCircleBtn(ROV.ax, ROV.ay, ROV.attackR, 0xcf3d3d, 'โจมตี', () => this.useBasicAttack());
  this.slotBtns = [0, 1, 2, 3].map(i => { const p = this.rovPos(i); return this.makeSlotBtn(p.x, p.y, ROV.skillR, i); });
  const up = this.rovPos(4);
  this.ultiBtn = this.makeUltiBtn(up.x, up.y, ROV.ultiR);

  // แถบเมนูด้านบน (กระเป๋า สกิล บอท อุปกรณ์ เลือกด่าน สเตตัส) อยู่ใน js/systems/topbar.js
  this.setupTopBar();
  this.loadSkillIcons();
  this.makeActionIcons();
  // รูปบนปุ่มโจมตีปกติ: ชื่อปุ่มย้ายลงล่าง ตัวเล็กลง
  this.attackIcon = this.add.image(ROV.ax, ROV.ay - rs(8), 'atk_sword').setScrollFactor(0).setDepth(100.6);
  this.attackBtn.t.setPosition(ROV.ax, ROV.ay + ROV.attackR * 0.58).setFontSize(rs(14));
};

// ไอคอนโจมตีปกติ (ดาบ/คทา/ธนู/พระ/โจร) และแดช: วาดเอง ไม่ต้องมีไฟล์รูป
// ถ้าต้องการรูปของตัวเอง ใส่ไฟล์ที่ assets/skills/basic_<อาชีพ>.png (เช่น basic_sword.png) และ assets/skills/dash.png
// แล้วลบชื่อนั้นออกจากรายการ SKIP ในฟังก์ชัน loadSkillIcons ด้านล่าง
Main.prototype.makeActionIcons = function () {
  if (this.textures.exists('atk_sword')) return;
  const g = this.make.graphics({ x: 0, y: 0, add: false });
  const mk = (key, fn) => { g.clear(); fn(g); g.generateTexture(key, 64, 64); };

  mk('atk_sword', g => {
    g.lineStyle(9, 0x5b6573); g.lineBetween(49, 11, 24, 36);              // เงาใบดาบ
    g.lineStyle(7, 0xe3ebf4); g.lineBetween(48, 12, 24, 36);              // ใบดาบ
    g.fillStyle(0xe3ebf4); g.fillTriangle(54, 6, 52, 16, 44, 8);          // ปลายดาบ
    g.lineStyle(2, 0xffffff); g.lineBetween(46, 14, 26, 34);              // ประกายขอบดาบ
    g.lineStyle(6, 0xd9a441); g.lineBetween(18, 29, 34, 45);              // ด้ามกั้น
    g.lineStyle(6, 0x7a4a21); g.lineBetween(26, 40, 14, 52);              // ด้ามจับ
    g.fillStyle(0xf2c94c); g.fillCircle(12, 54, 4);                       // หัวด้าม
  });
  mk('atk_mage', g => {
    g.lineStyle(7, 0x5a3a1c); g.lineBetween(14, 54, 42, 26);              // ไม้คทา
    g.lineStyle(3, 0x9a6a38); g.lineBetween(16, 52, 40, 28);
    g.fillStyle(0xb98cff, 0.35); g.fillCircle(46, 20, 15);                // รัศมีเรืองแสง
    g.fillStyle(0x9fe8ff); g.fillCircle(46, 20, 9);                       // ลูกแก้ว
    g.fillStyle(0xffffff); g.fillCircle(43, 17, 3);
    g.lineStyle(2, 0xffffff); g.lineBetween(46, 4, 46, 9); g.lineBetween(58, 20, 63, 20); g.lineBetween(46, 31, 46, 36);
  });
  mk('atk_archer', g => {
    g.lineStyle(6, 0xb5763a); g.beginPath(); g.arc(24, 32, 22, -1.2, 1.2, false); g.strokePath();   // คันธนู
    g.lineStyle(2, 0xffffff); g.lineBetween(32, 12, 32, 52);              // สาย
    g.lineStyle(3, 0xf2e2b3); g.lineBetween(10, 32, 54, 32);              // ลูกศร
    g.fillStyle(0xdfe6ee); g.fillTriangle(60, 32, 51, 26, 51, 38);        // หัวลูกศร
    g.fillStyle(0xff7a7a); g.fillTriangle(10, 32, 4, 26, 14, 32); g.fillTriangle(10, 32, 4, 38, 14, 32);   // ขนนก
  });
  mk('atk_priest', g => {
    g.fillStyle(0xfff2a8, 0.3); g.fillCircle(32, 32, 28);                 // รัศมี
    g.fillStyle(0xf5d76e); g.fillRoundedRect(27, 8, 10, 48, 3); g.fillRoundedRect(14, 20, 36, 10, 3);   // ไม้กางเขน
    g.fillStyle(0xffffff, 0.8); g.fillRect(30, 11, 3, 42); g.fillRect(17, 23, 30, 3);
  });
  mk('atk_rogue', g => {
    g.lineStyle(6, 0xc9d3e0); g.lineBetween(50, 10, 28, 32);              // มีดสั้นเล่มหลัก
    g.fillStyle(0xc9d3e0); g.fillTriangle(56, 4, 54, 14, 46, 6);
    g.lineStyle(5, 0x6a3a8a); g.lineBetween(24, 36, 14, 46);
    g.lineStyle(5, 0x9b6bff); g.lineBetween(30, 22, 40, 32);              // ด้ามกั้น
    g.lineStyle(5, 0xc9d3e0); g.lineBetween(12, 12, 28, 28);              // มีดเล่มรอง
    g.fillStyle(0xc9d3e0); g.fillTriangle(8, 8, 18, 10, 10, 18);
  });
  mk('gen_dash', g => {
    g.lineStyle(7, 0xbfe3ff); g.lineJoin = 'round';
    [8, 24, 40].forEach((x, i) => {                                       // ลูกศรพุ่งซ้อนกัน
      g.lineStyle(7, i === 2 ? 0xffffff : 0x9fd0ff);
      g.beginPath(); g.moveTo(x, 14); g.lineTo(x + 16, 32); g.lineTo(x, 50); g.strokePath();
    });
    g.lineStyle(3, 0x9fd0ff); g.lineBetween(2, 24, 12, 24); g.lineBetween(2, 40, 12, 40);   // เส้นลม
  });
  g.destroy();
};

// โหลดรูปสกิลจาก assets/skills/<รหัสสกิล>.png (ไฟล์เดียวกับหน้าต่างสกิล) มาใช้บนปุ่มกด
// ถ้าไฟล์ไหนไม่มี จะใช้ไอคอนเดิมของปุ่มแทนอัตโนมัติ
const SKILL_ICON_VER = '1';   // ตรงกับ IMG_VER ใน skillPanelData.js (เปลี่ยนรูปแล้วมือถือยังโชว์ของเก่า ให้เพิ่มเลขทั้งสองที่)
Main.prototype.loadSkillIcons = function () {
  // รูปที่ "ไม่มีในรีโป" ไม่ต้องโหลด ใช้ไอคอนวาดเองแทน (พออัปโหลดรูปแล้ว ลบชื่อออกจากรายการนี้)
  const SKIP = { dash: 1, basic_sword: 1, basic_mage: 1, basic_archer: 1, basic_priest: 1, basic_rogue: 1 };
  const SKIP_ULTI = {};   // ถ้ารูปอัลติบางอาชีพไม่มี ใส่ชื่ออาชีพตรงนี้ เช่น { sword: 1 }
  let n = 0;
  Object.keys(SKILL_DEFS).forEach(id => {
    const k = 'sk_' + id;
    if (!this.textures.exists(k)) { this.load.image(k, 'assets/skills/' + id + '.png?v=' + SKILL_ICON_VER); n++; }
  });
  Object.keys(BASIC_ATTACKS).forEach(cls => {       // โจมตีปกติ: assets/skills/basic_<อาชีพ>.png (ไม่มีไฟล์ = ใช้ไอคอนที่วาดเอง)
    if (SKIP['basic_' + cls]) return;
    const k = 'sk_basic_' + cls;
    if (!this.textures.exists(k)) { this.load.image(k, 'assets/skills/basic_' + cls + '.png?v=' + SKILL_ICON_VER); n++; }
  });
  if (!SKIP.dash && !this.textures.exists('sk_dash')) { this.load.image('sk_dash', 'assets/skills/dash.png?v=' + SKILL_ICON_VER); n++; }   // แดช
  Object.keys(ULTI_DEFS).forEach(cls => {          // อัลติ: assets/skills/ulti_<อาชีพ>.png
    if (SKIP_ULTI[cls]) return;
    const k = 'sk_ulti_' + cls;
    if (!this.textures.exists(k)) { this.load.image(k, 'assets/skills/ulti_' + cls + '.png?v=' + SKILL_ICON_VER); n++; }
  });
  if (n) this.load.start();
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
    // ปุ่มสกิล: ใช้รูปเดียวกับหน้าต่างสกิล ขนาดเล็กลง (ICON_SIZE) ถ้าไม่มีรูปใช้ไอคอนเดิม
    const ICON_SIZE = rs(46);
    (this.slots || []).forEach((sid, i) => {
      const b = this.slotBtns && this.slotBtns[i];
      if (!b || !sid || !SKILL_DEFS[sid]) return;
      const key = 'sk_' + sid;
      if (!this.textures.exists(key)) return;
      const def = SKILL_DEFS[sid];
      const busy = (this.cdEnd['slot' + i] || 0) > time || this.stats.mp < def.mp;
      b.icon.setTexture(key).setDisplaySize(ICON_SIZE, ICON_SIZE).setPosition(b.c.x, b.c.y - rs(6))
        .setTint(0xffffff).setAlpha(busy ? 0.45 : 1).setVisible(true);
      b.t.setPosition(b.c.x, b.c.y + rs(27)).setFontSize(Math.max(8, rs(10)));
    });
    // ปุ่มโจมตีปกติ: รูปตามอาชีพที่ถืออยู่ตอนนี้
    if (this.attackIcon) {
      const cls = this.currentClass();
      const k = this.textures.exists('sk_basic_' + cls) ? 'sk_basic_' + cls
        : (this.textures.exists('atk_' + cls) ? 'atk_' + cls : 'atk_sword');
      const cdLeft = (this.cdEnd.basic || 0) - time;
      this.attackIcon.setTexture(k).setDisplaySize(rs(58), rs(58)).setPosition(ROV.ax, ROV.ay - rs(8)).setAlpha(cdLeft > 0 ? 0.5 : 1);
    }
    // ปุ่มแดช: ใช้ assets/skills/dash.png ถ้ามี ไม่มีใช้ไอคอนที่วาดเอง
    const dB = this.dashBtn;
    if (dB && dB.icon) {
      const k = this.textures.exists('sk_dash') ? 'sk_dash' : 'gen_dash';
      const dl = (this.cdEnd.dash || 0) - time;
      dB.icon.setTexture(k).setDisplaySize(rs(38), rs(38)).setPosition(dB.c.x, dB.c.y - rs(6)).setAlpha(dl > 0 ? 0.45 : 1);
    }
    const u = this.ultiBtn;
    // ปุ่มอัลติ: ใช้รูป ulti_<อาชีพ>.png (ไม่มีรูปก็ใช้ปุ่มทองเดิม)
    if (u && u.icon) {
      const ukey = this.ultiClass && ('sk_ulti_' + this.ultiClass);
      if (ukey && this.textures.exists(ukey)) {
        const busy = (this.cdEnd.ulti || 0) > time || this.stats.mp < ULTI_DEFS[this.ultiClass].mp;
        u.icon.setTexture(ukey).setDisplaySize(rs(54), rs(54)).setPosition(u.c.x, u.c.y - rs(4))
          .setTint(0xffffff).setAlpha(busy ? 0.45 : 1).setVisible(true);
        u.t.setPosition(u.c.x, u.c.y + rs(28)).setFontSize(Math.max(8, rs(9)));
        if (u.label) u.label.setVisible(false);
      } else u.icon.setVisible(false);
    }
    if (!u || !this.ultiClass || !u.cd) return;
    const left = Math.max(0, (this.cdEnd.ulti || 0) - time);
    u.cd.setText(left > 0 ? String(Math.ceil(left / 1000)) : '');
    u.glow.setVisible(left <= 0 && this.stats.mp >= ULTI_DEFS[this.ultiClass].mp);
  };
})();
