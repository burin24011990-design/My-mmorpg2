// ===== ข้อมูลมอนสเตอร์ 27 ตัว (9 ด่าน x ธรรมดา/ยิงไกล/บอส) =====
// วิธีใส่ sprite sheet เมื่อวาดเสร็จ:
//  1) เอาไฟล์ PNG ไปไว้ที่ assets/monsters/ ตั้งชื่อ z1_normal.png, z1_ranged.png, z1_boss.png ... z9_boss.png
//  2) เพิ่มชื่อลงใน MONSTER_SHEETS_READY ด้านล่าง เช่น ['z1_normal', 'z1_ranged'] หรือทั้งด่าน ['z1'] หรือทั้งหมด ['all']
// รูปแบบ sprite sheet: 12 เฟรมเรียงแนวนอน = 0-3 idle, 4-7 attack, 8-11 walk
//   ธรรมดา/ยิงไกล: เฟรมละ 48x48 (แผ่นรวม 576x48) | บอส: เฟรมละ 64x64 (แผ่นรวม 768x64)
// วาดให้มอนสเตอร์หันหน้า "ไปทางขวา" (เกมจะกลับด้านเองเมื่อเดินไปซ้าย)
const MONSTER_SHEETS_READY = ['z1', 'z2', 'z3'];   // ด่านที่มี sprite พร้อมแล้ว (เพิ่มทีละด่าน)

// ขนาดตัวมอนสเตอร์ (ตัวคูณ) แยกตามด่าน 1-9 : แก้เลขตรงนี้ได้เลย
// ด่าน 1-4 ขนาดปกติ | ด่าน 5 ขึ้นไปใหญ่ขึ้นเรื่อยๆ | บอสใหญ่กว่ามอนธรรมดาเสมอ
// (hitbox และระยะตีจะขยายตามขนาดอัตโนมัติ)
const MONSTER_SIZE_NORMAL = [1.0, 1.0, 1.0, 1.0, 1.25, 1.4, 1.55, 1.7, 1.85];  // ธรรมดา + ยิงไกล
const MONSTER_SIZE_BOSS   = [1.5, 1.5, 1.5, 1.5, 1.9,  2.1, 2.3,  2.5, 2.8];   // มินิบอส

const MONSTER_ANIM_RANGES = { idle: [0, 3], attack: [4, 7], walk: [8, 11] };
const MONSTER_ANIM_FPS = { idle: 6, attack: 12, walk: 8 };

// เอฟเฟกต์ตอนตาย: สี/ความเร็ว/แรงโน้มถ่วงของอนุภาค + ท่าของร่างที่กำลังตาย (tween)
const DEATH_FX = {
  melt:   { colors: [0x6bd66b, 0xa8f0a8, 0x3f8f3f], speed: [20, 80],  gravity: 0,    life: 600, qty: 14, tween: 'melt' },   // ละลาย + ใบไม้ปลิว
  web:    { colors: [0xffffff, 0xcccccc, 0x888888], speed: [20, 60],  gravity: 0,    life: 700, qty: 12, tween: 'flip' },   // ขาหดพลิกหงาย
  bubble: { colors: [0x9acd32, 0xd4e157, 0x6b8e23], speed: [10, 50],  gravity: -60,  life: 800, qty: 14, tween: 'pop' },    // ฟองพิษผุดแล้วแตก
  rock:   { colors: [0x8a7a6a, 0x5a4a3a, 0xb0a090], speed: [60, 160], gravity: 400,  life: 700, qty: 16, tween: 'shatter' }, // หินแตกร่วง
  sand:   { colors: [0xe6c27a, 0xc9a24d, 0xf2dc9b], speed: [20, 70],  gravity: 120,  life: 800, qty: 18, tween: 'melt' },   // ทรายไหลสลาย
  fire:   { colors: [0xff7a1a, 0xffd23d, 0xff3a1a], speed: [80, 200], gravity: -40,  life: 600, qty: 20, tween: 'pop' },    // ระเบิดประกายไฟ
  ice:    { colors: [0xbfeaff, 0xffffff, 0x7ad1ff], speed: [80, 180], gravity: 200,  life: 600, qty: 18, tween: 'shatter' }, // แข็งแล้วแตกเป็นเกล็ด
  bone:   { colors: [0xf0f0e0, 0xbbbbaa, 0x888877], speed: [80, 180], gravity: 450,  life: 700, qty: 16, tween: 'shatter' }, // กระดูกกระจาย
  smoke:  { colors: [0x9a3ae0, 0x5a1a8a, 0x2a0a3a], speed: [20, 60],  gravity: -50,  life: 900, qty: 16, tween: 'fade' },   // ควันม่วงลอยขึ้น
};

