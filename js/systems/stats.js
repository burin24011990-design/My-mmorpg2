// ===== ระบบสเตตัสแบบ RoV =====
// ค่ารวม = พื้นฐานจากเลเวล + อุปกรณ์ + บัพชั่วคราว | ดาเมจสกิล = ค่าฐาน + ตัวคูณ x สเตตัส
// โหลดหลัง priest.js และก่อน main.js
(function () {
  const P = Main.prototype;

  // ---------- ค่าที่ปรับได้ ----------
  const DEF_K_BASE = 20, DEF_K_PER_LV = 2;   // ลดดาเมจ% = เกราะ / (เกราะ + K) โดย K = BASE + PER_LV x เลเวลผู้เล่น
  const BASE_DEF_PER_LV = 0.8;               // เกราะพื้นฐานของผู้เล่นต่อเลเวล
  const MOB_DEF_PER_LV = 0.8;                // เกราะมอนต่อเลเวลมอน
  const BOSS_DEF_MULT = 1.5;                 // มินิบอสเกราะเป็นกี่เท่า
  const MAGIC_CLASSES = { mage: true, priest: true };   // สายที่ใช้พลังเวท (ที่เหลือใช้โจมตีกายภาพ)

  // ---------- ตารางสเตตัส (เพิ่มสเตตัสใหม่: เพิ่มบรรทัดที่นี่ + ใส่ใน ITEM_STATS ถ้าอุปกรณ์ให้ค่านี้) ----------
  // fmt: int = จำนวนเต็ม | dec = ทศนิยม 1 ตำแหน่ง | pct = เปอร์เซ็นต์ | base = ค่าเริ่มต้น | cap = เพดาน
  const STAT_DEFS = {
    hp:        { label: 'HP สูงสุด',          short: 'HP',       fmt: 'int' },
    mp:        { label: 'MP สูงสุด',          short: 'MP',       fmt: 'int' },
    patk:      { label: 'โจมตีกายภาพ',        short: 'โจมตี',    fmt: 'int' },
    ap:        { label: 'พลังเวท',            short: 'พลังเวท',  fmt: 'int' },
    pdef:      { label: 'เกราะกายภาพ',        short: 'เกราะ',    fmt: 'int' },
    mdef:      { label: 'เกราะเวท',           short: 'เกราะเวท', fmt: 'int' },
    aspd:      { label: 'ความเร็วโจมตี',      short: 'ตีเร็ว',   fmt: 'pct', cap: 150 },
    crit:      { label: 'คริติคอล',           short: 'คริ',      fmt: 'pct', cap: 100 },
    critdmg:   { label: 'ความแรงคริติคอล',    short: 'คริแรง',   fmt: 'pct', base: 200, cap: 400 },
    cdr:       { label: 'ลดคูลดาวน์',         short: 'ลดCD',     fmt: 'pct', cap: 40 },
    mspd:      { label: 'ความเร็วเดิน',       short: 'เดินเร็ว', fmt: 'pct', cap: 60 },
    ppen:      { label: 'ทะลุเกราะกายภาพ',    short: 'ทะลุเกราะ', fmt: 'pct', cap: 60, hideZero: true },
    mpen:      { label: 'ทะลุเกราะเวท',       short: 'ทะลุเวท',  fmt: 'pct', cap: 60, hideZero: true },
    lifesteal: { label: 'ดูดเลือดกายภาพ',     short: 'ดูดเลือด', fmt: 'pct', cap: 60, hideZero: true },
    spellvamp: { label: 'ดูดเลือดเวท',        short: 'ดูดเวท',   fmt: 'pct', cap: 60, hideZero: true },
    hpregen:   { label: 'ฟื้น HP/วินาที',      short: 'ฟื้นHP',   fmt: 'dec', hideZero: true },
    mpregen:   { label: 'ฟื้น MP/วินาที',      short: 'ฟื้นMP',   fmt: 'dec', hideZero: true },
    dodge:     { label: 'หลบหลีก',            short: 'หลบ',      fmt: 'pct', cap: 50, hideZero: true },
  };

  // ---------- สเตตัสต่อชิ้นอุปกรณ์ (ค่าต่อ 1 เลเวลไอเทม x (1 + ★ x 0.08 + บวก x 0.05)) ----------
  const ITEM_STATS = {
    weapon: {
      sword:  { patk: 4,   aspd: 0.15, ppen: 0.15 },
      archer: { patk: 3.6, aspd: 0.2,  crit: 0.2 },
      mage:   { ap: 4.5,   cdr: 0.1,   mpen: 0.15 },
      priest: { ap: 4.2,   cdr: 0.1,   mpregen: 0.02 },
      rogue:  { patk: 3.8, crit: 0.2,  critdmg: 0.35 },
    },
    helmet:   { hp: 8, mdef: 1.0 },
    armor:    { hp: 10, pdef: 1.2, hpregen: 0.03 },
    gloves:   { patk: 1.5, ap: 1.5, aspd: 0.15 },
    shoes:    { hp: 4, mspd: 0.25 },
    ring:     { patk: 1.5, ap: 1.5, crit: 0.15 },
    necklace: { mp: 6, hp: 4, cdr: 0.1 },
  };

  // ชุดเกราะอ่อน (item.variant === 'light'): เน้นเกราะเวท/เดินเร็ว/พลังเวท ลดเลือดกับเกราะกายภาพ
  const ITEM_STATS_LIGHT = {
    helmet: { hp: 5, mdef: 1.6, cdr: 0.05 },
    armor:  { hp: 7, pdef: 0.6, mdef: 1.2, mpregen: 0.03 },
    gloves: { patk: 1.2, ap: 2.0, aspd: 0.1 },
    shoes:  { hp: 3, mspd: 0.35 },
  };
  const PLUS_STAT_PER = 0.05;   // ค่าพลังเพิ่มต่อตีบวก +1

  // ---------- ตัวคูณสกิล (RoV: ดาเมจ = ค่าฐาน + ตัวคูณ x สเตตัส) ----------
  // ไม่ใส่ = ใช้ค่ามาตรฐานของสายนั้น (ดาบ/ธนู 100% โจมตีกายภาพ | คทา/พระ 100% พลังเวท)
  // ตัวอย่าง: sw_spin: { patk: 0.8 }   mg_nova: { ap: 0.9, patk: 0.2 }   ulti_mage: { ap: 1.5 }
  const DEFAULT_SCALE = { sword: { patk: 1 }, archer: { patk: 1 }, mage: { ap: 1 }, priest: { ap: 1 } };
  const SKILL_SCALE = {
  };
  const scaleOf = (cls, id) => (window.Classes && window.Classes.scale[id]) || SKILL_SCALE[id] || DEFAULT_SCALE[cls] || { patk: 1 };

  // ---------- ตัวช่วยจัดรูปแบบ ----------
  function fmtStat(k, v) {
    const d = STAT_DEFS[k]; v = Number(v) || 0;
    if (!d) return String(Math.round(v));
    if (d.fmt === 'pct') return (Math.round(v * 10) / 10) + '%';
    if (d.fmt === 'dec') return String(Math.round(v * 10) / 10);
    return String(Math.round(v));
  }
  window.STAT_DEFS = STAT_DEFS;
  window.fmtStat = fmtStat;
  // ข้อความบรรทัดสเตตัสในหน้ารายละเอียดไอเทม (inventoryPanel.js เรียกใช้)
  window.statLine = function (k, v) {
    const d = STAT_DEFS[k];
    return (d ? d.short : k) + ' +' + fmtStat(k, v);
  };

  // ---------- สเตตัสของไอเทม ----------
  function rawItemStats(item) {
    let g;
    if (item.baseSlot === 'weapon') g = ITEM_STATS.weapon[item.class] || ITEM_STATS.weapon.sword;
    else if (item.variant === 'light' && ITEM_STATS_LIGHT[item.baseSlot]) g = ITEM_STATS_LIGHT[item.baseSlot];
    else g = ITEM_STATS[item.baseSlot] || {};
    const tierMul = (typeof tierMultOf === 'function') ? tierMultOf(item) : 1;   // สีของอุปกรณ์ ขาว/ฟ้า/แดง/ทอง
    const mult = (1 + (item.star || 0) * 0.08 + (item.plus || 0) * PLUS_STAT_PER) * tierMul, out = {};
    Object.keys(g).forEach(k => {
      const v = g[k] * item.level * mult;
      const r = (STAT_DEFS[k] && STAT_DEFS[k].fmt === 'int') ? Math.round(v) : Math.round(v * 10) / 10;
      if (r > 0) out[k] = r;
    });
    // ออฟชั่นจากหินสุ่มออฟ (บวกตรงๆ ไม่คูณดาว/บวก/สี)
    (item.opts || []).forEach(o => { if (o && o.k) out[o.k] = (out[o.k] || 0) + (Number(o.v) || 0); });
    return out;
  }
  // ทับของเดิม: คืนสเตตัสใหม่ (atk/def แบบเก่าเก็บไว้เป็นค่าซ่อน เผื่อไฟล์อื่นยังอ่านอยู่)
  window.computeItemStats = function (item) {
    const out = rawItemStats(item);
    Object.defineProperty(out, 'atk', { value: (out.patk || 0) + (out.ap || 0), enumerable: false });
    Object.defineProperty(out, 'def', { value: out.pdef || 0, enumerable: false });
    return out;
  };

  // ---------- ค่ารวมของผู้เล่น ----------
  P.recalcStats = function () {
    const st = this.stats || {}, lv = st.level || 1, out = {};
    Object.keys(STAT_DEFS).forEach(k => { out[k] = STAT_DEFS[k].base || 0; });
    out.hp = st.maxHp || 100; out.mp = st.maxMp || 50;
    out.patk = st.baseAtk || 10; out.ap = st.baseAtk || 10;
    out.pdef = BASE_DEF_PER_LV * lv; out.mdef = BASE_DEF_PER_LV * lv;

    const eq = this.equipment || {};
    EQUIP_SLOT_KEYS.forEach(k => {
      const it = eq[k];
      if (!it) return;
      const s = rawItemStats(it);
      Object.keys(s).forEach(key => { out[key] = (out[key] || 0) + s[key]; });
    });

    const now = this.time ? this.time.now : 0;
    this._statMods = (this._statMods || []).filter(m => m.until > now);
    this._statMods.forEach(m => Object.keys(m.mods).forEach(key => { out[key] = (out[key] || 0) + m.mods[key]; }));

    Object.keys(out).forEach(k => {
      const d = STAT_DEFS[k];
      if (d && d.cap != null && out[k] > d.cap) out[k] = d.cap;
    });
    this._statCache = out; this._statT = now; this._statDirty = false;
    // ค่าเก่าที่ไฟล์อื่นอาจอ่านอยู่
    this.equipHpBonus = out.hp - (st.maxHp || 0);
    this.equipMpBonus = out.mp - (st.maxMp || 0);
    this.equipDefBonus = 0;   // เกราะใหม่คิดในสูตรลดดาเมจแล้ว (ไม่หักซ้ำใน hurtPlayer เดิม)
    return out;
  };

  P.getStats = function () {
    const now = this.time ? this.time.now : 0;
    if (!this._statCache || this._statDirty || now - this._statT > 250) this.recalcStats();
    return this._statCache;
  };

  // บัพ/ดีบัพชั่วคราว: this.addStatBuff('haste', { mspd: 35 }, 12000)
  P.addStatBuff = function (id, mods, ms) {
    this._statMods = (this._statMods || []).filter(m => m.id !== id);
    this._statMods.push({ id: id, mods: mods, until: this.time.now + ms });
    this._statDirty = true;
  };

  P.computeAtk = function () {
    this._statDirty = true;
    this.getStats();
    this.stats.hp = Math.min(this.stats.hp, this.maxHp());
    this.stats.mp = Math.min(this.stats.mp, this.maxMp());
  };
  P.maxHp = function () { return Math.round(this.getStats().hp); };
  P.maxMp = function () { return Math.round(this.getStats().mp); };

  // this.atk: ปกติ = โจมตีกายภาพรวม | ระหว่างร่ายสกิล = ตัวคูณ x สเตตัสของสกิลนั้น (ให้โค้ดสกิลเดิมใช้ได้เลย)
  Object.defineProperty(P, 'atk', {
    configurable: true,
    get: function () {
      const S = this.getStats(), c = this._atkCtx;
      if (!c) return Math.round(S.patk);
      let v = 0;
      Object.keys(c).forEach(k => { v += (S[k] || 0) * c[k]; });
      return Math.round(v);
    },
    set: function () {},
  });

  function withCtx(scene, ratios, fn) {
    const prev = scene._atkCtx;
    scene._atkCtx = ratios;
    try { return fn(); } finally { scene._atkCtx = prev; }
  }
  function applyCdr(scene, key, baseCd) {
    const S = scene.getStats();
    scene.cdEnd[key] = scene.time.now + baseCd * (1 - Math.min(S.cdr, 100) / 100);
  }

  // ---------- ตัวห่อการใช้สกิล: ตัวคูณสเตตัส + ลดคูลดาวน์ + ความเร็วโจมตี ----------
  const _useSkill = P.useSkill;
  P.useSkill = function (idx, gp) {
    const sid = this.slots && this.slots[idx];
    const def = sid && SKILL_DEFS[sid];
    if (!def) return _useSkill.call(this, idx, gp);
    const key = 'slot' + idx, before = this.cdEnd[key];
    const r = withCtx(this, scaleOf(def.class, sid), () => _useSkill.call(this, idx, gp));
    if (this.cdEnd[key] !== before) applyCdr(this, key, def.cd);
    return r;
  };

  const _useUlti = P.useUlti;
  P.useUlti = function (gp) {
    const cls = this.ultiClass;
    if (!cls || !ULTI_DEFS[cls]) return _useUlti.call(this, gp);
    const before = this.cdEnd.ulti;
    const r = withCtx(this, scaleOf(cls, 'ulti_' + cls), () => _useUlti.call(this, gp));
    if (this.cdEnd.ulti !== before) applyCdr(this, 'ulti', ULTI_DEFS[cls].cd);
    return r;
  };

  const _useBasic = P.useBasicAttack;
  P.useBasicAttack = function () {
    const cls = this.currentClass(), def = BASIC_ATTACKS[cls];
    if (!def) return _useBasic.call(this);
    const before = this.cdEnd.basic;
    const r = withCtx(this, scaleOf(cls, 'basic_' + cls), () => _useBasic.call(this));
    if (this.cdEnd.basic !== before) {
      const S = this.getStats();
      this.cdEnd.basic = this.time.now + def.cd / (1 + S.aspd / 100);
    }
    return r;
  };

  // ---------- ชนิดดาเมจ: กายภาพ / เวท ----------
  // กระสุนพกชนิดดาเมจไปด้วย (Number ที่แนบ dtype) ไม่ต้องแก้โค้ดที่ตรวจการชน
  class DmgPacket extends Number {
    constructor(v, t) { super(v); this.dtype = t; }
  }

  const _apply = P.applySkillEffect;
  P.applySkillEffect = function (def, x, y, fx, fy, dmg, kind) {
    const type = MAGIC_CLASSES[kind] ? 'magic' : 'physical';
    const prev = this._hitCtx;
    this._hitCtx = { type: type };
    const before = (def.type === 'proj' && this.projectiles) ? new Set(this.projectiles.getChildren()) : null;
    try {
      return _apply.call(this, def, x, y, fx, fy, dmg, kind);
    } finally {
      this._hitCtx = prev;
      if (before) {
        this.projectiles.getChildren().forEach(pr => {
          if (before.has(pr)) return;
          const d = pr.getData('dmg');
          if (!(d instanceof DmgPacket)) pr.setData('dmg', new DmgPacket(d, type));
        });
      }
    }
  };

  P.statPop = function (x, y, str, color) {
    const t = this.add.text(x, y, str, { fontSize: '14px', color: color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(200);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  };

  function vampHeal(scene, amount) {
    if (!(scene.stats.hp > 0)) return;
    scene._vampAcc = (scene._vampAcc || 0) + amount;
    if (scene._vampAcc >= 1) {
      const whole = Math.floor(scene._vampAcc);
      scene._vampAcc -= whole;
      scene.stats.hp = Math.min(scene.maxHp(), scene.stats.hp + whole);
    }
  }

  // ---------- ดาเมจที่ผู้เล่นทำกับมอน: เกราะมอน + ทะลุเกราะ + คริติคอล + ดูดเลือด ----------
  const _damage = P.damage;
  P.damage = function (e, dmg) {
    if (!e || !e.active) return;
    let type = 'physical';
    if (dmg instanceof DmgPacket) type = dmg.dtype;
    else if (this._hitCtx) type = this._hitCtx.type;

    const S = this.getStats();
    const mobDef = (e.level || 1) * MOB_DEF_PER_LV * (e.isBoss ? BOSS_DEF_MULT : 1) * (window.enemyDefMul ? window.enemyDefMul(e) : 1);
    const pen = Math.min(type === 'magic' ? S.mpen : S.ppen, 100);
    const effDef = mobDef * (1 - pen / 100);
    const red = effDef / (effDef + DEF_K_BASE + DEF_K_PER_LV * this.stats.level);

    let final = Number(dmg) * (1 - red);
    const crit = Math.random() * 100 < S.crit;
    if (crit) final *= S.critdmg / 100;
    final = Math.max(1, Math.round(final));

    const px = e.x, py = e.y;
    _damage.call(this, e, final);

    const vamp = type === 'magic' ? S.spellvamp : S.lifesteal;
    if (vamp > 0) vampHeal(this, final * vamp / 100);
    if (crit) this.statPop(px, py - 38, 'คริติคอล!', '#ff6a5a');
  };

  // ---------- ดาเมจที่ผู้เล่นโดน: เกราะกายภาพ/เกราะเวท ----------
  const _hurt = P.hurtPlayer;
  P.hurtPlayer = function (raw) {
    const type = raw instanceof DmgPacket ? raw.dtype : 'physical';
    const S = this.getStats();
    if (S.dodge > 0 && Math.random() * 100 < S.dodge) {   // หลบหลีก: ไม่โดนดาเมจ
      if (this.player) this.statPop(this.player.x, this.player.y - 40, 'หลบ!', '#9be7ff');
      return;
    }
    const def = type === 'magic' ? S.mdef : S.pdef;
    const red = def / (def + DEF_K_BASE + DEF_K_PER_LV * this.stats.level);
    return _hurt.call(this, Math.max(1, Math.round(Number(raw) * (1 - red))));
  };

  // สไลม์ยิงไกลยิงกระสุนเวท
  const _shoot = P.enemyShoot;
  P.enemyShoot = function (e) {
    const prev = this.enemyShots ? new Set(this.enemyShots.getChildren()) : null;
    _shoot.call(this, e);
    if (!this.enemyShots) return;
    this.enemyShots.getChildren().forEach(sh => {
      if (prev && prev.has(sh)) return;
      const d = sh.getData('dmg');
      if (!(d instanceof DmgPacket)) sh.setData('dmg', new DmgPacket(d, 'magic'));
    });
  };

  // ---------- ความเร็วเดิน + ฟื้น HP/MP ----------
  const _um = P.updateMovement;
  P.updateMovement = function () {
    _um.call(this);
    const S = this.getStats();
    if (S.mspd > 0 && this.player && this.player.body) {
      const m = 1 + S.mspd / 100, v = this.player.body.velocity;
      this.player.setVelocity(v.x * m, v.y * m);
    }
  };

  const _usb = P.updateSkillButtons;
  P.updateSkillButtons = function (time) {
    _usb.call(this, time);
    if (!this.stats) return;
    if (!this._regenT) { this._regenT = time; return; }
    if (time - this._regenT < 1000) return;
    this._regenT = time;
    const S = this.getStats(), st = this.stats;
    if (st.hp > 0 && st.hp < this.maxHp() && S.hpregen > 0) st.hp = Math.min(this.maxHp(), st.hp + S.hpregen);
    if (st.mp < this.maxMp() && S.mpregen > 0) st.mp = Math.min(this.maxMp(), st.mp + S.mpregen);
  };

  // ---------- หน้าต่างสเตตัส + คำอธิบายสกิล ----------
  function skillInfo(sid, lv, S) {
    const def = SKILL_DEFS[sid];
    if (!def || def.type === 'haste' || def.noInfo) return null;
    const sc = scaleOf(def.class, sid);
    const base = Math.round(def.dmg * skillLvMul(lv));
    let stat = 0; const parts = [];
    Object.keys(sc).forEach(k => {
      stat += (S[k] || 0) * sc[k];
      parts.push(Math.round(sc[k] * 100) + '% ' + STAT_DEFS[k].short);
    });
    const cd = (def.cd * (1 - Math.min(S.cdr, 100) / 100) / 1000).toFixed(1) + 's';
    const total = base + stat;
    if (def.type === 'heal1' || def.type === 'healaoe') {
      return 'ฟื้นฟู ≈' + Math.round(total * def.heal) + ' HP (' + parts.join(' + ') + ') • คูลดาวน์ ' + cd;
    }
    return 'ดาเมจ ' + base + ' + ' + parts.join(' + ') + ' (≈' + Math.round(total) + ') • คูลดาวน์ ' + cd;
  }

  function installHook() {
    if (!window.PixelPanels || !PixelPanels.addDataHook) return false;
    PixelPanels.addDataHook(function (d) {
      const sc = window.__mainScene;
      if (!sc || !sc.stats || !sc.getStats) return d;
      const S = sc.getStats();

      const stats = {};
      Object.keys(STAT_DEFS).forEach(k => {
        if (k === 'hp' || k === 'mp') return;   // HP/MP แสดงอยู่แถวบนแล้ว
        if (STAT_DEFS[k].hideZero && !S[k]) return;
        stats[STAT_DEFS[k].label] = fmtStat(k, S[k]);
      });
      stats['ทอง'] = sc.stats.gold;
      stats['ฆ่าแล้ว'] = sc.kills;

      const fix = list => (list || []).map(s => {
        const t = s.sid && skillInfo(s.sid, typeof s.lv === 'number' ? s.lv : 1, S);
        return t ? Object.assign({}, s, { info: t }) : s;
      });
      return Object.assign({}, d, { stats: stats, skills: fix(d.skills), specialSkills: fix(d.specialSkills) });
    });
    return true;
  }
  if (!installHook()) {
    const t = setInterval(function () { if (installHook()) clearInterval(t); }, 200);
  }
})();
