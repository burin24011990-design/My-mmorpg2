
/* enemyShotFx.js — ลูกกระสุนของมอนยิงไกล / Epic / บอส ให้สวย: แกนดาวหมุน + รัศมีเรืองแสง + ละอองหางฟุ้ง + ประกายตอนแตก
 * ติดตั้ง: วางที่ js/systems/enemyShotFx.js ใส่ใน index.html หลัง enemyAttackFx.js และก่อน main.js
 *   <script src="js/systems/enemyShotFx.js?v=1"></script>
 * ไม่ต้องแก้ monsters.js: ครอบ fireShot ไว้ ฮิตบ็อกซ์/ดาเมจ/ความเร็วเหมือนเดิมทุกอย่าง (แค่เปลี่ยนหน้าตา)
 * สีของกระสุนเปลี่ยนตามธีมด่าน (ใช้ชุดสีเดียวกับเอฟเฟกต์ตอนตายใน monsterDefs.js) / Epic = ชมพูม่วง
 */
(function () {
  var FX = {
    haloSize: 0.30,    // ขนาดรัศมี (คูณกับ scale ของกระสุน) เพิ่ม = ใหญ่ขึ้น
    coreSize: 0.30,    // ขนาดแกนดาว
    trail: true,       // ละอองหาง (ปิดถ้าเครื่องช้า)
    trailEvery: 2,     // ปล่อยละอองทุกกี่เฟรม (มาก = เบาเครื่อง แต่หางห่าง)
    spin: 0.22,        // ความเร็วหมุนแกน
  };

  function makeTextures(scene) {
    if (scene.textures.exists('fx_glow')) return;
    var g = scene.textures.createCanvas('fx_glow', 64, 64), c = g.getContext();
    var gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64); g.refresh();

    var s = scene.textures.createCanvas('fx_star', 48, 48), d = s.getContext();
    d.translate(24, 24); d.fillStyle = '#fff'; d.beginPath();
    for (var i = 0; i < 8; i++) {                       // ดาว 4 แฉก
      var r = i % 2 ? 6 : 23, a = i * Math.PI / 4;
      d.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    d.closePath(); d.fill();
    var cg = d.createRadialGradient(0, 0, 0, 0, 0, 9);
    cg.addColorStop(0, 'rgba(255,255,255,1)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
    d.fillStyle = cg; d.beginPath(); d.arc(0, 0, 9, 0, Math.PI * 2); d.fill(); s.refresh();
  }

  function palette(e) {
    if (e.isEpic) return [0xff66ff, 0xffb0ff];
    var fx = (typeof DEATH_FX !== 'undefined' && e.def) ? DEATH_FX[e.def.fx] : null;
    var c = fx ? fx.colors : [0xff5050, 0xffa080];
    return [c[0], c[1] || c[0]];
  }

  function emitterFor(scene, col) {
    scene._shotEm = scene._shotEm || {};
    if (scene._shotEm[col] && scene._shotEm[col].active) return scene._shotEm[col];
    return (scene._shotEm[col] = scene.add.particles(0, 0, 'fx_glow', {
      lifespan: { min: 260, max: 420 }, speed: { min: 0, max: 35 },
      scale: { start: 0.38, end: 0 }, alpha: { start: 0.75, end: 0 },
      tint: col, blendMode: 'ADD', emitting: false
    }).setDepth(43));
  }

  function burst(scene, x, y, col, size) {
    emitterFor(scene, col).emitParticleAt(x, y, 7);
    var ring = scene.add.circle(x, y, 6 * size, col, 0.35).setStrokeStyle(2, 0xffffff, 0.9).setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 260, onComplete: function () { ring.destroy(); } });
  }

  function decorate(scene, sh, e, scale) {
    makeTextures(scene);
    var pal = palette(e), col = pal[0], col2 = pal[1];
    var big = e.isBoss ? 1.35 : 1;
    sh.setAlpha(0);                                           // ซ่อนวงกลมแดงเดิม (ฮิตบ็อกซ์ยังอยู่)
    var halo = scene.add.image(sh.x, sh.y, 'fx_glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(44).setScale(scale * FX.haloSize * big).setAlpha(0.9);
    var core = scene.add.image(sh.x, sh.y, 'fx_star').setTint(col2).setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(45).setScale(scale * FX.coreSize * big);
    var hot = scene.add.image(sh.x, sh.y, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(46).setScale(scale * FX.coreSize * 0.55 * big);   // จุดขาวร้อนตรงกลาง
    scene._shotFx.push({ sh: sh, halo: halo, core: core, hot: hot, col: col, base: scale * FX.haloSize * big, t: Math.random() * 6, size: big });
  }

  var _fire = Main.prototype.fireShot;
  Main.prototype.fireShot = function (e, ang, speed, scale, dmgMul) {
    _fire.apply(this, arguments);
    try {
      var kids = this.enemyShots.getChildren(), sh = kids[kids.length - 1];
      if (!sh || sh._fxDone) return;
      sh._fxDone = true;
      if (!this._shotFx) {
        this._shotFx = []; var n = 0, sc = this;
        this.events.on('update', function () {            // อัปเดตภาพตามลูกกระสุนทุกเฟรม
          var list = sc._shotFx;
          for (var i = list.length - 1; i >= 0; i--) {
            var f = list[i], s = f.sh;
            if (!s || !s.active) {
              burst(sc, f.halo.x, f.halo.y, f.col, f.size);
              f.halo.destroy(); f.core.destroy(); f.hot.destroy(); list.splice(i, 1); continue;
            }
            f.t += 0.25;
            var pulse = 1 + 0.15 * Math.sin(f.t);
            f.halo.setPosition(s.x, s.y).setScale(f.base * pulse);
            f.core.setPosition(s.x, s.y).setRotation(f.core.rotation + FX.spin);
            f.hot.setPosition(s.x, s.y);
            if (FX.trail && (++n % FX.trailEvery) === 0) emitterFor(sc, f.col).emitParticleAt(s.x, s.y, 1);
          }
        });
      }
      decorate(this, sh, e, scale || 2);
    } catch (err) { /* ห้ามให้เอฟเฟกต์ทำเกมค้าง */ }
  };
})();