// ตารางหลัก: [ด่าน] -> { normal, ranged, boss } | color = สีวงกลมสำรอง | ability = เก็บไว้เขียนโค้ดความสามารถทีหลัง
const _MONSTER_TABLE = [
  { // ด่าน 1 ทุ่งหญ้า
    fx: 'melt',
    normal: { name: 'สไลม์ใบไม้',     color: 0x6bd66b, ability: 'contact' },
    ranged: { name: 'สไลม์พ่นเมล็ด',  color: 0xb8e06b, ability: 'seed_shot' },
    boss:   { name: 'ราชาสไลม์',      color: 0x3fae3f, ability: 'jump_slam' },
  },
  { // ด่าน 2 ป่าลึก
    fx: 'web',
    normal: { name: 'หนอนใยไหม',      color: 0xd8e8c8, ability: 'slow_touch_20' },
    ranged: { name: 'แมงมุมพ่นใย',    color: 0x7a8a7a, ability: 'web_shot_slow' },
    boss:   { name: 'ราชินีแมงมุม',   color: 0x3a5a4a, ability: 'summon_spiders' },
  },
  { // ด่าน 3 หนองพิษ
    fx: 'bubble',
    normal: { name: 'กบหนอง',         color: 0x9acd32, ability: 'poison_touch', sizeMul: 1.06 },
    ranged: { name: 'สไลม์พ่นกรด',    color: 0xd4e157, ability: 'acid_pool_shot', sizeMul: 1.12 },
    boss:   { name: 'จระเข้โคลน',     color: 0x6b5a2a, ability: 'line_charge', sizeMul: 1.22 },
  },
  { // ด่าน 4 ถ้ำหิน
    fx: 'rock',
    normal: { name: 'ค้างคาวถ้ำ',     color: 0x6a4a5a, ability: 'fast_lifesteal' },
    ranged: { name: 'ก๊อบลินขว้างหิน', color: 0x8a9a4a, ability: 'rock_throw_arc' },
    boss:   { name: 'โกเลมหิน',       color: 0x8a7a6a, ability: 'ground_slam_wide' },
  },
  { // ด่าน 5 ทะเลทราย
    fx: 'sand',
    normal: { name: 'แมงป่องทราย',    color: 0xe6c27a, ability: 'tail_poison' },
    ranged: { name: 'กระบองเพชรยิงหนาม', color: 0x4fae6f, ability: 'thorn_fan_3' },
    boss:   { name: 'ฟาโรห์มัมมี่',   color: 0xc9b98a, ability: 'dash_sandstorm' },
  },
  { // ด่าน 6 ภูเขาไฟ
    fx: 'fire',
    normal: { name: 'สไลม์ลาวา',      color: 0xff7a1a, ability: 'fire_patch_on_death' },
    ranged: { name: 'ภูตเพลิง',       color: 0xffd23d, ability: 'exploding_fireball' },
    boss:   { name: 'มังกรลาวา',      color: 0xc0301a, ability: 'flame_line_ring' },
  },
  { // ด่าน 7 ทุ่งน้ำแข็ง
    fx: 'ice',
    normal: { name: 'มนุษย์หิมะ',     color: 0xf0f8ff, ability: 'slow_touch_30' },
    ranged: { name: 'ภูตน้ำแข็ง',     color: 0x7ad1ff, ability: 'ice_shard_freeze' },
    boss:   { name: 'หมาป่าน้ำแข็ง',  color: 0x9ab8d8, ability: 'fast_dash_blizzard' },
  },
  { // ด่าน 8 สุสาน
    fx: 'bone',
    normal: { name: 'โครงกระดูก',     color: 0xe8e8d8, ability: 'revive_once_half_hp' },
    ranged: { name: 'ผีวิญญาณ',       color: 0xaaccff, ability: 'soul_shot_pierce', fx: 'smoke' },
    boss:   { name: 'อัศวินไร้หัว',   color: 0x4a4f5a, ability: 'slash_radius_lifesteal' },
  },
  { // ด่าน 9 ปราสาทปีศาจ
    fx: 'smoke',
    normal: { name: 'อิมป์',          color: 0xd03a5a, ability: 'blink_behind_player' },
    ranged: { name: 'จอมเวทปีศาจ',    color: 0x8a3ad0, ability: 'multi_spell_heal_allies' },
    boss:   { name: 'ลอร์ดปีศาจ',     color: 0x3a0a4a, ability: 'all_skills_enrage_30pct' },
  },
];

