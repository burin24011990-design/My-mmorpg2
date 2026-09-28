// ขั้นที่ 1: ตัวละครเดิน + ปุ่มโจมตี/สกิล + มอนสเตอร์ (ออฟไลน์)
const W = 800, H = 450;

class Main extends Phaser.Scene {
  create() {
    // สร้างภาพด้วยโค้ด (ยังไม่ต้องใช้ไฟล์รูป)
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x4aa3ff).fillCircle(16, 16, 16).generateTexture('player', 32, 32);
    g.clear().fillStyle(0x6bd66b).fillCircle(14, 14, 14).generateTexture('slime', 28, 28);
    g.clear().fillStyle(0xff8a3d).fillCircle(8, 8, 8).generateTexture('fireball', 16, 16);
    g.destroy();

    // โลก
    this.physics.world.setBounds(0, 0, 1600, 900);
    this.add.grid(800, 450, 1600, 900, 64, 64, 0x2b3a2b, 1, 0x1f2b1f, 1);
    this.cameras.main.setBounds(0, 0, 1600, 900);

    // ผู้เล่น
    this.player = this.physics.add.sprite(800, 450, 'player').setCollideWorldBounds(true);
    this.player.hp = 100; this.player.maxHp = 100;
    this.facing = new Phaser.Math.Vector2(1, 0);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.hitCd = 0;
    this.kills = 0;

    // มอนสเตอร์
    this.enemies = this.physics.add.group();
    for (let i = 0; i < 8; i++) this.spawnEnemy();
    this.fireballs = this.physics.add.group();
    this.physics.add.overlap(this.fireballs, this.enemies, (fb, e) => {
      fb.destroy(); this.damage(e, 25);
    });

    // คีย์บอร์ด (คอม)
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.input.keyboard.on('keydown-J', () => this.useSkill('atk'));
    this.input.keyboard.on('keydown-K', () => this.useSkill('s1'));
    this.input.keyboard.on('keydown-L', () => this.useSkill('s2'));

    // จอยสติ๊ก (มือถือ) - แตะครึ่งจอซ้าย
    this.input.addPointer(2);
    this.joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.joyBase = this.add.circle(0, 0, 50, 0xffffff, 0.15).setScrollFactor(0).setDepth(100).setVisible(false);
    this.joyKnob = this.add.circle(0, 0, 22, 0xffffff, 0.4).setScrollFactor(0).setDepth(101).setVisible(false);
    this.input.on('pointerdown', p => {
      if (p.x < W * 0.55 && this.joy.id === null) {
        this.joy.id = p.id; this.joy.ox = p.x; this.joy.oy = p.y;
        this.joyBase.setPosition(p.x, p.y).setVisible(true);
        this.joyKnob.setPosition(p.x, p.y).setVisible(true);
      }
    });
    this.input.on('pointermove', p => {
      if (p.id !== this.joy.id) return;
      const v = new Phaser.Math.Vector2(p.x - this.joy.ox, p.y - this.joy.oy);
      if (v.length() > 50) v.setLength(50);
      this.joy.dx = v.x / 50; this.joy.dy = v.y / 50;
      this.joyKnob.setPosition(this.joy.ox + v.x, this.joy.oy + v.y);
    });
    const release = p => {
      if (p.id !== this.joy.id) return;
      this.joy.id = null; this.joy.dx = 0; this.joy.dy = 0;
      this.joyBase.setVisible(false); this.joyKnob.setVisible(false);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    // ปุ่มสกิล (ขวาล่าง)
    this.cdEnd = { atk: 0, s1: 0, s2: 0 };
    this.cdTime = { atk: 400, s1: 3000, s2: 1800 };
    this.btns = {
      atk: this.makeBtn(690, 350, 46, 'โจมตี', 0xd94a4a),
      s1: this.makeBtn(590, 385, 34, 'สกิล1', 0x8a4ad9),
      s2: this.makeBtn(620, 290, 34, 'สกิล2', 0xd9a14a),
    };

    // HUD
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.hudText = this.add.text(12, 26, '', { fontSize: '14px', color: '#fff' }).setScrollFactor(0).setDepth(100);
  }

