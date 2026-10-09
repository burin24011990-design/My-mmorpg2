// ===== ของตกแต่งแมพใหม่ (ภาพพิกเซลธีมจีน/ญี่ปุ่น) =====
// โหลดต่อจาก obstacles.js และก่อน main.js | ไม่ต้องแก้ไฟล์เดิมเลย
// - พื้นหญ้าใหม่ (ทำให้ต่อกันไร้รอยต่อด้วยการสะท้อนภาพ)
// - ของใหญ่ที่ชนได้ (ต้นไม้ หิน ไผ่ ซากเสา ซุ้มประตู ศาลา ค่าย) + ตัวละครเดินอ้อมหลังได้
// - ของแปะพื้น (ทางหิน กอหญ้า) เดินผ่านได้
// (ลดแลค) 1) setDepth เรียกเฉพาะตอนค่าเปลี่ยนจริง (เดิมเรียกทุกเฟรมกับของทุกชิ้น ทำให้ Phaser เรียงลำดับวัตถุทั้งฉากใหม่ทุกเฟรม)
//         2) ภาพพื้นที่สร้างจากการสะท้อน ย่อให้เป็นขนาด 2 ยกกำลัง (สูงสุด 1024x1024) กินหน่วยความจำน้อยลง ลายพื้นดูเท่าเดิม

const MAP_PROP_FILES = {
  ground_new:     'assets/map/ground.png',
  ground_rebirth: 'assets/map/ground_rebirth.png',   // พื้นเขียวเข้มของด่านจุติ
  prop_gate:      'assets/map/gate.png',
  prop_pavilion:  'assets/map/pavilion.png',
  prop_tree:      'assets/map/tree.png',
  prop_rock:      'assets/map/rock.png',
  prop_bamboo:    'assets/map/bamboo.png',
  prop_ruins:     'assets/map/ruins.png',
  prop_camp:      'assets/map/camp.png',
  prop_path:      'assets/map/path.png',
  prop_tuft:      'assets/map/grass.png',
  prop_tuft_gold: 'assets/map/grass_tall.png',
};

const USE_NEW_GROUND = true;     // false = ใช้พื้นเดิม
const GROUND_TILE_SCALE = 0.7;  // ขนาดลายพื้น (น้อย = ลายเล็กลง)
const GROUND_CROP = 45;          // ตัดขอบภาพพื้นออกกี่ px (ขอบเป็นสีเหลืองจาง)
const GROUND_MAX_TEX = 1024;     // ขนาดสูงสุดของภาพพื้น (px) ต้องเป็น 256/512/1024 | เครื่องยังกระตุก -> 512
const PROP_DENSITY = 1;          // คูณจำนวนของทุกชนิด (0.5 = ครึ่งหนึ่ง)
const PROP_ORIGIN_Y = 0.88;

// ----- จัดการของเก่า (true = ทำ / false = ปล่อยไว้) -----
const REMOVE_PONDS = true;        // เอาบ่อน้ำออกทั้งหมด
const REMOVE_OLD_DECO = true;     // เอาของตกแต่งเก่าออก (deco_flower, tuft, pebble, mushroom, stump, dirt)
const REPLACE_OLD_ROCKS = true;   // เปลี่ยนรูปหินเก่าเป็น rock.png (กล่องชนคงเดิม)
const REPLACE_OLD_GRASS = true;   // เปลี่ยนรูปพุ่มหญ้าเก่าเป็น grass.png / grass_tall.png (ระบบซ่อนตัวคงเดิม)      // จุดยืนของภาพ (ส่วนล่างของวัตถุ) 0-1

// ของที่ชนได้: w = ความกว้างในเกม (px), boxes = กล่องชนที่ฐาน (สัดส่วนของความกว้างภาพ)
// ox = เลื่อนซ้าย/ขวาจากกลาง, oy = ยกสูงจากจุดยืน, w/h = ขนาดกล่อง
const PROP_DEFS = [
  { key: 'prop_tree',     w: 240, count: 8, boxes: [{ ox: 0,     oy: 0.05, w: 0.20, h: 0.09 }] },
  { key: 'prop_rock',     w: 190, count: 3, boxes: [{ ox: 0,     oy: 0.06, w: 0.50, h: 0.13 }] },
  { key: 'prop_bamboo',   w: 210, count: 5, boxes: [{ ox: 0,     oy: 0.06, w: 0.50, h: 0.12 }] },
  { key: 'prop_ruins',    w: 240, count: 3, boxes: [{ ox: -0.02, oy: 0.08, w: 0.60, h: 0.16 }] },
  { key: 'prop_gate',     w: 280, count: 2, boxes: [{ ox: -0.01, oy: 0.09, w: 0.12, h: 0.08 }, { ox: 0.27, oy: 0.12, w: 0.12, h: 0.08 }] },
  { key: 'prop_pavilion', w: 240, count: 2, boxes: [{ ox: 0,     oy: 0.10, w: 0.50, h: 0.16 }] },
  { key: 'prop_camp',     w: 320, count: 2, boxes: [{ ox: -0.30, oy: 0.08, w: 0.26, h: 0.14 }, { ox: 0.30, oy: 0.08, w: 0.30, h: 0.16 }] },
];

