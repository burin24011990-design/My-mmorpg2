// ===== เปลี่ยนตัวละครผู้เล่นเป็นสไปรต์ hero.png + เล่นอนิเมชัน =====
// ไม่แก้ไฟล์เดิม: ครอบ preload / create / update / useBasicAttack / useSkill ของ Main
// โหลดหลัง heroAnims.js และหลัง stats.js แต่ก่อน main.js
// ถ้าไม่มี assets/hero.png เกมจะใช้วงกลมสีฟ้าเดิมต่อไป ไม่พัง

(function () {
  var HERO_SCALE = 0.75;      // ขนาดตัวละครในเกม (ปรับเลขนี้ถ้าใหญ่/เล็กไป)
  var ATTACK_MS = 420;        // ระยะเวลาที่ล็อกท่าโจมตี

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
      if (this.player.body) {                      // กล่องชนเล็กแค่ช่วงเท้า (หน่วยเป็นพิกเซลของรูปต้นฉบับ)
        this.player.body.setSize(28, 24);
        this.player.body.setOffset(34, 64);
      }
    } catch (e) { console.warn('hero patch failed', e); }
  };

  // ----- update: เลือก idle / walk ตามการเคลื่อนที่ -----
  var origUpdate = target.update;
  target.update = function () {
    if (origUpdate) origUpdate.apply(this, arguments);
    try {
      if (!this._heroOn || !this.player || !this.player.body) return;
      if (this.time.now < (this._atkUntil || 0)) return;   // กำลังโจมตี ไม่ทับท่า
      var v = this.player.body.velocity;
      var moving = Math.abs(v.x) + Math.abs(v.y) > 12;
      if (moving) this._heroDir = dirFromVec(v.x, v.y);
      HeroAnims.play(this.player, moving ? 'walk' : 'idle', this._heroDir);
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
