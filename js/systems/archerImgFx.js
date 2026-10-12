// ===== เอฟเฟกต์สกิลนักธนูแบบ "ภาพนิ่ง + Phaser ขยับเอง" =====
// วางหลัง archer.js และ skillFx.js ใน index.html (ก่อน main.js):
//   <script src="js/systems/archerImgFx.js?v=1"></script>
// ภาพอยู่ที่ img/skillimg/ar_*_i.png
//
// วิธีทำงาน: archer.js เรียก SkillFx.arrow (ลูกศรที่บิน) / SkillFx.hit (เถาวัลย์ตอนโดน) / ArcherVFX.ultimate / ArcherVFX.pierce
// ไฟล์นี้เปลี่ยนฟังก์ชันเหล่านั้นให้เล่นภาพแทน | ฝนลูกศรเล่นผ่าน applySkillEffect (เหมือนดาบ)
// ภาพโหลดไม่ขึ้น = ใช้ของเดิมแทน ไม่พัง
// ox, oy = จุดยึดในภาพ (0-1) | ขนาดปรับที่ w ในตาราง ARROW / ฟังก์ชันด้านล่าง (ใหญ่/เล็กไป แก้ตัวเลข)
(function () {
  const P = Main.prototype;
  const SF = window.SkillFx, AV = window.ArcherVFX;
  if (!SF || !AV) { console.error('archerImgFx: ต้องโหลดหลัง archer.js และ skillFx.js'); return; }

  const DIR = 'img/skillimg/';
  const MAX_FX = 10;   // เอฟเฟกต์ธนูพร้อมกันสูงสุด (กันแลคบนมือถือ)

  const IMG = {
    shot:   { file: 'ar_shot_i.png',   ox: 0.989, oy: 0.5   },   // ลูกศรทอง (ยึดที่หัวลูกศร)
    multi:  { file: 'ar_multi_i.png',  ox: 0.986, oy: 0.525 },   // ลูกศรเถาวัลย์ (ยึดที่หัว)
    pierce: { file: 'ar_pierce_i.png', ox: 0.984, oy: 0.498 },   // ลูกศรเจาะเกราะ (ยึดที่หัว)
    root:   { file: 'ar_root_i.png',   ox: 0.492, oy: 0.70  },   // เถาวัลย์ตรึงขา (กลางวงที่พื้น)
    rain:   { file: 'ar_rain_i.png',   ox: 0.492, oy: 0.778 },   // ฝนลูกศร (กลางวงเวทที่พื้น)
    ult:    { file: 'ar_ult_i.png',    ox: 0.158, oy: 0.5   },   // ลำแสงอัลติ (ยึดที่วงซ้าย = ตัวผู้เล่น)
  };

  // ลูกศรที่บิน: w = ความกว้างภาพ (px) ตามสกิล
  const ARROW = {
    ar_shot:   { img: 'shot',   w: 170 },
    ar_multi:  { img: 'multi',  w: 190 },
    ar_pierce: { img: 'pierce', w: 260 },
  };

  // ปิดเอฟเฟกต์สไปรต์ชีตเดิมของฝนลูกศรกับอัลติใน skillFx.js (ไม่ให้เล่นซ้อน)
  if (SF.FX) { delete SF.FX.ar_rain; delete SF.FX['ธนูทลวงฟ้า']; }

  function loadImgs(scene) {
    let need = false;
    Object.keys(IMG).forEach(k => {
      const t = 'ari_' + k;
      if (scene.textures.exists(t)) return;
      scene.load.image(t, DIR + IMG[k].file + '?v=1');
      need = true;
    });
    if (!need) return;
    scene.load.once('complete', () => {
      Object.keys(IMG).forEach(k => {
        const t = 'ari_' + k;
        if (scene.textures.exists(t)) scene.textures.get(t).setFilter(Phaser.Textures.FilterMode.LINEAR);
      });
      // archer.js เช็กว่ามีอนิเมชัน 'ar_rain' ไหมเพื่อตัดสินว่าจะวาดฝนด้วยโค้ดซ้อนหรือไม่ -> สร้างตัวหลอกไว้ให้ (กรณีลบไฟล์ชีตเก่าแล้ว)
      try {
        if (scene.textures.exists('ari_rain') && !scene.anims.exists('ar_rain')) {
          scene.anims.create({ key: 'ar_rain', frames: [{ key: 'ari_rain' }], frameRate: 1 });
        }
      } catch (e) { console.warn('archerImgFx dummy anim', e); }
    });
    scene.load.start();
  }
  const _sb = P.setupButtons;
  P.setupButtons = function () { _sb.call(this); loadImgs(this); };

  const has = (scene, k) => scene.textures.exists('ari_' + k);

  // สร้างภาพ 1 ใบ (กว้าง w px) | คืน null ถ้าเอฟเฟกต์เต็ม | s._sc = สเกลปกติ
  function spawn(scene, k, x, y, w, depth, add) {
    if ((scene._arFxN || 0) >= MAX_FX) return null;
    const c = IMG[k], t = 'ari_' + k;
    const sc = w / scene.textures.get(t).getSourceImage().width;
    const s = scene.add.image(x, y, t).setOrigin(c.ox, c.oy).setDepth(depth || 70).setScale(sc);
    if (add !== false) s.setBlendMode(Phaser.BlendModes.ADD);
    s._sc = sc;
    scene._arFxN = (scene._arFxN || 0) + 1;
    s.once('destroy', () => { scene._arFxN = Math.max(0, (scene._arFxN || 1) - 1); });
    return s;
  }
  const kill = s => { if (s && s.active) s.destroy(); };

  // ---------- ลูกศรที่บิน (archer.js จะ tween ตำแหน่งและทำลายเอง) ----------
  const _arrow = SF.arrow;
  SF.arrow = function (scene, def, sx, sy, ux, uy, d, dur, big) {
    try {
      const c = def && ARROW[def.id];
      if (c && has(scene, c.img)) {
        const s = spawn(scene, c.img, sx, sy, c.w, 61, true);
        if (s) { s.setRotation(Math.atan2(uy, ux)); return s; }
      }
    } catch (e) { console.error('archerImgFx.arrow', e); }
    return _arrow ? _arrow.apply(SF, arguments) : null;
  };

  // ---------- เถาวัลย์ตรึงขาตอนโดน: ผุดขึ้น -> ตามมอนตลอดเวลาล็อก -> เฟดหาย ----------
  const _hit = SF.hit;
  SF.hit = function (scene, id, e, ms) {
    try {
      if (id === 'ar_multi' && has(scene, 'root') && e && e.active) {
        const s = spawn(scene, 'root', e.x, e.y + 14, 130, 69, false);
        if (!s) return;
        const life = ms || 1500;
        s.setAlpha(0).setScale(s._sc * 0.5);
        scene.tweens.add({ targets: s, scaleX: s._sc, scaleY: s._sc, alpha: 1, duration: 220, ease: 'Back.easeOut' });
        scene.tweens.add({ targets: s, alpha: 0, delay: Math.max(300, life - 250), duration: 250, onComplete: () => kill(s) });
        const fol = () => { if (!s.active) return; if (!e.active) { s.destroy(); return; } s.setPosition(e.x, e.y + 14); };
        scene.events.on('update', fol);
        s.once('destroy', () => scene.events.off('update', fol));
        return;
      }
    } catch (err) { console.error('archerImgFx.hit', err); }
    return _hit ? _hit.apply(SF, arguments) : undefined;
  };

  // ---------- ธนูเจาะเกราะ: ปิดแถบสี่เหลี่ยมโปร่งใสของโค้ดเดิม (ภาพลูกศรมีคลื่นกระแทกในตัวแล้ว) ----------
  const _pierce = AV.pierce;
  AV.pierce = function (scene) {
    if (has(scene, 'pierce')) return;
    return _pierce.apply(AV, arguments);
  };

  // ---------- อัลติ: ลำแสงทุกที (2 ที) ----------
  // ส่วนระเบิดประกาย/วงแหวน/จอสั่นใช้ของเดิม แต่ไม่ให้วาดแถบสี่เหลี่ยม
  const _ult = AV.ultimate;
  AV.ultimate = function (scene, x, y, ux, uy, len, hw) {
    if (!has(scene, 'ult')) return _ult.apply(AV, arguments);
    _ult.call(AV, scene, x, y, ux, uy, len, hw, false);
    if ((scene._arFxN || 0) >= MAX_FX) return;
    const c = IMG.ult, t = 'ari_ult', src = scene.textures.get(t).getSourceImage();
    const sx = (len + 20) / ((1 - c.ox) * src.width), sy = (hw * 2 * 0.95) / src.height;
    const s = scene.add.image(x, y, t).setOrigin(c.ox, c.oy).setDepth(74).setBlendMode(Phaser.BlendModes.ADD)
      .setRotation(Math.atan2(uy, ux)).setScale(sx * 0.2, sy).setAlpha(0.5);
    scene._arFxN = (scene._arFxN || 0) + 1;
    s.once('destroy', () => { scene._arFxN = Math.max(0, (scene._arFxN || 1) - 1); });
    scene.tweens.add({ targets: s, scaleX: sx, alpha: 1, duration: 90, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: s, alpha: 0, delay: 300, duration: 260, onComplete: () => kill(s) });
  };

  // ---------- ฝนลูกศร: เล่นที่จุดลากเล็ง ซ้ำตาม ticks x tickMs ----------
  function peekGround(scene, def, x, y) {
    const q = scene._groundQ;
    if (q && q.length) {
      const e = q.find(e => e.def === def || (e.def.name === def.name && e.def.range === def.range));
      if (e) return { x: e.x, y: e.y };
    }
    return { x: x, y: y };
  }
  function rainTick(scene, def, gx, gy, gap) {
    const s = spawn(scene, 'rain', gx, gy, def.range * 2.05, 70, true);
    if (!s) return;
    s.setAlpha(0.2).setScale(s._sc, s._sc * 0.9);
    scene.tweens.add({ targets: s, alpha: 1, scaleY: s._sc, duration: 110, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: s, alpha: 0, delay: Math.max(250, gap - 230), duration: 200, onComplete: () => kill(s) });
  }
  const _apply = P.applySkillEffect;
  P.applySkillEffect = function (def, x, y) {
    try {
      if (def && def.id === 'ar_rain' && this.player && has(this, 'rain')) {
        const scene = this, g = peekGround(this, def, x, y);
        const n = def.ticks || 1, gap = def.tickMs || 700;
        for (let i = 0; i < n; i++) {
          if (i === 0) rainTick(scene, def, g.x, g.y, gap);
          else scene.time.delayedCall(i * gap, () => rainTick(scene, def, g.x, g.y, gap));
        }
      }
    } catch (e) { console.error('archerImgFx.rain', e); }
    return _apply.apply(this, arguments);
  };

  window.ArcherImgFx = { IMG: IMG };
})();
