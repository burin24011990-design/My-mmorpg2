// ===== เปลี่ยนตัวละครผู้เล่นเป็นสไปรต์ hero.png + เล่นอนิเมชัน =====
// ไม่แก้ไฟล์เดิม: ครอบ preload / create / update / useBasicAttack / useSkill ของ Main
// โหลดหลัง heroAnims.js และหลัง stats.js แต่ก่อน main.js
// ถ้าไม่มี assets/hero.png เกมจะใช้วงกลมสีฟ้าเดิมต่อไป ไม่พัง

(function () {
  var HERO_SCALE = 0.75;   // ขนาดตัวละครในเกม (ปรับเลขนี้ถ้าใหญ่/เล็กไป)
  var ATTACK_MS  = 420;    // ระยะเวลาที่ล็อกท่าโจมตี
  var BOB_PX     = 3;      // ความสูงการเด้งตอนเดิน (พิกเซลบนจอ) ตั้ง 0 เพื่อปิด
  var SPEED_REF  = 190;    // ความเร็วเดินเต็มที่ของเกม (ตรงกับ input.js)

  var target = (typeof Main === 'function') ? Main.prototype : Main;

  // คลาสอาวุธ -> ท่าโจมตี  (ถ้าชื่อคลาสใน items.js ต่างจากนี้ ให้แก้ตรงนี้)
  var ATTACK_BY_CLASS = { sword: 'sword', rogue: 'sword', mage: 'staff', priest: 'staff', archer: 'bow' };

  target.attackAnimName = function () {
    var cls = (typeof this.currentClass === 'function') ? this.currentClass() : 'sword';
    return ATTACK_BY_CLASS[cls] || 'sword';
  };

  function dirFromVec(x, y) {
    if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 'left' : 'right';
    return y < 0 ? 'up' : 'down';
  }

  // ตั้งการเด้งตัว (ยกภาพขึ้น px พิกเซล โดยไม่ขยับตำแหน่งจริงของผู้เล่น)
  function setBob(scene, px) {
    var p = scene.player;
    var oy = scene._heroBaseOY + px / (96 * HERO_SCALE);
    if (p.originY !== oy) p.setOrigin(0.5, oy);
  }

  // ----- preload -----
  var origPreload = target.preload;
  target.preload = function () {
    if (origPreload) origPreload.apply(this, arguments);
    HeroAnims.preload(this);
  };

  // ----- create -----
  var origCreate = target.create;
  target.create = function () {
    if (origCreate) origCreate.apply(this, arguments);
    try {
      if (!this.textures.exists('hero') || !this.player) return;
      HeroAnims.create(this);
      this._heroOn = true;
      this._heroDir = 'down';
      this.player.setTexture('hero', 18);          // เฟรมยืนนิ่งหันหน้าลง
      this.player.setScale(HERO_SCALE);
      this._heroBaseOY = this.player.originY;
      if (this.player.body) {                      // กล่องชนเล็กแค่ช่วงเท้า (หน่วยเป็นพิกเซลของรูปต้นฉบับ)
        this.player.body.setSize(28, 24);
        this.player.body.setOffset(34, 64);
      }
    } catch (e) { console.warn('hero patch failed', e); }
  };

  // ----- update: เลือก idle / walk, ปรับความเร็วท่าเดิน, เด้งตัว -----
  var origUpdate = target.update;
  target.update = function () {
    if (origUpdate) origUpdate.apply(this, arguments);
    try {
      if (!this._heroOn || !this.player || !this.player.body) return;
      if (this.time.now < (this._atkUntil || 0)) { setBob(this, 0); return; }   // กำลังโจมตี ไม่ทับท่า

      var p = this.player, v = p.body.velocity;
      var speed = Math.hypot(v.x, v.y);
      var moving = speed > 12;
      if (moving) this._heroDir = dirFromVec(v.x, v.y);

      HeroAnims.play(p, moving ? 'walk' : 'idle', this._heroDir);
      p.anims.timeScale = moving ? Phaser.Math.Clamp(speed / SPEED_REF, 0.4, 1.2) : 1;

      // เด้ง 2 ครั้งต่อ 1 รอบท่าเดิน (ตามจังหวะก้าวซ้าย-ขวา)
      if (moving && BOB_PX > 0) {
        var prog = p.anims.getProgress ? p.anims.getProgress() : 0;
        setBob(this, Math.abs(Math.sin(prog * Math.PI * 2)) * BOB_PX);
      } else {
        setBob(this, 0);
      }
    } catch (e) {}
  };

  // ----- โจมตี: เล่นท่าตามอาวุธ หันไปทางเป้าหมาย -----
  function playAttack(scene) {
    if (!scene._heroOn || !scene.player) return;
    var p = scene.player, d = scene._heroDir || 'right';
    if (scene.target && typeof scene.target.x === 'number') d = scene.target.x < p.x ? 'left' : 'right';
    else if (scene.facing) d = scene.facing.x < 0 ? 'left' : 'right';
    scene._heroDir = d;
    scene._atkUntil = scene.time.now + ATTACK_MS;
    p.anims.timeScale = 1;
    HeroAnims.play(p, scene.attackAnimName(), d);
  }

  ['useBasicAttack', 'useSkill'].forEach(function (name) {
    var orig = target[name];
    if (typeof orig !== 'function') return;
    target[name] = function () {
      try { if (!this.panel) playAttack(this); } catch (e) {}
      return orig.apply(this, arguments);
    };
  });
})();
