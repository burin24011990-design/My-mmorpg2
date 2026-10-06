// อนิเมชันตัวละครหลัก
// - 'hero'       : assets/hero.png (ชีตเดิม ช่อง 96x96, 6 คอลัมน์) ใช้กับ mage/archer/priest + hurt/death
// - 'hero_sword' : assets/hero_sword.png (นักดาบ)  - 'hero_rogue' : assets/hero_rogue.png (นักมีด)
// เลขเฟรม = แถว*6 + คอลัมน์ | ทิศซ้ายใช้ทิศขวา + setFlipX(true)
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

  // ชีตใหม่ (action ที่ไม่มีในนี้ เช่น hurt/death/staff/bow จะ fallback ไปใช้ชีตเดิม)
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
    }
  };
  var SHEETS = { hero_sword: 'assets/hero_sword.png', hero_rogue: 'assets/hero_rogue.png' };

  window.HeroAnims = {
    KEY: 'hero',

    // แปลงชื่อคลาส -> สกิน  (ปรับ regex ให้ตรงกับชื่อคลาสในเกมคุณได้)
    skinOf: function (cls) {
      cls = String(cls || '').toLowerCase();
      if (/sword|warrior|knight|fighter|ดาบ/.test(cls)) return 'hero_sword';
      if (/rogue|dagger|assassin|thief|มีด/.test(cls)) return 'hero_rogue';
      return 'hero';
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
          ['down', 'up', 'right'].forEach(function (dir) {
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

    // HeroAnims.play(sprite, 'walk', 'left', skin?)   skin: 'hero_sword' | 'hero_rogue' | 'hero'
    // ถ้าไม่ส่ง skin จะใช้ sprite.heroSkin
    // 'sword' = ตีปกติ, 'skill' = ท่าสกิลหมุน/แทง (ชุดที่ 2 ของแต่ละคลาส)
    play: function (sprite, action, dir, skin) {
      if (!sprite || !sprite.scene || !sprite.scene.textures.exists('hero')) return;
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
      var useDir = dir === 'left' ? 'right' : dir;
      if (!d[useDir]) useDir = 'right';
      if (!d[useDir]) return;
      sprite.setFlipX(dir === 'left');
      sprite.play(key + '_' + action + '_' + useDir, true);
    }
  };
})();
