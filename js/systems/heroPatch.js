// ===== เปลี่ยนตัวละครผู้เล่นเป็นสไปรต์ hero + เล่นอนิเมชัน (รองรับสกินทุกอาชีพ) =====
// ไม่แก้ไฟล์เดิม: ครอบ preload / create / update / useBasicAttack / useSkill / useUlti ของ Main
// โหลดหลัง heroAnims.js และหลัง stats.js แต่ก่อน main.js

(function () {
  var HERO_SCALE = 1.0;    // ขนาดตัวละครในเกม (ปรับเลขนี้ถ้าใหญ่/เล็กไป) ให้ตรงกับ SCALE ใน heroAnims.js
  var ATTACK_MS  = 550;    // เวลาล็อกท่าโจมตี "สำรอง" (ปกติใช้เวลาเล่นจริงของอนิเมชัน)
  var SKILL_MS   = 550;    // เวลาล็อกท่าสกิล "สำรอง"
  var LUNGE_PX   = 9;      // ระยะที่ตัวละครพุ่งไปทางเป้าหมายตอนฟัน/ปล่อย (พิกเซลบนจอ) ตั้ง 0 เพื่อปิด
  var BOB_PX     = 3;      // ความสูงการเด้งตอนเดิน (พิกเซลบนจอ) ตั้ง 0 เพื่อปิด
  var SPEED_REF  = 190;    // ความเร็วเดินเต็มที่ของเกม (ตรงกับ input.js)

  var target = (typeof Main === 'function') ? Main.prototype : Main;

  // คลาสอาวุธ -> ท่าโจมตี
  var ATTACK_BY_CLASS = { sword: 'sword', rogue: 'sword', mage: 'staff', priest: 'staff', archer: 'bow' };
  // คลาสที่มีท่า 'skill' แยก
  var HAS_SKILL_ANIM = { sword: true, rogue: true };

  target.attackAnimName = function () {
    var cls = (typeof this.currentClass === 'function') ? this.currentClass() : 'sword';
    return ATTACK_BY_CLASS[cls] || 'sword';
  };

  function dirFromVec(x, y) {
    if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 'left' : 'right';
    return y < 0 ? 'up' : 'down';
  }
  var DIR_VEC = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

  // เลื่อนภาพตัวละครด้วยการขยับ origin (บนจอ px): ox/oy = ระยะเลื่อนแนวนอน/แนวตั้ง
  function setOffset(scene, ox, oy) {
    var p = scene.player, k = 96 * HERO_SCALE;
    var nx = 0.5 - ox / k, ny = scene._heroBaseOY - oy / k;
    if (p.originX !== nx || p.originY !== ny) p.setOrigin(nx, ny);
  }
  function setBob(scene, px) { setOffset(scene, 0, -px); }

  var origPreload = target.preload;
  target.preload = function () {
    if (origPreload) origPreload.apply(this, arguments);
    HeroAnims.preload(this);
  };

  var origCreate = target.create;
  target.create = function () {
    if (origCreate) origCreate.apply(this, arguments);
    try {
      if (!this.textures.exists('hero') || !this.player) return;
      HeroAnims.create(this);
      this._heroOn = true;
      this._heroDir = 'down';
      this.player.setTexture('hero', 18);
      this.player.setScale(HERO_SCALE);
      this._heroBaseOY = this.player.originY;
      if (this.player.body) {
        this.player.body.setSize(28, 24);
        this.player.body.setOffset(34, 64);
      }
    } catch (e) { console.warn('hero patch failed', e); }
  };

  var origUpdate = target.update;
  target.update = function () {
    if (origUpdate) origUpdate.apply(this, arguments);
    try {
      if (!this._heroOn || !this.player || !this.player.body) return;
      var now = this.time.now;

      if (now < (this._atkUntil || 0)) {
        // ระหว่างโจมตี: พุ่งไปทางเป้าหมายช่วงฟัน แล้วถอยกลับ (ช่วยให้เห็นการเคลื่อนไหวชัดขึ้น)
        var t = Phaser.Math.Clamp((now - this._atkStart) / this._atkDur, 0, 1);
        var f = t < 0.4 ? t / 0.4 : (1 - t) / 0.6;
        f = Math.sin(f * Math.PI / 2);
        var v0 = DIR_VEC[this._heroDir] || [0, 0];
        setOffset(this, v0[0] * LUNGE_PX * f, v0[1] * LUNGE_PX * f);
        return;
      }

      var p = this.player, v = p.body.velocity;
      var speed = Math.hypot(v.x, v.y);
      var moving = speed > 12;
      if (moving) this._heroDir = dirFromVec(v.x, v.y);

      HeroAnims.play(p, moving ? 'walk' : 'idle', this._heroDir);
      p.anims.timeScale = moving ? Phaser.Math.Clamp(speed / SPEED_REF, 0.4, 1.2) : 1;

      if (moving && BOB_PX > 0) {
        var prog = p.anims.getProgress ? p.anims.getProgress() : 0;
        setBob(this, Math.abs(Math.sin(prog * Math.PI * 2)) * BOB_PX);
      } else {
        setBob(this, 0);
      }
    } catch (e) {}
  };

  // ----- โจมตี: หันไปทางเป้าหมาย (ครบ 4 ทิศ) -----
  // isSkill = true และเป็นคลาสที่มีท่า skill -> เล่นท่า 'skill' | อื่นๆ -> ท่าโจมตีปกติตามอาวุธ
  function playAttack(scene, isSkill) {
    if (!scene._heroOn || !scene.player) return;
    var p = scene.player, d = scene._heroDir || 'right', dx = 0, dy = 0;
    if (scene.target && typeof scene.target.x === 'number') { dx = scene.target.x - p.x; dy = scene.target.y - p.y; }
    else if (scene.facing) { dx = scene.facing.x; dy = scene.facing.y; }
    if (dx || dy) d = dirFromVec(dx, dy);
    scene._heroDir = d;
    var cls = (typeof scene.currentClass === 'function') ? scene.currentClass() : 'sword';
    var act = (isSkill && HAS_SKILL_ANIM[cls]) ? 'skill' : scene.attackAnimName();
    p.anims.timeScale = 1;
    p.anims.stop();                       // เริ่มท่าใหม่จากเฟรมแรกทุกครั้ง (ไม่ค้างท่าเก่า)
    HeroAnims.play(p, act, d);
    var cur = p.anims.currentAnim;
    var dur = (cur && cur.duration) ? cur.duration : (act === 'skill' ? SKILL_MS : ATTACK_MS);
    scene._atkStart = scene.time.now;
    scene._atkDur = dur;
    scene._atkUntil = scene.time.now + dur + 30;   // ล็อกเท่าเวลาเล่นจริง
  }

  [['useBasicAttack', false], ['useSkill', true], ['useUlti', true]].forEach(function (pair) {
    var name = pair[0], isSkill = pair[1], orig = target[name];
    if (typeof orig !== 'function') return;
    target[name] = function () {
      try { if (!this.panel) playAttack(this, isSkill); } catch (e) {}
      return orig.apply(this, arguments);
    };
  });
})();
