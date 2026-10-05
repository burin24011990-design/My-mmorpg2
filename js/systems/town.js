// ===== ฉากเมืองเริ่มต้น (Town) v4 =====
// ไฟล์: js/systems/town.js  (โหลดก่อน js/main.js)
// - เกมเริ่มที่เมืองเสมอ (Main ถูกสร้างก่อนแล้ว "พัก" ไว้ แล้วเปิดเมืองทับ)
// - ใช้ปุ่มเลือกด่านเดิมของเกม: กดเลือกด่านแล้วออกจากเมืองไปด่านนั้นทันที ไม่ต้องเดินไปประตู
// - ตาย = กลับเมือง (เติม HP/MP) | ปุ่ม "🏠 เมือง" ในฉากล่ามอนกลับเมืองได้
// - ต้องใช้คู่กับ main.js ที่ตั้งค่า scene: [Main, Town]
// - v4: เพิ่มแถบปุ่มด้านบน (กระเป๋า สกิล อุปกรณ์ เลือกด่าน สเตตัส) และจอยสติ๊กเดินในเมือง

const TOWN = { w: 1600, h: 1000, spawnX: 800, spawnY: 620, speed: 260 };

// ปุ่มกลับเมือง: ถ้าไปทับ UI อื่น ให้แก้ตำแหน่งตรงนี้
const TOWN_BTN_CSS = 'position:fixed;left:8px;top:8px;z-index:9000;';

// ตำแหน่งจอยสติ๊กในเมือง (พิกัดหน้าจอเกม) ถ้าไปทับปุ่มอื่นให้ปรับ x / y / r
const TOWN_JOY = { x: 230, yFromBottom: 90, r: 55 };

const TOWN_NPCS = [
  { id: 'pvp',    name: 'ผู้ดูแลสนามประลอง', title: 'ห้อง PvP',          x: 420,  y: 330, color: 0xe05555, icon: '⚔️' },
  { id: 'market', name: 'พ่อค้าตลาดกลาง',   title: 'ตลาดกลาง',          x: 1180, y: 330, color: 0xf0c040, icon: '🏪' },
  { id: 'trade',  name: 'นายหน้าแลกเปลี่ยน', title: 'แลกเปลี่ยนไอเทม',   x: 420,  y: 720, color: 0x55b0e0, icon: '🔄' },
  { id: 'boss',   name: 'ผู้นำทางบอสโลก',   title: 'บอสโลก (เร็วๆ นี้)', x: 1180, y: 720, color: 0xa060e0, icon: '👹' },
];

const TOWN_TEXT = {
  pvp:    'ยินดีต้อนรับสู่สนามประลอง! ระบบ PvP กำลังเตรียมเปิด',
  market: 'ตลาดกลางสำหรับซื้อขายไอเทมระหว่างผู้เล่น กำลังเตรียมเปิด',
  trade:  'แลกเปลี่ยนไอเทมกับผู้เล่นคนอื่นได้ที่นี่ กำลังเตรียมเปิด',
  boss:   'บอสโลกกำลังจะมาเร็วๆ นี้! ต้องใช้กุญแจเปิดประตู และรวมปาร์ตี้ 10 คนขึ้นไป โปรดรอการอัปเดต',
};

// ผูกระบบจริงทีหลัง เช่น TownHooks.market = function (scene) { ... };
window.TownHooks = window.TownHooks || {};

const TOWN_DEAD_MSG = '💀 คุณตายแล้ว ฟื้นคืนชีพที่เมือง';

// ----- ชุบชีวิตหลังตาย -----
function townRevive(m) {
  try {
    m.stats.hp = m.maxHp();
    m.stats.mp = m.maxMp();
    if (m.player && typeof ZONES !== 'undefined') {
      m.player.setPosition(ZONES[0].x, ZONES[0].y);
      if (m.player.body) m.player.body.setVelocity(0, 0);
    }
  } catch (e) { console.warn('revive failed', e); }
}

// ----- เข้าเมือง: พัก Main (ข้อมูลไม่หาย) แล้วเปิด Town ทับ -----
function townGoToTown(scene, notice, died) {
  if (window._townBusy || scene.scene.isPaused()) return;
  window._townBusy = true;
  window.TOWN_NOTICE = notice || null;
  if (died) townRevive(scene);
  const b = document.getElementById('btn-to-town');
  if (b) b.style.display = 'none';
  scene.scene.pause();
  scene.scene.launch('Town');
}

// ----- ออกจากเมือง: กลับไปเล่น Main ต่อ -----
function townLeave(m) {
  if (!window._townBusy) return;
  window._townBusy = false;
  const b = document.getElementById('btn-to-town');
  if (b) b.style.display = '';
  m.scene.resume();
  m.scene.stop('Town');
}

