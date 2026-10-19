// อนิเมชันตัวละครหลัก
// - 'hero'       : assets/hero.png (ชีตเดิม ช่อง 96x96, 6 คอลัมน์) ใช้กับ hurt/death และ fallback
// - ชีตใหม่ทุกอาชีพใช้ผังเดียวกัน: 4 คอลัมน์ x 12 แถว (ช่อง 96x96 -> 384 x 1152 px)
//     hero_sword (ดาบ) | hero_rogue (โจร) | hero_archer (ธนู) | hero_mage (เมจ พัด) | hero_priest (หมอ)
//   แถว: 0-3 idle | 4-7 walk | 8-11 โจมตี   ลำดับทิศในแต่ละชุด: down, left, right, up
// เลขเฟรม = แถว*4 + คอลัมน์
(function () {
  var COLS = 6;
  function f(row, count) { var a = []; for (var i = 0; i < count; i++) a.push(row * COLS + i); return a; }

  // ฟังก์ชันช่วยรวมค่า (ต้องอยู่ก่อน SKINS)
  function mix(o, extra) { for (var k in extra) o[k] = extra[k]; return o; }

  // ชีตเดิม (ใช้กับ hurt/death และ fallback)
  var BASE = {
    walk:  { down: f(0, 6), up: f(1, 6), right: f(2, 6), rate: 7, loop: true },
    idle:  { down: f(3, 4), up: f(4, 4), right: f(5, 4), rate: 2, loop: true },
    sword: { right: f(6, 5), rate: 12, loop: false },
    staff: { right: f(7, 5), rate: 10, loop: false },
    bow:   { right: f(8, 5), rate: 10, loop: false },
    hurt:  { right: f(9, 2), rate: 8,  loop: false },
    death: { right: [56, 57, 58, 59], rate: 6, loop: false }
  };

  // ชีตผัง 4 คอลัมน์ x 12 แถว
  var HC = 4;
  // frames = ลำดับเฟรมที่เล่น (0-3) ของแถวนั้น เช่น [0,0,1,1,2,3] = ค้างท่าเตรียมกับท่าปะทะให้เห็นจังหวะ
  function hseq(row, frames) {
    function one(r) { return frames.map(function (i) { return r * HC + i; }); }
    return { down: one(row), left: one(row + 1), right: one(row + 2), up: one(row + 3) };
  }
  function hdirs(row) { return hseq(row, [0, 1, 2, 3]); }

  // จังหวะท่าโจมตี (ปรับตรงนี้ถ้าอยากให้ช้า/เร็วขึ้น)
  //  ATK6 = 5 ช็อต (ดาบ/โจร), ATK7 = 6 ช็อต (ธนู/เมจ/หมอ) | เวลาเล่น = จำนวนช็อต / rate (วินาที)
  //  เฟรม 0 = เตรียมท่า, 1 = ฟัน/ปล่อย (ค้าง 2 ช็อตให้เห็นจังหวะปะทะ), 2 = ตามแรง, 3 = เก็บท่า
  //  heroPatch.js อ่านเวลาเล่นจริงจากอนิเมชัน แล้วล็อกท่าให้เอง ไม่ต้องตั้งเวลาซ้ำ
  var ATK6 = [0, 1, 1, 2, 3];
  var ATK7 = [0, 1, 1, 2, 2, 3];

  // ชีตใหม่ (action ที่ไม่มีในนี้ เช่น hurt/death จะ fallback ไปใช้ชีตเดิม)
  var SKINS = {
    // นักดาบ: ฟัน 5 ช็อต ~0.5 วิ
    hero_sword: {
      idle:   mix(hdirs(0), { rate: 5, loop: true }),
      walk:   mix(hdirs(4), { rate: 8, loop: true }),
      sword:  mix(hseq(8, ATK6), { rate: 10, loop: false }),
      dagger: mix(hseq(8, ATK6), { rate: 10, loop: false }),
      skill:  mix(hseq(8, ATK6), { rate: 10, loop: false })
    },
    // โจร: ฟันมีดคู่ 5 ช็อต ~0.5 วิ
    hero_rogue: {
      idle:   mix(hdirs(0), { rate: 5, loop: true }),
      walk:   mix(hdirs(4), { rate: 8, loop: true }),
      sword:  mix(hseq(8, ATK6), { rate: 10, loop: false }),
      dagger: mix(hseq(8, ATK6), { rate: 10, loop: false }),
      skill:  mix(hseq(8, ATK6), { rate: 10, loop: false })
    },
    // นักธนู: ง้างคันธนู-ปล่อยลูกธนู 6 ช็อต ~0.6 วิ (ใช้ท่า 'bow')
    hero_archer: {
      idle:  mix(hdirs(0), { rate: 5, loop: true }),
      walk:  mix(hdirs(4), { rate: 8, loop: true }),
      bow:   mix(hseq(8, ATK7), { rate: 10, loop: false }),
      skill: mix(hseq(8, ATK7), { rate: 10, loop: false })
    },
    // เมจ (กำลังภายใน ถือพัด): ร่ายเวท 6 ช็อต ~0.6 วิ (ใช้ท่า 'staff')
    hero_mage: {
      idle:  mix(hdirs(0), { rate: 5, loop: true }),
      walk:  mix(hdirs(4), { rate: 8, loop: true }),
      staff: mix(hseq(8, ATK7), { rate: 10, loop: false }),
      skill: mix(hseq(8, ATK7), { rate: 10, loop: false })
    },
    // หมอ (เดิมคือพระ): ร่ายเวท 6 ช็อต ~0.6 วิ
    //  staff = ตีปกติ (ใช้ได้กับ sword/dagger ด้วย)  skill / skill2 = ท่าสกิล (ใช้เฟรมชุดเดียวกัน)
    hero_priest: {
      idle:   mix(hdirs(0), { rate: 5, loop: true }),
      walk:   mix(hdirs(4), { rate: 8, loop: true }),
      staff:  mix(hseq(8, ATK7), { rate: 10, loop: false }),
      sword:  mix(hseq(8, ATK7), { rate: 10, loop: false }),
      dagger: mix(hseq(8, ATK7), { rate: 10, loop: false }),
      skill:  mix(hseq(8, ATK7), { rate: 10, loop: false }),
      skill2: mix(hseq(8, ATK7), { rate: 10, loop: false })
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
    SCALE: 1.0,

    // แปลงชื่อคลาส -> สกิน  (ปรับ regex ให้ตรงกับชื่อคลาสในเกมคุณได้)
    skinOf: function (cls) {
      cls = String(cls || '').toLowerCase();
      if (/sword|warrior|knight|fighter|ดาบ/.test(cls)) return 'hero_sword';
      if (/rogue|dagger|assassin|thief|มีด/.test(cls)) return 'hero_rogue';
      if (/archer|bow|ranger|hunter|ธนู/.test(cls)) return 'hero_archer';
      if (/mage|wizard|sorcer|magic|คทา|เมจ/.test(cls)) return 'hero_mage';
      if (/priest|monk|cleric|healer|doctor|หมอ|พระ|นักบวช/.test(cls)) return 'hero_priest';
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
    // 'sword' = ตีปกติ, 'skill' = ท่าสกิล, 'skill2' = เฉพาะหมอ
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
