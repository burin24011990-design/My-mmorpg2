// ===== ธีมแมพต่อด่าน (ใช้รูปที่เจนเอง) =====
// ไฟล์: js/systems/zoneThemes.js | โหลดต่อจาก mapProps.js และก่อน main.js
// ด่านที่รองรับ: ด่าน id 2-9 (โฟลเดอร์ z2..z9) + ด่านจุติขั้น 19/21/23/24 (โฟลเดอร์ zr19, zr21, zr23, zr24)
// ด่านอื่น (ด่าน 1, จุติขั้นอื่น, เมือง) ใช้หน้าตาเดิมทั้งหมด
// แต่ละโฟลเดอร์ใน assets/map/ ต้องมี: ground tree rock ruins gate camp grass (.png)
//
// ทำอะไรบ้าง
//  1) พื้น: สลับเป็น ground.png ของด่านนั้น (ทำให้ต่อกันไร้รอยต่อให้ด้วยการสะท้อนภาพ)
//  2) พร็อพ 6 ชนิดเท่านั้น: tree / rock / ruins / gate / camp / grass (ตัด bamboo, pavilion, path, ของแปะพื้นออกหมด)
//  3) ตัดขอบโปร่งใสของรูปอัตโนมัติ + ลบพื้นหลังสีชมพู #FF00FF ให้ ถ้าลบไม่หมด
//  4) โหลดรูปทีละด่านตอนเข้าด่าน และคืนหน่วยความจำของด่านก่อนหน้า (มือถือไม่แลค)
//  5) จำนวนของปรับตามขนาดแมพอัตโนมัติ (อ่านจาก WORLD_W / WORLD_H)
//  6) กล่องชน + ระบบหลบหลังของ ใช้ระบบเดิมของ mapProps.js

const ZT_ENABLED = true;          // false = ปิดทั้งระบบ กลับไปหน้าตาเดิม
const ZT_BASE = 'assets/map/';
const ZT_EXT = 'png';
const ZT_VER = 1;                 // แก้รูปแล้วมือถือยังเห็นรูปเก่า -> เพิ่มเลขนี้

const ZT_FILES = ['ground', 'tree', 'rock', 'ruins', 'gate', 'camp', 'grass'];
const ZT_NORMAL = { 2: 'z2', 3: 'z3', 4: 'z4', 5: 'z5', 6: 'z6', 7: 'z7', 8: 'z8', 9: 'z9' };   // id ด่าน -> โฟลเดอร์
const ZT_REBIRTH = { 19: 'zr19', 21: 'zr21', 23: 'zr23', 24: 'zr24' };                          // ขั้นจุติ -> โฟลเดอร์
const ZT_ALL = Object.keys(ZT_NORMAL).map(function (k) { return ZT_NORMAL[k]; })
  .concat(Object.keys(ZT_REBIRTH).map(function (k) { return ZT_REBIRTH[k]; }));

// ----- ปรับแต่ง (แก้ตรงนี้) -----
const ZT_GROUND_SCALE = 1;        // ขนาดลายพื้น (1 = ภาพ 1024px ปูเป็น 1024px ในเกม | น้อย = ลายเล็กลง)
const ZT_GROUND_MIRROR = true;    // true = สะท้อนภาพ 2x2 ให้ต่อกันไร้รอยต่อ (ปลอดภัย) | false = ปูภาพตรงๆ ถ้ารูปพื้นต่อกันได้ดีอยู่แล้ว
const ZT_GROUND_CROP = 12;        // ตัดขอบรูปพื้นออกกี่ px ก่อนสะท้อน (กันขอบกระด้าง)
const ZT_ROCK_KEEP = 0.5;         // สัดส่วนหินเดิมที่เก็บไว้ (0.5 = เหลือครึ่งหนึ่ง) ลดความรก
const ZT_DENSITY = 1;             // คูณจำนวน tree/ruins/gate/camp (0.5 = ครึ่งหนึ่ง)
const ZT_ORIGIN_Y = 0.95;         // จุดยืนของรูปที่ตัดขอบแล้ว (ฐานวัตถุ) 0-1
const ZT_KEY_MAGENTA = true;      // ลบพื้นหลังสีชมพูที่เหลือ
const ZT_PROP_MAX = 512;          // ย่อรูปพร็อพไม่ให้ใหญ่กว่านี้ (px) ประหยัดหน่วยความจำ
const ZT_SIZE_MUL = { tree: 1, rock: 1, ruins: 1, gate: 1, camp: 1, grass: 1 };   // คูณขนาดแต่ละชนิด (รูปเล็กไป -> ใส่ 1.2)

