// ===== เอฟเฟกต์โจมตีธรรมดา (ดาบ / โจร / ธนู / เมจ / พระ) — วาดด้วยโค้ด ไม่ต้องใช้รูปภาพ =====
// วางไฟล์นี้ต่อจาก priestFx.js และก่อน main.js ใน index.html
//   <script src="js/systems/basicFx.js?v=1"></script>
//
// ทำงานโดยครอบ applySkillEffect: ถ้าเป็นโจมตีธรรมดาของคลาสนั้น จะเล่นเอฟเฟกต์เพิ่มก่อน/หลังระบบเดิม
// (ไม่แตะดาเมจ/คูลดาวน์ใดๆ) ปรับหน้าตาได้ที่ตาราง CFG ด้านล่าง
//
// kind: swing = ฟันเป็นวงโค้ง | cross = ฟันไขว้ 2 ครั้ง | shot = ธนู | orb = ลูกเวท (มีแสง + หางตามกระสุน)
// color = สีหลัก | core = สีแกนสว่าง | r = ขนาดวงฟัน (เท่าของระยะโจมตี) | sweep = มุมกวาด (เรเดียน) | w = ความหนา | dur = ความเร็ว (ms)
// glow = ขนาดแสงรอบกระสุน | trail = ชนิดหางกระสุน (fx_glow = จุดแสง, fx_star = ประกาย) | halo = วงแสงตอนร่าย (พระ)
(function () {
  const P = Main.prototype;
  const ADD = Phaser.BlendModes.ADD;

  const CFG = {
    sword:  { kind: 'swing', color: 0xffc94a, core: 0xffffff, r: 0.95, sweep: 2.3, w: 10, dur: 200 },
    rogue:  { kind: 'cross', color: 0xb98cff, core: 0xffffff, r: 0.85, sweep: 1.8, w: 6,  dur: 150 },
    archer: { kind: 'shot',  color: 0x9dff8a, core: 0xffffff, glow: 0.45, trail: 'fx_glow' },
    mage:   { kind: 'orb',   color: 0x8fb6ff, core: 0xe0e8ff, glow: 0.9,  trail: 'fx_glow' },
    priest: { kind: 'orb',   color: 0xfff2a8, core: 0xffffff, glow: 0.9,  trail: 'fx_star', halo: true },
  };

  // ---------- ภาพพื้นฐาน (สร้างครั้งเดียวด้วย canvas) ----------
  function ensureTex(scene) {
    if (!scene.textures.exists('fx_glow')) {
      const t = scene.textures.createCanvas('fx_glow', 64, 64), g = t.getContext();
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.3, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      t.refresh();
    }
    if (!scene.textures.exists('fx_star')) {
      const t = scene.textures.createCanvas('fx_star', 48, 48), g = t.getContext();
      const gr = g.createRadialGradient(24, 24, 0, 24, 24, 14);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
      g.strokeStyle = '#fff'; g.lineCap = 'round';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(24, 3); g.lineTo(24, 45); g.moveTo(3, 24); g.lineTo(45, 24); g.stroke();
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(11, 11); g.lineTo(37, 37); g.moveTo(37, 11); g.lineTo(11, 37); g.stroke();
      t.refresh();
    }
  }

  // ---------- ตัวช่วยวาด ----------
  // เศษประกายกระจาย
  function burst(scene, x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 45 + Math.random() * 75;
      const c = scene.add.circle(x, y, 2 + Math.random() * 2, color, 1).setDepth(71).setBlendMode(ADD);
      scene.tweens.add({
        targets: c, x: x + Math.cos(a) * sp * 0.4, y: y + Math.sin(a) * sp * 0.4,
        alpha: 0, scale: 0.2, duration: 220 + Math.random() * 140, ease: 'Quad.easeOut',
        onComplete: () => c.destroy(),
      });
    }
  }

  // วงแหวนขยายออก
  function ring(scene, x, y, color, r0, r1, dur) {
    const c = scene.add.circle(x, y, r0).setStrokeStyle(2, color, 0.9).setDepth(70).setBlendMode(ADD);
    scene.tweens.add({ targets: c, scale: r1 / r0, alpha: 0, duration: dur, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
  }

  // แสงวาบ (ใช้ภาพ fx_glow ย้อมสี)
  function glowFlash(scene, x, y, color, s0, s1, dur) {
    const im = scene.add.image(x, y, 'fx_glow').setTint(color).setBlendMode(ADD).setDepth(70).setScale(s0);
    scene.tweens.add({ targets: im, scale: s1, alpha: 0, duration: dur, ease: 'Quad.easeOut', onComplete: () => im.destroy() });
  }

  // ฟันเป็นวงโค้ง: หัวคมกวาดไปข้างหน้า มีหางไล่เฉด | s = +1 / -1 ทิศกวาด
  function swing(scene, x, y, ang, o) {
    const g = scene.add.graphics().setDepth(70).setBlendMode(ADD);
    const s = o.dir || 1, t = { v: 0 }, N = 8, tail = o.sweep * 0.55;
    const draw = () => {
      g.clear();
      const head = ang - s * o.sweep / 2 + s * o.sweep * t.v;
      const fade = 1 - Math.max(0, (t.v - 0.6) / 0.4);
      for (let i = 0; i < N; i++) {
        const k = (i + 1) / N;
        const a0 = head - s * tail * (1 - i / N), a1 = head - s * tail * (1 - k);
        const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
        g.lineStyle(o.w * k, o.color, 0.6 * k * fade);
        g.beginPath(); g.arc(x, y, o.r, lo, hi, false); g.strokePath();
        g.lineStyle(o.w * k * 0.45, o.core, 0.95 * k * fade);
        g.beginPath(); g.arc(x, y, o.r, lo, hi, false); g.strokePath();
      }
    };
    draw();
    scene.tweens.add({ targets: t, v: 1, duration: o.dur, ease: 'Quad.easeOut', onUpdate: draw, onComplete: () => g.destroy() });
  }

  // กระสุนที่ระบบเดิมสร้างขึ้น: ใส่แสงรอบลูก + หางตามหลัง + ประกายตอนชน
  function dress(scene, pr, cfg) {
    if (!pr || !pr.active) return;
    const t0 = scene.time.now;
    const glow = scene.add.image(pr.x, pr.y, 'fx_glow').setTint(cfg.color).setBlendMode(ADD).setDepth(62).setScale(cfg.glow);
    const pulse = scene.tweens.add({ targets: glow, scale: cfg.glow * 1.25, yoyo: true, repeat: -1, duration: 150 });
    const fol = () => { if (pr.active) glow.setPosition(pr.x, pr.y); };
    scene.events.on('update', fol);
    const ev = scene.time.addEvent({
      delay: 36, loop: true,
      callback: () => {
        if (!pr.active) return;
        const d = scene.add.image(pr.x, pr.y, cfg.trail).setTint(cfg.color).setBlendMode(ADD).setDepth(61)
          .setScale(cfg.glow * 0.55).setAlpha(0.7);
        if (cfg.trail === 'fx_star') d.setRotation(Math.random() * 3);
        scene.tweens.add({ targets: d, alpha: 0, scale: 0.1, duration: 280, onComplete: () => d.destroy() });
      },
    });
    pr.once('destroy', () => {
      scene.events.off('update', fol);
      ev.remove(false);
      pulse.stop();
      const px = pr.x, py = pr.y;
      glow.destroy();
      if (scene.time.now - t0 < 1000) { burst(scene, px, py, cfg.color, 7); glowFlash(scene, px, py, cfg.color, 0.4, 1.1, 200); }
    });
  }

  // ---------- เอฟเฟกต์ก่อนระบบเดิม (ฟัน/ท่าร่าย) และคืนฟังก์ชันที่ทำหลังระบบเดิม (ใส่เอฟเฟกต์ให้กระสุน) ----------
  function before(scene, def, x, y, fx, fy, kind) {
    const cfg = CFG[kind];
    if (!cfg) return null;
    ensureTex(scene);

    let ux = fx || 0, uy = fy || 0;
    const l = Math.hypot(ux, uy);
    if (l < 0.001) { ux = 1; uy = 0; } else { ux /= l; uy /= l; }

    // ถ้าเป็นผู้เล่นเราเองและมีเป้าหมายอยู่ในระยะ ให้เอฟเฟกต์หันหาเป้า
    const p = scene.player, tg = scene.target && scene.target.active ? scene.target : null;
    const local = p && Math.hypot(p.x - x, p.y - y) < 40;
    let hit = null;
    if (tg && local && Math.hypot(tg.x - x, tg.y - y) <= (def.range || 60) + 12) hit = tg;
    if (hit && (cfg.kind === 'swing' || cfg.kind === 'cross')) {
      const dx = hit.x - x, dy = hit.y - y, d = Math.hypot(dx, dy);
      if (d > 1) { ux = dx / d; uy = dy / d; }
    }
    const ang = Math.atan2(uy, ux);
    const reach = Phaser.Math.Clamp(def.range || 60, 34, 90);
    const hx = x + ux * 14, hy = y + uy * 14 - 6;   // ตำแหน่งมือ/อาวุธ

    if (cfg.kind === 'swing') {
      swing(scene, x, y, ang, { r: reach * cfg.r, sweep: cfg.sweep, w: cfg.w, dur: cfg.dur, color: cfg.color, core: cfg.core, dir: 1 });
      if (hit) scene.time.delayedCall(cfg.dur * 0.45, () => { burst(scene, hit.x, hit.y, cfg.color, 7); glowFlash(scene, hit.x, hit.y, cfg.color, 0.4, 1.2, 180); });
    } else if (cfg.kind === 'cross') {
      swing(scene, x, y, ang - 0.4, { r: reach * cfg.r, sweep: cfg.sweep, w: cfg.w, dur: cfg.dur, color: cfg.color, core: cfg.core, dir: 1 });
      scene.time.delayedCall(80, () => {
        swing(scene, x, y, ang + 0.4, { r: reach * cfg.r, sweep: cfg.sweep, w: cfg.w, dur: cfg.dur, color: cfg.color, core: cfg.core, dir: -1 });
      });
      if (hit) scene.time.delayedCall(90, () => { burst(scene, hit.x, hit.y, cfg.color, 8); glowFlash(scene, hit.x, hit.y, cfg.color, 0.35, 1.1, 170); });
    } else if (cfg.kind === 'shot') {
      // ท่าง้างธนู: โค้งสั้นๆ + แสงวาบหน้าคัน
      swing(scene, x, y, ang, { r: 18, sweep: 1.5, w: 4, dur: 130, color: cfg.color, core: cfg.core, dir: 1 });
      glowFlash(scene, hx, hy, cfg.color, 0.25, 0.8, 160);
    } else if (cfg.kind === 'orb') {
      // ท่าร่ายเวท: วงแหวน + แสงวาบที่มือ (พระมีวงแสงและประกายเพิ่ม)
      ring(scene, hx, hy, cfg.color, 6, 30, 240);
      glowFlash(scene, hx, hy, cfg.color, 0.3, 1.0, 220);
      if (cfg.halo) {
        ring(scene, x, y + 6, cfg.color, 10, 44, 320);
        const st = scene.add.image(hx, hy, 'fx_star').setTint(cfg.core).setBlendMode(ADD).setDepth(70).setScale(0.4);
        scene.tweens.add({ targets: st, scale: 1.1, rotation: 1.2, alpha: 0, duration: 300, onComplete: () => st.destroy() });
      }
    }

    // หลังระบบเดิม: ใส่แสง/หางให้กระสุนที่เพิ่งถูกสร้าง (ถ้าระบบเดิมสร้างกระสุนผ่านกลุ่ม projectiles) ไม่เจอ = ธนูใช้ลูกศรของตัวเอง วาดเส้นลูกศรให้แทน
    const grp = scene.projectiles, n0 = grp && grp.getLength ? grp.getLength() : 0;
    if (cfg.kind === 'orb' || cfg.kind === 'shot') {
      return () => {
        if (grp && grp.getLength && grp.getLength() > n0) {
          const kids = grp.getChildren();
          dress(scene, kids[kids.length - 1], cfg);
        } else if (cfg.kind === 'shot') {
          const len = Math.min(def.range || 300, 300);
          const g = scene.add.graphics().setDepth(66).setBlendMode(ADD);
          g.lineStyle(4, cfg.color, 0.55); g.lineBetween(hx + ux * 14, hy + uy * 14, hx + ux * len, hy + uy * len);
          g.lineStyle(1.5, cfg.core, 0.95); g.lineBetween(hx + ux * 14, hy + uy * 14, hx + ux * len, hy + uy * len);
          scene.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
        }
      };
    }
    return null;
  }

  // เป็นโจมตีธรรมดาหรือไม่ (useBasicAttack ส่งค่าจาก BASIC_ATTACKS มาเป็น def และส่งชื่อคลาสเป็น kind)
  function basicKind(def, kind) {
    if (!def) return null;
    try {
      if (typeof BASIC_ATTACKS !== 'undefined') {
        const k = kind || def.class;
        if (k && BASIC_ATTACKS[k] === def) return k;
        const found = Object.keys(BASIC_ATTACKS).find(c => BASIC_ATTACKS[c] === def);
        if (found) return found;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  const _apply = P.applySkillEffect;
  P.applySkillEffect = function (def, x, y, fx, fy, dmg, kind) {
    let after = null;
    try {
      const k = basicKind(def, kind);
      if (k && CFG[k]) after = before(this, def, x, y, fx, fy, k);
    } catch (e) { console.error('basicFx', e); }
    const res = _apply.apply(this, arguments);
    try { if (after) after(); } catch (e) { console.error('basicFx after', e); }
    return res;
  };

  window.BasicFx = { CFG: CFG };
})();
