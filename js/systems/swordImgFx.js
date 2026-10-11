// ===== เอฟเฟกต์สกิลดาบแบบ "ภาพนิ่ง + Phaser ขยับเอง" =====
// วางต่อจาก skillFx.js ใน index.html (ก่อน main.js):
//   <script src="js/systems/swordImgFx.js?v=1"></script>
// ภาพอยู่ที่ img/skillimg/sw_*_i.png (หันขวา → ระบบหมุนตามทิศยิงเอง)
//
// ox, oy = จุดยึดในภาพ (0-1)  tip = ปลายคม (ฟัน/พุ่ง/คลื่น), center = กลางภาพ (หมุน/ระเบิด)
// w(def) = ความกว้างภาพที่แสดง (px) | dist(def) = จุดยึดอยู่ห่างตัวเท่าไหร่ตามทิศยิง
// anim = sweep | dash | burst | spin | wave   (ดูฟังก์ชัน play ด้านล่าง)
// times/every = เล่นกี่รอบ (ชื่อฟิลด์ใน def) / ห่างกันกี่ ms (ชื่อฟิลด์ใน def)
// ถ้าภาพใหญ่/เล็กไป ปรับเลขใน w() | ถ้าตำแหน่งเลยตัว ปรับ dist()
(function () {
  const P = Main.prototype;
  const DIR = 'img/skillimg/';   // โฟลเดอร์เก็บภาพใหม่ (ย้ายที่อยู่แก้ตรงนี้ที่เดียว)
  const MAX_FX = 8;   // เอฟเฟกต์ดาบพร้อมกันสูงสุด (กันแลคบนมือถือ)
  const FLIP_FIX = true;   // true = หันซ้ายแล้วพลิกภาพแบบกระจกซ้าย-ขวา (บนยังอยู่บน) | false = หมุน 180 องศาแบบเดิม (ภาพจะกลับหัว)

  const IMG = {
    sw_slash: { tex: 'swi_slash', file: DIR + 'sw_slash_i.png', ox: 0.977, oy: 0.487, rotate: true,   // ภาพกลับด้านแล้ว: จุดยึด = ยอดโค้งด้านหน้า
                w: d => d.range * 1.1,  dist: d => d.range,        anim: 'sweep' },
    sw_dash:  { tex: 'swi_dash',  file: DIR + 'sw_dash_i.png',  ox: 0.986, oy: 0.544, rotate: true,
                w: d => d.range * 1.35, dist: d => d.range,        anim: 'dash' },
    sw_cross: { tex: 'swi_cross', file: DIR + 'sw_cross_i.png', ox: 0.513, oy: 0.512, rotate: true,
                w: d => d.range * 1.0,  dist: d => d.range * 0.55, anim: 'burst' },
    sw_spin:  { tex: 'swi_spin',  file: DIR + 'sw_spin_i.png',  ox: 0.5,   oy: 0.5,   rotate: false,
                w: d => d.range * 2.1,  dist: d => 0,              anim: 'spin' },
    'ดาบสังหาร': { tex: 'swi_ult', file: DIR + 'sw_ult_i.png',  ox: 0.986, oy: 0.552, rotate: true,
                w: d => d.range * 1.25, dist: d => d.range,        anim: 'wave', times: 'shots', every: 'shotGap' },
  };

  // ปิดกรอบสี่เหลี่ยมโปร่งใสที่โผล่รอบสกิล: sword.js วาดกรอบ "พื้นที่โดนดาเมจ" ทุกครั้ง ถ้าไม่มี window.SwordVFX
  // เราลงทะเบียน SwordVFX แบบว่างเปล่า (ภาพจริงใช้ swordImgFx แทน) กรอบกับวงแฟลชสีเรียบๆ จึงไม่ถูกวาด
  // ยังคงจอสั่นตอนอัลติไว้ | ถ้าไฟล์อื่นมี SwordVFX ของจริงอยู่แล้ว จะไม่ทับ
  const noop = function () {};
  const VFX = window.SwordVFX = window.SwordVFX || {};
  ['slash', 'spin', 'hit', 'dash', 'guard', 'block'].forEach(k => { if (typeof VFX[k] !== 'function') VFX[k] = noop; });
  if (typeof VFX.ultimate !== 'function') {
    VFX.ultimate = function (scene, x, y, ux, uy, len, hw, shot) {
      if (scene.cameras && scene.cameras.main) scene.cameras.main.shake(shot > 1 ? 220 : 160, shot > 1 ? 0.006 : 0.004);
    };
  }

  // ปิดเอฟเฟกต์สไปรต์ชีตเดิมของดาบใน skillFx.js (ไม่ให้เล่นซ้อน)
  if (window.SkillFx && window.SkillFx.FX) {
    ['sw_slash', 'sw_dash', 'sw_cross', 'sw_spin', 'ดาบสังหาร'].forEach(k => { delete window.SkillFx.FX[k]; });
  }

  function loadImgs(scene) {
    let need = false;
    Object.keys(IMG).forEach(k => {
      const c = IMG[k];
      if (scene.textures.exists(c.tex)) return;
      scene.load.image(c.tex, c.file + '?v=2');
      need = true;
    });
    if (!need) return;
    scene.load.once('complete', () => {
      Object.keys(IMG).forEach(k => {
        const c = IMG[k];
        if (scene.textures.exists(c.tex)) scene.textures.get(c.tex).setFilter(Phaser.Textures.FilterMode.LINEAR);
      });
    });
    scene.load.start();
  }

  const _sb = P.setupButtons;
  P.setupButtons = function () { _sb.call(this); loadImgs(this); };

  function play(scene, c, def, ux, uy) {
    const p = scene.player;
    if (!p || !scene.textures.exists(c.tex)) return;
    if ((scene._swFxN || 0) >= MAX_FX) return;
    const src = scene.textures.get(c.tex).getSourceImage();
    const sc = c.w(def) / src.width;
    const ang = Math.atan2(uy, ux);
    const d = c.dist(def);
    const s = scene.add.image(p.x + ux * d, p.y + uy * d, c.tex)
      .setOrigin(c.ox, c.oy).setDepth(70).setBlendMode(Phaser.BlendModes.ADD).setScale(sc);
    if (c.rotate) {
      s.setRotation(ang);
      if (FLIP_FIX && ux < 0) s.setFlipY(true);   // หันซ้าย: พลิกแนวตั้ง + หมุน = กระจกซ้าย-ขวา (ไม่กลับหัว)
    }
    scene._swFxN = (scene._swFxN || 0) + 1;
    s.once('destroy', () => { scene._swFxN = Math.max(0, (scene._swFxN || 1) - 1); });
    const done = () => { if (s.active) s.destroy(); };

    switch (c.anim) {
      case 'sweep':   // ฟันตรง: พุ่งออกจากปลายคม แล้วเฟดหาย
        s.setAlpha(0.2).setScale(sc * 0.6, sc * 0.85);
        scene.tweens.add({ targets: s, scaleX: sc, scaleY: sc, alpha: 1, duration: 90, ease: 'Quad.easeOut' });
        scene.tweens.add({ targets: s, alpha: 0, delay: 110, duration: 170, onComplete: done });
        break;
      case 'dash':    // พุ่งทะยาน: ปลายหัวพุ่งจากตัวไปสุดระยะ
        s.setAlpha(0).setPosition(p.x + ux * 40, p.y + uy * 40);
        scene.tweens.add({ targets: s, x: p.x + ux * def.range, y: p.y + uy * def.range, duration: 190, ease: 'Quad.easeOut' });
        scene.tweens.add({ targets: s, alpha: 1, duration: 60 });
        scene.tweens.add({ targets: s, alpha: 0, delay: 120, duration: 110, onComplete: done });
        break;
      case 'burst':   // ฟันสตั้น: ระเบิดเด้งออกแล้วเฟด
        s.setScale(sc * 0.5);
        scene.tweens.add({ targets: s, scaleX: sc * 1.1, scaleY: sc * 1.1, duration: 140, ease: 'Back.easeOut' });
        scene.tweens.add({ targets: s, alpha: 0, delay: 130, duration: 170, onComplete: done });
        break;
      case 'spin': {  // ฟันหมุน: ตามตัว หมุนครึ่งรอบ ขยายออก
        s.setAlpha(0.2).setScale(sc * 0.6);
        const fol = () => { if (s.active && scene.player) s.setPosition(scene.player.x, scene.player.y); };
        scene.events.on('update', fol);
        s.once('destroy', () => scene.events.off('update', fol));
        scene.tweens.add({ targets: s, scaleX: sc, scaleY: sc, angle: 150, duration: 340, ease: 'Cubic.easeOut' });
        scene.tweens.add({ targets: s, alpha: 1, duration: 60 });
        scene.tweens.add({ targets: s, alpha: 0, delay: 190, duration: 150, onComplete: done });
        break;
      }
      case 'wave':    // อัลติ: คลื่นไฟพุ่งออกจากปลายคม ค้างแล้วเฟด
        s.setAlpha(0.3).setScale(sc * 0.35, sc * 0.9);
        scene.tweens.add({ targets: s, scaleX: sc, scaleY: sc, alpha: 1, duration: 150, ease: 'Cubic.easeOut' });
        scene.tweens.add({ targets: s, alpha: 0, delay: 290, duration: 240, onComplete: done });
        break;
      default: done();
    }
  }

  const _apply = P.applySkillEffect;
  P.applySkillEffect = function (def, x, y, fx, fy) {
    try {
      const key = (def && def.id && IMG[def.id]) ? def.id : (def && def.name && IMG[def.name] ? def.name : null);
      const c = key && IMG[key];
      if (c && this.player) {
        const scene = this, l = Math.hypot(fx || 0, fy || 0);
        const ux = l > 0.001 ? fx / l : this.facing.x, uy = l > 0.001 ? fy / l : this.facing.y;
        const n = c.times ? (def[c.times] || 1) : 1;
        const gap = c.every ? (def[c.every] || 0) : 0;
        for (let i = 0; i < n; i++) {
          if (i === 0) play(scene, c, def, ux, uy);
          else scene.time.delayedCall(i * gap, () => play(scene, c, def, ux, uy));
        }
      }
    } catch (e) { console.error('swordImgFx', e); }
    return _apply.apply(this, arguments);
  };

  window.SwordImgFx = { IMG: IMG };
})();
