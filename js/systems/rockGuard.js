// ===== กันมอนเข้าไปในหิน/บ่อ + ย้ายของที่ตกในหินออกมา =====
// สาเหตุหลัก: โหมดห้อง (roomMonsters.js) ใช้ตำแหน่งจากเซิร์ฟเวอร์ ซึ่งไม่รู้จักหิน มอนจึงเดินทะลุเข้าไปได้
// ไฟล์นี้ดันมอนออกจากหิน/บ่อทุกเฟรม (ทั้งโหมดห้องและโหมดเครื่อง) และหาจุดโล่งที่เดินถึงให้ของที่ตก
// โหลดหลัง obstacles.js / roomMonsters.js / bot.js / rebirth.js และก่อน main.js (ไม่ต้องแก้ไฟล์เดิม)
(function () {
  const P = Main.prototype;
  const TOL = 2;               // เผื่อค่าคลาดเคลื่อน ไม่ให้ชนกับระบบฟิสิกส์เดิม
  const LOOT_CLEAR = 24;       // ของต้องห่างหินอย่างน้อยเท่านี้ ผู้เล่นถึงเก็บได้

  const allRects = sc => (sc.rockRects || []).concat(sc.pondRects || []);

  // ดันมอน e ออกจากสี่เหลี่ยมหิน/บ่อที่ทับอยู่ (ไปทางที่ใกล้ที่สุด) คืน true ถ้าขยับ
  function pushOut(e, rects) {
    if (!e || !e.active) return false;
    const b = e.body;
    const hw = b ? b.halfWidth : 10, hh = b ? b.halfHeight : 10;
    let cx = b ? b.center.x : e.x, cy = b ? b.center.y : e.y;
    let moved = false;
    for (let pass = 0; pass < 3; pass++) {
      let hit = false;
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        const ox = r.w / 2 + hw - TOL, oy = r.h / 2 + hh - TOL;
        const dx = cx - r.x, dy = cy - r.y;
        if (Math.abs(dx) >= ox || Math.abs(dy) >= oy) continue;
        const px = ox + TOL - Math.abs(dx), py = oy + TOL - Math.abs(dy);
        if (px < py) cx += Math.sign(dx || 1) * px; else cy += Math.sign(dy || 1) * py;
        hit = moved = true;
      }
      if (!hit) break;
    }
    if (!moved) return false;
    const dx = cx - (b ? b.center.x : e.x), dy = cy - (b ? b.center.y : e.y);
    e.x = Phaser.Math.Clamp(e.x + dx, 20, WORLD_W - 20);
    e.y = Phaser.Math.Clamp(e.y + dy, 20, WORLD_H - 20);
    return true;
  }

  // ---- ทุกเฟรม: ดันมอนออกจากหิน + ตรวจของที่ตกในหินทุก 1 วิ ----
  const _updateEnemies = P.updateEnemies;
  P.updateEnemies = function (time) {
    const r = _updateEnemies.apply(this, arguments);
    const rects = allRects(this);
    if (rects.length && this.enemies) {
      const list = this.enemies.getChildren();
      for (let i = 0; i < list.length; i++) pushOut(list[i], rects);
    }
    if (rects.length && this.loot && time > (this._rgLootAt || 0)) {
      this._rgLootAt = time + 1000;
      this.loot.getChildren().forEach(it => {
        if (it.active && this.pointInRock(it.x, it.y, 12)) this.nudgeOutOfRocks(it);
      });
    }
    return r;
  };

  // ---- มอนที่เพิ่งเกิด (ในเครื่อง / จากเซิร์ฟเวอร์) ----
  ['spawnEnemyInZone', 'spawnBoss', 'spawnEpic', 'rmCreate'].forEach(name => {
    const o = P[name];
    if (typeof o !== 'function') return;
    P[name] = function () {
      const e = o.apply(this, arguments);
      if (e && e.active) pushOut(e, allRects(this));
      return e;
    };
  });

  // ---- ของที่ตก: ย้ายไปจุดโล่งที่ใกล้ที่สุด (ห่างหิน LOOT_CLEAR) แทนการดันออกแค่ขอบ ----
  P.nudgeOutOfRocks = function (it) {
    if (!it || !this.pointInRock || !this.pointInRock(it.x, it.y, 12)) return;
    const ok = (x, y) => x > 30 && y > 30 && x < WORLD_W - 30 && y < WORLD_H - 30 && !this.pointInRock(x, y, LOOT_CLEAR);
    let best = null;
    for (let rad = 10; rad <= 360 && !best; rad += 10) {
      const n = Math.max(12, Math.round(rad / 6));
      let bd = Infinity;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, x = it.x + Math.cos(a) * rad, y = it.y + Math.sin(a) * rad;
        if (!ok(x, y)) continue;
        const d = Math.abs(a - Math.PI / 4);        // ลำดับเสมอกัน: ไม่สำคัญ เลือกอันแรกที่ใกล้สุด
        if (d < bd) { bd = d; best = { x, y }; }
      }
    }
    if (!best) return;
    it.setPosition(best.x, best.y);
    if (it.body && it.body.moves === false && it.refreshBody) { try { it.refreshBody(); } catch (e) { /* ignore */ } }
    it.setData('skip', false);                       // ให้บอทกลับมาเก็บได้
    if (it.getData && it.getData('kind') === 'gold') {
      this.tweens.killTweensOf(it);
      this.tweens.add({ targets: it, y: it.y - 6, yoyo: true, repeat: -1, duration: 500 });
    }
  };

  // ---- บอท: ข้ามของที่อยู่ในหินทันที / เดินเข้าไม่ถึงใน 2.5 วิ (เดิม 4 วิ) ----
  P.botTrackLoot = function (loot, d) {
    const now = this.time.now, ref = this.botLootRef;
    if (this.pointInRock && this.pointInRock(loot.x, loot.y, 10)) { loot.setData('skip', true); this.botLootRef = null; return; }
    if (!ref || ref.it !== loot) { this.botLootRef = { it: loot, best: d, t: now }; return; }
    if (d < ref.best - 30) { ref.best = d; ref.t = now; }
    else if (now - ref.t > 2500) { loot.setData('skip', true); this.botLootRef = null; }
  };
})();
