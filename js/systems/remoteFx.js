// ===== เอฟเฟกต์สกิล/โจมตีของ "ผู้เล่นอื่น" (ฝั่งคนดู) =====
// ปัญหาเดิม: skillFx.js / priestFx.js / basicFx.js ผูกกับ this.player (ตัวเราเอง) เท่านั้น
//            ผู้เล่นอื่นเลยเห็นแค่วงกลมสีเรียบๆ ไฟล์นี้ใช้ตารางเอฟเฟกต์เดิม (SkillFx.FX / PriestFx.FX / BasicFx.CFG)
//            แต่วางเอฟเฟกต์ที่ตัวผู้เล่นอื่นแทน และไม่แตะดาเมจ/ฮีลใดๆ
// วางไฟล์: js/systems/remoteFx.js  แล้วเพิ่มใน index.html ต่อจาก targetFix.js (ก่อน main.js)
//   <script src="js/systems/remoteFx.js?v=1"></script>
// network.js (showRemoteSkill) จะเรียก RemoteFx.play(scene, d, caster) ให้เอง ถ้าเล่นไม่ได้จะใช้วงกลมแบบเดิมแทน
(function () {
  const ADD = Phaser.BlendModes.ADD;

  const unit = (fx, fy) => {
    const l = Math.hypot(fx || 0, fy || 0);
    return l > 0.001 ? [fx / l, fy / l] : null;
  };
  const DIR_VEC = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };

  function casterPos(caster, d) {
    if (caster && caster.s && caster.s.active) return { x: caster.s.x, y: caster.s.y };
    return { x: d.x, y: d.y };
  }
  // ให้เอฟเฟกต์ตามตัวผู้เล่นอื่น (ไม่ใช่ตัวเรา)
  function followCaster(scene, s, caster, dy) {
    const fol = () => {
      if (!s.active) return;
      const c = caster && caster.s;
      if (c && c.active) s.setPosition(c.x, c.y + (dy || 0));
    };
    scene.events.on('update', fol);
    s.once('destroy', () => scene.events.off('update', fol));
  }

  // =====================================================================
  // 1) สกิลที่อยู่ในตาราง SkillFx.FX (ดาบ เมจ ธนู โจร + อัลติ)
  // =====================================================================
  function playSheet(scene, cfg, x, y, ang, def, tx, ty, caster) {
    const d = window.SkillFx.SHEETS[cfg.sheet];
    if (!d || !scene.anims.exists(cfg.sheet)) return;
    const R = def.range || 100;
    const base = d.rects ? d.maxW : (d.ring || d.fw * 0.8);
    let sc = cfg.fit ? (R * 2) / base * (cfg.fitMul || 1) : (cfg.scale || 1);
    if (cfg.byRange && d.peakW) sc = (R * 2 * (cfg.mul || 1)) / d.peakW;
    if (cfg.byHalfW && d.peakH && def.halfW) sc = (def.halfW * 2 * (cfg.mul || 1)) / d.peakH;
    const s = scene.add.sprite(x, y, cfg.sheet).setDepth(70).setScale(sc);
    if (d.ox) s.setOrigin(d.ox, d.oy || 0.5);
    else if (cfg.oy) s.setOrigin(0.5, cfg.oy);
    if (cfg.rotate) s.setRotation(ang);
    if (cfg.add) s.setBlendMode(ADD);
    s.play(cfg.sheet);
    s.once('animationcomplete', () => s.destroy());
    if (cfg.travel && tx !== undefined) scene.tweens.add({ targets: s, x: tx, y: ty, duration: cfg.travelMs || 200, ease: 'Quad.easeOut' });
    if (cfg.follow) followCaster(scene, s, caster, 0);
    s.setAlpha(0.2);
    scene.tweens.add({ targets: s, alpha: 1, duration: 60 });
    const life = (d.frames / d.fps) * 1000;
    if (life > 300) scene.tweens.add({ targets: s, alpha: 0, delay: life - 150, duration: 150 });
  }

  function playBolt(scene, cfg, p, ang, def, caster, late) {
    if (!scene.textures.exists(cfg.image)) return;
    const wait = cfg.delayField ? (def[cfg.delayField] || 0) : 0;
    if (wait > 0 && !late) {
      scene.time.delayedCall(wait, () => {
        const c = caster && caster.s && caster.s.active ? caster.s : p;
        playBolt(scene, cfg, { x: c.x, y: c.y }, ang, def, caster, true);
      });
      return;
    }
    const src = scene.textures.get(cfg.image).getSourceImage();
    const len = (def.range || 300) + 20, hh = (def.halfW || 50) * 2 * (cfg.heightMul || 1.3);
    const s = scene.add.image(p.x, p.y, cfg.image).setOrigin(0, 0.5).setDepth(70)
      .setRotation(ang).setBlendMode(ADD);
    const sx = len / src.width, sy = hh / src.height;
    s.setScale(sx * 0.15, sy);
    scene.tweens.add({ targets: s, scaleX: sx, duration: 90, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: s, alpha: 0, delay: 130 + (cfg.hold || 0), duration: 260, onComplete: () => s.destroy() });
  }

  function playSkillFx(scene, key, def, d, caster, ux, uy) {
    const cfg = window.SkillFx.FX[key];
    const ang = Math.atan2(uy, ux);
    const cp = casterPos(caster, d);
    if (cfg.bolt) { playBolt(scene, cfg, cp, ang, def, caster, false); return true; }
    let px = cp.x, py = cp.y;
    if (cfg.at === 'front') {
      const dd = cfg.distRange ? (def.range || 100) * cfg.distRange : (cfg.dist || 0);
      px += ux * dd; py += uy * dd;
    } else if (cfg.at === 'ground') {
      px = d.x; py = d.y;                       // จุดตกที่เซิร์ฟเวอร์ส่งมา
    }
    let tx, ty;
    if (cfg.travel) { tx = px; ty = py; px = cp.x + ux * (cfg.startDist || 0); py = cp.y + uy * (cfg.startDist || 0); }
    const n = cfg.times ? (def[cfg.times] || 1) : 1;
    const gap = cfg.every ? (def[cfg.every] || 0) : 0;
    for (let i = 0; i < n; i++) {
      const wait = (cfg.delay || 0) + i * gap;
      if (wait <= 0) playSheet(scene, cfg, px, py, ang, def, tx, ty, caster);
      else scene.time.delayedCall(wait, () => playSheet(scene, cfg, px, py, ang, def, tx, ty, caster));
    }
    if (cfg.arrive) scene.time.delayedCall(150, () => {
      const c = casterPos(caster, d);
      playSheet(scene, cfg, c.x, c.y, ang, def, undefined, undefined, caster);
    });
    return true;
  }

  // กระสุนสกิล (ลูกศรนักธนู)
  function playProj(scene, def, d, caster, ux, uy) {
    const SF = window.SkillFx;
    if (!SF || !SF.arrow) return false;
    const cp = casterPos(caster, d);
    const dist = def.range || 462, dur = Math.max(300, dist / 420 * 1000);
    const s = SF.arrow(scene, def, cp.x, cp.y, ux, uy, dist, dur, false);
    if (!s) return false;
    scene.tweens.add({ targets: s, x: cp.x + ux * dist, y: cp.y + uy * dist, duration: dur, onComplete: () => s.destroy() });
    return true;
  }

  // =====================================================================
  // 2) สกิลสายพระ (ตาราง PriestFx.FX ตาม def.type)
  // =====================================================================
  function prEnsure(scene, key) {
    const D = window.PriestFx.SHEETS[key];
    if (!D || !scene.textures.exists(key)) return false;
    if (!scene.anims.exists(key)) {
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const frames = scene.anims.generateFrameNumbers(key, { start: 0, end: D.frames - 1 });
      scene.anims.create({ key: key, frameRate: D.fps, repeat: 0, frames: frames });
      scene.anims.create({ key: key + '_loop', frameRate: D.fps, repeat: -1, frames: frames });
    }
    return true;
  }

  function playPriest(scene, def, d, caster, ux, uy) {
    const PF = window.PriestFx;
    const cp = casterPos(caster, d);
    if (def.type === 'lightbeam') {          // พลังแห่งแสง
      const B = PF.BEAM;
      if (!B || !scene.textures.exists(B.image)) return false;
      const src = scene.textures.get(B.image).getSourceImage();
      const len = (def.range || 300) + 20, hh = (def.halfW || 80) * 2 * B.heightMul;
      const s = scene.add.image(cp.x, cp.y, B.image).setOrigin(0, 0.5).setDepth(70).setRotation(Math.atan2(uy, ux));
      if (B.add) s.setBlendMode(ADD);
      const sx = len / src.width, sy = hh / src.height;
      s.setScale(sx * 0.12, sy).setAlpha(0.3);
      scene.tweens.add({ targets: s, scaleX: sx, alpha: 1, duration: B.grow, ease: 'Quad.easeOut' });
      scene.tweens.add({ targets: s, alpha: 0, delay: B.grow + B.hold, duration: B.fade, onComplete: () => s.destroy() });
      return true;
    }
    const cfg = PF.FX[def.type];
    if (!cfg || !prEnsure(scene, cfg.sheet)) return false;
    const D = PF.SHEETS[cfg.sheet];
    let px = cp.x, py = cp.y;
    if (cfg.at === 'ground') { px = d.x; py = d.y; }
    const R = def.range || 100;
    const sc = cfg.diam ? cfg.diam / D.ring : (cfg.fit ? (R * 2 * (cfg.fitMul || 1)) / D.ring : (cfg.scale || 1));
    const sy = sc * (cfg.sy || 1), top = cfg.alpha || 1, dy = cfg.dy || 0;
    const s = scene.add.sprite(px, py + dy, cfg.sheet).setOrigin(0.5, D.oy).setDepth(cfg.loop ? 69 : 70)
      .setScale(sc * 0.85, sy * 0.85).setAlpha(0);
    if (cfg.add) s.setBlendMode(ADD);
    scene.tweens.add({ targets: s, alpha: top, scaleX: sc, scaleY: sy, duration: 150, ease: 'Quad.easeOut' });
    if (cfg.lasting || cfg.loop) {
      const dur = cfg.lasting ? Math.max(500, (def.ticks || 1) * (def.tickMs || 1000)) : (def.dur || 5000);
      s.play(cfg.sheet + '_loop');
      if (cfg.loop) followCaster(scene, s, caster, dy);
      scene.tweens.add({ targets: s, alpha: 0, delay: Math.max(300, dur - 350), duration: 350, onComplete: () => s.active && s.destroy() });
    } else {
      s.play(cfg.sheet);
      s.once('animationcomplete', () => s.destroy());
      const life = (D.frames / D.fps) * 1000;
      scene.tweens.add({ targets: s, alpha: 0, delay: Math.max(0, life - 130), duration: 130 });
    }
    return true;
  }

  // =====================================================================
  // 3) โจมตีธรรมดา (ตาราง BasicFx.CFG)
  // =====================================================================
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
  function ring(scene, x, y, color, r0, r1, dur) {
    const c = scene.add.circle(x, y, r0).setStrokeStyle(2, color, 0.9).setDepth(70).setBlendMode(ADD);
    scene.tweens.add({ targets: c, scale: r1 / r0, alpha: 0, duration: dur, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
  }
  function glowFlash(scene, x, y, color, s0, s1, dur) {
    const im = scene.add.image(x, y, 'fx_glow').setTint(color).setBlendMode(ADD).setDepth(70).setScale(s0);
    scene.tweens.add({ targets: im, scale: s1, alpha: 0, duration: dur, ease: 'Quad.easeOut', onComplete: () => im.destroy() });
  }
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
  // กระสุนธนู/เวท (วาดเองด้วยแสง + หาง)
  function remoteShot(scene, cfg, def, x, y, ux, uy) {
    const dist = def.range ? Math.min(def.range, 462) : 400;
    const dur = Math.max(250, dist / 420 * 1000);
    const s = scene.add.image(x, y, 'fx_glow').setTint(cfg.color).setBlendMode(ADD).setDepth(62).setScale(cfg.glow);
    if (cfg.kind === 'shot') s.setScale(cfg.glow * 1.6, cfg.glow * 0.5).setRotation(Math.atan2(uy, ux));
    const ev = scene.time.addEvent({
      delay: 36, loop: true,
      callback: () => {
        if (!s.active) return;
        const t = scene.add.image(s.x, s.y, cfg.trail).setTint(cfg.color).setBlendMode(ADD).setDepth(61)
          .setScale(cfg.glow * 0.55).setAlpha(0.7);
        scene.tweens.add({ targets: t, alpha: 0, scale: 0.1, duration: 280, onComplete: () => t.destroy() });
      },
    });
    scene.tweens.add({
      targets: s, x: x + ux * dist, y: y + uy * dist, duration: dur,
      onComplete: () => { ev.remove(false); burst(scene, s.x, s.y, cfg.color, 7); glowFlash(scene, s.x, s.y, cfg.color, 0.4, 1.1, 200); s.destroy(); },
    });
  }

  function playBasic(scene, cls, def, d, caster, ux, uy) {
    const BF = window.BasicFx;
    const cfg = BF && BF.CFG && BF.CFG[cls];
    if (!cfg) return false;
    ensureTex(scene);
    const cp = casterPos(caster, d), x = cp.x, y = cp.y;
    const ang = Math.atan2(uy, ux);
    const reach = Phaser.Math.Clamp(def.range || 60, 34, 90);
    const hx = x + ux * 14, hy = y + uy * 14 - 6;
    if (cfg.kind === 'swing') {
      swing(scene, x, y, ang, { r: reach * cfg.r, sweep: cfg.sweep, w: cfg.w, dur: cfg.dur, color: cfg.color, core: cfg.core, dir: 1 });
    } else if (cfg.kind === 'cross') {
      swing(scene, x, y, ang - 0.4, { r: reach * cfg.r, sweep: cfg.sweep, w: cfg.w, dur: cfg.dur, color: cfg.color, core: cfg.core, dir: 1 });
      scene.time.delayedCall(80, () => swing(scene, x, y, ang + 0.4, { r: reach * cfg.r, sweep: cfg.sweep, w: cfg.w, dur: cfg.dur, color: cfg.color, core: cfg.core, dir: -1 }));
    } else if (cfg.kind === 'shot') {
      swing(scene, x, y, ang, { r: 18, sweep: 1.5, w: 4, dur: 130, color: cfg.color, core: cfg.core, dir: 1 });
      glowFlash(scene, hx, hy, cfg.color, 0.25, 0.8, 160);
      remoteShot(scene, cfg, def, hx, hy, ux, uy);
    } else if (cfg.kind === 'orb') {
      ring(scene, hx, hy, cfg.color, 6, 30, 240);
      glowFlash(scene, hx, hy, cfg.color, 0.3, 1.0, 220);
      if (cfg.halo) ring(scene, x, y + 6, cfg.color, 10, 44, 320);
      remoteShot(scene, cfg, def, hx, hy, ux, uy);
    }
    return true;
  }

  // =====================================================================
  // ทางเข้าหลัก: คืน true ถ้าเล่นเอฟเฟกต์ได้ (network.js จะไม่ใช้วงกลมสำรอง)
  // d = ข้อมูลจากเซิร์ฟเวอร์ { id, name, x, y, fx, fy } | caster = ผู้เล่นอื่นที่ร่าย (others[id]) หรือ null
  // =====================================================================
  function play(scene, d, caster) {
    if (!scene || !d) return false;
    const name = String(d.name || '');
    let kind = 'skill', cls = null, def = null;
    if (name.indexOf('ulti_') === 0) {
      kind = 'ulti'; cls = name.slice(5);
      def = typeof ULTI_DEFS !== 'undefined' ? ULTI_DEFS[cls] : null;
    } else if (name.indexOf('basic_') === 0) {
      kind = 'basic'; cls = name.slice(6);
      def = typeof BASIC_ATTACKS !== 'undefined' ? BASIC_ATTACKS[cls] : null;
    } else {
      def = typeof SKILL_DEFS !== 'undefined' ? SKILL_DEFS[name] : null;
    }
    if (!def) return false;

    let ux = 1, uy = 0;
    const u = unit(d.fx, d.fy);
    if (u) { ux = u[0]; uy = u[1]; }
    else if (caster && DIR_VEC[caster._dir]) { ux = DIR_VEC[caster._dir][0]; uy = DIR_VEC[caster._dir][1]; }

    if (kind === 'basic') return playBasic(scene, cls, def, d, caster, ux, uy);

    const SF = window.SkillFx, PF = window.PriestFx;
    const key = (SF && SF.FX)
      ? ((def.id && SF.FX[def.id]) ? def.id : ((def.name && SF.FX[def.name]) ? def.name : null))
      : null;
    if (key) return playSkillFx(scene, key, def, d, caster, ux, uy);
    if (def.type === 'proj') return playProj(scene, def, d, caster, ux, uy);
    if (PF && PF.FX && (PF.FX[def.type] || def.type === 'lightbeam')) return playPriest(scene, def, d, caster, ux, uy);
    return false;
  }

  window.RemoteFx = { play: play };
})();
