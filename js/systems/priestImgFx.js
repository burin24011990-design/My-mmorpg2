// ===== เอฟเฟกต์สกิลพระแบบ "ภาพนิ่ง + Phaser ขยับเอง" =====
// วางหลัง priestFx.js ใน index.html (ก่อน main.js):
//   <script src="js/systems/priestImgFx.js?v=1"></script>
// ภาพอยู่ที่ img/skillimg/pr_*_i.png
//
// เลือกเอฟเฟกต์ตามชนิดสกิล (def.type ใน priest.js) เหมือน priestFx.js เดิม
//   healaoe = ฮีลหมู่ | holy = แสงพิพากษา (ค้างตลอด ticks x tickMs) | pulti = อัลติแสงสวรรค์
//   haste = พรแห่งลม (ตามตัวตลอดบัพ) | lightbeam = พลังแห่งแสง (ลำแสง)
// ox, oy = จุดยึดในภาพ (0-1) | w(def) = ความกว้างภาพที่แสดง (px) | sy = บีบความสูง (น้อย = เตี้ย)
// ถ้าภาพใหญ่/เล็กไป แก้ตัวคูณใน w() | ภาพโหลดไม่ขึ้น = กลับไปใช้เอฟเฟกต์เดิมของ priestFx.js
(function () {
  const P = Main.prototype;
  const PF = window.PriestFx;
  if (!PF || !PF.FX) { console.error('priestImgFx: ต้องโหลดหลัง priestFx.js (ไม่พบ PriestFx)'); return; }

  const DIR = 'img/skillimg/';
  const MAX_FX = 10;   // เอฟเฟกต์พระพร้อมกันสูงสุด (กันแลคบนมือถือ)

  const IMG = {
    mass:  { file: 'pr_mass_i.png',  ox: 0.509, oy: 0.816 },   // ฮีลหมู่ (กลางวงเวทพื้น)
    smite: { file: 'pr_smite_i.png', ox: 0.503, oy: 0.822 },   // เสาแสงพิพากษา (กลางวงเวทพื้น)
    ulti:  { file: 'pr_ulti_i.png',  ox: 0.501, oy: 0.501 },   // ปีกนางฟ้าระเบิดแสง (กลางภาพ)
    haste: { file: 'pr_haste_i.png', ox: 0.504, oy: 0.839 },   // พายุลมรอบเท้า (กลางวงฐาน)
    beam:  { file: 'pr_beam_i.png',  ox: 0.121, oy: 0.49  },   // ลำแสง (ยึดที่วงเวทซ้าย = ตัวผู้เล่น)
  };

  const FX = {
    healaoe: { img: 'mass',  at: 'ground', w: d => d.range * 1.85, sy: 0.6,  anim: 'once', life: 700 },
    holy:    { img: 'smite', at: 'ground', w: d => d.range * 1.7,  sy: 0.6,  anim: 'lasting' },
    pulti:   { img: 'ulti',  at: 'ground', w: d => d.range * 2.2,  sy: 1,    anim: 'once', life: 900 },
    haste:   { img: 'haste', at: 'self',   w: d => 90,             sy: 0.8,  anim: 'aura', dy: 20 },
  };

  // เก็บเอฟเฟกต์เดิมของ priestFx.js ไว้ | ตอนภาพใหม่พร้อมใช้ จะซ่อนของเดิมชั่วคราวเฉพาะรอบนั้น (ไม่ให้เล่นซ้อน)
  // ถ้าภาพใหม่โหลดไม่ขึ้น ของเดิมยังเล่นตามปกติ
  const SAVED = {};
  ['healaoe', 'holy', 'pulti', 'haste'].forEach(k => { SAVED[k] = PF.FX[k]; });
  const BEAM_IMAGE = PF.BEAM && PF.BEAM.image;

  const has = (scene, k) => scene.textures.exists('pri_' + k);

  function loadImgs(scene) {
    let need = false;
    Object.keys(IMG).forEach(k => {
      if (scene.textures.exists('pri_' + k)) return;
      scene.load.image('pri_' + k, DIR + IMG[k].file + '?v=1');
      need = true;
    });
    if (!need) return;
    scene.load.once('complete', () => {
      Object.keys(IMG).forEach(k => {
        if (scene.textures.exists('pri_' + k)) scene.textures.get('pri_' + k).setFilter(Phaser.Textures.FilterMode.LINEAR);
      });
    });
    scene.load.start();
  }
  const _sb = P.setupButtons;
  P.setupButtons = function () { _sb.call(this); loadImgs(this); };

  // สร้างภาพ 1 ใบ | คืน null ถ้าเอฟเฟกต์เต็ม | s._sc = สเกลกว้าง, s._sy = สเกลสูง
  function spawn(scene, k, x, y, w, sy, depth) {
    if ((scene._prFxN || 0) >= MAX_FX) return null;
    const c = IMG[k], t = 'pri_' + k;
    const sc = w / scene.textures.get(t).getSourceImage().width;
    const s = scene.add.image(x, y, t).setOrigin(c.ox, c.oy).setDepth(depth || 70)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(sc, sc * sy);
    s._sc = sc; s._sy = sc * sy;
    scene._prFxN = (scene._prFxN || 0) + 1;
    s.once('destroy', () => { scene._prFxN = Math.max(0, (scene._prFxN || 1) - 1); });
    return s;
  }
  const kill = s => { if (s && s.active) s.destroy(); };

  function peekGround(scene, def, x, y) {
    const q = scene._groundQ;
    if (q && q.length) {
      const e = q.find(e => e.def === def || (e.def.name === def.name && e.def.range === def.range));
      if (e) return { x: e.x, y: e.y };
    }
    return { x: x, y: y };
  }

  function followPlayer(scene, s, dy, behind) {
    const fol = () => {
      if (!s.active || !scene.player) return;
      s.setPosition(scene.player.x, scene.player.y + dy);
      if (behind) s.setDepth((scene.player.depth || 0) - 0.01);
    };
    scene.events.on('update', fol);
    s.once('destroy', () => scene.events.off('update', fol));
  }

  // เล่นครั้งเดียว: ผุดนุ่มๆ -> ค้าง -> เฟดออก
  function playOnce(scene, cfg, x, y, def) {
    const s = spawn(scene, cfg.img, x, y, cfg.w(def), cfg.sy);
    if (!s) return;
    s.setScale(s._sc * 0.85, s._sy * 0.85).setAlpha(0);
    scene.tweens.add({ targets: s, alpha: 1, scaleX: s._sc, scaleY: s._sy, duration: 140, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: s, alpha: 0, delay: Math.max(200, cfg.life - 220), duration: 220, onComplete: () => kill(s) });
  }

  // ค้างที่จุดสกิลตลอด ticks x tickMs (แสงพิพากษา): ผุด -> หายใจเบาๆ -> เฟดออก
  function playLasting(scene, cfg, x, y, def) {
    const s = spawn(scene, cfg.img, x, y, cfg.w(def), cfg.sy);
    if (!s) return;
    const dur = Math.max(500, (def.ticks || 1) * (def.tickMs || 1000));
    s.setScale(s._sc * 0.85, s._sy * 0.85).setAlpha(0);
    scene.tweens.add({ targets: s, alpha: 1, scaleX: s._sc, scaleY: s._sy, duration: 220, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: s, alpha: 0.8, yoyo: true, repeat: -1, duration: 480, delay: 260, ease: 'Sine.easeInOut' });
    scene.time.delayedCall(Math.max(300, dur - 300), () => {
      if (!s.active) return;
      scene.tweens.killTweensOf(s);
      scene.tweens.add({ targets: s, alpha: 0, duration: 300, onComplete: () => kill(s) });
    });
  }

  // ออร่าตามตัวตลอดบัพ (พรแห่งลม): ผุด -> หายใจ -> เฟดตอนบัพหมด
  function playAura(scene, cfg, def) {
    if (!scene.player) return;
    if (scene._hasteImg && scene._hasteImg.active) scene._hasteImg.destroy();   // ร่ายซ้ำ = รีเฟรช ไม่ซ้อน
    const p = scene.player;
    const s = spawn(scene, cfg.img, p.x, p.y + cfg.dy, cfg.w(def), cfg.sy, 69);
    if (!s) return;
    scene._hasteImg = s;
    const dur = def.dur || 5000;
    s.setScale(s._sc * 0.8, s._sy * 0.8).setAlpha(0);
    followPlayer(scene, s, cfg.dy, true);
    scene.tweens.add({ targets: s, alpha: 0.85, scaleX: s._sc, scaleY: s._sy, duration: 260, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: s, alpha: 0.6, scaleX: s._sc * 1.06, yoyo: true, repeat: -1, duration: 520, delay: 280, ease: 'Sine.easeInOut' });
    scene.time.delayedCall(Math.max(400, dur - 400), () => {
      if (!s.active) return;
      scene.tweens.killTweensOf(s);
      scene.tweens.add({ targets: s, alpha: 0, duration: 400, onComplete: () => kill(s) });
    });
  }

  // ลำแสงพลังแห่งแสง: ยืดจากตัวไปสุดระยะ ค้างแล้วเฟด
  function playBeam(scene, def, p, ux, uy) {
    if ((scene._prFxN || 0) >= MAX_FX) return;
    const c = IMG.beam, t = 'pri_beam', src = scene.textures.get(t).getSourceImage();
    const sx = (def.range + 20) / ((1 - c.ox) * src.width);
    const sy = ((def.halfW || 80) * 2 * 0.95) / src.height;
    const s = scene.add.image(p.x, p.y, t).setOrigin(c.ox, c.oy).setDepth(70).setBlendMode(Phaser.BlendModes.ADD)
      .setRotation(Math.atan2(uy, ux)).setScale(sx * 0.12, sy).setAlpha(0.3);
    scene._prFxN = (scene._prFxN || 0) + 1;
    s.once('destroy', () => { scene._prFxN = Math.max(0, (scene._prFxN || 1) - 1); });
    scene.tweens.add({ targets: s, scaleX: sx, alpha: 1, duration: 120, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: s, alpha: 0, delay: 380, duration: 320, onComplete: () => kill(s) });
  }

  const _apply = P.applySkillEffect;
  P.applySkillEffect = function (def, x, y, fx, fy) {
    let hidden = null;   // ชนิดสกิลที่เล่นภาพใหม่แล้ว -> ซ่อนของเดิมระหว่างเรียก _apply
    try {
      if (def && this.player) {
        const p = this.player;
        if (def.type === 'lightbeam' && has(this, 'beam')) {
          const l = Math.hypot(fx || 0, fy || 0);
          const ux = l > 0.001 ? fx / l : this.facing.x, uy = l > 0.001 ? fy / l : this.facing.y;
          this._prFxSkip = { x: p.x, y: p.y, until: this.time.now + 400 };   // ให้ priestFx.js ข้างล่างข้ามวงแฟลชสีเรียบๆ ของ priest.js
          playBeam(this, def, p, ux, uy);
          hidden = 'beam';
        } else {
          const cfg = FX[def.type];
          if (cfg && has(this, cfg.img)) {
            let px = p.x, py = p.y;
            if (cfg.at === 'ground') { const g = peekGround(this, def, x, y); px = g.x; py = g.y; }
            const span = cfg.anim === 'lasting' ? Math.max(500, (def.ticks || 1) * (def.tickMs || 1000)) + 400 : 400;
            this._prFxSkip = { x: px, y: py, until: this.time.now + span };
            if (cfg.anim === 'lasting') playLasting(this, cfg, px, py, def);
            else if (cfg.anim === 'aura') playAura(this, cfg, def);
            else playOnce(this, cfg, px, py, def);
            hidden = def.type;
          }
        }
      }
    } catch (e) { console.error('priestImgFx', e); }
    if (hidden === 'beam' && PF.BEAM) PF.BEAM.image = '__off__';
    else if (hidden && SAVED[hidden]) delete PF.FX[hidden];
    try {
      return _apply.apply(this, arguments);
    } finally {
      if (hidden === 'beam' && PF.BEAM) PF.BEAM.image = BEAM_IMAGE;
      else if (hidden && SAVED[hidden]) PF.FX[hidden] = SAVED[hidden];
    }
  };

  window.PriestImgFx = { IMG: IMG, FX: FX };
})();
