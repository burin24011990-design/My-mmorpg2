// ===== เปลี่ยนตัวละครผู้เล่นเป็นสไปรต์ hero + เล่นอนิเมชัน (รองรับสกินดาบ/มีด) =====
// ไม่แก้ไฟล์เดิม: ครอบ preload / create / update / useBasicAttack / useSkill / useUlti ของ Main
// โหลดหลัง heroAnims.js และหลัง stats.js แต่ก่อน main.js

(function () {
  var HERO_SCALE = 0.75;   // ขนาดตัวละครในเกม (ปรับเลขนี้ถ้าใหญ่/เล็กไป)
  var ATTACK_MS  = 430;    // ระยะเวลาที่ล็อกท่าโจมตีปกติ
  var SKILL_MS   = 300;    // ระยะเวลาที่ล็อกท่าสกิล (ดาบ/มีด)
  var BOB_PX     = 3;      // ความสูงการเด้งตอนเดิน (พิกเซลบนจอ) ตั้ง 0 เพื่อปิด
  var SPEED_REF  = 190;    // ความเร็วเดินเต็มที่ของเกม (ตรงกับ input.js)

  var target = (typeof Main === 'function') ? Main.prototype : Main;

  // คลาสอาวุธ -> ท่าโจมตี
  var ATTACK_BY_CLASS = { sword: 'sword', rogue: 'sword', mage: 'staff', priest: 'staff', archer: 'bow' };
  // คลาสที่มีท่า 'skill' แยก (อยู่ในชีต hero_sword / hero_rogue)
  var HAS_SKILL_ANIM = { sword: true, rogue: true };

  target.attackAnimName = function () {
    var cls = (typeof this.currentClass === 'function') ? this.currentClass() : 'sword';
    return ATTACK_BY_CLASS[cls] || 'sword';
  };

  function dirFromVec(x, y) {
    if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 'left' : 'right';
    return y < 0 ? 'up' : 'down';
  }

  function setBob(scene, px) {
    var p = scene.player;
    var oy = scene._heroBaseOY + px / (96 * HERO_SCALE);
    if (p.originY !== oy) p.setOrigin(0.5, oy);
  }

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
      if (this.time.now < (this._atkUntil || 0)) { setBob(this, 0); return; }

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
  // isSkill = true และเป็นดาบ/มีด -> เล่นท่า 'skill' | อื่นๆ -> ท่าโจมตีปกติตามอาวุธ
  function playAttack(scene, isSkill) {
    if (!scene._heroOn || !scene.player) return;
    var p = scene.player, d = scene._heroDir || 'right', dx = 0, dy = 0;
    if (scene.target && typeof scene.target.x === 'number') { dx = scene.target.x - p.x; dy = scene.target.y - p.y; }
    else if (scene.facing) { dx = scene.facing.x; dy = scene.facing.y; }
    if (dx || dy) d = dirFromVec(dx, dy);
    scene._heroDir = d;
    var cls = (typeof scene.currentClass === 'function') ? scene.currentClass() : 'sword';
    var act = (isSkill && HAS_SKILL_ANIM[cls]) ? 'skill' : scene.attackAnimName();
    scene._atkUntil = scene.time.now + (act === 'skill' ? SKILL_MS : ATTACK_MS);
    p.anims.timeScale = 1;
    HeroAnims.play(p, act, d);
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
