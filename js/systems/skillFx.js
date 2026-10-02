// ===== เอฟเฟกต์สกิล (วาดด้วยโค้ด ไม่ต้องมีไฟล์รูป) =====
// โหลดหลังไฟล์ classes/*.js ทั้งหมด (และหลัง lootOptions.js) ก่อน main.js
// ไม่ต้องแก้ไฟล์สกิลเดิม: ไฟล์นี้ครอบ handler ของแต่ละสกิล แล้วเล่นเอฟเฟกต์เพิ่มให้
// ปิดทั้งหมด: window.SKILL_FX = false   |   เบาเครื่อง: window.SKILL_FX_QUALITY = 0.5 (ลดจำนวนอนุภาค)
(function () {
  'use strict';
  const P = Main.prototype, C = window.Classes;
  if (!C || !C.handlers) { console.warn('skillFx.js: ไม่พบ Classes.handlers (ข้ามเอฟเฟกต์)'); return; }

  const D = 70;                                             // depth ของเอฟเฟกต์ (สูงกว่าเอฟเฟกต์เดิม ต่ำกว่า HUD)
  const PI = Math.PI;
  const GOLD = 0xfff2a8, GREEN = 0x7dff9a, CYAN = 0x9fe8ff, PURPLE = 0xb98cff;
  const Q = n => Math.max(2, Math.round(n * (window.SKILL_FX_QUALITY || 1)));
  const on = () => window.SKILL_FX !== false;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const unit = (x, y) => { const l = Math.hypot(x, y); return l < 0.001 ? { x: 1, y: 0 } : { x: x / l, y: y / l }; };
  const facing = s => unit(s.facing ? s.facing.x : 1, s.facing ? s.facing.y : 0);
  const kill = o => () => o.destroy();

  // ---------- ชิ้นส่วนเอฟเฟกต์พื้นฐาน ----------
  // วงแหวนขยายออกแล้วจาง
  function ring(s, x, y, r, col, dur, w, from) {
    const c = s.add.circle(x, y, r, col, 0).setStrokeStyle(w || 3, col, 1).setDepth(D).setScale(from || 0.15);
    s.tweens.add({ targets: c, scale: 1, alpha: 0, duration: dur || 350, ease: 'Cubic.easeOut', onComplete: kill(c) });
  }
  // ประกายกระจายรอบจุด
  function burst(s, x, y, col, n, dist, dur, size) {
    n = Q(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2 + rnd(-0.3, 0.3), d = rnd(dist * 0.5, dist);
      const c = s.add.circle(x, y, size || 3, col, 1).setDepth(D + 1);
      s.tweens.add({
        targets: c, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.3,
        duration: dur * rnd(0.7, 1.1), ease: 'Cubic.easeOut', onComplete: kill(c),
      });
    }
  }
  // เส้นแสงตรง
  function streak(s, x1, y1, x2, y2, col, w, dur) {
    const g = s.add.graphics().setDepth(D + 1);
    g.lineStyle(w, col, 1); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
    s.tweens.add({ targets: g, alpha: 0, duration: dur, onComplete: kill(g) });
  }
  // เสี้ยววงโค้ง (รอยฟัน) ศูนย์กลางที่ (x,y) หมุน/ขยายแล้วจาง
  function arc(s, x, y, r, a0, a1, col, w, dur, spin) {
    const g = s.add.graphics({ x: x, y: y }).setDepth(D + 1);
    g.lineStyle(w, col, 1); g.beginPath(); g.arc(0, 0, r, a0, a1); g.strokePath();
    s.tweens.add({ targets: g, alpha: 0, angle: spin || 0, scale: 1.25, duration: dur, ease: 'Cubic.easeOut', onComplete: kill(g) });
  }
  // เงาตกค้าง (ใช้กับสกิลพุ่ง)
  function ghost(s, x, y, col) {
    const c = s.add.circle(x, y, 14, col, 0.55).setDepth(D - 1);
    s.tweens.add({ targets: c, alpha: 0, scale: 0.5, duration: 260, onComplete: kill(c) });
  }
  // ลำแสงแนวตรง (ใช้กับอัลติ)
  function beam(s, p, u, L, hw, col, dur) {
    const a = Math.atan2(u.y, u.x), cx = p.x + u.x * L / 2, cy = p.y + u.y * L / 2;
    const r = s.add.rectangle(cx, cy, L, hw * 2, col, 0.55).setRotation(a).setDepth(D);
    s.tweens.add({ targets: r, alpha: 0, scaleY: 1.5, duration: dur, onComplete: kill(r) });
    const c = s.add.rectangle(cx, cy, L, Math.max(4, hw * 0.4), 0xffffff, 0.95).setRotation(a).setDepth(D + 1);
    s.tweens.add({ targets: c, alpha: 0, scaleY: 0.3, duration: dur, onComplete: kill(c) });
  }
  // เสาแสงจากฟ้า
  function pillar(s, x, y, w, h, col, dur) {
    const r = s.add.rectangle(x, y - h / 2, w, h, col, 0.7).setDepth(D).setScale(0.2, 1);
    s.tweens.add({ targets: r, scaleX: 1, duration: 110 });
    s.tweens.add({ targets: r, alpha: 0, delay: 110, duration: dur || 380, onComplete: kill(r) });
  }
  function shake(s, ms, k) { if (s.cameras && s.cameras.main) s.cameras.main.shake(ms, k); }
  function later(s, ms, fn) { s.time.delayedCall(ms, () => { try { fn(); } catch (e) { console.error('skillFx', e); } }); }

  // จุดตกของสกิลวางพื้นที่ (ดูเฉยๆ ไม่ดึงออกจากคิว เพื่อไม่ให้กระทบ handler เดิม)
  function peekGround(s, def, x, y) {
    const q = s._groundQ;
    if (q && q.length) {
      const e = q.find(e => e.def === def || (e.def.name === def.name && e.def.range === def.range));
      if (e) return { x: e.x, y: e.y };
    }
    return { x: x, y: y };
  }
  // ศัตรูในแนวฟันตรง (เหมือนเงื่อนไขของ handler เดิม)
  function inBox(s, p, u, len, hw) {
    return s.enemies.getChildren().filter(e => {
      if (!e.active) return false;
      const rx = e.x - p.x, ry = e.y - p.y;
      const along = rx * u.x + ry * u.y, perp = Math.abs(-rx * u.y + ry * u.x);
      return along >= -15 && along <= len + 12 && perp <= hw + 12;
    });
  }

  // ======================================================================
  // ตารางเอฟเฟกต์ของสกิลที่ลงทะเบียนใน Classes.handlers
  // pre = เล่นก่อน handler เดิม | post = เล่นหลัง | from = ตำแหน่งผู้เล่นก่อนใช้สกิล
  // ======================================================================
  const FX = {};

  // ---------- ดาบ ----------
  FX.sstun = { post(def, x, y, dmg, fx, fy) {          // ฟันสตั้น
    const s = this, p = s.player, u = unit(fx, fy), a = Math.atan2(u.y, u.x), L = def.range;
    arc(s, p.x, p.y, L * 0.8, a - 0.9, a + 0.9, GOLD, 7, 260);
    arc(s, p.x, p.y, L * 0.6, a - 0.7, a + 0.7, 0xffffff, 3, 220);
    burst(s, p.x + u.x * L, p.y + u.y * L, 0xffd45e, 8, 60, 300, 3);
    ring(s, p.x + u.x * L * 0.8, p.y + u.y * L * 0.8, 40, 0xffd45e, 260, 3);
  } };
  FX.sspin = { post(def) {                              // ฟันหมุน + เกราะ
    const s = this, p = s.player, R = def.range;
    for (let i = 0; i < 3; i++) arc(s, p.x, p.y, R * (0.55 + 0.2 * i), i * 2.1, i * 2.1 + 3.2, i % 2 ? 0xffffff : 0xffd45e, 6 - i, 320, 360);
    ring(s, p.x, p.y, R, 0xffd45e, 380, 4);
    const sh = s.add.circle(p.x, p.y, 34, 0x7fc8ff, 0.3).setDepth(D - 1);   // ออร่าเกราะ
    s.tweens.add({ targets: sh, alpha: 0, scale: 1.9, duration: 500, onComplete: kill(sh) });
  } };
  FX.sult = { post(def, x, y, dmg, fx, fy) {            // ดาบสังหาร
    const s = this, p = s.player, u = unit(fx, fy), L = def.range;
    beam(s, p, u, L, def.halfW, 0xff6b5e, 350);
    for (let i = 1; i <= 5; i++) burst(s, p.x + u.x * L * i / 5, p.y + u.y * L * i / 5, 0xff6b5e, 5, 45, 320, 3);
    shake(s, 180, 0.006);
  } };

  // ---------- คทา ----------
  FX.mbolt = { post(def, x, y, dmg, fx, fy) {           // สายฟ้า
    const s = this, p = s.player, u = unit(fx, fy), L = def.range;
    for (let i = 1; i <= 5; i++) burst(s, p.x + u.x * L * i / 5, p.y + u.y * L * i / 5, 0xffe14a, 4, 40, 300, 3);
    ring(s, p.x + u.x * L, p.y + u.y * L, 50, 0xffe14a, 300, 3);
    if (s.cameras && s.cameras.main) s.cameras.main.flash(70, 255, 240, 150, true);
    shake(s, 120, 0.004);
  } };
  FX.mblink = { post(def, x, y, dmg, fx, fy, from) {    // เวทวาป
    const s = this, p = s.player;
    if (from) {
      ring(s, from.x, from.y, 50, PURPLE, 320, 3);
      burst(s, from.x, from.y, PURPLE, 10, 50, 350, 3);
      streak(s, from.x, from.y, p.x, p.y, 0xe0c8ff, 5, 260);
    }
    ring(s, p.x, p.y, 60, 0xe0c8ff, 380, 3);
    burst(s, p.x, p.y, 0xe0c8ff, 10, 55, 400, 3);
  } };
  FX.mfire = { pre(def, x, y) {                         // ลูกไฟ: ตกจากฟ้าแล้วระเบิด
    const s = this, pt = peekGround(s, def, x, y), t0 = def.delay || 400;
    const ball = s.add.circle(pt.x - 90, pt.y - 320, 16, 0xff8a2a, 1).setDepth(D);
    const core = s.add.circle(pt.x - 90, pt.y - 320, 8, 0xffe9a8, 1).setDepth(D + 1);
    s.tweens.add({
      targets: [ball, core], x: pt.x, y: pt.y, duration: t0, ease: 'Quad.easeIn',
      onComplete: () => {
        ball.destroy(); core.destroy();
        ring(s, pt.x, pt.y, def.range, 0xff7a2a, 420, 5, 0.2);
        burst(s, pt.x, pt.y, 0xffb36b, 14, def.range, 500, 4);
        shake(s, 160, 0.006);
      },
    });
    for (let i = 1; i <= 7; i++) later(s, i * (t0 / 8), () => { if (ball.active) ghost(s, ball.x, ball.y, 0xff8a2a); });
  } };
  FX.mice = { pre(def, x, y) {                          // ธารน้ำแข็ง: หนามน้ำแข็งพุ่งขึ้น
    const s = this, pt = peekGround(s, def, x, y);
    for (let t = 0; t < def.ticks; t++) {
      later(s, t * def.tickMs + 150, () => {
        ring(s, pt.x, pt.y, def.range, CYAN, 400, 3);
        const n = Q(8);
        for (let k = 0; k < n; k++) {
          const a = rnd(0, PI * 2), r = Math.sqrt(Math.random()) * def.range;
          const sp = s.add.triangle(pt.x + Math.cos(a) * r, pt.y + Math.sin(a) * r + 8, 0, 16, 6, 0, 12, 16, 0xcff3ff, 0.95)
            .setOrigin(0.5, 1).setDepth(D).setScale(0.3, 0.1);
          s.tweens.add({ targets: sp, scaleX: 1.4, scaleY: rnd(1.6, 2.6), duration: 120 });
          s.tweens.add({ targets: sp, alpha: 0, delay: 320, duration: 300, onComplete: kill(sp) });
        }
        burst(s, pt.x, pt.y, 0xffffff, 8, def.range * 0.8, 450, 2);
      });
    }
  } };
  FX.mult = { post(def) {                               // ระเบิดมหาเวท
    const s = this, p = s.player, R = def.range;
    ring(s, p.x, p.y, R, CYAN, 450, 5);
    ring(s, p.x, p.y, R * 0.7, 0xffffff, 350, 3);
    burst(s, p.x, p.y, CYAN, 14, R, 520, 4);
    for (let i = 0; i < Q(5); i++) {                    // สายฟ้ากระจาย
      const a = rnd(0, PI * 2);
      streak(s, p.x, p.y, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, 0xffe14a, 3, 300);
    }
    shake(s, 220, 0.008);
  } };

  // ---------- ธนู ----------
  const arCol = () => (window.CLASSES && CLASSES.archer && CLASSES.archer.color) || GOLD;
  FX.ashot2 = { post(def, x, y, dmg, fx, fy) {          // ยิงคู่
    const s = this, u = unit(fx, fy);
    for (let i = 0; i < def.shots; i++) later(s, i * def.gap, () => {
      const p = s.player;
      burst(s, p.x + u.x * 24, p.y + u.y * 24, GOLD, 4, 28, 180, 2);
      ring(s, p.x + u.x * 20, p.y + u.y * 20, 16, arCol(), 180, 2);
    });
  } };
  FX.aroot = { post(def, x, y, dmg, fx, fy) {           // ธนูตรึงขา
    const s = this, p = s.player, u = unit(fx, fy);
    burst(s, p.x + u.x * 24, p.y + u.y * 24, GREEN, 6, 34, 260, 2);
    ring(s, p.x, p.y, 40, GREEN, 300, 2);
  } };
  FX.aheavy = { post(def, x, y, dmg, fx, fy) {          // ธนูเจาะเกราะ
    const s = this, p = s.player, u = unit(fx, fy);
    burst(s, p.x + u.x * 26, p.y + u.y * 26, 0xffe9a8, 8, 44, 260, 3);
    ring(s, p.x + u.x * 22, p.y + u.y * 22, 28, 0xffe9a8, 260, 3);
    streak(s, p.x, p.y, p.x + u.x * def.range, p.y + u.y * def.range, 0xffffff, 2, 200);
    shake(s, 100, 0.003);
  } };
  FX.arain = { pre(def, x, y) {                         // ฝนลูกศร: ตราเวทหมุนบนพื้น
    const s = this, pt = peekGround(s, def, x, y), col = arCol();
    const tot = (def.ticks - 1) * def.tickMs + 350;
    const g = s.add.graphics({ x: pt.x, y: pt.y }).setDepth(D - 1);
    g.lineStyle(3, col, 0.9);
    for (let k = 0; k < 8; k++) { g.beginPath(); g.arc(0, 0, def.range, k * PI / 4, k * PI / 4 + 0.5); g.strokePath(); }
    s.tweens.add({ targets: g, angle: 360, duration: tot, onComplete: kill(g) });
    s.tweens.add({ targets: g, alpha: 0, delay: Math.max(0, tot - 250), duration: 250 });
  } };
  FX.ault = { post(def, x, y, dmg, fx, fy) {            // ธนูทลวงฟ้า: ชาร์จดูดพลัง แล้วยิง
    const s = this, u = unit(fx, fy), p0 = s.player, col = arCol();
    const n = Q(10);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, PI * 2), c = s.add.circle(p0.x + Math.cos(a) * 100, p0.y + Math.sin(a) * 100, 4, i % 2 ? 0xffffff : col, 1).setDepth(D + 1);
      s.tweens.add({ targets: c, x: p0.x, y: p0.y, alpha: 0.2, duration: def.chargeMs, delay: i * 20, onComplete: kill(c) });
    }
    later(s, def.chargeMs, () => {
      const p = s.player;
      beam(s, p, u, def.range, def.halfW, col, 380);
      for (let i = 1; i <= 5; i++) burst(s, p.x + u.x * def.range * i / 5, p.y + u.y * def.range * i / 5, col, 5, 45, 320, 3);
      shake(s, 250, 0.008);
    });
  } };

  // ---------- โจร ----------
  FX.rdash = { post(def) {                              // เงาพุ่งฟัน
    const s = this, p0 = s.player;
    ring(s, p0.x, p0.y, 40, PURPLE, 260, 3);
    for (let i = 0; i < 6; i++) later(s, i * 28, () => ghost(s, s.player.x, s.player.y, 0x9b6bff));
    for (let i = 0; i < def.hits; i++) later(s, 70 + i * 90, () => {
      const p = s.player, a = rnd(0, PI * 2);
      arc(s, p.x, p.y, def.hitR * 0.7, a, a + 1.6, 0xd9b3ff, 5, 200);
      burst(s, p.x, p.y, 0xd9b3ff, 5, 40, 200, 2);
    });
  } };
  FX.rvanish = { post() {                               // เงาหายตัว
    const s = this, p = s.player;
    const puff = s.add.circle(p.x, p.y, 24, 0x4b2a8a, 0.5).setDepth(D);
    s.tweens.add({ targets: puff, scale: 2.4, alpha: 0, duration: 600, onComplete: kill(puff) });
    burst(s, p.x, p.y, 0x6b3fc4, 12, 60, 600, 6);
    ring(s, p.x, p.y, 60, PURPLE, 400, 3);
  } };
  FX.rslow = { post(def) {                              // ฟันตัดเอ็น
    const s = this, p = s.player;
    let u = facing(s);
    const t = s.target && s.target.active ? s.target : null;
    if (t && Math.hypot(t.x - p.x, t.y - p.y) > 1) u = unit(t.x - p.x, t.y - p.y);
    const a = Math.atan2(u.y, u.x);
    for (let k = -1; k <= 1; k++) arc(s, p.x, p.y, 48 + k * 10, a - 0.6, a + 0.6, k ? 0xd9b3ff : 0xffffff, 4, 220);
    burst(s, p.x + u.x * 55, p.y + u.y * 55, 0xd9b3ff, 6, 40, 260, 2);
  } };
  FX.rdrain = { post(def, x, y, dmg, fx, fy) {          // ฟันดูดเลือด
    const s = this, p = s.player, u = unit(fx, fy), a = Math.atan2(u.y, u.x);
    arc(s, p.x, p.y, def.range * 0.7, a - 0.5, a + 0.5, 0xff4d7a, 6, 260);
    arc(s, p.x, p.y, def.range * 0.5, a - 0.4, a + 0.4, 0xffffff, 3, 220);
    inBox(s, p, u, def.range, def.halfW).slice(0, 5).forEach((e, i) => {   // หยดเลือดไหลเข้าหาตัว
      burst(s, e.x, e.y, 0xff4d7a, 4, 30, 260, 3);
      const orb = s.add.circle(e.x, e.y, 5, 0xff4d7a, 1).setDepth(D + 1);
      s.tweens.add({ targets: orb, x: s.player.x, y: s.player.y, duration: 380, delay: 80 + i * 40, ease: 'Quad.easeIn', onComplete: kill(orb) });
    });
  } };
  FX.rult = { post(def) {                               // พายุใบมีด
    const s = this;
    for (let i = 0; i < def.hits; i++) later(s, i * def.gap, () => {
      const p = s.player;
      arc(s, p.x, p.y, def.range * 0.8, i * 1.5, i * 1.5 + 3, 0xff6b9a, 5, 220, 180);
      arc(s, p.x, p.y, def.range * 0.6, i * 1.5 + PI, i * 1.5 + PI + 3, 0xffffff, 3, 200, -180);
      ring(s, p.x, p.y, def.range, 0xff6b9a, 260, 3);
    });
    later(s, def.hits * def.gap, () => burst(s, s.player.x, s.player.y, 0xff6b9a, 12, def.range, 400, 3));
  } };

  // ---------- ครอบ Classes.handlers ----------
  Object.keys(FX).forEach(type => {
    const orig = C.handlers[type], f = FX[type];
    if (!orig) return;
    C.handlers[type] = function (def, x, y, dmg, fx, fy) {
      const s = this, p = s.player, from = p ? { x: p.x, y: p.y } : null;
      if (on() && f.pre) { try { f.pre.call(s, def, x, y, dmg, fx, fy, from); } catch (e) { console.error('skillFx pre', type, e); } }
      const r = orig.apply(this, arguments);
      if (on() && f.post) { try { f.post.call(s, def, x, y, dmg, fx, fy, from); } catch (e) { console.error('skillFx post', type, e); } }
      return r;
    };
  });

  // ======================================================================
  // พระ (priest.js ไม่ได้ใช้ Classes.handlers) + ฟันตรง/พุ่งทะยานของดาบ: ครอบ applySkillEffect
  // ======================================================================
  const PFX = {
    heal1(def, x, y) {
      const s = this, p = s.player;
      ring(s, p.x, p.y, 50, GREEN, 380, 3);
      for (let i = 0; i < Q(6); i++) {
        const t = s.add.text(p.x + rnd(-24, 24), p.y + rnd(-10, 14), '+', { fontSize: '20px', color: '#7dff9a', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 })
          .setOrigin(0.5).setDepth(D + 2);
        s.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 700, delay: i * 60, onComplete: kill(t) });
      }
    },
    healaoe(def, x, y) {
      const s = this, R = def.range;
      ring(s, x, y, R, GREEN, 420, 4);
      later(s, 120, () => ring(s, x, y, R * 0.6, 0xffffff, 320, 3));
      pillar(s, x, y + 20, 36, 180, GREEN, 420);
      for (let i = 0; i < Q(10); i++) {
        const a = rnd(0, PI * 2), r = Math.sqrt(Math.random()) * R;
        const c = s.add.circle(x + Math.cos(a) * r, y + Math.sin(a) * r, 3, i % 2 ? 0xffffff : GREEN, 1).setDepth(D + 1);
        s.tweens.add({ targets: c, y: c.y - 70, alpha: 0, duration: 800, delay: i * 40, onComplete: kill(c) });
      }
    },
    holy(def, x, y) {
      const s = this;
      pillar(s, x, y + 10, 50, 320, GOLD, 380);
      ring(s, x, y, def.range, 0xffd45e, 380, 4);
      burst(s, x, y, GOLD, 10, def.range * 0.7, 420, 3);
      shake(s, 100, 0.003);
    },
    haste(def) {
      const s = this, p = s.player, f = facing(s);
      ring(s, p.x, p.y, 60, CYAN, 380, 3);
      for (let i = 0; i < Q(6); i++) {
        const ox = p.x + rnd(-18, 18), oy = p.y + rnd(-22, 22);
        const g = s.add.graphics({ x: ox, y: oy }).setDepth(D);
        g.lineStyle(3, CYAN, 0.9); g.beginPath(); g.moveTo(0, 0); g.lineTo(-f.x * 26, -f.y * 26); g.strokePath();
        s.tweens.add({ targets: g, x: ox - f.x * 40, y: oy - f.y * 40, alpha: 0, duration: 350, delay: i * 40, onComplete: kill(g) });
      }
    },
    pulti(def, x, y) {
      const s = this, R = def.range;
      ring(s, x, y, R * 1.3, GOLD, 520, 6);
      ring(s, x, y, R * 0.8, 0xffffff, 380, 4);
      pillar(s, x, y + 20, 90, 420, GOLD, 520);
      const g = s.add.graphics({ x: x, y: y }).setDepth(D);      // รัศมีแสงหมุน
      g.lineStyle(4, GOLD, 0.9);
      for (let k = 0; k < 8; k++) { g.beginPath(); g.moveTo(Math.cos(k * PI / 4) * 20, Math.sin(k * PI / 4) * 20); g.lineTo(Math.cos(k * PI / 4) * R, Math.sin(k * PI / 4) * R); g.strokePath(); }
      s.tweens.add({ targets: g, angle: 90, alpha: 0, duration: 600, onComplete: kill(g) });
      burst(s, x, y, GOLD, 16, R, 560, 4);
      shake(s, 200, 0.006);
    },
  };
  const SFX = {
    slash(s) {                                                  // ฟันตรง (sw_slash)
      const p = s.player, u = facing(s), a = Math.atan2(u.y, u.x);
      arc(s, p.x, p.y, 50, a - 0.8, a + 0.8, GOLD, 6, 200);
      burst(s, p.x + u.x * 55, p.y + u.y * 55, 0xffd45e, 4, 30, 220, 2);
    },
    dash(s) {                                                   // พุ่งทะยาน (sw_dash)
      const p = s.player;
      ring(s, p.x, p.y, 40, GOLD, 260, 3);
      for (let i = 0; i < 6; i++) later(s, i * 30, () => ghost(s, s.player.x, s.player.y, 0xffd45e));
    },
  };

  const isLocal = (s, def) => {
    const now = s.time.now;
    return (s._plocal || []).some(e => now - e.t < 1500 && (e.def === def || (e.def.name === def.name && e.def.range === def.range)));
  };

  const _apply = P.applySkillEffect;
  if (_apply) {
    P.applySkillEffect = function (def, x, y, fx, fy, dmg, kind) {
      try {
        if (on() && def) {
          const h = PFX[def.type];
          if (h && isLocal(this, def)) { const pt = peekGround(this, def, x, y); h.call(this, def, pt.x, pt.y); }
          else if (window.SKILL_DEFS && def === SKILL_DEFS.sw_slash) SFX.slash(this);
          else if (window.SKILL_DEFS && def === SKILL_DEFS.sw_dash) SFX.dash(this);
        }
      } catch (e) { console.error('skillFx apply', e); }
      return _apply.apply(this, arguments);
    };
  }
})();
