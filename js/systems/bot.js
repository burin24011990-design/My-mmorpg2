// ===== บอทออโต้: หน้าต่างตั้งค่า + ตรรกะ =====
// ลำดับความสำคัญของบอท:
//   0) ดูแลเลือด (ดื่มยา / สกิลฮีล) ทำงานคู่ไปกับทุกขั้นตอน
//   1) หนีมินิบอส (ถ้าติ๊ก)   2) ถ้ามีมอนไล่ตีอยู่ ให้สู้ก่อน   3) เก็บของที่อยู่ใกล้ตัว
//   4) โจมตีเป้าที่เลือก   5) เดินหามอนที่ตีได้
// โหลดไฟล์นี้ต่อจาก input.js / ui.js / panels.js (ทับ updateAuto เดิมโดยอัตโนมัติ)
// ใหม่ (v34): เปิดกระเป๋าแล้วบอทสู้ต่อได้ (ดู botBagTick ด้านล่าง) และบอทกดยาเลือดได้แม้ปุ่มยาถูกซ่อนตอนเปิดกระเป๋า
// ใหม่ (v35): แก้ botIsHeal -- สกิลโจมตีที่มีดูดเลือด/ฟื้นเลือด (เช่น ฟันตัดเอ็น) ไม่ถูกนับเป็นสกิลฮีลอีกต่อไป
//             (ไม่มีปุ่ม "ตลอด" และตัวปรับ % เลือด ใช้เหมือนสกิลโจมตีทั่วไป)

// ตั้งค่าแยกตามด่าน
const BOT_DEFAULT = { normal: true, ranged: true, boss: false, flee: true };
// ตั้งค่ารวมทุกด่าน (สกิล / เลือด) เก็บใน botCfg.g
const BOT_GLOBAL_DEFAULT = {
  useUlti: true,
  skillOn: { 0: true, 1: true, 2: true, 3: true },   // ใช้สกิลช่องไหนบ้าง
  always: { 0: false, 1: false, 2: false, 3: false },  // ช่องนี้ใช้ "ตลอด" ทุกครั้งที่พร้อม (เฉพาะสกิลวาป/ฮีล)
  healAt: { 0: 50, 1: 50, 2: 50, 3: 50 },            // สกิลฮีลช่องนั้น ฮีลเมื่อ HP เหลือ <= กี่ %
  autoHp: true,                                       // ดื่มยาเลือดอัตโนมัติ
  hpPct: 50,                                          // ดื่มยาเมื่อ HP เหลือ <= กี่ %
};

const BOT_FLEE_DIST = 330;    // ระยะที่เริ่มหนีบอส (บอสไล่ตามที่ 220)
const BOT_FLEE_EXTRA = 120;   // หนีจนห่างเกินระยะนี้ + BOT_FLEE_DIST ถึงจะหยุดหนี (กันกระตุก)
const BOT_AVOID_DIST = 380;   // ไม่เก็บของ/ไม่เลือกเป้าที่อยู่ใกล้บอสที่ต้องหลบ
const BOT_LOOT_RANGE = 450;   // เก็บของเฉพาะที่อยู่ในระยะนี้จากตัวผู้เล่น (เดิม 200 | ปรับตรงนี้)
const BOT_ATTACKER_RANGE = 400; // มอนที่กำลังไล่ตีและอยู่ในระยะนี้ = กำลังโดนโจมตี
const BOT_SPEED = 190;
const BOT_WARP_DIST = 180;    // ระยะวาปโดยประมาณ ถ้าสกิลไม่ระบุ range/dist เอง
const BOT_WARP_MIN_MP = 40;   // วาปเพื่อเดินทาง เฉพาะตอน MP เหลือมากกว่า % นี้ (เก็บ MP ไว้โจมตี) | วาปหนีบอสไม่จำกัด

// สกิลที่ "ไม่ใช่ฮีล" แน่นอน (บังคับให้เป็นสกิลโจมตี) -- ถ้ามีสกิลอื่นโดนนับเป็นฮีลผิด ให้เพิ่มคำในชื่อสกิลตรงนี้ หรือเพิ่ม id ใน BOT_NOT_HEAL_IDS
const BOT_NOT_HEAL_NAMES = /ตัดเอ็น/;
const BOT_NOT_HEAL_IDS = {};   // เช่น { rg_tendon: true }

// อาวุธ/คลาสใหม่ที่ยังไม่ได้ลงทะเบียนใน BASIC_ATTACKS จะไม่ทำให้บอทค้าง: ใช้ค่าของดาบแทนไปก่อน
const _botWarned = {};
function botAtk(cls) {
  const tbl = (typeof BASIC_ATTACKS !== 'undefined') ? BASIC_ATTACKS : null;
  if (tbl && tbl[cls]) return tbl[cls];
  if (!_botWarned[cls]) {
    _botWarned[cls] = true;
    console.warn('[bot] คลาส/อาวุธ "' + cls + '" ยังไม่มีใน BASIC_ATTACKS (ใช้ค่าของดาบแทน) กรุณาเพิ่มให้ครบ');
  }
  return (tbl && tbl.sword) || { range: 70, type: 'melee' };
}

// สกิลนี้เป็นสกิลฮีลหรือไม่ (เดาจากข้อมูลใน SKILL_DEFS -- ถ้าไม่ตรงกับเกมจริง แก้ตรงนี้ที่เดียว)
// หมายเหตุ: ไม่ดูจาก id สกิลแล้ว เพราะ pr_heal (พลังแห่งแสง) ถูกเปลี่ยนเป็นสกิลโจมตี แต่ id ยังมีคำว่า heal
// v35: สกิลที่แค่ "ฟื้นเลือดตอนโจมตี" (มีฟิลด์ heal แต่มีค่าดาเมจด้วย) ถือเป็นสกิลโจมตี ไม่ใช่สกิลฮีล
function botIsHeal(sid) {
  const d = (typeof SKILL_DEFS !== 'undefined') ? SKILL_DEFS[sid] : null;
  if (!d) return false;
  // บังคับว่าไม่ใช่ฮีล (ฟันตัดเอ็น ฯลฯ)
  if (BOT_NOT_HEAL_IDS[sid] || BOT_NOT_HEAL_NAMES.test(String(d.name || ''))) return false;
  // สกิลโจมตีที่รู้ชนิดแน่นอน ไม่ใช่ฮีล
  const atkTypes = ['lightbeam', 'holy', 'melee', 'proj', 'dash'];
  const t = String(d.type || d.kind || d.effect || '').toLowerCase();
  if (atkTypes.indexOf(t) >= 0) return false;
  // ชนิดหรือชื่อเป็นฮีลชัดเจน
  if (t.indexOf('heal') >= 0) return true;
  if (/heal|ฮิล|ฮีล|รักษา/i.test(String(d.name || ''))) return true;
  // มีฟิลด์ฮีล: ถ้าสกิลนี้มีค่าดาเมจด้วย = สกิลโจมตีที่ดูดเลือด ไม่ใช่สกิลฮีล
  if (d.heal || d.healAmt || d.healPct) {
    const hasDmg = !!(d.dmg || d.damage || d.mul || d.atk || d.power || d.hits || d.coef);
    return !hasDmg;
  }
  return false;
}

