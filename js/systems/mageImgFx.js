// ===== เอฟเฟกต์สกิลเมจแบบ "ภาพนิ่ง + Phaser ขยับเอง" =====
// วางหลัง mage.js และ skillFx.js ใน index.html (ก่อน main.js):
//   <script src="js/systems/mageImgFx.js?v=1"></script>
// ภาพอยู่ที่ img/skillimg/mg_*_i.png
//
// วิธีทำงาน: mage.js เรียก MageVFX.bolt / blink / fireMeteor / fireBlast / iceBurst / ultBlast ตอนใช้สกิล
// ไฟล์นี้เปลี่ยนฟังก์ชันเหล่านั้นให้เล่นภาพแทนการวาดด้วยโค้ด (ถ้าภาพโหลดไม่ขึ้นจะใช้ของเดิมแทน ไม่พัง)
// ox, oy = จุดยึดในภาพ (0-1) | ขนาดภาพปรับที่เลข w ในแต่ละฟังก์ชันด้านล่าง (ใหญ่/เล็กไป แก้ตัวคูณ)
(function () {
  const P = Main.prototype;
  const Classes = window.Classes, MV = window.MageVFX;
  if (!Classes || !MV) { console.error('mageImgFx: ต้องโหลดหลัง mage.js (ไม่พบ Classes/MageVFX)'); return; }

  const DIR = 'img/skillimg/';
  const MAX_FX = 10;   // เอฟเฟกต์เมจพร้อมกันสูงสุด (กันแลคบนมือถือ)

  const IMG = {
    bolt: { file: 'mg_bolt_i.png', ox: 0.02,  oy: 0.484 },   // สายฟ้า: จุดกำเนิดอยู่ซ้ายสุด ยืดตามระยะสกิล
    nova: { file: 'mg_nova_i.png', ox: 0.505, oy: 0.547 },   // วงเวทวาป (กลางวง)
    fire: { file: 'mg_fire_i.png', ox: 0.538, oy: 0.575 },   // ระเบิดลูกไฟ (กลางแสง)
    ice:  { file: 'mg_ice_i.png',  ox: 0.5,   oy: 0.78  },   // น้ำแข็งผุด: ยึดที่กลางวงฐาน ผลึกพุ่งขึ้นด้านบน
    ult:  { file: 'mg_ult_i.png',  ox: 0.509, oy: 0.54  },   // อัลติระเบิด (กลางแสง)
  };

  // ปิดเอฟเฟกต์สไปรต์ชีตเดิมของเมจใน skillFx.js (ไม่ให้เล่นซ้อน)
  if (window.SkillFx && window.SkillFx.FX) {
    ['mg_fire', 'mg_ice', 'mg_nova', 'mg_bolt', 'ระเบิดมหาเวท'].forEach(k => { delete window.SkillFx.FX[k]; });
  }

  function loadImgs(scene) {
    let need = false;
    Object.keys(IMG).forEach(k => {
      const t = 'mgi_' + k;
      if (scene.textures.exists(t)) return;
      scene.load.image(t, DIR + IMG[k].file + '?v=2');
      need = true;
    });
    if (!need) return;
    scene.load.once('complete', () => {
      Object.keys(IMG).forEach(k => {
        const t = 'mgi_' + k;
        if (scene.textures.exists(t)) scene.textures.get(t).setFilter(Phaser.Textures.FilterMode.LINEAR);
      });
    });
    scene.load.start();
  }
  const _sb = P.setupButtons;
  P.setupButtons = function () { _sb.call(this); loadImgs(this); };

  const has = (scene, k) => scene.textures.exists('mgi_' + k);

  // สร้างภาพ 1 ใบ (กว้าง w พิกเซล) | คืน null ถ้าเอฟเฟกต์เต็ม | s._sc = สเกลปกติ
  function spawn(scene, k, x, y, w, depth) {
    if ((scene._mgFxN || 0) >= MAX_FX) return null;
    const c = IMG[k], t = 'mgi_' + k;
    const sc = w / scene.textures.get(t).getSourceImage().width;
    const s = scene.add.image(x, y, t).setOrigin(c.ox, c.oy).setDepth(depth || 72)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(sc);
    s._sc = sc;
    scene._mgFxN = (scene._mgFxN || 0) + 1;
    s.once('destroy', () => { scene._mgFxN = Math.max(0, (scene._mgFxN || 1) - 1); });
    return s;
  }
  const fade = (scene, s, delay, dur) =>
    scene.tweens.add({ targets: s, alpha: 0, delay: delay, duration: dur, onComplete: () => { if (s.active) s.destroy(); } });
  const shake = (scene, ms, i) => { if (scene.cameras && scene.cameras.main) scene.cameras.main.shake(ms, i); };

  const O = Object.assign({}, MV);   // เก็บฟังก์ชันเดิมไว้ใช้สำรอง

  // ---------- สกิล 1: สายฟ้า ----------
  MV.bolt = function (scene, x, y, ux, uy, range, hw) {
    if (!has(scene, 'bolt')) return O.bolt.apply(MV, arguments);
    if ((scene._mgFxN || 0) >= MAX_FX) return;
    const c = IMG.bolt, t = 'mgi_bolt', src = scene.textures.get(t).getSourceImage();
    const sx = (range + 20) / src.width, sy = (hw * 2 * 0.9) / src.height;
    const s = scene.add.image(x, y, t).setOrigin(c.ox, c.oy).setDepth(75).setBlendMode(Phaser.BlendModes.ADD)
      .setRotation(Math.atan2(uy, ux)).setScale(sx * 0.15, sy).setAlpha(0.6);
    scene._mgFxN = (scene._mgFxN || 0) + 1;
    s.once('destroy', () => { scene._mgFxN = Math.max(0, (scene._mgFxN || 1) - 1); });
    scene.tweens.add({ targets: s, scaleX: sx, alpha: 1, duration: 90, ease: 'Quad.easeOut' });
    fade(scene, s, 150, 280);
    shake(scene, 100, 0.002);
  };

  // ---------- สกิล 2: เวทวาป (วงเวทที่จุดเริ่ม + จุดมาถึง) ----------
  function novaAt(scene, x, y, w, delay) {
    const s = spawn(scene, 'nova', x, y, w, 56);
    if (!s) return;
    s.setScale(s._sc * 0.5).setAlpha(0.3);
    scene.tweens.add({ targets: s, scaleX: s._sc * 1.15, scaleY: s._sc * 1.15, alpha: 1, duration: 330, ease: 'Cubic.easeOut' });
    fade(scene, s, delay, 320);
  }
  MV.blink = function (scene, x, y, ex, ey, ux, uy) {
    if (!has(scene, 'nova')) return O.blink.apply(MV, arguments);
    novaAt(scene, x, y, 150, 150);
    scene.time.delayedCall(70, () => { if (scene.sys && scene.sys.isActive()) novaAt(scene, ex, ey, 175, 230); });
  };

  // ---------- สกิล 3: ลูกไฟ ----------
  // ลูกไฟตกจากฟ้า (ไม่มีวงเวทโค้ดแล้ว เหลือวงเตือนพื้นที่จาก mage.js)
  MV.fireMeteor = function (scene, x, y, radius, delay) {
    const sx = x - 30, sy = y - radius - 100;
    const m = scene.add.circle(sx, sy, 13, 0xffd05a, 1).setDepth(90).setBlendMode(Phaser.BlendModes.ADD);
    const g = scene.add.circle(sx, sy, 26, 0xff6a28, 0.45).setDepth(89).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: [m, g], x: x, y: y, scale: 2, duration: delay || 400, ease: 'Quad.easeIn',
      onComplete: () => { m.destroy(); g.destroy(); },
    });
  };
  // ระเบิด (เรียกทุกครั้งที่โดน ตาม hits)
  MV.fireBlast = function (scene, x, y, radius) {
    if (!has(scene, 'fire')) return O.fireBlast.apply(MV, arguments);
    const s = spawn(scene, 'fire', x, y, radius * 2.1, 76);
    if (s) {
      s.setScale(s._sc * 0.4).setAngle(Math.random() * 360);
      scene.tweens.add({ targets: s, scaleX: s._sc, scaleY: s._sc, duration: 220, ease: 'Cubic.easeOut' });
      fade(scene, s, 180, 260);
    }
    shake(scene, 160, 0.003);
  };

  // ---------- สกิล 4: ธารน้ำแข็ง (เรียกทุก tick) ----------
  MV.iceBurst = function (scene, x, y, radius) {
    if (!has(scene, 'ice')) return O.iceBurst.apply(MV, arguments);
    const s = spawn(scene, 'ice', x, y, radius * 2.15, 76);
    if (!s) return;
    s.setScale(s._sc * 0.8, s._sc * 0.3).setAlpha(0.3);
    scene.tweens.add({ targets: s, scaleX: s._sc, scaleY: s._sc, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    fade(scene, s, 330, 270);
  };

  // ---------- อัลติ: ระเบิดมหาเวท ----------
  MV.ultBlast = function (scene, x, y, radius) {
    if (!has(scene, 'ult')) return O.ultBlast.apply(MV, arguments);
    const s = spawn(scene, 'ult', x, y, radius * 2.2, 86);
    if (s) {
      s.setScale(s._sc * 0.3).setAlpha(0.5);
      scene.tweens.add({ targets: s, scaleX: s._sc, scaleY: s._sc, alpha: 1, duration: 380, ease: 'Cubic.easeOut' });
      fade(scene, s, 260, 420);
    }
    shake(scene, 400, 0.008);
  };

  // ---------- ธารน้ำแข็ง: ซ่อนวงเวท/วงฟ้าที่วาดด้วยโค้ดใน handler เดิม ----------
  // (วงสี่เหลี่ยมวงกลมโปร่งใสที่ค้างตลอดสกิลดูเหมือนกรอบ) วิธี: ระหว่าง handler ทำงาน สร้าง circle/graphics แล้วซ่อนทันที
  const _mice = Classes.handlers && Classes.handlers.mice;
  if (_mice) {
    Classes.handlers.mice = function () {
      const add = this.add, oc = add.circle, og = add.graphics;
      add.circle = function () { const o = oc.apply(add, arguments); o.setVisible(false); return o; };
      add.graphics = function () { const o = og.apply(add, arguments); o.setVisible(false); return o; };
      try { return _mice.apply(this, arguments); }
      finally { delete add.circle; delete add.graphics; }
    };
  }

  window.MageImgFx = { IMG: IMG };
})();
