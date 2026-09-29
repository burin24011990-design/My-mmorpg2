// ขั้นที่ 8: อุปกรณ์ 8 ช่อง (หมวก/เกราะ/ถุงมือ/รองเท้า/แหวน2/สร้อย) + ระดับ+ดาว (รวม 2 ชิ้นเป็น 1 ดาว สูงสุด 99) + ดรอปเป็นกล่องสุ่ม + บอทเก็บของ
const W = 1280, H = 600;
const WORLD_W = 1600, WORLD_H = 1000;
const SERVER_URL = 'https://my-mmorpg2-1.onrender.com';
const BAG_SIZE = 500, PAGE_SIZE = 50, PAGES = BAG_SIZE / PAGE_SIZE;
const ULTI_CD = 40000;
const RESPAWN_DELAY = 7000;
const CAST_DELAY = { melee: 150, aoe: 250, proj: 200, dash: 90, ulti: 400 };
const BASIC_DELAY = 130;
const MAX_STAR = 99;

// ---------- ข้อมูลเกม ----------
const CLASSES = {
  sword: { label: 'นักดาบ', color: 0xe05a5a },
  mage: { label: 'นักเวท', color: 0x5a9cf0 },
  archer: { label: 'นักธนู', color: 0x6bd66b },
};
const WEAPON_CLASS_LABEL = { sword: 'ดาบ', mage: 'คทา', archer: 'ธนู' };
const SLOT_LABELS = { weapon: 'อาวุธ', helmet: 'หมวก', armor: 'เกราะ', gloves: 'ถุงมือ', shoes: 'รองเท้า', ring: 'แหวน', necklace: 'สร้อยคอ' };
const EQUIP_SLOT_KEYS = ['weapon', 'helmet', 'armor', 'gloves', 'shoes', 'ring1', 'ring2', 'necklace'];
const STAT_GROWTH = {
  weapon: { atk: 4 }, helmet: { hp: 8 }, armor: { hp: 10, def: 1 }, gloves: { atk: 2 },
  shoes: { hp: 4, atk: 1 }, ring: { atk: 3 }, necklace: { mp: 6, hp: 4 },
};

const BASIC_ATTACKS = {
  sword: { name: 'โจมตี', dmg: 10, range: 60, cd: 650, type: 'melee', class: 'sword' },
  mage: { name: 'โจมตี', dmg: 8, range: 380, cd: 700, type: 'proj', class: 'mage' },
  archer: { name: 'โจมตี', dmg: 9, range: 360, cd: 650, type: 'proj', class: 'archer' },
};

const SKILL_DEFS = {
  sw_slash: { name: 'ฟันตรง', class: 'sword', dmg: 12, range: 60, cd: 650, mp: 8, type: 'melee' },
  sw_spin: { name: 'ฟันหมุน', class: 'sword', dmg: 18, range: 100, cd: 2800, mp: 16, type: 'aoe' },
  sw_dash: { name: 'พุ่งทะยาน', class: 'sword', dmg: 16, range: 150, cd: 3600, mp: 14, type: 'dash' },
  sw_cross: { name: 'ฟันไขว้', class: 'sword', dmg: 22, range: 70, cd: 2400, mp: 12, type: 'melee' },

  mg_fire: { name: 'ลูกไฟ', class: 'mage', dmg: 14, range: 420, cd: 1400, mp: 10, type: 'proj' },
  mg_ice: { name: 'ธารน้ำแข็ง', class: 'mage', dmg: 12, range: 120, cd: 2400, mp: 16, type: 'aoe' },
  mg_bolt: { name: 'สายฟ้า', class: 'mage', dmg: 20, range: 350, cd: 2800, mp: 18, type: 'proj' },
  mg_nova: { name: 'คลื่นเวท', class: 'mage', dmg: 16, range: 140, cd: 3200, mp: 16, type: 'aoe' },

  ar_shot: { name: 'ยิงธนู', class: 'archer', dmg: 11, range: 380, cd: 800, mp: 8, type: 'proj' },
  ar_rain: { name: 'ฝนลูกศร', class: 'archer', dmg: 10, range: 160, cd: 2600, mp: 16, type: 'aoe' },
  ar_pierce: { name: 'ธนูเจาะเกราะ', class: 'archer', dmg: 24, range: 420, cd: 3000, mp: 18, type: 'proj' },
  ar_multi: { name: 'ยิงกระจาย', class: 'archer', dmg: 13, range: 300, cd: 2200, mp: 14, type: 'proj' },
};

const ULTI_DEFS = {
  sword: { name: 'ดาบสังหาร', dmg: 70, range: 130, cd: ULTI_CD, mp: 50, type: 'aoe' },
  mage: { name: 'อุกกาบาต', dmg: 80, range: 170, cd: ULTI_CD, mp: 50, type: 'aoe' },
  archer: { name: 'สายฝนมรณะ', dmg: 75, range: 200, cd: ULTI_CD, mp: 50, type: 'aoe' },
};

const ZONES = [
  { x: 260, y: 230, r: 140, count: 4, name: 'ทุ่งสไลม์เหนือ' },
  { x: 1340, y: 230, r: 140, count: 4, name: 'ป่าสไลม์' },
  { x: 260, y: 800, r: 140, count: 4, name: 'หนองสไลม์' },
  { x: 1340, y: 800, r: 140, count: 4, name: 'ถ้ำสไลม์' },
  { x: 800, y: 500, r: 180, count: 5, name: 'ลานกลาง' },
];

function skillIconKey(type) { return type === 'melee' ? 'ic_melee' : type === 'aoe' ? 'ic_aoe' : type === 'dash' ? 'ic_dash' : 'ic_proj'; }
function baseSlotOf(slotKey) { return slotKey.indexOf('ring') === 0 ? 'ring' : slotKey; }
function weaponIconKeyForClass(cls) { return cls === 'sword' ? 'icon_sword' : cls === 'mage' ? 'icon_staff' : 'icon_bow'; }

function computeItemStats(item) {
  const g = STAT_GROWTH[item.baseSlot] || {};
  const mult = 1 + item.star * 0.08;
  const out = {};
  Object.keys(g).forEach(k => { out[k] = Math.round(g[k] * item.level * mult); });
  return out;
}

function itemLabel(item) {
  if (item.kind === 'box') return 'กล่องอุปกรณ์ เลเวล ' + item.level;
  const base = item.baseSlot === 'weapon' ? WEAPON_CLASS_LABEL[item.class] : SLOT_LABELS[item.baseSlot];
  return base + ' Lv.' + item.level + (item.star > 0 ? '  ' + item.star + '★' : '');
}

function iconKeyForItem(item) {
  if (item.kind === 'box') return 'box';
  if (item.baseSlot === 'weapon') return weaponIconKeyForClass(item.class);
  return { helmet: 'icon_helmet', armor: 'icon_armor', gloves: 'icon_gloves', shoes: 'icon_shoes', ring: 'icon_ring', necklace: 'icon_necklace' }[item.baseSlot];
}

function randomEquipItem(level) {
  const slots = ['weapon', 'helmet', 'armor', 'gloves', 'shoes', 'ring', 'necklace'];
  const baseSlot = Phaser.Utils.Array.GetRandom(slots);
  const item = { kind: 'equip', baseSlot, level, star: 0 };
  if (baseSlot === 'weapon') item.class = Phaser.Utils.Array.GetRandom(['sword', 'mage', 'archer']);
  return item;
}

