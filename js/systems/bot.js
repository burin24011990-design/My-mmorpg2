// ===== บอทออโต้: หน้าต่างตั้งค่า + ตรรกะ =====
// ลำดับความสำคัญของบอท:
//   0) ดูแลเลือด (ดื่มยา / สกิลฮีล) ทำงานคู่ไปกับทุกขั้นตอน
//   1) หนีมินิบอส (ถ้าติ๊ก)   2) ถ้ามีมอนไล่ตีอยู่ ให้สู้ก่อน   3) เก็บของที่อยู่ใกล้ตัว
//   4) โจมตีเป้าที่เลือก   5) เดินหามอนที่ตีได้
// โหลดไฟล์นี้ต่อจาก input.js / ui.js / panels.js (ทับ updateAuto เดิมโดยอัตโนมัติ)

// ตั้งค่าแยกตามด่าน
const BOT_DEFAULT = { normal: true, ranged: true, boss: false, flee: true };
// ตั้งค่ารวมทุกด่าน (สกิล / เลือด) เก็บใน botCfg.g
const BOT_GLOBAL_DEFAULT = {
  useUlti: true,
  skillOn: { 0: true, 1: true, 2: true, 3: true },   // ใช้สกิลช่องไหนบ้าง
  healAt: { 0: 50, 1: 50, 2: 50, 3: 50 },            // สกิลฮีลช่องนั้น ฮีลเมื่อ HP เหลือ <= กี่ %
  autoHp: true,                                       // ดื่มยาเลือดอัตโนมัติ
  hpPct: 50,                                          // ดื่มยาเมื่อ HP เหลือ <= กี่ %
};

const BOT_FLEE_DIST = 330;    // ระยะที่เริ่มหนีบอส (บอสไล่ตามที่ 220)
const BOT_FLEE_EXTRA = 120;   // หนีจนห่างเกินระยะนี้ + BOT_FLEE_DIST ถึงจะหยุดหนี (กันกระตุก)
const BOT_AVOID_DIST = 380;   // ไม่เก็บของ/ไม่เลือกเป้าที่อยู่ใกล้บอสที่ต้องหลบ
const BOT_LOOT_RANGE = 200;   // เก็บของเฉพาะที่อยู่ในระยะนี้จากตัวผู้เล่น (ปรับตรงนี้)
const BOT_ATTACKER_RANGE = 400; // มอนที่กำลังไล่ตีและอยู่ในระยะนี้ = กำลังโดนโจมตี
const BOT_SPEED = 190;

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
function botIsHeal(sid) {
  const d = (typeof SKILL_DEFS !== 'undefined') ? SKILL_DEFS[sid] : null;
  if (!d) return false;
  if (d.heal || d.healAmt || d.healPct) return true;
  const t = String(d.type || d.kind || d.effect || '').toLowerCase();
  if (t.indexOf('heal') >= 0) return true;
  return /heal|ฮิล|ฮีล|รักษา/i.test(String(sid) + ' ' + String(d.name || ''));
}

