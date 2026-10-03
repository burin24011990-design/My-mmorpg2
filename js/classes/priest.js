// ===== สายพระ (Priest): ฮีลเดี่ยว / แสงพิพากษา / พรแห่งลม / ฮีลหมู่ + อัลติแสงสวรรค์ =====
// โหลดหลัง aimDash.js และก่อน main.js
(function () {
  const P = Main.prototype;

  // ---- ตั้งค่า ----
  const TEST_UNLOCK = true;   // true = ปลดล็อกสกิลพระทุกตัวทันทีเพื่อทดสอบ (เสร็จแล้วเปลี่ยนเป็น false ให้ได้จากหนังสือสกิล)
  const GREEN = 0x7dff9a, GOLD = 0xfff2a8, CYAN = 0x9fe8ff;

  // คลาสพระ (ซ่อนจากการวนลูป CLASSES เพื่อไม่ให้ระบบดรอปอาวุธ/ของเดิมสับสน)
  try {
    Object.defineProperty(CLASSES, 'priest', {
      value: Object.assign({}, CLASSES.mage || {}, { color: 0xf5d76e, name: 'พระ', label: 'พระ' }),
      enumerable: false, writable: true, configurable: true,
    });
  } catch (e) { console.error('priest class', e); }

  // ---- ข้อมูลสกิล (ปรับตัวเลขได้ตรงนี้) ----
  // dmg = พลังฐานของสกิล (ฮีล = (dmg x เลเวล + พลังโจมตี) x heal) | range = ระยะฮีลเดี่ยว / รัศมีวง
  // ฮีลหมู่: atkMul = พลังโจมตีรวม (1.2 = +20%) | atkMs = เวลาบัพพลังโจมตี (ms) | regen = รีเจนเลือดต่อวินาที (0.015 = 1.5% ของเลือดสูงสุด) | buffDur = เวลารีเจนเลือด (ms)
  // พรแห่งลม: mul = ความเร็วเดิน (1.35 = +35%) | aspd = ความเร็วโจมตี (1.3 = ตีไวขึ้น 30%) | dur = เวลาบัพ (ms)
  SKILL_DEFS.pr_heal      = { name: 'ฮีลเดี่ยว',   class: 'priest', dmg: 24, range: 260, cd: 3000,  mp: 14, type: 'heal1',  heal: 2.5 };
  SKILL_DEFS.pr_smite     = { name: 'แสงพิพากษา', class: 'priest', dmg: 20, range: 130, cd: 3000,  mp: 18, type: 'holy' };
  SKILL_DEFS.pr_haste     = { name: 'พรแห่งลม',   class: 'priest', dmg: 0,  range: 320, cd: 25000, mp: 20, type: 'haste',  dur: 12000, mul: 1.35, aspd: 1.3 };
  SKILL_DEFS.pr_mass_heal = { name: 'ฮีลหมู่',      class: 'priest', dmg: 16, range: 150, cd: 8000,  mp: 28, type: 'healaoe', heal: 2.5, atkMul: 1.2, atkMs: 5000, regen: 0.015, buffDur: 10000 };
  ULTI_DEFS.priest        = { name: 'แสงสวรรค์',  dmg: 70, range: 190, cd: ULTI_CD, mp: 50, type: 'pulti', heal: 2 };
  const PRIEST_IDS = ['pr_heal', 'pr_smite', 'pr_haste', 'pr_mass_heal'];

  // ลงทะเบียนสกิลลากเล็งกับ aimDash.js (self = แตะเฉย ๆ ลงที่ตัวเอง ไม่ล็อกมอน)
  function register() {
    if (window.GROUND_CFG) {
      window.GROUND_CFG.pr_smite = { cast: 320 };
      window.GROUND_CFG.pr_mass_heal = { cast: 300, self: true };
    }
    if (window.GROUND_ULTI) window.GROUND_ULTI.priest = { cast: 300, self: true };
  }
  register();

  // ---------- ไอคอน ----------
  const ICON_OF = { heal1: 'ic_heal', healaoe: 'ic_heal', holy: 'ic_holy', pulti: 'ic_holy', haste: 'ic_haste' };
  const _sik = skillIconKey;
  skillIconKey = function (type) { return ICON_OF[type] || _sik(type); };

  function makeIcon(scene, key, draw) {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, 32, 32);
    draw(t.getContext());
    t.refresh();
  }
  function makeIcons(scene) {
    makeIcon(scene, 'ic_heal', g => { g.fillStyle = '#fff'; g.fillRect(12, 4, 8, 24); g.fillRect(4, 12, 24, 8); });
    makeIcon(scene, 'ic_holy', g => {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 7, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        g.beginPath(); g.moveTo(16 + Math.cos(a) * 10, 16 + Math.sin(a) * 10);
        g.lineTo(16 + Math.cos(a) * 15, 16 + Math.sin(a) * 15); g.stroke();
      }
    });
    makeIcon(scene, 'ic_haste', g => {
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
      [4, 15].forEach(x => { g.beginPath(); g.moveTo(x, 6); g.lineTo(x + 10, 16); g.lineTo(x, 26); g.stroke(); });
    });
  }

  // ---------- ตัวช่วย ----------
  P.popText = function (x, y, str, color) {
    const t = this.add.text(x, y, str, { fontSize: '16px', color: color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5).setDepth(200);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  };

  P.healPlayer = function (amount) {
    const before = this.stats.hp;
    this.stats.hp = Math.min(this.maxHp(), before + amount);
    const got = Math.round(this.stats.hp - before);
    this.popText(this.player.x, this.player.y - 30, '+' + got, '#7dff9a');
  };

  // บัพพลังโจมตี + รีเจนเลือด (จากฮีลหมู่) | ร่ายซ้ำ = รีเฟรชเวลา ไม่ซ้อนกัน
  P.applyBless = function (def) {
    if (!def.buffDur) return;
    const now = this.time.now;
    this.buffs = this.buffs || {};
    const atkMs = def.atkMs || def.buffDur;
    this.buffs.bless = { until: now + def.buffDur, atkUntil: now + atkMs, atkMul: def.atkMul || 1, regen: def.regen || 0, next: now + 1000 };
    this.toastMsg('✨ พลังโจมตี +' + Math.round(((def.atkMul || 1) - 1) * 100) + '% นาน ' + (atkMs / 1000) + ' วิ • รีเจนเลือด นาน ' + (def.buffDur / 1000) + ' วิ');
  };

  // ---------- เอฟเฟกต์สกิล ----------
  // ตอนนี้ฮีล/บัพมีผลกับผู้เล่นเอง | ผู้เล่นคนอื่นต้องเชื่อม network.js: ฟังอีเวนต์ this.events.on('priest-team', ...)
  const HANDLERS = {
    heal1(def, x, y, dmg) {
      const p = this.player;
      this.healPlayer(Math.round(dmg * def.heal));
      this.flash(p.x, p.y, 36, GREEN);
      this.events.emit('priest-team', { type: 'heal', x: p.x, y: p.y, r: def.range, amount: Math.round(dmg * def.heal) });
    },
    healaoe(def, x, y, dmg) {
      const p = this.player, amt = Math.round(dmg * def.heal);
      this.flash(x, y, def.range, GREEN);
      this.time.delayedCall(120, () => this.flash(x, y, def.range * 0.6, 0xffffff));
      if (Phaser.Math.Distance.Between(x, y, p.x, p.y) <= def.range) {
        this.healPlayer(amt);
        this.applyBless(def);   // ใครอยู่ในวง ได้ทั้งฮีล + บัพพลังโจมตี + รีเจนเลือด
      }
      this.events.emit('priest-team', {
        type: 'heal', x: x, y: y, r: def.range, amount: amt,
        buff: { atkMul: def.atkMul, regen: def.regen, dur: def.buffDur },
      });
    },
    holy(def, x, y, dmg) {
      this.flash(x, y, def.range, GOLD);
      this.time.delayedCall(120, () => this.flash(x, y, def.range * 0.6, 0xffffff));
      this.enemies.getChildren().slice().forEach(e => {
        if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < def.range) this.damage(e, dmg);
      });
    },
    haste(def, x, y, dmg) {
      const p = this.player;
      this.buffs = this.buffs || {};
      this.buffs.haste = { until: this.time.now + def.dur, mul: def.mul, aspd: def.aspd || 1 };
      this.flash(p.x, p.y, 60, CYAN);
      this.toastMsg('⚡ ความเร็ว +' + Math.round((def.mul - 1) * 100) + '%'
        + (def.aspd > 1 ? ' โจมตีไว +' + Math.round((def.aspd - 1) * 100) + '%' : '')
        + ' นาน ' + (def.dur / 1000) + ' วิ');
      this.events.emit('priest-team', { type: 'haste', x: p.x, y: p.y, r: def.range, dur: def.dur, mul: def.mul, aspd: def.aspd });
    },
    pulti(def, x, y, dmg) {
      const p = this.player, amt = Math.round(dmg * def.heal);
      this.flash(x, y, def.range, GOLD);
      this.time.delayedCall(120, () => this.flash(x, y, def.range * 0.6, 0xffffff));
      this.enemies.getChildren().slice().forEach(e => {
        if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < def.range) this.damage(e, dmg);
      });
      if (Phaser.Math.Distance.Between(x, y, p.x, p.y) <= def.range) this.healPlayer(amt);
      this.events.emit('priest-team', { type: 'heal', x: x, y: y, r: def.range, amount: amt });
    },
  };

  // สกิลที่มาจากผู้เล่นคนอื่น (ไม่ได้กดเอง) แสดงแค่เอฟเฟกต์ ไม่ฮีล/บัพ/ทำดาเมจให้เราโดยผิดพลาด
  function visualOnly(scene, def, x, y) {
    const col = (def.type === 'holy' || def.type === 'pulti') ? GOLD : def.type === 'haste' ? CYAN : GREEN;
    scene.flash(x, y, (def.type === 'heal1' || def.type === 'haste') ? 36 : def.range, col);
  }

  const _apply = P.applySkillEffect;
  P.applySkillEffect = function (def, x, y, fx, fy, dmg, kind) {
    const h = HANDLERS[def.type];
    if (!h) return _apply.call(this, def, x, y, fx, fy, dmg, kind);
    const now = this.time.now;
    const match = e => e.def === def || (e.def.name === def.name && e.def.range === def.range);
    this._plocal = (this._plocal || []).filter(e => now - e.t < 1500);
    const li = this._plocal.findIndex(match);
    if (li < 0) { visualOnly(this, def, x, y); return; }
    this._plocal.splice(li, 1);
    const q = this._groundQ;   // จุดที่ลากเล็งจาก aimDash.js
    if (q && q.length) {
      const i = q.findIndex(match);
      if (i >= 0) { const e = q.splice(i, 1)[0]; x = e.x; y = e.y; }
    }
    h.call(this, def, x, y, dmg);
  };

  function markLocal(scene, def) {
    const now = scene.time.now;
    scene._plocal = (scene._plocal || []).filter(e => now - e.t < 1500);
    scene._plocal.push({ def: def, t: now });
  }

  // ---------- ตัวเรียกใช้สกิล (กติกาบอท + จดว่ากดเอง) ----------
  const _useSkill = P.useSkill;
  P.useSkill = function (idx, gp) {
    const sid = this.slots && this.slots[idx];
    const def = sid && SKILL_DEFS[sid];
    if (!def || def.class !== 'priest') return _useSkill.call(this, idx, gp);

    const cfg = window.GROUND_CFG && window.GROUND_CFG[sid];
    if (this._inBotGround && cfg && cfg.self) return;   // บอทอย่ายิงสกิลฮีลลงที่มอน
    if (this.autoMode) {
      const hpR = this.stats.hp / this.maxHp();
      const now = this.time.now, bs = this.buffs && this.buffs.bless;
      if (def.type === 'heal1' && hpR > 0.75) return;
      // ฮีลหมู่: บอทร่ายเมื่อเลือดต่ำ หรือเมื่อบัพพลังโจมตีหมดแล้ว
      if (def.type === 'healaoe' && hpR > 0.75 && bs && now < bs.atkUntil) return;
      if (def.type === 'haste' && this.buffs && this.buffs.haste && now < this.buffs.haste.until) return;
    }
    const key = 'slot' + idx, before = this.cdEnd[key];
    const r = _useSkill.call(this, idx, gp);
    if (this.cdEnd[key] !== before) markLocal(this, def);
    return r;
  };

  const _useUlti = P.useUlti;
  P.useUlti = function (gp) {
    if (this.ultiClass !== 'priest') return _useUlti.call(this, gp);
    const cfg = window.GROUND_ULTI && window.GROUND_ULTI.priest;
    if (this._inBotGround && cfg && cfg.self) return;
    const before = this.cdEnd.ulti;
    const r = _useUlti.call(this, gp);
    if (this.cdEnd.ulti !== before) markLocal(this, ULTI_DEFS.priest);
    return r;
  };

  // จุดตกเริ่มต้นของสกิลแบบ self = ที่ตัวเอง
  const _gd = P.groundDefault;
  if (_gd) {
    P.groundDefault = function (cfg) {
      if (cfg && cfg.self) return { x: this.player.x, y: this.player.y };
      return _gd.call(this, cfg);
    };
  }

  // กันบอทยิงสกิลแบบ self ลงที่มอนตอนล็อกเป้าจากระยะไกล
  const _bgc = P.botGroundCasts;
  if (_bgc) {
    P.botGroundCasts = function () {
      this._inBotGround = true;
      try { return _bgc.call(this); } finally { this._inBotGround = false; }
    };
  }

  // ---------- บัพความเร็วเดิน ----------
  const _um = P.updateMovement;
  P.updateMovement = function () {
    _um.call(this);
    const b = this.buffs && this.buffs.haste;
    if (b && this.time.now < b.until && this.player && this.player.body) {
      const v = this.player.body.velocity;
      this.player.setVelocity(v.x * b.mul, v.y * b.mul);
    }
  };

  // ---------- บัพพลังโจมตี: คูณดาเมจที่ตีโดนมอนทุกชนิด (โจมตีธรรมดา + สกิล + ลูกยิง) ----------
  // ครอบฟังก์ชัน damage ของ scene (ไม่ยุ่งกับค่า atk ที่ระบบสเตตัสคำนวณอยู่)
  function installDamageHook(scene) {
    if (typeof scene.damage !== 'function' || scene.damage._prWrapped) return;
    const orig = scene.damage;
    const wrapped = function (e, dmg) {
      const bl = this.buffs && this.buffs.bless;
      if (bl && this.time.now < bl.atkUntil && typeof dmg === 'number' && e && e !== this.player) {
        const a = Array.prototype.slice.call(arguments);
        a[1] = Math.round(dmg * bl.atkMul);
        return orig.apply(this, a);
      }
      return orig.apply(this, arguments);
    };
    wrapped._prWrapped = true;
    scene.damage = wrapped;
  }

  // ---------- ตัวอัปเดตบัพทุกเฟรม: รีเจนเลือด + ความเร็วโจมตี ----------
  function tickBuffs(scene) {
    const now = scene.time.now;
    // รีเจนเลือด: ฟื้นทุก 1 วินาที เป็น % ของเลือดสูงสุด
    const bl = scene.buffs && scene.buffs.bless;
    if (bl && now < bl.until && now >= bl.next) {
      bl.next = now + 1000;
      if (scene.stats && scene.stats.hp > 0 && bl.regen > 0) {
        scene.healPlayer(Math.max(1, Math.round(scene.maxHp() * bl.regen)));
      }
    }
    // ความเร็วโจมตี: ตอนโจมตีธรรมดาครั้งใหม่ ย่นเวลาคูลดาวน์ลงตาม aspd
    const cd = scene.cdEnd;
    if (cd && cd.basic !== scene._prBasicSeen) {
      const hs = scene.buffs && scene.buffs.haste;
      if (hs && now < hs.until && hs.aspd > 1 && cd.basic > now) {
        cd.basic = now + (cd.basic - now) / hs.aspd;
      }
      scene._prBasicSeen = cd.basic;
    }
  }

  const _setupButtons = P.setupButtons;
  P.setupButtons = function () {
    _setupButtons.call(this);
    register();
    makeIcons(this);
    installDamageHook(this);
    this.buffText = this.add.text(W / 2, 62, '', { fontSize: '12px', color: '#9fe8ff', align: 'center' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
  };

  const _usb = P.updateSkillButtons;
  P.updateSkillButtons = function (time) {
    _usb.call(this, time);
    tickBuffs(this);
    if (!this.buffText) return;
    const b = this.buffs && this.buffs.haste, bl = this.buffs && this.buffs.bless;
    const lines = [];
    if (b && time < b.until) {
      lines.push('⚡ ความเร็ว +' + Math.round((b.mul - 1) * 100) + '%'
        + (b.aspd > 1 ? ' โจมตีไว +' + Math.round((b.aspd - 1) * 100) + '%' : '')
        + ' (' + Math.ceil((b.until - time) / 1000) + 's)');
    }
    if (bl && time < bl.until) {
      const atkOn = time < bl.atkUntil;
      lines.push('✨ ' + (atkOn ? 'พลังโจมตี +' + Math.round((bl.atkMul - 1) * 100) + '% (' + Math.ceil((bl.atkUntil - time) / 1000) + 's) ' : '')
        + 'รีเจนเลือด (' + Math.ceil((bl.until - time) / 1000) + 's)');
    }
    this.buffText.setText(lines.join('\n'));
  };

  // ปลดล็อกเพื่อทดสอบ
  const _isd = P.initSkillData;
  P.initSkillData = function () {
    const r = _isd.apply(this, arguments);
    if (TEST_UNLOCK && this.learnedSkills) {
      PRIEST_IDS.forEach(id => {
        this.learnedSkills.add(id);
        if (this.skillLv && !this.skillLv[id]) this.skillLv[id] = 1;
      });
    }
    return r;
  };

  // ---------- ข้อความอธิบายสกิลในหน้าต่างสกิล ----------
  function infoFor(sid, lv) {
    const d = SKILL_DEFS[sid], sc = window.__mainScene;
    const pw = Math.round(d.dmg * skillLvMul(lv) + (sc && sc.atk ? sc.atk : 0));
    const cd = ' • คูลดาวน์ ' + (d.cd / 1000).toFixed(1) + 's';
    if (d.type === 'heal1') return 'ฟื้นฟู ' + Math.round(pw * d.heal) + ' HP' + cd;
    if (d.type === 'healaoe') {
      return 'ฟื้นฟู ' + Math.round(pw * d.heal) + ' HP • พลังโจมตี +' + Math.round(((d.atkMul || 1) - 1) * 100)
        + '% นาน ' + ((d.atkMs || d.buffDur || 0) / 1000) + ' วิ • รีเจนเลือด ' + ((d.regen || 0) * 100).toFixed(1) + '%/วิ นาน ' + ((d.buffDur || 0) / 1000) + ' วิ' + cd;
    }
    if (d.type === 'haste') {
      return 'ความเร็ว +' + Math.round((d.mul - 1) * 100) + '%'
        + (d.aspd > 1 ? ' • โจมตีไว +' + Math.round((d.aspd - 1) * 100) + '%' : '')
        + ' นาน ' + (d.dur / 1000) + ' วิ' + cd;
    }
    if (d.type === 'holy') return 'ดาเมจแสง ' + pw + cd;
    return null;
  }
  function installHook() {
    if (!window.PixelPanels || !PixelPanels.addDataHook) return false;
    PixelPanels.addDataHook(function (d) {
      const fix = list => (list || []).map(s => {
        const def = s.sid && SKILL_DEFS[s.sid];
        if (!def || def.class !== 'priest') return s;
        const t = infoFor(s.sid, typeof s.lv === 'number' ? s.lv : 1);
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
