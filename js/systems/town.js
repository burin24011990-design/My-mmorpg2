// ===== ฉากเมืองเริ่มต้น (Town) v6 =====
// ไฟล์: js/systems/town.js  (โหลดก่อน js/main.js)
// - เกมเริ่มที่เมืองเสมอ (Main ถูกสร้างก่อนแล้ว "พัก" ไว้ แล้วเปิดเมืองทับ)
// - ใช้ปุ่มเลือกด่านเดิมของเกม: กดเลือกด่านแล้วออกจากเมืองไปด่านนั้นทันที ไม่ต้องเดินไปประตู
// - ตาย = กลับเมือง (เติม HP/MP) | ปุ่ม "🏠 เมือง" ในฉากล่ามอนกลับเมืองได้
// - ต้องใช้คู่กับ main.js ที่ตั้งค่า scene: [Main, Town]
// - v6: ตัวละคร hero + อนิเมชันเดิน/ยืน, จอยสติ๊กลอยแบบเดียวกับข้างนอก (แตะซ้าย 40% ของจอ), ความเร็ว 190
// - แถบปุ่มด้านบน (กระเป๋า สกิล อุปกรณ์ เลือกด่าน สเตตัส)

const TOWN = { w: 1600, h: 1000, spawnX: 800, spawnY: 620, speed: 190 };

// ปุ่มเมือง + ปุ่มแชนเนล (DOM) ขนาดเท่าปุ่มแถบบนขวา วางเรียงต่อจากกรอบ HP ฝั่งซ้าย
// พิกัด/ขนาดเป็นหน่วยของเกม (W x H) เหมือน TB ใน topbar.js แล้วสเกลตามหน้าจอให้เอง
const HUD_BTN = { x0: 250, top: 8, w: 50, h: 46, gap: 5 };   // x0 = จุดเริ่มปุ่มแรก (ถัดจากกรอบ HP)
const HUD_BTN_IDS = [
  { id: 'btn-to-town', color: '#4a3a2a' },   // ปุ่มเมือง
  { id: 'btn-ch',      color: '#2a4a5a' },   // ปุ่มแชนเนล (สร้างใน network.js)
];

// ใส่ไอคอน + ข้อความให้ปุ่ม (ไอคอนด้านบน ข้อความเล็กด้านล่าง)
function hudBtnFill(b, icon, label) {
  b.textContent = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;line-height:1.1';
  const i = document.createElement('div'); i.className = 'hb-i'; i.textContent = icon;
  const t = document.createElement('div'); t.className = 'hb-t'; t.textContent = label;
  wrap.append(i, t);
  b.appendChild(wrap);
}

// จัดตำแหน่ง/ขนาด/สไตล์ปุ่มให้ตรงกับปุ่มบนขวา (เรียกซ้ำได้ ทำตามขนาดจอเสมอ)
function hudBtnLayout() {
  const cv = document.querySelector('canvas');
  if (!cv) return;
  const r = cv.getBoundingClientRect();
  if (r.width < 50) return;
  const k = r.width / W;
  HUD_BTN_IDS.forEach(function (it, n) {
    const b = document.getElementById(it.id);
    if (!b) return;
    if (!b.firstElementChild) {          // ถ้าถูกตั้งเป็นข้อความล้วน (เช่นจาก network.js) ให้จัดรูปแบบใหม่
      const t = b.textContent.trim(), sp = t.indexOf(' ');
      hudBtnFill(b, sp > 0 ? t.slice(0, sp) : t, sp > 0 ? t.slice(sp + 1) : '');
    }
    const disp = b.style.display;        // เก็บสถานะซ่อน/แสดงไว้
    b.style.cssText =
      'position:fixed;z-index:9000;box-sizing:border-box;padding:0;margin:0;cursor:pointer;touch-action:manipulation;' +
      '-webkit-tap-highlight-color:transparent;font-family:Mitr,sans-serif;color:#fff;overflow:hidden;' +
      'left:' + (r.left + (HUD_BTN.x0 + n * (HUD_BTN.w + HUD_BTN.gap)) * k) + 'px;' +
      'top:' + (r.top + HUD_BTN.top * k) + 'px;' +
      'width:' + (HUD_BTN.w * k) + 'px;height:' + (HUD_BTN.h * k) + 'px;' +
      'border:' + Math.max(1, 2 * k) + 'px solid #8a6a32;border-radius:' + (8 * k) + 'px;' +
      'background:linear-gradient(180deg,rgba(255,255,255,.16) 0,rgba(255,255,255,0) 45%),' + it.color + ';' +
      'box-shadow:0 ' + (2 * k) + 'px ' + (4 * k) + 'px rgba(0,0,0,.45);';
    b.style.display = disp;
    const ic = b.querySelector('.hb-i'), tx = b.querySelector('.hb-t');
    if (ic) ic.style.cssText = 'font-size:' + (22 * k) + 'px;margin-top:' + (-2 * k) + 'px';
    if (tx) tx.style.cssText = 'font-size:' + (9 * k) + 'px;margin-top:' + (1 * k) + 'px;' +
      'text-shadow:-1px 0 #000,1px 0 #000,0 -1px #000,0 1px #000;white-space:nowrap';
  });
}
window.addEventListener('resize', hudBtnLayout);
window.addEventListener('orientationchange', function () { setTimeout(hudBtnLayout, 300); });
document.addEventListener('fullscreenchange', function () { setTimeout(hudBtnLayout, 300); });
setInterval(hudBtnLayout, 500);   // กันกรณีปุ่มถูกสร้าง/เขียนทับทีหลัง


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

