// ===== ฉากหลัก: สร้างโลก + วนลูปเกม (ตรรกะแต่ละส่วนอยู่ในโฟลเดอร์ systems/) =====
class Main extends Phaser.Scene {
  create() {
    generateTextures(this);

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

    this.initPlayerState();
    this.bag = new Array(BAG_SIZE).fill(null);
    this.equipment = { weapon: null, helmet: null, armor: null, gloves: null, shoes: null, ring1: null, ring2: null, necklace: null };
    this.computeAtk();

    this.player = this.physics.add.sprite(ZONES[0].x, ZONES[0].y, 'player').setCollideWorldBounds(true);
    this.facing = new Phaser.Math.Vector2(1, 0);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.loot = this.physics.add.group();
    this.physics.add.overlap(this.projectiles, this.enemies, (fb, e) => {
      const dmg = fb.getData('dmg') || 10; fb.destroy(); this.damage(e, dmg);
    });
    this.physics.add.overlap(this.player, this.loot, (pl, item) => this.pickup(item));
    this.targetRing = this.add.circle(0, 0, 22, 0x000000, 0).setStrokeStyle(3, 0xffe066, 0.95).setVisible(false);

    this.setupInput();
    this.setupHud();
    this.setupButtons();
    this.loadStage(0); // เริ่มที่ด่าน 1
    this.initNetwork();
  }

  update(time, deltaMs) {
    this.stats.mp = Math.min(this.maxMp(), this.stats.mp + 3 * (deltaMs / 1000));
    this.updateEnemies(time);
    this.updateTargeting();
    this.updateSkillButtons(time);
    this.updateMovement();
    this.updateNetwork(time);
    this.updateHud();
  }
}
