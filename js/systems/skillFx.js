// ===== เอฟเฟกต์สกิล (สไปรต์ชีต) — เพิ่มสกิลใหม่ที่ตาราง FX ด้านล่าง =====
// ภาพทุกแผ่นวาดหันขวา (→) ระบบจะหมุนตามทิศที่ยิง
// at: 'self' = ที่ตัว | 'front' = ข้างหน้าตัวในระยะ dist | 'ground' = จุดตกที่ลากเล็ง
// scale = ขนาด | fit = ปรับขนาดตามรัศมีสกิล (def.range) | fitMul = ตัวคูณปรับขนาดของ fit | rotate = หมุนตามทิศ | add = สีสว่างขึ้น (ADD)
// delay = หน่วงก่อนเล่น (ms) | times = เล่นกี่รอบ (ชื่อฟิลด์ใน def เช่น 'ticks') | every = ระยะห่างรอบ (ชื่อฟิลด์ เช่น 'tickMs')
//
// สไปรต์ชีตแบบ rects: รูปที่แต่ละเฟรมกว้างไม่เท่ากัน (เช่น ไฟระเบิดที่ขยายใหญ่ขึ้น) ห้ามตัดเป็นช่องเท่าๆ กัน
//   rects = [[x, กว้าง], ...] ต่อ 1 เฟรม (วัดจากไฟล์ภาพจริง) | fh = ความสูงภาพ
//   fit จะปรับให้เฟรมที่กว้างที่สุด = เส้นผ่านศูนย์กลางสกิล (range * 2)
// (ลดแลค) MAX_FX = จำนวนเอฟเฟกต์สกิลที่เล่นพร้อมกันได้สูงสุด เกินแล้วเอฟเฟกต์ใหม่จะไม่แสดง (ดาเมจยังคำนวณปกติ)
(function () {
  const P = Main.prototype;
  const PAD = 2;   // ขอบเผื่อรอบเฟรมแบบ rects (พิกเซล)
  const MAX_FX = 14;   // เอฟเฟกต์พร้อมกันสูงสุด (ยังแลคตอนใช้สกิล -> ลดเหลือ 8-10)

  const SHEETS = {
    sw_slash: { file: 'img/fx/sw_slash2.png', fw: 221, fh: 248, frames: 12, fps: 30, ox: 0.9367, oy: 0.5484, peakW: 203, peakH: 208 },
    sw_dash:  { file: 'img/fx/sw_dash2.png',  fw: 200, fh: 168, frames: 12, fps: 30, ox: 0.95,   oy: 0.5655, peakW: 190, peakH: 119 },
    sw_cross: { file: 'img/fx/sw_cross2.png', fw: 230, fh: 232, frames: 12, fps: 28, ox: 0.9652, oy: 0.542,  peakW: 218, peakH: 185 },
    sw_spin:  { file: 'img/fx/sw_spin2.png',  fw: 240, fh: 240, frames: 12, fps: 26, ring: 216 },
    sw_ult:   { file: 'img/fx/sw_ult2.png',   fw: 254, fh: 216, frames: 9,  fps: 18, ox: 0.9724, oy: 0.5347, peakW: 243, peakH: 177 },
    // --- เมจ (ตัดเฟรมตามขอบจริง) ---
    mg_fire:  { file: 'img/fx/mg_fire.png',  fh: 334, fps: 20, rects: [
      [20, 106], [155, 144], [320, 207], [536, 228], [774, 262],
      [1045, 203], [1261, 204], [1477, 195], [1683, 154], [1857, 106] ] },
    mg_ice:   { file: 'img/fx/mg_ice.png',   fh: 326, fps: 14, rects: [
      [20, 120], [149, 135], [294, 161], [466, 179], [651, 189], [840, 218],
      [1058, 223], [1281, 216], [1506, 198], [1723, 116], [1853, 110] ] },
    mg_nova:  { file: 'img/fx/mg_nova.png',  fh: 272, fps: 22, rects: [
      [23, 111], [154, 122], [300, 145], [461, 162], [636, 174], [823, 179],
      [1010, 186], [1201, 183], [1391, 202], [1599, 171], [1785, 173] ] },
    mg_ult:   { file: 'img/fx/mg_ult.png',   fh: 402, fps: 16, rects: [
      [25, 127], [164, 159], [323, 207], [535, 243], [778, 280],
      [1058, 268], [1330, 219], [1549, 175], [1735, 127], [1869, 98] ] },
    // --- นักธนู ---
    ar_root:   { file: 'img/fx/ar_root2.png',   fw: 190, fh: 242, frames: 12, fps: 16, parts: { in: [0, 5], loop: [6, 8], out: [9, 11] }, loopFps: 9 },   // เถาวัลย์ล็อกขา (เล่นบนตัวมอน: เข้า -> วนค้าง -> ออก)
    ar_rain:   { file: 'img/fx/ar_rain4.png',  fw: 180, fh: 430, frames: 14, fps: 20, ring: 100 },   // ฝนลูกศร (14 เฟรม / 20 fps = 700ms เท่า tickMs)
    // --- โจร ---
    rg_dash:   { file: 'img/fx/rg_dash2.png',   fw: 209, fh: 127, frames: 11, fps: 34, ox: 0.9665, oy: 0.4961, peakW: 198, peakH: 114 },   // เงาพุ่งฟัน (รอยพุ่ง ใช้ผ่าน SkillFx.dashTrail)
    rg_slow:   { file: 'img/fx/rg_slow2.png',   fw: 260, fh: 260, frames: 10, fps: 30, ring: 190 },    // ฟันตัดเอ็น (รอยเล็บ)
    rg_drain:  { file: 'img/fx/rg_drain2.png',  fw: 247, fh: 208, frames: 10, fps: 30, ox: 0.9717, oy: 0.4916, peakW: 237, peakH: 195 },   // ฟันดูดเลือด (คลื่นฟันพุ่งออก)
    rg_vanish: { file: 'img/fx/rg_vanish2.png', fw: 280, fh: 280, frames: 9,  fps: 18, ring: 205 },    // เงาหายตัว (ควันม่วง)
    rg_ult:    { file: 'img/fx/rg_ult2.png',    fw: 302, fh: 302, frames: 8,  fps: 12.5, ring: 235 }, // พายุใบมีด (8 เฟรม / 12.5 fps = 640ms เท่า hits x gap)
    ar_pierce: { file: 'img/fx/ar_pierce2.png', fw: 199, fh: 194, frames: 12, fps: 30, ox: 0.899, parts: { in: [0, 4], loop: [5, 9] }, loopFps: 24 },   // ลูกศรเจาะเกราะ (กระสุน)
    ar_shot:   { file: 'img/fx/ar_shot2.png',   fw: 210, fh: 234, frames: 13, fps: 30, ox: 0.919, parts: { in: [0, 5], loop: [6, 9] }, loopFps: 24 },   // ยิงคู่ (กระสุน)
    ar_multi:  { file: 'img/fx/ar_multi2.png',  fw: 225, fh: 162, frames: 12, fps: 30, ox: 0.938, parts: { in: [0, 3], loop: [4, 8] }, loopFps: 24 },   // ธนูตรึงขา (กระสุน)
  };

  // แบบ rects: คำนวณความกว้างสูงสุดไว้ใช้กับ fit
  Object.keys(SHEETS).forEach(k => {
    const d = SHEETS[k];
    if (d.rects) { d.maxW = Math.max.apply(null, d.rects.map(r => r[1])); d.frames = d.rects.length; }
  });

  // รูปเดี่ยว (ไม่ใช่สไปรต์ชีต) — สายฟ้าเป็นแถบยาวภาพเดียว ยืดตามระยะสกิล
  const IMAGES = { mg_bolt: 'img/fx/mg_bolt.png', ar_ult: 'img/fx/ar_ult.png' };

  // key = id สกิล (เช่น sw_slash) หรือชื่อสกิลภาษาไทย (ใช้กับอัลติ)
  const FX = {
    // นักดาบ: ภาพถูกจัดให้ปลายคมอยู่จุดเดียวกันทุกเฟรม (origin = ปลายคม)
    // distRange = ปลายคมอยู่ห่างตัว กี่เท่าของ range | byRange/byHalfW + mul = ปรับขนาดตามระยะ/ความกว้างสกิล (ใหญ่ไป ลด mul)
    sw_slash:    { sheet: 'sw_slash', at: 'front', distRange: 1.0, rotate: true, byRange: true, mul: 1.9, add: true },
    sw_dash:     { sheet: 'sw_dash',  at: 'front', dist: 30,        rotate: true, scale: 0.7, add: true },
    sw_cross:    { sheet: 'sw_cross', at: 'front', distRange: 1.0, rotate: true, byHalfW: true, mul: 1.15, add: true },
    sw_spin:     { sheet: 'sw_spin',  at: 'self',  fit: true, add: true },
    'ดาบสังหาร':{ sheet: 'sw_ult',   at: 'front', distRange: 1.0, rotate: true, byHalfW: true, mul: 1.05, add: true },

    // --- เมจ ---
    mg_fire:     { sheet: 'mg_fire',  at: 'ground', fit: true, add: false, delay: 400 },                       // ระเบิดหลังเตือน 400ms
    mg_ice:      { sheet: 'mg_ice',   at: 'ground', fit: true, add: false, delay: 150, times: 'ticks', every: 'tickMs' },
    mg_nova:     { sheet: 'mg_nova',  at: 'self',   scale: 0.7, add: true, arrive: true },                      // เล่นที่จุดเริ่ม + จุดมาถึง
    mg_bolt:     { image: 'mg_bolt',  at: 'self',   bolt: true },
    'ระเบิดมหาเวท': { sheet: 'mg_ult', at: 'self',  fit: true, add: true },

    // --- นักธนู ---
    // ฝนลูกศร: วางที่จุดลากเล็ง เล่นซ้ำตาม ticks | oy = จุดกึ่งกลางวงเวทในภาพ | fitMul = ขนาด (ใหญ่ไป ลดเลขนี้)
    ar_rain:     { sheet: 'ar_rain',  at: 'ground', fit: true, fitMul: 0.8, add: false, oy: 0.856, times: 'ticks', every: 'tickMs' },
    // --- โจร ---
    // travel = เอฟเฟกต์พุ่งจาก startDist ไปถึงปลายระยะ ใน travelMs | follow = ตามตัวผู้เล่น (เงาพุ่งฟันเล่นผ่าน SkillFx.dashTrail จาก rogue.js)
    rg_slow:     { sheet: 'rg_slow',   at: 'front', dist: 55, rotate: true, fit: true, fitMul: 1.0, add: true },
    rg_drain:    { sheet: 'rg_drain',  at: 'front', distRange: 1.0, startDist: 30, travel: true, travelMs: 200, rotate: true, byHalfW: true, mul: 1.15, add: true },
    rg_vanish:   { sheet: 'rg_vanish', at: 'self',  scale: 0.6, add: false, follow: true },
    'พายุใบมีด': { sheet: 'rg_ult',    at: 'self',  fit: true, fitMul: 1.0, add: false, follow: true },
    // อัลติ: ภาพลำแสงยาวภาพเดียว ยิงหลังชาร์จเสร็จ (delayField = ชื่อฟิลด์ใน def ที่เป็นเวลาหน่วง)
    'ธนูทลวงฟ้า': { image: 'ar_ult', at: 'self', bolt: true, heightMul: 1.0, delayField: 'chargeMs', hold: 160 },
  };

  // ลูกศรนักธนู (ใช้จาก archer.js: shootArrow) key = id สกิล
  const ARROWS = {
    ar_shot:   { sheet: 'ar_shot',   scale: 0.42, add: true },
    ar_multi:  { sheet: 'ar_multi',  scale: 0.4,  add: true },
    ar_pierce: { sheet: 'ar_pierce', scale: 0.5,  add: false },
  };
  // เอฟเฟกต์ตอนโดนมอน (เรียกจาก archer.js) | oy = จุดกึ่งกลางวงเถาวัลย์ที่พื้น (0-1 จากบน)
  const HITS = {
    ar_multi: { sheet: 'ar_root', scale: 0.5, oy: 0.72, add: false },   // เถาวัลย์ตรึงขา
  };

  function loadSheets(scene) {
    let need = false;
    Object.keys(SHEETS).forEach(k => {
      if (scene.textures.exists(k)) return;
      const d = SHEETS[k];
      if (d.rects) scene.load.image(k, d.file + '?v=5');          // แบบ rects โหลดเป็นภาพเดียว แล้วตัดเฟรมเอง
      else scene.load.spritesheet(k, d.file + '?v=6', { frameWidth: d.fw, frameHeight: d.fh });   // v=6: บังคับโหลดภาพใหม่ ไม่ใช้แคชเก่า
      need = true;
    });
    Object.keys(IMAGES).forEach(k => {
      if (scene.textures.exists(k)) return;
      scene.load.image(k, IMAGES[k] + '?v=4');
      need = true;
    });
    // ไฟล์ภาพไหนโหลดไม่ได้ จะขึ้นข้อความบนจอ (เช็กชื่อไฟล์/โฟลเดอร์ img/fx/ ในรีโป)
    if (!scene._fxErrHook) {
      scene._fxErrHook = true;
      scene.load.on('loaderror', f => {
        console.error('skillFx โหลดภาพไม่ได้', f && f.src);
        if (scene.toastMsg) scene.toastMsg('โหลดภาพไม่ได้: ' + String((f && f.src) || '').split('?')[0]);
      });
    }
    const mk = () => {
      Object.keys(SHEETS).forEach(k => {
        const d = SHEETS[k];
        if (scene.textures.exists(k) && !scene.anims.exists(k)) {
          const tex = scene.textures.get(k);
          tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
          let frames;
          if (d.rects) {
            const tw = tex.getSourceImage().width;
            d.rects.forEach((r, i) => {
              const x = Math.max(0, r[0] - PAD);
              const w = Math.min(tw - x, r[1] + PAD * 2);
              if (!tex.has('f' + i)) tex.add('f' + i, 0, x, 0, w, d.fh);
            });
            frames = d.rects.map((r, i) => ({ key: k, frame: 'f' + i }));
          } else {
            frames = scene.anims.generateFrameNumbers(k, { start: 0, end: d.frames - 1 });
          }
          scene.anims.create({ key: k, frameRate: d.fps, repeat: 0, frames: frames });
          if (d.parts) {   // แยกช่วงอนิเมชัน: _in เล่นครั้งเดียว / _loop วนซ้ำ / _out เล่นครั้งเดียว
            const P = d.parts;
            scene.anims.create({ key: k + '_in', frameRate: d.fps, repeat: 0, frames: scene.anims.generateFrameNumbers(k, { start: P.in[0], end: P.in[1] }) });
            scene.anims.create({ key: k + '_loop', frameRate: d.loopFps || d.fps, repeat: -1, frames: scene.anims.generateFrameNumbers(k, { start: P.loop[0], end: P.loop[1] }) });
            if (P.out) scene.anims.create({ key: k + '_out', frameRate: d.fps, repeat: 0, frames: scene.anims.generateFrameNumbers(k, { start: P.out[0], end: P.out[1] }) });
          }
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

  function play(scene, cfg, x, y, ang, def, tx, ty) {
    if (!scene.anims.exists(cfg.sheet)) return;
    if ((scene._fxN || 0) >= MAX_FX) return;          // เอฟเฟกต์เต็มจอแล้ว ข้ามอันใหม่ (กันแลค)
    const d = SHEETS[cfg.sheet];
    const base = d.rects ? d.maxW : (d.ring || d.fw * 0.8);                 // rects: เฟรมกว้างสุด = เส้นผ่านศูนย์กลางสกิล
    let sc = cfg.fit ? (def.range * 2) / base * (cfg.fitMul || 1) : (cfg.scale || 1);
    if (cfg.byRange && d.peakW) sc = (def.range * 2 * (cfg.mul || 1)) / d.peakW;            // ขนาดตามระยะสกิล
    if (cfg.byHalfW && d.peakH && def.halfW) sc = (def.halfW * 2 * (cfg.mul || 1)) / d.peakH; // ขนาดตามความกว้างแนวฟัน
    const s = scene.add.sprite(x, y, cfg.sheet).setDepth(70).setScale(sc);
    scene._fxN = (scene._fxN || 0) + 1;
    s.once('destroy', () => { scene._fxN = Math.max(0, (scene._fxN || 1) - 1); });
    if (d.ox) s.setOrigin(d.ox, d.oy || 0.5);          // ชีตแบบยึดปลายคม
    else if (cfg.oy) s.setOrigin(0.5, cfg.oy);
    if (cfg.rotate) s.setRotation(ang);
    if (cfg.add) s.setBlendMode(Phaser.BlendModes.ADD);
    s.play(cfg.sheet);
    s.once('animationcomplete', () => s.destroy());
    if (cfg.travel && tx !== undefined) scene.tweens.add({ targets: s, x: tx, y: ty, duration: cfg.travelMs || 200, ease: 'Quad.easeOut' });   // พุ่งออกไปถึงปลายระยะ
    if (cfg.follow && scene.player) {                                                                                                        // ตามตัวผู้เล่น
      const fol = () => { if (s.active && scene.player) s.setPosition(scene.player.x, scene.player.y); };
      scene.events.on('update', fol);
      s.once('destroy', () => scene.events.off('update', fol));
    }
    s.setAlpha(0.2);
    scene.tweens.add({ targets: s, alpha: 1, duration: 60 });
    // เฟดออกช่วงท้าย ให้ต่อรอบถัดไปได้นุ่มนวล ไม่กระตุก
    const life = (d.frames / d.fps) * 1000;
    if (life > 300) scene.tweens.add({ targets: s, alpha: 0, delay: life - 150, duration: 150 });
  }

  // สายฟ้า: ภาพแถบเดียว ยืดให้ยาวเท่า range กว้างตาม halfW แล้วเฟดหาย
  function playBolt(scene, cfg, p, ang, def) {
    if (!scene.textures.exists(cfg.image)) return;
    const wait = cfg.delayField ? (def[cfg.delayField] || 0) : 0;
    if (wait > 0 && !cfg._now) {
      scene.time.delayedCall(wait, () => { const pl = scene.player || p; playBolt(scene, Object.assign({}, cfg, { _now: true }), { x: pl.x, y: pl.y }, ang, def); });
      return;
    }
    const src = scene.textures.get(cfg.image).getSourceImage();
    const len = def.range + 20, hh = (def.halfW || 50) * 2 * (cfg.heightMul || 1.3);
    const s = scene.add.image(p.x, p.y, cfg.image).setOrigin(0, 0.5).setDepth(70)
      .setRotation(ang).setBlendMode(Phaser.BlendModes.ADD);
    const sx = len / src.width, sy = hh / src.height;
    s.setScale(sx * 0.15, sy);
    scene.tweens.add({ targets: s, scaleX: sx, duration: 90, ease: 'Quad.easeOut' });        // พุ่งออกไป
    scene.tweens.add({ targets: s, alpha: 0, delay: 130 + (cfg.hold || 0), duration: 260, onComplete: () => s.destroy() });
  }

  // จุดตกที่ลากเล็ง (ดูเฉยๆ ไม่ดึงออกจากคิว เพราะ mage.js / archer.js จะดึงเอง)
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
          if (cfg.at === 'front') { const dd = cfg.distRange ? def.range * cfg.distRange : (cfg.dist || 0); px += ux * dd; py += uy * dd; }
          else if (cfg.at === 'ground') { const g = peekGround(this, def, x, y); px = g.x; py = g.y; }
          else if (cfg.back) { px -= ux * cfg.back; py -= uy * cfg.back; }
          let tx, ty;
          if (cfg.travel) { tx = px; ty = py; px = p.x + ux * (cfg.startDist || 0); py = p.y + uy * (cfg.startDist || 0); }
          const n = cfg.times ? (def[cfg.times] || 1) : 1;
          const gap = cfg.every ? (def[cfg.every] || 0) : 0;
          for (let i = 0; i < n; i++) {
            const wait = (cfg.delay || 0) + i * gap;
            if (wait <= 0) play(this, cfg, px, py, ang, def, tx, ty);
            else this.time.delayedCall(wait, () => play(scene, cfg, px, py, ang, def, tx, ty));
          }
          // เวทวาป: เล่นอีกครั้งที่จุดมาถึง
          if (cfg.arrive) this.time.delayedCall(60, () => play(scene, cfg, p.x, p.y, ang, def));
        }
      }
    } catch (e) { console.error('skillFx', e); }

    // จำสกิลที่เพิ่งร่าย เพื่อให้ตัวเลขดาเมจ (monsters.js: damage) ใช้สีของสกิลนั้น
    if (def) {
      const span = 250 + (def.chargeMs || 0) + (def.ticks > 1 ? def.ticks * (def.tickMs || 0) : 0);
      this._skillCtx = { def: def, until: this.time.now + span };
    }
    return _apply.apply(this, arguments);
  };

  // ลูกศร: คืน sprite ที่เล่นอนิเมชันตลอดเวลาบิน (archer.js จะ tween ตำแหน่งเอง) | ไม่มีภาพ -> คืน null (ใช้สี่เหลี่ยมเดิม)
  // ภาพถูกจัดให้ปลายหัวลูกศรอยู่ตำแหน่งเดียวกันทุกเฟรม (origin = ปลายหัว) จึงบินเนียน ไม่เด้งซ้ายขวา
  function arrow(scene, def, sx, sy, ux, uy, d, dur, big) {
    try {
      const c = def && ARROWS[def.id];
      if (!c) return null;
      if (!scene.anims.exists(c.sheet)) { if (!c._warned) { c._warned = true; console.warn('skillFx: ไม่มีอนิเมชัน', c.sheet); if (scene.toastMsg) scene.toastMsg('ไม่พบภาพ ' + c.sheet + '.png'); } return null; }
      const sh = SHEETS[c.sheet];
      const s = scene.add.sprite(sx, sy, c.sheet).setOrigin(sh.ox || 0.9, 0.5).setDepth(61).setScale(c.scale).setRotation(Math.atan2(uy, ux));
      if (c.add) s.setBlendMode(Phaser.BlendModes.ADD);
      if (scene.anims.exists(c.sheet + '_in')) {
        s.play(c.sheet + '_in');
        s.once('animationcomplete', () => { if (s.active) s.play(c.sheet + '_loop'); });
      } else {
        s.play({ key: c.sheet, duration: Math.max(dur, 200) });
      }
      return s;
    } catch (e) { console.error('skillFx.arrow', e); return null; }
  }
  // เอฟเฟกต์ตอนโดนมอน: เถาวัลย์ผุดขึ้น -> วนค้างตลอดเวลาล็อก -> หดลงตอนใกล้หมดเวลา (ms = เวลาล็อก)
  function hit(scene, id, e, ms) {
    try {
      const c = HITS[id];
      if (!c || !e || !scene.anims.exists(c.sheet)) return;
      const sh = SHEETS[c.sheet];
      const s = scene.add.sprite(e.x, e.y + 14, c.sheet).setDepth(69).setScale(c.scale).setOrigin(0.5, c.oy || 0.5);
      if (c.add) s.setBlendMode(Phaser.BlendModes.ADD);
      const follow = () => { if (!s.active) return; if (!e.active) { s.destroy(); return; } s.setPosition(e.x, e.y + 14); };
      scene.events.on('update', follow);
      s.once('destroy', () => scene.events.off('update', follow));
      if (!(ms && scene.anims.exists(c.sheet + '_loop'))) {
        s.play(c.sheet);
        s.once('animationcomplete', () => s.destroy());
        return;
      }
      const inMs = (sh.parts.in[1] - sh.parts.in[0] + 1) / sh.fps * 1000;
      const outMs = sh.parts.out ? (sh.parts.out[1] - sh.parts.out[0] + 1) / sh.fps * 1000 : 0;
      s.play(c.sheet + '_in');
      s.once('animationcomplete', () => { if (s.active) s.play(c.sheet + '_loop'); });
      scene.time.delayedCall(Math.max(inMs, ms - outMs), () => {
        if (!s.active) return;
        if (outMs > 0) { s.play(c.sheet + '_out'); s.once('animationcomplete', () => s.destroy()); }
        else s.destroy();
      });
    } catch (err) { console.error('skillFx.hit', err); }
  }

  // เงาพุ่งฟัน: รอยพุ่งสีม่วงที่เล่นตามตัวละครตอนพุ่งจริง (ทิศ/ระยะจริงจาก rogue.js เพราะอาจสั้นลงเมื่อชนสิ่งกีดขวาง)
  function dashTrail(scene, x, y, ux, uy, d) {
    try {
      const k = 'rg_dash';
      if (!scene.anims.exists(k)) return;
      const sh = SHEETS[k];
      const s = scene.add.sprite(x, y, k).setOrigin(sh.ox, sh.oy).setDepth(68).setScale(0.55)
        .setRotation(Math.atan2(uy, ux)).setBlendMode(Phaser.BlendModes.ADD);
      s.play(k);
      s.once('animationcomplete', () => s.destroy());
      scene.tweens.add({ targets: s, x: x + ux * d, y: y + uy * d, duration: 140, ease: 'Quad.easeOut' });
      scene.tweens.add({ targets: s, alpha: 0, delay: 200, duration: 140 });
    } catch (e) { console.error('skillFx.dashTrail', e); }
  }

  window.SkillFx = { FX, SHEETS, IMAGES, arrow: arrow, hit: hit, dashTrail: dashTrail };
})();
