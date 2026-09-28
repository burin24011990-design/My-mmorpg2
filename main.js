// ขั้นที่ 3: สถานะ/เลเวล + ไอเทมดรอป + กระเป๋า + อาวุธ + 4 ช่องสกิล + คอมโบอาชีพ
const W = 800, H = 450;
const SERVER_URL = 'https://my-mmorpg2-1.onrender.com';

// ---------- ข้อมูลเกม ----------
const CLASSES = {
  sword: { label: 'นักดาบ', color: 0xe05a5a },
  mage: { label: 'นักเวท', color: 0x5a9cf0 },
  archer: { label: 'นักธนู', color: 0x6bd66b },
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
    g.clear().fillStyle(0xd98a3d).fillRect(0, 0, 18, 18).generateTexture('itembox', 18, 18);
    g.clear().fillStyle(0xb35ae0).fillRect(0, 0, 16, 16).generateTexture('scroll', 16, 16);
    g.destroy();

    // โลก
    this.physics.world.setBounds(0, 0, 1600, 900);
    this.add.grid(800, 450, 1600, 900, 64, 64, 0x2b3a2b, 1, 0x1f2b1f, 1);
    this.cameras.main.setBounds(0, 0, 1600, 900);

    // สถานะผู้เล่น
    this.stats = { level: 1, exp: 0, expNext: 20, hp: 100, maxHp: 100, baseAtk: 10, gold: 0 };
    this.ownedWeapons = new Set();
    this.equippedWeaponId = null;
    this.learnedSkills = new Set(['sw_slash']);
    this.slots = ['sw_slash', null, null, null];
    this.ultiClass = null;
    this.cdEnd = {};

    this.player = this.physics.add.sprite(800, 450, 'player').setCollideWorldBounds(true);
    this.facing = new Phaser.Math.Vector2(1, 0);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.hitCd = 0;
    this.kills = 0;

    // มอนสเตอร์ + ของดรอป
    this.enemies = this.physics.add.group();
    for (let i = 0; i < 8; i++) this.spawnEnemy();
    this.projectiles = this.physics.add.group();
    this.loot = this.physics.add.group();
    this.physics.add.overlap(this.projectiles, this.enemies, (fb, e) => {
      const dmg = fb.getData('dmg') || 10;
      fb.destroy(); this.damage(e, dmg);
    });
    this.physics.add.overlap(this.player, this.loot, (pl, item) => this.pickup(item));

    // คีย์บอร์ด
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
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
      if (p.x < W * 0.5 && this.joy.id === null) {
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

    // ปุ่มช่องสกิล 4 ช่อง + อัลติ
    this.slotBtns = [];
    const baseX = 560, y = 400, gap = 60;
    for (let i = 0; i < 4; i++) this.slotBtns.push(this.makeSlotBtn(baseX + i * gap, y, i));
    this.ultiBtn = this.makeUltiBtn(650, 330);

    // ปุ่มกระเป๋า/หนังสือสกิล
    this.bagBtn = this.makeMenuBtn(730, 20, 'กระเป๋า', () => this.openInventory());
    this.bookBtn = this.makeMenuBtn(730, 55, 'สกิล', () => this.openSkillBook());

    // HUD
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.hudText = this.add.text(12, 48, '', { fontSize: '13px', color: '#fff' }).setScrollFactor(0).setDepth(100);
    this.toast = this.add.text(W / 2, 90, '', { fontSize: '15px', color: '#ffe066' }).setOrigin(0.5).setScrollFactor(0).setDepth(120);

    this.initNetwork();
  }

  // ---------- UI helper ----------
  makeMenuBtn(x, y, label, onClick) {
    const c = this.add.rectangle(x, y, 84, 26, 0x222222, 0.75).setScrollFactor(0).setDepth(100).setInteractive();
    c.setStrokeStyle(2, 0xffffff, 0.5);
    const t = this.add.text(x, y, label, { fontSize: '12px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    c.on('pointerdown', onClick);
    return { c, t };
  }

  makeSlotBtn(x, y, idx) {
    const c = this.add.circle(x, y, 26, 0x444444, 0.75).setScrollFactor(0).setDepth(100).setInteractive();
    c.setStrokeStyle(3, 0xffffff, 0.6);
    const t = this.add.text(x, y, '', { fontSize: '11px', color: '#fff', align: 'center', wordWrap: { width: 48 } }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    let heldTimer = null, longPressed = false;
    c.on('pointerdown', () => {
      if (!this.slots[idx]) { this.openSkillBook(idx); return; }
      longPressed = false;
      heldTimer = this.time.delayedCall(500, () => {
        longPressed = true;
        this.slots[idx] = null; this.computeCombo(); this.toastMsg('ถอดสกิลช่อง ' + (idx + 1));
      });
    });
    c.on('pointerup', () => {
      if (heldTimer) heldTimer.remove();
      if (!longPressed && this.slots[idx]) this.useSkill(idx);
    });
    return { c, t, idx };
  }

  makeUltiBtn(x, y) {
    const c = this.add.circle(x, y, 34, 0xd4af37, 0.85).setScrollFactor(0).setDepth(100).setInteractive().setVisible(false);
    c.setStrokeStyle(3, 0xffffff, 0.8);
    const t = this.add.text(x, y, 'ULTI', { fontSize: '12px', color: '#3a2a00' }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);
    c.on('pointerdown', () => this.useUlti());
    return { c, t };
  }

  toastMsg(msg) {
    this.toast.setText(msg).setAlpha(1);
    this.tweens.add({ targets: this.toast, alpha: 0, duration: 1600, delay: 700 });
  }

  // ---------- มอนสเตอร์ / ดรอป ----------
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
        const it = this.loot.create(x + 14, y, 'itembox');
        it.setData('kind', 'weapon'); it.setData('wid', wd.id);
      } else {
        const keys = Object.keys(SKILL_DEFS);
        const sid = Phaser.Utils.Array.GetRandom(keys);
        const it = this.loot.create(x + 14, y, 'scroll');
        it.setData('kind', 'skill'); it.setData('sid', sid);
      }
    }
  }

  pickup(item) {
    const kind = item.getData('kind');
    if (kind === 'gold') {
      this.stats.gold += item.getData('amount');
      this.toastMsg('+' + item.getData('amount') + ' ทอง');
    } else if (kind === 'weapon') {
      const wid = item.getData('wid'); const wd = WEAPON_DEFS.find(w => w.id === wid);
      this.ownedWeapons.add(wid);
      if (!this.equippedWeaponId) this.equipWeapon(wid);
      this.toastMsg('ได้รับอาวุธ: ' + wd.name);
    } else if (kind === 'skill') {
      const sid = item.getData('sid'); const sd = SKILL_DEFS[sid];
      if (this.learnedSkills.has(sid)) {
        this.stats.gold += 5; this.toastMsg('สกิลซ้ำ แลกเป็น +5 ทอง');
      } else {
        this.learnedSkills.add(sid); this.toastMsg('เรียนรู้สกิลใหม่: ' + sd.name);
      }
    }
    item.destroy();
  }

  equipWeapon(wid) {
    this.equippedWeaponId = wid;
    this.computeAtk();
  }

  computeAtk() {
    const wd = WEAPON_DEFS.find(w => w.id === this.equippedWeaponId);
    this.atk = this.stats.baseAtk + (wd ? wd.atk : 0);
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

  // ---------- สกิล ----------
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
    if (def.type === 'melee') {
      const ex = x + fx * 40, ey = y + fy * 40;
      this.flash(ex, ey, 45, 0xffffff);
      this.enemies.getChildren().slice().forEach(e => {
        if (Phaser.Math.Distance.Between(ex, ey, e.x, e.y) < 55) this.damage(e, dmg);
      });
    } else if (def.type === 'aoe') {
      const color = CLASSES[kind] ? CLASSES[kind].color : 0xffffff;
      this.flash(x, y, def.range, color);
      this.enemies.getChildren().slice().forEach(e => {
        if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < def.range) this.damage(e, dmg);
      });
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
      pr.setData('dmg', dmg);
      pr.setTint(CLASSES[kind] ? CLASSES[kind].color : 0xffffff);
      pr.setVelocity(fx * 420, fy * 420);
      this.time.delayedCall(1100, () => pr.active && pr.destroy());
    }
  }

  useSkill(idx) {
    const sid = this.slots[idx]; if (!sid) return;
    const def = SKILL_DEFS[sid];
    const now = this.time.now, key = 'slot' + idx;
    if (now < (this.cdEnd[key] || 0)) return;
    this.cdEnd[key] = now + def.cd;
    const p = this.player, dmg = def.dmg + (this.atk || this.stats.baseAtk);
    this.applySkillEffect(def, p.x, p.y, this.facing.x, this.facing.y, dmg, def.class);
    if (this.online) this.socket.emit('skill', { name: sid, x: p.x, y: p.y, fx: this.facing.x, fy: this.facing.y });
  }

  useUlti() {
    if (!this.ultiClass) return;
    const def = ULTI_DEFS[this.ultiClass];
    const now = this.time.now;
    if (now < (this.cdEnd.ulti || 0)) return;
    this.cdEnd.ulti = now + def.cd;
    const p = this.player, dmg = def.dmg + (this.atk || this.stats.baseAtk);
    this.applySkillEffect(def, p.x, p.y, this.facing.x, this.facing.y, dmg, this.ultiClass);
    this.toastMsg(def.name + '!');
    if (this.online) this.socket.emit('skill', { name: 'ulti_' + this.ultiClass, x: p.x, y: p.y, fx: this.facing.x, fy: this.facing.y });
  }

  flash(x, y, r, color) {
    const c = this.add.circle(x, y, r, color, 0.35);
    this.tweens.add({ targets: c, alpha: 0, duration: 220, onComplete: () => c.destroy() });
  }

  // ---------- แผงกระเป๋า/หนังสือสกิล ----------
  closePanel() {
    if (this.panel) { this.panel.forEach(o => o.destroy()); this.panel = null; }
  }

  openInventory() {
    this.closePanel();
    const items = [];
    const bg = this.add.rectangle(W / 2, H / 2, 460, 330, 0x101010, 0.9).setScrollFactor(0).setDepth(200).setInteractive();
    items.push(bg);
    items.push(this.add.text(W / 2, H / 2 - 150, 'กระเป๋า (แตะอาวุธเพื่อสวมใส่)', { fontSize: '14px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(201));
    let row = 0;
    this.ownedWeapons.forEach(wid => {
      const wd = WEAPON_DEFS.find(w => w.id === wid);
      const y = H / 2 - 110 + row * 34;
      const equipped = wid === this.equippedWeaponId;
      const r = this.add.rectangle(W / 2, y, 400, 28, equipped ? 0x2a5a2a : 0x2a2a2a, 0.9).setScrollFactor(0).setDepth(201).setInteractive();
      const t = this.add.text(W / 2, y, wd.name + '  ATK+' + wd.atk + (equipped ? '  (สวมอยู่)' : ''), { fontSize: '13px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
      r.on('pointerdown', () => { this.equipWeapon(wid); this.openInventory(); });
      items.push(r, t); row++;
    });
    if (row === 0) items.push(this.add.text(W / 2, H / 2 - 100, '(ยังไม่มีอาวุธ ไปฟันมอนสเตอร์ดูสิ)', { fontSize: '12px', color: '#aaa' }).setOrigin(0.5).setScrollFactor(0).setDepth(201));
    const closeBtn = this.add.text(W / 2, H / 2 + 150, '[ ปิด ]', { fontSize: '14px', color: '#ffe066' }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive();
    closeBtn.on('pointerdown', () => this.closePanel());
    items.push(closeBtn);
    this.panel = items;
  }

  openSkillBook(targetSlot) {
    this.closePanel();
    const items = [];
    const bg = this.add.rectangle(W / 2, H / 2, 460, 330, 0x101010, 0.9).setScrollFactor(0).setDepth(200).setInteractive();
    items.push(bg);
    items.push(this.add.text(W / 2, H / 2 - 150, targetSlot !== undefined ? 'เลือกสกิลใส่ช่อง ' + (targetSlot + 1) : 'สกิลที่เรียนรู้แล้ว', { fontSize: '14px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(201));
    let row = 0;
    [...this.learnedSkills].forEach(sid => {
      const sd = SKILL_DEFS[sid];
      const y = H / 2 - 110 + row * 30;
      const r = this.add.rectangle(W / 2, y, 400, 26, 0x2a2a2a, 0.9).setScrollFactor(0).setDepth(201).setInteractive();
      const t = this.add.text(W / 2, y, sd.name + ' (' + CLASSES[sd.class].label + ') dmg ' + sd.dmg, { fontSize: '12px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
      r.on('pointerdown', () => {
        if (targetSlot !== undefined) { this.slots[targetSlot] = sid; this.computeCombo(); this.closePanel(); }
        else this.openSkillBook(0);
      });
      items.push(r, t); row++;
    });
    const closeBtn = this.add.text(W / 2, H / 2 + 150, '[ ปิด ]', { fontSize: '14px', color: '#ffe066' }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive();
    closeBtn.on('pointerdown', () => this.closePanel());
    items.push(closeBtn);
    this.panel = items;
  }

  // ---------- ออนไลน์ ----------
  initNetwork() {
    this.others = {}; this.online = false; this.lastSend = 0;
    if (typeof io === 'undefined' || SERVER_URL.includes('YOUR-SERVER')) return;
    const name = (window.prompt('ตั้งชื่อตัวละคร (ไม่เกิน 12 ตัวอักษร)', '') || 'Player').slice(0, 12);
    this.myLabel = this.add.text(0, 0, name, { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5).setDepth(50);
    this.statusText = this.add.text(W - 10, 8, 'กำลังเชื่อมต่อ...', { fontSize: '12px', color: '#ffe9a0' })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(100);
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

  removeOther(id) {
    const o = this.others[id]; if (!o) return;
    o.s.destroy(); o.t.destroy(); delete this.others[id];
  }

  // ---------- ลูป ----------
  update(time) {
    const p = this.player;

    // อัปเดตปุ่มสกิล
    this.slots.forEach((sid, i) => {
      const b = this.slotBtns[i];
      if (!sid) { b.t.setText('+'); b.c.setAlpha(0.4); return; }
      const def = SKILL_DEFS[sid];
      const left = Math.max(0, (this.cdEnd['slot' + i] || 0) - time);
      b.c.setFillStyle(CLASSES[def.class].color, left > 0 ? 0.35 : 0.8);
      b.t.setText(left > 0 ? (left / 1000).toFixed(1) : def.name);
    });
    if (this.ultiClass) {
      const left = Math.max(0, (this.cdEnd.ulti || 0) - time);
      this.ultiBtn.c.setAlpha(left > 0 ? 0.35 : 0.9);
    }

    // เดิน
    let vx = this.joy.dx, vy = this.joy.dy;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;
    const v = new Phaser.Math.Vector2(vx, vy);
    if (v.length() > 1) v.normalize();
    p.setVelocity(v.x * 190, v.y * 190);
    if (v.length() > 0.2) this.facing.copy(v).normalize();

    // มอนสเตอร์ไล่ตี
    this.enemies.getChildren().forEach(e => {
      this.physics.moveToObject(e, p, 55);
      if (time > this.hitCd && Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) < 26) {
        this.stats.hp -= (e.dmg || 8); this.hitCd = time + 600;
        p.setTint(0xff6666); this.time.delayedCall(150, () => p.clearTint());
        if (this.stats.hp <= 0) { this.stats.hp = this.stats.maxHp; p.setPosition(800, 450); this.toastMsg('คุณสลบ! ฟื้นที่จุดเริ่มต้น'); }
      }
    });

    // ออนไลน์
    if (this.myLabel) this.myLabel.setPosition(p.x, p.y - 26);
    Object.values(this.others || {}).forEach(o => {
      o.s.x += (o.tx - o.s.x) * 0.25; o.s.y += (o.ty - o.s.y) * 0.25;
      o.t.setPosition(o.s.x, o.s.y - 26);
    });
    if (this.online && time - this.lastSend > 66) { this.lastSend = time; this.socket.emit('move', { x: Math.round(p.x), y: Math.round(p.y) }); }

    // HUD
    this.hud.clear();
    this.hud.fillStyle(0x000000, 0.5).fillRect(10, 8, 152, 14);
    this.hud.fillStyle(0xe03c3c).fillRect(12, 10, 148 * (this.stats.hp / this.stats.maxHp), 10);
    this.hud.fillStyle(0x000000, 0.5).fillRect(10, 26, 152, 8);
    this.hud.fillStyle(0x3ca7e0).fillRect(12, 27, 148 * (this.stats.exp / this.stats.expNext), 6);
    this.hudText.setText('Lv.' + this.stats.level + '   ทอง: ' + this.stats.gold + '   ฆ่าแล้ว: ' + this.kills);
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
