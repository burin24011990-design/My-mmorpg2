/* enemyAttackFx.js — แอนิเมชันโจมตีของมอนสเตอร์/Epic/บอส (วาดด้วยโค้ด ไม่ต้องมีรูปเพิ่ม)
 * ติดตั้ง: วางที่ js/systems/enemyAttackFx.js แล้วใส่ใน index.html หลัง roomMonsters.js และก่อน main.js
 *   <script src="js/systems/enemyAttackFx.js?v=1"></script>
 * ไม่ต้องแก้ monsters.js: ไฟล์นี้จับจังหวะที่มอนตั้ง e.atkUntil (ตอนชน/ยิง/ใช้สกิล) แล้วเล่นท่าให้
 * ถ้ามอนมี sprite sheet ท่า attack (เฟรม 4-7) จะเล่นควบคู่กันไปเอง
 */
(function () {
  // ===== ปรับแต่ง =====
  var FX = {
    melee:  { dist: 22, out: 90, back: 130, squash: 0.18 },   // มอนธรรมดา/Epic: พุ่งตี
    boss:   { dist: 44, out: 110, back: 180, squash: 0.22 },  // บอส: พุ่งแรง/ตัวยุบเยอะ
    ranged: { dist: 12, out: 70, back: 140, squash: 0.14 },   // ยิงไกล: ถอยหลังตอนยิง
    slash: true,          // เส้นฟันเมื่อชน
    bossShake: true,      // กล้องสั่นเบาๆ ตอนบอสโจมตี
    cullOffscreen: true,  // ไม่เล่นเอฟเฟกต์ตัวที่อยู่นอกจอ (ประหยัดเครื่อง)
  };

  function baseScale(e) { return (e.def && e.def.scale) || 1; }
  function restTint(e) { if (e._tint) e.setTint(e._tint); else e.clearTint(); }

  function slashFx(scene, e, ang, boss) {
    var g = scene.add.graphics().setDepth(46);
    var r = (boss ? 46 : 26) * baseScale(e) * (boss ? 0.7 : 1);
    var cx = e.x + Math.cos(ang) * r * 0.8, cy = e.y + Math.sin(ang) * r * 0.8;
    g.lineStyle(boss ? 6 : 4, 0xffffff, 0.95);
    g.beginPath(); g.arc(cx, cy, r, ang - 1.0, ang + 1.0, false); g.strokePath();
    g.lineStyle(boss ? 3 : 2, e.isEpic ? 0xff66ff : (boss ? 0xff5050 : 0xffd45c), 0.9);
    g.beginPath(); g.arc(cx, cy, r * 0.8, ang - 0.8, ang + 0.8, false); g.strokePath();
    scene.tweens.add({ targets: g, alpha: 0, scale: 1.25, duration: 220, onComplete: function () { g.destroy(); } });
  }

  function shockwave(scene, e) {
    var ring = scene.add.circle(e.x, e.y, 20, 0xffffff, 0).setStrokeStyle(4, 0xff5050, 0.9).setDepth(44);
    scene.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 420, onComplete: function () { ring.destroy(); } });
  }

  function muzzle(scene, e, ang) {
    var s = scene.add.circle(e.x + Math.cos(ang) * 16 * baseScale(e), e.y + Math.sin(ang) * 16 * baseScale(e), 8, 0xffe9a0, 0.9).setDepth(46);
    scene.tweens.add({ targets: s, scale: 2, alpha: 0, duration: 160, onComplete: function () { s.destroy(); } });
  }

  function play(scene, e, dist) {
    var p = scene.player; if (!p || !e.active) return;
    var ang = Math.atan2(p.y - e.y, p.x - e.x);
    var boss = !!e.isBoss;
    // เป็นการยิง/สกิลระยะไกล หรือชนใกล้ตัว?
    var far = dist > (e.hitRange || 30) * 1.6;
    var cfg = e.ranged ? FX.ranged : (boss ? FX.boss : FX.melee);
    var dir = (e.ranged || far) ? -1 : 1;                 // ยิง/สกิล = ถอยหลังเล็กน้อย, ชน = พุ่งเข้าหา
    var b = baseScale(e);
    e._atkAnim = true;

    e.setTint(boss ? 0xff7070 : 0xffb0b0);
    if (boss && far) shockwave(scene, e);                  // สกิลบอส: คลื่นกระแทก
    if (e.ranged) muzzle(scene, e, ang);
    else if (FX.slash && !far) slashFx(scene, e, ang, boss);
    if (boss && FX.bossShake) scene.cameras.main.shake(far ? 160 : 100, far ? 0.004 : 0.0025);

    var o = { v: 0 }, last = 0, dx = Math.cos(ang) * cfg.dist * dir, dy = Math.sin(ang) * cfg.dist * dir;
    var sq = cfg.squash * (far && boss ? 1.4 : 1);
    function step() {                                       // เลื่อนแบบ "ส่วนต่าง" ไม่ทับการเคลื่อนที่ของฟิสิกส์
      if (!e.active) return;
      var off = o.v - last; last = o.v;
      e.x += dx * off; e.y += dy * off;
      e.setScale(b * (1 + sq * o.v * (dir > 0 ? 1 : 0.6)), b * (1 - sq * o.v));   // ยืดตามทิศ ยุบแนวตั้ง
    }
    scene.tweens.add({
      targets: o, v: 1, duration: cfg.out, ease: 'Quad.easeOut', onUpdate: step,
      onComplete: function () {
        scene.tweens.add({
          targets: o, v: 0, duration: cfg.back, ease: 'Quad.easeIn', onUpdate: step,
          onComplete: function () {
            if (!e.active) return;
            e.setScale(b); restTint(e); e._atkAnim = false;
          }
        });
      }
    });
    // กันค้าง: ถ้ามอนถูกทำลาย/เปลี่ยนด่านกลางทาง
    scene.time.delayedCall(cfg.out + cfg.back + 150, function () { if (e.active) { e._atkAnim = false; } });
  }

  var _update = Main.prototype.updateEnemies;
  Main.prototype.updateEnemies = function (time) {
    var r = _update.apply(this, arguments);
    try {
      var p = this.player, v = this.cameras.main.worldView;
      this.enemies.getChildren().forEach(function (e) {
        if (!e.active || !e.atkUntil || e._atkAnim) return;
        if (e.atkUntil <= (e._atkSeen || 0) || e.atkUntil <= time) return;
        e._atkSeen = e.atkUntil;
        if (FX.cullOffscreen && (e.x < v.x - 60 || e.x > v.right + 60 || e.y < v.y - 60 || e.y > v.bottom + 60)) return;
        play(this, e, Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y));
      }, this);
    } catch (err) { /* ห้ามให้เอฟเฟกต์ทำเกมค้าง */ }
    return r;
  };
})();
