// ===== มอนสเตอร์แชร์ในห้อง (ซิงก์กับ server.js) =====
// ไฟล์: js/systems/roomMonsters.js  (โหลด "หลัง" town.js และก่อน js/main.js)
// - ออนไลน์และอยู่ในห้อง: มอนทั้งหมดมาจากเซิร์ฟเวอร์ คนในห้องเดียวกันเห็น/ตีมอนชุดเดียวกัน ต่างห้อง = คนละชุด
// - ออฟไลน์ / ห้องเต็ม / หลุดการเชื่อมต่อ: กลับไปใช้มอนในเครื่องแบบเดิม (monsters.js)
// - เซิร์ฟเวอร์คุม: ตำแหน่ง AI เลือด การตาย การเกิดใหม่ | เครื่องผู้เล่น: ตีมอน (ส่ง hits) รับดาเมจ ยิงกระสุน EXP/ดรอป
// - EXP: เซิร์ฟเวอร์ส่ง d.exp = { id: สัดส่วน } (ปาร์ตี้แชร์ EXP = หารเท่ากัน) | ของดรอป: เซิร์ฟเวอร์ส่ง d.lootTo (คนที่ได้สิทธิ์ตามโหมดปาร์ตี้)
// - แก้: โหมดห้องเรียก P.calcHit (stats.js) เพื่อคิดเกราะมอน/คริติคอล/ดูดเลือด เหมือนโหมดมอนในเครื่อง
// - v2: แก้สถานะสกิลหาย (ล็อกขา/สตั้น/แช่แข็ง/ไฟช็อต/ลดสเตตัส/รีเจนมานา)
//       สาเหตุเดิม: โหมดห้องไม่เรียกตัวอัปเดตมอนของไฟล์ classes/* เลย (ไฟล์เหล่านั้นครอบ updateEnemies ไว้)
//       ตอนนี้โหมดห้องเรียกมันทุกเฟรม (ต้องมีบรรทัด "if (this.rmActive) return;" ที่หัว updateEnemies ใน monsters.js)
//       + มอนที่ติดสตั้น/แช่แข็ง ไม่โจมตีเรา และยืนอยู่กับที่ | ล็อกขา = ยืนอยู่กับที่
//       + ส่งสถานะขึ้นเซิร์ฟเวอร์ผ่านอีเวนต์ 'mfx' ([id, ชนิดสถานะ, มิลลิวินาที, พารามิเตอร์]) ให้ server.js ทำ CC จริง
// - v3: แก้มอนไม่ตรงกันระหว่างผู้เล่น (ต่างคนต่างเห็นมอนของตัวเอง)
//       สาเหตุ: loadStage ปิดโหมดห้องแล้วสร้างมอนในเครื่อง แต่ถ้าห้องเดิม/ด่านเดิม เซิร์ฟเวอร์ไม่มีเหตุให้ส่งมอนมาใหม่
//       ตอนนี้ทุกครั้งที่โหลดด่าน เครื่องจะส่ง 'getMons' ขอมอนของห้องซ้ำ (server.js v8) และมีข้อความแจ้งเมื่อซิงก์สำเร็จ
//       (ต้องใช้คู่กับ server.js v8 ที่รองรับ 'getMons')
// - v4: แจกของตามโหมดปาร์ตี้: onDead ใช้ d.lootTo แทน d.by (ต้องใช้คู่กับ server.js v11)
// - v5: EXP หารตามจำนวนคนในปาร์ตี้: onDead ใช้ d.exp[me] (สัดส่วน) คูณ EXP มอน (ต้องใช้คู่กับ server.js v12)
//       โบนัสปาร์ตี้ +10/20/40% ยังคูณใน gainExp ของ social.js เหมือนเดิม (ไม่ต้องแก้ไฟล์นั้น)
// - v6: แชร์ไอเทมตอน "เก็บเข้าตัว": ของดรอปตกที่คนฆ่าเสมอ (บอทเก็บเองได้) พอเก็บ ถ้าปาร์ตี้ตั้งโหมดสุ่ม/สลับ
//       เครื่องจะส่ง 'lootShare' ให้เซิร์ฟเวอร์เลือกคนรับ แล้วของไปเกิดที่ตัวคนรับ (ถูกเก็บเข้ากระเป๋าทันที) | ใช้คู่กับ server.js v14
// - v7 (ลดแลค): โหมดห้อง ซ่อนชื่อมอนที่อยู่นอกจอ (เดิมอัปเดตตำแหน่งชื่อมอนทุกตัวทุกเฟรม) + ไม่เล่นอนิเมชันมอนนอกจอ
//       (ในโหมดห้อง ส่วนลดแลคของ monsters.js ไม่ทำงาน เพราะไฟล์นี้คุมมอนแทน)

