// ===== พุ่มหญ้า + ก้อนหิน (สไตล์ ROV) =====
// พุ่มหญ้า: ผู้เล่นเดินเข้าไปแล้วโปร่งใส มอนที่ห่างเกิน BUSH_REVEAL_DIST มองไม่เห็น + กระสุนมอนจากไกลถูกบัง
//           โจมตีแล้วจะโผล่ชั่วคราว (BUSH_REVEAL_AFTER_ATTACK)
// ก้อนหิน: ตันเดินผ่านไม่ได้ (ผู้เล่น+มอน) และบังกระสุนทุกชนิด (ของมอนและของผู้เล่น ตั้ง PLAYER_SHOTS_BLOCKED_BY_ROCKS=false ถ้าอยากให้กระสุนผู้เล่นบินข้าม)
// มีระบบหาทางเดินอ้อมหิน (A*) และตรวจแนวยิง ให้บอทใช้ (findPath / segmentBlocked)
// ตำแหน่งสุ่มแบบคงที่ตามหมายเลขด่าน (ทุกครั้ง/ทุกคนเห็นเหมือนกัน)
// โหลดต่อจาก monsters.js

const ROCK_SIZES = [['rock_s', 56], ['rock_m', 84], ['rock_l', 116]];
const BUSH_COUNT = 18;
const ROCK_MAX = 30;
const PLAYER_SHOTS_BLOCKED_BY_ROCKS = true;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ตอนมอนตาย ถ้าของดรอปไปตกในก้อนหิน ให้ขยับออกมา (กันเก็บไม่ได้)
(function () {
  const _dropLoot = Main.prototype.dropLoot;
  Main.prototype.dropLoot = function (...args) {
    const before = new Set(this.loot.getChildren());
    _dropLoot.apply(this, args);
    this.loot.getChildren().forEach(it => { if (!before.has(it)) this.nudgeOutOfRocks(it); });
  };
})();

