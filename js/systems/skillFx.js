// ===== เอฟเฟกต์สกิล (สไปรต์ชีต) — เพิ่มสกิลใหม่ที่ตาราง FX ด้านล่าง =====
// ภาพทุกแผ่นวาดหันขวา (→) ระบบจะหมุนตามทิศที่ยิง
// at: 'self' = ที่ตัว | 'front' = ข้างหน้าตัวในระยะ dist | 'ground' = จุดตกที่ลากเล็ง
// scale = ขนาด (ลองปรับถ้าใหญ่/เล็กไป) | rotate = หมุนตามทิศ | add = สีสว่างขึ้น (blend แบบ ADD)
(function () {
  const P = Main.prototype;

  const SHEETS = {
    sw_slash: { file: 'img/fx/sw_slash.png', fw: 216, fh: 248, frames: 12, fps: 28 },
    sw_dash:  { file: 'img/fx/sw_dash.png',  fw: 200, fh: 168, frames: 12, fps: 28 },
    sw_cross: { file: 'img/fx/sw_cross.png', fw: 232, fh: 232, frames: 12, fps: 26 },
    sw_spin:  { file: 'img/fx/sw_spin.png',  fw: 232, fh: 264, frames: 12, fps: 24 },
    sw_ult:   { file: 'img/fx/sw_ult.png',   fw: 264, fh: 216, frames: 9,  fps: 16 },
  };

  // key = id สกิล (เช่น sw_slash) หรือ 'ulti:sword'
  const FX = {
    sw_slash:    { sheet: 'sw_slash', at: 'front', dist: 38, rotate: true, scale: 0.7, add: true },
    sw_dash:     { sheet: 'sw_dash',  at: 'self',  rotate: true, scale: 0.9, add: true, back: 40 },
    sw_cross:    { sheet: 'sw_cross', at: 'front', dist: 70, rotate: true, scale: 1.0, add: true },
    sw_spin:     { sheet: 'sw_spin',  at: 'self',  fit: 150, add: true },      // fit = รัศมีสกิล
    'ulti:sword':{ sheet: 'sw_ult',   at: 'front', dist: 130, rotate: true, scale: 1.3, add: true },
  };

  function loadSheets(scene) {
    let need = false;
    Object.keys(SHEETS).forEach(k => {
      if (scene.textures.exists(k)) return;
      const d = SHEETS[k];
      scene.load.spritesheet(k, d.file + '?v=1', { frameWidth: d.fw, frameHeight: d.fh });
      need = true;
    });
    const mk = () => Object.keys(SHEETS).forEach(k => {
      const d = SHEETS[k];
      if (scene.textures.exists(k) && !scene.anims.exists(k)) {
        scene.anims.create({ key: k, frameRate: d.fps, repeat: 0,
          frames: scene.anims.generateFrameNumbers(k, { start: 0, end: d.frames - 1 }) });
      }
    });
    if (need) { scene.load.once('complete', mk); scene.load.start(); } else mk();
  }

  const _sb = P.setupButtons;
  P.setupButtons = function () { _sb.call(this); loadSheets(this); };

  function play(scene, cfg, x, y, ang, def) {
    if (!scene.anims.exists(cfg.sheet)) return;
    const d = SHEETS[cfg.sheet];
    const sc = cfg.fit ? (def.range * 2) / (d.fw * 0.8) : (cfg.scale || 1);
    const s = scene.add.sprite(x, y, cfg.sheet).setDepth(70).setScale(sc);
    if (cfg.rotate) s.setRotation(ang);
    if (cfg.add) s.setBlendMode(Phaser.BlendModes.ADD);
    s.play(cfg.sheet);
    s.once('animationcomplete', () => s.destroy());
  }

  // ครอบ applySkillEffect: ทำงานกับทุกสกิล (รวมสกิลพื้นฐานอย่างฟันตรง/พุ่งทะยานที่ไม่มี handler ของตัวเอง)
  const _apply = P.applySkillEffect;
  P.applySkillEffect = function (def, x, y, fx, fy, dmg, kind) {
    try {
      const key = def.id && FX[def.id] ? def.id : (this.ultiClass && def === window.ULTI_DEFS[this.ultiClass] ? 'ulti:' + this.ultiClass : null);
      const cfg = key && FX[key];
      if (cfg && this.player) {
        const p = this.player, l = Math.hypot(fx || 0, fy || 0);
        const ux = l > 0.001 ? fx / l : this.facing.x, uy = l > 0.001 ? fy / l : this.facing.y;
        const ang = Math.atan2(uy, ux);
        let px = p.x, py = p.y;
        if (cfg.at === 'front') { px += ux * cfg.dist; py += uy * cfg.dist; }
        else if (cfg.at === 'ground') { px = x; py = y; }
        else if (cfg.back) { px -= ux * cfg.back; py -= uy * cfg.back; }
        play(this, cfg, px, py, ang, def);
      }
    } catch (e) { console.error('skillFx', e); }
    return _apply.apply(this, arguments);
  };

  window.SkillFx = { FX, SHEETS };
})();