(function () {
  const P = Main.prototype;

  // ----- แชร์ไอเทมปาร์ตี้ตอนเก็บเข้าตัว -----
  // ของที่ดรอปจากมอนในห้องจะถูกติดป้าย 'shareable' แล้วดักตอนเก็บ (ถ้าโหมดปาร์ตี้ไม่ใช่ own)
  const oMakeLoot = P.makeLoot;
  if (typeof oMakeLoot === 'function') {
    P.makeLoot = function () {
      const s = oMakeLoot.apply(this, arguments);
      if (s && this._rmDropping && typeof s.setData === 'function') s.setData('shareable', true);
      return s;
    };
  }

  function lootOf(a, b) {
    const xs = [a, b];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      if (x && typeof x.getData === 'function' && x.getData('shareable')) return x;
    }
    return null;
  }

  // คืน true = ดักไว้แล้ว (ลบของบนพื้น ส่งให้เซิร์ฟเวอร์แจกต่อ) | false = ให้เก็บตามปกติ
  function interceptLoot(sc, it) {
    if (!it || !it.active || it.getData('shared')) return false;
    const pt = sc.party;
    if (!pt || !pt.members || pt.members.length < 2 || (pt.lootMode || 'own') === 'own') return false;
    if (!sc.socket || !sc.socket.connected) return false;
    const kind = it.getData('kind');
    if (kind !== 'box' && kind !== 'skill') return false;
    const item = { kind: kind, level: it.getData('level'), tier: it.getData('tier'), sid: it.getData('sid') };
    if (sc.tweens) sc.tweens.killTweensOf(it);
    it.destroy();
    sc.socket.emit('lootShare', item);
    return true;
  }

  // ครอบฟังก์ชันเก็บของเดิม (ถ้ามีชื่อตรงกับรายการนี้ใน inventory.js) -- ไม่เจอชื่อก็ไม่เป็นไร ยังมีตัวดักที่ collider ด้านล่าง
  ['pickup', 'pickUp', 'pickupLoot', 'pickLoot', 'collectLoot', 'collectItem', 'onPickup'].forEach(function (name) {
    const o = P[name];
    if (typeof o !== 'function' || o._rmShare) return;
    const w = function (a, b) {
      const it = lootOf(a, b);
      if (it && interceptLoot(this, it)) return;
      return o.apply(this, arguments);
    };
    w._rmShare = true;
    P[name] = w;
  });

  // ครอบ overlap ระหว่างผู้เล่นกับกลุ่มของบนพื้น (this.loot) -- เรียกทุกครั้งที่มีของดรอป ผูกซ้ำไม่ได้เพราะมีธง _rmShare
  function hookColliders(sc) {
    try {
      if (!sc.physics || !sc.physics.world || !sc.loot) return;
      sc.physics.world.colliders.getActive().forEach(function (c) {
        if (c._rmShare || !(c.object1 === sc.loot || c.object2 === sc.loot)) return;
        const cb = c.collideCallback, ctx = c.callbackContext;
        if (typeof cb !== 'function') return;
        c.collideCallback = function (a, b) {
          const it = lootOf(a, b);
          if (it && interceptLoot(sc, it)) return;
          return cb.apply(ctx, arguments);
        };
        c._rmShare = true;
      });
    } catch (err) { console.warn('roomMonsters: hook loot', err); }
  }

  // ----- กันมอนในเครื่องเกิดซ้ำตอนอยู่โหมดห้อง (เช่น timer เกิดใหม่ของมอนเก่า) -----
  ['spawnEnemyInZone', 'spawnEpic', 'spawnBoss'].forEach(function (name) {
    const o = P[name];
    if (typeof o !== 'function') return;
    P[name] = function () {
      if (this.rmActive) return null;
      return o.apply(this, arguments);
    };
  });

  // ----- ขอมอนทั้งห้องจากเซิร์ฟเวอร์ (ใช้ตอนโหลดด่านแต่ยังอยู่ห้องเดิม) -----
  P.rmRequestMons = function () {
    if (!this.socket || !this.online || !this.inRoom) return;
    if (this.rmActive) return;
    // อยู่คนละด่านกับห้อง = network.js จะส่ง 'enter' ให้เอง แล้วเซิร์ฟเวอร์ส่งมอนมาให้
    if (this._netStage !== this.stageIdx) return;
    this.socket.emit('getMons', this.stageIdx);
  };

  // ----- เปลี่ยนด่าน: กลับเป็นมอนในเครื่องก่อน แล้วรอเซิร์ฟเวอร์ส่งมอนของห้องมาแทน -----
  const oLoad = P.loadStage;
  P.loadStage = function () {
    this.rmActive = false;
    this.rmMap = {};
    this._rmHits = {};
    const r = oLoad.apply(this, arguments);
    // หลังโหลดด่านเสร็จ ขอมอนห้องซ้ำ (หน่วงเล็กน้อยให้ฉากพร้อม และให้ network.js ส่ง 'enter' ก่อนถ้าเปลี่ยนด่าน)
    const sc = this;
    try {
      if (sc.time && sc.time.delayedCall) {
        sc.time.delayedCall(300, function () { sc.rmRequestMons(); });
        sc.time.delayedCall(2500, function () { sc.rmRequestMons(); });   // เผื่อ 'enter' ยังไม่เสร็จตอนแรก
      }
    } catch (err) { /* ไม่ให้พังการโหลดด่าน */ }
    return r;
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

  // ----- มอนติดสถานะควบคุมไหม (ใช้สถานะที่ classes/* ใส่ไว้ที่ e._fx) -----
  // stun / freeze = ขยับและโจมตีไม่ได้ | root = เดินไม่ได้ (ยังโจมตีได้ถ้าเซิร์ฟเวอร์ว่าอยู่ในระยะ)
  function ccActive(sc, e, kinds) {
    const fx = e && e._fx;
    if (!fx) return false;
    const now = sc.time.now;
    for (let i = 0; i < kinds.length; i++) {
      const s = fx[kinds[i]];
      if (s && now < s.until) return true;
    }
    return false;
  }
  const NO_ATTACK = ['stun', 'freeze'];
  const NO_MOVE = ['stun', 'freeze', 'root'];

  // ----- ส่งสถานะที่เราใส่ให้มอนขึ้นเซิร์ฟเวอร์ (server.js ฟังอีเวนต์ 'mfx' เพื่อทำ CC จริงให้ทุกคนในห้อง) -----
  (function hookStatus() {
    const C = window.Classes;
    if (!C || typeof C.status !== 'function' || C.status._rmWrapped) return;
    const orig = C.status;
    const wrapped = function (scene, e, type, params, ms) {
      const r = orig.apply(this, arguments);
      try {
        if (scene && scene.rmActive && scene.socket && e && e.sid !== undefined) {
          scene.socket.emit('mfx', [e.sid, type, Math.round(ms || 0), params || {}]);
        }
      } catch (err) { /* ไม่ให้พังการใช้สกิล */ }
      return r;
    };
    wrapped._rmWrapped = true;
    C.status = wrapped;
  })();

  // ----- อัปเดตมอนทุกเฟรม: โหมดห้อง = เดินตามตำแหน่งจากเซิร์ฟเวอร์ (ไม่คิด AI เอง) -----
  const oUpd = P.updateEnemies;
  P.updateEnemies = function (time) {
    if (!this.rmActive) return oUpd.call(this, time);
    if (this.updatePlayerHidden) this.updatePlayerHidden(time);
    flushHits(this, time);

    // เรียกตัวอัปเดตสถานะของ classes/* (ล็อกขา สตั้น แช่แข็ง ไฟช็อต ลดสเตตัส รีเจนมานา ฯลฯ)
    // ตัวในสุดคือ monsters.js ซึ่งต้องมี "if (this.rmActive) return;" ที่หัวฟังก์ชัน จะได้ไม่คิด AI ซ้ำ
    try { oUpd.call(this, time); } catch (err) { console.error('roomMonsters: status update', err); }

    if (!this.enemyBarGfx) this.enemyBarGfx = this.add.graphics().setDepth(41);
    const g = this.enemyBarGfx;
    g.clear();
    const self = this;
    const view = this.cameras.main.worldView;            // คำนวณครั้งเดียวต่อเฟรม (ใช้ซ่อนของนอกจอ)
    this.enemies.getChildren().forEach(function (e) {
      if (!e.active || e.sid === undefined) return;
      const held = ccActive(self, e, NO_MOVE);               // ติดสถานะ = ยืนอยู่กับที่
      const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
      if (!held) {
        if (d > 400) e.setPosition(e.tx, e.ty);
        else if (d > 0.5) e.setPosition(e.x + dx * 0.3, e.y + dy * 0.3);
      }
      if (e.body) e.body.setVelocity(0, 0);

      // นอกจอ (เผื่อขอบ 120px): ไม่ต้องเล่นอนิเมชัน
      const onScr = e.x > view.x - 120 && e.x < view.right + 120 && e.y > view.y - 120 && e.y < view.bottom + 120;
      if (onScr && e.def && e.def.hasSheet) {
        const st = time < e.atkUntil ? 'attack' : ((!held && d > 3) ? 'walk' : 'idle');
        if (e.animState !== st) { e.animState = st; e.play(e.def.key + '_' + st, true); }
        if (!held && Math.abs(dx) > 3) e.setFlipX(dx < 0);
      }

      // ชื่อมอน: โชว์เฉพาะที่อยู่ในจอ และไม่ได้ซ่อนในพุ่ม (hiddenInBush ตั้งโดย obstacles.js)
      if (e.levelText) {
        const on = !e.hiddenInBush && e.x > view.x - 80 && e.x < view.right + 80 && e.y > view.y - 80 && e.y < view.bottom + 80;
        if (on) {
          if (!e.levelText.visible) e.levelText.setVisible(true);
          e.levelText.setPosition(e.x, e.y - e.labelOff);
        } else if (e.levelText.visible) {
          e.levelText.setVisible(false);
        }
      }
      self.drawEnemyBar(g, e);
    });
  };

  // ----- ตีมอน: โหมดห้อง = คิดเกราะ/คริ/ดูดเลือด (calcHit ใน stats.js) + โชว์เอฟเฟกต์เอง แล้วส่งดาเมจให้เซิร์ฟเวอร์ตัดสิน -----
  const oDmg = P.damage;
  P.damage = function (e, dmg, opts) {
    if (!this.rmActive || !e || e.sid === undefined) return oDmg.call(this, e, dmg, opts);
    if (!e.active) return;

    // คิดดาเมจจริง (เกราะมอน + ทะลุเกราะ + คริติคอล) ด้วยสูตรเดียวกับมอนในเครื่อง
    const h = this.calcHit ? this.calcHit(e, dmg) : { final: Math.max(1, Math.round(Number(dmg))), crit: false, vamp: 0 };
    const final = h.final;

    e.hp = Math.max(1, e.hp - final);                     // เดาไว้ก่อน รอเซิร์ฟเวอร์ยืนยัน (ตายเมื่อเซิร์ฟเวอร์บอก)
    e.provoked = true;
    this.revealUntil = this.time.now + BUSH_REVEAL_AFTER_ATTACK;
    opts = opts || {};
    const ctx = (this._skillCtx && this.time.now < this._skillCtx.until) ? this._skillCtx.def : null;
    const skill = opts.skill || ctx;
    const isCrit = !!(opts.crit || h.crit);
    showDamage(this, e.x, e.y - 20, final, isCrit ? 'crit' : 'normal', skill ? { skill: skill } : undefined);
    monsterHitFx(this, e);
    if (!this._rmHits) this._rmHits = {};
    this._rmHits[e.sid] = (this._rmHits[e.sid] || 0) + final;

    // ดูดเลือด
    if (h.vamp > 0 && this.vampHeal) this.vampHeal(final * h.vamp / 100);
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
  // d.exp    = { id: สัดส่วน EXP } ใครอยู่ในนี้ได้ EXP (1 = เต็ม, ปาร์ตี้แชร์ = 1/จำนวนคนที่ได้รับ)
  // d.who    = รายชื่อ id ที่ได้ EXP (เก็บไว้รองรับเซิร์ฟเวอร์เก่า)
  // d.by     = id คนที่ตีตัวสุดท้าย (นับ kills / ประกาศมินิบอส)
  // d.lootTo = id คนที่ของดรอปตกให้ = คนฆ่า (แชร์ตอนเก็บเข้าตัว ดู interceptLoot)
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
    const baseExp = (5 + lv * 3) * mult;
    if (d.exp) {
      // เซิร์ฟเวอร์ใหม่: คูณตามสัดส่วนที่หารแล้ว (โบนัสปาร์ตี้จะถูกคูณต่อใน gainExp ของ social.js)
      const share = Number(d.exp[me]);
      if (share > 0) sc.gainExp(Math.max(1, Math.round(baseExp * share)));
    } else if (d.who && d.who.indexOf(me) >= 0) {
      sc.gainExp(baseExp);                              // รองรับเซิร์ฟเวอร์เก่า (ได้เต็ม)
    }
    if (d.by === me) {
      sc.kills++;
      if (isBoss) sc.toastMsg('สังหารมินิบอส!');
    }
    const lootTo = d.lootTo !== undefined ? d.lootTo : d.by;   // รองรับเซิร์ฟเวอร์เก่าที่ไม่ส่ง lootTo
    if (lootTo === me) {
      hookColliders(sc);
      sc._rmDropping = true;                               // ให้ makeLoot ติดป้าย shareable
      try { sc.dropLoot(x, y, lv, ZONES[zi].boxLevel, isBoss, isEpic); }
      finally { sc._rmDropping = false; }
    }
  }

  // ----- สกิลของ epic / บอส (เซิร์ฟเวอร์เลือกชนิดและทิศ เครื่องเราคิดดาเมจใส่ตัวเองเท่านั้น) -----
  function onSkill(sc, d) {
    const e = sc.rmMap[d.id];
    if (!e || !e.active) return;
    if (ccActive(sc, e, NO_ATTACK)) return;                // สตั้น/แช่แข็งอยู่ = ใช้สกิลไม่ได้
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

    s.on('mons', function (d) {                      // เข้าห้อง/ขอซ้ำ: เซิร์ฟเวอร์ส่งมอนทั้งห้อง
      if (!d) return;
      if (d.stage !== sc.stageIdx) {
        console.warn('roomMonsters: ได้มอนของด่าน ' + d.stage + ' แต่ตอนนี้อยู่ด่าน ' + sc.stageIdx + ' (ข้าม)');
        return;
      }
      const wasActive = sc.rmActive;
      sc.rmClear();
      sc.rmActive = true;
      d.list.forEach(function (m) { sc.rmCreate(m); });
      if (!wasActive && sc.toastMsg) sc.toastMsg('ซิงก์มอนกับห้อง CH' + sc.channel + '-' + sc.netRoom + ' แล้ว');
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
      // ถ้าเซิร์ฟเวอร์ส่ง id มอนมาด้วย และมอนตัวนั้นติดสตั้น/แช่แข็งอยู่ = ไม่โดน
      const e = (d && d.id !== undefined) ? sc.rmMap[d.id] : null;
      if (e && ccActive(sc, e, NO_ATTACK)) return;
      sc.hurtPlayer(d.dmg);
    });
    s.on('matk', function (id) {
      const e = sc.rmMap[id];
      if (e && e.active) e.atkUntil = sc.time.now + 400;
    });
    s.on('mshot', function (d) {                     // มอนยิงไกล
      const e = sc.rmMap[d.id];
      if (!sc.rmActive || !e || !e.active) return;
      if (ccActive(sc, e, NO_ATTACK)) return;        // สตั้น/แช่แข็งอยู่ = ยิงไม่ได้
      e.atkUntil = sc.time.now + 400;
      sc.fireShot(e, d.a, d.sp, d.sc, d.dm);
    });
    s.on('mskill', function (d) { if (sc.rmActive) onSkill(sc, d); });
    s.on('lootGet', function (d) {                   // ได้ไอเทมจากการแชร์ของปาร์ตี้: เสกที่ตัวเรา แล้วระบบเก็บของเดิมเก็บเข้ากระเป๋าเอง
      if (!d || (d.kind !== 'box' && d.kind !== 'skill') || !sc.player || typeof sc.makeLoot !== 'function') return;
      const it = sc.makeLoot(sc.player.x, sc.player.y, d.kind === 'skill' ? 'scroll' : 'box');
      it.setData('kind', d.kind);
      if (d.level !== undefined) it.setData('level', d.level);
      if (d.tier) it.setData('tier', d.tier);
      if (d.sid) it.setData('sid', d.sid);
      it.setData('shared', true);                    // กันแชร์ซ้ำ
      if (d.from && sc.toastMsg) sc.toastMsg('🎁 ได้ไอเทมจากปาร์ตี้ (' + d.from + ')');
    });
    s.on('disconnect', function () { if (sc.rmActive) sc.rmRestoreLocal(); });
  }

  const oInit = P.initNetwork;
  P.initNetwork = function () {
    oInit.apply(this, arguments);
    if (this.socket) attach(this);
  };
})();
