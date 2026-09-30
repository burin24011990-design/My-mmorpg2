// ===== มอนสเตอร์: เกิด, AI, รับดาเมจ, เลือกเป้าหมาย, ดรอป =====
Object.assign(Main.prototype, {
  // โหลดด่าน: ล้างของเก่า วาดพื้นใหม่ เสกมอนของด่านนี้เท่านั้น
  loadStage(idx) {
    const z = ZONES[idx];
    this.stageIdx = idx;
    this.stageToken = (this.stageToken || 0) + 1;

    this.enemies.getChildren().slice().forEach(e => { if (e.levelText) e.levelText.destroy(); e.destroy(); });
    this.loot.getChildren().slice().forEach(it => { this.tweens.killTweensOf(it); it.destroy(); });
    this.projectiles.getChildren().slice().forEach(pr => pr.destroy());
    this.target = null; this.manualTarget = null;

    if (this.stageObjs) this.stageObjs.forEach(o => o.destroy());
    const bg = this.add.grid(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 64, 64, z.bg, 1, z.line, 1).setDepth(-10);
    const gfx = this.add.graphics().setDepth(-9);
    gfx.lineStyle(4, 0x000000, 0.5).strokeRect(0, 0, WORLD_W, WORLD_H);
    this.stageObjs = [bg, gfx];

    this.player.setPosition(z.x, z.y);
    this.player.setVelocity(0, 0);
    this.cameras.main.centerOn(z.x, z.y);

    for (let i = 0; i < z.count; i++) this.spawnEnemyInZone(idx);
    this.drawMinimapFrame();
  },

  // สุ่มจุดเกิดทั่วแผนที่ (เว้นระยะจากผู้เล่น ไม่ให้เกิดทับหน้า)
  randomSpawnPoint() {
    const M = 100, p = this.player;
    let x, y, tries = 0;
    do {
      x = Phaser.Math.Between(M, WORLD_W - M);
      y = Phaser.Math.Between(M, WORLD_H - M);
      tries++;
    } while (p && Phaser.Math.Distance.Between(x, y, p.x, p.y) < 250 && tries < 20);
    return { x, y };
  },

  spawnEnemyInZone(zi) {
    const z = ZONES[zi];
    const pt = this.randomSpawnPoint();
    const lv = Phaser.Math.Between(z.minLv, z.maxLv);
    const e = this.enemies.create(pt.x, pt.y, 'slime');
    e.level = lv;
    e.hp = 30 + lv * 8; e.maxHp = e.hp; e.dmg = 5 + Math.floor(lv * 1.5);
    e.setCollideWorldBounds(true);
    e.zoneIdx = zi; e.state = 'idle';
    e.homeX = pt.x; e.homeY = pt.y; // จุดประจำของมอน เดินเล่นรอบ ๆ จุดนี้
    e.wanderX = pt.x; e.wanderY = pt.y; e.nextWander = 0;
    e.levelText = this.add.text(pt.x, pt.y - 22, 'Lv.' + lv, { fontSize: '10px', color: '#ffe066' }).setOrigin(0.5).setDepth(40);
    e.setInteractive(); e.on('pointerdown', () => { this.manualTarget = e; });
    return e;
  },

  // มอนที่ใกล้ผู้เล่นที่สุด (จำกัดระยะได้)
  nearestEnemy(maxDist) {
    let best = null, bestD = maxDist === undefined ? Infinity : maxDist;
    this.enemies.getChildren().forEach(e => {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    });
    return best;
  },

  updateEnemies(time) {
    const p = this.player;
    this.enemies.getChildren().forEach(e => {
      const distPlayer = Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y);
      // มอนที่ไกลผู้เล่นมากและไม่ได้ไล่ตาม ไม่ต้องคำนวณ (ช่วยให้เกมลื่นเมื่อมอนเยอะ)
      if (e.state === 'idle' && distPlayer > 900) { e.setVelocity(0, 0); return; }
      const distHome = Phaser.Math.Distance.Between(e.x, e.y, e.homeX, e.homeY);
      if (e.state !== 'return' && distPlayer < 130) e.state = 'chase';
      if (e.state === 'chase' && distHome > 450) e.state = 'return';
      if (e.state === 'chase' && distPlayer > 320) e.state = 'idle';
      if (e.state === 'return' && distHome < 60) e.state = 'idle';

      if (e.state === 'idle') {
        if (time > e.nextWander) {
          const ang = Math.random() * Math.PI * 2, rad = Math.random() * 100;
          e.wanderX = e.homeX + Math.cos(ang) * rad; e.wanderY = e.homeY + Math.sin(ang) * rad;
          e.nextWander = time + Phaser.Math.Between(2000, 4000);
        }
        this.physics.moveTo(e, e.wanderX, e.wanderY, 28);
        if (Phaser.Math.Distance.Between(e.x, e.y, e.wanderX, e.wanderY) < 6) e.setVelocity(0, 0);
      } else if (e.state === 'chase') {
        this.physics.moveToObject(e, p, 70);
      } else {
        this.physics.moveTo(e, e.homeX, e.homeY, 60);
      }

      if (time > this.hitCd && distPlayer < 26) {
        const dmg = Math.max(1, (e.dmg || 8) - this.equipDefBonus);
        this.stats.hp -= dmg; this.hitCd = time + 600;
        p.setTint(0xff6666); this.time.delayedCall(150, () => p.clearTint());
        if (this.stats.hp <= 0) { this.stats.hp = this.maxHp(); const cz = ZONES[this.stageIdx]; p.setPosition(cz.x, cz.y); this.toastMsg('คุณสลบ! ฟื้นกลางด่าน'); }
      }
      if (e.levelText) e.levelText.setPosition(e.x, e.y - 22);
    });
  },

  damage(e, dmg) {
    if (!e.active) return;
    e.hp -= dmg;
    const t = this.add.text(e.x, e.y - 20, String(dmg), { fontSize: '16px', color: '#ffe066' }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 600, onComplete: () => t.destroy() });
    if (e.hp <= 0) {
      const x = e.x, y = e.y, zi = e.zoneIdx, z = ZONES[zi], lv = e.level;
      if (this.target === e) this.target = null;
      if (this.manualTarget === e) this.manualTarget = null;
      if (e.levelText) e.levelText.destroy();
      e.destroy(); this.kills++;
      this.gainExp(5 + lv * 3);
      this.dropLoot(x, y, lv, z.boxLevel);
      const token = this.stageToken; // ถ้าย้ายด่านไปแล้ว ไม่ต้องเกิดใหม่ในด่านเก่า
      this.time.delayedCall(RESPAWN_DELAY, () => { if (this.enemies && this.stageToken === token) this.spawnEnemyInZone(zi); });
    }
  },

  dropLoot(x, y, monsterLv, boxLevel) {
    const gold = this.loot.create(x, y, 'gold');
    gold.setData('kind', 'gold'); gold.setData('amount', Phaser.Math.Between(2 + monsterLv, 5 + monsterLv * 2));
    this.tweens.add({ targets: gold, y: y - 6, yoyo: true, repeat: -1, duration: 500 });
    if (Phaser.Math.Between(1, 100) <= 28) {
      if (Phaser.Math.Between(1, 100) <= 55) {
        const it = this.loot.create(x + 14, y, 'box');
        it.setData('kind', 'box'); it.setData('level', boxLevel);
      } else {
        const sid = Phaser.Utils.Array.GetRandom(Object.keys(SKILL_DEFS));
        const it = this.loot.create(x + 14, y, 'scroll');
        it.setData('kind', 'skill'); it.setData('sid', sid);
      }
    }
  },

  updateTargeting() {
    if (this.manualTarget && this.manualTarget.active) {
      this.target = this.manualTarget;
    } else {
      this.manualTarget = null;
      this.target = this.nearestEnemy(TARGET_RANGE);
    }
    if (this.target) {
      this.targetRing.setVisible(true).setPosition(this.target.x, this.target.y);
      this.targetNameText.setText('เป้าหมาย: สไลม์ Lv.' + this.target.level + '  HP ' + Math.max(0, this.target.hp) + '/' + this.target.maxHp);
      const dir = new Phaser.Math.Vector2(this.target.x - this.player.x, this.target.y - this.player.y);
      if (dir.length() > 1) this.facing.copy(dir).normalize();
    } else {
      this.targetRing.setVisible(false);
      this.targetNameText.setText('');
    }
  },
});