// สร้าง MONSTER_DEFS[zoneIdx][kind] = { id, key, name, color, fx, ability, fw, fh, frames, hasSheet }
const MONSTER_DEFS = _MONSTER_TABLE.map((zt, zi) => {
  const out = {};
  ['normal', 'ranged', 'boss'].forEach(kind => {
    const m = zt[kind];
    const boss = kind === 'boss';
    out[kind] = {
      id: 'z' + (zi + 1) + '_' + kind,
      key: 'mon_z' + (zi + 1) + '_' + kind,
      name: m.name, color: m.color, ability: m.ability,
      fx: m.fx || zt.fx,
      fw: boss ? 64 : 48, fh: boss ? 64 : 48,
      kind: kind, zone: zi,
      frames: 12, hasSheet: false,
      scale: ((boss ? MONSTER_SIZE_BOSS : MONSTER_SIZE_NORMAL)[zi] || 1) * (m.sizeMul || 1),
    };
  });
  return out;
});

function getMonsterDef(zi, kind) {
  const z = MONSTER_DEFS[zi] || MONSTER_DEFS[0];
  return z[kind] || z.normal;
}

function _monsterSheetReady(def) {
  const L = MONSTER_SHEETS_READY;
  return L.indexOf('all') >= 0 || L.indexOf('z' + (def.zone + 1)) >= 0 || L.indexOf(def.id) >= 0;
}

// เรียกใน preload() ของ Main.js (ถ้า MONSTER_SHEETS_READY ว่าง จะไม่โหลดอะไร)
function preloadMonsterSprites(scene) {
  MONSTER_DEFS.forEach(z => Object.keys(z).forEach(k => {
    const d = z[k];
    if (_monsterSheetReady(d)) {
      scene.load.spritesheet(d.key, 'assets/monsters/' + d.id + '.png?v=1', { frameWidth: d.fw, frameHeight: d.fh });
    }
  }));
}

// สร้าง texture สำรอง (วงกลมสี) + anim ให้ทุกตัว เรียกซ้ำได้ปลอดภัย
function ensureMonsterTextures(scene) {
  if (scene._monsterTexDone) return;
  scene._monsterTexDone = true;
  const g = scene.make.graphics({ add: false });
  MONSTER_DEFS.forEach(z => Object.keys(z).forEach(k => {
    const d = z[k];
    const tex = scene.textures.exists(d.key) ? scene.textures.get(d.key) : null;
    if (tex && tex.frameTotal > d.frames) {           // มี sprite sheet จริง
      d.hasSheet = true;
      Object.keys(MONSTER_ANIM_RANGES).forEach(name => {
        const ak = d.key + '_' + name;
        if (scene.anims.exists(ak)) return;
        const r = MONSTER_ANIM_RANGES[name];
        scene.anims.create({
          key: ak,
          frames: scene.anims.generateFrameNumbers(d.key, { start: r[0], end: r[1] }),
          frameRate: MONSTER_ANIM_FPS[name],
          repeat: name === 'attack' ? 0 : -1,
        });
      });
      return;
    }
    if (tex) return;                                   // มี texture สำรองอยู่แล้ว
    g.clear();
    if (d.kind === 'boss') {
      g.fillStyle(d.color).fillCircle(28, 30, 26).lineStyle(4, 0xffd23d, 1).strokeCircle(28, 30, 26)
        .fillStyle(0xffd23d).fillTriangle(12, 12, 18, 2, 24, 12).fillTriangle(24, 12, 28, 0, 32, 12).fillTriangle(32, 12, 38, 2, 44, 12)
        .fillStyle(0x1a0a2a).fillCircle(20, 30, 4).fillCircle(36, 30, 4).generateTexture(d.key, 56, 58);
    } else if (d.kind === 'ranged') {
      g.fillStyle(d.color).fillCircle(14, 14, 14).fillStyle(0x3a1a0a).fillCircle(14, 14, 5).generateTexture(d.key, 28, 28);
    } else {
      g.fillStyle(d.color).fillCircle(14, 14, 14).fillStyle(0x111111).fillCircle(9, 12, 2).fillCircle(19, 12, 2).generateTexture(d.key, 28, 28);
    }
  }));
  g.destroy();
}

