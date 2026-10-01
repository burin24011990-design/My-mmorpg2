// ===== พุ่มหญ้า + ก้อนหิน (สไตล์ ROV) =====
// พุ่มหญ้า: ใช้รูป grass1-3 (assets/) วางซ้อนกันเป็นแปลงรูปวงรี
//           ผู้เล่นเดินเข้าไป -> หญ้าตรงนั้นจางลงให้เห็นตัวเอง, มอนที่ห่างเกิน BUSH_REVEAL_DIST มองไม่เห็นเรา
//           มอนที่อยู่ในพุ่ม: ผู้เล่นมองไม่เห็นถ้าอยู่ไกล (เข้าใกล้ / มอนยิงกระสุน / อยู่พุ่มเดียวกัน = เห็น)
//           โจมตีแล้วจะโผล่ชั่วคราว (BUSH_REVEAL_AFTER_ATTACK)
// ก้อนหิน: ตันเดินผ่านไม่ได้ (ผู้เล่น+มอน) และบังกระสุนทุกชนิด (ของมอนและของผู้เล่น ตั้ง PLAYER_SHOTS_BLOCKED_BY_ROCKS=false ถ้าอยากให้กระสุนผู้เล่นบินข้าม)
// มีระบบหาทางเดินอ้อมหิน (A*) และตรวจแนวยิง ให้บอทใช้ (findPath / segmentBlocked)
// ตำแหน่งสุ่มแบบคงที่ตามหมายเลขด่าน (ทุกครั้ง/ทุกคนเห็นเหมือนกัน)
// โหลดต่อจาก monsters.js

const ROCK_SIZES = [['rock_s', 56], ['rock_m', 84], ['rock_l', 116]];
// รูปหินใน assets/ (โหลดโดย main.js) ถ้าโหลดไม่ได้จะใช้รูปที่วาดด้วยโค้ดแทน
const ROCK_IMG = { rock_s: 'rock1', rock_m: 'rock2', rock_l: 'rock3' };
const BUSH_COUNT = 18;
const ROCK_MAX = 30;
const PLAYER_SHOTS_BLOCKED_BY_ROCKS = true;

// ----- ตั้งค่าพุ่มหญ้า (ปรับตรงนี้) -----
const GRASS_IMG_KEYS = ['grass1', 'grass2', 'grass3']; // รูปใน assets/ (โหลดโดย main.js)
const BUSH_R_MIN = 90, BUSH_R_MAX = 140;               // ขนาดแปลงหญ้า (รัศมีฐาน)
const BUSH_SPACING = 340;                              // ระยะห่างต่ำสุดระหว่างแปลง
const BUSH_RX = 1.15, BUSH_RY = 0.8;                   // วงรีที่นับว่า "อยู่ในหญ้า" (x เท่าของรัศมี, y เท่าของรัศมี)
const BUSH_ALPHA_INSIDE = 0.45;                        // ความทึบของหญ้าตอนเราอยู่ข้างใน (น้อย = จางมาก)
const BUSH_PLAYER_HIDDEN_ALPHA = 0.7;                  // ความทึบของตัวเราตอนซ่อนในหญ้า

// ----- พื้นแมพ + ของตกแต่ง (ปรับตรงนี้) -----
const FLOOR_KEY = 'floor_grass';        // รูปพื้นที่ปูซ้ำ (ใช้ทุกด่าน; อยากแยกตามด่านให้ทำเป็น map ตาม z.id)
// ของตกแต่ง: key, ความกว้างในเกม (px), จำนวนต่อด่าน, depth (ต่ำกว่าตัวละครเสมอ), หมุนสุ่มได้ไหม
const DECO_DEFS = [
  { key: 'deco_dirt',     w: 128, count: 10, depth: -9.5, rotate: true },
  { key: 'deco_pebble',   w: 36,  count: 40, depth: -8 },
  { key: 'deco_tuft',     w: 40,  count: 50, depth: -8 },
  { key: 'deco_flower',   w: 32,  count: 40, depth: -8 },
  { key: 'deco_mushroom', w: 28,  count: 20, depth: -8 },
  { key: 'deco_stump',    w: 56,  count: 8,  depth: -7.5 },
];

