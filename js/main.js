// ===== จุดเริ่มเกม (โหลดเป็นไฟล์สุดท้าย) =====

// ----- โหลดรูปหญ้า (ครอบ preload ของ Main โดยไม่ต้องแก้ scenes/Main.js) -----
const GRASS_KEYS = ['grass1', 'grass2', 'grass3'];

function loadGrassImages(scene) {
  GRASS_KEYS.forEach(function (k) {
    if (!scene.textures.exists(k)) scene.load.image(k, 'assets/' + k + '.png');
  });
}

// ใส่ true เพื่อวางหญ้าทดสอบ 3 กอ (ทดสอบเสร็จแล้วเปลี่ยนเป็น false)
const GRASS_TEST = true;

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
        const pl = this.player && (this.player.sprite || this.player);
        if (!list || !pl || typeof pl.x !== 'number') return;
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
  scene: Main,
});