// ของที่วางเพิ่ม (ชนได้) | w = ความกว้างในเกม (px) | count = จำนวนต่อแมพขนาดเดิม (3600x2250)
// boxes = กล่องชนที่ฐาน (สัดส่วนของความกว้าง) ox = เลื่อนซ้าย/ขวา, oy = ยกสูง
const ZT_PROPS = [
  { name: 'tree',  w: 300, count: 6, boxes: [{ ox: 0, oy: 0.04, w: 0.20, h: 0.08 }] },
  { name: 'ruins', w: 300, count: 2, boxes: [{ ox: 0, oy: 0.05, w: 0.55, h: 0.14 }] },
  { name: 'gate',  w: 340, count: 1, boxes: [{ ox: -0.30, oy: 0.05, w: 0.12, h: 0.07 }, { ox: 0.30, oy: 0.05, w: 0.12, h: 0.07 }] },
  { name: 'camp',  w: 320, count: 2, boxes: [{ ox: 0, oy: 0.05, w: 0.50, h: 0.12 }] },
];
// รูปชั่วคราวที่ใช้ระหว่างรอโหลดรูปของด่าน (ของเดิมใน mapProps.js)
const ZT_FALLBACK = { tree: 'prop_tree', ruins: 'prop_ruins', gate: 'prop_gate', camp: 'prop_camp' };

// ---------- ตัวช่วย ----------
function ztKey(folder, name) { return 'zt_' + folder + '_' + name; }

function ztFolder(z) {
  if (!z || z.town) return null;
  if (z.reqRebirth) return ZT_REBIRTH[z.reqRebirth] || null;
  return ZT_NORMAL[z.id] || null;
}

function ztArea() {
  return (WORLD_W * WORLD_H) / (3600 * 2250);
}

// รูปพื้น: ต่อกันไร้รอยต่อ + ขนาดเป็นเลขยกกำลัง 2
function ztGroundTex(sc, folder) {
  const raw = ztKey(folder, 'ground'), out = raw + '_g';
  if (sc.textures.exists(out)) return out;
  if (!sc.textures.exists(raw)) return null;
  try {
    const src = sc.textures.get(raw).getSourceImage();
    let OUT = 256;
    if (ZT_GROUND_MIRROR) {
      const I = ZT_GROUND_CROP, S = Math.min(src.width, src.height) - I * 2;
      while (OUT < 1024 && OUT <= S) OUT *= 2;
      const H = OUT / 2;
      const t = sc.textures.createCanvas(out, OUT, OUT), c = t.getContext();
      const draw = function (tx, ty, sx, sy) {
        c.save(); c.translate(tx, ty); c.scale(sx, sy);
        c.drawImage(src, I, I, S, S, 0, 0, H, H);
        c.restore();
      };
      draw(0, 0, 1, 1); draw(OUT, 0, -1, 1); draw(0, OUT, 1, -1); draw(OUT, OUT, -1, -1);
      t.refresh();
    } else {
      const pot = function (n) { return (n & (n - 1)) === 0; };
      if (pot(src.width) && pot(src.height)) return raw;
      OUT = 1024;
      const t = sc.textures.createCanvas(out, OUT, OUT);
      t.getContext().drawImage(src, 0, 0, src.width, src.height, 0, 0, OUT, OUT);
      t.refresh();
    }
    return out;
  } catch (e) { console.warn('zoneThemes ground', e); return raw; }
}

// รูปพร็อพ: ลบพื้นหลังชมพู + ตัดขอบโปร่งใส + ย่อให้ไม่ใหญ่เกิน
function ztPropTex(sc, folder, name) {
  const raw = ztKey(folder, name), out = raw + '_p';
  if (sc.textures.exists(out)) return out;
  if (!sc.textures.exists(raw)) return null;
  try {
    const src = sc.textures.get(raw).getSourceImage();
    const w = src.width, h = src.height;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(src, 0, 0);
    const im = cx.getImageData(0, 0, w, h), d = im.data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (ZT_KEY_MAGENTA && d[i] > 200 && d[i + 2] > 200 && d[i + 1] < 90) d[i + 3] = 0;
        if (d[i + 3] > 16) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return raw;
    cx.putImageData(im, 0, 0);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const s = Math.min(1, ZT_PROP_MAX / Math.max(bw, bh));
    const ow = Math.max(1, Math.round(bw * s)), oh = Math.max(1, Math.round(bh * s));
    const t = sc.textures.createCanvas(out, ow, oh), c = t.getContext();
    c.imageSmoothingEnabled = true;
    c.drawImage(cv, x0, y0, bw, bh, 0, 0, ow, oh);
    t.refresh();
    return out;
  } catch (e) { console.warn('zoneThemes prop', name, e); return raw; }
}