// ----- บ่อน้ำ (เดินไม่ได้ / กระสุนบินข้ามได้ / บอทเดินอ้อม) -----
const POND_COUNT = 4;                    // จำนวนบ่อต่อด่าน
const POND_W = 320, POND_H = 200;        // ขนาดรูปในเกม (px) -- สุ่มขยาย/ย่อ 0.85-1.2 เท่า
const POND_HIT_W = 0.74, POND_HIT_H = 0.58;  // ส่วนที่เดินไม่ได้ (สัดส่วนของรูป) ให้เหลือริมฝั่งเดินได้

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// จุด (x,y) อยู่ในวงรีของแปลงหญ้า b หรือไม่
function bushContains(b, x, y) {
  const dx = (x - b.x) / b.rx, dy = (y - b.y) / b.ry;
  return dx * dx + dy * dy < 1;
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

// มอนที่ยิงกระสุนจากในพุ่ม = โผล่ชั่วคราว / มอนที่ซ่อนอยู่ในพุ่มเลือกเป็นเป้าหมายไม่ได้
(function () {
  const _enemyShoot = Main.prototype.enemyShoot;
  if (_enemyShoot) {
    Main.prototype.enemyShoot = function (e) {
      e.revealUntil = this.time.now + BUSH_REVEAL_AFTER_ATTACK;
      return _enemyShoot.call(this, e);
    };
  }
  const _updateTargeting = Main.prototype.updateTargeting;
  if (_updateTargeting) {
    Main.prototype.updateTargeting = function () {
      if (this.manualTarget && this.manualTarget.hiddenInBush) this.manualTarget = null;
      return _updateTargeting.call(this);
    };
  }
  Main.prototype.nearestEnemy = function (maxDist) {
    let best = null, bestD = maxDist === undefined ? Infinity : maxDist;
    this.enemies.getChildren().forEach(e => {
      if (e.hiddenInBush) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    });
    return best;
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
      this.ponds = this.physics.add.staticGroup();
      this.physics.add.collider(this.player, this.ponds);
      this.physics.add.collider(this.enemies, this.ponds);
      this.physics.add.overlap(this.enemyShots, this.rocks, sh => sh.destroy());
      if (PLAYER_SHOTS_BLOCKED_BY_ROCKS) {
        this.physics.add.overlap(this.projectiles, this.rocks, pr => { this.flash(pr.x, pr.y, 10, 0xaaaaaa); pr.destroy(); });
      }
    }
    this.rocks.clear(true, true);
    if (this.ponds) this.ponds.clear(true, true);
    (this.obstacleObjs || []).forEach(o => o.destroy());
    this.obstacleObjs = []; this.rockRects = []; this.pondRects = []; this.bushes = [];

    const rnd = mulberry32(1000 + z.id * 7919);
    const rand = (a, b) => a + rnd() * (b - a);
    const dist = Phaser.Math.Distance.Between;
    const M = 160;
    const farFrom = (x, y, list, d) => list.every(o => dist(x, y, o.x, o.y) > d);
    const awayFromSpawn = (x, y, d) => dist(x, y, z.x, z.y) > d;

    // บ่อน้ำ
    const pondKey = this.makePondTexture();
    const prnd = mulberry32(9000 + z.id * 6151);
    for (let tries = 0; this.pondRects.length < POND_COUNT && tries < 300; tries++) {
      const sc = 0.85 + prnd() * 0.35;
      const x = 220 + prnd() * (WORLD_W - 440), y = 180 + prnd() * (WORLD_H - 360);
      if (!awayFromSpawn(x, y, 380) || !this.pondRects.every(p => dist(x, y, p.x, p.y) > 520)) continue;
      const img = this.add.image(x, y, pondKey).setDepth(-7);
      img.setScale((POND_W * sc) / img.width);
      const vw = img.displayWidth, vh = img.displayHeight;
      const cw = vw * POND_HIT_W, ch = vh * POND_HIT_H;
      this.obstacleObjs.push(img);
      this.ponds.add(this.add.rectangle(x, y, cw, ch, 0x000000, 0));   // กล่องชน (มองไม่เห็น)
      this.pondRects.push({ x, y, w: cw, h: ch, vw, vh });
    }

    // พุ่มหญ้า (ตำแหน่ง + ขนาด)
    const cols = [0x2f7d32, 0x3f9a3f, 0x58b358];
    for (let tries = 0; this.bushes.length < BUSH_COUNT && tries < 500; tries++) {
      const r = rand(BUSH_R_MIN, BUSH_R_MAX), x = rand(M, WORLD_W - M), y = rand(M, WORLD_H - M);
      if (!awayFromSpawn(x, y, 300) || !farFrom(x, y, this.bushes, BUSH_SPACING) || this.nearPond(x, y, r * BUSH_RX + 20)) continue;
      const blobs = [];                               // ใช้เฉพาะตอนไม่มีรูปหญ้า (วาดวงกลมแทน)
      for (let i = 0; i < 8; i++) {
        const a = rnd() * Math.PI * 2, d = rand(0.15, 0.7) * r;
        blobs.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: rand(0.25, 0.4) * r, c: cols[Math.floor(rnd() * cols.length)] });
      }
      this.bushes.push({ x, y, r, rx: r * BUSH_RX, ry: r * BUSH_RY, blobs, sprites: [] });
    }

    // ก้อนหิน
    const addRock = (x, y, sz) => {
      const [key, s] = sz;
      if (x < 80 || y < 80 || x > WORLD_W - 80 || y > WORLD_H - 80) return false;
      if (!awayFromSpawn(x, y, 220) || !farFrom(x, y, this.rockRects, 130) || this.nearPond(x, y, s / 2 + 10)) return false;
      const imgKey = ROCK_IMG[key];
      if (imgKey && this.textures.exists(imgKey)) {
        // ใช้รูปหินจริง: ย่อ/ขยายให้เป็นสี่เหลี่ยม s x s (hitbox เท่ากับขนาดที่แสดง)
        this.rocks.create(x, y, imgKey).setDisplaySize(s, s).setDepth(1).refreshBody();
      } else {
        this.rocks.create(x, y, key).setDepth(1);
      }
      this.rockRects.push({ x, y, w: s, h: s });
      return true;
    };
    this.bushes.forEach(b => {                       // หินตั้งข้างพุ่ม (ที่กำบัง)
      const n = rnd() < 0.5 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const sz = ROCK_SIZES[1 + Math.floor(rnd() * 2)];
        const a = rnd() * Math.PI * 2, d = b.rx + sz[1] / 2 + 6;
        addRock(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d * (b.ry / b.rx), sz);
      }
    });
    for (let tries = 0; this.rockRects.length < ROCK_MAX && tries < 300; tries++) {  // หินเดี่ยวกระจายทั่วแมพ
      addRock(rand(M / 2, WORLD_W - M / 2), rand(M / 2, WORLD_H - M / 2), ROCK_SIZES[Math.floor(rnd() * 3)]);
    }

    this.buildNavGrid();

    // วาดพุ่มหญ้า (อยู่เหนือตัวละคร) -- ใช้รูป grass1-3 วางซ้อนกันเป็นแปลง
    const useImg = GRASS_IMG_KEYS.every(k => this.textures.exists(k));
    const g = this.add.graphics().setDepth(6);
    this.obstacleObjs.push(g);
    this.bushes.forEach(b => {
      if (!useImg) {                                  // สำรอง: ไม่มีรูปก็วาดวงกลมเขียวแบบเดิม
        g.fillStyle(0x2f7d32, 0.5).fillCircle(b.x, b.y, b.r);
        b.blobs.forEach(o => { g.fillStyle(o.c, 0.55).fillCircle(b.x + o.dx, b.y + o.dy, o.r); });
        g.lineStyle(3, 0x1f5a22, 0.7).strokeCircle(b.x, b.y, b.r);
        return;
      }
      const n = Math.max(4, Math.round(b.r / 20));
      const items = [];
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.5;
        items.push({ px: b.x + Math.cos(a) * d * b.r, py: b.y + Math.sin(a) * d * b.r * 0.8 });
      }
      items.sort((p, q) => p.py - q.py);               // กอล่างอยู่หน้ากอบน
      items.forEach(it => {
        const key = GRASS_IMG_KEYS[Math.floor(rnd() * GRASS_IMG_KEYS.length)];
        const s = this.add.image(it.px, it.py, key);
        s.setScale((b.r * (1.3 + rnd() * 0.4)) / s.width);
        if (rnd() < 0.5) s.setFlipX(true);
        s.setDepth(6 + (it.py / WORLD_H) * 0.5);
        b.sprites.push(s);
        this.obstacleObjs.push(s);
      });
    });

    this.buildFloorAndDecor(z);
  },

  // ปูพื้นด้วยรูปแทนตารางเส้นเดิม + โรยของตกแต่ง (ไม่ชน ไม่ทับหิน/พุ่มหญ้า)
  buildFloorAndDecor(z) {
    // พื้น: แทนที่ grid เดิมที่ loadStage สร้างไว้ (stageObjs[0]) ด้วย tileSprite
    if (this.textures.exists(FLOOR_KEY) && this.stageObjs) {
      const old = this.stageObjs[0];
      if (old && old.destroy) old.destroy();
      this.stageObjs[0] = this.add.tileSprite(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, FLOOR_KEY).setDepth(-10);
    }

    // ของตกแต่ง
    const rnd = mulberry32(5000 + z.id * 104729);
    const bushes = this.bushes || [];
    const free = (x, y) => {
      if (this.pointInRock(x, y, 30) || this.nearPond(x, y, 20)) return false;
      for (const b of bushes) {
        const dx = (x - b.x) / (b.rx * 1.1), dy = (y - b.y) / (b.ry * 1.1);
        if (dx * dx + dy * dy < 1) return false;
      }
      return true;
    };
    DECO_DEFS.forEach(def => {
      if (!this.textures.exists(def.key)) return;
      let placed = 0;
      for (let tries = 0; placed < def.count && tries < def.count * 8; tries++) {
        const x = 60 + rnd() * (WORLD_W - 120), y = 60 + rnd() * (WORLD_H - 120);
        if (!free(x, y)) continue;
        const s = this.add.image(x, y, def.key);
        s.setScale((def.w * (0.85 + rnd() * 0.3)) / s.width);
        if (rnd() < 0.5) s.setFlipX(true);
        if (def.rotate) s.setRotation((rnd() - 0.5) * 0.6);
        s.setDepth(def.depth);
        this.obstacleObjs.push(s);
        placed++;
      }
    });
  },

  // ---------- เส้นทาง / แนวยิง ----------
  // ตารางเดินได้ (ช่องละ 40px) ขยายขอบหินออก 20px ให้ตัวละครเดินไม่เฉี่ยว
  buildNavGrid() {
    const cell = 40, cols = Math.ceil(WORLD_W / cell), rows = Math.ceil(WORLD_H / cell), m = 20;
    const blocked = new Uint8Array(cols * rows);
    (this.rockRects || []).concat(this.pondRects || []).forEach(r => {
      const c0 = Math.max(0, Math.floor((r.x - r.w / 2 - m) / cell)), c1 = Math.min(cols - 1, Math.floor((r.x + r.w / 2 + m) / cell));
      const r0 = Math.max(0, Math.floor((r.y - r.h / 2 - m) / cell)), r1 = Math.min(rows - 1, Math.floor((r.y + r.h / 2 + m) / cell));
      for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) blocked[rr * cols + cc] = 1;
    });
    this.navGrid = { cols, rows, cell, blocked };
  },

  // เส้นตรงจาก (x1,y1) ไป (x2,y2) ชนหินตรงไหนก่อน: คืนสัดส่วน 0..1 หรือ null ถ้าไม่ชน (margin = ขยายขอบหิน)
  // (บ่อน้ำไม่บังกระสุน จึงไม่รวมในนี้)
  rayHitRock(x1, y1, x2, y2, margin) { return this._rayHitRects(this.rockRects, x1, y1, x2, y2, margin); },

  _rayHitRects(rects, x1, y1, x2, y2, margin) {
    const m = margin || 0, dx = x2 - x1, dy = y2 - y1;
    let best = null;
    for (const r of (rects || [])) {
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

  // เส้นทางเดินถูกขวางหรือไม่ (หิน + บ่อน้ำ)
  segmentBlocked(x1, y1, x2, y2, margin) {
    return this.rayHitRock(x1, y1, x2, y2, margin) !== null ||
           this._rayHitRects(this.pondRects, x1, y1, x2, y2, margin) !== null;
  },

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
    return (this.rockRects || []).concat(this.pondRects || []).some(r => Math.abs(x - r.x) < r.w / 2 + m && Math.abs(y - r.y) < r.h / 2 + m);
  },

  // คืน true ถ้าผู้เล่นซ่อนอยู่ในพุ่ม (และยังไม่ได้โจมตีเมื่อครู่)
  // เรียกทุกเฟรมจาก updateEnemies: จัดการหญ้าจางตอนเราอยู่ข้างใน + ซ่อน/แสดงมอนที่อยู่ในพุ่ม
  updatePlayerHidden(time) {
    const p = this.player;
    const bushes = this.bushes || [];
    let inBush = null;
    for (const b of bushes) { if (bushContains(b, p.x, p.y)) { inBush = b; break; } }
    const hidden = !!inBush && time >= (this.revealUntil || 0);
    this.playerHidden = hidden;
    this.playerBush = inBush;
    if (!(time < (this.invulnUntil || 0))) p.setAlpha(hidden ? BUSH_PLAYER_HIDDEN_ALPHA : 1);

    // แปลงหญ้าที่เราอยู่ข้างใน -> จางลง / แปลงอื่น -> ทึบ
    bushes.forEach(b => {
      const to = (b === inBush) ? BUSH_ALPHA_INSIDE : 1;
      (b.sprites || []).forEach(s => {
        if (s.alpha === to) return;
        s.alpha += (to - s.alpha) * 0.25;
        if (Math.abs(to - s.alpha) < 0.01) s.alpha = to;
      });
    });

    this.updateEnemyBushVisibility(time, inBush);
    return hidden;
  },

  // มอนที่อยู่ในพุ่ม: ผู้เล่นมองไม่เห็น ยกเว้นอยู่พุ่มเดียวกัน / เข้าใกล้ / เพิ่งยิงกระสุน
  updateEnemyBushVisibility(time, playerBush) {
    const p = this.player, bushes = this.bushes || [];
    this.enemies.getChildren().forEach(e => {
      let eb = null;
      for (const b of bushes) { if (bushContains(b, e.x, e.y)) { eb = b; break; } }
      let vis = true;
      if (eb) {
        vis = (eb === playerBush) ||
          Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) < BUSH_REVEAL_DIST ||
          time < (e.revealUntil || 0);
      }
      e.hiddenInBush = !vis;
      if (e.visible !== vis) e.setVisible(vis);
      if (e.levelText && e.levelText.visible !== vis) e.levelText.setVisible(vis);
    });
  },

  // จุด (x,y) อยู่ใกล้/ในบ่อน้ำหรือไม่ (ใช้ขนาดรูปเต็ม + ระยะ m)
  nearPond(x, y, m) {
    return (this.pondRects || []).some(p => Math.abs(x - p.x) < p.vw / 2 + m && Math.abs(y - p.y) < p.vh / 2 + m);
  },

  // รูปบ่อน้ำ: ใช้ assets/pond1.png ถ้าไม่มีจะวาดบ่อด้วยโค้ดแทน
  makePondTexture() {
    if (this.textures.exists('pond1')) return 'pond1';
    if (!this.textures.exists('pond_gen')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xd9c58a, 1).fillEllipse(160, 100, 316, 196);
      g.fillStyle(0x4aa3d9, 1).fillEllipse(160, 100, 270, 160);
      g.fillStyle(0x2f7fb8, 1).fillEllipse(160, 106, 200, 110);
      g.fillStyle(0xffffff, 0.5).fillEllipse(110, 70, 50, 14);
      g.lineStyle(3, 0x2a5f86, 1).strokeEllipse(160, 100, 270, 160);
      g.generateTexture('pond_gen', 320, 200);
      g.destroy();
    }
    return 'pond_gen';
  },

  nudgeOutOfRocks(it) {
    let moved = false;
    for (let pass = 0; pass < 3; pass++) {
      let hit = false;
      for (const r of (this.rockRects || []).concat(this.pondRects || [])) {
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