// ----- หาฉาก Main (ไม่ผูกกับชื่อ key) -----
function townMain(sc) {
  if (window._townMain) return window._townMain;
  try {
    const list = sc.scene.manager.scenes;
    for (let i = 0; i < list.length; i++) {
      if (list[i] !== sc && typeof list[i].openStageSelect === 'function') return list[i];
    }
  } catch (e) {}
  return null;
}

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
  window._townMain = scene;
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
  try { if (m.closePanel) m.closePanel(); } catch (e) {}   // ปิดแผงของ Main ที่อาจค้างอยู่ (กันเดินไม่ได้)
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
        hudBtnFill(b, '🏠', 'เมือง');
        const scene = this;
        b.addEventListener('click', function () { townGoToTown(scene); });
        document.body.appendChild(b);
        hudBtnLayout();
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
    this.joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.heroDir = 'down';

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
    // ตัวละครจริง (sprite 'hero' + อนิเมชันเดียวกับข้างนอก)
    const mm = townMain(this);
    const mp = mm && mm.player;
    let labelY = -34;
    this.hero = null;
    if (this.textures.exists('hero')) {
      const hero = this.add.sprite(0, 0, 'hero', 18);
      hero.setScale((mp && mp.scaleX) || 1, (mp && mp.scaleY) || 1);
      this.hero = hero;
      labelY = -hero.displayHeight * 0.42;
      parts.push(hero);
    } else {
      const b = this.add.graphics();
      b.fillStyle(0x3b6fe0, 1).fillCircle(0, 0, 18);
      b.lineStyle(3, 0xffffff, 1).strokeCircle(0, 0, 18);
      b.fillStyle(0xffffff, 1).fillCircle(-6, -4, 3).fillCircle(6, -4, 3);
      parts.push(b);
    }
    parts.push(this.add.text(0, labelY, (mm && mm.playerName) || 'คุณ', {
      fontFamily: 'Mitr, sans-serif', fontSize: '15px', color: '#fff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));
    this.player.add(parts);
    cam.startFollow(this.player, true, 0.12, 0.12);

    this.add.text(W / 2, H - 8, 'ลากนิ้วฝั่งซ้ายเพื่อเดิน • เดินเข้าใกล้ NPC แล้วแตะเพื่อคุย', {
      fontFamily: 'Mitr, sans-serif', fontSize: '14px', color: '#fff', backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(100000);


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
    const self0 = this;
    const M = function () { return townMain(self0); };
    const items = [
      ['tb_bag',    'กระเป๋า',   0x2a4a2a, function () { const m = M(); if (m) m.openInventory('bag'); }],
      ['tb_scroll', 'สกิล',      0x2a2a4a, function () { const m = M(); if (m) m.openSkillBook(); }],
      ['tb_shield', 'อุปกรณ์',   0x2a2a5a, function () { const m = M(); if (m) m.openInventory('equip'); }],
      ['tb_map',    'เลือกด่าน', 0x2a4a5a, function () { self0.openTownStages(); }],
      ['tb_chart',  'สเตตัส',    0x3a2a4a, function () { self0.openTownStatus(); }],
    ];
    let x = W - 12 - (items.length * TB.w + (items.length - 1) * TB.gap);
    items.forEach(function (it) {
      const r = Main.prototype.makeTopBtn.call(this, x, TB.top, TB.w, TB.h, it[0], it[1], it[2], it[3]);
      [r.bg, r.c, r.icon, r.t].forEach(function (o, i) { o.setDepth(100010 + i); });
      x += TB.w + TB.gap;
    }, this);

    this.setupJoystick();
  }

  // ----- จอยสติ๊กลอยแบบเดียวกับข้างนอก: แตะฝั่งซ้าย 40% ของจอแล้วลาก -----
  setupJoystick() {
    const self = this, J = this.joy;
    this.input.addPointer(2);
    this.joyBase = this.add.circle(0, 0, 50, 0xffffff, 0.15).setScrollFactor(0).setDepth(100020).setVisible(false);
    this.joyKnob = this.add.circle(0, 0, 22, 0xffffff, 0.4).setScrollFactor(0).setDepth(100021).setVisible(false);
    this.input.on('pointerdown', function (p, over) {
      if (self.modal) return;
      if (over && over.length) return;
      if (p.x < W * 0.4 && J.id === null) {
        J.id = p.id; J.ox = p.x; J.oy = p.y; J.dx = 0; J.dy = 0;
        self.joyBase.setPosition(p.x, p.y).setVisible(true);
        self.joyKnob.setPosition(p.x, p.y).setVisible(true);
      }
    });
    this.input.on('pointermove', function (p) {
      if (p.id !== J.id) return;
      const v = new Phaser.Math.Vector2(p.x - J.ox, p.y - J.oy);
      if (v.length() > 50) v.setLength(50);
      J.dx = v.x / 50; J.dy = v.y / 50;
      self.joyKnob.setPosition(J.ox + v.x, J.oy + v.y);
    });
    const release = function (p) {
      if (p.id !== J.id) return;
      J.id = null; J.dx = 0; J.dy = 0;
      self.joyBase.setVisible(false); self.joyKnob.setVisible(false);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  // ----- กล่องข้อความแบบ DOM (ใช้ซ้ำ) -----
  domCard(title) {
    this.closeDialog();
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,.55);font-family:Mitr,sans-serif;-webkit-tap-highlight-color:transparent;touch-action:manipulation';
    const card = document.createElement('div');
    card.style.cssText = 'width:min(520px,92vw);max-height:90vh;overflow:auto;background:#26090f;border:2px solid #ffd45c;' +
      'border-radius:14px;padding:12px 14px;color:#fff;text-align:center;box-shadow:0 8px 30px #000a';
    const h = document.createElement('div');
    h.style.cssText = 'font-size:18px;color:#ffe28a;margin-bottom:8px';
    h.textContent = title;
    card.appendChild(h);
    box.appendChild(card);
    document.body.appendChild(box);
    this.modal = box;
    return card;
  }

  domCloseBtn(card) {
    const self = this;
    const btn = document.createElement('button');
    btn.textContent = 'ปิด';
    btn.style.cssText = 'font-family:inherit;font-size:15px;padding:7px 22px;border-radius:10px;cursor:pointer;margin-top:10px;' +
      'border:2px solid #ffd45c;color:#ffe28a;background:#26090f';
    btn.addEventListener('click', function () { self.closeDialog(); });
    card.appendChild(btn);
  }

  // ----- เลือกด่าน (ทำเองในเมือง เพราะแผงของ Main ถูกฉากเมืองบัง) -----
  openTownStages() {
    const m = townMain(this);
    if (!m || typeof ZONES === 'undefined') return;
    const self = this;
    const card = this.domCard('เลือกด่าน (ต้องเลเวลถึงเกณฑ์)');
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px';
    ZONES.forEach(function (z, i) {
      const unlocked = m.stats.level >= z.reqLv;
      const cell = document.createElement('div');
      cell.style.cssText = 'padding:8px 4px;border-radius:10px;border:2px solid ' + (unlocked ? '#4f9a5a' : '#6a3a3a') +
        ';background:' + (unlocked ? '#24402a' : '#2a2424') + ';cursor:' + (unlocked ? 'pointer' : 'default');
      const a = document.createElement('div'); a.style.cssText = 'font-size:15px;font-weight:600'; a.textContent = z.name;
      const b = document.createElement('div'); b.style.cssText = 'font-size:11px;color:#bbb'; b.textContent = 'มอนสเตอร์ Lv.' + z.minLv + '-' + z.maxLv;
      const c = document.createElement('div');
      c.style.cssText = 'font-size:11px;color:' + (unlocked ? '#9adf9a' : '#e08a8a');
      c.textContent = unlocked ? (i === m.stageIdx ? 'อยู่ที่นี่' : 'แตะเพื่อเดินทาง') : 'ต้องการ Lv.' + z.reqLv;
      cell.append(a, b, c);
      cell.addEventListener('click', function () {
        if (!unlocked) return;
        self.closeDialog();
        if (i === m.stageIdx) { townLeave(m); return; }   // ด่านเดิม: กลับไปเล่นต่อ
        m.loadStage(i);                                   // ครอบไว้แล้ว: โหลดด่านเสร็จจะออกจากเมืองเอง
      });
      grid.appendChild(cell);
    });
    card.appendChild(grid);
    this.domCloseBtn(card);
  }

  // ----- สถานะตัวละคร (DOM) -----
  openTownStatus() {
    const m = townMain(this);
    if (!m || !m.stats) return;
    const card = this.domCard('สถานะตัวละคร');
    let cls = '-';
    try { cls = CLASSES[m.currentClass()].label; } catch (e) {}
    const rows = [
      ['เลเวล', m.stats.level + ' / ' + LEVEL_CAP],
      ['EXP', Math.floor(m.stats.exp) + ' / ' + m.stats.expNext],
      ['HP', Math.max(0, Math.floor(m.stats.hp)) + ' / ' + m.maxHp()],
      ['MP', Math.floor(m.stats.mp) + ' / ' + m.maxMp()],
      ['ATK', String(m.atk)],
      ['DEF', String(m.equipDefBonus)],
      ['ทอง', String(m.stats.gold)],
      ['มอนที่ฆ่าแล้ว', String(m.kills)],
      ['อาชีพ', cls],
    ];
    rows.forEach(function (r) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;padding:6px 10px;margin-bottom:4px;border-radius:8px;background:#3a1620;font-size:14px';
      const k = document.createElement('span'); k.style.color = '#bbb'; k.textContent = r[0];
      const v = document.createElement('span'); v.style.cssText = 'color:#ffe28a;font-weight:600'; v.textContent = r[1];
      row.append(k, v);
      card.appendChild(row);
    });
    this.domCloseBtn(card);
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
      const p = this.player;
      if (Math.hypot(n.x - p.x, n.y - p.y) < 150) this.talk(n);
      else this.flash('เดินเข้าไปใกล้ ๆ ก่อน');
    }, this);
    return c;
  }

  update(time, delta) {
    if (this.modal) return;
    const T = TOWN, dt = delta / 1000, p = this.player;
    let vx = this.joy.dx, vy = this.joy.dy;

    if (this.cursors) {
      if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
      if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
      if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
      if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;
    }

    if (Math.hypot(vx, vy) > 0.2) {
      this.target = null; this.pending = null;
      const l = Math.hypot(vx, vy);
      if (l > 1) { vx /= l; vy /= l; }
    } else if (this.target === null) {
      vx = 0; vy = 0;
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

    // อนิเมชันเดิน/ยืน (HeroAnims จาก heroAnims.js)
    if (this.hero && window.HeroAnims) {
      const moving = !!(vx || vy);
      if (moving) {
        this.heroDir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
      }
      try { HeroAnims.play(this.hero, moving ? 'walk' : 'idle', this.heroDir); } catch (e) {}
    }

    if (this.pending) {
      const n = this.pending;
      if (Math.hypot(n.x - p.x, n.y - p.y) < 110) {
        this.pending = null; this.target = null;
        this.talk(n);
      }
    }
  }

  // ข้อความเตือนสั้น ๆ กลางจอ
  flash(msg) {
    if (this._flash) this._flash.destroy();
    const t = this.add.text(W / 2, H * 0.3, msg, {
      fontFamily: 'Mitr, sans-serif', fontSize: '18px', color: '#ffe28a', backgroundColor: '#000000bb',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100030);
    this._flash = t;
    this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 400, onComplete: function () { t.destroy(); } });
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
    this.input.off('pointerupoutside');
    this.joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  }
}