// ของแปะพื้น (ไม่ชน)
const GROUND_DECO_DEFS = [
  { key: 'prop_path',      w: 280, count: 6,  depth: -9 },
  { key: 'prop_tuft',      w: 110, count: 18, depth: -7.5 },
  { key: 'prop_tuft_gold', w: 130, count: 12, depth: -7.5 },
];

(function patchMapProps() {
  const P = Main.prototype;

  // ----- โหลดรูป -----
  const _preload = P.preload;
  P.preload = function () {
    if (_preload) _preload.apply(this, arguments);
    Object.keys(MAP_PROP_FILES).forEach(k => {
      if (!this.textures.exists(k)) this.load.image(k, MAP_PROP_FILES[k]);
    });
  };

  // ----- พื้นที่ต่อกันไร้รอยต่อ: ตัดขอบ แล้วต่อภาพ 2x2 แบบสะท้อน -----
  // คืนค่าสเกลที่ใช้กับ tileSprite (0 = ทำไม่ได้) | ภาพที่ได้เป็นขนาด 2 ยกกำลัง (<= GROUND_MAX_TEX)
  function makeSeamlessGround(scene, srcKey, outKey) {
    scene._groundScale = scene._groundScale || {};
    if (scene.textures.exists(outKey)) return scene._groundScale[outKey] || GROUND_TILE_SCALE;
    if (!scene.textures.exists(srcKey)) return 0;
    const src = scene.textures.get(srcKey).getSourceImage();
    const I = GROUND_CROP, S = Math.min(src.width, src.height) - I * 2;
    let OUT = 256;
    while (OUT < GROUND_MAX_TEX && OUT <= S) OUT *= 2;   // ใหญ่สุดที่ไม่เกินขนาดภาพต้นฉบับ (2 เท่าของ S หลังสะท้อน) และไม่เกิน GROUND_MAX_TEX
    const H = OUT / 2;
    const cv = scene.textures.createCanvas(outKey, OUT, OUT);
    const ctx = cv.getContext();
    const draw = (tx, ty, sx, sy) => {
      ctx.save(); ctx.translate(tx, ty); ctx.scale(sx, sy);
      ctx.drawImage(src, I, I, S, S, 0, 0, H, H);
      ctx.restore();
    };
    draw(0, 0, 1, 1);
    draw(OUT, 0, -1, 1);
    draw(0, OUT, 1, -1);
    draw(OUT, OUT, -1, -1);
    cv.refresh();
    const sc = GROUND_TILE_SCALE * (S * 2) / OUT;        // ชดเชยที่ย่อภาพ ให้ลายพื้นใหญ่เท่าเดิม
    scene._groundScale[outKey] = sc;
    return sc;
  }

  // ----- สร้างของตกแต่งหลัง buildObstacles เดิม -----
  const _build = P.buildObstacles;
  P.buildObstacles = function (idx) {
    _build.apply(this, arguments);
    const z = ZONES[idx];
    if (!z || z.town) return;
    try { this.buildMapProps(z); } catch (e) { console.warn('mapProps error', e); }
  };

  // เอาบ่อน้ำ/ของตกแต่งเก่าออก และเปลี่ยนรูปหิน+พุ่มหญ้าเก่าเป็นรูปใหม่
  function replaceOld(scene) {
    const keep = [];
    (scene.obstacleObjs || []).forEach(o => {
      const k = o.texture && o.texture.key;
      const isPond = k === 'pond1' || k === 'pond_gen';
      const isDeco = !!k && k.indexOf('deco_') === 0;
      if ((REMOVE_PONDS && isPond) || (REMOVE_OLD_DECO && isDeco)) o.destroy();
      else keep.push(o);
    });
    scene.obstacleObjs = keep;
    if (REMOVE_PONDS) {
      if (scene.ponds) scene.ponds.clear(true, true);
      scene.pondRects = [];
    }

    if (REPLACE_OLD_ROCKS && scene.textures.exists('prop_rock')) {
      scene.rocks.getChildren().slice().forEach(c => {
        if (c.type !== 'Sprite' && c.type !== 'Image') return;
        const sz = Math.max(c.displayWidth, c.displayHeight);
        c.setAlpha(0);                                   // เก็บไว้เป็นกล่องชน
        const by = c.y + sz * 0.35;
        const img = scene.add.image(c.x, by, 'prop_rock').setOrigin(0.5, PROP_ORIGIN_Y);
        img.setScale((sz * 1.8) / img.height);
        if (((c.x * 7) | 0) % 2) img.setFlipX(true);
        img.baseY = by;
        scene.obstacleObjs.push(img);
        scene.propSprites.push(img);
      });
    }

    if (REPLACE_OLD_GRASS && scene.textures.exists('prop_tuft')) {
      (scene.bushes || []).forEach((b, bi) => (b.sprites || []).forEach((sp, i) => {
        const dw = sp.displayWidth;
        const gold = (bi + i) % 2 === 1 && scene.textures.exists('prop_tuft_gold');
        sp.setTexture(gold ? 'prop_tuft_gold' : 'prop_tuft');
        sp.setScale(dw / sp.width);
      }));
    }
  }

  P.buildMapProps = function (z) {
    this.propSprites = [];
    replaceOld(this);

    // พื้น
    if (USE_NEW_GROUND) {
      const rebirth = !!z.reqRebirth;                       // ด่านจุติทั้งหมด (id 10-22) ใช้พื้นเขียวเข้ม
      const src = rebirth ? 'ground_rebirth' : 'ground_new';
      const out = rebirth ? 'ground_seam_rb' : 'ground_seam';
      const gsc = makeSeamlessGround(this, src, out);
      if (gsc) {
        const f = this.stageObjs && this.stageObjs[0];
        if (f && f.setTexture) { f.setTexture(out); f.setTileScale(gsc); }
      }
    }

    const rnd = mulberry32(20000 + z.id * 3571);
    const dist = Phaser.Math.Distance.Between;
    const bushes = this.bushes || [];
    const placed = [];

    const clear = (x, y, r) => {
      if (dist(x, y, z.x, z.y) < 340 + r) return false;
      if (this.pointInRock(x, y, r) || this.nearPond(x, y, r)) return false;
      for (const b of bushes) {
        const dx = (x - b.x) / (b.rx + r), dy = (y - b.y) / (b.ry + r);
        if (dx * dx + dy * dy < 1) return false;
      }
      return placed.every(p => dist(x, y, p.x, p.y) > p.r + r);
    };

    // ของใหญ่ที่ชนได้
    PROP_DEFS.forEach(def => {
      if (!this.textures.exists(def.key)) return;
      const want = Math.round(def.count * PROP_DENSITY);
      let n = 0;
      for (let t = 0; n < want && t < want * 40; t++) {
        const sc = 0.9 + rnd() * 0.2, dw = def.w * sc;
        const x = 160 + rnd() * (WORLD_W - 320), y = 200 + rnd() * (WORLD_H - 300);
        const r = dw * 0.36;
        if (!clear(x, y, r)) continue;

        const img = this.add.image(x, y, def.key).setOrigin(0.5, PROP_ORIGIN_Y);
        img.setScale(dw / img.width);
        if (rnd() < 0.5) img.setFlipX(true);
        img.baseY = y;
        this.obstacleObjs.push(img);
        this.propSprites.push(img);

        def.boxes.forEach(b => {
          const ox = (img.flipX ? -b.ox : b.ox) * dw;
          const bw = b.w * dw, bh = b.h * dw;
          const cx = x + ox, cy = y - b.oy * dw;
          const hb = this.add.rectangle(cx, cy, bw, bh, 0x000000, 0);
          this.obstacleObjs.push(hb);
          this.rocks.add(hb);
          this.rockRects.push({ x: cx, y: cy, w: bw, h: bh });
        });
        placed.push({ x, y, r });
        n++;
      }
    });

    // ของแปะพื้น
    GROUND_DECO_DEFS.forEach(def => {
      if (!this.textures.exists(def.key)) return;
      const want = Math.round(def.count * PROP_DENSITY);
      let n = 0;
      for (let t = 0; n < want && t < want * 10; t++) {
        const x = 80 + rnd() * (WORLD_W - 160), y = 80 + rnd() * (WORLD_H - 160);
        if (this.pointInRock(x, y, 30) || this.nearPond(x, y, 20)) continue;
        const s = this.add.image(x, y, def.key);
        s.setScale((def.w * (0.85 + rnd() * 0.3)) / s.width);
        if (rnd() < 0.5) s.setFlipX(true);
        s.setDepth(def.depth);
        this.obstacleObjs.push(s);
        n++;
      }
    });

    this.buildNavGrid();   // ให้บอท/มอนเดินอ้อมของใหม่
  };

  // ----- เรียงลำดับหน้า-หลังกับตัวละคร (เรียกทุกเฟรม) -----
  // เรียก setDepth เฉพาะตอนค่าเปลี่ยนจริง: setDepth ของ Phaser สั่งให้เรียงลำดับวัตถุทั้งฉากใหม่ทุกครั้งที่เรียก แม้ค่าเท่าเดิม
  const _upd = P.updatePlayerHidden;
  P.updatePlayerHidden = function (time) {
    const res = _upd.apply(this, arguments);
    const pl = this.player, list = this.propSprites;
    if (pl && list) {
      const pd = pl.depth || 0;
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const want = pl.y < s.baseY ? pd + 0.5 : pd - 0.5;
        if (s.depth !== want) s.setDepth(want);
      }
    }
    return res;
  };
})();
