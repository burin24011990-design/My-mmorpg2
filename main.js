// ขั้นที่ 4: ปุ่มสกิลแบบ ROV + กระเป๋า 500 ช่อง (10 หน้า x 50 ช่อง) + หน้าอุปกรณ์ + UI สวยขึ้น
const W = 800, H = 450;
const SERVER_URL = 'https://my-mmorpg2-1.onrender.com';
const BAG_SIZE = 500, PAGE_SIZE = 50, PAGES = BAG_SIZE / PAGE_SIZE;

// ---------- ข้อมูลเกม ----------
const CLASSES = {
  sword: { label: 'นักดาบ', color: 0xe05a5a },
  mage: { label: 'นักเวท', color: 0x5a9cf0 },
  archer: { label: 'นักธนู', color: 0x6bd66b },
};

const BASIC_ATTACKS = {
  sword: { name: 'โจมตี', dmg: 10, range: 55, cd: 380, type: 'melee', class: 'sword' },
  mage: { name: 'โจมตี', dmg: 8, range: 380, cd: 480, type: 'proj', class: 'mage' },
  archer: { name: 'โจมตี', dmg: 9, range: 360, cd: 420, type: 'proj', class: 'archer' },
};

const SKILL_DEFS = {
  sw_slash: { name: 'ฟันตรง', class: 'sword', dmg: 12, range: 55, cd: 450, type: 'melee' },
  sw_spin: { name: 'ฟันหมุน', class: 'sword', dmg: 18, range: 100, cd: 2200, type: 'aoe' },
  sw_dash: { name: 'พุ่งทะยาน', class: 'sword', dmg: 16, range: 150, cd: 3000, type: 'dash' },
  sw_cross: { name: 'ฟันไขว้', class: 'sword', dmg: 22, range: 65, cd: 1800, type: 'melee' },

  mg_fire: { name: 'ลูกไฟ', class: 'mage', dmg: 14, range: 420, cd: 1000, type: 'proj' },
  mg_ice: { name: 'ธารน้ำแข็ง', class: 'mage', dmg: 12, range: 120, cd: 1800, type: 'aoe' },
  mg_bolt: { name: 'สายฟ้า', class: 'mage', dmg: 20, range: 350, cd: 2200, type: 'proj' },
  mg_nova: { name: 'คลื่นเวท', class: 'mage', dmg: 16, range: 140, cd: 2600, type: 'aoe' },

  ar_shot: { name: 'ยิงธนู', class: 'archer', dmg: 11, range: 380, cd: 550, type: 'proj' },
  ar_rain: { name: 'ฝนลูกศร', class: 'archer', dmg: 10, range: 160, cd: 2000, type: 'aoe' },
  ar_pierce: { name: 'ธนูเจาะเกราะ', class: 'archer', dmg: 24, range: 420, cd: 2400, type: 'proj' },
  ar_multi: { name: 'ยิงกระจาย', class: 'archer', dmg: 13, range: 300, cd: 1600, type: 'proj' },
};

const ULTI_DEFS = {
  sword: { name: 'ดาบสังหาร', dmg: 70, range: 130, cd: 8000, type: 'aoe' },
  mage: { name: 'อุกกาบาต', dmg: 80, range: 170, cd: 9000, type: 'aoe' },
  archer: { name: 'สายฝนมรณะ', dmg: 75, range: 200, cd: 8500, type: 'aoe' },
};

const WEAPON_DEFS = [
  { id: 'w_wood_sword', name: 'ดาบไม้', atk: 5, class: 'sword' },
  { id: 'w_iron_sword', name: 'ดาบเหล็ก', atk: 12, class: 'sword' },
  { id: 'w_wood_staff', name: 'ไม้เท้าฝึกหัด', atk: 6, class: 'mage' },
  { id: 'w_crystal_staff', name: 'คทาคริสตัล', atk: 14, class: 'mage' },
  { id: 'w_short_bow', name: 'ธนูสั้น', atk: 5, class: 'archer' },
  { id: 'w_long_bow', name: 'ธนูยาว', atk: 13, class: 'archer' },
];