// ----- ครอบ Main -----
(function patchMainForTown() {
  const target = (typeof Main === 'function') ? Main.prototype : Main;

  // สร้างเสร็จแล้ว: ใส่ปุ่มกลับเมือง และเข้าเมืองทันที (เริ่มเกมที่เมือง)
  const origCreate = target.create;
  target.create = function () {
    if (origCreate) origCreate.apply(this, arguments);
    try {
      if (!document.getElementById('btn-to-town')) {
        const b = document.createElement('button');
        b.id = 'btn-to-town';
        b.textContent = '🏠 เมือง';
        b.style.cssText = TOWN_BTN_CSS + 'font-family:Mitr,sans-serif;font-size:14px;padding:6px 12px;' +
          'border-radius:10px;border:2px solid #ffd45c;background:#26090fcc;color:#ffe28a;cursor:pointer;touch-action:manipulation';
        const scene = this;
        b.addEventListener('click', function () { townGoToTown(scene); });
        document.body.appendChild(b);
      }
      townGoToTown(this);
    } catch (e) { console.warn('town patch failed', e); }
  };

  // กดเลือกด่านด้วยปุ่มเดิมขณะอยู่ในเมือง -> ไปด่านนั้นแล้วออกจากเมือง
  const origLoad = target.loadStage;
  if (typeof origLoad === 'function') {
    target.loadStage = function () {
      const r = origLoad.apply(this, arguments);
      if (window._townBusy) townLeave(this);
      return r;
    };
  }

  // ตายแล้วกลับเมือง: ครอบเมธอดตายของผู้เล่น (ถ้ามี) + ตรวจ HP <= 0 ทุกเฟรม
  ['playerDie', 'playerDied', 'onPlayerDeath', 'playerDeath', 'killPlayer', 'respawnPlayer', 'gameOver'].forEach(function (name) {
    const o = target[name];
    if (typeof o !== 'function' || o._townWrapped) return;
    const w = function () {
      const r = o.apply(this, arguments);
      townGoToTown(this, TOWN_DEAD_MSG, true);
      return r;
    };
    w._townWrapped = true;
    target[name] = w;
  });
  const origUpdate = target.update;
  target.update = function () {
    if (origUpdate) origUpdate.apply(this, arguments);
    const s = this.stats;
    if (s && typeof s.hp === 'number' && s.hp <= 0) townGoToTown(this, TOWN_DEAD_MSG, true);
  };
})();

class Town extends Phaser.Scene {
  constructor() { super('Town'); }

  create() {
    const T = TOWN;
    this.modal = null;
    this.target = null;
    this.pending = null;
    this.joy = { x: 0, y: 0 };
    this.joyId = null;

    const cam = this.cameras.main;
    cam.setBounds(0, 0, T.w, T.h);
    cam.setBackgroundColor('#1b241b');

    // ----- พื้น / ถนน / ลานกลางเมือง -----
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x3b5a35, 1).fillRect(0, 0, T.w, T.h);
    g.lineStyle(1, 0x30492c, 0.7);
    for (let x = 0; x <= T.w; x += 80) g.lineBetween(x, 0, x, T.h);
    for (let y = 0; y <= T.h; y += 80) g.lineBetween(0, y, T.w, y);
    g.fillStyle(0x7a6e55, 1);
    g.fillRect(T.w / 2 - 40, 0, 80, T.h);
    g.fillRect(0, 460, T.w, 80);
    g.fillStyle(0x8f826a, 1).fillCircle(T.w / 2, 500, 210);
    g.lineStyle(6, 0x5e5340, 1).strokeCircle(T.w / 2, 500, 210);
    g.fillStyle(0x4aa3d8, 1).fillCircle(T.w / 2, 500, 55);
    g.lineStyle(5, 0xcfe9f7, 1).strokeCircle(T.w / 2, 500, 55);