  makeBtn(x, y, r, label, color) {
    const c = this.add.circle(x, y, r, color, 0.7).setScrollFactor(0).setDepth(100).setInteractive();
    c.setStrokeStyle(3, 0xffffff, 0.6);
    const t = this.add.text(x, y, label, { fontSize: '14px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    return { c, t, label };
  }

  spawnEnemy() {
    const e = this.enemies.create(Phaser.Math.Between(50, 1550), Phaser.Math.Between(50, 850), 'slime');
    e.hp = 40; e.setCollideWorldBounds(true);
    if (Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 200) e.x += 400;
  }

  damage(e, dmg) {
    if (!e.active) return;
    e.hp -= dmg;
    const t = this.add.text(e.x, e.y - 20, String(dmg), { fontSize: '16px', color: '#ffe066' }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 600, onComplete: () => t.destroy() });
    if (e.hp <= 0) {
      e.destroy(); this.kills++;
      this.time.delayedCall(2000, () => this.spawnEnemy());
    }
  }

  useSkill(name) {
    const now = this.time.now;
    if (now < this.cdEnd[name]) return;
    this.cdEnd[name] = now + this.cdTime[name];
    const p = this.player;

    if (name === 'atk') { // ฟันด้านหน้า
      const fx = p.x + this.facing.x * 40, fy = p.y + this.facing.y * 40;
      this.flash(fx, fy, 45, 0xffffff);
      this.enemies.getChildren().slice().forEach(e => {
        if (Phaser.Math.Distance.Between(fx, fy, e.x, e.y) < 55) this.damage(e, Phaser.Math.Between(10, 15));
      });
    } else if (name === 's1') { // ฟันรอบตัว
      this.flash(p.x, p.y, 110, 0x8a4ad9);
      this.enemies.getChildren().slice().forEach(e => {
        if (Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) < 110) this.damage(e, 30);
      });
    } else if (name === 's2') { // ลูกไฟ
      const fb = this.fireballs.create(p.x, p.y, 'fireball');
      fb.setVelocity(this.facing.x * 380, this.facing.y * 380);
      this.time.delayedCall(1200, () => fb.active && fb.destroy());
    }
  }

  flash(x, y, r, color) {
    const c = this.add.circle(x, y, r, color, 0.35);
    this.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy() });
  }

  update(time) {
    const p = this.player;

    // ปุ่มบนจอสัมผัส
    Object.keys(this.btns).forEach(k => {
      const b = this.btns[k];
      if (!b.bound) { b.c.on('pointerdown', () => this.useSkill(k)); b.bound = true; }
      const left = Math.max(0, this.cdEnd[k] - time);
      b.c.setAlpha(left > 0 ? 0.3 : 0.75);
      b.t.setText(left > 0 ? (left / 1000).toFixed(1) : b.label);
    });

    // เดิน
    let vx = this.joy.dx, vy = this.joy.dy;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;
    const v = new Phaser.Math.Vector2(vx, vy);
    if (v.length() > 1) v.normalize();
    p.setVelocity(v.x * 190, v.y * 190);
    if (v.length() > 0.2) this.facing.copy(v).normalize();

    // มอนสเตอร์ไล่ตี
    this.enemies.getChildren().forEach(e => {
      this.physics.moveToObject(e, p, 55);
      if (time > this.hitCd && Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) < 26) {
        p.hp -= 8; this.hitCd = time + 600;
        p.setTint(0xff6666); this.time.delayedCall(150, () => p.clearTint());
        if (p.hp <= 0) { p.hp = p.maxHp; p.setPosition(800, 450); }
      }
    });

    // HUD
    this.hud.clear();
    this.hud.fillStyle(0x000000, 0.5).fillRect(10, 8, 152, 14);
    this.hud.fillStyle(0xe03c3c).fillRect(12, 10, 148 * (p.hp / p.maxHp), 10);
    this.hudText.setText('ฆ่าแล้ว: ' + this.kills);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: W, height: H,
  backgroundColor: '#1b241b',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade' },
  scene: Main,
});
