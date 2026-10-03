// ===== บอทออโต้: หน้าต่างตั้งค่า + ตรรกะ =====
// ลำดับความสำคัญของบอท: 1) หนีมินิบอส (ถ้าติ๊ก)  2) เก็บของก่อนเสมอ  3) โจมตีเป้าที่เลือก  4) เดินหามอนที่ตีได้
// โหลดไฟล์นี้ต่อจาก input.js / ui.js / panels.js (ทับ updateAuto เดิมโดยอัตโนมัติ)

const BOT_DEFAULT = { normal: true, ranged: true, boss: false, flee: true };
const BOT_FLEE_DIST = 330;   // ระยะที่เริ่มหนีบอส (บอสไล่ตามที่ 220)
const BOT_AVOID_DIST = 300;  // ไม่เก็บของ/ไม่เลือกเป้าที่อยู่ใกล้บอสที่ต้องหลบ
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
  // ตั้งค่าแยกตามด่าน
  botCfgNow() {
    if (!this.botCfg) this.botCfg = {};
    const k = String(this.stageIdx || 0);
    if (!this.botCfg[k]) this.botCfg[k] = Object.assign({}, BOT_DEFAULT);
    return this.botCfg[k];
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

  botPickTarget(maxDist) {
    const cfg = this.botCfgNow(), p = this.player, dangers = this.botDangers(cfg);
    let best = null, bd = maxDist === undefined ? Infinity : maxDist;
    this.enemies.getChildren().forEach(e => {
      if (!e.active || !this.botCanAttack(e, cfg)) return;
      if (dangers.length && !this.botSafe(e.x, e.y, dangers, BOT_AVOID_DIST)) return;
      const d = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
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

  updateAuto() {
    const p = this.player, cfg = this.botCfgNow();
    const dangers = this.botDangers(cfg);
    const say = t => { if (this.botStatusText) this.botStatusText.setText('🤖 ' + t); };

    // 0) ติดก้อนหิน: เดินเลี้ยวข้างชั่วครู่
    if (this.time.now < (this.botUnstickUntil || 0)) {
      p.setVelocity(this.botUnstickVec.x * BOT_SPEED, this.botUnstickVec.y * BOT_SPEED);
      return;
    }

    // 1) หนีมินิบอส
    let nb = null, nd = Infinity;
    dangers.forEach(b => {
      const d = Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y);
      if (d < nd) { nd = d; nb = b; }
    });
    if (nb && nd < BOT_FLEE_DIST) {
      const away = new Phaser.Math.Vector2(p.x - nb.x, p.y - nb.y);
      if (away.length() < 1) away.set(1, 0);
      away.normalize();
      // ใกล้ขอบแมพ: เลี้ยวไถลไปตามขอบแทนวิ่งชนกำแพง
      const edge = Math.min(p.x, WORLD_W - p.x, p.y, WORLD_H - p.y);
      if (edge < 200) {
        const w = 1 - Math.max(0, edge) / 200;
        const perp = new Phaser.Math.Vector2(-away.y, away.x);
        const toC = new Phaser.Math.Vector2(WORLD_W / 2 - p.x, WORLD_H / 2 - p.y);
        if (perp.dot(toC) < 0) perp.negate();
        away.scale(1 - w).add(perp.scale(w)).normalize();
      }
      p.setVelocity(away.x * BOT_SPEED, away.y * BOT_SPEED);
      say('หนีมินิบอส');
      return;
    }

    // 2) เก็บของก่อนโจมตีเสมอ (ทั้งแมพ ยกเว้นของที่อยู่ใกล้บอสที่ต้องหลบ)
    let loot = null, ld = Infinity;
    this.loot.getChildren().forEach(it => {
      if (!it.active || it.getData('skip')) return;
      if (dangers.length && !this.botSafe(it.x, it.y, dangers, BOT_AVOID_DIST)) return;
      const d = Phaser.Math.Distance.Between(p.x, p.y, it.x, it.y);
      if (d < ld) { ld = d; loot = it; }
    });
    if (loot) {
      say('เก็บของ');
      this.botTrackLoot(loot, ld);
      this.botMove(loot.x, loot.y);
      return;
    }

    // 3) โจมตีเป้าหมาย (this.target ถูกกรองตามที่ติ๊กไว้แล้ว)
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
        this.slots.forEach((sid, i) => { if (sid && SKILL_DEFS[sid] && this.stats.mp >= SKILL_DEFS[sid].mp) this.useSkill(i); });
        if (this.botWantUlti(t)) this.useUlti();
      }
      return;
    }

    // 4) ไม่มีเป้าในระยะ: เดินไปหามอนที่ตีได้ใกล้สุด
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

  botToggle(key) {
    const cfg = this.botCfgNow();
    cfg[key] = !cfg[key];
    // "โจมตีบอส" กับ "หนีบอส" เลือกพร้อมกันไม่ได้
    if (key === 'boss' && cfg.boss) cfg.flee = false;
    if (key === 'flee' && cfg.flee) cfg.boss = false;
    if (this.saveGame) this.saveGame();
    this.openBotPanel();
  },

  openBotPanel() {
    this.closePanel();
    const cfg = this.botCfgNow(), z = ZONES[this.stageIdx || 0];
    const items = this.panelFrame('ตั้งค่าบอท - ' + z.name);
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
    items.push(this.add.text(W / 2, y, '✓ เก็บของก่อนโจมตีเสมอ (ล็อกไว้)', { fontSize: '13px', color: '#9adf9a' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
    y += 40;
    items.push(this.add.text(W / 2, y, 'ตั้งค่าแยกตามด่าน | ถ้าไม่ติ๊กทั้ง "โจมตีบอส" และ "หนีบอส" บอทจะเมินบอสแต่ยังโดนบอสตีได้', {
      fontSize: '11px', color: '#aaa', align: 'center', wordWrap: { width: 470 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(203));

    items.push(...this.tabBtn(W / 2, H / 2 + 165, this.autoMode ? 'ปิดบอท' : 'เปิดบอท', this.autoMode, () => { this.closePanel(); this.toggleAuto(); }));
    this.panel = items;
  },
});