// สกิลนี้เป็นสกิลวาป/เทเลพอร์ตหรือไม่ (เดาจากข้อมูลใน SKILL_DEFS -- ถ้าไม่ตรงกับเกมจริง แก้ตรงนี้ที่เดียว)
function botIsWarp(sid) {
  const d = (typeof SKILL_DEFS !== 'undefined') ? SKILL_DEFS[sid] : null;
  if (!d) return false;
  if (d.warp || d.blink || d.teleport) return true;
  const t = String(d.type || d.kind || d.effect || '').toLowerCase();
  if (/warp|blink|teleport/.test(t)) return true;
  return /warp|blink|teleport|วาป|วูป|เทเลพอร์ต/i.test(String(sid) + ' ' + String(d.name || ''));
}

// ระยะจากจุด (px,py) ถึงเส้นตรง (x1,y1)-(x2,y2)
function botSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// aimDash.js มีบอทยิงสกิลวางพื้น (ลูกไฟ/ธารน้ำแข็ง/ฝนลูกศร) ของตัวเอง ซึ่งไม่สนช่องติ๊กสกิลและยิงแม้ตอนกำลังหนีบอส
// แทนที่ด้วยเวอร์ชันที่เคารพการตั้งค่าบอท (เรียกครั้งเดียวตอนสร้างฉาก หลังทุกไฟล์โหลดครบแล้ว)
function botPatchGroundCasts() {
  const P = Main.prototype;
  if (P._botGCPatched || !P.botGroundCasts) return;
  P._botGCPatched = true;
  P.botGroundCasts = function () {
    if (this.botFleeing) return;                       // กำลังหนีบอส ห้ามหยุดยิง
    const t = this.target && this.target.active ? this.target : null;
    if (!t) return;
    const g = this.botGlobal(), GC = window.GROUND_CFG || {}, GU = window.GROUND_ULTI || {};
    const p = this.player, now = this.time.now, d = Phaser.Math.Distance.Between(p.x, p.y, t.x, t.y);

    (this.slots || []).forEach((sid, i) => {
      const cfg = sid && GC[sid];
      if (!cfg || !g.skillOn[i] || botIsHeal(sid) || botIsWarp(sid) || d > cfg.cast) return;
      if (now < (this.cdEnd['slot' + i] || 0)) return;
      if (this.stats.mp < SKILL_DEFS[sid].mp) return;
      this.useSkill(i, { x: t.x, y: t.y });
    });

    const uc = this.ultiClass, ucfg = uc && GU[uc];
    if (g.useUlti && ucfg && d <= ucfg.cast && now >= (this.cdEnd.ulti || 0) && this.stats.mp >= ULTI_DEFS[uc].mp) {
      let n = 0;
      this.enemies.getChildren().forEach(e => {
        if (e.active && Phaser.Math.Distance.Between(e.x, e.y, t.x, t.y) < ULTI_DEFS[uc].range) n++;
      });
      if (t.isBoss || n >= 3) this.useUlti({ x: t.x, y: t.y });
    }
  };
}