// กะพริบขาว + บีบตัวเมื่อโดนตี (ไม่ต้องวาดเฟรมเพิ่ม)
function monsterHitFx(scene, e) {
  if (!e.active) return;
  e.setTintFill(0xffffff);
  scene.time.delayedCall(80, () => { if (e.active) e.clearTint(); });
  if (!e._hitTween || !e._hitTween.isPlaying()) {
    const b = (e.def && e.def.scale) || 1;
    e._hitTween = scene.tweens.add({ targets: e, scaleX: b * 1.15, scaleY: b * 0.85, duration: 60, yoyo: true });
  }
}

// ท่าตาย: อนุภาคตามธีมด่าน + ร่างจำลองที่ละลาย/แตก/จาง (เรียกก่อน e.destroy())
function playMonsterDeath(scene, e) {
  const def = e.def;
  const fx = DEATH_FX[def ? def.fx : 'melt'] || DEATH_FX.melt;
  const mult = e.isBoss ? 2 : 1;
  const x = e.x, y = e.y;

  const em = scene.add.particles(x, y, 'proj', {
    speed: { min: fx.speed[0], max: fx.speed[1] * mult },
    angle: { min: 0, max: 360 },
    lifespan: fx.life,
    scale: { start: 0.5 * mult, end: 0 },
    alpha: { start: 1, end: 0 },
    gravityY: fx.gravity,
    tint: fx.colors,
    emitting: false,
  }).setDepth(45);
  em.explode(fx.qty * mult);
  scene.time.delayedCall(fx.life + 200, () => em.destroy());

  const ghost = scene.add.sprite(x, y, e.texture.key, e.frame.name)
    .setScale(e.scaleX, e.scaleY).setFlipX(e.flipX).setDepth(e.depth || 5);
  const sx = ghost.scaleX, sy = ghost.scaleY;
  const done = () => ghost.destroy();
  switch (fx.tween) {
    case 'melt':    scene.tweens.add({ targets: ghost, scaleY: sy * 0.1, scaleX: sx * 1.4, alpha: 0, duration: 450, onComplete: done }); break;
    case 'flip':    scene.tweens.add({ targets: ghost, angle: 180, scaleX: sx * 0.3, scaleY: sy * 0.3, alpha: 0, duration: 500, onComplete: done }); break;
    case 'pop':     scene.tweens.add({ targets: ghost, scaleX: sx * 1.5, scaleY: sy * 1.5, alpha: 0, duration: 250, onComplete: done }); break;
    case 'shatter': ghost.setTintFill(0xffffff); scene.tweens.add({ targets: ghost, scaleX: sx * 1.2, scaleY: sy * 1.2, alpha: 0, duration: 220, onComplete: done }); break;
    default:        scene.tweens.add({ targets: ghost, y: y - 30, alpha: 0, duration: 600, onComplete: done });
  }

  if (e.isBoss) {   // บอส: วงคลื่นกระแทกตอนตาย
    const ring = scene.add.circle(x, y, 10, 0xffffff, 0).setStrokeStyle(4, fx.colors[0], 1).setDepth(44);
    scene.tweens.add({ targets: ring, scale: 8, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
  }
}
