// ===== เอฟเฟกต์สกิลสายพระ (สไปรต์ชีต) =====
// วางไฟล์นี้ต่อจาก skillFx.js และก่อน main.js ใน index.html
//   <script src="js/systems/priestFx.js?v=1"></script>
//
// ภาพทุกแผ่นถูกจัดเฟรมใหม่ให้ขนาดเท่ากัน + จุดยึดตรงกันทุกเฟรม (เล่นแล้วไม่สั่น/ไม่กระตุก)
// ring = ความกว้างวงเวทที่ฐานในภาพ (px) ใช้ปรับขนาดให้พอดีกับรัศมีสกิล
// oy = ตำแหน่งจุดกึ่งกลางวงเวทในภาพ (0-1 จากบน) -> วางที่พื้นตรงจุดสกิลพอดี
//
// ปรับขนาด: diam = เส้นผ่านศูนย์กลางวงเวทที่ต้องการ (px) | fit + fitMul = ตามรัศมีสกิล (def.range*2*fitMul)
//           sy = บีบความสูงเสาแสง (ยิ่งน้อยยิ่งเตี้ย) | add = สีสว่างขึ้น (ADD) | follow = ตามตัวผู้เล่น
(function () {
  const P = Main.prototype;
  const GREEN = 0x7dff9a, GOLD = 0xfff2a8, CYAN = 0x9fe8ff, WHITE = 0xffffff;

  const SHEETS = {
    pr_heal:  { file: 'img/fx/pr_heal.png',  fw: 170, fh: 305, frames: 14, fps: 20, oy: 0.8262, ring: 144 },
    pr_mass:  { file: 'img/fx/pr_mass.png',  fw: 180, fh: 315, frames: 14, fps: 20, oy: 0.8381, ring: 163 },
    pr_smite: { file: 'img/fx/pr_smite.png', fw: 176, fh: 377, frames: 14, fps: 24, oy: 0.8992, ring: 141 },
    pr_ulti:  { file: 'img/fx/pr_ulti.png',  fw: 198, fh: 298, frames: 14, fps: 22, oy: 0.5201, ring: 189 },
    pr_haste: { file: 'img/fx/pr_haste.png', fw: 172, fh: 260, frames: 14, fps: 18, oy: 0.8462, ring: 151 },
  };

  // เลือกตามชนิดสกิล (def.type ใน priest.js)
  const FX = {
    heal1:   { sheet: 'pr_heal',  at: 'self',   diam: 80, follow: true, behind: true, dy: 20, alpha: 0.85, add: false },                         // ฮีลเดี่ยว
    healaoe: { sheet: 'pr_mass',  at: 'ground', fit: true, fitMul: 0.85, sy: 0.6, add: false },              // ฮีลหมู่
    holy:    { sheet: 'pr_smite', at: 'ground', fit: true, fitMul: 0.8,  sy: 0.6, add: true },               // แสงพิพากษา
    pulti:   { sheet: 'pr_ulti',  at: 'ground', fit: true, fitMul: 1.0,  add: true },                        // อัลติแสงสวรรค์
    haste:   { sheet: 'pr_haste', at: 'self',   diam: 64, sy: 0.75, loop: true, behind: true, dy: 20, alpha: 0.6, add: false },                          // พรแห่งลม (วนตามตัวตลอดบัพ)
  };
  const SKIP_COLORS = [GREEN, GOLD, CYAN, WHITE];

  // ---- สร้างอนิเมชัน (สร้างตอนเล่นครั้งแรก ไม่ต้องรอโหลดเสร็จ) ----
  function ensure(scene, key) {
    if (!scene.textures.exists(key)) return false;
    if (!scene.anims.exists(key)) {
      const d = SHEETS[key];
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const frames = scene.anims.generateFrameNumbers(key, { start: 0, end: d.frames - 1 });
      scene.anims.create({ key: key, frameRate: d.fps, repeat: 0, frames: frames });
      scene.anims.create({ key: key + '_loop', frameRate: d.fps, repeat: -1, frames: frames });
    }
    return true;
  }

  function loadSheets(scene) {
    let need = false;
    Object.keys(SHEETS).forEach(k => {
      if (scene.textures.exists(k)) return;
      const d = SHEETS[k];
      scene.load.spritesheet(k, d.file + '?v=1', { frameWidth: d.fw, frameHeight: d.fh });
      need = true;
    });
    if (need) scene.load.start();
  }

  const _sb = P.setupButtons;
  P.setupButtons = function () { _sb.call(this); loadSheets(this); };

  // ---- ตัวช่วย ----
  function scaleOf(cfg, d, def) {
    if (cfg.diam) return cfg.diam / d.ring;
    if (cfg.fit) return (def.range * 2 * (cfg.fitMul || 1)) / d.ring;
    return cfg.scale || 1;
  }

  // จุดตกที่ลากเล็ง (ดูเฉยๆ ไม่ดึงออกจากคิว เพราะ priest.js / aimDash.js จะดึงเอง)
  function peekGround(scene, def, x, y) {
    const q = scene._groundQ;
    if (q && q.length) {
      const e = q.find(e => e.def === def || (e.def.name === def.name && e.def.range === def.range));
      if (e) return { x: e.x, y: e.y };
    }
    return { x: x, y: y };
  }

  // dy = เลื่อนลงมาที่เท้า | behind = วาดไว้หลังตัวละคร (ไม่ทับตัว)
  function followPlayer(scene, s, cfg) {
    const dy = (cfg && cfg.dy) || 0;
    const fol = () => {
      if (!s.active || !scene.player) return;
      s.setPosition(scene.player.x, scene.player.y + dy);
      if (cfg && cfg.behind) s.setDepth((scene.player.depth || 0) - 0.01);
    };
    scene.events.on('update', fol);
    s.once('destroy', () => scene.events.off('update', fol));
  }

  // เล่นครั้งเดียว: ผุดขึ้นนุ่มๆ -> เล่นเฟรม -> เฟดออกท้ายเฟรม
  function playOnce(scene, cfg, x, y, def, nearPlayer) {
    const d = SHEETS[cfg.sheet];
    const sc = scaleOf(cfg, d, def), sy = sc * (cfg.sy || 1);
    const top = cfg.alpha || 1;
    const s = scene.add.sprite(x, y + (cfg.dy || 0), cfg.sheet).setOrigin(0.5, d.oy).setDepth(70)
      .setScale(sc * 0.85, sy * 0.85).setAlpha(0);
    if (cfg.add) s.setBlendMode(Phaser.BlendModes.ADD);
    s.play(cfg.sheet);
    s.once('animationcomplete', () => s.destroy());
    if (cfg.follow && nearPlayer) followPlayer(scene, s, cfg);
    scene.tweens.add({ targets: s, alpha: top, scaleX: sc, scaleY: sy, duration: 120, ease: 'Quad.easeOut' });
    const life = (d.frames / d.fps) * 1000;
    scene.tweens.add({ targets: s, alpha: 0, delay: Math.max(0, life - 130), duration: 130 });
  }

  // วนต่อเนื่องตามบัพ (พรแห่งลม): ผุดขึ้น -> วนตามตัว -> เฟดหายตอนบัพหมด
  function playAura(scene, cfg, x, y, def, nearPlayer) {
    const d = SHEETS[cfg.sheet];
    if (!nearPlayer) { playOnce(scene, cfg, x, y, def, false); return; }   // ของผู้เล่นอื่น: เล่นรอบเดียวพอ
    if (scene._hasteFx && scene._hasteFx.active) scene._hasteFx.destroy();   // ร่ายซ้ำ = รีเฟรช ไม่ซ้อนกัน
    const sc = scaleOf(cfg, d, def), sy = sc * (cfg.sy || 1);
    const s = scene.add.sprite(x, y + (cfg.dy || 0), cfg.sheet).setOrigin(0.5, d.oy).setDepth(69)
      .setScale(sc * 0.8, sy * 0.8).setAlpha(0);
    if (cfg.add) s.setBlendMode(Phaser.BlendModes.ADD);
    s.play(cfg.sheet + '_loop');
    followPlayer(scene, s, cfg);
    scene._hasteFx = s;
    const dur = def.dur || 5000;
    scene.tweens.add({ targets: s, alpha: cfg.alpha || 0.9, scaleX: sc, scaleY: sy, duration: 250, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: s, alpha: 0, delay: Math.max(300, dur - 400), duration: 400, onComplete: () => s.active && s.destroy() });
  }

  // ---- ต่อเข้ากับ applySkillEffect (ครอบนอกสุด: เล่นภาพก่อน แล้วค่อยให้ priest.js คิดฮีล/ดาเมจตามเดิม) ----
  const _flash = P.flash;
  P.flash = function (x, y, r, color) {
    const k = this._prFxSkip;
    // priest.js วาดวงกลมสีเรียบๆ ตรงจุดสกิล -> ข้าม เพื่อไม่ให้ซ้อนกับสไปรต์ใหม่
    if (k && this.time.now < k.until && Math.abs(x - k.x) < 2 && Math.abs(y - k.y) < 2 && SKIP_COLORS.indexOf(color) >= 0) return;
    return _flash.apply(this, arguments);
  };

  const _apply = P.applySkillEffect;
  P.applySkillEffect = function (def, x, y) {
    try {
      const cfg = def && FX[def.type];
      if (cfg && this.player && ensure(this, cfg.sheet)) {
        const p = this.player;
        let px = p.x, py = p.y;
        if (cfg.at === 'ground') { const g = peekGround(this, def, x, y); px = g.x; py = g.y; }
        const near = Math.hypot(px - p.x, py - p.y) < 40;   // เกิดที่ตัวเรา = ของเราเอง (ตามตัวได้)
        this._prFxSkip = { x: px, y: py, until: this.time.now + 400 };
        if (cfg.loop) playAura(this, cfg, px, py, def, near);
        else playOnce(this, cfg, px, py, def, near);
      }
    } catch (e) { console.error('priestFx', e); }
    return _apply.apply(this, arguments);
  };

  window.PriestFx = { FX: FX, SHEETS: SHEETS };
})();
