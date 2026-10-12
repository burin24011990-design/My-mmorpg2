// ===== เอฟเฟกต์สกิลโจรแบบ "ภาพนิ่ง + Phaser ขยับเอง" =====
// วางหลัง rogue.js และ skillFx.js ใน index.html (ก่อน main.js):
//   <script src="js/systems/rogueImgFx.js?v=1"></script>
// ภาพอยู่ที่ img/skillimg/rg_*_i.png
//
// วิธีทำงาน: เงาพุ่งฟันเล่นผ่าน SkillFx.dashTrail (rogue.js เรียก) | ที่เหลือเล่นผ่าน applySkillEffect เหมือนดาบ/พระ
// ox, oy = จุดยึดในภาพ (0-1) | w(def) = ความกว้างภาพที่แสดง (px) | ใหญ่/เล็กไป แก้ตัวคูณใน w()
// ภาพโหลดไม่ขึ้น = กลับไปใช้เอฟเฟกต์เดิมของ skillFx.js
(function () {
  const P = Main.prototype;
  const SF = window.SkillFx;
  if (!SF || !SF.FX) { console.error('rogueImgFx: ต้องโหลดหลัง rogue.js และ skillFx.js (ไม่พบ SkillFx)'); return; }

  const DIR = 'img/skillimg/';
  const MAX_FX = 10;       // เอฟเฟกต์โจรพร้อมกันสูงสุด (กันแลคบนมือถือ)
  const DASH_W = 170;      // ความกว้างรอยพุ่ง (px) ของเงาพุ่งฟัน

  const IMG = {
    dash:   { file: 'rg_dash_i.png',   ox: 0.979, oy: 0.502 },   // เงาพุ่งฟัน (ยึดที่ปลายหัว)
    vanish: { file: 'rg_vanish_i.png', ox: 0.5,   oy: 0.5   },   // ควันม่วงหายตัว
    slow:   { file: 'rg_slow_i.png',   ox: 0.5,   oy: 0.5   },   // รอยเล็บฟันตัดเอ็น
    drain:  { file: 'rg_drain_i.png',  ox: 0.99,  oy: 0.554 },   // คลื่นฟันดูดเลือด (ยึดที่ปลายหัว)
    ult:    { file: 'rg_ult_i.png',    ox: 0.5,   oy: 0.5   },   // พายุใบมีด
  };

  // key = id สกิล หรือชื่อสกิลภาษาไทย (อัลติ) เหมือนตารางใน skillFx.js
  const FX = {
    rg_slow:     { img: 'slow',   at: 'front', dist: 55, rotate: true, w: d => d.range * 2.4, anim: 'burst' },
    rg_drain:    { img: 'drain',  at: 'front', startDist: 30, rotate: true, w: d => d.range * 0.9, anim: 'travel' },
    rg_vanish:   { img: 'vanish', at: 'self',  w: d => 150, anim: 'smoke' },
    'พายุใบมีด': { img: 'ult',    at: 'self',  w: d => d.range * 2.4, anim: 'spin' },
  };

  // เก็บเอฟเฟกต์เดิมของ skillFx.js ไว้ | ตอนภาพใหม่พร้อมใช้ จะซ่อนของเดิมชั่วคราวเฉพาะรอบนั้น (ไม่ให้เล่นซ้อน)
  const SAVED = {};
  Object.keys(FX).forEach(k => { SAVED[k] = SF.FX[k]; });

  const has = (scene, k) => scene.textures.exists('rgi_' + k);

  function loadImgs(scene) {
    let need = false;
    Object.keys(IMG).forEach(k => {
      if (scene.textures.exists('rgi_' + k)) return;
      scene.load.image('rgi_' + k, DIR + IMG[k].file + '?v=1');
      need = true;
    });
    if (!need) return;
    scene.load.once('complete', () => {
      Object.keys(IMG).forEach(k => {
        if (scene.textures.exists('rgi_' + k)) scene.textures.get('rgi_' + k).setFilter(Phaser.Textures.FilterMode.LINEAR);
      });
      // rogue.js เช็คว่ามีอนิเมชัน rg_drain / rg_ult ไหม ถ้าไม่มีจะวาดแถบสี่เหลี่ยม/วงแฟลชแทน -> ลงทะเบียนอนิเมชัน 1 เฟรมกันไว้
      try {
        [['rg_drain', 'rgi_drain'], ['rg_ult', 'rgi_ult']].forEach(a => {
          if (scene.textures.exists(a[1]) && !scene.anims.exists(a[0])) {
            scene.anims.create({ key: a[0], frames: [{ key: a[1] }], frameRate: 1 });
          }
        });
      } catch (e) { console.warn('rogueImgFx dummy anim', e); }
    });
    scene.load.start();
  }
  const _sb = P.setupButtons;
  P.setupButtons = function () { _sb.call(this); loadImgs(this); };

  // สร้างภาพ 1 ใบ (กว้าง w px) | คืน null ถ้าเอฟเฟกต์เต็ม | s._sc = สเกลปกติ
  function spawn(scene, k, x, y, w, depth) {
    if ((scene._rgFxN || 0) >= MAX_FX) return null;
    const c = IMG[k], t = 'rgi_' + k;
    const sc = w / scene.textures.get(t).getSourceImage().width;
    const s = scene.add.image(x, y, t).setOrigin(c.ox, c.oy).setDepth(depth || 70)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(sc);
    s._sc = sc;
    scene._rgFxN = (scene._rgFxN || 0) + 1;
    s.once('destroy', () => { scene._rgFxN = Math.max(0, (scene._rgFxN || 1) - 1); });
    return s;
  }
  const kill = s => { if (s && s.active) s.destroy(); };
  function follow(scene, s) {
    const fol = () => { if (s.active && scene.player) s.setPosition(scene.player.x, scene.player.y); };
    scene.events.on('update', fol);
    s.once('destroy', () => scene.events.off('update', fol));
  }

  // ---------- ซ่อนวงแฟลชสีเรียบๆ ของโค้ดเดิมตอนที่ภาพใหม่เล่น (rogue.js เรียก scene.flash ด้วยสีม่วง/ชมพู) ----------
  const ROGUE_COLORS = [0xb98cff, 0xff6b9a, 0xd9b3ff, 0x9b6bff, 0xff9ec0];
  const _flash = P.flash;
  if (_flash) {
    P.flash = function (x, y, r, color) {
      if (this._rgSkipUntil && this.time.now < this._rgSkipUntil && ROGUE_COLORS.indexOf(color) >= 0) return;
      return _flash.apply(this, arguments);
    };
  }

  // ---------- เงาพุ่งฟัน: รอยพุ่งตามตัวตอนพุ่งจริง (rogue.js ส่งทิศ/ระยะจริงมาให้) ----------
  const _dash = SF.dashTrail;
  SF.dashTrail = function (scene, x, y, ux, uy, d) {
    try {
      if (has(scene, 'dash')) {
        const s = spawn(scene, 'dash', x, y, DASH_W, 68);
        if (s) {
          scene._rgSkipUntil = scene.time.now + 500;
          s.setRotation(Math.atan2(uy, ux)).setAlpha(0);
          if (ux < 0) s.setFlipY(true);   // หันซ้าย: พลิกแนวตั้งให้แสงอยู่ด้านบนเหมือนเดิม (ไม่กลับหัว)
          scene.tweens.add({ targets: s, x: x + ux * d, y: y + uy * d, duration: 140, ease: 'Quad.easeOut' });
          scene.tweens.add({ targets: s, alpha: 1, duration: 40 });
          scene.tweens.add({ targets: s, alpha: 0, delay: 90, duration: 170, onComplete: () => kill(s) });
          return;
        }
      }
    } catch (e) { console.error('rogueImgFx.dashTrail', e); }
    return _dash ? _dash.apply(SF, arguments) : undefined;
  };

  // ---------- เล่นภาพของสกิลอื่น ----------
  function play(scene, cfg, def, ux, uy) {
    const p = scene.player;
    const ang = Math.atan2(uy, ux);
    let px = p.x, py = p.y;
    if (cfg.at === 'front') {
      const d0 = cfg.startDist !== undefined ? cfg.startDist : (cfg.dist || 0);
      px += ux * d0; py += uy * d0;
    }
    const s = spawn(scene, cfg.img, px, py, cfg.w(def), 70);
    if (!s) return false;
    if (cfg.rotate) { s.setRotation(ang); if (ux < 0) s.setFlipY(true); }

    switch (cfg.anim) {
      case 'burst':     // ฟันตัดเอ็น: รอยเล็บเด้งออกแล้วเฟด
        s.setScale(s._sc * 0.6).setAlpha(0.4);
        scene.tweens.add({ targets: s, scaleX: s._sc * 1.05, scaleY: s._sc * 1.05, alpha: 1, duration: 130, ease: 'Back.easeOut' });
        scene.tweens.add({ targets: s, alpha: 0, delay: 140, duration: 170, onComplete: () => kill(s) });
        break;
      case 'travel':    // ฟันดูดเลือด: คลื่นพุ่งจากตัวไปสุดระยะ (ปลายหัวนำ)
        s.setAlpha(0);
        scene.tweens.add({ targets: s, x: p.x + ux * def.range, y: p.y + uy * def.range, duration: 200, ease: 'Quad.easeOut' });
        scene.tweens.add({ targets: s, alpha: 1, duration: 50 });
        scene.tweens.add({ targets: s, alpha: 0, delay: 140, duration: 130, onComplete: () => kill(s) });
        break;
      case 'smoke':     // เงาหายตัว: ควันม่วงระเบิดที่ตัว ตามตัวแล้วจางหาย
        s.setScale(s._sc * 0.5).setAlpha(0);
        follow(scene, s);
        scene.tweens.add({ targets: s, scaleX: s._sc * 1.1, scaleY: s._sc * 1.1, alpha: 0.9, duration: 300, ease: 'Cubic.easeOut' });
        scene.tweens.add({ targets: s, alpha: 0, delay: 270, duration: 340, onComplete: () => kill(s) });
        break;
      case 'spin': {    // พายุใบมีด: หมุนรอบตัวตลอด hits x gap ตามตัว
        const life = Math.max(400, (def.hits || 4) * (def.gap || 160));
        s.setScale(s._sc * 0.6).setAlpha(0.3);
        follow(scene, s);
        scene.tweens.add({ targets: s, scaleX: s._sc, scaleY: s._sc, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
        scene.tweens.add({ targets: s, angle: 300, duration: life, ease: 'Sine.easeOut' });
        scene.tweens.add({ targets: s, alpha: 0, delay: Math.max(200, life - 160), duration: 160, onComplete: () => kill(s) });
        break;
      }
      default: kill(s); return false;
    }
    return true;
  }

  const _apply = P.applySkillEffect;
  P.applySkillEffect = function (def, x, y, fx, fy) {
    let hidden = null;   // key ที่เล่นภาพใหม่แล้ว -> ซ่อนของเดิมระหว่างเรียก _apply
    try {
      const key = (def && def.id && FX[def.id]) ? def.id : (def && def.name && FX[def.name] ? def.name : null);
      const cfg = key && FX[key];
      if (cfg && this.player && has(this, cfg.img)) {
        const l = Math.hypot(fx || 0, fy || 0);
        const ux = l > 0.001 ? fx / l : this.facing.x, uy = l > 0.001 ? fy / l : this.facing.y;
        if (play(this, cfg, def, ux, uy)) {
          hidden = key;
          this._rgSkipUntil = this.time.now + 500;
        }
      }
    } catch (e) { console.error('rogueImgFx', e); }
    if (hidden && SAVED[hidden]) delete SF.FX[hidden];
    try {
      return _apply.apply(this, arguments);
    } finally {
      if (hidden && SAVED[hidden]) SF.FX[hidden] = SAVED[hidden];
    }
  };

  window.RogueImgFx = { IMG: IMG, FX: FX };
})();
