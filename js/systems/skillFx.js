// ===== เอฟเฟกต์สกิล (สไปรต์ชีต) — เพิ่มสกิลใหม่ที่ตาราง FX ด้านล่าง =====
// ภาพทุกแผ่นวาดหันขวา (→) ระบบจะหมุนตามทิศที่ยิง
// at: 'self' = ที่ตัว | 'front' = ข้างหน้าตัวในระยะ dist | 'ground' = จุดตกที่ลากเล็ง
// scale = ขนาด | fit = ปรับขนาดตามรัศมีสกิล (def.range) | rotate = หมุนตามทิศ | add = สีสว่างขึ้น (ADD)
// delay = หน่วงก่อนเล่น (ms) | times = เล่นกี่รอบ (ชื่อฟิลด์ใน def เช่น 'ticks') | every = ระยะห่างรอบ (ชื่อฟิลด์ เช่น 'tickMs')
(function () {
  const P = Main.prototype;

  const SHEETS = {
    sw_slash: { file: 'img/fx/sw_slash.png', fw: 248, fh: 248, frames: 12, fps: 30 },
    sw_dash:  { file: 'img/fx/sw_dash.png',  fw: 216, fh: 168, frames: 12, fps: 30 },
    sw_cross: { file: 'img/fx/sw_cross.png', fw: 248, fh: 232, frames: 12, fps: 28 },
    sw_spin:  { file: 'img/fx/sw_spin.png',  fw: 232, fh: 264, frames: 12, fps: 26 },
    sw_ult:   { file: 'img/fx/sw_ult.png',   fw: 264, fh: 216, frames: 9,  fps: 18 },
    // --- เมจ ---
    mg_fire:  { file: 'img/fx/mg_fire.png',  fw: 198, fh: 334, frames: 10, fps: 20 },
    mg_ice:   { file: 'img/fx/mg_ice.png',   fw: 180, fh: 326, frames: 11, fps: 14 },
    mg_nova:  { file: 'img/fx/mg_nova.png',  fw: 180, fh: 272, frames: 11, fps: 22 },
    mg_ult:   { file: 'img/fx/mg_ult.png',   fw: 198, fh: 402, frames: 10, fps: 16 },
  };

  // รูปเดี่ยว (ไม่ใช่สไปรต์ชีต) — สายฟ้าเป็นแถบยาวภาพเดียว ยืดตามระยะสกิล
  const IMAGES = { mg_bolt: 'img/fx/mg_bolt.png' };

  // key = id สกิล (เช่น sw_slash) หรือชื่อสกิลภาษาไทย (ใช้กับอัลติ)
  const FX = {
    sw_slash:    { sheet: 'sw_slash', at: 'front', dist: 38, rotate: true, scale: 0.7, add: true },
    sw_dash:     { sheet: 'sw_dash',  at: 'self',  rotate: true, scale: 0.9, add: true, back: 40 },
    sw_cross:    { sheet: 'sw_cross', at: 'front', dist: 70, rotate: true, scale: 1.0, add: true },
    sw_spin:     { sheet: 'sw_spin',  at: 'self',  fit: 150, add: true },
    'ดาบสังหาร':{ sheet: 'sw_ult',   at: 'front', dist: 130, rotate: true, scale: 1.3, add: true },

    // --- เมจ ---
    mg_fire:     { sheet: 'mg_fire',  at: 'ground', fit: true, add: false, delay: 400 },                       // ระเบิดหลังเตือน 400ms
    mg_ice:      { sheet: 'mg_ice',   at: 'ground', fit: true, add: false, delay: 150, times: 'ticks', every: 'tickMs' },
    mg_nova:     { sheet: 'mg_nova',  at: 'self',   scale: 0.7, add: true, arrive: true },                      // เล่นที่จุดเริ่ม + จุดมาถึง
    mg_bolt:     { image: 'mg_bolt',  at: 'self',   bolt: true },
    'ระเบิดมหาเวท': { sheet: 'mg_ult', at: 'self',  fit: true, add: true },
  };

  function loadSheets(scene) {
    let need = false;
    Object.keys(SHEETS).forEach(k => {
      if (scene.textures.exists(k)) return;
      const d = SHEETS[k];
      scene.load.spritesheet(k, d.file + '?v=3', { frameWidth: d.fw, frameHeight: d.fh });
      need = true;
    });
    Object.keys(IMAGES).forEach(k => {
      if (scene.textures.exists(k)) return;
      scene.load.image(k, IMAGES[k] + '?v=3');
      need = true;
    });
    const mk = () => {
      Object.keys(SHEETS).forEach(k => {
        const d = SHEETS[k];
        if (scene.textures.exists(k) && !scene.anims.exists(k)) {
          scene.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
          scene.anims.create({ key: k, frameRate: d.fps, repeat: 0,
            frames: scene.anims.generateFrameNumbers(k, { start: 0, end: d.frames - 1 }) });
        }
      });
      Object.keys(IMAGES).forEach(k => {
        if (scene.textures.exists(k)) scene.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
      });
    };
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
    s.setAlpha(0.2);
    scene.tweens.add({ targets: s, alpha: 1, duration: 60 });
  }

  // สายฟ้า: ภาพแถบเดียว ยืดให้ยาวเท่า range กว้างตาม halfW แล้วเฟดหาย
  function playBolt(scene, cfg, p, ang, def) {
    if (!scene.textures.exists(cfg.image)) return;
    const src = scene.textures.get(cfg.image).getSourceImage();
    const len = def.range + 20, hh = (def.halfW || 50) * 2 * 1.3;
    const s = scene.add.image(p.x, p.y, cfg.image).setOrigin(0, 0.5).setDepth(70)
      .setRotation(ang).setBlendMode(Phaser.BlendModes.ADD);
    const sx = len / src.width, sy = hh / src.height;
    s.setScale(sx * 0.15, sy);
    scene.tweens.add({ targets: s, scaleX: sx, duration: 90, ease: 'Quad.easeOut' });        // พุ่งออกไป
    scene.tweens.add({ targets: s, alpha: 0, delay: 130, duration: 260, onComplete: () => s.destroy() });
  }

  // จุดตกที่ลากเล็ง (ดูเฉยๆ ไม่ดึงออกจากคิว เพราะ mage.js จะดึงเอง)
  function peekGround(scene, def, x, y) {
    const q = scene._groundQ;
    if (q && q.length) {
      const e = q.find(e => e.def === def || (e.def.name === def.name && e.def.range === def.range));
      if (e) return { x: e.x, y: e.y };
    }
    return { x: x, y: y };
  }

  const _apply = P.applySkillEffect;
  P.applySkillEffect = function (def, x, y, fx, fy, dmg, kind) {
    try {
      const key = (def.id && FX[def.id]) ? def.id : (def.name && FX[def.name] ? def.name : null);
      const cfg = key && FX[key];
      if (cfg && this.player) {
        const scene = this, p = this.player, l = Math.hypot(fx || 0, fy || 0);
        const ux = l > 0.001 ? fx / l : this.facing.x, uy = l > 0.001 ? fy / l : this.facing.y;
        const ang = Math.atan2(uy, ux);
        if (cfg.bolt) {
          playBolt(this, cfg, { x: p.x, y: p.y }, ang, def);
        } else {
          let px = p.x, py = p.y;
          if (cfg.at === 'front') { px += ux * cfg.dist; py += uy * cfg.dist; }
          else if (cfg.at === 'ground') { const g = peekGround(this, def, x, y); px = g.x; py = g.y; }
          else if (cfg.back) { px -= ux * cfg.back; py -= uy * cfg.back; }
          const n = cfg.times ? (def[cfg.times] || 1) : 1;
          const gap = cfg.every ? (def[cfg.every] || 0) : 0;
          for (let i = 0; i < n; i++) {
            const wait = (cfg.delay || 0) + i * gap;
            if (wait <= 0) play(this, cfg, px, py, ang, def);
            else this.time.delayedCall(wait, () => play(scene, cfg, px, py, ang, def));
          }
          // เวทวาป: เล่นอีกครั้งที่จุดมาถึง
          if (cfg.arrive) this.time.delayedCall(60, () => play(scene, cfg, p.x, p.y, ang, def));
        }
      }
    } catch (e) { console.error('skillFx', e); }
    return _apply.apply(this, arguments);
  };

  window.SkillFx = { FX, SHEETS, IMAGES };
})();