// ---- ต่อท้ายฟังก์ชันเดิม (ไม่ต้องแก้ไฟล์อื่น) ----
(function () {
  const _setupButtons = Main.prototype.setupButtons;
  Main.prototype.setupButtons = function () {
    _setupButtons.call(this);
    botPatchGroundCasts();
    // ตัวช่วยให้บอททำงานต่อตอนเปิดกระเป๋า (ทำงานหลังจบ update ทุกเฟรม ดู botBagTick)
    this.events.off('postupdate', this.botBagTick, this);   // กันผูกซ้ำเวลาฉากถูกสร้างใหม่
    this.events.on('postupdate', this.botBagTick, this);
    // ปุ่ม "ตั้งค่าบอท" ย้ายไปอยู่แถบเมนูด้านบนแล้ว (js/systems/topbar.js)
    // ข้อความสถานะบอท วางใต้แถบเมนู
    this.botStatusText = this.add.text(W / 2, 60, '', { fontSize: '12px', color: '#9fd98a', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
  };

  const _toggleAuto = Main.prototype.toggleAuto;
  Main.prototype.toggleAuto = function () {
    _toggleAuto.call(this);
    if (!this.autoMode && this.botStatusText) this.botStatusText.setText('');
    this.botFleeing = false; this.botFleeAng = null;
  };

  // โหมดบอท: เลือกเป้าเฉพาะมอนที่ติ๊กไว้
  const _nearestEnemy = Main.prototype.nearestEnemy;
  Main.prototype.nearestEnemy = function (maxDist) {
    if (!this.autoMode) return _nearestEnemy.call(this, maxDist);
    return this.botPickTarget(maxDist);
  };

  // โหมดบอท: ถ้าผู้เล่นแตะเลือกมอนที่ไม่ได้ติ๊กไว้ ให้ยกเลิกการล็อกเป้านั้น
  const _updateTargeting = Main.prototype.updateTargeting;
  Main.prototype.updateTargeting = function () {
    if (this.autoMode && this.manualTarget && !this.botCanAttack(this.manualTarget)) this.manualTarget = null;
    return _updateTargeting.call(this);
  };
})();

Object.assign(Main.prototype, {
  // ตั้งค่าแยกตามด่าน (เติมค่าที่ขาดให้ครบเสมอ)
  botCfgNow() {
    if (!this.botCfg) this.botCfg = {};
    const k = String(this.stageIdx || 0);
    const c = this.botCfg[k] || (this.botCfg[k] = {});
    Object.keys(BOT_DEFAULT).forEach(key => { if (c[key] === undefined) c[key] = BOT_DEFAULT[key]; });
    return c;
  },

  // ตั้งค่ารวมทุกด่าน (สกิล / เลือด)
  botGlobal() {
    if (!this.botCfg) this.botCfg = {};
    const g = this.botCfg.g || (this.botCfg.g = {});
    Object.keys(BOT_GLOBAL_DEFAULT).forEach(key => {
      const dv = BOT_GLOBAL_DEFAULT[key];
      if (dv && typeof dv === 'object') {
        if (!g[key] || typeof g[key] !== 'object') g[key] = {};
        Object.keys(dv).forEach(i => { if (g[key][i] === undefined) g[key][i] = dv[i]; });
      } else if (g[key] === undefined) g[key] = dv;
    });
    return g;
  },

  botCanAttack(e, cfg) {
    cfg = cfg || this.botCfgNow();
    if (e.isBoss) return !!cfg.boss;
    return e.ranged ? !!cfg.ranged : !!cfg.normal;
  },

  // บอสที่ต้องหลบ = เปิด "หนีบอส" และไม่ได้ติ๊ก "โจมตีบอส"
  botDangers(cfg) {
    if (!cfg.flee || cfg.boss) return [];
    return this.enemies.getChildren().filter(e => e.active && e.isBoss);
  },

  botSafe(x, y, dangers, r) {
    return !dangers.some(b => Phaser.Math.Distance.Between(x, y, b.x, b.y) < r);
  },

  // เส้นทางจากผู้เล่นไปจุดหมาย ไม่ผ่านใกล้บอส (กันเดินเข้าหาบอสแล้วต้องหนี วนไปมา)
  botPathSafe(x, y, dangers) {
    if (!dangers.length) return true;
    const p = this.player, r = BOT_FLEE_DIST + 30;
    return !dangers.some(b => botSegDist(b.x, b.y, p.x, p.y, x, y) < r);
  },

  // มอนที่กำลังไล่ตีเราอยู่ (เฉพาะชนิดที่บอทตั้งให้ตีได้)
  botAttackers(cfg) {
    const p = this.player;
    return this.enemies.getChildren().filter(e =>
      e.active && e.state === 'chase' && this.botCanAttack(e, cfg) &&
      Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) < BOT_ATTACKER_RANGE);
  },

  // เลือกเป้า: มอนที่กำลังไล่ตีเราได้สิทธิ์ก่อน แล้วค่อยเรียงตามระยะ
  botPickTarget(maxDist) {
    const cfg = this.botCfgNow(), p = this.player, dangers = this.botDangers(cfg);
    const limit = maxDist === undefined ? Infinity : maxDist;
    let best = null, bs = Infinity;
    this.enemies.getChildren().forEach(e => {
      if (!e.active || !this.botCanAttack(e, cfg)) return;
      if (dangers.length && (!this.botSafe(e.x, e.y, dangers, BOT_AVOID_DIST) || !this.botPathSafe(e.x, e.y, dangers))) return;
      const d = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
      if (d > limit) return;
      const score = d - (e.state === 'chase' ? 2000 : 0);
      if (score < bs) { bs = score; best = e; }
    });
    return best;
  },

  botWantUlti(t) {
    if (!this.ultiClass) return false;
    const def = (typeof ULTI_DEFS !== 'undefined') ? ULTI_DEFS[this.ultiClass] : null;
    if (!def) return false;                       // อัลติของคลาสใหม่ยังไม่มีข้อมูล = ข้ามไป ไม่ error
    if (this.stats.mp < def.mp) return false;
    if (t && t.isBoss) return true;
    const p = this.player, rng = def.range || 150;
    let n = 0;
    this.enemies.getChildren().forEach(e => { if (Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) < rng) n++; });
    return n >= 3;
  },

  // ---- ตัวช่วยตอนเปิดกระเป๋า ----
  // ปกติ updateAuto ถูกเรียกจาก update ของเกม แต่ถ้าโค้ดเกมข้ามการทำงานของบอทเพราะมีหน้าต่างเปิดอยู่ (และเฟรมนี้ยังไม่ได้เรียก updateAuto)
  // ให้เรียกเองหลังจบ update | ทำเฉพาะตอนเปิดบอท + เปิดกระเป๋าอยู่ + ตัวละครยังไม่ตาย
  botBagTick() {
    if (!this.autoMode || !window.BAG_OPEN) return;
    if (!this.player || !this.player.active || !this.stats || this.stats.hp <= 0) return;
    const fr = this.game && this.game.getFrame ? this.game.getFrame() : -1;
    if (this._botAutoAt === fr) return;           // เฟรมนี้บอททำงานแล้ว ไม่ต้องทำซ้ำ
    if (!this.target || !this.target.active) this.target = this.botPickTarget(600);
    this.updateAuto();
  },

  // ---- ดูแลเลือด: สกิลฮีล + ยาเลือด ----
  botAutoHeal(say) {
    const g = this.botGlobal(), now = this.time.now;
    const pct = this.stats.hp / Math.max(1, this.maxHp()) * 100;

    if (now >= (this.botNextHealSkill || 0)) {
      this.botNextHealSkill = now + 250;
      (this.slots || []).forEach((sid, i) => {
        if (!sid || !g.skillOn[i] || !botIsHeal(sid)) return;
        const def = SKILL_DEFS[sid];
        if (!def || this.stats.mp < def.mp) return;
        if (now < (this.cdEnd['slot' + i] || 0)) return;
        if (g.always[i] || (pct < 100 && pct <= g.healAt[i])) {
          const pl = this.player;
          this.useSkill(i, { x: pl.x, y: pl.y });   // ฮีลหมู่แบบวางพื้นให้ลงที่ตัวเอง (ไม่ใช่ที่มอน)
        }   // useSkill เช็กคูลดาวน์เอง
      });
    }

    if (g.autoHp && pct <= g.hpPct && now >= (this.botNextPotion || 0)) {
      this.botNextPotion = now + 1200;
      if (this.botDrinkHp()) say('ดื่มยาเลือด');
    }
  },

  // หาฟังก์ชันดื่มยาเลือดของเกมอัตโนมัติ (ลองชื่อที่น่าจะเป็นก่อน แล้วค่อยสแกนชื่อเมธอดทั้งหมดของ Main)
  // คืน { name, arg } หรือ null | จำผลไว้ ไม่สแกนซ้ำ
  botFindPotionFn() {
    if (this._botPotFn !== undefined) return this._botPotFn;
    const known = ['useHpPotion', 'drinkHpPotion', 'useHpPot', 'quickHp', 'useQuickHp', 'useRedPotion',
      'drinkHp', 'useHealPotion', 'usePotionHp', 'usePotion', 'drinkPotion', 'useQuickPotion'];
    let name = known.find(n => typeof this[n] === 'function');
    if (!name) {
      // สแกนหาเมธอดที่ชื่อเหมือนการดื่มยา (ไม่เอาของบอท และไม่เอายา MP)
      const all = [];
      for (let o = Object.getPrototypeOf(this); o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
        Object.getOwnPropertyNames(o).forEach(n => all.push(n));
      }
      name = all.find(n => typeof this[n] === 'function' && !/^bot/i.test(n) && !/mp|mana/i.test(n) &&
        /^(use|drink|quaff|quick|consume)\w*(hp|health|potion|heal)\w*$/i.test(n));
    }
    const generic = name && /^(usePotion|drinkPotion|useQuickPotion)$/.test(name);
    this._botPotFn = name ? { name: name, arg: generic ? 'hp' : undefined } : null;
    if (name) console.log('[bot] ใช้ฟังก์ชันดื่มยา: ' + name);
    return this._botPotFn;
  },

  // หาปุ่มยา "HP 10%" บนหน้าจอ (วิธีเดียวกับ hidePotions.js) | คืน 'hidden' ถ้าปุ่มถูกซ่อนเพราะมีหน้าต่างเปิดอยู่
  botPotionBtn() {
    // ช่องยาเลือดใน shop.js = ปุ่ม .qs ที่ป้ายเป็น "HP 10%/20%/30%" (ตัวเลขเปลี่ยนตามขวดที่เลือก/มีอยู่)
    let el = this._botPotEl;
    if (!el || !el.isConnected) {
      el = null;
      const labs = document.querySelectorAll('.qs .qs-lab');
      for (let i = 0; i < labs.length; i++) {
        if (/^HP\s*\d+\s*%$/.test((labs[i].textContent || '').trim())) { el = labs[i].closest('.qs'); break; }
      }
      this._botPotEl = el;
    }
    if (!el) return null;
    const wrap = el.parentElement;
    if (el.classList.contains('empty')) return 'empty';                       // ไม่มียาในกระเป๋า
    if (el.classList.contains('pot-hide') || (wrap && wrap.classList.contains('hide'))) return 'hidden';   // มีหน้าต่างเปิดอยู่
    return el;
  },

  // กดปุ่มเหมือนนิ้วผู้เล่น
  botClickEl(el) {
    const o = { bubbles: true, cancelable: true, view: window };
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(t => {
      try { el.dispatchEvent(t.indexOf('pointer') === 0 && window.PointerEvent ? new PointerEvent(t, o) : new MouseEvent(t, o)); } catch (e) { /* ignore */ }
    });
  },

  // ดื่มยาเลือด: กดปุ่มยาบนจอก่อน (ตรงกับที่ผู้เล่นกดจริง) ไม่เจอปุ่มค่อยลองหาฟังก์ชัน
  botDrinkHp() {
    let btn = this.botPotionBtn();
    // ปุ่มยาถูกซ่อนเพราะเปิดกระเป๋าอยู่ แต่บอทยังกดผ่านโค้ดได้ (ปุ่มที่ซ่อนก็รับคลิกจากโค้ดได้)
    if (btn === 'hidden') btn = this._botPotEl || null;
    if (btn === 'empty') {                       // ยาหมด: เตือนทุก 20 วิ
      const t = this.time.now;
      if (t > (this._botNoPotAt || 0)) { this._botNoPotAt = t + 20000; if (this.toastMsg) this.toastMsg('บอท: ยาเลือดหมด'); }
      return false;
    }
    if (btn) { this.botClickEl(btn); return true; }
    const fn = this.botFindPotionFn();
    if (!fn) {
      // แจ้งบนหน้าจอ (มือถือไม่มี console) ทุก 15 วิ
      const now = this.time.now;
      if (now > (this._botPotWarnAt || 0)) {
        this._botPotWarnAt = now + 15000;
        if (this.toastMsg) this.toastMsg('บอท: หาฟังก์ชันดื่มยาไม่เจอ (ส่ง inventory.js ให้ผู้ช่วยผูกให้)');
        console.warn('[bot] ไม่พบฟังก์ชันดื่มยาเลือดใน Main -- ต้องผูกใน botFindPotionFn()/botDrinkHp()');
      }
      return false;
    }
    try {
      const r = fn.arg === undefined ? this[fn.name]() : this[fn.name](fn.arg);
      return r !== false;
    } catch (e) {
      console.warn('[bot] ดื่มยาไม่สำเร็จ', e);
      return false;
    }
  },

  // ---- หนีบอส: เลือกทิศหนีครั้งเดียวแล้วถือทิศนั้นไว้ ไม่กลับไปกลับมา ----
  botFleeMove(nb) {
    const p = this.player, now = this.time.now;
    this.botStuckRef = null; this.botUnstickUntil = 0; this.botPath = null;

    let ax = p.x - nb.x, ay = p.y - nb.y, len = Math.hypot(ax, ay);
    if (len < 1) { ax = 1; ay = 0; len = 1; }
    ax /= len; ay /= len;
    const base = Math.atan2(ay, ax), M = 70, LOOK = 110;

    // ทิศที่ใช้ได้: ไม่หันเข้าหาบอส, ไม่ชนขอบแมพ, ไม่ชนหิน
    const ok = ang => {
      const dx = Math.cos(ang), dy = Math.sin(ang);
      if (dx * ax + dy * ay < 0.1) return false;
      const x2 = p.x + dx * LOOK, y2 = p.y + dy * LOOK;
      if (x2 < M || x2 > WORLD_W - M || y2 < M || y2 > WORLD_H - M) return false;
      if (this.segmentBlocked && this.segmentBlocked(p.x, p.y, x2, y2, 18)) return false;
      return true;
    };

    let ang = this.botFleeAng;
    if (ang === null || ang === undefined || !ok(ang)) {
      ang = null;
      if (this.botFleeSide === undefined) {
        // เลือกด้านที่เลี้ยวไปทางกลางแมพ (ทำครั้งเดียวต่อการหนี)
        const side = ((WORLD_W / 2 - p.x) * (-ay) + (WORLD_H / 2 - p.y) * ax) >= 0 ? 1 : -1;
        this.botFleeSide = side;
      }
      const s = this.botFleeSide;
      for (const off of [0, 25, 50, 75]) {
        for (const sg of [s, -s]) {
          const a = base + sg * off * Math.PI / 180;
          if (ok(a)) { ang = a; break; }
        }
        if (ang !== null) break;
      }
      if (ang === null) ang = base + s * Math.PI / 2;   // มุมอับ: ไถลไปตามขอบ
    }
    this.botFleeAng = ang;

    // ถ้าวิ่งแล้วไม่ขยับ (ติดอะไรสักอย่าง) สลับด้านแล้วเลือกทิศใหม่
    const ref = this.botFleeRef;
    if (!ref || now - ref.t > 500) {
      if (ref && Phaser.Math.Distance.Between(p.x, p.y, ref.x, ref.y) < 15) {
        this.botFleeAng = null; this.botFleeSide = -(this.botFleeSide || 1);
      }
      this.botFleeRef = { x: p.x, y: p.y, t: now };
    }
    // บอสประชิดตัวมาก: วาปออกไปตามทิศที่หนี
    if (len < 200 || this.botAlwaysWarpOn()) this.botWarp({ x: Math.cos(ang), y: Math.sin(ang) }, { flee: true });
    p.setVelocity(Math.cos(ang) * BOT_SPEED, Math.sin(ang) * BOT_SPEED);
  },

  updateAuto() {
    const p = this.player, cfg = this.botCfgNow(), g = this.botGlobal();
    const dangers = this.botDangers(cfg);
    const say = t => { if (this.botStatusText) this.botStatusText.setText('🤖 ' + t); };

    // 0) ดูแลเลือด (ทำคู่ไปกับทุกอย่าง ไม่หยุดการเดิน)
    this.botAutoHeal(say);
    if (!this.botFleeing) this.botAlwaysWarp();

    // 1) หนีมินิบอส: เริ่มหนีที่ BOT_FLEE_DIST และหนีต่อจนห่างเกิน BOT_FLEE_DIST + BOT_FLEE_EXTRA
    let nb = null, nd = Infinity;
    dangers.forEach(b => {
      const d = Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y);
      if (d < nd) { nd = d; nb = b; }
    });
    if (nb) {
      if (nd < BOT_FLEE_DIST) this.botFleeing = true;
      else if (nd > BOT_FLEE_DIST + BOT_FLEE_EXTRA) this.botFleeing = false;
    } else this.botFleeing = false;

    if (this.botFleeing && nb) {
      this.botFleeMove(nb);
      say('หนีมินิบอส');
      return;
    }
    this.botFleeAng = null; this.botFleeSide = undefined; this.botFleeRef = null;

    // 0.5) ติดก้อนหิน: เดินเลี้ยวข้างชั่วครู่
    if (this.time.now < (this.botUnstickUntil || 0)) {
      p.setVelocity(this.botUnstickVec.x * BOT_SPEED, this.botUnstickVec.y * BOT_SPEED);
      return;
    }

    // 2) เก็บของ: เฉพาะตอนไม่มีมอนไล่ตี และเฉพาะของที่อยู่ในระยะ BOT_LOOT_RANGE
    const underAttack = this.botAttackers(cfg).length > 0;
    if (!underAttack) {
      let loot = null, ld = Infinity;
      this.loot.getChildren().forEach(it => {
        if (!it.active || it.getData('skip')) return;
        const d = Phaser.Math.Distance.Between(p.x, p.y, it.x, it.y);
        if (d > BOT_LOOT_RANGE || d >= ld) return;
        if (dangers.length && (!this.botSafe(it.x, it.y, dangers, BOT_AVOID_DIST) || !this.botPathSafe(it.x, it.y, dangers))) return;
        ld = d; loot = it;
      });
      if (loot) {
        say('เก็บของ');
        this.botTrackLoot(loot, ld);
        this.botMove(loot.x, loot.y);
        return;
      }
    }

    // 3) โจมตีเป้าหมาย (this.target ถูกกรองตามที่ติ๊กไว้แล้ว และมอนที่ไล่ตีเราได้สิทธิ์ก่อน)
    const t = this.target && this.target.active ? this.target : null;
    if (t) {
      const cls = this.currentClass();
      const atk = botAtk(cls);                     // กันค้างเมื่อคลาส/อาวุธใหม่ยังไม่อยู่ใน BASIC_ATTACKS
      const approach = Math.max(50, (atk.range || 70) - 40);
      this.botGoal = { x: t.x, y: t.y, t: this.time.now, mode: 'keep', r: approach * 0.8 };
      const d = Phaser.Math.Distance.Between(p.x, p.y, t.x, t.y);
      // สายยิง (คทา/ธนู) ต้องมีแนวยิงโล่ง ถ้ามีหินบังให้เดินอ้อมไปหามุมยิง
      const noLine = atk.type === 'proj' && PLAYER_SHOTS_BLOCKED_BY_ROCKS &&
        this.segmentBlocked(p.x, p.y, t.x, t.y, 8);
      if (d > approach || noLine) {
        say(noLine ? 'หามุมยิงเลี่ยงหิน' : 'เดินเข้าหาเป้า');
        this.botMove(t.x, t.y);
      } else {
        say('โจมตี'); this.botStuckRef = null;
        p.setVelocity(0, 0);
        this.useBasicAttack();
        // ใช้เฉพาะสกิลโจมตีในช่องที่ติ๊กไว้ (สกิลฮีลจัดการใน botAutoHeal ตาม % เลือด)
        // สกิลลากเลือกทิศ (เช่น พลังแห่งแสง) ส่งทิศไปที่เป้าให้ ไม่ต้องพึ่ง facing
        this.slots.forEach((sid, i) => {
          if (!sid || !g.skillOn[i] || botIsHeal(sid) || botIsWarp(sid)) return;
          const def = SKILL_DEFS[sid];
          if (!def || this.stats.mp < def.mp) return;
          if (window.DIR_CFG && window.DIR_CFG[sid] && !(window.GROUND_CFG && window.GROUND_CFG[sid])) {
            const vx = t.x - p.x, vy = t.y - p.y, l = Math.hypot(vx, vy) || 1;
            this.useSkill(i, { dir: true, x: vx / l, y: vy / l });
          } else {
            this.useSkill(i);
          }
        });
        if (g.useUlti && this.botWantUlti(t)) this.useUlti();
      }
      return;
    }

    // 4) ไม่มีเป้าในระยะ: เดินไปหามอนที่ตีได้ (มอนที่ไล่ตีเราอยู่ได้สิทธิ์ก่อน)
    const far = this.nearestEnemy();
    if (far) { say('เดินหามอน'); this.botMove(far.x, far.y); }
    else { say('ลาดตระเวนหามอน'); this.botPatrol(dangers); }
  },

  // ---- วาปตลอด: ช่องวาปที่ตั้ง "ตลอด" จะวาปทุกครั้งที่พร้อม (ไว้ฟื้น MP) ----
  botAlwaysWarpOn() {
    const g = this.botGlobal();
    return (this.slots || []).some((sid, i) => sid && g.skillOn[i] && g.always[i] && botIsWarp(sid));
  },

  // ร่ายวาปช่อง i ไปทิศ dir (mage.js ห้ามบอทวาปเวลา autoMode เปิด จึงปิดแฟล็กชั่วขณะ)
  botCastWarpSlot(i, dir) {
    if (this.facing && this.facing.set) this.facing.set(dir.x, dir.y);
    this.botNextWarp = this.time.now + 500;
    const am = this.autoMode;
    this.autoMode = false;
    try { this.useSkill(i, { dir: true, x: dir.x, y: dir.y }); }
    finally { this.autoMode = am; }
  },

  botAlwaysWarp() {
    const g = this.botGlobal(), now = this.time.now;
    if (now < (this.botNextWarp || 0)) return;
    for (let i = 0; i < (this.slots || []).length; i++) {
      const sid = this.slots[i];
      if (!sid || !g.skillOn[i] || !g.always[i] || !botIsWarp(sid)) continue;
      const def = SKILL_DEFS[sid];
      if (!def || this.stats.mp < def.mp) continue;
      if (now < (this.cdEnd['slot' + i] || 0)) continue;
      const dir = this.botWarpDir(def);
      if (!dir) continue;
      this.botCastWarpSlot(i, dir);
      return;
    }
  },

  // เลือกทิศวาปที่ปลอดภัย (8 ทิศ): กำลังเดินไปที่หมาย = เข้าใกล้ที่หมาย | กำลังตีเป้า = รักษาระยะยิง | ไม่มี = ไปทางกลางแมพ
  botWarpDir(def) {
    const p = this.player, now = this.time.now;
    const dist = def.range || def.dist || def.distance || def.warpDist || BOT_WARP_DIST;
    const dangers = this.botDangers(this.botCfgNow());
    const goal = (this.botGoal && now - this.botGoal.t < 500) ? this.botGoal : null;
    let best = null, bs = -Infinity;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, dx = Math.cos(a), dy = Math.sin(a);
      const x2 = p.x + dx * dist, y2 = p.y + dy * dist;
      if (x2 < 60 || x2 > WORLD_W - 60 || y2 < 60 || y2 > WORLD_H - 60) continue;
      if (this.pointInRock && this.pointInRock(x2, y2, 30)) continue;
      if (dangers.length && !this.botSafe(x2, y2, dangers, BOT_FLEE_DIST - 80)) continue;
      let s;
      if (goal && goal.mode === 'keep') s = -Math.abs(Phaser.Math.Distance.Between(x2, y2, goal.x, goal.y) - (goal.r || 200));
      else if (goal) s = -Phaser.Math.Distance.Between(x2, y2, goal.x, goal.y);
      else s = -Phaser.Math.Distance.Between(x2, y2, WORLD_W / 2, WORLD_H / 2);
      if (this.segmentBlocked && this.segmentBlocked(p.x, p.y, x2, y2, 14)) s -= 1000;   // มีหินขวาง = วาปได้สั้นลง
      if (s > bs) { bs = s; best = { x: dx, y: dy }; }
    }
    return best;
  },

  // ---- วาป: ใช้สกิลวาปในช่องที่ติ๊กไว้ ไปตามทิศ dir (เวกเตอร์หน่วย) ----
  // opts.flee = วาปหนีบอส | opts.saveMp = เก็บ MP ไว้ (เดินทาง) | opts.toDist = ระยะถึงจุดหมาย (ไม่วาปถ้าใกล้กว่าระยะวาป)
  botWarp(dir, opts) {
    opts = opts || {};
    const g = this.botGlobal(), now = this.time.now, p = this.player;
    if (now < (this.botNextWarp || 0)) return false;
    const dangers = this.botDangers(this.botCfgNow());
    for (let i = 0; i < (this.slots || []).length; i++) {
      const sid = this.slots[i];
      if (!sid || !g.skillOn[i] || !botIsWarp(sid)) continue;
      const def = SKILL_DEFS[sid];
      if (!def || this.stats.mp < def.mp) continue;
      if (now < (this.cdEnd['slot' + i] || 0)) continue;               // ติดคูลดาวน์ (ใช้ key เดียวกับ mage.js / aimDash.js)
      if (opts.saveMp && this.stats.mp < this.maxMp() * BOT_WARP_MIN_MP / 100) continue;
      const dist = def.range || def.dist || def.distance || def.warpDist || BOT_WARP_DIST;
      if (opts.toDist !== undefined && opts.toDist < dist * 0.8) continue;
      const x2 = p.x + dir.x * dist, y2 = p.y + dir.y * dist;
      if (x2 < 60 || x2 > WORLD_W - 60 || y2 < 60 || y2 > WORLD_H - 60) continue;
      if (this.pointInRock && this.pointInRock(x2, y2, 30)) continue;
      if (dangers.length && !this.botSafe(x2, y2, dangers, opts.flee ? BOT_FLEE_DIST - 80 : BOT_AVOID_DIST)) continue;
      if (this.facing && this.facing.set) this.facing.set(dir.x, dir.y);
      this.botNextWarp = now + 500;
      // mage.js ตั้งไว้ว่า "ถ้า autoMode เปิด ห้ามใช้เวทวาป" (กันบอทวาปมั่ว) -- ปิดแฟล็กชั่วขณะเฉพาะตอนที่บอทตั้งใจวาปเอง
      const am = this.autoMode;
      this.autoMode = false;
      try { this.useSkill(i, { dir: true, x: dir.x, y: dir.y }); }         // gp.dir = ทิศวาป (mage.js อ่านจากตรงนี้)
      finally { this.autoMode = am; }
      return true;
    }
    return false;
  },

  // ---- ลาดตระเวน: ไม่มีเป้า/มุมอับ ให้เดินไปจุดสุ่มทั่วแมพเรื่อยๆ ไม่ยืนนิ่ง ----
  botPatrol(dangers) {
    const p = this.player, now = this.time.now;
    let pt = this.botPatrolPt;
    const reached = pt && Phaser.Math.Distance.Between(p.x, p.y, pt.x, pt.y) < 70;
    const bad = pt && (now - pt.t > 9000 ||
      (dangers.length && (!this.botSafe(pt.x, pt.y, dangers, BOT_AVOID_DIST) || !this.botPathSafe(pt.x, pt.y, dangers))));
    if (!pt || reached || bad) pt = this.botPatrolPt = this.botPickPatrolPoint(dangers);
    this.botMove(pt.x, pt.y);
  },

  botPickPatrolPoint(dangers) {
    const p = this.player, M = 160, now = this.time.now;
    for (let i = 0; i < 25; i++) {
      const x = Phaser.Math.Between(M, WORLD_W - M), y = Phaser.Math.Between(M, WORLD_H - M);
      if (Phaser.Math.Distance.Between(x, y, p.x, p.y) < 350) continue;
      if (this.pointInRock && this.pointInRock(x, y, 50)) continue;
      if (dangers.length && (!this.botSafe(x, y, dangers, BOT_AVOID_DIST) || !this.botPathSafe(x, y, dangers))) continue;
      return { x, y, t: now };
    }
    return { x: WORLD_W / 2, y: WORLD_H / 2, t: now };   // หาไม่ได้จริงๆ: เดินไปกลางแมพ
  },

  // เดินไปจุดหมาย: ถ้าเส้นตรงชนหิน ใช้ A* เดินอ้อม (คำนวณใหม่ทุก 0.6 วิ) | ถ้ายังติด ค่อยเลี้ยวข้างเป็นแผนสำรอง
  botMove(x, y) {
    const p = this.player, now = this.time.now;
    let tx = x, ty = y;
    this.botGoal = { x: x, y: y, t: now, mode: 'move' };
    // จุดหมายไกลและเส้นตรงโล่ง: วาปย่นระยะ (ถ้ามีสกิลวาปในช่องที่ติ๊กไว้)
    const dTo = Phaser.Math.Distance.Between(p.x, p.y, x, y);
    if (dTo > 420 && !(this.segmentBlocked && this.segmentBlocked(p.x, p.y, x, y, 18))) {
      this.botWarp(new Phaser.Math.Vector2(x - p.x, y - p.y).normalize(), { saveMp: true, toDist: dTo });
    }
    if (this.segmentBlocked && this.segmentBlocked(p.x, p.y, x, y, 18)) {
      let pr = this.botPath;
      if (!pr || Phaser.Math.Distance.Between(pr.gx, pr.gy, x, y) > 60 || now - pr.t > 600) {
        pr = this.botPath = { pts: this.findPath(p.x, p.y, x, y), i: 0, gx: x, gy: y, t: now };
      }
      if (pr.pts && pr.pts.length) {
        while (pr.i < pr.pts.length - 1 && Phaser.Math.Distance.Between(p.x, p.y, pr.pts[pr.i].x, pr.pts[pr.i].y) < 30) pr.i++;
        tx = pr.pts[pr.i].x; ty = pr.pts[pr.i].y;
      }
    } else {
      this.botPath = null;
    }
    this.physics.moveTo(p, tx, ty, BOT_SPEED);

    const ref = this.botStuckRef;
    if (!ref || now - ref.t > 700) {
      if (ref && Phaser.Math.Distance.Between(p.x, p.y, ref.x, ref.y) < 25) {
        const ang = Math.atan2(ty - p.y, tx - p.x) + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
        this.botUnstickVec = new Phaser.Math.Vector2(Math.cos(ang), Math.sin(ang));
        this.botUnstickUntil = now + 600;
        // ติดแล้ว: ลองวาปออกไปทางจุดหมาย
        this.botWarp(new Phaser.Math.Vector2(tx - p.x, ty - p.y).normalize(), { toDist: Phaser.Math.Distance.Between(p.x, p.y, tx, ty) });
      }
      this.botStuckRef = { x: p.x, y: p.y, t: now };
    }
  },

  // ของที่เดินเข้าไปไม่ได้ (ระยะไม่ลดลงใน 4 วิ) ให้ข้าม ไม่วนเก็บตลอดกาล
  botTrackLoot(loot, d) {
    const now = this.time.now, ref = this.botLootRef;
    if (!ref || ref.it !== loot) { this.botLootRef = { it: loot, best: d, t: now }; return; }
    if (d < ref.best - 40) { ref.best = d; ref.t = now; }
    else if (now - ref.t > 4000) { loot.setData('skip', true); this.botLootRef = null; }
  },

  botSave() { if (this.saveGame) this.saveGame(); },

  botToggle(key) {
    const cfg = this.botCfgNow();
    cfg[key] = !cfg[key];
    // "โจมตีบอส" กับ "หนีบอส" เลือกพร้อมกันไม่ได้
    if (key === 'boss' && cfg.boss) cfg.flee = false;
    if (key === 'flee' && cfg.flee) cfg.boss = false;
    this.botSave();
    this.openBotPanel();
  },

  // สลับค่า true/false ของตั้งค่ารวม: obj[key] (ใช้กับ autoHp, useUlti, skillOn[i])
  botToggleG(obj, key) {
    obj[key] = !obj[key];
    this.botSave();
    this.openBotPanel();
  },

  // ปรับเปอร์เซ็นต์ +/- ทีละ 5 (ช่วง 10-95)
  botStepG(obj, key, delta) {
    obj[key] = Phaser.Math.Clamp((obj[key] || 50) + delta, 10, 95);
    this.botSave();
    this.openBotPanel();
  },

  openBotPanel() {
    this.closePanel();
    const page = this.botPage || 0, z = ZONES[this.stageIdx || 0];
    const items = this.panelFrame('ตั้งค่าบอท v2 - ' + (page === 0 ? z.name : 'สกิล / เลือด'));
    this.panel = items;   // ผูกไว้ก่อน เผื่อสร้างหน้าไม่สำเร็จ จะยังปิดหน้าต่างได้
    try {
      if (page === 0) this.botPageTargets(items); else this.botPageSkills(items);
    } catch (err) {
      console.error('[bot] สร้างหน้าตั้งค่าไม่สำเร็จ', err);
      items.push(this.add.text(W / 2, H / 2 - 40, 'เกิดข้อผิดพลาด: ' + err.message, {
        fontSize: '13px', color: '#ff8888', align: 'center', wordWrap: { width: 460 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
    }

    // ปุ่มแท็บ วาดเองด้วยวิธีเดียวกับช่องติ๊ก (แตะติดแน่นอน)
    const by = H / 2 + 165;
    const tab = (x, label, active, cb) => {
      items.push(this.roundRect(201, x, by, 140, 38, active ? 0x3a8a3a : 0x24262b, 1, 8));
      items.push(this.add.text(x, by, label, { fontSize: '14px', color: active ? '#fff' : '#bbb' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
      const zn = this.add.zone(x, by, 140, 38).setScrollFactor(0).setDepth(204).setInteractive();
      zn.on('pointerdown', cb);
      items.push(zn);
    };
    tab(W / 2 - 150, 'เป้าหมาย', page === 0, () => { this.botPage = 0; if (this.toastMsg) this.toastMsg('หน้า: เป้าหมาย'); this.openBotPanel(); });
    tab(W / 2, 'สกิล/เลือด', page === 1, () => { this.botPage = 1; if (this.toastMsg) this.toastMsg('หน้า: สกิล/เลือด'); this.openBotPanel(); });
    tab(W / 2 + 150, this.autoMode ? 'ปิดบอท' : 'เปิดบอท', !!this.autoMode, () => { this.closePanel(); this.toggleAuto(); });
  },

  // หน้า 1: เลือกเป้าหมาย (เหมือนเดิม)
  botPageTargets(items) {
    const cfg = this.botCfgNow();
    const rows = [
      { key: 'normal', label: 'โจมตีสไลม์ธรรมดา' },
      { key: 'ranged', label: 'โจมตีสไลม์ยิงไกล' },
      { key: 'boss', label: '👑 โจมตีมินิบอส (HP/ดาเมจ x' + BOSS_MULT + ' อันตราย!)' },
      { key: 'flee', label: '🏃 หนีมินิบอส เมื่อเข้าใกล้ (ไม่โจมตี)' },
    ];
    let y = H / 2 - 125;
    rows.forEach(r => {
      const on = !!cfg[r.key];
      items.push(this.roundRect(201, W / 2, y, 480, 42, 0x24262b, 0.95, 8));
      items.push(this.roundRect(202, W / 2 - 210, y, 24, 24, on ? 0x3a8a3a : 0x0e1014, 1, 5));
      if (on) items.push(this.add.text(W / 2 - 210, y, '✓', { fontSize: '16px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
      items.push(this.add.text(W / 2 - 188, y, r.label, { fontSize: '13px', color: on ? '#fff' : '#999' }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(203));
      const zone = this.add.zone(W / 2, y, 480, 42).setScrollFactor(0).setDepth(204).setInteractive();
      zone.on('pointerdown', () => this.botToggle(r.key));
      items.push(zone);
      y += 50;
    });

    items.push(this.roundRect(201, W / 2, y, 480, 42, 0x1f2a1f, 0.95, 8));
    items.push(this.add.text(W / 2, y, '✓ มอนไล่ตีอยู่ = สู้ก่อน | เก็บของในระยะ ' + BOT_LOOT_RANGE + ' รอบตัว', { fontSize: '13px', color: '#9adf9a' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
    y += 40;
    items.push(this.add.text(W / 2, y, 'ตั้งค่าแยกตามด่าน | ถ้าไม่ติ๊กทั้ง "โจมตีบอส" และ "หนีบอส" บอทจะเมินบอสแต่ยังโดนบอสตีได้', {
      fontSize: '11px', color: '#aaa', align: 'center', wordWrap: { width: 470 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(203));
  },

  // หน้า 2: สกิล + เลือด (ใช้ร่วมทุกด่าน)
  botPageSkills(items) {
    const g = this.botGlobal();
    const RH = 34, RW = 480, left = W / 2 - 240;
    let y = H / 2 - 135;

    // แถวติ๊ก (+ ตัวปรับ % ทางขวา ถ้าส่ง step มา)
    const row = (label, on, onToggle, step, chip) => {
      items.push(this.roundRect(201, W / 2, y, RW, RH, 0x24262b, 0.95, 8));
      if (onToggle) {
        items.push(this.roundRect(202, left + 22, y, 22, 22, on ? 0x3a8a3a : 0x0e1014, 1, 5));
        if (on) items.push(this.add.text(left + 22, y, '✓', { fontSize: '15px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
      }
      items.push(this.add.text(left + 42, y, label, { fontSize: '12px', color: on ? '#fff' : '#999' }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(203));
      if (onToggle) {
        const zn = this.add.zone(left + 140, y, 280, RH).setScrollFactor(0).setDepth(204).setInteractive();
        zn.on('pointerdown', onToggle);
        items.push(zn);
      }
      if (step) {
        const cx = W / 2 + 175;
        [[-1, cx - 55, '−'], [1, cx + 55, '+']].forEach(([dir, bx, ch]) => {
          items.push(this.roundRect(202, bx, y, 30, 26, 0x3a3f4a, 1, 6));
          items.push(this.add.text(bx, y, ch, { fontSize: '18px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
          const zb = this.add.zone(bx, y, 38, RH).setScrollFactor(0).setDepth(204).setInteractive();
          zb.on('pointerdown', () => this.botStepG(step.obj, step.key, dir * 5));
          items.push(zb);
        });
        items.push(this.add.text(cx, y, (step.pre || '') + step.obj[step.key] + '%', { fontSize: '13px', color: '#ffe28a', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
      }
      if (chip) {
        const cOn = !!chip.obj[chip.key], cxp = W / 2 + 55;
        items.push(this.roundRect(202, cxp, y, 62, 24, cOn ? 0x3a8a3a : 0x0e1014, 1, 6));
        items.push(this.add.text(cxp, y, 'ตลอด', { fontSize: '12px', color: cOn ? '#fff' : '#999', fontStyle: cOn ? 'bold' : 'normal' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
        const zc = this.add.zone(cxp, y, 70, RH).setScrollFactor(0).setDepth(204).setInteractive();
        zc.on('pointerdown', () => this.botToggleG(chip.obj, chip.key));
        items.push(zc);
      }
      y += RH + 4;
    };

    row('💊 ดื่มยาเลือดอัตโนมัติ เมื่อ HP ≤', g.autoHp, () => this.botToggleG(g, 'autoHp'), { obj: g, key: 'hpPct' });
    row('⚡ ใช้อัลติเมท (ตามเงื่อนไขของบอท)', g.useUlti, () => this.botToggleG(g, 'useUlti'));

    items.push(this.add.text(W / 2, H / 2 + 100, 'ตลอด = ใช้ทุกครั้งที่พร้อม (🌀 วาป: ไว้ฟื้น MP | ❤ ฮีล: ลงที่ตัวเอง ไม่รอเลือดลด)', {
      fontSize: '11px', color: '#aaa', align: 'center', wordWrap: { width: 470 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(203));

    for (let i = 0; i < 4; i++) {
      const sid = this.slots && this.slots[i];
      const def = sid && SKILL_DEFS[sid];
      if (!def) { row('ช่อง ' + (i + 1) + ': (ว่าง)', false, null); continue; }
      const heal = botIsHeal(sid);
      const on = !!g.skillOn[i];
      if (heal) row('ช่อง ' + (i + 1) + ': ' + def.name + ' ❤', on, () => this.botToggleG(g.skillOn, i), { obj: g.healAt, key: i, pre: '≤' }, { obj: g.always, key: i });
      else {
        const warp = botIsWarp(sid);
        row('ช่อง ' + (i + 1) + ': ' + def.name + (warp ? ' 🌀' : ''), on, () => this.botToggleG(g.skillOn, i), null, warp ? { obj: g.always, key: i } : null);
      }
    }
  },
});

// จดเลขเฟรมทุกครั้งที่ updateAuto ถูกเรียก (ให้ botBagTick รู้ว่าเฟรมนี้บอททำงานไปแล้วหรือยัง)
// ต้องอยู่หลัง Object.assign ด้านบน เพราะต้องห่อ updateAuto ตัวที่เพิ่งสร้าง
(function () {
  const _updateAuto = Main.prototype.updateAuto;
  Main.prototype.updateAuto = function () {
    this._botAutoAt = (this.game && this.game.getFrame) ? this.game.getFrame() : -1;
    return _updateAuto.apply(this, arguments);
  };
})();

// ===== หมายเหตุ =====
// 1) botFindPotionFn()/botDrinkHp(): หาฟังก์ชันดื่มยาในเกมอัตโนมัติ ถ้าไม่เจอจะขึ้นข้อความบนจอ ให้ส่ง inventory.js มาผูกให้ตรง
// 2) botIsHeal(): สกิลที่ type เป็น lightbeam/holy/melee/proj/dash ถือเป็นสกิลโจมตีเสมอ (ไม่ดูจาก id แล้ว)
//    v35: สกิลที่ชื่อตรงกับ BOT_NOT_HEAL_NAMES (ฟันตัดเอ็น) หรืออยู่ใน BOT_NOT_HEAL_IDS ถือเป็นสกิลโจมตีเสมอ
// 3) ตั้งค่าสกิล/เลือดเก็บใน botCfg.g (ใช้ร่วมทุกด่าน) ถ้าเซฟแล้วไม่ติด ให้ตรวจ save.js ว่าเก็บ botCfg ทั้งก้อนหรือเฉพาะเลขด่าน
// 4) เปิดกระเป๋า (bagWindow.js) ไม่หยุดเกมแล้ว | botBagTick() เป็นตัวสำรอง: ถ้าโค้ดเกมอื่นยังข้ามบอทตอนเปิดกระเป๋า จะเรียก updateAuto ให้เอง
