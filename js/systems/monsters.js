// ===== มอนสเตอร์: ธรรมดา / ยิงไกล / Epic / มินิบอส, AI, สกิล, รับดาเมจ, เลือกเป้าหมาย, ดรอป =====
// (เวอร์ชันลดแลค) แก้จากเดิม:
//   1) พื้นหลังเปลี่ยนจาก grid (วาดนับพันช่องทุกเฟรม) เป็น tileSprite ภาพเดียว
//   2) ชื่อมอนซ่อนเมื่ออยู่นอกจอ + ลด resolution + ตัดเงา blur
//   3) มอนที่อยู่ไกลเกิน 900px ข้าม AI ทุกสถานะ (ยกเว้นตอนกำลังไล่ตี)
//   4) หาเป้าหมายใกล้สุดทุก 120ms แทนทุกเฟรม
//   5) หลอดเลือดของมอนที่ซ่อนในพุ่มไม่โชว์ (drawEnemyBar เช็ก hiddenInBush)
// ด่าน 1-4: มอนไม่โจมตีก่อน (สู้กลับเมื่อโดนตี) | ด่าน 5 ขึ้นไป: โจมตีก่อนทั้งหมด
// ผู้เล่นอยู่ในพุ่มหญ้า: มอนที่ห่างเกิน BUSH_REVEAL_DIST มองไม่เห็น (ดู obstacles.js)
// หมายเหตุ: hurtPlayer อยู่ใน fixes.js แล้ว
// หมายเหตุ: หนังสือสกิลดรอปจากมินิบอส/มอนธรรมดา เป็นไอเทมบนพื้น -> เก็บเข้ากระเป๋า (ดู pickup ใน inventory.js)
// หมายเหตุ: ชื่อ/สี/แอนิเมชันของมอนอยู่ใน js/data/monsterDefs.js
// หมายเหตุ: ตัวเลขดาเมจอยู่ใน js/systems/damageFx.js (showDamage)
// หมายเหตุ: ความโหดเพิ่มตามด่าน (stageHpMul / stageDmgMul) อยู่ท้ายไฟล์ js/data/zones.js
const AGGRESSIVE_FROM_ZONE = 5;
const BUSH_REVEAL_DIST = 110;
const BUSH_REVEAL_AFTER_ATTACK = 1500;
// ===== ปรับความแรงมอนสเตอร์ทั้งหมด (ปรับตรงนี้) =====
const MONSTER_DMG_SCALE = 0.1;         // ตัวคูณพลังโจมตีมอนทุกชนิด (1 = เดิม, 0.6 = เหลือ 60%)
const MONSTER_ATK_INTERVAL_MUL = 2.7;  // ตัวคูณช่วงเวลาระหว่างโจมตี (1 = เดิม, 1.6 = ช้าลง 1.6 เท่า)
// โอกาสดรอปหนังสือสกิล (ปรับตรงนี้)
const NORMAL_SKILL_DROP_CHANCE = 0.05; // มอนธรรมดา 5%
const BOSS_SKILL_DROP_CHANCE = 0.60;   // มินิบอส 60%
// มอนสเตอร์ Epic
const EPIC_COUNT = 15;             // จำนวนต่อแผนที่ (ยังแลคอยู่ -> ลดเหลือ 15-20)
const EPIC_MULT = 2;               // Epic แรงกว่ามอนฐาน (HP / ดาเมจ / EXP / ทอง)
const EPIC_RED_BOX_CHANCE = 0.02;  // โอกาสดรอปกล่องแดง (2%)
// มอนธรรมดา + ยิงไกล
const NORMAL_HP_MULT = 1;          // เลือดเพิ่ม 1 เท่า (x2)
const NORMAL_DMG_MULT = 0.5;       // พลังโจมตีเพิ่ม 50%
// มินิบอส
const BOSS_SPEED = 130;            // ความเร็วบอส (มอนธรรมดา 70)
const BOSS_TELEPORT_MIN_MINUTES = 5;   // บอสวาปย้ายที่ทุก 5-10 นาที (สุ่ม)
const BOSS_TELEPORT_MAX_MINUTES = 10;
const RANGED_SHOT_SCALE = 2.2;     // ขนาดลูกกระสุนมอนยิงไกล (ใหญ่ขึ้น = โดนง่ายขึ้น)
// ชื่อมอน + หลอดเลือด (ปรับตรงนี้)
const NAME_SIZE_NORMAL = '15px';   // ขนาดชื่อมอนธรรมดา/ยิงไกล
const NAME_SIZE_EPIC = '17px';     // ขนาดชื่อ Epic
const NAME_SIZE_BOSS = '19px';     // ขนาดชื่อมินิบอส
const NAME_TEXT_RES = 1;           // ความคมของชื่อ (1 = เร็วสุด, 1.5 = คมขึ้นแต่หนักขึ้น)
const HPBAR_ONLY_WHEN_HURT = true; // true = โชว์หลอดเลือดเฉพาะตอนมอนเสียเลือดแล้ว
const HPBAR_W_NORMAL = 50, HPBAR_W_EPIC = 66, HPBAR_W_BOSS = 90;   // ความกว้างหลอด (px)
// ขนาดของที่ดรอปบนพื้น (px) เมื่อใช้รูปใหม่จาก assets/items/
const LOOT_DISPLAY_SIZE = 30;
// ระยะที่มอนไกลจากผู้เล่นแล้วข้าม AI (px)
const AI_SLEEP_DIST = 900;
// ความถี่การหาเป้าหมายใกล้สุด (ms)
const TARGET_SCAN_MS = 120;