// คืนหน่วยความจำของด่านอื่น (keep = โฟลเดอร์ที่ยังใช้อยู่)
function ztPurge(sc, keep) {
  ZT_ALL.forEach(function (f) {
    if (f === keep) return;
    ZT_FILES.forEach(function (n) {
      const k = ztKey(f, n);
      [k, k + '_p', k + '_g'].forEach(function (x) { if (sc.textures.exists(x)) sc.textures.remove(x); });
    });
    if (sc._ztTried) delete sc._ztTried[f];
  });
}

// ใส่รูปจริงให้พื้น + พร็อพทุกชิ้นที่ลงทะเบียนไว้ (เรียกซ้ำได้ ตอนรูปโหลดเสร็จทีละไฟล์)
function ztSkinAll(sc, folder, list) {
  const gk = ztGroundTex(sc, folder);
  if (gk) {
    const f = sc.stageObjs && sc.stageObjs[0];
    if (f && f.scene && f.setTexture) { f.setTexture(gk); f.setTileScale(ZT_GROUND_SCALE, ZT_GROUND_SCALE); }
  }
  list.forEach(function (o) {
    const im = o.img;
    if (!im || !im.scene) return;
    const k = ztPropTex(sc, folder, o.name);
    if (!k) return;
    const mul = ZT_SIZE_MUL[o.name] || 1;
    im.setTexture(k);
    if (o.w) im.setScale(o.w * mul / im.width); else im.setScale(o.h * mul / im.height);
    if (o.name !== 'grass') im.setOrigin(0.5, ZT_ORIGIN_Y);
  });
}

