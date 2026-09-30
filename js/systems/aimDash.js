// ===== ลากเล็งสกิลหมู่ระยะไกล (สไตล์ RoV) + ปุ่มแดช + บอทล็อกเป้ายิงสกิลหมู่ =====
// โหลดหลัง skillLevelPatch.js และก่อน main.js
(function () {
  const P = Main.prototype;

  // ---- ตั้งค่า (ปรับได้ตรงนี้) ----
  // cast = ระยะร่ายสูงสุด | รัศมีวงดาเมจใช้ค่า range เดิมของสกิลใน data/skills.js
  const GROUND_CFG = {
    mg_ice:  { cast: 320 },   // ธารน้ำแข็ง
    mg_nova: { cast: 300 },   // คลื่นเวท
    ar_rain: { cast: 340 },   // ฝนลูกศร
  };
  const GROUND_ULTI = {       // อัลติที่ลากเล็งได้ (ดาบสังหารยังกดใช้รอบตัวเหมือนเดิม)
    mage:   { cast: 360 },
    archer: { cast: 380 },
  };
  const AIM_DRAG_MIN = 14;    // ลากน้อยกว่านี้ถือว่าแตะ = ตกที่มอนที่ล็อก
  const AIM_DRAG_MAX = 110;   // ลากไกลเท่านี้ = ระยะสูงสุด
  const DASH_CD = 20000;      // คูลดาวน์แดช 20 วิ
  const DASH_DIST = 170;
  const DASH_MS = 160;

  const dist = (a, b) => Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);

  function clampTo(p, pt, max) {
    const d = dist(p, pt);
    if (d <= max || d < 1) return { x: pt.x, y: pt.y };
    const k = max / d;
    return { x: p.x + (pt.x - p.x) * k, y: p.y + (pt.y - p.y) * k };
  }

  // ---------- จุดตกของสกิลหมู่ ----------
  // ค่าเริ่มต้น: ที่มอนที่ล็อกอยู่ (ถ้าไกลเกินระยะ ตกที่ขอบระยะ) | ไม่มีเป้า = รอบตัวเหมือนเดิม
  P.groundDefault = function (cfg) {
    const p = this.player;
    const t = this.target && this.target.active ? this.target : null;
    return t ? clampTo(p, t, cfg.cast) : { x: p.x, y: p.y };
  };

  P.queueGround = function (def, cfg, gp) {
    const p = this.player;
    const pt = gp ? clampTo(p, gp, cfg.cast) : this.groundDefault(cfg);
    pt.x = Phaser.Math.Clamp(pt.x, 0, WORLD_W);
    pt.y = Phaser.Math.Clamp(pt.y, 0, WORLD_H);
    const now = this.time.now;
    this._groundQ = (this._groundQ || []).filter(e => now - e.t < 1500);
    this._groundQ.push({ def: def, x: pt.x, y: pt.y, t: now });
  };

  // useSkill(idx, gp) / useUlti(gp): gp = {x,y} จุดที่ลากเล็ง (ไม่ใส่ = ตกที่มอนที่ล็อก)
  const _useSkill = P.useSkill;
  P.useSkill = function (idx, gp) {
    const sid = this.slots && this.slots[idx];
    const cfg = sid && GROUND_CFG[sid];
    if (!cfg) return _useSkill.call(this, idx);
    const key = 'slot' + idx, before = this.cdEnd[key];
    _useSkill.call(this, idx);
    if (this.cdEnd[key] !== before) this.queueGround(SKILL_DEFS[sid], cfg, gp);
  };

  const _useUlti = P.useUlti;
  P.useUlti = function (gp) {
    const cls = this.ultiClass;
    const cfg = cls && GROUND_ULTI[cls];
    if (!cfg) return _useUlti.call(this);
    const before = this.cdEnd.ulti;
    _useUlti.call(this);
    if (this.cdEnd.ulti !== before) this.queueGround(ULTI_DEFS[cls], cfg, gp);
  };

  // ตอนเอฟเฟกต์ออกจริง ให้ใช้จุดที่เก็บไว้แทนตำแหน่งผู้เล่น
  const _apply = P.applySkillEffect;
  P.applySkillEffect = function (def, x, y, fx, fy, dmg, kind) {
    const q = this._groundQ;
    if (q && q.length) {
      const i = q.findIndex(e => e.def === def || (e.def.name === def.name && e.def.range === def.range));
      if (i >= 0) { const e = q.splice(i, 1)[0]; x = e.x; y = e.y; }
    }
    return _apply.call(this, def, x, y, fx, fy, dmg, kind);
  };

  // ---------- ระบบลากเล็ง ----------
  P.initAim = function () {
    if (this._aimInit) return;
    this._aimInit = true;
    this.aim = null;
    this.aimGfx = this.add.graphics().setDepth(90);

    this.input.on('pointermove', p => {
      const a = this.aim;
      if (!a || p.id !== a.pid) return;
      const vx = p.x - a.sx, vy = p.y - a.sy, len = Math.hypot(vx, vy);
      if (!a.dragged && len >= AIM_DRAG_MIN) a.dragged = true;
      if (a.dragged && len > 0.001) {
        a.dx = vx / len; a.dy = vy / len;
        a.ratio = Math.min(len / AIM_DRAG_MAX, 1);
      }
      // ลากกลับมาปล่อยบนปุ่ม = ยกเลิก
      a.cancel = a.dragged && Math.hypot(p.x - a.bx, p.y - a.by) < a.br;
    });

    const fin = p => {
      const a = this.aim;
      if (!a || p.id !== a.pid) return;
      this.aim = null;
      this.aimGfx.clear();
      if (this.panel) return;
      if (a.dragged && a.cancel) return;
      let gp = null;
      if (a.dragged) {
        const pl = this.player;
        gp = { x: pl.x + a.dx * a.ratio * a.cfg.cast, y: pl.y + a.dy * a.ratio * a.cfg.cast };
      }
      if (a.isUlti) this.useUlti(gp); else this.useSkill(a.idx, gp);
    };
    this.input.on('pointerup', fin);
    this.input.on('pointerupoutside', fin);

    if (this.input.keyboard) this.input.keyboard.on('keydown-E', () => this.useDash());
  };

  P.beginAim = function (kind, idx, btn, pointer) {
    this.initAim();
    if (this.aim) return;
    const isUlti = kind === 'ulti';
    let def, cfg, clsKey, key;
    if (isUlti) {
      clsKey = this.ultiClass; def = ULTI_DEFS[clsKey]; cfg = GROUND_ULTI[clsKey]; key = 'ulti';
    } else {
      const sid = this.slots[idx]; def = SKILL_DEFS[sid]; cfg = GROUND_CFG[sid]; clsKey = def.class; key = 'slot' + idx;
    }
    if (this.time.now < (this.cdEnd[key] || 0)) return;
    if (this.stats.mp < def.mp) { this.toastMsg('มานาไม่พอ'); return; }
    this.aim = {
      isUlti: isUlti, idx: idx, def: def, cfg: cfg, clsKey: clsKey, pid: pointer.id,
      sx: pointer.x, sy: pointer.y, bx: btn.c.x, by: btn.c.y, br: btn.c.radius,
      dragged: false, dx: 0, dy: 0, ratio: 0, cancel: false,
    };
  };

  P.drawAim = function () {
    const g = this.aimGfx;
    if (!g) return;
    g.clear();
    const a = this.aim;
    if (!a) return;
    if (this.panel) { this.aim = null; return; }
    const p = this.player;
    const pt = a.dragged
      ? { x: p.x + a.dx * a.ratio * a.cfg.cast, y: p.y + a.dy * a.ratio * a.cfg.cast }
      : this.groundDefault(a.cfg);
    const col = a.cancel ? 0xff5555 : (CLASSES[a.clsKey] ? CLASSES[a.clsKey].color : 0xffffff);
    g.lineStyle(2, 0xffffff, 0.3).strokeCircle(p.x, p.y, a.cfg.cast);      // ระยะร่ายสูงสุด
    g.lineStyle(3, col, 0.8).lineBetween(p.x, p.y, pt.x, pt.y);
    g.fillStyle(col, a.cancel ? 0.12 : 0.28).fillCircle(pt.x, pt.y, a.def.range);
    g.lineStyle(3, col, 0.95).strokeCircle(pt.x, pt.y, a.def.range);       // วงที่สกิลจะตก
  };

  // ---------- ปุ่มสกิล ----------
  // ช่องว่าง = เปิดหน้าต่างสกิล | สกิลหมู่ = กดแล้วลากเล็ง | สกิลอื่น = แตะใช้
  // ไม่มีการกดค้างถอดสกิลแล้ว: เปลี่ยนสกิลในช่องได้จากหน้าต่างสกิลเท่านั้น
  const _slot = P.makeSlotBtn;
  P.makeSlotBtn = function (x, y, r, idx) {
    const b = _slot.call(this, x, y, r, idx);
    const c = b.c;
    c.off('pointerdown'); c.off('pointerup');
    let mode = '';
    c.on('pointerdown', pointer => {
      if (this.panel) return;
      const sid = this.slots[idx];
      if (!sid) { this.openSkillBook(idx); return; }
      if (GROUND_CFG[sid]) { mode = 'aim'; this.beginAim('slot', idx, b, pointer); return; }
      mode = 'press';
    });
    c.on('pointerup', () => {
      if (mode !== 'press') return;
      mode = '';
      if (this.slots[idx]) this.useSkill(idx);
    });
    c.on('pointerupoutside', () => { mode = ''; });
    return b;
  };

  const _ulti = P.makeUltiBtn;
  P.makeUltiBtn = function (x, y, r) {
    const b = _ulti.call(this, x, y, r);
    b.c.off('pointerdown');
    b.c.on('pointerdown', pointer => {
      if (this.panel || !this.ultiClass) return;
      if (GROUND_ULTI[this.ultiClass]) this.beginAim('ulti', 0, b, pointer);
      else this.useUlti();
    });
    return b;
  };

  // ---------- แดช ----------
  P.useDash = function () {
    if (this.panel) return;
    const now = this.time.now;
    if (now < (this.cdEnd.dash || 0)) return;
    const p = this.player;
    let vx = this.joy ? this.joy.dx : 0, vy = this.joy ? this.joy.dy : 0;
    if (this.cursors && this.wasd) {
      if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
      if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
      if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
      if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;
    }
    if (Math.hypot(vx, vy) < 0.25) { vx = this.facing.x; vy = this.facing.y; }
    let len = Math.hypot(vx, vy);
    if (len < 0.001) { vx = 1; vy = 0; len = 1; }
    vx /= len; vy /= len;

    let d = DASH_DIST;   // หยุดก่อนชนหิน
    if (this.segmentBlocked) {
      while (d > 0 && this.segmentBlocked(p.x, p.y, p.x + vx * d, p.y + vy * d, 14)) d -= 15;
    }
    if (d <= 0) { this.toastMsg('แดชไม่ได้ มีสิ่งกีดขวาง'); return; }

    this.cdEnd.dash = now + DASH_CD;
    const nx = Phaser.Math.Clamp(p.x + vx * d, 20, WORLD_W - 20);
    const ny = Phaser.Math.Clamp(p.y + vy * d, 20, WORLD_H - 20);
    this.flash(p.x, p.y, 34, 0x9fd0ff);
    this.tweens.add({ targets: p, x: nx, y: ny, duration: DASH_MS });
  };

  const _setupButtons = P.setupButtons;
  P.setupButtons = function () {
    _setupButtons.call(this);
    this.initAim();
    const base = (typeof ROV !== 'undefined') ? ROV : { ax: W - 96, ay: H - 92 };
    const x = base.ax - 70, y = base.ay + 58, r = 22;   // ใต้-ซ้ายของปุ่มโจมตี
    const c = this.add.circle(x, y, r, 0x3a7bd5, 0.9).setScrollFactor(0).setDepth(100).setInteractive();
    c.setStrokeStyle(3, 0xffffff, 0.85);
    const icon = this.add.image(x, y - 5, 'ic_dash').setDisplaySize(18, 18).setScrollFactor(0).setDepth(101);
    const t = this.add.text(x, y + 11, 'แดช', { fontSize: '9px', color: '#fff', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(101);
    const cd = this.add.text(x, y, '', { fontSize: '16px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(102);
    c.on('pointerdown', () => this.useDash());
    this.dashBtn = { c: c, icon: icon, t: t, cd: cd };
  };

  const _updateSkillButtons = P.updateSkillButtons;
  P.updateSkillButtons = function (time) {
    _updateSkillButtons.call(this, time);
    const d = this.dashBtn;
    if (d) {
      const left = Math.max(0, (this.cdEnd.dash || 0) - time);
      d.c.setAlpha(left > 0 ? 0.4 : 0.9);
      d.cd.setText(left > 0 ? String(Math.ceil(left / 1000)) : '');
    }
    this.drawAim();
  };

  // ---------- บอท: ล็อกเป้าแล้วยิงสกิลหมู่ทันทีที่มอนอยู่ในระยะร่าย (ไม่ต้องเดินเข้าใกล้) ----------
  P.botGroundCasts = function () {
    const t = this.target && this.target.active ? this.target : null;
    if (!t) return;
    const p = this.player, now = this.time.now, d = dist(p, t);

    (this.slots || []).forEach((sid, i) => {
      const cfg = sid && GROUND_CFG[sid];
      if (!cfg || d > cfg.cast) return;
      if (now < (this.cdEnd['slot' + i] || 0)) return;
      if (this.stats.mp < SKILL_DEFS[sid].mp) return;
      this.useSkill(i, { x: t.x, y: t.y });
    });

    const uc = this.ultiClass, ucfg = uc && GROUND_ULTI[uc];
    if (ucfg && d <= ucfg.cast && now >= (this.cdEnd.ulti || 0) && this.stats.mp >= ULTI_DEFS[uc].mp) {
      let n = 0;
      this.enemies.getChildren().forEach(e => { if (e.active && dist(e, t) < ULTI_DEFS[uc].range) n++; });
      if (t.isBoss || n >= 3) this.useUlti({ x: t.x, y: t.y });
    }
  };

  const _updateAuto = P.updateAuto;
  P.updateAuto = function () {
    if (!this.panel) this.botGroundCasts();
    return _updateAuto.call(this);
  };
})();
