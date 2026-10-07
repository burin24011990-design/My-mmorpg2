// ===== อาชีพโจร (rogue) — แก้ความสามารถสกิลของโจรที่ไฟล์นี้ =====
(function () {
  // ต้องมี _shared.js โหลดก่อน (สร้าง window.Classes) ถ้าไม่มีให้ดู error แรกสุดที่ขึ้นบนจอ
  const Classes = window.Classes;
  if (!Classes) throw new Error('rogue.js: ไม่พบ window.Classes -> _shared.js ไม่ทำงาน/โหลดไม่ขึ้น (ดู error ก่อนหน้า)');

  const P = Main.prototype;
  const TEST_UNLOCK = true;   // true = ปลดล็อกสกิลโจรทันทีเพื่อทดสอบ (ทดสอบเสร็จเปลี่ยนเป็น false ให้ได้จากหนังสือสกิล)
  const RG_IDS = ['rg_dash', 'rg_vanish', 'rg_slow', 'rg_drain'];
  const clamp = Phaser.Math.Clamp;

  // คูลดาวน์อัลติโจร (มิลลิวินาที): 20000 = 20 วินาที
  const ULTI_COOLDOWN = 20000;

  // ตัวคูณมานาของสกิลโจรทุกสกิล (รวมอัลติ): 0.3 = ใช้มานาแค่ 30% (ลดลง 70%) | ตั้ง 1 = ค่าเดิม
  const MP_COST_MUL = 0.3;
  const mpc = n => Math.max(1, Math.round(n * MP_COST_MUL));


  const pct = v => Math.round((v || 0) * 100);
  const safePw = (def, lv, S) => { let v = NaN; try { v = Classes.power(def.id, def, lv, S); } catch (e) { v = NaN; } return isFinite(v) ? v : def.dmg; };
  const secs = ms => (Math.round((ms || 0) / 100) / 10) + ' วิ';

  Classes.defineClass('rogue', { color: 0x9b6bff, name: 'โจร', label: 'โจร' });

  // ---------- ข้อมูลสกิล (ปรับตัวเลขได้ตรงนี้) ----------
  // 1) เงาพุ่งฟัน: พุ่งไปฟัน hits ครั้ง ครั้งละ hitMul ของดาเมจ | ฟันโดนแล้วพุ่งต่อได้ recasts ครั้งภายใน recastMs
  //    recastMul = ความแรงของการพุ่งครั้งที่ 2 (2 = แรง 2 เท่า)
  //    dodgeMs = ทุกครั้งที่พุ่ง (รวมพุ่งต่อ) หลบการโจมตีของมอนได้ 1 ครั้ง ภายในเวลานี้ (3000 = 3 วิ)
  //    กดค้างแล้วลากเพื่อเลือกทิศพุ่งได้ (ตั้งค่าที่ DIR_CFG ใน aimDash.js) | แตะเฉยๆ = พุ่งหาเป้า/ทิศที่หันอยู่
  Classes.skill('rg_dash', {
    name: 'เงาพุ่งฟัน', class: 'rogue', type: 'rdash', noInfo: true,
    dmg: 14, range: 170, cd: 6000, mp: mpc(14),
    hits: 2, hitMul: 0.6, hitR: 75,
    recasts: 1, recastMs: 2500, recastRange: 280, recastMul: 2,
    dodgeMs: 3000,
    critBonus: 60, critMs: 4000,   // บัฟคริติคอล +60% นาน 4 วิ ทุกครั้งที่พุ่ง (รวมพุ่งต่อ)
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => {
      const per = Math.round(Classes.power(def.id, def, lv, S) * def.hitMul);
      return ['พุ่งฟัน ' + def.hits + ' ครั้ง ครั้งละ ≈' + per + ' (รัศมี ' + def.hitR + ')',
        'ระยะพุ่ง ' + def.range,
        'หลบการโจมตี 1 ครั้ง นาน ' + secs(def.dodgeMs) + ' ทุกครั้งที่พุ่ง',
        'คริติคอล +' + def.critBonus + '% นาน ' + secs(def.critMs) + ' ทุกครั้งที่พุ่ง',
        'ฟันโดนแล้วพุ่งต่อได้ ' + def.recasts + ' ครั้ง ภายใน ' + secs(def.recastMs) + ' (ระยะ ' + def.recastRange + ')',
        'พุ่งต่อแรง x' + def.recastMul + ' ≈' + (per * def.recastMul) + ' ต่อครั้ง',
        'คูลดาวน์ ' + Classes.cdText(def, S)].join(' • ');
    },
  });

  // 2) เงาหายตัว: หายตัว dur มิลลิวินาที | ฟันครั้งแรกจะออกจากการหายตัว
  //    bonus = ดาเมจครั้งแรกคูณกี่เท่า (1 = ไม่เพิ่ม) | armorBreak = ลดเกราะศัตรู (0.1 = 10%) นาน armorMs
  //    critBonus = เพิ่มคริติคอล % (100 = ติดคริแน่นอน) นาน critMs นับตั้งแต่กดใช้สกิล (ไม่ต้องรอฟันครั้งแรก)
  Classes.skill('rg_vanish', {
    name: 'เงาหายตัว', class: 'rogue', type: 'rvanish', noInfo: true,
    dmg: 0, range: 0, cd: 14000, mp: mpc(16),
    dur: 5000, bonus: 1.4, armorBreak: 0.1, armorMs: 5000,
    critBonus: 100, critMs: 5000, mspd: 25,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => ['หายตัว ' + secs(def.dur) + ' (มอนไกลกว่า 110 มองไม่เห็น)',
        'ความเร็วเดิน +' + def.mspd + '% นาน ' + secs(def.dur),
        'คริติคอล +' + def.critBonus + '% (ติดคริแน่นอน) นาน ' + secs(def.critMs),
        'ฟันครั้งแรกออกจากการหายตัว ดาเมจ x' + def.bonus + ' (+' + pct(def.bonus - 1) + '%)',
        'ศัตรูที่โดนฟันครั้งแรก เกราะ -' + pct(def.armorBreak) + '% นาน ' + secs(def.armorMs),
        'คูลดาวน์ ' + Classes.cdText(def, S)].join(' • '),
  });

  // 3) ฟันตัดเอ็น: ฟันด้านหน้า แล้วลดความเร็วเคลื่อนที่ (slow 0.5 = เหลือครึ่งหนึ่ง) นาน slowMs
  //    healPct / mpPct = ฟื้น HP / MP ทันทีที่ใช้ เป็น % ของค่าสูงสุด (0.15 = 15%)
  Classes.skill('rg_slow', {
    name: 'ฟันตัดเอ็น', class: 'rogue', type: 'rslow', noInfo: true,
    dmg: 20, range: 95, cd: 3000, mp: mpc(12),
    slow: 0.5, slowMs: 3000, healPct: 0.15, mpPct: 0.2,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => ['ฟันด้านหน้า ดาเมจ ≈' + Classes.power(def.id, def, lv, S) + ' (รัศมี ' + def.range + ')',
        'ศัตรูที่โดน ความเร็วเดิน -' + pct(1 - def.slow) + '% นาน ' + secs(def.slowMs),
        'ฟื้น HP ' + pct(def.healPct) + '% ของสูงสุดทันที',
        'ฟื้น MP ' + pct(def.mpPct) + '% ของสูงสุดทันที',
        'คูลดาวน์ ' + Classes.cdText(def, S)].join(' • '),
  });

  // 4) ฟันดูดเลือด: ฟันตรงเป็นแนวยาว range กว้าง halfW*2 ไปทางที่เลือก | ดูดเลือด vamp ของดาเมจต่อเป้า (นับสูงสุด 5 เป้า)
  //    (ดาเมจ x2 จากเดิม 24 -> 48)
  //    aspd = บัฟความเร็วโจมตี % (25 = +25%) นาน aspdMs (3000 = 3 วิ) ทุกครั้งที่ใช้สกิล
  //    ถ้าบัฟไม่ขึ้น ให้เช็คชื่อสเตตัสความเร็วโจมตีใน stats.js แล้วแก้คีย์ 'aspd' ที่ handler rdrain ด้านล่าง
  Classes.skill('rg_drain', {
    name: 'ฟันดูดเลือด', class: 'rogue', type: 'rdrain', noInfo: true,
    dmg: 48, range: 220, halfW: 45, cd: 5000, mp: mpc(16), vamp: 0.5,
    aspd: 25, aspdMs: 3000,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => ['ฟันตรงเป็นแนว ยาว ' + def.range + ' กว้าง ' + (def.halfW * 2) + ' ดาเมจ ≈' + Classes.power(def.id, def, lv, S),
        'ลากเลือกทิศได้',
        'ดูดเลือด ' + pct(def.vamp) + '% ของดาเมจต่อเป้า (สูงสุด 5 เป้า)',
        'ความเร็วโจมตี +' + def.aspd + '% นาน ' + secs(def.aspdMs) + ' ทุกครั้งที่ใช้',
        'คูลดาวน์ ' + Classes.cdText(def, S)].join(' • '),
  });

  // อัลติ พายุใบมีด: ฟันรัว hits ครั้งรอบตัว ห่างกัน gap มิลลิวินาที | ดูดเลือด vamp ของดาเมจที่ทำได้ | คูลดาวน์ 20 วิ
  // (ภาพพายุใน skillFx.js เล่น 640ms = hits x gap ถ้าเปลี่ยน hits/gap ให้ปรับ fps ของ rg_ult ใน skillFx.js ตาม)
  // (พลังโจมตี +50% จากเดิม dmg 60 -> 90)
  Classes.ulti('rogue', {
    name: 'พายุใบมีด', dmg: 90, range: 140, cd: ULTI_COOLDOWN, mp: mpc(50), type: 'rult',
    hits: 4, hitMul: 0.4, gap: 160, vamp: 0.4, noInfo: true,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => {
      const per = Math.round(safePw(def, lv, S) * def.hitMul);
      return ['ฟันรัวรอบตัว รัศมี ' + def.range + ' ' + def.hits + ' ครั้ง ห่างกัน ' + secs(def.gap),
        'ครั้งละ ≈' + per + ' (รวม ≈' + (per * def.hits) + ')',
        'ดูดเลือด ' + pct(def.vamp) + '% ของดาเมจ (สูงสุด 5 เป้าต่อครั้ง)',
        'คูลดาวน์ ' + Classes.cdText(def, S)].join(' • ');
    },
  });

  if (TEST_UNLOCK) Classes.testUnlock(RG_IDS);

  // ลงทะเบียนลากเลือกทิศกับ aimDash.js (len = ความยาวลูกศร, w = ครึ่งความกว้างแถบ)
  if (window.DIR_CFG) window.DIR_CFG.rg_drain = { len: SKILL_DEFS.rg_drain.range, w: SKILL_DEFS.rg_drain.halfW };

  // ---------- ตัวช่วย ----------
  // ฟัน 1 ครั้ง: ถ้ากำลังหายตัวอยู่ ครั้งแรกจะลดเกราะเป้าหมาย แล้วออกจากการหายตัว (คริ 100% เริ่มตอนกดใช้สกิลแล้ว ดู rvanish)
  function rogueHit(scene, e, dmg) {
    const s = scene.rogueStealth, now = scene.time.now;
    let d = dmg;
    if (s && now < s.until) {
      if (!s.fired) {
        s.fired = true; s.until = now + 300;   // ทุกเป้าที่โดนในจังหวะเดียวกันได้ผลเหมือนกัน
        scene.popText(scene.player.x, scene.player.y - 40, 'ฟันจากเงา!', '#d9b3ff');
      }
      Classes.status(scene, e, 'armor', { pct: s.armorBreak }, s.armorMs);
      d = Math.round(d * s.bonus);
    }
    scene.damage(e, d);
  }

  function pickTarget(scene, maxD) {
    const p = scene.player, t = scene.target && scene.target.active ? scene.target : null;
    if (t && Phaser.Math.Distance.Between(p.x, p.y, t.x, t.y) <= maxD) return t;
    let best = null, bd = maxD;
    scene.enemies.getChildren().forEach(e => {
      const d = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
      if (e.active && d < bd) { bd = d; best = e; }
    });
    return best;
  }

  // ทิศที่จะฟันแนวตรง: ลากเลือก (gp.dir) > หันไปหามอนที่ล็อกอยู่ > ทิศที่หันอยู่
  function aimDir(scene, gp) {
    if (gp && gp.dir) {
      const v = new Phaser.Math.Vector2(gp.x, gp.y);
      if (v.length() > 0.001) return v.normalize();
    }
    const p = scene.player, t = scene.target && scene.target.active ? scene.target : null;
    if (t) {
      const v = new Phaser.Math.Vector2(t.x - p.x, t.y - p.y);
      if (v.length() > 1) return v.normalize();
    }
    const f = new Phaser.Math.Vector2(scene.facing.x, scene.facing.y);
    return f.length() > 0.001 ? f.normalize() : new Phaser.Math.Vector2(1, 0);
  }

  // ---------- เงาพุ่งฟัน ----------
  // towards = มอนที่พุ่งเข้าหา | dir = {x,y} ทิศที่ผู้เล่นลากเลือก (ถ้ามี dir จะพุ่งตามทิศนี้เต็มระยะ)
  // boosted = true เมื่อเป็นการพุ่งต่อ (ครั้งที่ 2) ใช้ข้อความ x2 | dmg ที่ส่งเข้ามาถูกคูณ recastMul แล้ว
  function doDash(scene, def, dmg, towards, left, dir, boosted) {
    const p = scene.player;
    // หลบการโจมตีได้ 1 ครั้ง ทุกครั้งที่พุ่ง (รวมพุ่งต่อ) หมดอายุตาม def.dodgeMs
    scene.rogueDodge = { until: scene.time.now + (def.dodgeMs || 3000) };
    scene.popText(p.x, p.y - 62, 'พร้อมหลบ!', '#9be7ff');
    // บัฟคริติคอลทุกครั้งที่พุ่ง
    if (scene.addStatBuff && def.critBonus) {
      scene.addStatBuff('dashCrit', { crit: def.critBonus }, def.critMs || 4000);
      scene.popText(p.x, p.y - 80, '🎯 คริ +' + def.critBonus + '%', '#ffb86b');
    }

    const chase = towards && !dir;
    let dx, dy;
    if (dir) { dx = dir.x; dy = dir.y; }
    else { dx = towards ? towards.x - p.x : scene.facing.x; dy = towards ? towards.y - p.y : scene.facing.y; }
    let len = Math.hypot(dx, dy);
    if (len < 0.001) { dx = 1; dy = 0; len = 1; }
    const ux = dx / len, uy = dy / len;
    let d = chase ? Math.min(def.range, Math.max(0, len - 35)) : def.range;
    if (scene.segmentBlocked) {
      while (d > 0 && scene.segmentBlocked(p.x, p.y, p.x + ux * d, p.y + uy * d, 14)) d -= 15;
    }
    d = Math.max(0, d);
    scene.flash(p.x, p.y, boosted ? 44 : 30, boosted ? 0xff6b9a : 0xb98cff);
    if (boosted) scene.popText(p.x, p.y - 40, 'พุ่งแรง x' + (def.recastMul || 1) + '!', '#ff9ec0');
    // รอยพุ่งสีม่วง (skillFx.js) ใช้ทิศ/ระยะจริงของการพุ่งครั้งนี้
    if (d > 10 && window.SkillFx && window.SkillFx.dashTrail) window.SkillFx.dashTrail(scene, p.x, p.y, ux, uy, d);
    scene.tweens.add({ targets: p, x: clamp(p.x + ux * d, 20, WORLD_W - 20), y: clamp(p.y + uy * d, 20, WORLD_H - 20), duration: 140 });

    const per = Math.round(dmg * def.hitMul);
    let landed = 0;
    for (let i = 0; i < def.hits; i++) {
      scene.time.delayedCall(70 + i * 90, () => {
        const list = Classes.enemiesIn(scene, p.x, p.y, def.hitR);
        scene.flash(p.x, p.y, def.hitR * 0.7, boosted ? 0xff9ec0 : 0xd9b3ff);
        landed += list.length;
        list.forEach(e => rogueHit(scene, e, per));
        if (i === def.hits - 1 && landed > 0 && left > 0) {   // ฟันโดน = เปิดช่วงพุ่งต่อ
          scene.rogueRecast = { sid: def.id, until: scene.time.now + def.recastMs, left: left };
          scene.popText(p.x, p.y - 40, 'พุ่งต่อได้ x' + (def.recastMul || 1) + '!', '#d9b3ff');
        }
      });
    }
  }
  Classes.handlers.rdash = function (def, x, y, dmg) {
    const a = this._dashAim;   // ทิศที่ลากเลือก (ตั้งไว้ใน useSkill ด้านล่าง)
    this._dashAim = null;
    if (a && this.time.now - a.t < 1500) doDash(this, def, dmg, null, def.recasts, a);
    else doDash(this, def, dmg, pickTarget(this, def.range + 90), def.recasts);
  };

  // ---------- ระบบหลบ 1 ครั้ง ----------
  // ดักที่ hurtPlayer: ถ้ามี rogueDodge ที่ยังไม่หมดอายุ -> ไม่โดนดาเมจ 1 ครั้ง แล้วใช้หมด
  // (ครอบคลุมทั้งมอนชน กระสุน และสกิลวงแดงของบอส เพราะทุกอย่างเรียก hurtPlayer)
  const _hurtPlayer = P.hurtPlayer;
  if (_hurtPlayer) {
    P.hurtPlayer = function (raw) {
      const dg = this.rogueDodge;
      if (dg) {
        this.rogueDodge = null;   // หมดอายุหรือใช้แล้ว ล้างทิ้งเสมอ
        if (this.time.now < dg.until) {
          if (this.player) {
            this.popText(this.player.x, this.player.y - 40, 'หลบ!', '#9be7ff');
            this.flash(this.player.x, this.player.y, 36, 0x9be7ff);
          }
          return;
        }
      }
      return _hurtPlayer.apply(this, arguments);
    };
  } else {
    console.error('rogue.js: ไม่พบ hurtPlayer ระบบหลบจึงไม่ทำงาน (ตรวจว่า fixes.js โหลดก่อน rogue.js)');
  }

  // กดสกิลพุ่งซ้ำระหว่างช่วงพุ่งต่อ = พุ่งอีกครั้งโดยไม่เสีย MP/คูลดาวน์ (ดาเมจคูณ recastMul) | บอท: หายตัวเฉพาะตอนมีเป้า และไม่หายตัวซ้อน
  // gp = {dir:true, x, y} เมื่อผู้เล่นลากเลือกทิศจากปุ่มสกิล (aimDash.js)
  const _useSkill = P.useSkill;
  P.useSkill = function (idx, gp) {
    const sid = this.slots && this.slots[idx];
    const def = sid && SKILL_DEFS[sid];
    const dirA = gp && gp.dir ? { x: gp.x, y: gp.y, t: this.time.now } : null;
    if (def && def.type === 'rdash') {
      const r = this.rogueRecast, now = this.time.now;
      if (r && r.sid === sid && now < r.until && r.left > 0 && !this.panel) {
        const t = dirA ? null : pickTarget(this, def.recastRange);
        if (dirA || t) {
          this.rogueRecast = null;
          const base = def.dmg * skillLvMul(this.skillLv && this.skillLv[sid]) + this.atk;
          doDash(this, def, Math.round(base * (def.recastMul || 1)), t, r.left - 1, dirA, true);
          return;
        }
      }
      const key = 'slot' + idx, before = this.cdEnd[key];
      this._dashAim = dirA;
      const res = _useSkill.call(this, idx, gp);
      if (this.cdEnd[key] === before) this._dashAim = null;   // ใช้ไม่สำเร็จ (คูลดาวน์/MP) ล้างทิศที่ค้าง
      return res;
    }
    // ฟันดูดเลือด / ฟันตัดเอ็น: ตั้งทิศก่อนใช้ ให้ handler และภาพเอฟเฟกต์อ่านจาก facing (ตรงกับทิศที่ฟันจริง)
    if (def && (def.type === 'rdrain' || def.type === 'rslow') && !this.panel &&
        this.time.now >= (this.cdEnd['slot' + idx] || 0) && this.stats.mp >= def.mp) {
      const d = aimDir(this, gp);
      this.facing.set(d.x, d.y);
    }
    if (def && def.type === 'rvanish' && this.autoMode) {
      if (this.rogueStealth || !(this.target && this.target.active)) return;
    }
    return _useSkill.call(this, idx, gp);
  };

  // ---------- เงาหายตัว ----------
  Classes.handlers.rvanish = function (def) {
    const now = this.time.now;
    this.rogueStealth = {
      until: now + def.dur, bonus: def.bonus, armorBreak: def.armorBreak, armorMs: def.armorMs,
      critBonus: def.critBonus, critMs: def.critMs, fired: false,
    };
    if (this.addStatBuff && def.mspd) this.addStatBuff('vanish', { mspd: def.mspd }, def.dur);
    // โจมตีติดคริแน่นอน: คริ +100% (เพดานคริคือ 100% = ติดทุกครั้ง) นับจากตอนกดใช้ นาน critMs
    if (this.addStatBuff && def.critBonus) this.addStatBuff('vanishCrit', { crit: def.critBonus }, def.critMs);
    this.flash(this.player.x, this.player.y, 50, 0x9b6bff);
    this.toastMsg('🌑 หายตัว! โจมตีติดคริแน่นอน ');
  };

  // หายตัว = มอนที่อยู่ไกลกว่า 110 มองไม่เห็น (ใช้ระบบเดียวกับพุ่มหญ้า)
  const _uph = P.updatePlayerHidden;
  P.updatePlayerHidden = function (time) {
    let hidden = _uph ? _uph.call(this, time) : false;
    const s = this.rogueStealth;
    if (s) {
      if (time >= s.until) {
        this.rogueStealth = null;
        if (this.player) this.player.setAlpha(1);
      } else {
        this.player.setAlpha(0.35);
        this.playerHidden = true;
        hidden = true;
      }
    }
    return hidden;
  };

  // ---------- ฟันตัดเอ็น ----------
  Classes.handlers.rslow = function (def, x, y, dmg) {
    const p = this.player, t = this.target && this.target.active ? this.target : null;
    let fx = this.facing.x, fy = this.facing.y;
    if (t) {
      const v = new Phaser.Math.Vector2(t.x - p.x, t.y - p.y);
      if (v.length() > 1) { v.normalize(); fx = v.x; fy = v.y; }
    }
    const cx = p.x + fx * 55, cy = p.y + fy * 55;
    this.flash(cx, cy, def.range * 0.8, 0xd9b3ff);
    Classes.enemiesIn(this, cx, cy, def.range).forEach(e => {
      Classes.status(this, e, 'slow', { mul: def.slow }, def.slowMs);
      rogueHit(this, e, dmg);
    });
    // ฟื้นเลือดและมานาทันทีที่ใช้ (% ของค่าสูงสุด)
    if (def.healPct && this.healPlayer) {
      const hp = Math.round(this.maxHp() * def.healPct);
      this.healPlayer(hp);
      this.popText(p.x, p.y - 62, '💚 +' + hp, '#7dff9b');
    }
    if (def.mpPct && this.stats) {
      const mp = Math.round(this.maxMp() * def.mpPct);
      this.stats.mp = Math.min(this.maxMp(), this.stats.mp + mp);
      this.popText(p.x, p.y - 80, '💧 +' + mp, '#7db8ff');
    }
  };

  // ---------- ฟันดูดเลือด ----------
  // ถ้ามีภาพคลื่นฟัน (skillFx.js: rg_drain) จะไม่วาดแถบสี่เหลี่ยมซ้อน
  Classes.handlers.rdrain = function (def, x, y, dmg, fx, fy) {
    const scene = this, p = scene.player;
    let ux = fx, uy = fy;
    const l = Math.hypot(ux, uy);
    if (l < 0.001) { ux = 1; uy = 0; } else { ux /= l; uy /= l; }
    const len = def.range, hw = def.halfW;

    // บัฟความเร็วโจมตี (ได้ทุกครั้งที่ใช้สกิล แม้ไม่โดนมอน)
    if (scene.addStatBuff && def.aspd) {
      scene.addStatBuff('drainAspd', { aspd: def.aspd }, def.aspdMs);
      scene.popText(p.x, p.y - 62, '⚡ ความเร็วโจมตี +' + def.aspd + '%', '#ffd45c');
    }

    if (!(scene.anims && scene.anims.exists('rg_drain'))) {
      const r = scene.add.rectangle(p.x + ux * len / 2, p.y + uy * len / 2, len, hw * 2, 0xff4d7a, 0.4)
        .setRotation(Math.atan2(uy, ux)).setDepth(60);
      scene.tweens.add({ targets: r, alpha: 0, duration: 280, onComplete: () => r.destroy() });
    }

    const list = scene.enemies.getChildren().filter(e => {
      if (!e.active) return false;
      const rx = e.x - p.x, ry = e.y - p.y;
      const along = rx * ux + ry * uy, perp = Math.abs(-rx * uy + ry * ux);
      return along >= -15 && along <= len + 12 && perp <= hw + 12;
    });
    list.forEach(e => rogueHit(scene, e, dmg));
    if (list.length) scene.healPlayer(Math.round(dmg * Math.min(list.length, 5) * def.vamp));
  };

  // ---------- อัลติ พายุใบมีด ----------
  // ถ้ามีภาพพายุ (skillFx.js: rg_ult) จะไม่วาดแสงวาบซ้ำ
  Classes.handlers.rult = function (def, x, y, dmg) {
    const scene = this, per = Math.round(dmg * def.hitMul);
    for (let i = 0; i < def.hits; i++) {
      scene.time.delayedCall(i * def.gap, () => {
        const p = scene.player;
        if (!(scene.anims && scene.anims.exists('rg_ult'))) scene.flash(p.x, p.y, def.range * 0.8, 0xff6b9a);
        const list = Classes.enemiesIn(scene, p.x, p.y, def.range);
        list.forEach(e => rogueHit(scene, e, per));
        if (list.length) scene.healPlayer(Math.round(per * Math.min(list.length, 5) * def.vamp));
      });
    }
  };

  // ---------- ไอคอน + ปุ่มพุ่งต่อ ----------
  const ICON_OF = { rdash: 'ic_dash', rvanish: 'ic_vanish', rslow: 'ic_melee', rdrain: 'ic_melee', rult: 'ic_melee' };
  try {
    if (typeof skillIconKey === 'function') {
      const _sik = skillIconKey;
      skillIconKey = function (type) { return ICON_OF[type] || _sik(type); };
    }
  } catch (err) { console.error('rogue.js skillIconKey', err); }

  const _setupButtons = P.setupButtons;
  P.setupButtons = function () {
    _setupButtons.call(this);
    if (!this.textures.exists('ic_vanish')) {
      const t = this.textures.createCanvas('ic_vanish', 32, 32), g = t.getContext();
      g.strokeStyle = '#fff'; g.lineWidth = 4;
      if (g.setLineDash) g.setLineDash([4, 4]);
      g.beginPath(); g.arc(16, 16, 11, 0, Math.PI * 2); g.stroke();
      if (g.setLineDash) g.setLineDash([]);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 5, 0, Math.PI * 2); g.fill();
      t.refresh();
    }
  };

  const _usb = P.updateSkillButtons;
  P.updateSkillButtons = function (time) {
    _usb.call(this, time);
    const r = this.rogueRecast;
    if (!r || time >= r.until || !this.slotBtns) return;
    (this.slots || []).forEach((sid, i) => {
      if (sid !== r.sid || !this.slotBtns[i]) return;
      this.slotBtns[i].cdText.setText('พุ่งต่อ!');
      this.slotBtns[i].c.setFillStyle(CLASSES.rogue.color, 0.95);
    });
  };
})();