class Main extends Phaser.Scene {
  create() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x4aa3ff).fillCircle(16, 16, 16).generateTexture('player', 32, 32);
    g.clear().fillStyle(0x6bd66b).fillCircle(14, 14, 14).generateTexture('slime', 28, 28);
    g.clear().fillStyle(0xffffff).fillCircle(8, 8, 8).generateTexture('proj', 16, 16);
    g.clear().fillStyle(0xffd23d).fillCircle(9, 9, 9).lineStyle(2, 0x8a6d00).strokeCircle(9, 9, 9).generateTexture('gold', 18, 18);
    // ไอคอนอาวุธเบื้องต้น (รูปดาบ/คทา/ธนูอย่างง่าย ใช้แทนรูปภาพจริงไปก่อน)
    g.clear().fillStyle(0xd9d9d9).fillRect(13, 2, 4, 20).fillStyle(0x8a5a2a).fillRect(9, 20, 12, 5).generateTexture('icon_sword', 30, 30);
    g.clear().fillStyle(0x8a5a2a).fillRect(13, 6, 4, 22).fillStyle(0x7ad1ff).fillCircle(15, 6, 6).generateTexture('icon_staff', 30, 30);
    g.clear().lineStyle(3, 0x8a5a2a).strokeCircle(15, 15, 12).fillStyle(0xe8e8e8).fillRect(14, 3, 2, 24).generateTexture('icon_bow', 30, 30);
    g.clear().fillStyle(0xb35ae0).fillRect(0, 0, 16, 16).generateTexture('scroll', 16, 16);
    g.destroy();

    this.physics.world.setBounds(0, 0, 1600, 900);
    this.add.grid(800, 450, 1600, 900, 64, 64, 0x2b3a2b, 1, 0x1f2b1f, 1);
    this.cameras.main.setBounds(0, 0, 1600, 900);

    // สถานะผู้เล่น
    this.stats = { level: 1, exp: 0, expNext: 20, hp: 100, maxHp: 100, baseAtk: 10, gold: 0 };
    this.bag = new Array(BAG_SIZE).fill(null); // เก็บเฉพาะอาวุธที่ยังไม่สวมใส่
    this.equippedWeaponId = null;
    this.learnedSkills = new Set(['sw_slash']);
    this.slots = ['sw_slash', null, null, null];
    this.ultiClass = null;
    this.cdEnd = {};
    this.computeAtk();

    this.player = this.physics.add.sprite(800, 450, 'player').setCollideWorldBounds(true);
    this.facing = new Phaser.Math.Vector2(1, 0);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.hitCd = 0;
    this.kills = 0;

    this.enemies = this.physics.add.group();
    for (let i = 0; i < 8; i++) this.spawnEnemy();
    this.projectiles = this.physics.add.group();
    this.loot = this.physics.add.group();
    this.physics.add.overlap(this.projectiles, this.enemies, (fb, e) => {
      const dmg = fb.getData('dmg') || 10; fb.destroy(); this.damage(e, dmg);
    });
    this.physics.add.overlap(this.player, this.loot, (pl, item) => this.pickup(item));

    // คีย์บอร์ด
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.input.keyboard.on('keydown-SPACE', () => this.useBasicAttack());
    this.input.keyboard.on('keydown-ONE', () => this.useSkill(0));
    this.input.keyboard.on('keydown-TWO', () => this.useSkill(1));
    this.input.keyboard.on('keydown-THREE', () => this.useSkill(2));
    this.input.keyboard.on('keydown-FOUR', () => this.useSkill(3));
    this.input.keyboard.on('keydown-U', () => this.useUlti());

    // จอยสติ๊ก (มือถือ)
    this.input.addPointer(2);
    this.joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.joyBase = this.add.circle(0, 0, 50, 0xffffff, 0.15).setScrollFactor(0).setDepth(100).setVisible(false);
    this.joyKnob = this.add.circle(0, 0, 22, 0xffffff, 0.4).setScrollFactor(0).setDepth(101).setVisible(false);
    this.input.on('pointerdown', p => {
      if (p.x < W * 0.48 && this.joy.id === null) {
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

    // ---------- ปุ่มสกิลแบบ ROV: โจมตีธรรมดา (ใหญ่) + สกิล 4 ช่องเรียงโค้ง + อัลติ ----------
    this.attackBtn = this.makeCircleBtn(748, 400, 42, 0xcf3d3d, 'โจมตี', () => this.useBasicAttack());
    const arc = [{ x: 655, y: 412 }, { x: 606, y: 372 }, { x: 596, y: 315 }, { x: 630, y: 270 }];
    this.slotBtns = arc.map((pos, i) => this.makeSlotBtn(pos.x, pos.y, 25, i));
    this.ultiBtn = this.makeUltiBtn(560, 322, 34);

    // ---------- ปุ่มเมนูมุมขวาบน ----------
    this.bagBtn = this.makePillBtn(W - 12, 20, 110, 30, '🎒 กระเป๋า', 0x2a4a2a, () => this.openInventory('bag'));
    this.bookBtn = this.makePillBtn(W - 12, 56, 110, 30, '📜 สกิล', 0x2a2a4a, () => this.openSkillBook());

    // HUD
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.hudNameText = this.add.text(16, 12, 'Lv.1', { fontSize: '13px', color: '#ffe066', fontStyle: 'bold' }).setScrollFactor(0).setDepth(101);
    this.hudText = this.add.text(16, 50, '', { fontSize: '12px', color: '#dddddd' }).setScrollFactor(0).setDepth(101);
    this.toast = this.add.text(W / 2, 90, '', { fontSize: '15px', color: '#ffe066' }).setOrigin(0.5).setScrollFactor(0).setDepth(300);

    this.initNetwork();
  }

  // ================= UI helpers =================
  roundRect(gfxDepth, x, y, w, h, color, alpha, radius) {
    const gfx = this.add.graphics().setScrollFactor(0).setDepth(gfxDepth);
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
    const t = this.add.text(x, y, '', { fontSize: '10px', color: '#fff', align: 'center', wordWrap: { width: 44 } }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
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
    return { c, t, idx };
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
    this.tweens.add({ targets: this.toast, alpha: 0, duration: 1600, delay: 700 });
  }

  weaponIconKey(cls) { return cls === 'sword' ? 'icon_sword' : cls === 'mage' ? 'icon_staff' : 'icon_bow'; }

  // ================= มอนสเตอร์ / ดรอป =================
  spawnEnemy() {
    const lv = this.stats ? this.stats.level : 1;
    const e = this.enemies.create(Phaser.Math.Between(50, 1550), Phaser.Math.Between(50, 850), 'slime');
    e.hp = 30 + lv * 8; e.maxHp = e.hp; e.dmg = 5 + Math.floor(lv * 1.5);
    e.setCollideWorldBounds(true);
    if (this.player && Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 200) e.x += 400;
  }

  dropLoot(x, y) {
    const lv = this.stats.level;
    const gold = this.loot.create(x, y, 'gold');
    gold.setData('kind', 'gold'); gold.setData('amount', Phaser.Math.Between(2 + lv, 6 + lv * 2));
    this.tweens.add({ targets: gold, y: y - 6, yoyo: true, repeat: -1, duration: 500 });
    if (Phaser.Math.Between(1, 100) <= 28) {
      if (Phaser.Math.Between(0, 1) === 0) {
        const wd = Phaser.Utils.Array.GetRandom(WEAPON_DEFS);
        const it = this.loot.create(x + 14, y, this.weaponIconKey(wd.class));
        it.setData('kind', 'weapon'); it.setData('wid', wd.id);
      } else {
        const sid = Phaser.Utils.Array.GetRandom(Object.keys(SKILL_DEFS));
        const it = this.loot.create(x + 14, y, 'scroll');
        it.setData('kind', 'skill'); it.setData('sid', sid);
      }
    }
  }

  addToBag(wid) {
    const idx = this.bag.findIndex(s => s === null);
    if (idx === -1) { this.stats.gold += 8; this.toastMsg('กระเป๋าเต็ม! แลกเป็น +8 ทองแทน'); return; }
    this.bag[idx] = wid;
  }

  pickup(item) {
    const kind = item.getData('kind');
    if (kind === 'gold') {
      this.stats.gold += item.getData('amount');
      this.toastMsg('+' + item.getData('amount') + ' ทอง');
    } else if (kind === 'weapon') {
      const wid = item.getData('wid'); const wd = WEAPON_DEFS.find(w => w.id === wid);
      if (!this.equippedWeaponId) { this.equipWeapon(wid); this.toastMsg('ได้รับและสวมใส่: ' + wd.name); }
      else { this.addToBag(wid); this.toastMsg('ได้รับอาวุธ: ' + wd.name + ' (เก็บในกระเป๋า)'); }
    } else if (kind === 'skill') {
      const sid = item.getData('sid'); const sd = SKILL_DEFS[sid];
      if (this.learnedSkills.has(sid)) { this.stats.gold += 5; this.toastMsg('สกิลซ้ำ แลกเป็น +5 ทอง'); }
      else { this.learnedSkills.add(sid); this.toastMsg('เรียนรู้สกิลใหม่: ' + sd.name); }
    }
    item.destroy();
  }

  equipWeapon(wid) {
    const old = this.equippedWeaponId;
    this.equippedWeaponId = wid;
    if (old) this.addToBag(old);
    this.computeAtk();
  }

  unequipWeapon() {
    if (!this.equippedWeaponId) return;
    this.addToBag(this.equippedWeaponId);
    this.equippedWeaponId = null;
    this.computeAtk();
  }

  computeAtk() {
    const wd = WEAPON_DEFS.find(w => w.id === this.equippedWeaponId);
    this.atk = this.stats.baseAtk + (wd ? wd.atk : 0);
  }

  currentClass() {
    const wd = WEAPON_DEFS.find(w => w.id === this.equippedWeaponId);
    return wd ? wd.class : 'sword';
  }

  gainExp(n) {
    this.stats.exp += n;
    while (this.stats.exp >= this.stats.expNext) {
      this.stats.exp -= this.stats.expNext;
      this.stats.level++;
      this.stats.expNext = Math.floor(this.stats.expNext * 1.25);
      this.stats.maxHp += 15; this.stats.hp = this.stats.maxHp;
      this.stats.baseAtk += 3;
      this.computeAtk();
      this.toastMsg('เลเวลอัพ! ตอนนี้เลเวล ' + this.stats.level);
    }
  }

  damage(e, dmg) {
    if (!e.active) return;
    e.hp -= dmg;
    const t = this.add.text(e.x, e.y - 20, String(dmg), { fontSize: '16px', color: '#ffe066' }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 600, onComplete: () => t.destroy() });
    if (e.hp <= 0) {
      const x = e.x, y = e.y;
      e.destroy(); this.kills++;
      this.gainExp(8 + this.stats.level * 2);
      this.dropLoot(x, y);
      this.time.delayedCall(2000, () => this.spawnEnemy());
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
    if (def.type === 'melee') {
      const ex = x + fx * 40, ey = y + fy * 40;
      this.flash(ex, ey, 45, 0xffffff);
      this.enemies.getChildren().slice().forEach(e => { if (Phaser.Math.Distance.Between(ex, ey, e.x, e.y) < 55) this.damage(e, dmg); });
    } else if (def.type === 'aoe') {
      this.flash(x, y, def.range, color);
      this.enemies.getChildren().slice().forEach(e => { if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < def.range) this.damage(e, dmg); });
    } else if (def.type === 'dash') {
      const p = this.player;
      const nx = Phaser.Math.Clamp(p.x + fx * def.range, 20, 1580);
      const ny = Phaser.Math.Clamp(p.y + fy * def.range, 20, 880);
      this.tweens.add({ targets: p, x: nx, y: ny, duration: 150 });
      this.flash(x, y, 60, 0xffffff);
      this.enemies.getChildren().slice().forEach(e => {
        if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < 90 || Phaser.Math.Distance.Between(nx, ny, e.x, e.y) < 70) this.damage(e, dmg);
      });
    } else if (def.type === 'proj') {
      const pr = this.projectiles.create(x, y, 'proj');
      pr.setData('dmg', dmg); pr.setTint(color);
      pr.setVelocity(fx * 420, fy * 420);
      this.time.delayedCall(1100, () => pr.active && pr.destroy());
    }
  }

  useBasicAttack() {
    const cls = this.currentClass(); const def = BASIC_ATTACKS[cls];
    const now = this.time.now;
    if (now < (this.cdEnd.basic || 0)) return;
    this.cdEnd.basic = now + def.cd;
    const p = this.player;
    this.applySkillEffect(def, p.x, p.y, this.facing.x, this.facing.y, def.dmg + this.atk, cls);
    if (this.online) this.socket.emit('skill', { name: 'basic_' + cls, x: p.x, y: p.y, fx: this.facing.x, fy: this.facing.y });
  }

  useSkill(idx) {
    const sid = this.slots[idx]; if (!sid) return;
    const def = SKILL_DEFS[sid];
    const now = this.time.now, key = 'slot' + idx;
    if (now < (this.cdEnd[key] || 0)) return;
    this.cdEnd[key] = now + def.cd;
    const p = this.player;
    this.applySkillEffect(def, p.x, p.y, this.facing.x, this.facing.y, def.dmg + this.atk, def.class);
    if (this.online) this.socket.emit('skill', { name: sid, x: p.x, y: p.y, fx: this.facing.x, fy: this.facing.y });
  }

  useUlti() {
    if (!this.ultiClass) return;
    const def = ULTI_DEFS[this.ultiClass];
    const now = this.time.now;
    if (now < (this.cdEnd.ulti || 0)) return;
    this.cdEnd.ulti = now + def.cd;
    const p = this.player;
    this.applySkillEffect(def, p.x, p.y, this.facing.x, this.facing.y, def.dmg + this.atk, this.ultiClass);
    this.toastMsg(def.name + '!');
    if (this.online) this.socket.emit('skill', { name: 'ulti_' + this.ultiClass, x: p.x, y: p.y, fx: this.facing.x, fy: this.facing.y });
  }

  flash(x, y, r, color) {
    const c = this.add.circle(x, y, r, color, 0.35);
    this.tweens.add({ targets: c, alpha: 0, duration: 220, onComplete: () => c.destroy() });
  }

  // ================= แผงกระเป๋า / อุปกรณ์ / สกิล =================
  closePanel() { if (this.panel) { this.panel.forEach(o => o.destroy()); this.panel = null; } }

  panelFrame(title) {
    const items = [];
    items.push(this.roundRect(200, W / 2, H / 2, 520, 400, 0x14161a, 0.95, 16));
    items.push(this.add.graphics().setScrollFactor(0).setDepth(200).lineStyle(2, 0x444a55, 1).strokeRoundedRect(W / 2 - 260, H / 2 - 200, 520, 400, 16));
    items.push(this.add.text(W / 2, H / 2 - 182, title, { fontSize: '15px', color: '#ffe066', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(201));
    const closeZone = this.add.zone(W / 2 + 240, H / 2 - 182, 30, 30).setScrollFactor(0).setDepth(202).setInteractive();
    const closeText = this.add.text(W / 2 + 240, H / 2 - 182, '✕', { fontSize: '16px', color: '#ff8888' }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
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

  openInventory(tab, page) {
    this.invTab = tab || this.invTab || 'bag';
    this.invPage = page !== undefined ? page : (this.invPage || 0);
    this.closePanel();
    const items = this.panelFrame(this.invTab === 'bag' ? 'กระเป๋า (แตะไอเทมเพื่อสวมใส่)' : 'อุปกรณ์ที่สวมใส่');
    items.push(...this.tabBtn(W / 2 - 130, H / 2 - 145, 'กระเป๋า', this.invTab === 'bag', () => this.openInventory('bag', 0)));
    items.push(...this.tabBtn(W / 2, H / 2 - 145, 'อุปกรณ์', this.invTab === 'equip', () => this.openInventory('equip')));

    if (this.invTab === 'bag') {
      const cols = 10, rows = 5, cell = 34;
      const gx0 = W / 2 - (cols * cell) / 2 + cell / 2, gy0 = H / 2 - 100;
      for (let i = 0; i < PAGE_SIZE; i++) {
        const idx = this.invPage * PAGE_SIZE + i;
        const col = i % cols, row = Math.floor(i / cols);
        const x = gx0 + col * cell, y = gy0 + row * cell;
        const wid = this.bag[idx];
        items.push(this.roundRect(201, x, y, cell - 4, cell - 4, wid ? 0x2c2f36 : 0x1b1d21, 1, 5));
        const zone = this.add.zone(x, y, cell - 4, cell - 4).setScrollFactor(0).setDepth(203).setInteractive();
        items.push(zone);
        if (wid) {
          const wd = WEAPON_DEFS.find(w => w.id === wid);
          const icon = this.add.image(x, y, this.weaponIconKey(wd.class)).setDisplaySize(24, 24).setScrollFactor(0).setDepth(203);
          items.push(icon);
          zone.on('pointerdown', () => { this.bag[idx] = null; this.equipWeapon(wid); this.toastMsg('สวมใส่: ' + wd.name); this.openInventory('bag', this.invPage); });
        }
      }
      const y2 = H / 2 + 130;
      items.push(...this.tabBtn(W / 2 - 90, y2, '◀ ก่อนหน้า', false, () => this.openInventory('bag', Math.max(0, this.invPage - 1))));
      items.push(this.add.text(W / 2, y2, 'หน้า ' + (this.invPage + 1) + ' / ' + PAGES, { fontSize: '12px', color: '#ccc' }).setOrigin(0.5).setScrollFactor(0).setDepth(202));
      items.push(...this.tabBtn(W / 2 + 90, y2, 'ถัดไป ▶', false, () => this.openInventory('bag', Math.min(PAGES - 1, this.invPage + 1))));
    } else {
      const wd = WEAPON_DEFS.find(w => w.id === this.equippedWeaponId);
      if (wd) {
        items.push(this.roundRect(201, W / 2, H / 2 - 60, 72, 72, 0x2c2f36, 1, 10));
        items.push(this.add.image(W / 2, H / 2 - 60, this.weaponIconKey(wd.class)).setDisplaySize(52, 52).setScrollFactor(0).setDepth(202));
        items.push(this.add.text(W / 2, H / 2 - 8, wd.name, { fontSize: '15px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(202));
        items.push(this.add.text(W / 2, H / 2 + 14, 'ATK +' + wd.atk + '   สายอาชีพ: ' + CLASSES[wd.class].label, { fontSize: '12px', color: '#bbb' }).setOrigin(0.5).setScrollFactor(0).setDepth(202));
        items.push(this.roundRect(201, W / 2, H / 2 + 60, 110, 30, 0x5a2a2a, 0.95, 8));
        const unequipZone = this.add.zone(W / 2, H / 2 + 60, 110, 30).setScrollFactor(0).setDepth(202).setInteractive();
        items.push(this.add.text(W / 2, H / 2 + 60, 'ถอดอุปกรณ์', { fontSize: '12px', color: '#ffcccc' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
        unequipZone.on('pointerdown', () => { this.unequipWeapon(); this.openInventory('equip'); });
        items.push(unequipZone);
      } else {
        items.push(this.add.text(W / 2, H / 2, 'ยังไม่ได้สวมใส่อุปกรณ์', { fontSize: '13px', color: '#999' }).setOrigin(0.5).setScrollFactor(0).setDepth(202));
      }
    }
    this.panel = items;
  }

  openSkillBook(targetSlot) {
    this.closePanel();
    const items = this.panelFrame(targetSlot !== undefined ? 'เลือกสกิลใส่ช่อง ' + (targetSlot + 1) : 'สกิลที่เรียนรู้แล้ว');
    let row = 0;
    [...this.learnedSkills].forEach(sid => {
      const sd = SKILL_DEFS[sid];
      const y = H / 2 - 130 + row * 30;
      items.push(this.roundRect(201, W / 2, y, 460, 26, 0x24262b, 0.95, 6));
      const zone = this.add.zone(W / 2, y, 460, 26).setScrollFactor(0).setDepth(202).setInteractive();
      items.push(this.add.text(W / 2, y, sd.name + '  (' + CLASSES[sd.class].label + ')  dmg ' + sd.dmg, { fontSize: '12px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(203));
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
  update(time) {
    const p = this.player;

    const attackLeft = Math.max(0, (this.cdEnd.basic || 0) - time);
    this.attackBtn.c.setAlpha(attackLeft > 0 ? 0.4 : 0.9);

    this.slots.forEach((sid, i) => {
      const b = this.slotBtns[i];
      if (!sid) { b.t.setText('+'); b.c.setFillStyle(0x3a3a3a, 0.5); return; }
      const def = SKILL_DEFS[sid];
      const left = Math.max(0, (this.cdEnd['slot' + i] || 0) - time);
      b.c.setFillStyle(CLASSES[def.class].color, left > 0 ? 0.35 : 0.85);
      b.t.setText(left > 0 ? (left / 1000).toFixed(1) : def.name);
    });
    if (this.ultiClass) {
      const left = Math.max(0, (this.cdEnd.ulti || 0) - time);
      this.ultiBtn.c.setAlpha(left > 0 ? 0.35 : 0.95);
    }

    let vx = this.joy.dx, vy = this.joy.dy;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;
    const v = new Phaser.Math.Vector2(vx, vy);
    if (v.length() > 1) v.normalize();
    p.setVelocity(v.x * 190, v.y * 190);
    if (v.length() > 0.2) this.facing.copy(v).normalize();

    this.enemies.getChildren().forEach(e => {
      this.physics.moveToObject(e, p, 55);
      if (time > this.hitCd && Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) < 26) {
        this.stats.hp -= (e.dmg || 8); this.hitCd = time + 600;
        p.setTint(0xff6666); this.time.delayedCall(150, () => p.clearTint());
        if (this.stats.hp <= 0) { this.stats.hp = this.stats.maxHp; p.setPosition(800, 450); this.toastMsg('คุณสลบ! ฟื้นที่จุดเริ่มต้น'); }
      }
    });

    if (this.myLabel) this.myLabel.setPosition(p.x, p.y - 26);
    Object.values(this.others || {}).forEach(o => {
      o.s.x += (o.tx - o.s.x) * 0.25; o.s.y += (o.ty - o.s.y) * 0.25;
      o.t.setPosition(o.s.x, o.s.y - 26);
    });
    if (this.online && time - this.lastSend > 66) { this.lastSend = time; this.socket.emit('move', { x: Math.round(p.x), y: Math.round(p.y) }); }

    // HUD
    this.hud.clear();
    this.hud.fillStyle(0x000000, 0.55).fillRoundedRect(10, 6, 220, 74, 10);
    this.hud.fillStyle(0x000000, 0.6).fillRoundedRect(18, 30, 170, 12, 6);
    this.hud.fillStyle(0xe03c3c).fillRoundedRect(19, 31, 168 * (this.stats.hp / this.stats.maxHp), 10, 5);
    this.hud.fillStyle(0x000000, 0.6).fillRoundedRect(18, 46, 170, 8, 4);
    this.hud.fillStyle(0x3ca7e0).fillRoundedRect(19, 47, 166 * (this.stats.exp / this.stats.expNext), 6, 3);
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
