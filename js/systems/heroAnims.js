// อนิเมชันตัวละครหลัก (sprite sheet: assets/hero.png, ช่องละ 96x96, 6 คอลัมน์)
// เลขเฟรม = แถว*6 + คอลัมน์ (แถวเริ่มที่ 0)
// ทิศซ้ายใช้ทิศขวา + setFlipX(true)
(function () {
  var KEY = 'hero';
  var COLS = 6;
  function f(row, count) { var a = []; for (var i = 0; i < count; i++) a.push(row * COLS + i); return a; }

  // action -> ทิศ -> เฟรม
  var DEF = {
    walk:  { down: f(0, 6), up: f(1, 6), right: f(2, 6), rate: 10, loop: true },
    idle:  { down: f(3, 4), up: f(4, 4), right: f(5, 4), rate: 4,  loop: true },
    sword: { right: f(6, 5), rate: 12, loop: false },   // ตีระยะใกล้
    staff: { right: f(7, 5), rate: 10, loop: false },   // ยิงระยะไกล
    bow:   { right: f(8, 5), rate: 10, loop: false },   // ยิงระยะไกล
    hurt:  { right: f(9, 2), rate: 8,  loop: false },
    death: { right: [56, 57, 58, 59], rate: 6, loop: false }
  };

  window.HeroAnims = {
    KEY: KEY,

    // เรียกใน preload() ของ Scene
    preload: function (scene) {
      scene.load.spritesheet(KEY, 'assets/hero.png', { frameWidth: 96, frameHeight: 96 });
    },

    // เรียกใน create() ของ Scene (หลังโหลดเสร็จ)
    create: function (scene) {
      if (!scene.textures.exists(KEY)) return;       // ไม่มีรูป -> ข้าม เกมไม่พัง
      Object.keys(DEF).forEach(function (act) {
        var d = DEF[act];
        ['down', 'up', 'right'].forEach(function (dir) {
          if (!d[dir]) return;
          var name = KEY + '_' + act + '_' + dir;
          if (scene.anims.exists(name)) return;
          scene.anims.create({
            key: name,
            frames: scene.anims.generateFrameNumbers(KEY, { frames: d[dir] }),
            frameRate: d.rate,
            repeat: d.loop ? -1 : 0
          });
        });
      });
    },

    // เล่นอนิเมชัน: HeroAnims.play(sprite, 'walk', 'left')
    // dir = 'down' | 'up' | 'left' | 'right'  (left = พลิกภาพขวา)
    // action ที่มีทิศเดียว (sword/staff/bow/hurt/death) จะใช้ทิศขวา แล้วพลิกตามทิศที่หัน
    play: function (sprite, action, dir) {
      if (!sprite || !sprite.scene || !sprite.scene.textures.exists(KEY)) return;
      var d = DEF[action]; if (!d) return;
      var useDir = dir === 'left' ? 'right' : dir;
      if (!d[useDir]) useDir = 'right';
      sprite.setFlipX(dir === 'left');
      sprite.play(KEY + '_' + action + '_' + useDir, true);
    }
  };
})();