// ระยะจากจุด (px,py) ถึงเส้นตรง (x1,y1)-(x2,y2)
function botSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// ---- ต่อท้ายฟังก์ชันเดิม (ไม่ต้องแก้ไฟล์อื่น) ----
(function () {
  const _setupButtons = Main.prototype.setupButtons;
  Main.prototype.setupButtons = function () {
    _setupButtons.call(this);
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

  // ---- ดูแลเลือด: สกิลฮีล + ยาเลือด ----
  botAutoHeal(say) {
    const g = this.botGlobal(), now = this.time.now;
    const pct = this.stats.hp / Math.max(1, this.maxHp()) * 100;
    if (pct >= 100) return;

    if (now >= (this.botNextHealSkill || 0)) {
      this.botNextHealSkill = now + 250;
      (this.slots || []).forEach((sid, i) => {
        if (!sid || !g.skillOn[i] || !botIsHeal(sid)) return;
        const def = SKILL_DEFS[sid];
        if (def && this.stats.mp >= def.mp && pct <= g.healAt[i]) this.useSkill(i);   // useSkill เช็กคูลดาวน์เอง
      });
    }

    if (g.autoHp && pct <= g.hpPct && now >= (this.botNextPotion || 0)) {
      this.botNextPotion = now + 1200;
      if (this.botDrinkHp()) say('ดื่มยาเลือด');
    }
  },

  // เรียกฟังก์ชันดื่มยาเลือดของเกม (ต้องผูกให้ตรงกับระบบกระเป๋าจริง ดูหมายเหตุท้ายไฟล์)
  botDrinkHp() {
    try {
      if (typeof this.useHpPotion === 'function') return this.useHpPotion() !== false;
      if (typeof this.usePotion === 'function') return this.usePotion('hp') !== false;
    } catch (e) { console.warn('[bot] ดื่มยาไม่สำเร็จ', e); return false; }
    if (!_botWarned.potion) {
      _botWarned.potion = true;
      console.warn('[bot] ยังไม่พบฟังก์ชันดื่มยาเลือด (useHpPotion / usePotion) -- ต้องผูกใน botDrinkHp()');
    }
    return false;
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
    p.setVelocity(Math.cos(ang) * BOT_SPEED, Math.sin(ang) * BOT_SPEED);
  },

  updateAuto() {
    const p = this.player, cfg = this.botCfgNow(), g = this.botGlobal();
    const dangers = this.botDangers(cfg);
    const say = t => { if (this.botStatusText) this.botStatusText.setText('🤖 ' + t); };

    // 0) ดูแลเลือด (ทำคู่ไปกับทุกอย่าง ไม่หยุดการเดิน)
    this.botAutoHeal(say);

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

    // 2) เก็บของ: เฉพาะตอนไม่มีมอนไล่ตี และเฉพาะของที่อยู่ใกล้ตัว
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
        this.slots.forEach((sid, i) => {
          if (!sid || !g.skillOn[i] || botIsHeal(sid)) return;
          const def = SKILL_DEFS[sid];
          if (def && this.stats.mp >= def.mp) this.useSkill(i);
        });
        if (g.useUlti && this.botWantUlti(t)) this.useUlti();
      }
      return;
    }

    // 4) ไม่มีเป้าในระยะ: เดินไปหามอนที่ตีได้ (มอนที่ไล่ตีเราอยู่ได้สิทธิ์ก่อน)
    const far = this.nearestEnemy();
    if (far) { say('เดินหามอน'); this.botMove(far.x, far.y); }
    else { say('ไม่มีเป้าหมายที่เลือกไว้'); this.botStuckRef = null; p.setVelocity(0, 0); }
  },

  // เดินไปจุดหมาย: ถ้าเส้นตรงชนหิน ใช้ A* เดินอ้อม (คำนวณใหม่ทุก 0.6 วิ) | ถ้ายังติด ค่อยเลี้ยวข้างเป็นแผนสำรอง
  botMove(x, y) {
    const p = this.player, now = this.time.now;
    let tx = x, ty = y;
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
    items.push(this.add.text(W / 2, y, '✓ มอนไล่ตีอยู่ = สู้ก่อน | เก็บของเฉพาะที่อยู่ใกล้ตัว', { fontSize: '13px', color: '#9adf9a' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
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
    const row = (label, on, onToggle, step) => {
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
        items.push(this.add.text(cx, y, step.obj[step.key] + '%', { fontSize: '13px', color: '#ffe28a', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
      }
      y += RH + 4;
    };

    row('💊 ดื่มยาเลือดอัตโนมัติ เมื่อ HP ≤', g.autoHp, () => this.botToggleG(g, 'autoHp'), { obj: g, key: 'hpPct' });
    row('⚡ ใช้อัลติเมท (ตามเงื่อนไขของบอท)', g.useUlti, () => this.botToggleG(g, 'useUlti'));

    for (let i = 0; i < 4; i++) {
      const sid = this.slots && this.slots[i];
      const def = sid && SKILL_DEFS[sid];
      if (!def) { row('ช่อง ' + (i + 1) + ': (ว่าง)', false, null); continue; }
      const heal = botIsHeal(sid);
      const on = !!g.skillOn[i];
      if (heal) row('ช่อง ' + (i + 1) + ': ' + def.name + ' ❤ ฮีลเมื่อ ≤', on, () => this.botToggleG(g.skillOn, i), { obj: g.healAt, key: i });
      else row('ช่อง ' + (i + 1) + ': ' + def.name, on, () => this.botToggleG(g.skillOn, i));
    }
  },
});

// ===== หมายเหตุ =====
// 1) botDrinkHp(): ต้องมีฟังก์ชันดื่มยาในเกม (useHpPotion หรือ usePotion('hp')) ถ้าชื่อไม่ตรงให้แก้ในฟังก์ชันนั้น
// 2) botIsHeal(): เดาสกิลฮีลจากฟิลด์ใน SKILL_DEFS ถ้าสกิลฮีลของเกมไม่ถูกตรวจเจอ ให้แก้เงื่อนไขในฟังก์ชันนั้น
// 3) ตั้งค่าสกิล/เลือดเก็บใน botCfg.g (ใช้ร่วมทุกด่าน) ถ้าเซฟแล้วไม่ติด ให้ตรวจ save.js ว่าเก็บ botCfg ทั้งก้อนหรือเฉพาะเลขด่าน
