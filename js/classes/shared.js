// ===== ตัวช่วยกลางของไฟล์อาชีพ (js/classes/) =====
// โหลดหลัง aimDash.js ก่อนไฟล์อาชีพทุกไฟล์ และก่อน stats.js
(function () {
  // สร้าง Classes เป็นอย่างแรกสุด เพื่อให้ไฟล์อาชีพหาเจอเสมอ (แม้โค้ดข้างล่างจะ error)
  const Classes = window.Classes = window.Classes || {};
  Classes.scale = Classes.scale || {};
  Classes.handlers = Classes.handlers || {};
  Classes.info = Classes.info || {};

  const P = Main.prototype;

  // ---------- ลงทะเบียน ----------
  // อาชีพใหม่ (ซ่อนจากการวนลูป CLASSES กันระบบเดิมสุ่มอาวุธของอาชีพนี้)
  Classes.defineClass = function (id, info) {
    if (CLASSES[id]) return;
    try {
      Object.defineProperty(CLASSES, id, {
        value: Object.assign({}, CLASSES.mage || {}, info),
        enumerable: false, writable: true, configurable: true,
      });
    } catch (e) { console.error('defineClass', id, e); }
  };
  Classes.basic = function (cls, def) { BASIC_ATTACKS[cls] = def; };

  // opts: scale = ตัวคูณสเตตัส | ground = {cast, self} สกิลลากเล็ง | info = ฟังก์ชันข้อความคำอธิบายในหน้าต่างสกิล
  Classes.skill = function (id, def, opts) {
    opts = opts || {};
    def.id = id;
    SKILL_DEFS[id] = def;
    if (opts.scale) Classes.scale[id] = opts.scale;
    if (opts.ground && window.GROUND_CFG) window.GROUND_CFG[id] = opts.ground;
    if (opts.info) Classes.info[id] = opts.info;
  };
  Classes.ulti = function (cls, def, opts) {
    opts = opts || {};
    ULTI_DEFS[cls] = def;
    if (opts.scale) Classes.scale['ulti_' + cls] = opts.scale;
    if (opts.ground && window.GROUND_ULTI) window.GROUND_ULTI[cls] = opts.ground;
  };

  // ปลดล็อกสกิลเพื่อทดสอบ (ใช้ได้จากไฟล์อาชีพ)
  const unlockIds = [];
  Classes.testUnlock = function (ids) { unlockIds.push.apply(unlockIds, ids); };
  const _isd = P.initSkillData;
  P.initSkillData = function () {
    const r = _isd.apply(this, arguments);
    if (this.learnedSkills) {
      unlockIds.forEach(id => {
        if (!SKILL_DEFS[id]) return;
        this.learnedSkills.add(id);
        if (this.skillLv && !this.skillLv[id]) this.skillLv[id] = 1;
      });
    }
    return r;
  };

  // ---------- ตัวช่วยทั่วไป ----------
  Classes.enemiesIn = function (scene, x, y, r) {
    return scene.enemies.getChildren().filter(e => e.active && Phaser.Math.Distance.Between(x, y, e.x, e.y) < r);
  };
  // พลังสกิล = ค่าฐาน x เลเวลสกิล + ตัวคูณ x สเตตัส
  Classes.power = function (id, def, lv, S) {
    const sc = Classes.scale[id] || { patk: 1 };
    let v = def.dmg * skillLvMul(lv);
    Object.keys(sc).forEach(k => { v += (S[k] || 0) * sc[k]; });
    return Math.round(v);
  };
  Classes.cdText = function (def, S) {
    return (def.cd * (1 - Math.min(S.cdr || 0, 100) / 100) / 1000).toFixed(1) + 's';
  };

  P.popText = function (x, y, str, color) {
    const t = this.add.text(x, y, str, { fontSize: '16px', color: color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(200);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  };
  P.healPlayer = function (amount) {
    const before = this.stats.hp;
    this.stats.hp = Math.min(this.maxHp(), before + amount);
    const got = Math.round(this.stats.hp - before);
    if (got > 0) this.popText(this.player.x, this.player.y - 30, '+' + got, '#7dff9a');
  };

  // ---------- สถานะบนมอน (ช้า / ลดเกราะ / ฯลฯ) ----------
  // Classes.status(scene, มอน, 'slow', { mul: 0.5 }, 3000)   ช้า: ความเร็วคูณ mul
  // Classes.status(scene, มอน, 'armor', { pct: 0.35 }, 6000) ลดเกราะ pct (0.35 = 35%)
  Classes.status = function (scene, e, id, data, ms) {
    if (!e || !e.active) return;
    e._fx = e._fx || {};
    e._fx[id] = Object.assign({ until: scene.time.now + ms }, data);
  };
  // stats.js เรียกใช้ตอนคิดเกราะมอน
  window.enemyDefMul = function (e) {
    const a = e && e._fx && e._fx.armor, sc = window.__mainScene;
    return a && sc && sc.time.now < a.until ? Math.max(0, 1 - a.pct) : 1;
  };

  const _ue = P.updateEnemies;
  P.updateEnemies = function (time) {
    _ue.call(this, time);
    this.enemies.getChildren().forEach(e => {
      const fx = e._fx;
      if (!fx) return;
      let tint = null;
      if (fx.slow) {
        if (time >= fx.slow.until) delete fx.slow;
        else {
          if (e.body) e.setVelocity(e.body.velocity.x * fx.slow.mul, e.body.velocity.y * fx.slow.mul);
          tint = 0x66aaff;
        }
      }
      if (fx.armor) {
        if (time >= fx.armor.until) delete fx.armor;
        else if (tint === null) tint = 0xffb060;
      }
      if (tint !== null) { e.setTint(tint); e._fxTinted = true; }
      else if (e._fxTinted) { e.clearTint(); e._fxTinted = false; }
    });
  };

  // ---------- เอฟเฟกต์สกิลเฉพาะอาชีพ ----------
  // Classes.handlers[type] = function (def, x, y, dmg) { ... }   (this = scene)
  // เฉพาะสกิลที่เรากดเองเท่านั้นที่ทำงาน (สกิลของผู้เล่นคนอื่นจะไม่ทำให้ตัวเราพุ่ง/ฮีล)
  function mark(scene, def) {
    const now = scene.time.now;
    scene._cmarks = (scene._cmarks || []).filter(e => now - e.t < 1500);
    scene._cmarks.push({ def: def, t: now });
  }
  const _useSkill = P.useSkill;
  P.useSkill = function (idx, gp) {
    const sid = this.slots && this.slots[idx];
    const def = sid && SKILL_DEFS[sid];
    if (!def || !Classes.handlers[def.type]) return _useSkill.call(this, idx, gp);
    const key = 'slot' + idx, before = this.cdEnd[key];
    const r = _useSkill.call(this, idx, gp);
    if (this.cdEnd[key] !== before) mark(this, def);
    return r;
  };
  const _useUlti = P.useUlti;
  P.useUlti = function (gp) {
    const cls = this.ultiClass, def = cls && ULTI_DEFS[cls];
    if (!def || !Classes.handlers[def.type]) return _useUlti.call(this, gp);
    const before = this.cdEnd.ulti;
    const r = _useUlti.call(this, gp);
    if (this.cdEnd.ulti !== before) mark(this, def);
    return r;
  };
  const _apply = P.applySkillEffect;
  P.applySkillEffect = function (def, x, y, fx, fy, dmg, kind) {
    const h = Classes.handlers[def.type];
    if (!h) return _apply.call(this, def, x, y, fx, fy, dmg, kind);
    const now = this.time.now;
    this._cmarks = (this._cmarks || []).filter(e => now - e.t < 1500);
    const i = this._cmarks.findIndex(e => e.def === def || (e.def.name === def.name && e.def.range === def.range));
    if (i < 0) return;
    this._cmarks.splice(i, 1);
    h.call(this, def, x, y, dmg, fx, fy);
  };

  // ---------- คำอธิบายสกิลในหน้าต่างสกิล (Classes.info[id] = (def, lv, S) => ข้อความ) ----------
  function installHook() {
    if (!window.PixelPanels || !PixelPanels.addDataHook) return false;
    PixelPanels.addDataHook(function (d) {
      const sc = window.__mainScene;
      if (!sc || !sc.getStats) return d;
      const S = sc.getStats();
      const fix = list => (list || []).map(s => {
        const f = s.sid && Classes.info[s.sid];
        if (!f) return s;
        const t = f(SKILL_DEFS[s.sid], typeof s.lv === 'number' ? s.lv : 1, S);
        return t ? Object.assign({}, s, { info: t }) : s;
      });
      return Object.assign({}, d, { skills: fix(d.skills), specialSkills: fix(d.specialSkills) });
    });
    return true;
  }
  if (!installHook()) {
    const t = setInterval(function () { if (installHook()) clearInterval(t); }, 200);
  }
})();
