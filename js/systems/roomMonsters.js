// ===== มอนสเตอร์แชร์ในห้อง (ซิงก์กับ server.js) =====
// ไฟล์: js/systems/roomMonsters.js  (โหลด "หลัง" town.js และก่อน js/main.js)
// - ออนไลน์และอยู่ในห้อง: มอนทั้งหมดมาจากเซิร์ฟเวอร์ คนในห้องเดียวกันเห็น/ตีมอนชุดเดียวกัน ต่างห้อง = คนละชุด
// - ออฟไลน์ / ห้องเต็ม / หลุดการเชื่อมต่อ: กลับไปใช้มอนในเครื่องแบบเดิม (monsters.js)
// - เซิร์ฟเวอร์คุม: ตำแหน่ง AI เลือด การตาย การเกิดใหม่ | เครื่องผู้เล่น: ตีมอน (ส่ง hits) รับดาเมจ ยิงกระสุน EXP/ดรอป
// - คนที่ตีมอนก่อนมอนตายทุกคนได้ EXP | คนที่ตีตัวสุดท้ายได้ของดรอป+ทอง

(function () {
  const P = Main.prototype;

  // ----- กันมอนในเครื่องเกิดซ้ำตอนอยู่โหมดห้อง (เช่น timer เกิดใหม่ของมอนเก่า) -----
  ['spawnEnemyInZone', 'spawnEpic', 'spawnBoss'].forEach(function (name) {
    const o = P[name];
    if (typeof o !== 'function') return;
    P[name] = function () {
      if (this.rmActive) return null;
      return o.apply(this, arguments);
    };
  });

  // ----- เปลี่ยนด่าน: กลับเป็นมอนในเครื่องก่อน แล้วรอเซิร์ฟเวอร์ส่งมอนของห้องมาแทน -----
  const oLoad = P.loadStage;
  P.loadStage = function () {
    this.rmActive = false;
    this.rmMap = {};
    this._rmHits = {};
    return oLoad.apply(this, arguments);
  };

  // ----- ล้างมอนทั้งหมด -----
  P.rmClear = function () {
    this.enemies.getChildren().slice().forEach(function (e) {
      if (e.levelText) e.levelText.destroy();
      e.destroy();
    });
    if (this.enemyShots) this.enemyShots.getChildren().slice().forEach(function (s) { s.destroy(); });
    this.target = null; this.manualTarget = null;
    this.rmMap = {}; this._rmHits = {};
  };

  // ----- สร้างมอนจากข้อมูลเซิร์ฟเวอร์: [id, kind, ด่าน, เลเวล, x, y, hp, maxHp, dmg] -----
  P.rmCreate = function (m) {
    const id = m[0], kind = m[1], zi = m[2], lv = m[3], x = m[4], y = m[5];
    const base = getMonsterDef(zi, kind === 'epic' ? 'normal' : kind);
    const def = kind === 'epic' ? Object.assign({}, base, { scale: base.scale * 1.3 }) : base;
    const e = this.enemies.create(x, y, def.key);
    e.def = def;
    e.kind = kind; e.ranged = kind === 'ranged';
    e.isBoss = kind === 'boss'; e.isEpic = kind === 'epic';
    e.level = lv; e.hp = m[6]; e.maxHp = m[7]; e.dmg = m[8];
    e.hitRange = (e.isBoss ? 40 : 26) * def.scale;
    e.setScale(def.scale);
    if (e.isEpic) { e._tint = 0xff66ff; e.setTint(0xff66ff); }
    e.sid = id; e.tx = x; e.ty = y;
    let color = '#ffe066', label = def.name + ' Lv.' + lv, size = NAME_SIZE_NORMAL;
    if (kind === 'ranged') color = '#ffb070';
    else if (kind === 'boss') { color = '#ff8888'; label = '👑 ' + label; size = NAME_SIZE_BOSS; }
    else if (kind === 'epic') { color = '#d98cff'; label = '💎 ' + label; size = NAME_SIZE_EPIC; }
    this.initEnemyCommon(e, zi, { x: x, y: y }, color, label, size);
    this.rmMap[id] = e;
    return e;
  };

  // ----- กลับไปใช้มอนในเครื่อง (หลุดเซิร์ฟเวอร์) -----
  P.rmRestoreLocal = function () {
    this.rmActive = false;
    this.rmClear();
    const idx = this.stageIdx, z = ZONES[idx];
    for (let i = 0; i < z.count; i++) this.spawnEnemyInZone(idx, 'normal');
    for (let i = 0; i < z.rangedCount; i++) this.spawnEnemyInZone(idx, 'ranged');
    for (let i = 0; i < EPIC_COUNT; i++) this.spawnEpic(idx);
    this.spawnDueBosses();
  };

  // ----- อัปเดตมอนทุกเฟรม: โหมดห้อง = เดินตามตำแหน่งจากเซิร์ฟเวอร์ (ไม่คิด AI เอง) -----
  const oUpd = P.updateEnemies;
  P.updateEnemies = function (time) {
    if (!this.rmActive) return oUpd.call(this, time);
    if (this.updatePlayerHidden) this.updatePlayerHidden(time);
    flushHits(this, time);

    if (!this.enemyBarGfx) this.enemyBarGfx = this.add.graphics().setDepth(41);
    const g = this.enemyBarGfx;
    g.clear();
    const self = this;
    this.enemies.getChildren().forEach(function (e) {
      if (!e.active || e.sid === undefined) return;
      const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
      if (d > 400) e.setPosition(e.tx, e.ty);
      else if (d > 0.5) e.setPosition(e.x + dx * 0.3, e.y + dy * 0.3);
      if (e.body) e.body.setVelocity(0, 0);
      if (e.def && e.def.hasSheet) {
        const st = time < e.atkUntil ? 'attack' : (d > 3 ? 'walk' : 'idle');
        if (e.animState !== st) { e.animState = st; e.play(e.def.key + '_' + st, true); }
        if (Math.abs(dx) > 3) e.setFlipX(dx < 0);
      }
      if (e.levelText) e.levelText.setPosition(e.x, e.y - e.labelOff);
      self.drawEnemyBar(g, e);
    });
  };

  // ----- ตีมอน: โหมดห้อง = โชว์เอฟเฟกต์เอง แล้วส่งดาเมจให้เซิร์ฟเวอร์ตัดสิน -----
  const oDmg = P.damage;
  P.damage = function (e, dmg, opts) {
    if (!this.rmActive || !e || e.sid === undefined) return oDmg.call(this, e, dmg, opts);
    if (!e.active) return;
    e.hp = Math.max(1, e.hp - dmg);                       // เดาไว้ก่อน รอเซิร์ฟเวอร์ยืนยัน (ตายเมื่อเซิร์ฟเวอร์บอก)
    e.provoked = true;
    this.revealUntil = this.time.now + BUSH_REVEAL_AFTER_ATTACK;
    opts = opts || {};
    const ctx = (this._skillCtx && this.time.now < this._skillCtx.until) ? this._skillCtx.def : null;
    const skill = opts.skill || ctx;
    const isCrit = !!(opts.crit || this._critHit);
    showDamage(this, e.x, e.y - 20, dmg, isCrit ? 'crit' : 'normal', skill ? { skill: skill } : undefined);
    monsterHitFx(this, e);
    if (!this._rmHits) this._rmHits = {};
    this._rmHits[e.sid] = (this._rmHits[e.sid] || 0) + Math.round(dmg);
  };

  function flushHits(sc, time) {
    const h = sc._rmHits;
    if (!h || !sc.socket) return;
    const ids = Object.keys(h);
    if (!ids.length || time - (sc._rmLastHit || 0) < 50) return;
    sc._rmLastHit = time;
    sc._rmHits = {};
    sc.socket.emit('hits', ids.map(function (id) { return [Number(id), h[id]]; }));
  }

  // ----- มอนตาย (เซิร์ฟเวอร์สั่ง) -----
  function onDead(sc, d) {
    const e = sc.rmMap[d.id];
    if (!e) return;
    delete sc.rmMap[d.id];
    if (!e.active) return;
    const x = e.x, y = e.y, lv = e.level, zi = e.zoneIdx, isBoss = !!e.isBoss, isEpic = !!e.isEpic;
    if (sc.target === e) sc.target = null;
    if (sc.manualTarget === e) sc.manualTarget = null;
    if (e.levelText) e.levelText.destroy();
    playMonsterDeath(sc, e);
    e.destroy();
    const me = sc.socket && sc.socket.id;
    const mult = isBoss ? BOSS_MULT : (isEpic ? EPIC_MULT : 1);
    if (d.who && d.who.indexOf(me) >= 0) sc.gainExp((5 + lv * 3) * mult);
    if (d.by === me) {
      sc.kills++;
      sc.dropLoot(x, y, lv, ZONES[zi].boxLevel, isBoss, isEpic);
      if (isBoss) sc.toastMsg('สังหารมินิบอส!');
    }
  }

  // ----- สกิลของ epic / บอส (เซิร์ฟเวอร์เลือกชนิดและทิศ เครื่องเราคิดดาเมจใส่ตัวเองเท่านั้น) -----
  function onSkill(sc, d) {
    const e = sc.rmMap[d.id];
    if (!e || !e.active) return;
    e.atkUntil = sc.time.now + 500;
    const p = sc.player, a = d.a;
    if (d.t === 'epic') {
      [-0.3, 0, 0.3].forEach(function (o) { sc.fireShot(e, a + o, 220, RANGED_SHOT_SCALE, 0.5); });
      return;
    }
    const r = d.r;
    if (r === 0) {
      for (let i = 0; i < 12; i++) sc.fireShot(e, i * Math.PI / 6, 200, 2.5, 0.4);
    } else if (r === 1) {
      [-0.5, -0.25, 0, 0.25, 0.5].forEach(function (o) { sc.fireShot(e, a + o, 260, 2.2, 0.4); });
    } else if (r === 2) {
      const R = 140, x = e.x, y = e.y, dm = Math.round(e.dmg * 0.8);
      const ring = sc.add.circle(x, y, R, 0xff2222, 0.25).setStrokeStyle(2, 0xff2222).setDepth(6);
      sc.time.delayedCall(800, function () {
        ring.destroy();
        if (Phaser.Math.Distance.Between(p.x, p.y, x, y) < R) sc.hurtPlayer(dm);
      });
    } else {
      const R = 340, x = e.x, y = e.y, dm = Math.round(e.dmg * 1.0);
      const ring = sc.add.circle(x, y, R, 0xff2222, 0.2).setStrokeStyle(3, 0xff2222).setDepth(6);
      sc.tweens.add({ targets: ring, alpha: 0.45, duration: 300, yoyo: true, repeat: 2 });
      sc.time.delayedCall(1300, function () {
        ring.destroy();
        const boom = sc.add.circle(x, y, R, 0xffffff, 0.5).setDepth(44);
        sc.tweens.add({ targets: boom, alpha: 0, duration: 300, onComplete: function () { boom.destroy(); } });
        if (Phaser.Math.Distance.Between(p.x, p.y, x, y) < R) sc.hurtPlayer(dm);
      });
    }
  }

  // ----- ผูกเหตุการณ์จากเซิร์ฟเวอร์ (หลังสร้าง socket ใน network.js) -----
  function attach(sc) {
    const s = sc.socket;
    sc.rmMap = sc.rmMap || {};
    sc.rmActive = false;

    s.on('mons', function (d) {                      // เข้าห้อง: เซิร์ฟเวอร์ส่งมอนทั้งห้อง
      if (!d || d.stage !== sc.stageIdx) return;
      sc.rmClear();
      sc.rmActive = true;
      d.list.forEach(function (m) { sc.rmCreate(m); });
    });
    s.on('mstate', function (list) {                 // ตำแหน่ง/เลือดที่เปลี่ยน
      if (!sc.rmActive) return;
      for (let i = 0; i < list.length; i++) {
        const a = list[i], e = sc.rmMap[a[0]];
        if (e && e.active) { e.tx = a[1]; e.ty = a[2]; e.hp = a[3]; }
      }
    });
    s.on('mspawn', function (m) { if (sc.rmActive && !sc.rmMap[m[0]]) sc.rmCreate(m); });
    s.on('mdead', function (d) { if (sc.rmActive) onDead(sc, d); });
    s.on('mhurt', function (d) {                     // มอนชนตัวเรา (ในเมืองไม่โดน)
      if (!sc.rmActive || window._townBusy) return;
      sc.hurtPlayer(d.dmg);
    });
    s.on('matk', function (id) {
      const e = sc.rmMap[id];
      if (e && e.active) e.atkUntil = sc.time.now + 400;
    });
    s.on('mshot', function (d) {                     // มอนยิงไกล
      const e = sc.rmMap[d.id];
      if (!sc.rmActive || !e || !e.active) return;
      e.atkUntil = sc.time.now + 400;
      sc.fireShot(e, d.a, d.sp, d.sc, d.dm);
    });
    s.on('mskill', function (d) { if (sc.rmActive) onSkill(sc, d); });
    s.on('disconnect', function () { if (sc.rmActive) sc.rmRestoreLocal(); });
  }

  const oInit = P.initNetwork;
  P.initNetwork = function () {
    oInit.apply(this, arguments);
    if (this.socket) attach(this);
  };
})();
