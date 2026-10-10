// ===== เมือง v10 — เมืองเป็น "ด่านหนึ่ง" ในฉาก Main (เห็นผู้เล่นอื่น / แชนเนล / ห้อง ใช้ร่วมกับข้างนอก) =====
// ไฟล์: js/systems/town.js (แทนไฟล์เดิมทั้งไฟล์) | โหลดก่อน js/main.js
// v10: ใช้รูปเมือง assets/maps/town.webp รูปเดียวแทนพื้นหญ้า/ถนน/อาคารที่สร้างด้วยโค้ด
//      ตำแหน่ง NPC / จุดเกิด / กำแพง-อาคารกันเดิน เป็น "สัดส่วนของรูป" (0-1) ปรับที่ TOWN_NPCS / TOWN_BLOCKS / TOWN.walk ได้เลย
// v9: townClearMonsters เก็บ GameObject ทุกชิ้นของผู้เล่นอื่นไว้ (เดิมเก็บแค่ o.s / o.t ทำให้ป้ายชื่อ/เลเวลถูกลบตอนเข้าเมือง)
// - ต้องมีด่าน { town:true } ต่อท้าย ZONES ใน js/data/zones.js
// - ฟังก์ชันชื่อเดิม (townGoToTown / townLeave / townMain / townRevive / TownHooks / window._townBusy) ยังอยู่ครบ

const TOWN = {
  w: 2193, h: 2400,                 // ขนาดรูปเมืองในเกม (px) สัดส่วนเท่ารูปต้นฉบับ 1199:1312 | ต้องไม่เกิน WORLD_W x WORLD_H
  spawn: { fx: 0.50, fy: 0.72 },    // จุดเกิดในเมือง (สัดส่วนของรูป)
  walk: { x0: 0.10, y0: 0.085, x1: 0.90, y1: 0.745 },   // พื้นที่ในกำแพงที่เดินได้ (สัดส่วนของรูป)
  speed: 190, feet: 20,
  atlas: 'assets/town/', ver: 2,    // atlas เดิมใช้โหลดรูป NPC (npc_*) เท่านั้น ถ้าไม่มีไฟล์จะใช้ไอคอนแทน
};

// ---------- ปุ่มเมือง + ปุ่มแชนเนล (DOM) ----------
const HUD_BTN = { x0: 250, top: 8, w: 50, h: 46, gap: 5 };
const HUD_BTN_IDS = [
  { id: 'btn-to-town', color: '#4a3a2a' },
  { id: 'btn-ch',      color: '#2a4a5a' },
];

function hudBtnFill(b, icon, label) {
  b.textContent = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;line-height:1.1';
  const i = document.createElement('div'); i.className = 'hb-i'; i.textContent = icon;
  const t = document.createElement('div'); t.className = 'hb-t'; t.textContent = label;
  wrap.append(i, t);
  b.appendChild(wrap);
}