Object.assign(Main.prototype, {
  makeObstacleTextures() {
    if (this.textures.exists('rock_m')) return;
    const g = this.make.graphics({ add: false });
    ROCK_SIZES.forEach(([key, s]) => {
      g.clear();
      g.fillStyle(0x7d8288).fillRoundedRect(2, 2, s - 4, s - 4, s * 0.28);
      g.fillStyle(0x62676c).fillRoundedRect(4, s * 0.55, s - 8, s * 0.4, s * 0.22);
      g.fillStyle(0xa3a9af).fillRoundedRect(s * 0.14, s * 0.12, s * 0.46, s * 0.3, s * 0.12);
      g.lineStyle(3, 0x40444a, 1).strokeRoundedRect(2, 2, s - 4, s - 4, s * 0.28);
      g.generateTexture(key, s, s);
    });
    g.destroy();
  },

  buildObstacles(idx) {
    const z = ZONES[idx];
    this.makeObstacleTextures();
    if (!this.rocks) {
      this.rocks = this.physics.add.staticGroup();
      this.physics.add.collider(this.player, this.rocks);
      this.physics.add.collider(this.enemies, this.rocks);
      this.physics.add.overlap(this.enemyShots, this.rocks, sh => sh.destroy());
      if (PLAYER_SHOTS_BLOCKED_BY_ROCKS) {
        this.physics.add.overlap(this.projectiles, this.rocks, pr => { this.flash(pr.x, pr.y, 10, 0xaaaaaa); pr.destroy(); });
      }
    }
    this.rocks.clear(true, true);
    (this.obstacleObjs || []).forEach(o => o.destroy());
    this.obstacleObjs = []; this.rockRects = []; this.bushes = [];

    const rnd = mulberry32(1000 + z.id * 7919);
    const rand = (a, b) => a + rnd() * (b - a);
    const dist = Phaser.Math.Distance.Between;
    const M = 160;
    const farFrom = (x, y, list, d) => list.every(o => dist(x, y, o.x, o.y) > d);
    const awayFromSpawn = (x, y, d) => dist(x, y, z.x, z.y) > d;

    // พุ่มหญ้า
    const cols = [0x2f7d32, 0x3f9a3f, 0x58b358];
    for (let tries = 0; this.bushes.length < BUSH_COUNT && tries < 500; tries++) {
      const r = rand(70, 115), x = rand(M, WORLD_W - M), y = rand(M, WORLD_H - M);
      if (!awayFromSpawn(x, y, 300) || !farFrom(x, y, this.bushes, 280)) continue;
      const blobs = [];
      for (let i = 0; i < 8; i++) {
        const a = rnd() * Math.PI * 2, d = rand(0.15, 0.7) * r;
        blobs.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: rand(0.25, 0.4) * r, c: cols[Math.floor(rnd() * cols.length)] });
      }
      this.bushes.push({ x, y, r, blobs });
    }

    // ก้อนหิน
    const addRock = (x, y, sz) => {
      const [key, s] = sz;
      if (x < 80 || y < 80 || x > WORLD_W - 80 || y > WORLD_H - 80) return false;
      if (!awayFromSpawn(x, y, 220) || !farFrom(x, y, this.rockRects, 130)) return false;
      this.rocks.create(x, y, key).setDepth(1);
      this.rockRects.push({ x, y, w: s, h: s });
      return true;
    };
    this.bushes.forEach(b => {                       // หินตั้งข้างพุ่ม (ที่กำบัง)
      const n = rnd() < 0.5 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const sz = ROCK_SIZES[1 + Math.floor(rnd() * 2)];
        const a = rnd() * Math.PI * 2, d = b.r + sz[1] / 2 + 6;
        addRock(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, sz);
      }
    });
    for (let tries = 0; this.rockRects.length < ROCK_MAX && tries < 300; tries++) {  // หินเดี่ยวกระจายทั่วแมพ
      addRock(rand(M / 2, WORLD_W - M / 2), rand(M / 2, WORLD_H - M / 2), ROCK_SIZES[Math.floor(rnd() * 3)]);
    }

    this.buildNavGrid();

    // วาดพุ่มหญ้า (อยู่เหนือตัวละคร โปร่งแสงครึ่งหนึ่ง)
    const g = this.add.graphics().setDepth(6);
    this.bushes.forEach(b => {
      g.fillStyle(0x2f7d32, 0.5).fillCircle(b.x, b.y, b.r);
      b.blobs.forEach(o => { g.fillStyle(o.c, 0.55).fillCircle(b.x + o.dx, b.y + o.dy, o.r); });
      g.lineStyle(3, 0x1f5a22, 0.7).strokeCircle(b.x, b.y, b.r);
    });
    this.obstacleObjs.push(g);
  },

  // ---------- เส้นทาง / แนวยิง ----------
  // ตารางเดินได้ (ช่องละ 40px) ขยายขอบหินออก 20px ให้ตัวละครเดินไม่เฉี่ยว
  buildNavGrid() {
    const cell = 40, cols = Math.ceil(WORLD_W / cell), rows = Math.ceil(WORLD_H / cell), m = 20;
    const blocked = new Uint8Array(cols * rows);
    (this.rockRects || []).forEach(r => {
      const c0 = Math.max(0, Math.floor((r.x - r.w / 2 - m) / cell)), c1 = Math.min(cols - 1, Math.floor((r.x + r.w / 2 + m) / cell));
      const r0 = Math.max(0, Math.floor((r.y - r.h / 2 - m) / cell)), r1 = Math.min(rows - 1, Math.floor((r.y + r.h / 2 + m) / cell));
      for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) blocked[rr * cols + cc] = 1;
    });
    this.navGrid = { cols, rows, cell, blocked };
  },

  // เส้นตรงจาก (x1,y1) ไป (x2,y2) ชนหินตรงไหนก่อน: คืนสัดส่วน 0..1 หรือ null ถ้าไม่ชน (margin = ขยายขอบหิน)
  rayHitRock(x1, y1, x2, y2, margin) {
    const m = margin || 0, dx = x2 - x1, dy = y2 - y1;
    let best = null;
    for (const r of (this.rockRects || [])) {
      const mins = [r.x - r.w / 2 - m, r.y - r.h / 2 - m], maxs = [r.x + r.w / 2 + m, r.y + r.h / 2 + m];
      const ps = [x1, y1], ds = [dx, dy];
      let t0 = 0, t1 = 1, ok = true;
      for (let a = 0; a < 2 && ok; a++) {
        if (Math.abs(ds[a]) < 1e-9) { if (ps[a] < mins[a] || ps[a] > maxs[a]) ok = false; }
        else {
          let ta = (mins[a] - ps[a]) / ds[a], tb = (maxs[a] - ps[a]) / ds[a];
          if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          if (t0 > t1) ok = false;
        }
      }
      if (ok && (best === null || t0 < best)) best = t0;
    }
    return best;
  },

  segmentBlocked(x1, y1, x2, y2, margin) { return this.rayHitRock(x1, y1, x2, y2, margin) !== null; },

  // A* หาทางเดินอ้อมหิน คืนรายการจุด [{x,y}...] (ปลายทางคือจุดเป้าหมายจริง) หรือ null ถ้าหาไม่เจอ
  findPath(sx, sy, gx, gy) {
    const g = this.navGrid;
    if (!g) return null;
    const { cols, rows, cell, blocked } = g;
    const cellOf = (x, y) => [Phaser.Math.Clamp(Math.floor(x / cell), 0, cols - 1), Phaser.Math.Clamp(Math.floor(y / cell), 0, rows - 1)];
    const center = (c, r) => ({ x: c * cell + cell / 2, y: r * cell + cell / 2 });
    const [sc, sr] = cellOf(sx, sy);
    let [gc, gr] = cellOf(gx, gy);
    if (blocked[gr * cols + gc]) {                       // เป้าอยู่ติดหิน: ใช้ช่องว่างที่ใกล้ที่สุดแทน
      let best = null, bd = Infinity;
      for (let rad = 1; rad <= 6 && !best; rad++) {
        for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
          const c = gc + dc, r = gr + dr;
          if (c < 0 || r < 0 || c >= cols || r >= rows || blocked[r * cols + c]) continue;
          const pt = center(c, r), d = Phaser.Math.Distance.Between(pt.x, pt.y, gx, gy);
          if (d < bd) { bd = d; best = [c, r]; }
        }
      }
      if (!best) return null;
      gc = best[0]; gr = best[1];
    }

    const N = cols * rows, start = sr * cols + sc, goal = gr * cols + gc;
    const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const h = id => { const dx = Math.abs((id % cols) - gc), dy = Math.abs(((id / cols) | 0) - gr); return dx + dy - 0.586 * Math.min(dx, dy); };
    const heap = [];
    const push = (f, id) => {
      heap.push([f, id]);
      let i = heap.length - 1;
      while (i > 0) { const pr = (i - 1) >> 1; if (heap[pr][0] <= heap[i][0]) break; const t = heap[pr]; heap[pr] = heap[i]; heap[i] = t; i = pr; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
        }
      }
      return top;
    };
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    gs[start] = 0; push(h(start), start);
    let iter = 0, found = false;
    while (heap.length && iter++ < 8000) {
      const id = pop()[1];
      if (closed[id]) continue;
      closed[id] = 1;
      if (id === goal) { found = true; break; }
      const c = id % cols, r = (id / cols) | 0;
      for (const [dc, dr, cost] of DIRS) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const nid = nr * cols + nc;
        if (closed[nid] || blocked[nid]) continue;
        if (dc !== 0 && dr !== 0 && (blocked[r * cols + nc] || blocked[nr * cols + c])) continue;  // ไม่ตัดมุมหิน
        const ng = gs[id] + cost;
        if (ng < gs[nid]) { gs[nid] = ng; came[nid] = id; push(ng + h(nid), nid); }
      }
    }
    if (!found) return null;

    const raw = [];
    for (let id = goal; id !== start && id !== -1; id = came[id]) raw.push(center(id % cols, (id / cols) | 0));
    raw.reverse();
    raw.push({ x: gx, y: gy });

    // ดึงเส้นให้ตรงที่สุด (ข้ามจุดที่ไม่จำเป็น)
    const out = [];
    let cur = { x: sx, y: sy }, i = 0;
    while (i < raw.length) {
      let j = raw.length - 1;
      while (j > i && this.segmentBlocked(cur.x, cur.y, raw[j].x, raw[j].y, 18)) j--;
      out.push(raw[j]); cur = raw[j]; i = j + 1;
    }
    return out;
  },

  pointInRock(x, y, margin) {
    const m = margin || 0;
    return (this.rockRects || []).some(r => Math.abs(x - r.x) < r.w / 2 + m && Math.abs(y - r.y) < r.h / 2 + m);
  },

  // คืน true ถ้าผู้เล่นซ่อนอยู่ในพุ่ม (และยังไม่ได้โจมตีเมื่อครู่)
  updatePlayerHidden(time) {
    const p = this.player;
    const inBush = (this.bushes || []).some(b => Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) < b.r);
    const hidden = inBush && time >= (this.revealUntil || 0);
    this.playerHidden = hidden;
    if (!(time < (this.invulnUntil || 0))) p.setAlpha(hidden ? 0.5 : 1);
    return hidden;
  },

  nudgeOutOfRocks(it) {
    let moved = false;
    for (let pass = 0; pass < 3; pass++) {
      let hit = false;
      for (const r of (this.rockRects || [])) {
        const hx = r.w / 2 + 14, hy = r.h / 2 + 14;
        const dx = it.x - r.x, dy = it.y - r.y;
        if (Math.abs(dx) < hx && Math.abs(dy) < hy) {
          const px = hx - Math.abs(dx), py = hy - Math.abs(dy);
          if (px < py) it.x = r.x + Math.sign(dx || 1) * hx;
          else it.y = r.y + Math.sign(dy || 1) * hy;
          hit = moved = true;
        }
      }
      if (!hit) break;
    }
    if (!moved) return;
    it.setPosition(Phaser.Math.Clamp(it.x, 20, WORLD_W - 20), Phaser.Math.Clamp(it.y, 20, WORLD_H - 20));
    if (it.getData('kind') === 'gold') {
      this.tweens.killTweensOf(it);
      this.tweens.add({ targets: it, y: it.y - 6, yoyo: true, repeat: -1, duration: 500 });
    }
  },
});

// กระสุนของผู้เล่นคนอื่น (ภาพที่เห็นในจอเรา) ให้หยุดที่ก้อนหินเหมือนกัน
(function () {
  const _remoteProjectile = Main.prototype.remoteProjectile;
  Main.prototype.remoteProjectile = function (d, color) {
    if (!PLAYER_SHOTS_BLOCKED_BY_ROCKS) return _remoteProjectile.call(this, d, color);
    const ex = d.x + d.fx * 462, ey = d.y + d.fy * 462;
    const t = this.rayHitRock(d.x, d.y, ex, ey, 8);
    if (t === null) return _remoteProjectile.call(this, d, color);
    const f = this.add.sprite(d.x, d.y, 'proj').setTint(color);
    this.tweens.add({
      targets: f, x: d.x + (ex - d.x) * t, y: d.y + (ey - d.y) * t, duration: Math.max(60, 1100 * t),
      onComplete: () => { this.flash(f.x, f.y, 10, 0xaaaaaa); f.destroy(); },
    });
  };
})();