Object.assign(Main.prototype, {
  // โหลดด่าน: ล้างของเก่า วาดพื้นใหม่ สร้างพุ่ม/หิน เสกมอนของด่านนี้เท่านั้น
  loadStage(idx) {
    const z = ZONES[idx];
    this.stageIdx = idx;
    this.stageToken = (this.stageToken || 0) + 1;
    ensureMonsterTextures(this);   // texture สำรอง + anim ของมอนทุกตัว (ทำครั้งเดียว)

    if (!this.bossState) this.bossState = ZONES.map(() => Array.from({ length: BOSS_COUNT }, () => ({ alive: false, at: 0 })));
    this.bossState.forEach(st => st.forEach(s => { s.alive = false; }));

    if (!this.enemyShots) {
      this.enemyShots = this.physics.add.group();
      this.physics.add.overlap(this.player, this.enemyShots, (pl, sh) => {
        // ผู้เล่นอยู่ในพุ่ม: กระสุนที่ยิงมาจากไกลถูกบัง ไม่โดนดาเมจ
        const ox = sh.getData('ox'), oy = sh.getData('oy');
        if (this.playerHidden && Phaser.Math.Distance.Between(ox, oy, pl.x, pl.y) > BUSH_REVEAL_DIST) { sh.destroy(); return; }
        const d = sh.getData('dmg') || 5; sh.destroy(); this.hurtPlayer(d);
      });
    }
    this.enemyShots.getChildren().slice().forEach(sh => sh.destroy());

    this.enemies.getChildren().slice().forEach(e => { if (e.levelText) e.levelText.destroy(); e.destroy(); });
    this.loot.getChildren().slice().forEach(it => { this.tweens.killTweensOf(it); it.destroy(); });
    this.projectiles.getChildren().slice().forEach(pr => pr.destroy());
    this.target = null; this.manualTarget = null; this._tgtNext = 0;

    if (this.stageObjs) this.stageObjs.forEach(o => o.destroy());

    // พื้นหลัง: สร้างลายช่อง 64x64 เป็น texture ครั้งเดียว แล้วใช้ tileSprite (วาดภาพเดียว เบากว่า grid มาก)
    const bgKey = 'bgtile_' + idx;
    if (!this.textures.exists(bgKey)) {
      const tg = this.make.graphics({ x: 0, y: 0, add: false });
      tg.fillStyle(z.bg, 1).fillRect(0, 0, 64, 64);
      tg.lineStyle(1, z.line, 1).strokeRect(0, 0, 64, 64);
      tg.generateTexture(bgKey, 64, 64);
      tg.destroy();
    }
    const bg = this.add.tileSprite(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, bgKey).setDepth(-10);
    const gfx = this.add.graphics().setDepth(-9);
    gfx.lineStyle(4, 0x000000, 0.5).strokeRect(0, 0, WORLD_W, WORLD_H);
    this.stageObjs = [bg, gfx];

    this.player.setPosition(z.x, z.y);
    this.player.setVelocity(0, 0);
    this.player.setAlpha(1);
    this.playerHidden = false; this.revealUntil = 0;
    this.cameras.main.centerOn(z.x, z.y);

    if (this.buildObstacles) this.buildObstacles(idx);

    for (let i = 0; i < z.count; i++) this.spawnEnemyInZone(idx, 'normal');
    for (let i = 0; i < z.rangedCount; i++) this.spawnEnemyInZone(idx, 'ranged');
    for (let i = 0; i < EPIC_COUNT; i++) this.spawnEpic(idx);
    this.spawnDueBosses();
    this.drawMinimapFrame();
  },

  // สุ่มจุดเกิดทั่วแผนที่ (เว้นระยะจากผู้เล่น และไม่เกิดในก้อนหิน)
  randomSpawnPoint(minDist) {
    const M = 100, p = this.player, md = minDist || 250;
    let x, y, tries = 0;
    do {
      x = Phaser.Math.Between(M, WORLD_W - M);
      y = Phaser.Math.Between(M, WORLD_H - M);
      tries++;
    } while (((p && Phaser.Math.Distance.Between(x, y, p.x, p.y) < md) || (this.pointInRock && this.pointInRock(x, y, 40))) && tries < 30);
    return { x, y };
  },

  spawnEnemyInZone(zi, kind) {
    kind = kind || 'normal';
    const z = ZONES[zi];
    const def = getMonsterDef(zi, kind);
    const pt = this.randomSpawnPoint();
    const lv = Phaser.Math.Between(z.minLv, z.maxLv);
    const ranged = kind === 'ranged';
    const e = this.enemies.create(pt.x, pt.y, def.key);
    e.def = def;
    e.kind = kind; e.ranged = ranged; e.isBoss = false;
    e.level = lv;
    e.hp = (30 + lv * 8) * NORMAL_HP_MULT * stageHpMul(zi); e.maxHp = e.hp;
    e.dmg = Math.max(1, Math.round((5 + Math.floor(lv * 1.5)) * NORMAL_DMG_MULT * MONSTER_DMG_SCALE * stageDmgMul(zi)));
    e.aggro = ranged ? 350 : 130; e.lose = ranged ? 480 : 320; e.leash = 450;
    e.speed = 70; e.hitRange = 26 * def.scale; e.nextShot = 0;
    e.setScale(def.scale);
    this.initEnemyCommon(e, zi, pt, ranged ? '#ffb070' : '#ffe066', def.name + ' Lv.' + lv, NAME_SIZE_NORMAL);
    return e;
  },

  spawnBoss(zi, slot) {
    const z = ZONES[zi];
    const def = getMonsterDef(zi, 'boss');
    const pt = this.randomSpawnPoint(400);
    const lv = z.maxLv;
    const e = this.enemies.create(pt.x, pt.y, def.key);
    e.def = def;
    e.kind = 'boss'; e.ranged = false; e.isBoss = true; e.bossSlot = slot;
    e.level = lv;
    e.hp = (30 + lv * 8) * BOSS_MULT * stageHpMul(zi); e.maxHp = e.hp;
    e.dmg = Math.max(1, Math.round((5 + Math.floor(lv * 1.5)) * BOSS_MULT * MONSTER_DMG_SCALE * stageDmgMul(zi)));
    e.aggro = 220; e.lose = 520; e.leash = 700;
    e.speed = BOSS_SPEED; e.hitRange = 40 * def.scale; e.nextShot = 0;
    e.nextTeleport = this.time.now + Phaser.Math.Between(BOSS_TELEPORT_MIN_MINUTES * 60000, BOSS_TELEPORT_MAX_MINUTES * 60000);
    e.setScale(def.scale);
    this.initEnemyCommon(e, zi, pt, '#ff8888', '👑 ' + def.name + ' Lv.' + lv, NAME_SIZE_BOSS);
    return e;
  },

  // มอนสเตอร์ Epic: ใช้ร่างของมอนธรรมดาด่านนั้น ย้อมสีม่วง ตัวใหญ่ขึ้น 30% แรงกว่า 5 เท่า มีสกิลยิง 3 ทิศ
  spawnEpic(zi) {
    const z = ZONES[zi];
    const base = getMonsterDef(zi, 'normal');
    const def = Object.assign({}, base, { scale: base.scale * 1.3 });
    const pt = this.randomSpawnPoint();
    const lv = Phaser.Math.Between(z.minLv, z.maxLv);
    const e = this.enemies.create(pt.x, pt.y, def.key);
    e.def = def;
    e.kind = 'epic'; e.ranged = false; e.isBoss = false; e.isEpic = true;
    e.level = lv;
    e.hp = (30 + lv * 8) * EPIC_MULT * stageHpMul(zi); e.maxHp = e.hp;
    e.dmg = Math.max(1, Math.round((5 + Math.floor(lv * 1.5)) * EPIC_MULT * MONSTER_DMG_SCALE * stageDmgMul(zi)));
    e.aggro = 200; e.lose = 420; e.leash = 500;
    e.speed = 75; e.hitRange = 26 * def.scale; e.nextShot = 0;
    e.setScale(def.scale);
    e._tint = 0xff66ff; e.setTint(0xff66ff);
    this.initEnemyCommon(e, zi, pt, '#d98cff', '💎 ' + def.name + ' Lv.' + lv, NAME_SIZE_EPIC);
    return e;
  },

  // บอสวาปไปจุดใหม่ (กระจายมอนไม่ให้มากระจุกที่บอส) ถ้ากำลังสู้อยู่จะเลื่อนไป 15 วิ
  bossTeleport(e, time) {
    if (e.state === 'chase') { e.nextTeleport = time + 15000; return; }
    const flash = (x, y) => {
      const c = this.add.circle(x, y, 30, 0xaa66ff, 0.6).setDepth(44);
      this.tweens.add({ targets: c, scale: 3, alpha: 0, duration: 500, onComplete: () => c.destroy() });
    };
    flash(e.x, e.y);
    const pt = this.randomSpawnPoint(400);
    e.setPosition(pt.x, pt.y); e.setVelocity(0, 0);
    e.homeX = pt.x; e.homeY = pt.y; e.wanderX = pt.x; e.wanderY = pt.y;
    e.state = 'idle';
    e.nextTeleport = time + Phaser.Math.Between(BOSS_TELEPORT_MIN_MINUTES * 60000, BOSS_TELEPORT_MAX_MINUTES * 60000);
    flash(pt.x, pt.y);
  },

  initEnemyCommon(e, zi, pt, color, label, fontSize) {
    e.setCollideWorldBounds(true);
    e.zoneIdx = zi; e.state = 'idle';
    e.aggressive = ZONES[zi].id >= AGGRESSIVE_FROM_ZONE; // ด่าน 5+ โจมตีก่อน
    e.provoked = false;                                  // ด่าน 1-4 จะสู้กลับเมื่อโดนตี
    e.homeX = pt.x; e.homeY = pt.y;
    e.wanderX = pt.x; e.wanderY = pt.y; e.nextWander = 0;
    e.atkUntil = 0; e.animState = '';
    if (e.def && e.def.hasSheet) e.play(e.def.key + '_idle');
    const sc = (e.def && e.def.scale) || 1;
    e.labelOff = (e.isBoss ? 46 : 30) * sc;              // ระยะชื่อเหนือตัวมอน (หลอดเลือดอยู่ใต้ชื่อ)
    e.levelText = this.add.text(pt.x, pt.y - e.labelOff, label, {
      fontFamily: 'Mitr, sans-serif', fontSize, color, fontStyle: e.isBoss ? 'bold' : 'normal',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(40);
    e.levelText.setResolution(NAME_TEXT_RES);            // ลดจาก 2 -> เบากว่า (ไม่ใช้เงา blur แล้ว)
    e.setInteractive(); e.on('pointerdown', () => { this.manualTarget = e; });
  },

  spawnDueBosses() {
    const st = this.bossState[this.stageIdx], now = Date.now();
    st.forEach((s, i) => { if (!s.alive && now >= s.at) { s.alive = true; this.spawnBoss(this.stageIdx, i); } });
  },

  nearestEnemy(maxDist) {
    let best = null, bestD = maxDist === undefined ? Infinity : maxDist;
    this.enemies.getChildren().forEach(e => {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    });
    return best;
  },

  // ยิงกระสุนศัตรู 1 ลูก (ang = ทิศเป็นเรเดียน, scale = ขนาดลูก, dmgMul = ตัวคูณดาเมจของมอน)
  fireShot(e, ang, speed, scale, dmgMul) {
    const sh = this.enemyShots.create(e.x, e.y, 'eshot');
    sh.setScale(scale);
    sh.setData('dmg', Math.max(1, Math.round(e.dmg * dmgMul))); sh.setData('ox', e.x); sh.setData('oy', e.y);
    sh.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
    this.time.delayedCall(2000, () => sh.active && sh.destroy());
  },

  // สกิลของ epic (ยิง 3 ทิศ) และบอส (วงแหวน 12 ทิศ / พัด 5 ทิศ / ทุบพื้นวงแดง)
  enemySkill(e, time, dist, canSee) {
    if (!(e.isBoss || e.isEpic) || !canSee || dist > 380 || time < (e.nextSkill || 0)) return;
    const p = this.player;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    e.atkUntil = time + 500;
    if (e.isEpic) {
      e.nextSkill = time + Phaser.Math.Between(4000, 6000) * MONSTER_ATK_INTERVAL_MUL;
      [-0.3, 0, 0.3].forEach(o => this.fireShot(e, a + o, 220, RANGED_SHOT_SCALE, 0.5));
      return;
    }
    e.nextSkill = time + Phaser.Math.Between(2500, 4000) * MONSTER_ATK_INTERVAL_MUL;
    const r = Phaser.Math.Between(0, 3);
    if (r === 0) {
      for (let i = 0; i < 12; i++) this.fireShot(e, i * Math.PI / 6, 200, 2.5, 0.4);
    } else if (r === 1) {
      [-0.5, -0.25, 0, 0.25, 0.5].forEach(o => this.fireShot(e, a + o, 260, 2.2, 0.4));
    } else if (r === 2) {
      const R = 140, x = e.x, y = e.y, d = Math.max(1, Math.round(e.dmg * 0.8));
      const ring = this.add.circle(x, y, R, 0xff2222, 0.25).setStrokeStyle(2, 0xff2222).setDepth(6);
      this.time.delayedCall(800, () => {
        ring.destroy();
        if (Phaser.Math.Distance.Between(p.x, p.y, x, y) < R) this.hurtPlayer(d);
      });
    } else {
      // สกิลวงกว้างมาก: เตือนวงแดงใหญ่ 1.3 วิ แล้วระเบิด (ต้องวิ่งออกนอกวง)
      const R = 340, x = e.x, y = e.y, d = Math.max(1, Math.round(e.dmg * 1.0));
      const ring = this.add.circle(x, y, R, 0xff2222, 0.2).setStrokeStyle(3, 0xff2222).setDepth(6);
      this.tweens.add({ targets: ring, alpha: 0.45, duration: 300, yoyo: true, repeat: 2 });
      this.time.delayedCall(1300, () => {
        ring.destroy();
        const boom = this.add.circle(x, y, R, 0xffffff, 0.5).setDepth(44);
        this.tweens.add({ targets: boom, alpha: 0, duration: 300, onComplete: () => boom.destroy() });
        if (Phaser.Math.Distance.Between(p.x, p.y, x, y) < R) this.hurtPlayer(d);
      });
    }
  },

  enemyShoot(e) {
    const p = this.player;
    if (Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) < 1) return;
    e.atkUntil = this.time.now + 400;                    // เล่นท่าโจมตี
    this.fireShot(e, Math.atan2(p.y - e.y, p.x - e.x), 240, RANGED_SHOT_SCALE, 1);
  },

  // เลือกแอนิเมชัน idle / walk / attack ตามการเคลื่อนไหว (ทำงานเฉพาะตัวที่มี sprite sheet)
  updateEnemyAnim(e, time) {
    const d = e.def;
    if (!d || !d.hasSheet || !e.body) return;
    const vx = e.body.velocity.x, vy = e.body.velocity.y;
    const st = time < e.atkUntil ? 'attack' : ((vx * vx + vy * vy) > 100 ? 'walk' : 'idle');
    if (e.animState !== st) { e.animState = st; e.play(d.key + '_' + st, true); }
    if (Math.abs(vx) > 5) e.setFlipX(vx < 0);
  },

  updateEnemies(time) {
    if (this.rmActive) return;   // โหมดห้อง: ให้ roomMonsters.js คุมมอนแทน
    const p = this.player;
    if (time > (this.nextBossCheck || 0)) { this.nextBossCheck = time + 1000; this.spawnDueBosses(); }
    const hidden = this.updatePlayerHidden ? this.updatePlayerHidden(time) : false;

    // หลอดเลือดมอนทั้งหมดวาดบน graphics ตัวเดียว (ล้างแล้ววาดใหม่ทุกเฟรม)
    if (!this.enemyBarGfx) this.enemyBarGfx = this.add.graphics().setDepth(41);
    const barG = this.enemyBarGfx;
    barG.clear();

    const view = this.cameras.main.worldView;   // คำนวณครั้งเดียวต่อเฟรม ใช้ซ่อนชื่อมอนนอกจอ

    this.enemies.getChildren().forEach(e => {
      if (e.isBoss && time > (e.nextTeleport || 0)) this.bossTeleport(e, time);
      const distPlayer = Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y);

      // มอนที่อยู่ไกลมาก (และไม่ได้ไล่ตี): ข้าม AI ทั้งหมด + ซ่อนชื่อ
      if (e.state !== 'chase' && distPlayer > AI_SLEEP_DIST) {
        if (e.state === 'return') {                      // กลับบ้านทันที ไม่ต้องเดินให้เปลืองเฟรม
          e.setPosition(e.homeX, e.homeY);
          e.state = 'idle'; e.provoked = false;
          if (e.levelText) e.levelText.setPosition(e.x, e.y - e.labelOff);
        }
        e.setVelocity(0, 0);
        if (e.levelText && e.levelText.visible) e.levelText.setVisible(false);
        return;
      }

      const distHome = Phaser.Math.Distance.Between(e.x, e.y, e.homeX, e.homeY);
      const canSee = !hidden || distPlayer < BUSH_REVEAL_DIST;   // ผู้เล่นซ่อนในพุ่ม = มองไม่เห็นถ้าอยู่ไกล
      const hostile = e.aggressive || e.provoked;                // โดนตีแล้ว หรือเป็นมอนด่าน 5+

      if (e.state !== 'return' && hostile && canSee && distPlayer < e.aggro) e.state = 'chase';
      if (e.state === 'chase' && !canSee) { e.state = 'idle'; e.provoked = false; }
      if (e.state === 'chase' && distHome > e.leash) { e.state = 'return'; e.provoked = false; }
      if (e.state === 'chase' && distPlayer > e.lose) { e.state = 'idle'; e.provoked = false; }
      if (e.state === 'return' && distHome < 60) { e.state = 'idle'; e.provoked = false; }

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
          if (distPlayer > 260) this.physics.moveToObject(e, p, e.speed);
          else if (distPlayer < 160) {
            const away = new Phaser.Math.Vector2(e.x - p.x, e.y - p.y).normalize();
            e.setVelocity(away.x * 60, away.y * 60);
          } else e.setVelocity(0, 0);
          if (canSee && distPlayer < 340 && time > e.nextShot) { this.enemyShoot(e); e.nextShot = time + Phaser.Math.Between(1600, 2200) * MONSTER_ATK_INTERVAL_MUL; }
        } else {
          this.physics.moveToObject(e, p, e.speed);
        }
      } else {
        this.physics.moveTo(e, e.homeX, e.homeY, 60);
      }

      // ชนตัวทำดาเมจเฉพาะตอนไล่ตี (มอนที่ยังไม่โกรธเดินชนไม่เจ็บ)
      if (e.state === 'chase' && time > this.hitCd && distPlayer < e.hitRange) {
        this.hitCd = time + Math.round(600 * MONSTER_ATK_INTERVAL_MUL);
        e.atkUntil = time + 400;                         // เล่นท่าโจมตี
        this.hurtPlayer(e.dmg || 8);
      }
      // สกิลของ epic / บอส (ใช้ตอนไล่ตี)
      if (e.state === 'chase') this.enemySkill(e, time, distPlayer, canSee);
      this.updateEnemyAnim(e, time);

      // ชื่อมอน: แสดงเฉพาะที่อยู่ในจอ (นอกจอซ่อนไว้ ไม่ต้องอัปเดตตำแหน่ง)
      if (e.levelText) {
        const on = !e.hiddenInBush && e.x > view.x - 80 && e.x < view.right + 80 && e.y > view.y - 80 && e.y < view.bottom + 80;   // hiddenInBush = ซ่อนในพุ่ม (obstacles.js) ห้ามโชว์ชื่อ
        if (on) {
          if (!e.levelText.visible) e.levelText.setVisible(true);
          e.levelText.setPosition(e.x, e.y - e.labelOff);
        } else if (e.levelText.visible) {
          e.levelText.setVisible(false);
        }
      }
      this.drawEnemyBar(barG, e);
    });
  },

  // หลอดเลือดมอน: อยู่ใต้ชื่อ เขียว > เหลือง > แดง ตามเลือดที่เหลือ (วาดเฉพาะมอนที่อยู่ในจอ)
  drawEnemyBar(g, e) {
    if (!e.active || !e.maxHp) return;
    if (e.hiddenInBush) return;                          // ซ่อนในพุ่ม = ไม่โชว์หลอดเลือดลอยๆ
    if (HPBAR_ONLY_WHEN_HURT && e.hp >= e.maxHp) return;
    const v = this.cameras.main.worldView;
    if (e.x < v.x - 80 || e.x > v.right + 80 || e.y < v.y - 80 || e.y > v.bottom + 80) return;
    const w = e.isBoss ? HPBAR_W_BOSS : (e.isEpic ? HPBAR_W_EPIC : HPBAR_W_NORMAL);
    const h = e.isBoss ? 9 : 7;
    const x = Math.round(e.x - w / 2);
    const y = Math.round(e.y - e.labelOff + (e.isBoss ? 16 : 13));   // ใต้ชื่อ
    const r = Math.max(0, Math.min(1, e.hp / e.maxHp));
    const col = r > 0.5 ? 0x5be35b : (r > 0.25 ? 0xffd23c : 0xff4a4a);
    g.fillStyle(0x000000, 0.8).fillRect(x - 1, y - 1, w + 2, h + 2);   // ขอบดำ
    g.fillStyle(0x3a0d0d, 1).fillRect(x, y, w, h);                      // พื้นหลอด
    const fw = Math.round(w * r);
    if (fw > 0) {
      g.fillStyle(col, 1).fillRect(x, y, fw, h);
      g.fillStyle(0xffffff, 0.28).fillRect(x, y, fw, 2);                // เงาสะท้อนด้านบน
    }
  },

  // opts (ไม่ใส่ก็ได้): { skill: def ของสกิล, crit: true }
  // ถ้าไม่ส่ง skill มา จะใช้สกิลที่เพิ่งร่าย (this._skillCtx ตั้งใน skillFx.js) เพื่อให้ตัวเลขได้สีของสกิล
  damage(e, dmg, opts) {
    if (!e.active) return;
    e.hp -= dmg;
    e.provoked = true;                                   // โดนตี = โกรธ สู้กลับ
    if (e.state === 'idle') e.state = 'chase';
    this.revealUntil = this.time.now + BUSH_REVEAL_AFTER_ATTACK; // โจมตีแล้วโผล่จากพุ่มชั่วคราว
    opts = opts || {};
    const ctx = (this._skillCtx && this.time.now < this._skillCtx.until) ? this._skillCtx.def : null;
    const skill = opts.skill || ctx;
    const isCrit = !!(opts.crit || this._critHit);       // _critHit ตั้งจาก stats.js ตอนสุ่มได้คริติคอล
    showDamage(this, e.x, e.y - 20, dmg, isCrit ? 'crit' : 'normal', skill ? { skill: skill } : undefined);   // ตัวเลขดาเมจ (ดู damageFx.js)
    if (e.hp > 0) monsterHitFx(this, e);                 // กะพริบขาว + บีบตัว
    if (e.hp <= 0) {
      const x = e.x, y = e.y, zi = e.zoneIdx, z = ZONES[zi], lv = e.level;
      const kind = e.kind, isBoss = !!e.isBoss, isEpic = !!e.isEpic, slot = e.bossSlot;
      if (this.target === e) this.target = null;
      if (this.manualTarget === e) this.manualTarget = null;
      if (e.levelText) e.levelText.destroy();
      playMonsterDeath(this, e);                         // ท่าตาย + อนุภาคตามธีมด่าน (ต้องเรียกก่อน destroy)
      e.destroy(); this.kills++;
      this.gainExp((5 + lv * 3) * (isBoss ? BOSS_MULT : (isEpic ? EPIC_MULT : 1)));
      this.dropLoot(x, y, lv, z.boxLevel, isBoss, isEpic);
      if (isBoss) {
        const ms = Phaser.Math.Between(BOSS_RESPAWN_MIN_MINUTES * 60000, BOSS_RESPAWN_MAX_MINUTES * 60000);
        const st = this.bossState[zi][slot];
        st.alive = false; st.at = Date.now() + ms;
        this.toastMsg('สังหารมินิบอส! เกิดใหม่ในอีก ' + Math.round(ms / 60000) + ' นาที');
      } else {
        const token = this.stageToken;
        this.time.delayedCall(RESPAWN_DELAY, () => {
          if (this.enemies && this.stageToken === token) {
            if (kind === 'epic') this.spawnEpic(zi); else this.spawnEnemyInZone(zi, kind);
          }
        });
      }
    }
  },

  // สร้างของบนพื้น: ใช้รูปใหม่ (เหมือนในกระเป๋า) ถ้ามี ไม่มีก็ใช้รูปเดิม
  // name = 'box' (กล่องอุปกรณ์) หรือ 'scroll' (หนังสือสกิล)
  makeLoot(x, y, name) {
    const key = name === 'scroll' ? itemImgKey('skillbook', 'scroll') : itemImgKey('box', 'box');
    const s = this.loot.create(x, y, key);
    if (key.indexOf('img_') === 0) s.setDisplaySize(LOOT_DISPLAY_SIZE, LOOT_DISPLAY_SIZE);   // ปรับขนาดที่ค่าคงที่ด้านบนไฟล์
    return s;
  },

  dropLoot(x, y, monsterLv, boxLevel, isBoss, isEpic) {
    // v2: มอนไม่ดรอปทองเข้ากระเป๋าตรงๆ อีกแล้ว (กันโกง/ปั๊ม)
    // รายงานการฆ่าให้เซิร์ฟเวอร์ (serverBoxes.js -> functions/econ.js) แล้วเซิร์ฟเวอร์สุ่ม "กล่องเงิน" ให้
    // Epic นับเป็นมอนธรรมดา 1 ครั้ง (เซิร์ฟเวอร์ไม่มีชนิด epic) | ผู้เยี่ยมที่ไม่ล็อกอิน Google จะไม่ได้กล่อง
    if (window.ServerBoxes && ZONES[this.stageIdx]) {
      window.ServerBoxes.kill(ZONES[this.stageIdx].id, isBoss ? 'boss' : 'normal');
    }

    // Epic: มีโอกาสดรอปกล่องแดง
    if (isEpic && Math.random() < EPIC_RED_BOX_CHANCE) {
      const rb = this.makeLoot(x + 30, y + 10, 'box');
      rb.setData('kind', 'box'); rb.setData('level', boxLevel); rb.setData('tier', 'red');   // lootOptions.js อ่าน tier ตอนเก็บ
      this.toastMsg('🟥 มอนสเตอร์ Epic ดรอปกล่องแดง!');
    }

    if (isBoss) {
      for (let i = 0; i < 3; i++) {
        const it = this.makeLoot(x + 20 + i * 18, y + 14, 'box');
        it.setData('kind', 'box'); it.setData('level', boxLevel);
      }
      // หนังสือสกิล: มินิบอสโอกาส BOSS_SKILL_DROP_CHANCE (60%) สุ่มสกิลใดสกิลหนึ่ง
      if (Math.random() < BOSS_SKILL_DROP_CHANCE) {
        const sid = Phaser.Utils.Array.GetRandom(Object.keys(SKILL_DEFS));
        const sc = this.makeLoot(x - 22, y + 14, 'scroll');
        sc.setData('kind', 'skill'); sc.setData('sid', sid);
        this.toastMsg('📕 มินิบอสดรอปหนังสือสกิล: ' + SKILL_DEFS[sid].name);
      }
      return;
    }
    // มอนธรรมดา/Epic: กล่อง ~15% (เท่าโอกาสเดิม 28% x 55%) และหนังสือสกิล 5% (สุ่มแยกกัน)
    if (Phaser.Math.Between(1, 100) <= 15) {
      const it = this.makeLoot(x + 14, y, 'box');
      it.setData('kind', 'box'); it.setData('level', boxLevel);
    }
    if (Math.random() < NORMAL_SKILL_DROP_CHANCE) {
      const sid = Phaser.Utils.Array.GetRandom(Object.keys(SKILL_DEFS));
      const sc = this.makeLoot(x - 14, y + 6, 'scroll');
      sc.setData('kind', 'skill'); sc.setData('sid', sid);
      this.toastMsg('📕 ดรอปหนังสือสกิล: ' + SKILL_DEFS[sid].name);
    }
  },

  updateTargeting() {
    if (this.manualTarget && this.manualTarget.active) {
      this.target = this.manualTarget;
    } else {
      this.manualTarget = null;
      // หาเป้าหมายใกล้สุดทุก TARGET_SCAN_MS (ไม่ต้องวนมอนทุกตัวทุกเฟรม) หรือทันทีถ้าเป้าเดิมหายไป
      const now = this.time.now;
      if (!this.target || !this.target.active || now >= (this._tgtNext || 0)) {
        this._tgtNext = now + TARGET_SCAN_MS;
        this.target = this.nearestEnemy(TARGET_RANGE);
      }
    }
    if (this.target && this.target.active) {
      const t = this.target;
      const name = t.def ? t.def.name : (t.isBoss ? 'มินิบอส' : (t.ranged ? 'สไลม์ยิงไกล' : 'สไลม์'));
      this.targetRing.setVisible(true).setPosition(t.x, t.y);
      this.targetNameText.setText('เป้าหมาย: ' + name + ' Lv.' + t.level + '  HP ' + Math.max(0, t.hp) + '/' + t.maxHp);
      const dir = new Phaser.Math.Vector2(t.x - this.player.x, t.y - this.player.y);
      if (dir.length() > 1) this.facing.copy(dir).normalize();
    } else {
      this.target = null;
      this.targetRing.setVisible(false);
      this.targetNameText.setText('');
    }
  },
});