    let seed = 7;
    const rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 70; i++) {
      const x = 40 + rnd() * (T.w - 80), y = 40 + rnd() * (T.h - 80);
      const onRoad = Math.abs(x - T.w / 2) < 70 || (y > 440 && y < 560);
      const inPlaza = Math.hypot(x - T.w / 2, y - 500) < 240;
      const nearNpc = TOWN_NPCS.some(function (n) { return Math.hypot(x - n.x, y - n.y) < 110; });
      if (onRoad || inPlaza || nearNpc) continue;
      const r = 16 + rnd() * 14;
      g.fillStyle(0x5b3a1e, 1).fillRect(x - 4, y, 8, r);
      g.fillStyle(0x2f7a38, 1).fillCircle(x, y - 4, r);
      g.fillStyle(0x3d9647, 0.8).fillCircle(x - r * 0.3, y - r * 0.4, r * 0.55);
    }

    this.add.text(T.w / 2, 60, '🏰 เมืองเริ่มต้น', {
      fontFamily: 'Mitr, sans-serif', fontSize: '34px', color: '#ffe28a', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(5);

    this.npcs = TOWN_NPCS.map(function (n) { return this.makeNpc(n); }, this);

    // ----- ผู้เล่น: ใช้ texture 'player' ของเกม (Main สร้างไว้แล้ว) ไม่งั้นใช้วงกลม -----
    this.player = this.add.container(T.spawnX, T.spawnY).setDepth(T.spawnY);
    const parts = [];
    const sh = this.add.graphics();
    sh.fillStyle(0x000000, 0.35).fillEllipse(0, 22, 34, 12);
    parts.push(sh);
    if (this.textures.exists('player')) {
      parts.push(this.add.image(0, 0, 'player'));
    } else {
      const b = this.add.graphics();
      b.fillStyle(0x3b6fe0, 1).fillCircle(0, 0, 18);
      b.lineStyle(3, 0xffffff, 1).strokeCircle(0, 0, 18);
      b.fillStyle(0xffffff, 1).fillCircle(-6, -4, 3).fillCircle(6, -4, 3);
      parts.push(b);
    }
    parts.push(this.add.text(0, -34, 'คุณ', {
      fontFamily: 'Mitr, sans-serif', fontSize: '15px', color: '#fff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));
    this.player.add(parts);
    cam.startFollow(this.player, true, 0.12, 0.12);

    this.add.text(12, 10, 'แตะพื้นเพื่อเดิน • แตะ NPC เพื่อคุย • เลือกด่านจากปุ่มเดิมเพื่อออกไปล่ามอน', {
      fontFamily: 'Mitr, sans-serif', fontSize: '14px', color: '#fff', backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100000);

    this.input.on('pointerdown', function (p, over) {
      if (this.modal) return;
      if (over && over.length) return;
      this.pending = null;
      this.target = { x: Phaser.Math.Clamp(p.worldX, 20, T.w - 20), y: Phaser.Math.Clamp(p.worldY, 20, T.h - 20) };
    }, this);

    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.wasd = kb.addKeys('W,A,S,D');
    }

    this.events.once('shutdown', this.cleanup, this);

    // แถบปุ่มด้านบน + จอยสติ๊ก (ปุ่มของ Main ถูกฉากเมืองบัง จึงสร้างชุดใหม่ในเมือง)
    try { this.buildTownHud(); } catch (e) { console.warn('town hud failed', e); }

    if (window.TOWN_NOTICE) {
      this.dialog('🏰 เมือง', window.TOWN_NOTICE, [{ label: 'ตกลง', primary: true }]);
      window.TOWN_NOTICE = null;
    }
  }

  // ----- แถบปุ่มด้านบน + จอยสติ๊ก (เรียกฟังก์ชันเดิมของ Main) -----
  buildTownHud() {
    const main = this.scene.get('Main');
    const items = [
      ['tb_bag',    'กระเป๋า',   0x2a4a2a, function () { main.openInventory('bag'); }],
      ['tb_scroll', 'สกิล',      0x2a2a4a, function () { main.openSkillBook(); }],
      ['tb_shield', 'อุปกรณ์',   0x2a2a5a, function () { main.openInventory('equip'); }],
      ['tb_map',    'เลือกด่าน', 0x2a4a5a, function () { main.openStageSelect(); }],
      ['tb_chart',  'สเตตัส',    0x3a2a4a, function () { main.openStatusPanel(); }],
    ];
    let x = W - 12 - (items.length * TB.w + (items.length - 1) * TB.gap);
    items.forEach(function (it) {
      const r = Main.prototype.makeTopBtn.call(this, x, TB.top, TB.w, TB.h, it[0], it[1], it[2], it[3]);
      [r.bg, r.c, r.icon, r.t].forEach(function (o, i) { o.setDepth(100010 + i); });
      x += TB.w + TB.gap;
    }, this);

    // ----- จอยสติ๊กเดิน -----
    this.input.addPointer(2);   // รองรับแตะหลายนิ้ว
    const jx = TOWN_JOY.x, jy = H - TOWN_JOY.yFromBottom, R = TOWN_JOY.r;
    const self = this;
    const base = this.add.circle(jx, jy, R, 0xffffff, 0.12).setStrokeStyle(3, 0xffffff, 0.5)
      .setScrollFactor(0).setDepth(100020).setInteractive();
    const knob = this.add.circle(jx, jy, 24, 0xffffff, 0.45).setScrollFactor(0).setDepth(100021);
    const move = function (p) {
      const dx = p.x - jx, dy = p.y - jy, d = Math.hypot(dx, dy) || 1, k = Math.min(d, R);
      knob.setPosition(jx + dx / d * k, jy + dy / d * k);
      const s = Math.min(1, d / R);
      self.joy.x = dx / d * s;
      self.joy.y = dy / d * s;
    };
    base.on('pointerdown', function (p) {
      if (self.modal) return;
      self.joyId = p.id; self.target = null; self.pending = null; move(p);
    });
    this.input.on('pointermove', function (p) {
      if (self.joyId === p.id && p.isDown) move(p);
    });
    this.input.on('pointerup', function (p) {
      if (self.joyId === p.id) {
        self.joyId = null; self.joy.x = 0; self.joy.y = 0; knob.setPosition(jx, jy);
      }
    });
  }

  makeNpc(n) {
    const c = this.add.container(n.x, n.y).setDepth(n.y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillEllipse(0, 30, 54, 16);
    g.fillStyle(n.color, 1).fillRoundedRect(-28, -28, 56, 56, 14);
    g.lineStyle(4, 0xffffff, 1).strokeRoundedRect(-28, -28, 56, 56, 14);
    const icon = this.add.text(0, 0, n.icon, { fontSize: '32px' }).setOrigin(0.5);
    const name = this.add.text(0, -52, n.name, {
      fontFamily: 'Mitr, sans-serif', fontSize: '16px', color: '#ffe28a', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);
    const title = this.add.text(0, 46, n.title, {
      fontFamily: 'Mitr, sans-serif', fontSize: '13px', color: '#fff', backgroundColor: '#000000aa',
      padding: { x: 6, y: 2 },
    }).setOrigin(0.5);
    c.add([g, icon, name, title]);
    c.setSize(110, 130);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', function () {
      if (this.modal) return;
      this.pending = n;
      this.target = { x: n.x, y: n.y + 70 };
    }, this);
    return c;
  }

  update(time, delta) {
    if (this.modal) return;
    const T = TOWN, dt = delta / 1000, p = this.player;
    let vx = 0, vy = 0;

    if (this.cursors) {
      if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
      if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
      if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
      if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;
    }
    if (this.joy && (this.joy.x || this.joy.y)) { vx += this.joy.x; vy += this.joy.y; }

    if (vx || vy) {
      this.target = null; this.pending = null;
      const l = Math.hypot(vx, vy); vx /= l; vy /= l;
    } else if (this.target) {
      const dx = this.target.x - p.x, dy = this.target.y - p.y, d = Math.hypot(dx, dy);
      if (d < 6) { this.target = null; }
      else { vx = dx / d; vy = dy / d; }
    }

    if (vx || vy) {
      p.x = Phaser.Math.Clamp(p.x + vx * T.speed * dt, 20, T.w - 20);
      p.y = Phaser.Math.Clamp(p.y + vy * T.speed * dt, 20, T.h - 20);
      p.setDepth(p.y);
    }

    if (this.pending) {
      const n = this.pending;
      if (Math.hypot(n.x - p.x, n.y - p.y) < 110) {
        this.pending = null; this.target = null;
        this.talk(n);
      }
    }
  }

  talk(n) {
    const hook = window.TownHooks[n.id];
    if (typeof hook === 'function') { hook(this, n); return; }
    this.dialog(n.icon + ' ' + n.name, TOWN_TEXT[n.id] || '...', [{ label: 'ตกลง', primary: true }]);
  }

  dialog(title, text, buttons) {
    this.closeDialog();
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,.55);font-family:Mitr,sans-serif;-webkit-tap-highlight-color:transparent;touch-action:manipulation';
    const card = document.createElement('div');
    card.style.cssText = 'min-width:260px;max-width:86vw;max-height:86vh;overflow:auto;background:#26090f;border:2px solid #ffd45c;' +
      'border-radius:14px;padding:16px 18px;color:#fff;text-align:center;box-shadow:0 8px 30px #000a';
    const h = document.createElement('div');
    h.style.cssText = 'font-size:20px;color:#ffe28a;margin-bottom:8px';
    h.textContent = title;
    const t = document.createElement('div');
    t.style.cssText = 'font-size:15px;line-height:1.5;margin-bottom:14px';
    t.textContent = text;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
    const self = this;
    buttons.forEach(function (b) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.style.cssText = 'font-family:inherit;font-size:15px;padding:8px 14px;border-radius:10px;cursor:pointer;' +
        'border:2px solid #ffd45c;color:' + (b.primary ? '#26090f' : '#ffe28a') + ';background:' + (b.primary ? '#ffd45c' : '#26090f');
      btn.addEventListener('click', function () {
        self.closeDialog();
        if (b.fn) b.fn();
      });
      row.appendChild(btn);
    });
    card.append(h, t, row);
    box.appendChild(card);
    document.body.appendChild(box);
    this.modal = box;
  }

  closeDialog() {
    if (this.modal) { this.modal.remove(); this.modal = null; }
  }

  cleanup() {
    this.closeDialog();
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');
    this.joy = { x: 0, y: 0 };
    this.joyId = null;
  }
}