function itemsMatch(a, b) {
  if (!a || !b || a.kind !== 'equip' || b.kind !== 'equip') return false;
  if (a.baseSlot !== b.baseSlot || a.level !== b.level || a.star !== b.star) return false;
  if (a.baseSlot === 'weapon' && a.class !== b.class) return false;
  return true;
}

class Main extends Phaser.Scene {
  create() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x4aa3ff).fillCircle(16, 16, 16).generateTexture('player', 32, 32);
    g.clear().fillStyle(0x6bd66b).fillCircle(14, 14, 14).generateTexture('slime', 28, 28);
    g.clear().fillStyle(0xffffff).fillCircle(8, 8, 8).generateTexture('proj', 16, 16);
    g.clear().fillStyle(0xffd23d).fillCircle(9, 9, 9).lineStyle(2, 0x8a6d00).strokeCircle(9, 9, 9).generateTexture('gold', 18, 18);
    g.clear().fillStyle(0xd9d9d9).fillRect(13, 2, 4, 20).fillStyle(0x8a5a2a).fillRect(9, 20, 12, 5).generateTexture('icon_sword', 30, 30);
    g.clear().fillStyle(0x8a5a2a).fillRect(13, 6, 4, 22).fillStyle(0x7ad1ff).fillCircle(15, 6, 6).generateTexture('icon_staff', 30, 30);
    g.clear().lineStyle(3, 0x8a5a2a).strokeCircle(15, 15, 12).fillStyle(0xe8e8e8).fillRect(14, 3, 2, 24).generateTexture('icon_bow', 30, 30);
    g.clear().fillStyle(0xb35ae0).fillRect(0, 0, 16, 16).generateTexture('scroll', 16, 16);
    g.clear().fillStyle(0xd9a13d).fillRect(2, 2, 26, 26).lineStyle(2, 0x7a5a10).strokeRect(2, 2, 26, 26).generateTexture('box', 30, 30);
    g.clear().fillStyle(0xd9d9d9).fillRect(6, 12, 18, 10).fillStyle(0x9a9a9a).fillRect(5, 4, 20, 10).generateTexture('icon_helmet', 30, 30);
    g.clear().fillStyle(0x8a8a8a).fillRect(6, 4, 18, 22).fillStyle(0x5a5a5a).fillRect(6, 4, 18, 6).generateTexture('icon_armor', 30, 30);
    g.clear().fillStyle(0xc98a4a).fillRect(4, 10, 10, 14).fillRect(16, 10, 10, 14).generateTexture('icon_gloves', 30, 30);
    g.clear().fillStyle(0x6a4a2a).fillRect(4, 18, 22, 8).fillRect(4, 8, 10, 12).generateTexture('icon_shoes', 30, 30);
    g.clear().lineStyle(4, 0xffd23d, 1).strokeCircle(15, 15, 9).generateTexture('icon_ring', 30, 30);
    g.clear().lineStyle(2, 0xffd23d, 1).strokeCircle(15, 9, 6).fillStyle(0x5ad1ff).fillCircle(15, 19, 4).generateTexture('icon_necklace', 30, 30);
    // ไอคอนสกิล
    g.clear().fillStyle(0xffffff).fillRect(3, 10, 18, 4).fillRect(10, 3, 4, 18).generateTexture('ic_melee', 24, 24);
    g.clear().lineStyle(3, 0xffffff, 1).strokeCircle(12, 12, 9).fillStyle(0xffffff).fillCircle(12, 12, 3).generateTexture('ic_aoe', 24, 24);
    g.clear().fillStyle(0xffffff).fillCircle(12, 12, 7).generateTexture('ic_proj', 24, 24);
    g.clear().fillStyle(0xffffff).fillTriangle(4, 4, 4, 20, 21, 12).generateTexture('ic_dash', 24, 24);
    g.destroy();

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.add.grid(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 64, 64, 0x2b3a2b, 1, 0x1f2b1f, 1);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    const zoneGfx = this.add.graphics();
    ZONES.forEach(z => { zoneGfx.lineStyle(2, 0x5a7a3a, 0.5).strokeCircle(z.x, z.y, z.r); });

    // สถานะผู้เล่น
    this.stats = { level: 1, exp: 0, expNext: 20, hp: 100, maxHp: 100, mp: 50, maxMp: 50, baseAtk: 10, gold: 0 };
    this.bag = new Array(BAG_SIZE).fill(null);
    this.equipment = { weapon: null, helmet: null, armor: null, gloves: null, shoes: null, ring1: null, ring2: null, necklace: null };
    this.equipHpBonus = 0; this.equipMpBonus = 0; this.equipDefBonus = 0;
    this.learnedSkills = new Set(['sw_slash']);
    this.slots = ['sw_slash', null, null, null];
    this.ultiClass = null;
    this.cdEnd = {};
    this.computeAtk();
    this.autoMode = false;
    this.target = null; this.manualTarget = null;

    this.player = this.physics.add.sprite(WORLD_W / 2, WORLD_H / 2, 'player').setCollideWorldBounds(true);
    this.facing = new Phaser.Math.Vector2(1, 0);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.hitCd = 0;
    this.kills = 0;

    this.enemies = this.physics.add.group();
    ZONES.forEach((z, zi) => { for (let i = 0; i < z.count; i++) this.spawnEnemyInZone(zi); });
    this.projectiles = this.physics.add.group();
    this.loot = this.physics.add.group();
    this.physics.add.overlap(this.projectiles, this.enemies, (fb, e) => {
      const dmg = fb.getData('dmg') || 10; fb.destroy(); this.damage(e, dmg);
    });
    this.physics.add.overlap(this.player, this.loot, (pl, item) => this.pickup(item));

    this.targetRing = this.add.circle(0, 0, 22, 0x000000, 0).setStrokeStyle(3, 0xffe066, 0.95).setVisible(false);

    // คีย์บอร์ด
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.input.keyboard.on('keydown-SPACE', () => this.useBasicAttack());
    this.input.keyboard.on('keydown-ONE', () => this.useSkill(0));
    this.input.keyboard.on('keydown-TWO', () => this.useSkill(1));
    this.input.keyboard.on('keydown-THREE', () => this.useSkill(2));
    this.input.keyboard.on('keydown-FOUR', () => this.useSkill(3));
    this.input.keyboard.on('keydown-U', () => this.useUlti());
    this.input.keyboard.on('keydown-B', () => this.toggleAuto());

    // จอยสติ๊ก (มือถือ)
    this.input.addPointer(2);
    this.joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.joyBase = this.add.circle(0, 0, 50, 0xffffff, 0.15).setScrollFactor(0).setDepth(100).setVisible(false);
    this.joyKnob = this.add.circle(0, 0, 22, 0xffffff, 0.4).setScrollFactor(0).setDepth(101).setVisible(false);
    this.input.on('pointerdown', p => {
      if (p.x < W * 0.4 && this.joy.id === null) {
        this.joy.id = p.id; this.joy.ox = p.x; this.joy.oy = p.y;
        this.joyBase.setPosition(p.x, p.y).setVisible(true);
        this.joyKnob.setPosition(p.x, p.y).setVisible(true);
      }
    });
    this.input.on('pointermove', p => {
      if (p.id !== this.joy.id) return;
      const v = new Phaser.Math.Vector2(p.x - this.joy.ox, p.y - this.joy.oy);
      if (v.length() > 50) v.setLength(50);
      this.joy.dx = v.x / 50; this.joy.dy = v.y / 50;
      this.joyKnob.setPosition(this.joy.ox + v.x, this.joy.oy + v.y);
    });
    const release = p => {
      if (p.id !== this.joy.id) return;
      this.joy.id = null; this.joy.dx = 0; this.joy.dy = 0;
      this.joyBase.setVisible(false); this.joyKnob.setVisible(false);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    // ---------- ปุ่มสกิลแบบ ROV ----------
    const atkX = W - 72, atkY = H - 100;
    this.attackBtn = this.makeCircleBtn(atkX, atkY, 48, 0xcf3d3d, 'โจมตี', () => this.useBasicAttack());
    const arc = [{ dx: -108, dy: 15 }, { dx: -170, dy: -32 }, { dx: -182, dy: -100 }, { dx: -142, dy: -155 }];
    this.slotBtns = arc.map((pos, i) => this.makeSlotBtn(atkX + pos.dx, atkY + pos.dy, 27, i));
    this.ultiBtn = this.makeUltiBtn(atkX - 230, atkY - 125, 38);

    // ---------- ปุ่มเมนูมุมขวาบน ----------
    this.bagBtn = this.makePillBtn(W - 12, 16, 120, 32, '🎒 กระเป๋า', 0x2a4a2a, () => this.openInventory('bag'));
    this.bookBtn = this.makePillBtn(W - 12, 54, 120, 32, '📜 สกิล', 0x2a2a4a, () => this.openSkillBook());
    this.autoBtn = this.makePillBtn(W - 12, 92, 120, 32, 'บอท: ปิด', 0x4a3a2a, () => this.toggleAuto());

    // ---------- HUD ----------
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.hudNameText = this.add.text(16, 12, 'Lv.1', { fontSize: '14px', color: '#ffe066', fontStyle: 'bold' }).setScrollFactor(0).setDepth(101);
    this.hudText = this.add.text(16, 68, '', { fontSize: '12px', color: '#dddddd' }).setScrollFactor(0).setDepth(101);
    this.targetNameText = this.add.text(W / 2, 16, '', { fontSize: '13px', color: '#ffe066' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
    this.toast = this.add.text(W / 2, 100, '', { fontSize: '15px', color: '#ffe066' }).setOrigin(0.5).setScrollFactor(0).setDepth(300);

    // มินิแมป
    this.mini = { x: 16, y: 114, w: 190, h: Math.round(190 * (WORLD_H / WORLD_W)) };
    this.miniBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.miniBg.fillStyle(0x000000, 0.55).fillRoundedRect(this.mini.x - 4, this.mini.y - 4, this.mini.w + 8, this.mini.h + 8, 8);
    this.miniBg.lineStyle(1, 0x5a7a3a, 0.8);
    ZONES.forEach(z => {
      const zx = this.mini.x + (z.x / WORLD_W) * this.mini.w, zy = this.mini.y + (z.y / WORLD_H) * this.mini.h;
      this.miniBg.strokeCircle(zx, zy, (z.r / WORLD_W) * this.mini.w);
    });
    this.miniDots = this.add.graphics().setScrollFactor(0).setDepth(101);

    this.initNetwork();
  }

  // ================= UI helpers =================
  roundRect(depth, x, y, w, h, color, alpha, radius) {
    const gfx = this.add.graphics().setScrollFactor(0).setDepth(depth);
    gfx.fillStyle(color, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
    return gfx;
  }

  makeCircleBtn(x, y, r, color, label, onClick) {
    const c = this.add.circle(x, y, r, color, 0.88).setScrollFactor(0).setDepth(100).setInteractive();
    c.setStrokeStyle(3, 0xffffff, 0.85);
    const t = this.add.text(x, y, label, { fontSize: '13px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    c.on('pointerdown', onClick);
    return { c, t };
  }

  makeSlotBtn(x, y, r, idx) {
    const c = this.add.circle(x, y, r, 0x3a3a3a, 0.8).setScrollFactor(0).setDepth(100).setInteractive();
    c.setStrokeStyle(2, 0xffffff, 0.6);
    const icon = this.add.image(x, y - 4, 'ic_melee').setDisplaySize(20, 20).setScrollFactor(0).setDepth(101).setVisible(false);
    const t = this.add.text(x, y + 15, '', { fontSize: '9px', color: '#fff', align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    const cdText = this.add.text(x, y, '', { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
    let heldTimer = null, longPressed = false;
    c.on('pointerdown', () => {
      if (!this.slots[idx]) { this.openSkillBook(idx); return; }
      longPressed = false;
      heldTimer = this.time.delayedCall(500, () => {
        longPressed = true;
        this.slots[idx] = null; this.computeCombo(); this.toastMsg('ถอดสกิลช่อง ' + (idx + 1));
      });
    });
    c.on('pointerup', () => { if (heldTimer) heldTimer.remove(); if (!longPressed && this.slots[idx]) this.useSkill(idx); });
    return { c, t, icon, cdText, idx };
  }

  makeUltiBtn(x, y, r) {
    const c = this.add.circle(x, y, r, 0xd4af37, 0.9).setScrollFactor(0).setDepth(100).setInteractive().setVisible(false);
    c.setStrokeStyle(3, 0xfff3c4, 0.95);
    const t = this.add.text(x, y, 'ULTI', { fontSize: '12px', color: '#3a2a00', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);
    c.on('pointerdown', () => this.useUlti());
    return { c, t };
  }

  makePillBtn(rightX, y, w, h, label, color, onClick) {
    const x = rightX - w / 2;
    const gfx = this.roundRect(100, x, y + h / 2, w, h, color, 0.85, 10);
    gfx.lineStyle(2, 0xffffff, 0.4).strokeRoundedRect(x - w / 2, y, w, h, 10);
    const zone = this.add.zone(x, y + h / 2, w, h).setScrollFactor(0).setDepth(101).setInteractive();
    const t = this.add.text(x, y + h / 2, label, { fontSize: '12px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
    zone.on('pointerdown', onClick);
    return { gfx, zone, t };
  }

  toastMsg(msg) {
    this.toast.setText(msg).setAlpha(1);
    this.tweens.add({ targets: this.toast, alpha: 0, duration: 1800, delay: 700 });
  }

  toggleAuto() {
    this.autoMode = !this.autoMode;
    this.autoBtn.t.setText(this.autoMode ? 'บอท: เปิด' : 'บอท: ปิด');
    this.toastMsg(this.autoMode ? 'เปิดบอทออโต้ (ล่ามอน+เก็บของอัตโนมัติ)' : 'ปิดบอทออโต้');
  }

  // ================= มอนสเตอร์ / ดรอป =================
  spawnEnemyInZone(zi) {
    const z = ZONES[zi];
    const ang = Math.random() * Math.PI * 2, rad = Math.random() * z.r * 0.8;
    const x = z.x + Math.cos(ang) * rad, y = z.y + Math.sin(ang) * rad;
    const lv = this.stats ? this.stats.level : 1;
    const e = this.enemies.create(x, y, 'slime');
    e.hp = 30 + lv * 8; e.maxHp = e.hp; e.dmg = 5 + Math.floor(lv * 1.5);
    e.setCollideWorldBounds(true);
    e.zoneIdx = zi; e.state = 'idle'; e.wanderX = x; e.wanderY = y; e.nextWander = 0;
    e.setInteractive(); e.on('pointerdown', () => { this.manualTarget = e; });
    return e;
  }

  dropLoot(x, y) {
    const lv = this.stats.level;
    const gold = this.loot.create(x, y, 'gold');
    gold.setData('kind', 'gold'); gold.setData('amount', Phaser.Math.Between(2 + lv, 6 + lv * 2));
    this.tweens.add({ targets: gold, y: y - 6, yoyo: true, repeat: -1, duration: 500 });
    if (Phaser.Math.Between(1, 100) <= 28) {
      if (Phaser.Math.Between(1, 100) <= 55) {
        const it = this.loot.create(x + 14, y, 'box');
        it.setData('kind', 'box'); it.setData('level', lv);
      } else {
        const sid = Phaser.Utils.Array.GetRandom(Object.keys(SKILL_DEFS));
        const it = this.loot.create(x + 14, y, 'scroll');
        it.setData('kind', 'skill'); it.setData('sid', sid);
      }
    }
  }

  findEmptyBagSlot() { return this.bag.findIndex(s => s === null); }

  addItemToBag(item) {
    const idx = this.findEmptyBagSlot();
    if (idx === -1) { this.stats.gold += 8; this.toastMsg('กระเป๋าเต็ม! แลกเป็น +8 ทองแทน'); return -1; }
    this.bag[idx] = item; return idx;
  }

  addEquipItemToBag(item) {
    const matchIdx = this.bag.findIndex(s => itemsMatch(s, item));
    if (matchIdx !== -1) {
      this.bag[matchIdx] = null;
      item = { ...item, star: Math.min(MAX_STAR, item.star + 1) };
      this.addItemToBag(item);
      this.toastMsg('รวมไอเทมสำเร็จ! ได้ ' + itemLabel(item));
    } else {
      this.addItemToBag(item);
      this.toastMsg('ได้รับ: ' + itemLabel(item));
    }
  }

  pickup(item) {
    const kind = item.getData('kind');
    if (kind === 'gold') {
      this.stats.gold += item.getData('amount');
      this.toastMsg('+' + item.getData('amount') + ' ทอง');
    } else if (kind === 'box') {
      this.addItemToBag({ kind: 'box', level: item.getData('level') });
      this.toastMsg('ได้รับกล่องอุปกรณ์ เลเวล ' + item.getData('level'));
    } else if (kind === 'skill') {
      const sid = item.getData('sid'); const sd = SKILL_DEFS[sid];
      if (this.learnedSkills.has(sid)) { this.stats.gold += 5; this.toastMsg('สกิลซ้ำ แลกเป็น +5 ทอง'); }
      else { this.learnedSkills.add(sid); this.toastMsg('เรียนรู้สกิลใหม่: ' + sd.name); }
    }
    item.destroy();
  }

  equipItem(slotKey, item) {
    const old = this.equipment[slotKey];
    this.equipment[slotKey] = item;
    if (old) this.addItemToBag(old);
    this.computeAtk();
  }

  unequipSlot(slotKey) {
    const it = this.equipment[slotKey];
    if (!it) return;
    this.addItemToBag(it);
    this.equipment[slotKey] = null;
    this.computeAtk();
  }

  computeAtk() {
    let atkBonus = 0, hpBonus = 0, mpBonus = 0, defBonus = 0;
    EQUIP_SLOT_KEYS.forEach(k => {
      const it = this.equipment[k];
      if (it) { const s = computeItemStats(it); atkBonus += s.atk || 0; hpBonus += s.hp || 0; mpBonus += s.mp || 0; defBonus += s.def || 0; }
    });
    this.atk = this.stats.baseAtk + atkBonus;
    this.equipHpBonus = hpBonus; this.equipMpBonus = mpBonus; this.equipDefBonus = defBonus;
    this.stats.hp = Math.min(this.stats.hp, this.maxHp());
    this.stats.mp = Math.min(this.stats.mp, this.maxMp());
  }

  maxHp() { return this.stats.maxHp + this.equipHpBonus; }
  maxMp() { return this.stats.maxMp + this.equipMpBonus; }

  currentClass() {
    const w = this.equipment.weapon;
    return w ? w.class : 'sword';
  }

  gainExp(n) {
    this.stats.exp += n;
    while (this.stats.exp >= this.stats.expNext) {
      this.stats.exp -= this.stats.expNext;
      this.stats.level++;
      this.stats.expNext = Math.floor(this.stats.expNext * 1.25);
      this.stats.maxHp += 15; this.stats.maxMp += 8; this.stats.baseAtk += 3;
      this.stats.hp = this.maxHp(); this.stats.mp = this.maxMp();
      this.toastMsg('เลเวลอัพ! ตอนนี้เลเวล ' + this.stats.level);
    }
  }

  damage(e, dmg) {
    if (!e.active) return;
    e.hp -= dmg;
    const t = this.add.text(e.x, e.y - 20, String(dmg), { fontSize: '16px', color: '#ffe066' }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 600, onComplete: () => t.destroy() });
    if (e.hp <= 0) {
      const x = e.x, y = e.y, zi = e.zoneIdx;
      if (this.target === e) this.target = null;
      if (this.manualTarget === e) this.manualTarget = null;
      e.destroy(); this.kills++;
      this.gainExp(8 + this.stats.level * 2);
      this.dropLoot(x, y);
      this.time.delayedCall(RESPAWN_DELAY, () => { if (this.enemies) this.spawnEnemyInZone(zi); });
    }
  }

  // ================= เป้าหมาย =================
  updateTargeting() {
    if (this.manualTarget && this.manualTarget.active) {
      this.target = this.manualTarget;
    } else {
      this.manualTarget = null;
      let best = null, bestD = Infinity;
      this.enemies.getChildren().forEach(e => {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
        if (d < bestD) { bestD = d; best = e; }
      });
      this.target = best;
    }
    if (this.target) {
      this.targetRing.setVisible(true).setPosition(this.target.x, this.target.y);
      this.targetNameText.setText('เป้าหมาย: สไลม์ HP ' + Math.max(0, this.target.hp) + '/' + this.target.maxHp);
      const dir = new Phaser.Math.Vector2(this.target.x - this.player.x, this.target.y - this.player.y);
      if (dir.length() > 1) this.facing.copy(dir).normalize();
    } else {
      this.targetRing.setVisible(false);
      this.targetNameText.setText('');
    }
  }

  // ================= สกิล =================
  computeCombo() {
    const count = {};
    this.slots.forEach(sid => { if (sid) { const c = SKILL_DEFS[sid].class; count[c] = (count[c] || 0) + 1; } });
    let found = null;
    Object.keys(count).forEach(c => { if (count[c] >= 3) found = c; });
    this.ultiClass = found;
    this.ultiBtn.c.setVisible(!!found); this.ultiBtn.t.setVisible(!!found);
    if (found) this.ultiBtn.t.setText(ULTI_DEFS[found].name);
  }

  applySkillEffect(def, x, y, fx, fy, dmg, kind) {
    const color = CLASSES[kind] ? CLASSES[kind].color : 0xffffff;
    const tgt = this.target && this.target.active ? this.target : null;
    if (def.type === 'melee') {
      if (tgt && Phaser.Math.Distance.Between(x, y, tgt.x, tgt.y) <= def.range + 12) {
        this.flash(tgt.x, tgt.y, 40, 0xffffff);
        this.damage(tgt, dmg);
      } else {
        const ex = x + fx * 40, ey = y + fy * 40;
        this.flash(ex, ey, 45, 0xffffff);
        this.enemies.getChildren().slice().forEach(e => { if (Phaser.Math.Distance.Between(ex, ey, e.x, e.y) < 55) this.damage(e, dmg); });
      }
    } else if (def.type === 'aoe') {
      this.flash(x, y, def.range, color);
      this.enemies.getChildren().slice().forEach(e => { if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < def.range) this.damage(e, dmg); });
    } else if (def.type === 'dash') {
      const p = this.player;
      const nx = Phaser.Math.Clamp(p.x + fx * def.range, 20, WORLD_W - 20);
      const ny = Phaser.Math.Clamp(p.y + fy * def.range, 20, WORLD_H - 20);
      this.tweens.add({ targets: p, x: nx, y: ny, duration: 150 });
      this.flash(x, y, 60, 0xffffff);
      this.enemies.getChildren().slice().forEach(e => {
        if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < 90 || Phaser.Math.Distance.Between(nx, ny, e.x, e.y) < 70) this.damage(e, dmg);
      });
    } else if (def.type === 'proj') {
      const pr = this.projectiles.create(x, y, 'proj');
      pr.setData('dmg', dmg); pr.setTint(color);
      let vx = fx, vy = fy;
      if (tgt) { const d = new Phaser.Math.Vector2(tgt.x - x, tgt.y - y); if (d.length() > 1) { d.normalize(); vx = d.x; vy = d.y; } }
      pr.setVelocity(vx * 420, vy * 420);
      this.time.delayedCall(1100, () => pr.active && pr.destroy());
    }
  }

  useBasicAttack() {
    const cls = this.currentClass(); const def = BASIC_ATTACKS[cls];
    const now = this.time.now;
    if (now < (this.cdEnd.basic || 0)) return;
    this.cdEnd.basic = now + def.cd;
    const p = this.player, fx = this.facing.x, fy = this.facing.y, dmg = def.dmg + this.atk;
    this.time.delayedCall(BASIC_DELAY, () => this.applySkillEffect(def, p.x, p.y, fx, fy, dmg, cls));
    if (this.online) this.socket.emit('skill', { name: 'basic_' + cls, x: p.x, y: p.y, fx, fy });
  }

  useSkill(idx) {
    const sid = this.slots[idx]; if (!sid) return;
    const def = SKILL_DEFS[sid];
    const now = this.time.now, key = 'slot' + idx;
    if (now < (this.cdEnd[key] || 0)) return;
    if (this.stats.mp < def.mp) { this.toastMsg('มานาไม่พอ'); return; }
    this.cdEnd[key] = now + def.cd;
    this.stats.mp -= def.mp;
    const p = this.player, fx = this.facing.x, fy = this.facing.y, dmg = def.dmg + this.atk;
    this.time.delayedCall(CAST_DELAY[def.type] || 150, () => this.applySkillEffect(def, p.x, p.y, fx, fy, dmg, def.class));
    if (this.online) this.socket.emit('skill', { name: sid, x: p.x, y: p.y, fx, fy });
  }

  useUlti() {
    if (!this.ultiClass) return;
    const def = ULTI_DEFS[this.ultiClass];
    const now = this.time.now;
    if (now < (this.cdEnd.ulti || 0)) return;
    if (this.stats.mp < def.mp) { this.toastMsg('มานาไม่พอสำหรับอัลติ'); return; }
    this.cdEnd.ulti = now + def.cd;
    this.stats.mp -= def.mp;
    const p = this.player, fx = this.facing.x, fy = this.facing.y, dmg = def.dmg + this.atk, cls = this.ultiClass;
    this.toastMsg(def.name + '!');
    this.time.delayedCall(CAST_DELAY.ulti, () => this.applySkillEffect(def, p.x, p.y, fx, fy, dmg, cls));
    if (this.online) this.socket.emit('skill', { name: 'ulti_' + this.ultiClass, x: p.x, y: p.y, fx, fy });
  }

  flash(x, y, r, color) {
    const c = this.add.circle(x, y, r, color, 0.35);
    this.tweens.add({ targets: c, alpha: 0, duration: 220, onComplete: () => c.destroy() });
  }

  // ================= แผงกระเป๋า / อุปกรณ์ / สกิล =================
  closePanel() { if (this.panel) { this.panel.forEach(o => o.destroy()); this.panel = null; } this.closeSub(); }
  closeSub() { if (this.subPanel) { this.subPanel.forEach(o => o.destroy()); this.subPanel = null; } }

  panelFrame(title) {
    const items = [];
    items.push(this.roundRect(200, W / 2, H / 2, 560, 420, 0x14161a, 0.95, 16));
    items.push(this.add.graphics().setScrollFactor(0).setDepth(200).lineStyle(2, 0x444a55, 1).strokeRoundedRect(W / 2 - 280, H / 2 - 210, 560, 420, 16));
    items.push(this.add.text(W / 2, H / 2 - 192, title, { fontSize: '15px', color: '#ffe066', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(201));
    const closeZone = this.add.zone(W / 2 + 260, H / 2 - 192, 30, 30).setScrollFactor(0).setDepth(202).setInteractive();
    const closeText = this.add.text(W / 2 + 260, H / 2 - 192, '✕', { fontSize: '16px', color: '#ff8888' }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    closeZone.on('pointerdown', () => this.closePanel());
    items.push(closeZone, closeText);
    return items;
  }

  tabBtn(x, y, label, active, onClick) {
    const items = [];
    const w = 100, h = 28;
    items.push(this.roundRect(201, x, y, w, h, active ? 0x3a5a3a : 0x24262b, 0.95, 8));
    const zone = this.add.zone(x, y, w, h).setScrollFactor(0).setDepth(202).setInteractive();
    const t = this.add.text(x, y, label, { fontSize: '12px', color: active ? '#c6ffc6' : '#aaaaaa' }).setOrigin(0.5).setScrollFactor(0).setDepth(203);
    zone.on('pointerdown', onClick);
    items.push(zone, t);
    return items;
  }

  openItemConfirm(idx, item) {
    this.closeSub();
    const items = [];
    items.push(this.roundRect(250, W / 2, H / 2, 320, 220, 0x1c1f24, 0.98, 14));
    items.push(this.add.graphics().setScrollFactor(0).setDepth(250).lineStyle(2, 0xffe066, 0.7).strokeRoundedRect(W / 2 - 160, H / 2 - 110, 320, 220, 14));
    items.push(this.add.image(W / 2, H / 2 - 60, iconKeyForItem(item)).setDisplaySize(48, 48).setScrollFactor(0).setDepth(251));
    items.push(this.add.text(W / 2, H / 2 - 18, itemLabel(item), { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(251));

    if (item.kind === 'box') {
      items.push(this.add.text(W / 2, H / 2 + 4, 'เปิดแล้วจะได้อุปกรณ์สุ่ม 1 ชิ้น', { fontSize: '11px', color: '#bbb' }).setOrigin(0.5).setScrollFactor(0).setDepth(251));
      items.push(this.roundRect(251, W / 2, H / 2 + 60, 130, 32, 0x2a5a2a, 0.95, 8));
      const openZone = this.add.zone(W / 2, H / 2 + 60, 130, 32).setScrollFactor(0).setDepth(252).setInteractive();
      items.push(this.add.text(W / 2, H / 2 + 60, 'เปิดกล่อง', { fontSize: '13px', color: '#c6ffc6' }).setOrigin(0.5).setScrollFactor(0).setDepth(253));
      openZone.on('pointerdown', () => {
        this.bag[idx] = null;
        this.addEquipItemToBag(randomEquipItem(item.level));
        this.closeSub(); this.openInventory('bag', this.invPage);
      });
      items.push(openZone);
    } else {
      const s = computeItemStats(item);
      const statLine = Object.keys(s).map(k => k.toUpperCase() + ' +' + s[k]).join('   ');
      items.push(this.add.text(W / 2, H / 2 + 4, statLine || '-', { fontSize: '12px', color: '#bbb' }).setOrigin(0.5).setScrollFactor(0).setDepth(251));

      if (item.baseSlot === 'ring') {
        items.push(this.roundRect(251, W / 2 - 78, H / 2 + 60, 110, 32, 0x2a5a2a, 0.95, 8));
        const z1 = this.add.zone(W / 2 - 78, H / 2 + 60, 110, 32).setScrollFactor(0).setDepth(252).setInteractive();
        items.push(this.add.text(W / 2 - 78, H / 2 + 60, 'ใส่แหวนซ้าย', { fontSize: '11px', color: '#c6ffc6' }).setOrigin(0.5).setScrollFactor(0).setDepth(253));
        items.push(this.roundRect(251, W / 2 + 78, H / 2 + 60, 110, 32, 0x2a5a2a, 0.95, 8));
        const z2 = this.add.zone(W / 2 + 78, H / 2 + 60, 110, 32).setScrollFactor(0).setDepth(252).setInteractive();
        items.push(this.add.text(W / 2 + 78, H / 2 + 60, 'ใส่แหวนขวา', { fontSize: '11px', color: '#c6ffc6' }).setOrigin(0.5).setScrollFactor(0).setDepth(253));
        z1.on('pointerdown', () => { this.bag[idx] = null; this.equipItem('ring1', item); this.toastMsg('สวมใส่: ' + itemLabel(item)); this.closeSub(); this.openInventory('bag', this.invPage); });
        z2.on('pointerdown', () => { this.bag[idx] = null; this.equipItem('ring2', item); this.toastMsg('สวมใส่: ' + itemLabel(item)); this.closeSub(); this.openInventory('bag', this.invPage); });
        items.push(z1, z2);
      } else {
        items.push(this.roundRect(251, W / 2, H / 2 + 60, 130, 32, 0x2a5a2a, 0.95, 8));
        const yesZone = this.add.zone(W / 2, H / 2 + 60, 130, 32).setScrollFactor(0).setDepth(252).setInteractive();
        items.push(this.add.text(W / 2, H / 2 + 60, 'สวมใส่', { fontSize: '13px', color: '#c6ffc6' }).setOrigin(0.5).setScrollFactor(0).setDepth(253));
        yesZone.on('pointerdown', () => { this.bag[idx] = null; this.equipItem(item.baseSlot, item); this.toastMsg('สวมใส่: ' + itemLabel(item)); this.closeSub(); this.openInventory('bag', this.invPage); });
        items.push(yesZone);
      }
    }
    const noZone = this.add.zone(W / 2, H / 2 + 98, 130, 26).setScrollFactor(0).setDepth(252).setInteractive();
    items.push(this.add.text(W / 2, H / 2 + 98, 'ปิด', { fontSize: '12px', color: '#ffcccc' }).setOrigin(0.5).setScrollFactor(0).setDepth(253));
    noZone.on('pointerdown', () => this.closeSub());
    items.push(noZone);
    this.subPanel = items;
  }

  openEquipPopup(slotKey) {
    this.closeSub();
    const it = this.equipment[slotKey];
    const items = [];
    items.push(this.roundRect(250, W / 2, H / 2, 320, 220, 0x1c1f24, 0.98, 14));
    items.push(this.add.graphics().setScrollFactor(0).setDepth(250).lineStyle(2, 0xffe066, 0.7).strokeRoundedRect(W / 2 - 160, H / 2 - 110, 320, 220, 14));
    if (!it) {
      items.push(this.add.text(W / 2, H / 2, 'ช่องนี้ว่างอยู่', { fontSize: '13px', color: '#999' }).setOrigin(0.5).setScrollFactor(0).setDepth(251));
    } else {
      items.push(this.add.image(W / 2, H / 2 - 60, iconKeyForItem(it)).setDisplaySize(48, 48).setScrollFactor(0).setDepth(251));
      items.push(this.add.text(W / 2, H / 2 - 18, itemLabel(it), { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(251));
      const s = computeItemStats(it);
      const statLine = Object.keys(s).map(k => k.toUpperCase() + ' +' + s[k]).join('   ');
      items.push(this.add.text(W / 2, H / 2 + 4, statLine || '-', { fontSize: '12px', color: '#bbb' }).setOrigin(0.5).setScrollFactor(0).setDepth(251));
      items.push(this.roundRect(251, W / 2, H / 2 + 60, 130, 32, 0x5a2a2a, 0.95, 8));
      const z = this.add.zone(W / 2, H / 2 + 60, 130, 32).setScrollFactor(0).setDepth(252).setInteractive();
      items.push(this.add.text(W / 2, H / 2 + 60, 'ถอดอุปกรณ์', { fontSize: '12px', color: '#ffcccc' }).setOrigin(0.5).setScrollFactor(0).setDepth(253));
      z.on('pointerdown', () => { this.unequipSlot(slotKey); this.closeSub(); this.openInventory('equip'); });
      items.push(z);
    }
    const noZone = this.add.zone(W / 2, H / 2 + 98, 130, 26).setScrollFactor(0).setDepth(252).setInteractive();
    items.push(this.add.text(W / 2, H / 2 + 98, 'ปิด', { fontSize: '12px', color: '#ffcccc' }).setOrigin(0.5).setScrollFactor(0).setDepth(253));
    noZone.on('pointerdown', () => this.closeSub());
    items.push(noZone);
    this.subPanel = items;
  }

  openInventory(tab, page) {
    this.invTab = tab || this.invTab || 'bag';
    this.invPage = page !== undefined ? page : (this.invPage || 0);
    this.closePanel();
    const items = this.panelFrame(this.invTab === 'bag' ? 'กระเป๋า (แตะไอเทมเพื่อดู/สวมใส่/เปิดกล่อง)' : 'อุปกรณ์ที่สวมใส่ (แตะเพื่อดูค่าพลัง/ถอด)');
    items.push(...this.tabBtn(W / 2 - 130, H / 2 - 155, 'กระเป๋า', this.invTab === 'bag', () => this.openInventory('bag', 0)));
    items.push(...this.tabBtn(W / 2, H / 2 - 155, 'อุปกรณ์', this.invTab === 'equip', () => this.openInventory('equip')));

    if (this.invTab === 'bag') {
      const cols = 10, cell = 34;
      const gx0 = W / 2 - (cols * cell) / 2 + cell / 2, gy0 = H / 2 - 108;
      for (let i = 0; i < PAGE_SIZE; i++) {
        const idx = this.invPage * PAGE_SIZE + i;
        const col = i % cols, row = Math.floor(i / cols);
        const x = gx0 + col * cell, y = gy0 + row * cell;
        const it = this.bag[idx];
        items.push(this.roundRect(201, x, y, cell - 4, cell - 4, it ? 0x2c2f36 : 0x1b1d21, 1, 5));
        const zone = this.add.zone(x, y, cell - 4, cell - 4).setScrollFactor(0).setDepth(203).setInteractive();
        items.push(zone);
        if (it) {
          const icon = this.add.image(x, y - 3, iconKeyForItem(it)).setDisplaySize(22, 22).setScrollFactor(0).setDepth(203);
          items.push(icon);
          if (it.kind === 'equip') items.push(this.add.text(x, y + 12, 'Lv' + it.level + (it.star > 0 ? ' ' + it.star + '★' : ''), { fontSize: '7px', color: '#ffe066' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
          zone.on('pointerdown', () => this.openItemConfirm(idx, it));
        }
      }
      const y2 = H / 2 + 140;
      items.push(...this.tabBtn(W / 2 - 90, y2, '◀ ก่อนหน้า', false, () => this.openInventory('bag', Math.max(0, this.invPage - 1))));
      items.push(this.add.text(W / 2, y2, 'หน้า ' + (this.invPage + 1) + ' / ' + PAGES, { fontSize: '12px', color: '#ccc' }).setOrigin(0.5).setScrollFactor(0).setDepth(202));
      items.push(...this.tabBtn(W / 2 + 90, y2, 'ถัดไป ▶', false, () => this.openInventory('bag', Math.min(PAGES - 1, this.invPage + 1))));
    } else {
      const cols = 4, cell = 100;
      const gx0 = W / 2 - (cols * cell) / 2 + cell / 2, gy0 = H / 2 - 110;
      EQUIP_SLOT_KEYS.forEach((slotKey, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = gx0 + col * cell, y = gy0 + row * cell;
        const it = this.equipment[slotKey];
        items.push(this.roundRect(201, x, y, cell - 12, cell - 12, it ? 0x2c3a2c : 0x1b1d21, 1, 8));
        const zone = this.add.zone(x, y, cell - 12, cell - 12).setScrollFactor(0).setDepth(203).setInteractive();
        items.push(zone);
        const iconKey = it ? iconKeyForItem(it) : ({ weapon: 'icon_sword', helmet: 'icon_helmet', armor: 'icon_armor', gloves: 'icon_gloves', shoes: 'icon_shoes', ring1: 'icon_ring', ring2: 'icon_ring', necklace: 'icon_necklace' }[slotKey]);
        items.push(this.add.image(x, y - 12, iconKey).setDisplaySize(30, 30).setScrollFactor(0).setDepth(203).setAlpha(it ? 1 : 0.35));
        items.push(this.add.text(x, y + 14, SLOT_LABELS[baseSlotOf(slotKey)] + (slotKey === 'ring1' ? '(ซ้าย)' : slotKey === 'ring2' ? '(ขวา)' : ''), { fontSize: '9px', color: '#ccc' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
        if (it) items.push(this.add.text(x, y + 28, 'Lv' + it.level + (it.star > 0 ? ' ' + it.star + '★' : ''), { fontSize: '8px', color: '#ffe066' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
        zone.on('pointerdown', () => this.openEquipPopup(slotKey));
      });
    }
    this.panel = items;
  }

  openSkillBook(targetSlot) {
    this.closePanel();
    const items = this.panelFrame(targetSlot !== undefined ? 'เลือกสกิลใส่ช่อง ' + (targetSlot + 1) : 'สกิลที่เรียนรู้แล้ว');
    let row = 0;
    [...this.learnedSkills].forEach(sid => {
      const sd = SKILL_DEFS[sid];
      const y = H / 2 - 140 + row * 30;
      items.push(this.roundRect(201, W / 2, y, 480, 26, 0x24262b, 0.95, 6));
      const zone = this.add.zone(W / 2, y, 480, 26).setScrollFactor(0).setDepth(202).setInteractive();
      items.push(this.add.text(W / 2, y, sd.name + '  (' + CLASSES[sd.class].label + ')  dmg ' + sd.dmg + '  มานา ' + sd.mp, { fontSize: '12px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
      zone.on('pointerdown', () => {
        if (targetSlot !== undefined) { this.slots[targetSlot] = sid; this.computeCombo(); this.closePanel(); }
        else this.openSkillBook(0);
      });
      items.push(zone); row++;
    });
    if (row === 0) items.push(this.add.text(W / 2, H / 2 - 60, '(ยังไม่มีสกิล ลองเก็บม้วนสกิลจากมอนสเตอร์)', { fontSize: '12px', color: '#999' }).setOrigin(0.5).setScrollFactor(0).setDepth(202));
    this.panel = items;
  }

  // ================= ออนไลน์ =================
  initNetwork() {
    this.others = {}; this.online = false; this.lastSend = 0;
    if (typeof io === 'undefined' || SERVER_URL.includes('YOUR-SERVER')) return;
    const name = (window.prompt('ตั้งชื่อตัวละคร (ไม่เกิน 12 ตัวอักษร)', '') || 'Player').slice(0, 12);
    this.myLabel = this.add.text(0, 0, name, { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5).setDepth(50);
    this.statusText = this.add.text(W - 10, H - 10, 'กำลังเชื่อมต่อ...', { fontSize: '11px', color: '#ffe9a0' })
      .setOrigin(1, 1).setScrollFactor(0).setDepth(100);
    this.socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    this.socket.on('connect', () => { this.online = true; this.statusText.setText('ออนไลน์'); this.socket.emit('join', name); });
    this.socket.on('disconnect', () => { this.online = false; this.statusText.setText('หลุดการเชื่อมต่อ'); Object.keys(this.others).forEach(id => this.removeOther(id)); });
    this.socket.on('init', d => Object.values(d.players).forEach(p => { if (p.id !== d.id) this.addOther(p); }));
    this.socket.on('joined', p => this.addOther(p));
    this.socket.on('left', id => this.removeOther(id));
    this.socket.on('state', list => {
      list.forEach(([id, x, y]) => { const o = this.others[id]; if (o) { o.tx = x; o.ty = y; } });
      this.statusText.setText('ออนไลน์: ' + list.length + ' คน');
    });
    this.socket.on('skill', d => {
      if (String(d.name).startsWith('ulti_')) {
        const cls = d.name.replace('ulti_', ''); const def = ULTI_DEFS[cls];
        if (def) this.flash(d.x, d.y, def.range, CLASSES[cls].color);
        return;
      }
      if (String(d.name).startsWith('basic_')) {
        const cls = d.name.replace('basic_', ''); const def = BASIC_ATTACKS[cls];
        if (!def) return;
        if (def.type === 'proj') {
          const f = this.add.sprite(d.x, d.y, 'proj').setTint(CLASSES[cls].color);
          this.tweens.add({ targets: f, x: d.x + d.fx * 462, y: d.y + d.fy * 462, duration: 1100, onComplete: () => f.destroy() });
        } else this.flash(d.x + d.fx * 40, d.y + d.fy * 40, 45, 0xffffff);
        return;
      }
      const def = SKILL_DEFS[d.name]; if (!def) return;
      if (def.type === 'proj') {
        const f = this.add.sprite(d.x, d.y, 'proj').setTint(CLASSES[def.class].color);
        this.tweens.add({ targets: f, x: d.x + d.fx * 462, y: d.y + d.fy * 462, duration: 1100, onComplete: () => f.destroy() });
      } else {
        this.flash(d.x, d.y, def.range || 60, CLASSES[def.class] ? CLASSES[def.class].color : 0xffffff);
      }
    });
  }

  addOther(p) {
    if (this.others[p.id]) return;
    const s = this.add.sprite(p.x, p.y, 'player').setTint(0xffaa44);
    const t = this.add.text(p.x, p.y - 26, p.name, { fontSize: '12px', color: '#ffd9a0' }).setOrigin(0.5).setDepth(50);
    this.others[p.id] = { s, t, tx: p.x, ty: p.y };
  }

  removeOther(id) { const o = this.others[id]; if (!o) return; o.s.destroy(); o.t.destroy(); delete this.others[id]; }

  // ================= ลูป =================
  update(time, deltaMs) {
    const p = this.player;
    const dt = deltaMs / 1000;

    this.stats.mp = Math.min(this.maxMp(), this.stats.mp + 3 * dt);

    // มอนสเตอร์
    this.enemies.getChildren().forEach(e => {
      const z = ZONES[e.zoneIdx];
      const distPlayer = Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y);
      const distZone = Phaser.Math.Distance.Between(e.x, e.y, z.x, z.y);
      if (e.state !== 'return' && distPlayer < 130) e.state = 'chase';
      if (e.state === 'chase' && distZone > z.r * 1.6) e.state = 'return';
      if (e.state === 'chase' && distPlayer > 320) e.state = 'idle';
      if (e.state === 'return' && distZone < z.r * 0.5) e.state = 'idle';

      if (e.state === 'idle') {
        if (time > e.nextWander) {
          const ang = Math.random() * Math.PI * 2, rad = Math.random() * z.r * 0.7;
          e.wanderX = z.x + Math.cos(ang) * rad; e.wanderY = z.y + Math.sin(ang) * rad;
          e.nextWander = time + Phaser.Math.Between(2000, 4000);
        }
        this.physics.moveTo(e, e.wanderX, e.wanderY, 28);
        if (Phaser.Math.Distance.Between(e.x, e.y, e.wanderX, e.wanderY) < 6) e.setVelocity(0, 0);
      } else if (e.state === 'chase') {
        this.physics.moveToObject(e, p, 70);
      } else {
        this.physics.moveTo(e, z.x, z.y, 60);
      }

      if (time > this.hitCd && distPlayer < 26) {
        const dmg = Math.max(1, (e.dmg || 8) - this.equipDefBonus);
        this.stats.hp -= dmg; this.hitCd = time + 600;
        p.setTint(0xff6666); this.time.delayedCall(150, () => p.clearTint());
        if (this.stats.hp <= 0) { this.stats.hp = this.maxHp(); p.setPosition(WORLD_W / 2, WORLD_H / 2); this.toastMsg('คุณสลบ! ฟื้นที่จุดเริ่มต้น'); }
      }
    });

    this.updateTargeting();

    // ปุ่มสกิล UI
    const attackLeft = Math.max(0, (this.cdEnd.basic || 0) - time);
    this.attackBtn.c.setAlpha(attackLeft > 0 ? 0.4 : 0.9);
    this.slots.forEach((sid, i) => {
      const b = this.slotBtns[i];
      if (!sid) { b.t.setText(''); b.cdText.setText('+'); b.icon.setVisible(false); b.c.setFillStyle(0x3a3a3a, 0.5); return; }
      const def = SKILL_DEFS[sid];
      const left = Math.max(0, (this.cdEnd['slot' + i] || 0) - time);
      const noMana = this.stats.mp < def.mp;
      b.c.setFillStyle(CLASSES[def.class].color, (left > 0 || noMana) ? 0.3 : 0.85);
      b.icon.setTexture(skillIconKey(def.type)).setTint(0xffffff).setVisible(true);
      b.t.setText(def.name);
      b.cdText.setText(left > 0 ? (left / 1000).toFixed(1) : '');
    });
    if (this.ultiClass) {
      const left = Math.max(0, (this.cdEnd.ulti || 0) - time);
      this.ultiBtn.c.setAlpha(left > 0 ? 0.35 : 0.95);
    }

    // เคลื่อนที่: บอทออโต้ หรือ ควบคุมเอง
    if (this.autoMode) {
      let bestLoot = null, bestLd = Infinity;
      this.loot.getChildren().forEach(it => {
        const d = Phaser.Math.Distance.Between(p.x, p.y, it.x, it.y);
        if (d < bestLd) { bestLd = d; bestLoot = it; }
      });
      if (bestLoot && bestLd < 260) {
        this.physics.moveTo(p, bestLoot.x, bestLoot.y, 190);
      } else if (this.target) {
        const cls = this.currentClass();
        const approach = Math.max(50, BASIC_ATTACKS[cls].range - 40);
        const d = Phaser.Math.Distance.Between(p.x, p.y, this.target.x, this.target.y);
        if (d > approach) {
          this.physics.moveTo(p, this.target.x, this.target.y, 190);
        } else {
          p.setVelocity(0, 0);
          this.useBasicAttack();
          this.slots.forEach((sid, i) => { if (sid) this.useSkill(i); });
          this.useUlti();
        }
      } else if (bestLoot) {
        this.physics.moveTo(p, bestLoot.x, bestLoot.y, 190);
      } else p.setVelocity(0, 0);
    } else {
      let vx = this.joy.dx, vy = this.joy.dy;
      if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
      if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
      if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
      if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;
      const v = new Phaser.Math.Vector2(vx, vy);
      if (v.length() > 1) v.normalize();
      p.setVelocity(v.x * 190, v.y * 190);
      if (v.length() > 0.2 && !this.target) this.facing.copy(v).normalize();
    }

    // ออนไลน์
    if (this.myLabel) this.myLabel.setPosition(p.x, p.y - 26);
    Object.values(this.others || {}).forEach(o => {
      o.s.x += (o.tx - o.s.x) * 0.25; o.s.y += (o.ty - o.s.y) * 0.25;
      o.t.setPosition(o.s.x, o.s.y - 26);
    });
    if (this.online && time - this.lastSend > 66) { this.lastSend = time; this.socket.emit('move', { x: Math.round(p.x), y: Math.round(p.y) }); }

    // มินิแมป
    this.miniDots.clear();
    const mx = this.mini.x + (p.x / WORLD_W) * this.mini.w, my = this.mini.y + (p.y / WORLD_H) * this.mini.h;
    this.enemies.getChildren().forEach(e => {
      const ex = this.mini.x + (e.x / WORLD_W) * this.mini.w, ey = this.mini.y + (e.y / WORLD_H) * this.mini.h;
      this.miniDots.fillStyle(0xe05a5a, 0.9).fillCircle(ex, ey, 2);
    });
    this.miniDots.fillStyle(0xffe066, 1).fillCircle(mx, my, 3.5);

    // HUD
    this.hud.clear();
    this.hud.fillStyle(0x000000, 0.55).fillRoundedRect(10, 6, 230, 92, 10);
    this.hud.fillStyle(0x000000, 0.6).fillRoundedRect(18, 30, 180, 12, 6);
    this.hud.fillStyle(0xe03c3c).fillRoundedRect(19, 31, 178 * (this.stats.hp / this.maxHp()), 10, 5);
    this.hud.fillStyle(0x000000, 0.6).fillRoundedRect(18, 46, 180, 8, 4);
    this.hud.fillStyle(0x3ca7e0).fillRoundedRect(19, 47, 176 * (this.stats.exp / this.stats.expNext), 6, 3);
    this.hud.fillStyle(0x000000, 0.6).fillRoundedRect(18, 58, 180, 10, 5);
    this.hud.fillStyle(0x9a5ae0).fillRoundedRect(19, 59, 178 * (this.stats.mp / this.maxMp()), 8, 4);
    this.hudNameText.setText('Lv.' + this.stats.level);
    this.hudText.setText('ทอง: ' + this.stats.gold + '   ฆ่าแล้ว: ' + this.kills);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: W, height: H,
  backgroundColor: '#1b241b',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade' },
  scene: Main,
});
