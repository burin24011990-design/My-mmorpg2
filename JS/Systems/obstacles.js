// ===== พุ่มหญ้า + ก้อนหิน (สไตล์ ROV) =====
// พุ่มหญ้า: ผู้เล่นเดินเข้าไปแล้วโปร่งใส มอนที่ห่างเกิน BUSH_REVEAL_DIST มองไม่เห็น + กระสุนมอนจากไกลถูกบัง
//           โจมตีแล้วจะโผล่ชั่วคราว (BUSH_REVEAL_AFTER_ATTACK)
// ก้อนหิน: ตันเดินผ่านไม่ได้ (ผู้เล่น+มอน) และบังกระสุนของมอนยิงไกล (กระสุนผู้เล่นบินข้ามได้)
// ตำแหน่งสุ่มแบบคงที่ตามหมายเลขด่าน (ทุกครั้ง/ทุกคนเห็นเหมือนกัน)
// โหลดต่อจาก monsters.js

const ROCK_SIZES = [['rock_s', 56], ['rock_m', 84], ['rock_l', 116]];
const BUSH_COUNT = 18;
const ROCK_MAX = 30;

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

    // วาดพุ่มหญ้า (อยู่เหนือตัวละคร โปร่งแสงครึ่งหนึ่ง)
    const g = this.add.graphics().setDepth(6);
    this.bushes.forEach(b => {
      g.fillStyle(0x2f7d32, 0.5).fillCircle(b.x, b.y, b.r);
      b.blobs.forEach(o => { g.fillStyle(o.c, 0.55).fillCircle(b.x + o.dx, b.y + o.dy, o.r); });
      g.lineStyle(3, 0x1f5a22, 0.7).strokeCircle(b.x, b.y, b.r);
    });
    this.obstacleObjs.push(g);
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