function hudBtnLayout() {
  const cv = document.querySelector('canvas');
  if (!cv) return;
  const r = cv.getBoundingClientRect();
  if (r.width < 50) return;
  const k = r.width / W;
  HUD_BTN_IDS.forEach(function (it, n) {
    const b = document.getElementById(it.id);
    if (!b) return;
    if (!b.firstElementChild) {
      const t = b.textContent.trim(), sp = t.indexOf(' ');
      hudBtnFill(b, sp > 0 ? t.slice(0, sp) : t, sp > 0 ? t.slice(sp + 1) : '');
    }
    const disp = b.style.display;
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
setInterval(hudBtnLayout, 500);

// ---------- NPC | x,y = จุดเท้า เป็นสัดส่วนของรูปเมือง (0-1) ----------
const TOWN_NPCS = [
  { id: 'pvp',    name: 'ผู้ดูแลสนามประลอง', title: 'ห้อง PvP',          x: 0.44, y: 0.70, sprite: 'npc_pvp',    color: 0xe05555, icon: '⚔️' },
  { id: 'market', name: 'พ่อค้าตลาดกลาง',   title: 'ตลาดกลาง',          x: 0.42, y: 0.385, sprite: 'npc_market', color: 0xf0c040, icon: '🏪' },
  { id: 'trade',  name: 'นายหน้าแลกเปลี่ยน', title: 'แลกเปลี่ยนไอเทม',   x: 0.58, y: 0.385, sprite: 'npc_trade',  color: 0x55b0e0, icon: '🔄' },
  { id: 'boss',   name: 'ผู้นำทางบอสโลก',   title: 'บอสโลก (เร็วๆ นี้)', x: 0.56, y: 0.70, sprite: 'npc_boss',   color: 0xa060e0, icon: '👹' },
];

const TOWN_TEXT = {
  pvp:    'ยินดีต้อนรับสู่สนามประลอง! ระบบ PvP กำลังเตรียมเปิด',
  market: 'ตลาดกลางสำหรับซื้อขายไอเทมระหว่างผู้เล่น กำลังเตรียมเปิด',
  trade:  'แลกเปลี่ยนไอเทมกับผู้เล่นคนอื่นได้ที่นี่ กำลังเตรียมเปิด',
  boss:   'บอสโลกกำลังจะมาเร็วๆ นี้! ต้องใช้กุญแจเปิดประตู และรวมปาร์ตี้ 10 คนขึ้นไป โปรดรอการอัปเดต',
};

// ---------- กำแพง/อาคาร/สระ ที่เดินทะลุไม่ได้ | [x0, y0, x1, y1] เป็นสัดส่วนของรูปเมือง ----------
const TOWN_BLOCKS = [
  [0.37, 0.01, 0.63, 0.15],   // ศาลาใหญ่ด้านบน
  [0.34, 0.11, 0.42, 0.23],   // ตึกข้างบันได (ซ้าย)
  [0.58, 0.11, 0.66, 0.23],   // ตึกข้างบันได (ขวา)
  [0.07, 0.07, 0.31, 0.27],   // ศาลา+สระมุมซ้ายบน
  [0.69, 0.13, 0.89, 0.28],   // สวนมุมขวาบน
  [0.10, 0.23, 0.37, 0.43],   // บ้านฝั่งซ้าย
  [0.10, 0.42, 0.33, 0.53],
  [0.09, 0.56, 0.34, 0.68],
  [0.07, 0.64, 0.38, 0.79],
  [0.63, 0.29, 0.92, 0.55],   // ตลาดแผงขายของฝั่งขวา
  [0.71, 0.565, 0.90, 0.665], // ตึกใหญ่ฝั่งขวาล่าง
  [0.68, 0.69, 0.92, 0.79],
  [0.38, 0.43, 0.67, 0.66],   // สระกลางเมือง
];

window.TownHooks = window.TownHooks || {};

const TOWN_DEAD_MSG = '💀 คุณตายแล้ว ฟื้นคืนชีพที่เมือง';
const DEATH_EXP_LOSS = 0.01;

// ---------- ตัวช่วยพื้นฐาน ----------
function townIdx() {
  return (typeof ZONES !== 'undefined') ? ZONES.findIndex(function (z) { return z.town; }) : -1;
}
function townMain(sc) { return window.__mainScene || window._townMain || sc || null; }
function inTown(m) {
  const z = m && (typeof ZONES !== 'undefined') && ZONES[m.stageIdx];
  return !!(z && z.town);
}
function townDepth(y) { return 2 + y * 0.015; }

Object.defineProperty(window, '_townBusy', {
  configurable: true,
  get: function () { const m = window.__mainScene; return !!(m && inTown(m)); },
  set: function () {},
});

function townInPvp(m) {
  try {
    if (m && (m.inPvp || m.pvpActive || m.pvpMode || m.noDeathPenalty)) return true;
    if (m && m.pvp && (m.pvp.active || m.pvp.inMatch || m.pvp.inRoom)) return true;
    const P = window.PVP || window.Pvp || window.pvp;
    if (P && typeof P === 'object' && (P.active || P.inMatch || P.inRoom || P.inArena)) return true;
    if (typeof window.isPvp === 'function' && window.isPvp()) return true;
  } catch (e) {}
  return false;
}

function townRevive(m) {
  try {
    let lost = 0;
    if (!townInPvp(m)) {
      const cur = m.stats.exp || 0;
      lost = Math.min(cur, Math.ceil(cur * DEATH_EXP_LOSS));
      m.stats.exp = cur - lost;
    }
    const base = window.TOWN_NOTICE || TOWN_DEAD_MSG;
    window.TOWN_NOTICE = base + (lost > 0 ? '\nเสีย EXP ' + lost + ' (1%)' : '\n(ไม่เสีย EXP)');
    m.autoMode = false; m.target = null; m.manualTarget = null;
    if (m.enemies) m.enemies.getChildren().forEach(function (e) { if (e.state === 'chase') e.state = 'return'; });
    if (m.enemyShots) m.enemyShots.getChildren().slice().forEach(function (s) { s.destroy(); });
    m.stats.hp = m.maxHp();
    m.stats.mp = m.maxMp();
    if (typeof m.saveSoon === 'function') m.saveSoon();
    else if (typeof m.saveGame === 'function') m.saveGame();
  } catch (e) { console.warn('revive failed', e); }
}

// ---------- กล่องข้อความ DOM ----------
function townCloseDialog(m) {
  if (m && m.townModal) { m.townModal.remove(); m.townModal = null; }
}
function townDomCard(m, title) {
  townCloseDialog(m);
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
  m.townModal = box;
  return card;
}
function townCloseBtn(m, card) {
  const btn = document.createElement('button');
  btn.textContent = 'ปิด';
  btn.style.cssText = 'font-family:inherit;font-size:15px;padding:7px 22px;border-radius:10px;cursor:pointer;margin-top:10px;' +
    'border:2px solid #ffd45c;color:#ffe28a;background:#26090f';
  btn.addEventListener('click', function () { townCloseDialog(m); });
  card.appendChild(btn);
}
function townDialog(m, title, text, buttons) {
  townCloseDialog(m);
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
  t.style.cssText = 'font-size:15px;line-height:1.5;margin-bottom:14px;white-space:pre-line';
  t.textContent = text;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
  buttons.forEach(function (b) {
    const btn = document.createElement('button');
    btn.textContent = b.label;
    btn.style.cssText = 'font-family:inherit;font-size:15px;padding:8px 14px;border-radius:10px;cursor:pointer;' +
      'border:2px solid #ffd45c;color:' + (b.primary ? '#26090f' : '#ffe28a') + ';background:' + (b.primary ? '#ffd45c' : '#26090f');
    btn.addEventListener('click', function () { townCloseDialog(m); if (b.fn) b.fn(); });
    row.appendChild(btn);
  });
  card.append(h, t, row);
  box.appendChild(card);
  document.body.appendChild(box);
  m.townModal = box;
}

// ---------- NPC ----------
function townMakeNpc(m, n, ox, oy, atlas, objs) {
  const nx = ox + n.x * TOWN.w, ny = oy + n.y * TOWN.h;
  const npcH = Phaser.Math.Clamp((m.player && m.player.displayHeight) ? m.player.displayHeight * 1.15 : 96, 80, 150);
  const c = m.add.container(nx, ny).setDepth(townDepth(ny));
  const g = m.add.graphics();
  const textStyle = { fontFamily: 'Mitr, sans-serif', fontSize: '16px', color: '#ffe28a', stroke: '#000', strokeThickness: 4 };
  const titleStyle = { fontFamily: 'Mitr, sans-serif', fontSize: '13px', color: '#fff', backgroundColor: '#000000aa', padding: { x: 6, y: 2 } };
  let box, nameY;

  if (atlas && m.textures.getFrame('town', n.sprite)) {
    g.fillStyle(0x000000, 0.35).fillEllipse(0, 2, 62, 16);
    const spr = m.add.image(0, 8, 'town', n.sprite).setOrigin(0.5, 1);
    const k = npcH / spr.height;
    spr.setScale(k);
    const w = spr.displayWidth, h = spr.displayHeight;
    const tw = m.tweens.add({
      targets: spr, scaleY: k * 1.018, yoyo: true, repeat: -1,
      duration: 950 + Math.floor(Math.random() * 400), ease: 'Sine.easeInOut',
    });
    objs.push({ destroy: function () { tw.remove(); } });
    nameY = 8 - h - 14;
    const name = m.add.text(0, nameY, n.name, textStyle).setOrigin(0.5);
    const title = m.add.text(0, 26, n.title, titleStyle).setOrigin(0.5);
    c.add([g, spr, name, title]);
    box = { cx: 0, cy: 8 - h / 2, w: Math.max(w + 40, 130), h: h + 60 };
  } else {
    g.fillStyle(0x000000, 0.35).fillEllipse(0, 30, 54, 16);
    g.fillStyle(n.color, 1).fillRoundedRect(-28, -28, 56, 56, 14);
    g.lineStyle(4, 0xffffff, 1).strokeRoundedRect(-28, -28, 56, 56, 14);
    const icon = m.add.text(0, 0, n.icon, { fontSize: '32px' }).setOrigin(0.5);
    nameY = -52;
    const name = m.add.text(0, nameY, n.name, textStyle).setOrigin(0.5);
    const title = m.add.text(0, 46, n.title, titleStyle).setOrigin(0.5);
    c.add([g, icon, name, title]);
    box = { cx: 0, cy: 0, w: 130, h: 140 };
  }

  const BW = 112, BH = 42, btnY = nameY - 42;
  const bg = m.add.graphics();
  bg.fillStyle(0x000000, 0.35).fillRoundedRect(-BW / 2 + 2, -BH / 2 + 4, BW, BH, 14);
  bg.fillStyle(0xffd45c, 1).fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 14);
  bg.lineStyle(3, 0x26090f, 1).strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 14);
  const bt = m.add.text(0, 0, '💬 คุย', {
    fontFamily: 'Mitr, sans-serif', fontSize: '22px', color: '#26090f', fontStyle: 'bold',
  }).setOrigin(0.5);
  const btn = m.add.container(0, btnY, [bg, bt]);
  c.add(btn);
  const tw2 = m.tweens.add({ targets: btn, y: btnY - 6, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
  objs.push({ destroy: function () { tw2.remove(); } });

  const onTap = function () { townApproach(m, n, nx, ny); };
  const zBody = m.add.zone(nx + box.cx, ny + box.cy, box.w, box.h).setDepth(60).setInteractive({ useHandCursor: true });
  zBody.on('pointerdown', onTap);
  const zBtn = m.add.zone(nx, ny + btnY, BW + 50, BH + 36).setDepth(61).setInteractive({ useHandCursor: true });
  zBtn.on('pointerdown', onTap);
  objs.push(c, zBody, zBtn);
}

function townTalk(m, n) {
  const hook = window.TownHooks[n.id];
  if (typeof hook === 'function') { hook(m, n); return; }
  townDialog(m, n.icon + ' ' + n.name, TOWN_TEXT[n.id] || '...', [{ label: 'ตกลง', primary: true }]);
}

function townApproach(m, n, nx, ny) {
  if (m.townModal || m.panel || !m.player) return;
  const p = m.player;
  if (Math.hypot(nx - p.x, ny - (p.y + TOWN.feet)) < 150) {
    m.townGoal = null; m.townPending = null;
    townTalk(m, n);
    return;
  }
  m.townPending = { n: n, x: nx, y: ny };
  m.townGoal = { x: nx, y: ny - TOWN.feet };
  if (m.toastMsg) m.toastMsg('กำลังเดินไปหา ' + n.name);
}

// ---------- สร้าง/ล้างเมืองในฉาก Main ----------
// โหลดรูปเมืองตอนเข้าเมืองครั้งแรก (ไม่โหลดตอนเปิดเกม) แล้วเรียก done
function townLoadMap(m, done) {
  if (m.textures.exists('map_town')) { done(); return; }
  if (typeof MAP_FILES === 'undefined' || !MAP_FILES.map_town) return;
  m.load.once('filecomplete-image-map_town', done);
  m.load.once('loaderror', function (f) { if (f && f.key === 'map_town') console.warn('โหลดรูปเมืองไม่ได้:', f.src); });
  m.load.image('map_town', MAP_FILES.map_town);
  if (!m.load.isLoading()) m.load.start();
}

function townBuild(m) {
  const wb = m.physics.world.bounds;
  const ox = Math.round(wb.x + (wb.width - TOWN.w) / 2);
  const oy = Math.round(wb.y + (wb.height - TOWN.h) / 2);
  const objs = [], blockers = [];
  const atlas = m.textures.exists('town');

  // พื้นหลังเขียวเข้มรอบรูปเมือง
  objs.push(m.add.rectangle(wb.x + wb.width / 2, wb.y + wb.height / 2, wb.width, wb.height, 0x1b241b).setDepth(1));

  // กำแพง/อาคาร/สระ -> กรอบกันเดิน
  TOWN_BLOCKS.forEach(function (f) {
    blockers.push({ x0: ox + f[0] * TOWN.w, y0: oy + f[1] * TOWN.h, x1: ox + f[2] * TOWN.w, y1: oy + f[3] * TOWN.h });
  });

  TOWN_NPCS.forEach(function (n) { townMakeNpc(m, n, ox, oy, atlas, objs); });

  const T = {
    ox: ox, oy: oy, objs: objs, blockers: blockers,
    bounds: {
      x0: ox + TOWN.walk.x0 * TOWN.w, y0: oy + TOWN.walk.y0 * TOWN.h,
      x1: ox + TOWN.walk.x1 * TOWN.w, y1: oy + TOWN.walk.y1 * TOWN.h,
    },
  };

  // รูปเมือง (โหลดเสร็จแล้วค่อยวาง ถ้าออกจากเมืองไปก่อนก็ไม่วาง)
  const place = function () {
    if (m._town !== T || !m.textures.exists('map_town')) return;
    const img = m.add.image(ox + TOWN.w / 2, oy + TOWN.h / 2, 'map_town').setDisplaySize(TOWN.w, TOWN.h).setDepth(1.2);
    T.objs.push(img);
  };
  townLoadMap(m, function () { m.time.delayedCall(0, place); });   // เลื่อน 1 เฟรม เพราะ m._town ยังไม่ถูกตั้งตอนที่ townBuild ยังไม่จบ

  return T;
}

function townTeardown(m) {
  townCloseDialog(m);
  if (m._town) {
    m._town.objs.forEach(function (o) { try { o.destroy(); } catch (e) {} });
    m._town = null;
  }
  m.townGoal = null; m.townPending = null; m._townMine = null;
}

function townBlocked(T, x, y) {
  const bs = T.blockers;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (x > b.x0 - 6 && x < b.x1 + 6 && y > b.y0 && y < b.y1) return true;
  }
  return false;
}

// มอนของด่านก่อนหน้าต้องไม่เหลือในเมือง
function townClearMonsters(m) {
  const GO = (typeof Phaser !== 'undefined') ? Phaser.GameObjects : null;
  const keep = new Set();
  if (m.player) keep.add(m.player);
  if (m.myLabel) keep.add(m.myLabel);
  // v9: เก็บ GameObject ทุกชิ้นของผู้เล่นอื่น (สไปรต์ ป้ายชื่อ ป้ายเลเวล ฯลฯ) ไม่ใช่แค่ o.s / o.t
  Object.values(m.others || {}).forEach(function (o) {
    if (!o) return;
    Object.keys(o).forEach(function (k) {
      const v = o[k];
      if (v && typeof v === 'object' && v.scene) keep.add(v);
    });
  });
  const kill = function (o) { if (o && !keep.has(o) && o.scrollFactorX !== 0) { try { o.destroy(); } catch (e) {} } };
  const isVisual = function (o) {
    return !!(GO && o && (o instanceof GO.Text || o instanceof GO.Image || o instanceof GO.Graphics || o instanceof GO.Container));
  };

  // 1) ทำลายของที่ผูกกับมอนแต่ละตัว (ป้ายชื่อ ไอคอน หลอดเลือด) ก่อนลบตัวมอน
  ['enemies', 'bosses', 'miniBosses'].forEach(function (k) {
    const g = m[k];
    if (!g || typeof g.getChildren !== 'function') return;
    g.getChildren().slice().forEach(function (e) {
      Object.keys(e).forEach(function (key) {
        const v = e[key];
        if (v === e) return;
        if (isVisual(v)) kill(v);
        else if (Array.isArray(v)) v.forEach(function (x) { if (x !== e && isVisual(x)) kill(x); });
      });
    });
  });
  ['enemies', 'bosses', 'miniBosses', 'enemyShots'].forEach(function (k) {
    const g = m[k];
    if (g && typeof g.clear === 'function') { try { g.clear(true, true); } catch (e) {} }
  });

  // 2) กวาดป้ายชื่อมอนที่ไม่ได้ผูกกับตัวมอน + ของตกแต่งด่านเก่า (รูปแผนที่ map_* ไม่อยู่ใน MAP_IMAGES จึงไม่โดนลบ)
  const deco = (typeof MAP_IMAGES !== 'undefined') ? MAP_IMAGES : {};
  m.children.list.slice().forEach(function (o) {
    if (keep.has(o) || o.scrollFactorX === 0) return;
    const key = o.texture && o.texture.key;
    const lvText = function (t) { return t && t.type === 'Text' && /Lv\.\s?\d+/.test(t.text || ''); };
    if (lvText(o) || (o.type === 'Container' && o.list && o.list.some(lvText)) ||
        (key && deco[key] && key !== 'floor_grass')) kill(o);
  });

  m.autoMode = false; m.target = null; m.manualTarget = null;
}

function townEnter(m) {
  townTeardown(m);
  m._town = townBuild(m);
  const T = m._town;
  const sx = T.ox + TOWN.spawn.fx * TOWN.w, sy = T.oy + TOWN.spawn.fy * TOWN.h;
  townClearMonsters(m);
  if (m.player) {
    m.player.setPosition(sx, sy);
    if (m.player.body) m.player.body.setVelocity(0, 0);
  }
  try { m.cameras.main.centerOn(sx, sy); } catch (e) {}
  T.lx = sx; T.ly = sy;
  try { m.invulnUntil = m.time.now + 3000; } catch (e) {}
  const b = document.getElementById('btn-to-town');
  if (b) b.style.display = 'none';
  if (typeof m.netSyncPlayers === 'function') { try { m._syncNext = 0; m.netSyncPlayers(); } catch (e) {} }   // v9: เข้าเมืองแล้วขอรายชื่อผู้เล่นในห้องใหม่
  if (window.TOWN_NOTICE) {
    townDialog(m, '🏰 เมือง', window.TOWN_NOTICE, [{ label: 'ตกลง', primary: true }]);
    window.TOWN_NOTICE = null;
  }
}

// ทำงานทุกเฟรมตอนอยู่ในเมือง
function townTick(m) {
  const T = m._town, p = m.player;
  if (!T || !p || !p.active) return;
  m.autoMode = false;
  const body = p.body, F = TOWN.feet;

  if (m.townGoal && body) {
    const v = body.velocity, mine = m._townMine;
    const userMoved = v.length() > 5 && (!mine || Math.abs(v.x - mine.x) > 5 || Math.abs(v.y - mine.y) > 5);
    if (userMoved || m.townModal) { m.townGoal = null; m.townPending = null; m._townMine = null; }
    else {
      const dx = m.townGoal.x - p.x, dy = m.townGoal.y - p.y, d = Math.hypot(dx, dy);
      if (d < 6) { m.townGoal = null; m._townMine = null; body.setVelocity(0, 0); }
      else {
        m._townMine = { x: dx / d * TOWN.speed, y: dy / d * TOWN.speed };
        body.setVelocity(m._townMine.x, m._townMine.y);
      }
    }
  }

  const B = T.bounds;
  let x = Phaser.Math.Clamp(p.x, B.x0 + 20, B.x1 - 20);
  let y = Phaser.Math.Clamp(p.y, B.y0 + 20, B.y1 - 24);
  if (T.lx !== undefined && townBlocked(T, x, y + F) && !townBlocked(T, T.lx, T.ly + F)) {
    if (!townBlocked(T, T.lx, y + F)) x = T.lx;
    else if (!townBlocked(T, x, T.ly + F)) y = T.ly;
    else { x = T.lx; y = T.ly; }
  }
  if (x !== p.x || y !== p.y) p.setPosition(x, y);
  T.lx = x; T.ly = y;

  const dp = townDepth(y + F);
  p.setDepth(dp);
  if (m.myLabel && m.myLabel.setDepth) m.myLabel.setDepth(dp + 0.01);
  Object.values(m.others || {}).forEach(function (o) {
    if (!o || !o.s || !o.s.setDepth) return;
    const d2 = townDepth(o.s.y + F);
    o.s.setDepth(d2);
    if (o.t && o.t.setDepth) o.t.setDepth(d2 + 0.01);
  });

  if (m.townPending) {
    const q = m.townPending;
    if (Math.hypot(q.x - x, q.y - (y + F)) < 110) {
      m.townPending = null; m.townGoal = null; m._townMine = null;
      if (body) body.setVelocity(0, 0);
      townTalk(m, q.n);
    }
  }
}

// ---------- เข้า/ออกเมือง ----------
function townGoToTown(scene, notice, died) {
  if (inTown(scene) || scene._goingTown) return;
  const idx = townIdx();
  if (idx < 0) { console.warn('ไม่พบด่านเมืองใน ZONES (ต้องมี town:true)'); return; }
  scene._goingTown = true;
  window.TOWN_NOTICE = notice || null;
  if (died) townRevive(scene);
  try { if (scene.closePanel) scene.closePanel(); } catch (e) {}
  scene.time.delayedCall(30, function () { scene.loadStage(idx); });
}

function townLeave(m) {
  if (!inTown(m)) return;
  try { if (m.closePanel) m.closePanel(); } catch (e) {}
  m.loadStage(m.lastFieldStage || 0);
}

// ---------- ครอบ Main ----------
(function patchMainForTown() {
  const target = (typeof Main === 'function') ? Main.prototype : Main;

  if (!target.dialog)       target.dialog = function (t, x, b) { townDialog(this, t, x, b); };
  if (!target.domCard)      target.domCard = function (t) { return townDomCard(this, t); };
  if (!target.domCloseBtn)  target.domCloseBtn = function (c) { townCloseBtn(this, c); };
  if (!target.closeDialog)  target.closeDialog = function () { townCloseDialog(this); };

  const origPreload = target.preload;
  target.preload = function () {
    if (origPreload) origPreload.apply(this, arguments);
    if (!this.textures.exists('town')) {
      this.load.on('loaderror', function (f) { if (f && f.key === 'town') console.warn('town asset missing:', f.src); });
      this.load.multiatlas('town', TOWN.atlas + 'town.json?v=' + TOWN.ver, TOWN.atlas);
    }
  };

  const origCreate = target.create;
  target.create = function () {
    if (origCreate) origCreate.apply(this, arguments);
    try {
      window._townMain = this;
      if (!window.__mainScene) window.__mainScene = this;
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

  const origLoad = target.loadStage;
  if (typeof origLoad === 'function') {
    target.loadStage = function () {
      townTeardown(this);
      const r = origLoad.apply(this, arguments);
      this._goingTown = false;
      if (inTown(this)) townEnter(this);
      else {
        this.lastFieldStage = this.stageIdx;
        const b = document.getElementById('btn-to-town');
        if (b) b.style.display = '';
      }
      return r;
    };
  }

  const origUpdate = target.update;
  target.update = function () {
    if (origUpdate) origUpdate.apply(this, arguments);
    const s = this.stats;
    if (inTown(this)) { townTick(this); return; }
    if (s && typeof s.hp === 'number' && s.hp <= 0) townGoToTown(this, TOWN_DEAD_MSG, true);
  };
})();
