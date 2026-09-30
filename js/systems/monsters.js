// ===== มอนสเตอร์: ธรรมดา / ยิงไกล / มินิบอส, AI, รับดาเมจ, เลือกเป้าหมาย, ดรอป =====
Object.assign(Main.prototype, {
  // โหลดด่าน: ล้างของเก่า วาดพื้นใหม่ เสกมอนของด่านนี้เท่านั้น
  loadStage(idx) {
    const z = ZONES[idx];
    this.stageIdx = idx;
    this.stageToken = (this.stageToken || 0) + 1;

    // สถานะมินิบอส (เก็บเวลาเกิดใหม่ของแต่ละตัวในแต่ละด่าน)
    if (!this.bossState) this.bossState = ZONES.map(() => Array.from({ length: BOSS_COUNT }, () => ({ alive: false, at: 0 })));
    this.bossState.forEach(st => st.forEach(s => { s.alive = false; }));

    // กระสุนของมอน (สร้างครั้งแรกครั้งเดียว)
    if (!this.enemyShots) {
      this.enemyShots = this.physics.add.group();
      this.physics.add.overlap(this.player, this.enemyShots, (pl, sh) => { const d = sh.getData('dmg') || 5; sh.destroy(); this.hurtPlayer(d); });
    }
    this.enemyShots.getChildren().slice().forEach(sh => sh.destroy());

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

    for (let i = 0; i < z.count; i++) this.spawnEnemyInZone(idx, 'normal');
    for (let i = 0; i < z.rangedCount; i++) this.spawnEnemyInZone(idx, 'ranged');
    this.spawnDueBosses();
    this.drawMinimapFrame();
  },

  // สุ่มจุดเกิดทั่วแผนที่ (เว้นระยะจากผู้เล่น ไม่ให้เกิดทับหน้า)
  randomSpawnPoint(minDist) {
    const M = 100, p = this.player, md = minDist || 250;
    let x, y, tries = 0;
    do {
      x = Phaser.Math.Between(M, WORLD_W - M);
      y = Phaser.Math.Between(M, WORLD_H - M);
      tries++;
    } while (p && Phaser.Math.Distance.Between(x, y, p.x, p.y) < md && tries < 20);
    return { x, y };
  },

  // kind: 'normal' = สไลม์ธรรมดา, 'ranged' = สไลม์ยิงไกล
  spawnEnemyInZone(zi, kind) {
    kind = kind || 'normal';
    const z = ZONES[zi];
    const pt = this.randomSpawnPoint();
    const lv = Phaser.Math.Between(z.minLv, z.maxLv);
    const ranged = kind === 'ranged';
    const e = this.enemies.create(pt.x, pt.y, ranged ? 'shooter' : 'slime');
    e.kind = kind; e.ranged = ranged; e.isBoss = false;
    e.level = lv;
    e.hp = 30 + lv * 8; e.maxHp = e.hp; e.dmg = 5 + Math.floor(lv * 1.5);
    e.aggro = ranged ? 350 : 130; e.lose = ranged ? 480 : 320; e.leash = 450;
    e.speed = 70; e.hitRange = 26; e.nextShot = 0;
    this.initEnemyCommon(e, zi, pt, ranged ? '#ffb070' : '#ffe066', 'Lv.' + lv, '10px');
    return e;
  },

  // มินิบอส: HP/ดาเมจ x BOSS_MULT
  spawnBoss(zi, slot) {
    const z = ZONES[zi];
    const pt = this.randomSpawnPoint(400);
    const lv = z.maxLv;
    const e = this.enemies.create(pt.x, pt.y, 'boss');
    e.kind = 'boss'; e.ranged = false; e.isBoss = true; e.bossSlot = slot;
    e.level = lv;
    e.hp = (30 + lv * 8) * BOSS_MULT; e.maxHp = e.hp; e.dmg = (5 + Math.floor(lv * 1.5)) * BOSS_MULT;
    e.aggro = 220; e.lose = 520; e.leash = 700;
    e.speed = 85; e.hitRange = 40; e.nextShot = 0;
    this.initEnemyCommon(e, zi, pt, '#ff8888', '👑 มินิบอส Lv.' + lv, '12px');
    return e;
  },

  initEnemyCommon(e, zi, pt, color, label, fontSize) {
    e.setCollideWorldBounds(true);
    e.zoneIdx = zi; e.state = 'idle';
    e.homeX = pt.x; e.homeY = pt.y; // จุดประจำของมอน เดินเล่นรอบ ๆ จุดนี้
    e.wanderX = pt.x; e.wanderY = pt.y; e.nextWander = 0;
    e.levelText = this.add.text(pt.x, pt.y - 22, label, { fontSize, color, fontStyle: e.isBoss ? 'bold' : 'normal' }).setOrigin(0.5).setDepth(40);
    e.setInteractive(); e.on('pointerdown', () => { this.manualTarget = e; });
  },

  // เสกมินิบอสที่ครบเวลาเกิดใหม่แล้ว (เรียกตอนโหลดด่าน และเช็กทุกวินาที)
  spawnDueBosses() {
    const st = this.bossState[this.stageIdx], now = Date.now();
    st.forEach((s, i) => { if (!s.alive && now >= s.at) { s.alive = true; this.spawnBoss(this.stageIdx, i); } });
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

  enemyShoot(e) {
    const p = this.player;
    const v = new Phaser.Math.Vector2(p.x - e.x, p.y - e.y);
    if (v.length() < 1) return;
    v.normalize();
    const sh = this.enemyShots.create(e.x, e.y, 'eshot');
    sh.setData('dmg', e.dmg);
    sh.setVelocity(v.x * 240, v.y * 240);
    this.time.delayedCall(1800, () => sh.active && sh.destroy());
  },

  hurtPlayer(raw) {
    const p = this.player;
    const dmg = Math.max(1, raw - this.equipDefBonus);
    this.stats.hp -= dmg;
    p.setTint(0xff6666); this.time.delayedCall(150, () => p.clearTint());
    if (this.stats.hp <= 0) {
      this.stats.hp = this.maxHp();
      const cz = ZONES[this.stageIdx];
      p.setPosition(cz.x, cz.y);
      this.toastMsg('คุณสลบ! ฟื้นกลางด่าน');
    }
  },

  updateEnemies(time) {
    const p = this.player;
    if (time > (this.nextBossCheck || 0)) { this.nextBossCheck = time + 1000; this.spawnDueBosses(); }

    this.enemies.getChildren().forEach(e => {
      const distPlayer = Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y);
      // มอนที่ไกลผู้เล่นมากและไม่ได้ไล่ตาม ไม่ต้องคำนวณ (ช่วยให้เกมลื่นเมื่อมอนเยอะ)
      if (e.state === 'idle' && distPlayer > 900) { e.setVelocity(0, 0); return; }
      const distHome = Phaser.Math.Distance.Between(e.x, e.y, e.homeX, e.homeY);
      if (e.state !== 'return' && distPlayer < e.aggro) e.state = 'chase';
      if (e.state === 'chase' && distHome > e.leash) e.state = 'return';
      if (e.state === 'chase' && distPlayer > e.lose) e.state = 'idle';
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
        if (e.ranged) {
          // มอนยิงไกล: รักษาระยะ 160-260 แล้วยิงใส่ผู้เล่น
          if (distPlayer > 260) this.physics.moveToObject(e, p, e.speed);
          else if (distPlayer < 160) {
            const away = new Phaser.Math.Vector2(e.x - p.x, e.y - p.y).normalize();
            e.setVelocity(away.x * 60, away.y * 60);
          } else e.setVelocity(0, 0);
          if (distPlayer < 340 && time > e.nextShot) { this.enemyShoot(e); e.nextShot = time + Phaser.Math.Between(1600, 2200); }
        } else {
          this.physics.moveToObject(e, p, e.speed);
        }
      } else {
        this.physics.moveTo(e, e.homeX, e.homeY, 60);
      }

      if (time > this.hitCd && distPlayer < e.hitRange) {
        this.hitCd = time + 600;
        this.hurtPlayer(e.dmg || 8);
      }
      if (e.levelText) e.levelText.setPosition(e.x, e.y - (e.isBoss ? 40 : 22));
    });
  },

  damage(e, dmg) {
    if (!e.active) return;
    e.hp -= dmg;
    const t = this.add.text(e.x, e.y - 20, String(dmg), { fontSize: '16px', color: '#ffe066' }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 600, onComplete: () => t.destroy() });
    if (e.hp <= 0) {
      const x = e.x, y = e.y, zi = e.zoneIdx, z = ZONES[zi], lv = e.level;
      const kind = e.kind, isBoss = !!e.isBoss, slot = e.bossSlot;
      if (this.target === e) this.target = null;
      if (this.manualTarget === e) this.manualTarget = null;
      if (e.levelText) e.levelText.destroy();
      e.destroy(); this.kills++;
      this.gainExp((5 + lv * 3) * (isBoss ? BOSS_MULT : 1));
      this.dropLoot(x, y, lv, z.boxLevel, isBoss);
      if (isBoss) {
        // มินิบอสเกิดใหม่หลัง 30-50 นาที (สุ่ม) เก็บเวลาไว้ แม้ย้ายด่านก็ยังนับต่อ
        const ms = Phaser.Math.Between(BOSS_RESPAWN_MIN_MINUTES * 60000, BOSS_RESPAWN_MAX_MINUTES * 60000);
        const st = this.bossState[zi][slot];
        st.alive = false; st.at = Date.now() + ms;
        this.toastMsg('สังหารมินิบอส! เกิดใหม่ในอีก ' + Math.round(ms / 60000) + ' นาที');
      } else {
        const token = this.stageToken; // ถ้าย้ายด่านไปแล้ว ไม่ต้องเกิดใหม่ในด่านเก่า
        this.time.delayedCall(RESPAWN_DELAY, () => { if (this.enemies && this.stageToken === token) this.spawnEnemyInZone(zi, kind); });
      }
    }
  },

  dropLoot(x, y, monsterLv, boxLevel, isBoss) {
    const gold = this.loot.create(x, y, 'gold');
    const mult = isBoss ? BOSS_MULT : 1;
    gold.setData('kind', 'gold'); gold.setData('amount', Phaser.Math.Between(2 + monsterLv, 5 + monsterLv * 2) * mult);
    this.tweens.add({ targets: gold, y: y - 6, yoyo: true, repeat: -1, duration: 500 });
    if (isBoss) {
      // มินิบอส: กล่องอุปกรณ์ 3 กล่อง + ม้วนสกิล 1 ม้วนแน่นอน
      for (let i = 0; i < 3; i++) {
        const it = this.loot.create(x + 20 + i * 18, y + 14, 'box');
        it.setData('kind', 'box'); it.setData('level', boxLevel);
      }
      const sid = Phaser.Utils.Array.GetRandom(Object.keys(SKILL_DEFS));
      const sc = this.loot.create(x - 22, y + 14, 'scroll');
      sc.setData('kind', 'skill'); sc.setData('sid', sid);
      return;
    }
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
      const t = this.target;
      const name = t.isBoss ? 'มินิบอส' : (t.ranged ? 'สไลม์ยิงไกล' : 'สไลม์');
      this.targetRing.setVisible(true).setPosition(t.x, t.y);
      this.targetNameText.setText('เป้าหมาย: ' + name + ' Lv.' + t.level + '  HP ' + Math.max(0, t.hp) + '/' + t.maxHp);
      const dir = new Phaser.Math.Vector2(t.x - this.player.x, t.y - this.player.y);
      if (dir.length() > 1) this.facing.copy(dir).normalize();
    } else {
      this.targetRing.setVisible(false);
      this.targetNameText.setText('');
    }
  },
});
