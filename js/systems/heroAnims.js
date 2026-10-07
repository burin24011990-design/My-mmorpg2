// อนิเมชันตัวละครหลัก
// - 'hero'       : assets/hero.png (ชีตเดิม ช่อง 96x96, 6 คอลัมน์) ใช้กับ hurt/death และ fallback
// - 'hero_sword' : assets/hero_sword.png (นักดาบ)  - 'hero_rogue' : assets/hero_rogue.png (นักมีด)
// - 'hero_archer': assets/hero_archer.png (นักธนู) - 'hero_mage'  : assets/hero_mage.png (เมจ)
// - 'hero_priest': assets/hero_priest.png (พระ)    ชีตใหม่ 8 คอลัมน์ x 20 แถว
// เลขเฟรม = แถว*คอลัมน์ + คอลัมน์ | สกินใหม่ (archer/mage/priest) มีทิศซ้ายวาดแยก ไม่ต้องพลิกภาพ
(function () {
  var COLS = 6;
  function f(row, count) { var a = []; for (var i = 0; i < count; i++) a.push(row * COLS + i); return a; }

  // ชีตเดิม
  var BASE = {
    walk:  { down: f(0, 6), up: f(1, 6), right: f(2, 6), rate: 7, loop: true },
    idle:  { down: f(3, 4), up: f(4, 4), right: f(5, 4), rate: 2, loop: true },
    sword: { right: f(6, 5), rate: 12, loop: false },
    staff: { right: f(7, 5), rate: 10, loop: false },
    bow:   { right: f(8, 5), rate: 10, loop: false },
    hurt:  { right: f(9, 2), rate: 8,  loop: false },
    death: { right: [56, 57, 58, 59], rate: 6, loop: false }
  };

  // ชีต archer/mage: 9 คอลัมน์ x 12 แถว (ช่อง 96x96)
  // แถว: 0-3 idle(down,left,right,up) | 4-7 walk | 8-11 attack
  var NC = 9;
  function g(row, count) { var a = []; for (var i = 0; i < count; i++) a.push(row * NC + i); return a; }
  function dirs(startRow, count) {
    return { down: g(startRow, count), left: g(startRow + 1, count), right: g(startRow + 2, count), up: g(startRow + 3, count) };
  }
  function mix(o, extra) { for (var k in extra) o[k] = extra[k]; return o; }

  // ชีตพระ: 8 คอลัมน์ x 20 แถว (ช่อง 96x96) -> 768 x 1920 px
  // แถว: 0-3 idle | 4-7 walk | 8-11 ตีปกติ | 12-15 ท่าที่ 2 | 16-19 ท่าที่ 3 (วงแสง)
  // ลำดับทิศในแต่ละชุด: down, left, right, up
  var PC = 8;
  function pr(row, count) { var a = []; for (var i = 0; i < count; i++) a.push(row * PC + i); return a; }
  // c = จำนวนเฟรมแต่ละทิศ (ถ้าไม่ระบุ ใช้ 3 เฟรมทุกทิศ)
  function pdirs(startRow, c) {
    c = c || { down: 3, left: 3, right: 3, up: 3 };
    return {
      down: pr(startRow, c.down),
      left: pr(startRow + 1, c.left),
      right: pr(startRow + 2, c.right),
      up: pr(startRow + 3, c.up)
    };
  }
  var PRIEST_IDLE_N = { down: 6, left: 8, right: 6, up: 8 };
  var PRIEST_WALK_N = { down: 3, left: 4, right: 3, up: 4 };

  // ชีตใหม่ (action ที่ไม่มีในนี้ เช่น hurt/death จะ fallback ไปใช้ชีตเดิม)
  var SKINS = {
    hero_sword: {
      walk: { down: [0, 1, 2, 3, 4, 5], up: [6, 7, 8, 9, 10, 11], right: [12, 13, 14, 15, 16, 17], rate: 8, loop: true },
      idle: { down: [18, 19, 20, 21, 22, 23], up: [24, 25, 26, 27, 28, 29], right: [30, 31, 32, 33, 34, 35], rate: 4, loop: true },
      sword: { down: [36, 37, 38, 39, 40, 41], up: [42, 43, 44, 45, 46, 47], right: [48, 49, 50, 51, 52, 53], rate: 14, loop: false },
      dagger: { down: [36, 37, 38, 39, 40, 41], up: [42, 43, 44, 45, 46, 47], right: [48, 49, 50, 51, 52, 53], rate: 14, loop: false },
      skill: { down: [54, 55, 56], up: [60, 61, 62], right: [66, 67, 68], rate: 12, loop: false }
    },
    hero_rogue: {
      walk: { down: [0, 1, 2, 1], up: [6, 7, 8, 7], right: [12, 13, 14, 13], rate: 8, loop: true },
      idle: { down: [18, 19, 20, 21, 22, 23], up: [24, 25, 26, 27, 28, 29], right: [30, 31, 32, 33, 34, 35], rate: 4, loop: true },
      sword: { down: [36, 37, 38, 39, 40, 41], up: [42, 43, 44, 45, 46, 47], right: [48, 49, 50, 51], rate: 14, loop: false },
      dagger: { down: [36, 37, 38, 39, 40, 41], up: [42, 43, 44, 45, 46, 47], right: [48, 49, 50, 51], rate: 14, loop: false },
      skill: { down: [54, 55, 56], up: [60, 61, 62], right: [66, 67], rate: 12, loop: false }
    },
    // นักธนู: idle 6 เฟรม / walk 6 เฟรม / ยิง 9 เฟรม (ใช้ท่า 'bow' + 'skill')
    hero_archer: {
      idle: mix(dirs(0, 6), { rate: 6, loop: true }),
      walk: mix(dirs(4, 6), { rate: 10, loop: true }),
      bow:  mix(dirs(8, 9), { rate: 21, loop: false })
    },
    // เมจ: idle 6 เฟรม / walk 6 เฟรม / ร่ายเวท 6 เฟรม (ใช้ท่า 'staff')
    hero_mage: {
      idle:  mix(dirs(0, 6), { rate: 6, loop: true }),
      walk:  mix(dirs(4, 6), { rate: 10, loop: true }),
      staff: mix(dirs(8, 6), { rate: 14, loop: false })
    },
    // พระ: idle 6-8 เฟรม / walk 3-4 เฟรม / โจมตี 3 ชุด ชุดละ 3 เฟรม
    //  staff  = ตีปกติ (ใช้ได้กับ sword/dagger ด้วย)
    //  skill  = ท่าสกิล (มีแสงรอบตัว)   skill2 = ท่าสกิลที่ 2 (วงแสงใหญ่)
    hero_priest: {
      idle:   mix(pdirs(0, PRIEST_IDLE_N), { rate: 6,  loop: true }),
      walk:   mix(pdirs(4, PRIEST_WALK_N), { rate: 8,  loop: true }),
      staff:  mix(pdirs(8),                { rate: 10, loop: false }),
      sword:  mix(pdirs(8),                { rate: 10, loop: false }),
      dagger: mix(pdirs(8),                { rate: 10, loop: false }),
      skill:  mix(pdirs(12),               { rate: 12, loop: false }),
      skill2: mix(pdirs(16),               { rate: 12, loop: false })
    }
  };
  var SHEETS = {
    hero_sword: 'assets/hero_sword.png',
    hero_rogue: 'assets/hero_rogue.png',
    hero_archer: 'assets/hero_archer.png',
    hero_mage: 'assets/hero_mage.png',
    hero_priest: 'assets/hero_priest.png'
  };

  // คลาสอาวุธ -> ท่าโจมตี (ใช้ร่วมกันทั้งตัวเองและผู้เล่นอื่น)
  var ATTACK_BY_CLASS = { sword: 'sword', rogue: 'sword', mage: 'staff', priest: 'staff', archer: 'bow' };
  var HAS_SKILL_ANIM = { sword: true, rogue: true };

  window.HeroAnims = {
    KEY: 'hero',
    SCALE: 0.75,

    // แปลงชื่อคลาส -> สกิน  (ปรับ regex ให้ตรงกับชื่อคลาสในเกมคุณได้)
    skinOf: function (cls) {
      cls = String(cls || '').toLowerCase();
      if (/sword|warrior|knight|fighter|ดาบ/.test(cls)) return 'hero_sword';
      if (/rogue|dagger|assassin|thief|มีด/.test(cls)) return 'hero_rogue';
      if (/archer|bow|ranger|hunter|ธนู/.test(cls)) return 'hero_archer';
      if (/mage|wizard|sorcer|magic|คทา|เมจ/.test(cls)) return 'hero_mage';
      if (/priest|monk|cleric|healer|พระ|นักบวช/.test(cls)) return 'hero_priest';
      return 'hero';
    },

    // ท่าโจมตีตามคลาส (isSkill=true และคลาสมีท่า skill -> 'skill')
    attackOf: function (cls, isSkill) {
      cls = String(cls || 'sword');
      if (isSkill && HAS_SKILL_ANIM[cls]) return 'skill';
      return ATTACK_BY_CLASS[cls] || 'sword';
    },

    preload: function (scene) {
      scene.load.spritesheet('hero', 'assets/hero.png', { frameWidth: 96, frameHeight: 96 });
      Object.keys(SHEETS).forEach(function (k) {
        scene.load.spritesheet(k, SHEETS[k], { frameWidth: 96, frameHeight: 96 });
      });
    },

    create: function (scene) {
      function mk(key, defs) {
        if (!scene.textures.exists(key)) return;
        Object.keys(defs).forEach(function (act) {
          var d = defs[act];
          ['down', 'up', 'left', 'right'].forEach(function (dir) {
            if (!d[dir]) return;
            var name = key + '_' + act + '_' + dir;
            if (scene.anims.exists(name)) return;
            scene.anims.create({
              key: name,
              frames: scene.anims.generateFrameNumbers(key, { frames: d[dir] }),
              frameRate: d.rate,
              repeat: d.loop ? -1 : 0
            });
          });
        });
      }
      mk('hero', BASE);
      Object.keys(SKINS).forEach(function (k) { mk(k, SKINS[k]); });
    },

    // HeroAnims.play(sprite, 'walk', 'left', skin?)
    // skin: 'hero_sword' | 'hero_rogue' | 'hero_archer' | 'hero_mage' | 'hero_priest' | 'hero'
    // ถ้าไม่ส่ง skin จะใช้ sprite.heroSkin  (ผู้เล่นอื่นต้องตั้ง sprite.heroSkin ไว้ ไม่งั้นจะได้ชุดเก่า 'hero')
    // 'sword' = ตีปกติ, 'skill' = ท่าสกิลหมุน/แทง (ชุดที่ 2 ของแต่ละคลาส), 'skill2' = เฉพาะพระ
    play: function (sprite, action, dir, skin) {
      if (!sprite || !sprite.scene || !sprite.anims || !sprite.scene.textures.exists('hero')) return;
      if (!skin) skin = sprite.heroSkin;
      if (!skin) {
        // ตัวของผู้เล่นเอง -> เลือกสกินตามอาวุธที่สวม (Main.currentClass())
        var sc = sprite.scene;
        var mine = sc && sc.currentClass && (sprite === sc.player || sprite === sc.hero || sprite === sc.me);
        skin = mine ? HeroAnims.skinOf(sc.currentClass()) : 'hero';
      }
      var defs = SKINS[skin];
      var key = skin, d = defs && defs[action];
      if (!d) { key = 'hero'; d = BASE[action]; }
      if (!d) return;
      // สกินใหม่มีทิศซ้ายวาดแยก -> ใช้ตรงๆ | ชีตเก่าใช้ทิศขวา + พลิกภาพ
      var useDir = dir, flip = false;
      if (!d[useDir]) { useDir = 'right'; flip = (dir === 'left'); }
      if (!d[useDir]) return;
      sprite.setFlipX(flip);
      sprite.play(key + '_' + action + '_' + useDir, true);
    }
  };
})();
