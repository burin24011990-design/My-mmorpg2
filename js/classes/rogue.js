// ===== อาชีพโจร (rogue) — แก้ความสามารถสกิลของโจรที่ไฟล์นี้ =====
(function () {
  // ต้องมี _shared.js โหลดก่อน (สร้าง window.Classes) ถ้าไม่มีให้ดู error แรกสุดที่ขึ้นบนจอ
  const Classes = window.Classes;
  if (!Classes) throw new Error('rogue.js: ไม่พบ window.Classes -> _shared.js ไม่ทำงาน/โหลดไม่ขึ้น (ดู error ก่อนหน้า)');

  const P = Main.prototype;
  const TEST_UNLOCK = true;   // true = ปลดล็อกสกิลโจรทันทีเพื่อทดสอบ (ทดสอบเสร็จเปลี่ยนเป็น false ให้ได้จากหนังสือสกิล)
  const RG_IDS = ['rg_dash', 'rg_vanish', 'rg_slow'];
  const clamp = Phaser.Math.Clamp;

  Classes.defineClass('rogue', { color: 0x9b6bff, name: 'โจร', label: 'โจร' });

  // ---------- ข้อมูลสกิล (ปรับตัวเลขได้ตรงนี้) ----------
  // 1) เงาพุ่งฟัน: พุ่งไปฟัน hits ครั้ง ครั้งละ hitMul ของดาเมจ | ฟันโดนแล้วพุ่งต่อได้ recasts ครั้งภายใน recastMs
  //    กดค้างแล้วลากเพื่อเลือกทิศพุ่งได้ (ตั้งค่าที่ DIR_CFG ใน aimDash.js) | แตะเฉยๆ = พุ่งหาเป้า/ทิศที่หันอยู่
  Classes.skill('rg_dash', {
    name: 'เงาพุ่งฟัน', class: 'rogue', type: 'rdash', noInfo: true,
    dmg: 14, range: 170, cd: 6000, mp: 14,
    hits: 2, hitMul: 0.6, hitR: 75,
    recasts: 1, recastMs: 2500, recastRange: 280,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => 'พุ่งฟัน ' + def.hits + ' ครั้ง ครั้งละ ≈' + Math.round(Classes.power(def.id, def, lv, S) * def.hitMul) +
      ' • ฟันโดนแล้วพุ่งต่อได้ ' + def.recasts + ' ครั้ง • คูลดาวน์ ' + Classes.cdText(def, S),
  });

  // 2) เงาหายตัว: หายตัว dur มิลลิวินาที | ฟันครั้งแรกแรงขึ้น bonus เท่า และลดเกราะ armorBreak (0.35 = 35%) นาน armorMs
  Classes.skill('rg_vanish', {
    name: 'เงาหายตัว', class: 'rogue', type: 'rvanish', noInfo: true,
    dmg: 0, range: 0, cd: 14000, mp: 16,
    dur: 5000, bonus: 1.4, armorBreak: 0.35, armorMs: 6000, mspd: 25,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => 'หายตัว ' + (def.dur / 1000) + ' วิ ฟันครั้งแรกแรงขึ้น ' + Math.round((def.bonus - 1) * 100) +
      '% และลดเกราะ ' + Math.round(def.armorBreak * 100) + '% นาน ' + (def.armorMs / 1000) + ' วิ • คูลดาวน์ ' + Classes.cdText(def, S),
  });

  // 3) ฟันตัดเอ็น: ฟันด้านหน้า แล้วลดความเร็วเคลื่อนที่ (slow 0.5 = เหลือครึ่งหนึ่ง) นาน slowMs
  Classes.skill('rg_slow', {
    name: 'ฟันตัดเอ็น', class: 'rogue', type: 'rslow', noInfo: true,
    dmg: 20, range: 95, cd: 3000, mp: 12,
    slow: 0.5, slowMs: 3000,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => 'ดาเมจ ≈' + Classes.power(def.id, def, lv, S) + ' ลดความเร็วเคลื่อนที่ ' + Math.round((1 - def.slow) * 100) +
      '% นาน ' + (def.slowMs / 1000) + ' วิ • คูลดาวน์ ' + Classes.cdText(def, S),
  });

  // อัลติ พายุใบมีด: ฟันรัว hits ครั้งรอบตัว ห่างกัน gap มิลลิวินาที | ดูดเลือด vamp ของดาเมจที่ทำได้
  Classes.ulti('rogue', {
    name: 'พายุใบมีด', dmg: 60, range: 140, cd: ULTI_CD, mp: 50, type: 'rult',
    hits: 4, hitMul: 0.4, gap: 160, vamp: 0.4,
  }, { scale: { patk: 1 } });

  if (TEST_UNLOCK) Classes.testUnlock(RG_IDS);

  // ---------- ตัวช่วย ----------
  // ฟัน 1 ครั้ง: ถ้ากำลังหายตัวอยู่ ครั้งแรกจะแรงขึ้น + ลดเกราะเป้าหมาย แล้วออกจากการหายตัว
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

  // ---------- เงาพุ่งฟัน ----------
  // towards = มอนที่พุ่งเข้าหา | dir = {x,y} ทิศที่ผู้เล่นลากเลือก (ถ้ามี dir จะพุ่งตามทิศนี้เต็มระยะ)
  function doDash(scene, def, dmg, towards, left, dir) {
    const p = scene.player;
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
    scene.flash(p.x, p.y, 30, 0xb98cff);
    scene.tweens.add({ targets: p, x: clamp(p.x + ux * d, 20, WORLD_W - 20), y: clamp(p.y + uy * d, 20, WORLD_H - 20), duration: 140 });

    const per = Math.round(dmg * def.hitMul);
    let landed = 0;
    for (let i = 0; i < def.hits; i++) {
      scene.time.delayedCall(70 + i * 90, () => {
        const list = Classes.enemiesIn(scene, p.x, p.y, def.hitR);
        scene.flash(p.x, p.y, def.hitR * 0.7, 0xd9b3ff);
        landed += list.length;
        list.forEach(e => rogueHit(scene, e, per));
        if (i === def.hits - 1 && landed > 0 && left > 0) {   // ฟันโดน = เปิดช่วงพุ่งต่อ
          scene.rogueRecast = { sid: def.id, until: scene.time.now + def.recastMs, left: left };
          scene.popText(p.x, p.y - 40, 'พุ่งต่อได้!', '#d9b3ff');
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

  // กดสกิลพุ่งซ้ำระหว่างช่วงพุ่งต่อ = พุ่งอีกครั้งโดยไม่เสีย MP/คูลดาวน์ | บอท: หายตัวเฉพาะตอนมีเป้า และไม่หายตัวซ้อน
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
          const dmg = Math.round(def.dmg * skillLvMul(this.skillLv && this.skillLv[sid]) + this.atk);
          doDash(this, def, dmg, t, r.left - 1, dirA);
          return;
        }
      }
      const key = 'slot' + idx, before = this.cdEnd[key];
      this._dashAim = dirA;
      const res = _useSkill.call(this, idx, gp);
      if (this.cdEnd[key] === before) this._dashAim = null;   // ใช้ไม่สำเร็จ (คูลดาวน์/MP) ล้างทิศที่ค้าง
      return res;
    }
    if (def && def.type === 'rvanish' && this.autoMode) {
      if (this.rogueStealth || !(this.target && this.target.active)) return;
    }
    return _useSkill.call(this, idx, gp);
  };

  // ---------- เงาหายตัว ----------
  Classes.handlers.rvanish = function (def) {
    const now = this.time.now;
    this.rogueStealth = { until: now + def.dur, bonus: def.bonus, armorBreak: def.armorBreak, armorMs: def.armorMs, fired: false };
    if (this.addStatBuff && def.mspd) this.addStatBuff('vanish', { mspd: def.mspd }, def.dur);
    this.flash(this.player.x, this.player.y, 50, 0x9b6bff);
    this.toastMsg('🌑 หายตัว! ฟันครั้งแรกจะลดเกราะ');
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
  };

  // ---------- อัลติ พายุใบมีด ----------
  Classes.handlers.rult = function (def, x, y, dmg) {
    const scene = this, per = Math.round(dmg * def.hitMul);
    for (let i = 0; i < def.hits; i++) {
      scene.time.delayedCall(i * def.gap, () => {
        const p = scene.player;
        scene.flash(p.x, p.y, def.range * 0.8, 0xff6b9a);
        const list = Classes.enemiesIn(scene, p.x, p.y, def.range);
        list.forEach(e => rogueHit(scene, e, per));
        if (list.length) scene.healPlayer(Math.round(per * Math.min(list.length, 5) * def.vamp));
      });
    }
  };

  // ---------- ไอคอน + ปุ่มพุ่งต่อ ----------
  const ICON_OF = { rdash: 'ic_dash', rvanish: 'ic_vanish', rslow: 'ic_melee', rult: 'ic_melee' };
  const _sik = skillIconKey;
  skillIconKey = function (type) { return ICON_OF[type] || _sik(type); };

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
