// ===== จุดเริ่มเกม (โหลดเป็นไฟล์สุดท้าย) =====

// ----- โหลดรูปของแมพทั้งหมด (ครอบ preload ของ Main โดยไม่ต้องแก้ scenes/Main.js) -----
// key -> ไฟล์ใน assets/   (ถ้าชื่อหรือนามสกุลไฟล์ของคุณต่างจากนี้ ให้แก้ตรงนี้)
const MAP_IMAGES = {
  grass1: 'assets/grass1.png', grass2: 'assets/grass2.png', grass3: 'assets/grass3.png',
  rock1: 'assets/rock1.png', rock2: 'assets/rock2.png', rock3: 'assets/rock3.png',
  floor_grass: 'assets/floor_grass.jpg',
  deco_flower: 'assets/deco_flower.png', deco_tuft: 'assets/deco_tuft.png',
  deco_pebble: 'assets/deco_pebble.png', deco_mushroom: 'assets/deco_mushroom.png',
  deco_stump: 'assets/deco_stump.png', deco_dirt: 'assets/deco_dirt.png',
  pond1: 'assets/pond1.png',
};

function loadGrassImages(scene) {
  Object.keys(MAP_IMAGES).forEach(function (k) {
    if (!scene.textures.exists(k)) scene.load.image(k, MAP_IMAGES[k]);
  });
}

// ใส่ true เพื่อวางหญ้าทดสอบ 3 กอ (ทดสอบเสร็จแล้วเปลี่ยนเป็น false)
const GRASS_TEST = false;

// ขนาดวงรีที่ถือว่า "อยู่ในหญ้า" (สัดส่วนของขนาดภาพ)
const GRASS_RX = 0.40, GRASS_RY = 0.30;
const GRASS_ALPHA_INSIDE = 0.4;   // ความโปร่งของหญ้าตอนเราอยู่ข้างใน (เห็นตัวเอง)

(function patchMainScene() {
  // รองรับทั้งแบบ class และแบบ object ของ Phaser scene
  const target = (typeof Main === 'function') ? Main.prototype : Main;

  const origPreload = target.preload;
  target.preload = function () {
    if (origPreload) origPreload.apply(this, arguments);
    loadGrassImages(this);

    // โหลด sprite sheet มอนสเตอร์ (ตามรายการ MONSTER_SHEETS_READY ใน js/data/monsterDefs.js)
    // ไฟล์ไหนโหลดไม่ได้ เกมจะใช้วงกลมสีสำรองแทนเอง ไม่พัง
    if (typeof preloadMonsterSprites === 'function') {
      preloadMonsterSprites(this);
      this.load.on('loaderror', function (file) {
        if (file && file.key && String(file.key).indexOf('mon_') === 0) {
          console.warn('โหลด sprite มอนไม่ได้ (ใช้วงกลมสีแทน):', file.src);
        }
      });
    }
  };

  if (GRASS_TEST) {
    const origCreate = target.create;
    target.create = function () {
      if (origCreate) origCreate.apply(this, arguments);
      try {
        this._grassTest = [
          this.add.image(300, 300, 'grass1').setScale(0.5).setDepth(5000),
          this.add.image(450, 300, 'grass2').setScale(0.5).setDepth(5000),
          this.add.image(600, 300, 'grass3').setScale(0.5).setDepth(5000),
        ];
      } catch (e) { console.warn('grass test failed', e); }
    };

    // เมื่อผู้เล่นอยู่ในวงรีของหญ้า -> หญ้าจางลงให้เห็นตัวเอง / ออกนอกหญ้า -> ทึบเหมือนเดิม
    const origUpdate = target.update;
    target.update = function () {
      if (origUpdate) origUpdate.apply(this, arguments);
      try {
        const list = this._grassTest;
        if (!list) return;
        // หาตัวละครของเรา: 1) เป้าหมายที่กล้องตาม 2) this.player 3) สไปรต์ที่ใช้รูป 'player'
        let pl = this._plRef;
        if (!pl || !pl.active) {
          pl = this.cameras.main._follow;
          if (!pl && this.player) pl = this.player.sprite || this.player;
          if (!pl) pl = this.children.list.find(function (o) {
            return o.texture && o.texture.key === 'player' && typeof o.x === 'number';
          });
          this._plRef = pl;
        }
        if (!pl || typeof pl.x !== 'number') return;
        list.forEach(function (g) {
          const dx = (pl.x - g.x) / (g.displayWidth * GRASS_RX);
          const dy = (pl.y - g.y) / (g.displayHeight * GRASS_RY);
          const inside = dx * dx + dy * dy <= 1;
          const to = inside ? GRASS_ALPHA_INSIDE : 1;
          g.alpha += (to - g.alpha) * 0.25;
        });
      } catch (e) {}
    };
  }
})();

new Phaser.Game({
  type: Phaser.AUTO,
  width: W, height: H,
  backgroundColor: '#1b241b',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade' },
  // ตั้งค่าลดแลคบนมือถือ
  render: { antialias: false, powerPreference: 'high-performance', batchSize: 4096 },
  fps: { target: 60 },
  // Town อยู่ก่อน = เริ่มเกมที่เมือง แล้วเดินเข้า "ประตูเมือง" เพื่อไปฉาก Main
  // (ถ้าอยากข้ามเมืองชั่วคราว เปลี่ยนเป็น scene: Main)
  scene: [Main],
});