// ---------- ครอบ buildMapProps ของ mapProps.js ----------
(function patchZoneThemes() {
  const P = Main.prototype;
  const _bmp = P.buildMapProps;
  if (typeof _bmp !== 'function') { console.warn('zoneThemes: ต้องโหลดหลัง mapProps.js'); return; }

  P.buildMapProps = function (z) {
    const folder = ZT_ENABLED ? ztFolder(z) : null;
    if (!folder) {                               // ด่านที่ไม่มีธีม: ทำแบบเดิม + คืนหน่วยความจำของธีมเก่า
      const r = _bmp.call(this, z);
      ztPurge(this, null);
      return r;
    }
    const sc = this;
    ztPurge(sc, folder);

    // 1) ให้ mapProps ทำงานเดิม (พื้น เอาบ่อ/ของเก่าออก เปลี่ยนรูปหิน+หญ้า) โดยไม่วางพร็อพชุดเดิมและของแปะพื้น
    const spP = PROP_DEFS.splice(0), spG = GROUND_DECO_DEFS.splice(0);
    try { _bmp.call(sc, z); }
    finally { PROP_DEFS.push.apply(PROP_DEFS, spP); GROUND_DECO_DEFS.push.apply(GROUND_DECO_DEFS, spG); }

    // 2) ลดจำนวนหิน (กล่องชน + รูป + rockRects ต้องตรงกันทุกชิ้น)
    const kids = sc.rocks.getChildren().slice(), ps = sc.propSprites || [];
    if (kids.length === ps.length && kids.length === sc.rockRects.length) {
      const rr = mulberry32(30000 + z.id * 977);
      const keepR = [], keepP = [];
      kids.forEach(function (c, i) {
        if (rr() < ZT_ROCK_KEEP) { keepR.push(sc.rockRects[i]); keepP.push(ps[i]); }
        else { c.destroy(); ps[i].destroy(); }
      });
      sc.rockRects = keepR;
      sc.propSprites = keepP;
      sc.obstacleObjs = sc.obstacleObjs.filter(function (o) { return !!o.scene; });
    }

    // 3) รายการที่จะใส่รูปธีม
    const list = [];
    sc._ztSk = list;
    sc.propSprites.forEach(function (im) { list.push({ img: im, name: 'rock', h: im.displayHeight }); });

    // 4) วางพร็อพของธีม (ชนได้)
    const rnd = mulberry32(40000 + z.id * 3571);
    const dist = Phaser.Math.Distance.Between;
    const bushes = sc.bushes || [];
    const placed = [];
    const clear = function (x, y, r) {
      if (dist(x, y, z.x, z.y) < 340 + r) return false;
      if (sc.pointInRock(x, y, r) || sc.nearPond(x, y, r)) return false;
      for (let i = 0; i < bushes.length; i++) {
        const b = bushes[i];
        const dx = (x - b.x) / (b.rx + r), dy = (y - b.y) / (b.ry + r);
        if (dx * dx + dy * dy < 1) return false;
      }
      return placed.every(function (p) { return dist(x, y, p.x, p.y) > p.r + r; });
    };
    const factor = Math.pow(ztArea(), 0.75) * ZT_DENSITY;   // แมพใหญ่ขึ้น 4 เท่า (พื้นที่) ของเพิ่มประมาณ 2.8 เท่า ไม่แน่นเกิน

    ZT_PROPS.forEach(function (def) {
      const want = Math.max(1, Math.round(def.count * factor));
      const themed = ztPropTex(sc, folder, def.name);
      const key = themed || ZT_FALLBACK[def.name];
      if (!key || !sc.textures.exists(key)) return;
      let n = 0;
      for (let t = 0; n < want && t < want * 40; t++) {
        const dw = def.w * (0.9 + rnd() * 0.2);
        const x = 200 + rnd() * (WORLD_W - 400), y = 260 + rnd() * (WORLD_H - 380);
        const r = dw * 0.36;
        if (!clear(x, y, r)) continue;

        const img = sc.add.image(x, y, key).setOrigin(0.5, themed ? ZT_ORIGIN_Y : 0.88);
        img.setScale(dw / img.width);
        if (rnd() < 0.5) img.setFlipX(true);
        img.baseY = y;
        sc.obstacleObjs.push(img);
        sc.propSprites.push(img);
        list.push({ img: img, name: def.name, w: dw });

        def.boxes.forEach(function (b) {
          const ox = (img.flipX ? -b.ox : b.ox) * dw;
          const bw = b.w * dw, bh = b.h * dw;
          const cx = x + ox, cy = y - b.oy * dw;
          const hb = sc.add.rectangle(cx, cy, bw, bh, 0x000000, 0);
          sc.obstacleObjs.push(hb);
          sc.rocks.add(hb);
          sc.rockRects.push({ x: cx, y: cy, w: bw, h: bh });
        });
        placed.push({ x: x, y: y, r: r });
        n++;
      }
    });

    // 5) พุ่มหญ้า (ระบบซ่อนตัวเดิมยังทำงานเหมือนเดิม)
    bushes.forEach(function (b) {
      (b.sprites || []).forEach(function (sp) { list.push({ img: sp, name: 'grass', w: sp.displayWidth }); });
    });

    sc.buildNavGrid();   // ให้บอท/มอนเดินอ้อมของใหม่

    // 6) โหลดรูปของด่านนี้ (เฉพาะที่ยังไม่มี) แล้วใส่ให้ทีละไฟล์ที่โหลดเสร็จ
    const missing = ZT_FILES.filter(function (n) { return !sc.textures.exists(ztKey(folder, n)); });
    sc._ztTried = sc._ztTried || {};
    if (missing.length && !sc._ztTried[folder]) {
      sc._ztTried[folder] = true;
      missing.forEach(function (n) {
        sc.load.image(ztKey(folder, n), ZT_BASE + folder + '/' + n + '.' + ZT_EXT + '?v=' + ZT_VER);
      });
      const onFile = function (key) {
        if (sc._ztSk === list && String(key).indexOf('zt_' + folder + '_') === 0) ztSkinAll(sc, folder, list);
      };
      sc.load.on('filecomplete', onFile);
      sc.load.once('complete', function () {
        sc.load.off('filecomplete', onFile);
        if (sc._ztSk === list) ztSkinAll(sc, folder, list);
      });
      if (sc.load.isReady()) sc.load.start();
    }
    ztSkinAll(sc, folder, list);   // ใส่ของที่โหลดไว้แล้วทันที (ย้อนกลับมาด่านเดิมโดยไม่ได้ล้างแคช)
  };
})();
