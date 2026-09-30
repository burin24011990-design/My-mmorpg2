// ===== ฉากหลัก: สร้างโลก + วนลูปเกม (ตรรกะแต่ละส่วนอยู่ในโฟลเดอร์ systems/) =====
class Main extends Phaser.Scene {
  create() {
    generateTextures(this);

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.add.grid(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 64, 64, 0x2b3a2b, 1, 0x1f2b1f, 1);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    const zoneGfx = this.add.graphics();
    ZONES.forEach(z => {
      zoneGfx.lineStyle(2, 0x5a7a3a, 0.5).strokeCircle(z.x, z.y, z.r);
      this.add.text(z.x, z.y - z.r - 16, z.name + '  (Lv.' + z.minLv + '-' + z.maxLv + ')', { fontSize: '13px', color: '#9fd98a', fontStyle: 'bold' }).setOrigin(0.5);
    });

    this.initPlayerState();
    this.bag = new Array(BAG_SIZE).fill(null);
    this.equipment = { weapon: null, helmet: null, armor: null, gloves: null, shoes: null, ring1: null, ring2: null, necklace: null };
    this.computeAtk();

    this.player = this.physics.add.sprite(ZONES[0].x, ZONES[0].y, 'player').setCollideWorldBounds(true);
    this.facing = new Phaser.Math.Vector2(1, 0);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.enemies = this.physics.add.group();
    ZONES.forEach((z, zi) => { for (let i = 0; i < z.count; i++) this.spawnEnemyInZone(zi); });
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
