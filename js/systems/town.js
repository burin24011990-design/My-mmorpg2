// ===== เมือง v8 — เมืองเป็น "ด่านหนึ่ง" ในฉาก Main (เห็นผู้เล่นอื่น / แชนเนล / ห้อง ใช้ร่วมกับข้างนอก) =====
// ไฟล์: js/systems/town.js  (แทนไฟล์เดิมทั้งไฟล์)  | โหลดก่อน js/main.js
// - ไม่มีฉาก Town แยกแล้ว: main.js ใช้ scene: [Main] อย่างเดียว
// - ต้องมีด่าน { town:true } ต่อท้าย ZONES ใน js/data/zones.js (ดูไฟล์ zones ที่แก้)
// - เข้าเมือง = Main.loadStage(ดัชนีด่านเมือง) -> network.js ย้ายห้องให้เองตามด่าน
// - ฟังก์ชันชื่อเดิม (townGoToTown / townLeave / townMain / townRevive / TownHooks / window._townBusy)
//   ยังอยู่ครบ ไฟล์อื่น (fixes.js, pvp.js, market.js ...) เรียกต่อได้

const TOWN = {
  w: 2400, h: 1900, spawnX: 1200, spawnY: 1360, speed: 190, feet: 20,
  atlas: 'assets/town/', ver: 2,          // เปลี่ยน ver เมื่ออัปเดตไฟล์ภาพ
};

// ---------- ปุ่มเมือง + ปุ่มแชนเนล (DOM) — เหมือนเดิม ----------
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

// ---------- NPC (ข้อมูลเดิมทั้งหมด) | x,y = จุดเท้า (พิกัดในผังเมือง 2400x1900) ----------
const TOWN_NPCS = [
  { id: 'pvp',    name: 'ผู้ดูแลสนามประลอง', title: 'ห้อง PvP',          x: 1700, y: 1400, sprite: 'npc_pvp',    color: 0xe05555, icon: '⚔️' },
  { id: 'market', name: 'พ่อค้าตลาดกลาง',   title: 'ตลาดกลาง',          x: 860,  y: 1120, sprite: 'npc_market', color: 0xf0c040, icon: '🏪' },
  { id: 'trade',  name: 'นายหน้าแลกเปลี่ยน', title: 'แลกเปลี่ยนไอเทม',   x: 1540, y: 1120, sprite: 'npc_trade',  color: 0x55b0e0, icon: '🔄' },
  { id: 'boss',   name: 'ผู้นำทางบอสโลก',   title: 'บอสโลก (เร็วๆ นี้)', x: 1110, y: 705,  sprite: 'npc_boss',   color: 0xa060e0, icon: '👹' },
];

const TOWN_TEXT = {
  pvp:    'ยินดีต้อนรับสู่สนามประลอง! ระบบ PvP กำลังเตรียมเปิด',
  market: 'ตลาดกลางสำหรับซื้อขายไอเทมระหว่างผู้เล่น กำลังเตรียมเปิด',
  trade:  'แลกเปลี่ยนไอเทมกับผู้เล่นคนอื่นได้ที่นี่ กำลังเตรียมเปิด',
  boss:   'บอสโลกกำลังจะมาเร็วๆ นี้! ต้องใช้กุญแจเปิดประตู และรวมปาร์ตี้ 10 คนขึ้นไป โปรดรอการอัปเดต',
};

// ---------- ผังเมือง (เหมือนเดิม) ----------
const TOWN_ROADS = [
  { x: 1125, y: 640,  w: 150,  h: 1260 },
  { x: 330,  y: 665,  w: 1740, h: 110 },
  { x: 330,  y: 1315, w: 1740, h: 110 },
];

const TOWN_BUILDINGS = [
  { k: 'bld_hall',   x: 1200, y: 650,  foot: 0.50, block: [[0.22,0.02,0.78,0.50],[0.06,0.40,0.31,0.84],[0.69,0.40,0.94,0.84],[0.33,0.64,0.67,0.82]] },
  { k: 'bld_temple', x: 520,  y: 640,  foot: 0.62, block: [[0.20,0.05,0.80,0.62],[0.72,0.40,0.96,0.74]] },
  { k: 'bld_koi',    x: 1880, y: 640,  foot: 1.00, block: [[0.05,0.02,0.95,0.98]] },
  { k: 'bld_inn',    x: 480,  y: 1290, foot: 0.62, block: [[0.22,0.02,0.72,0.62],[0.06,0.38,0.28,0.72],[0.72,0.30,0.96,0.80],[0.06,0.74,0.34,0.96]] },
  { k: 'bld_herb',   x: 1920, y: 1290, foot: 0.62, block: [[0.22,0.02,0.75,0.62],[0.72,0.28,0.96,0.62],[0.04,0.35,0.30,0.58],[0.70,0.72,0.96,0.90]] },
  { k: 'qi',         x: 1200, y: 1270, foot: 0.30, block: [[0.30,0.00,0.70,0.27],[0.05,0.45,0.22,0.78],[0.78,0.45,0.95,0.78],[0.35,0.80,0.45,0.95],[0.55,0.80,0.65,0.95]] },
  { k: 'bld_forge',  x: 520,  y: 1800, foot: 0.40, block: [[0.10,0.03,0.85,0.40],[0.04,0.25,0.38,0.58],[0.62,0.20,0.84,0.58],[0.78,0.52,0.98,0.82],[0.12,0.77,0.27,0.90],[0.54,0.77,0.92,0.90]] },
  { k: 'gate',       x: 1200, y: 1860, foot: 1.00, block: [[0.04,0.70,0.30,1.00],[0.70,0.70,0.96,1.00]] },
];

const TOWN_PROPS = [
  { k: 'tree_bamboo', x: 150,  y: 560,  bw: 150 }, { k: 'tree_bamboo', x: 2250, y: 560,  bw: 150, flip: 1 },
  { k: 'tree_pine',   x: 130,  y: 930,  bw: 110 }, { k: 'tree_pine',   x: 2270, y: 930,  bw: 110, flip: 1 },
  { k: 'tree_plum',   x: 130,  y: 1230, bw: 100 }, { k: 'tree_plum',   x: 2270, y: 1230, bw: 100, flip: 1 },
  { k: 'tree_bamboo', x: 150,  y: 1620, bw: 150 }, { k: 'tree_bamboo', x: 2260, y: 1640, bw: 150, flip: 1 },
  { k: 'pole1', x: 330,  y: 780,  bw: 40, bh: 20 }, { k: 'pole1', x: 2070, y: 780,  bw: 40, bh: 20, flip: 1 },
  { k: 'pole2', x: 330,  y: 1400, bw: 40, bh: 20 }, { k: 'pole2', x: 2070, y: 1400, bw: 40, bh: 20, flip: 1 },
  { k: 'burner',  x: 1200, y: 770,  bw: 80, bh: 30 },
  { k: 'lantern', x: 1100, y: 800,  bw: 34, bh: 20 }, { k: 'lantern', x: 1300, y: 800,  bw: 34, bh: 20 },
  { k: 'lantern', x: 1100, y: 1335, bw: 34, bh: 20 }, { k: 'lantern', x: 1300, y: 1335, bw: 34, bh: 20 },
  { k: 'stall_green', x: 860,  y: 1010, bw: 150, bh: 50 },
  { k: 'stall_cream', x: 1540, y: 1010, bw: 150, bh: 50 },
  { k: 'rack_spear',   x: 1790, y: 1590, bw: 150, bh: 30 }, { k: 'rack_sword',  x: 2040, y: 1590, bw: 150, bh: 30 },
  { k: 'dummy_a',      x: 1760, y: 1730, bw: 34,  bh: 20 }, { k: 'dummy_hat',   x: 1850, y: 1730, bw: 34, bh: 20 },
  { k: 'dummy_target', x: 1990, y: 1730, bw: 34,  bh: 20 }, { k: 'dummy_big',   x: 2080, y: 1730, bw: 38, bh: 20 },
  { k: 'low_wall',     x: 1960, y: 1800, bw: 330, bh: 20 },
  { k: 'wall_l', x: 800,  y: 1895, bw: 380, bh: 36 }, { k: 'wall_l', x: 1600, y: 1895, bw: 380, bh: 36, flip: 1 },
  { k: 'rock1', x: 760,  y: 1480 }, { k: 'rock2', x: 1660, y: 1520 },
  { k: 'rock2', x: 330,  y: 1560 }, { k: 'rock1', x: 2150, y: 880  },
  { k: 'rock1', x: 980,  y: 1130 }, { k: 'rock2', x: 1420, y: 1160 },
];

// ผูกระบบจริงทีหลัง เช่น TownHooks.market = function (scene, npc) { ... };  (scene = Main แล้ว)
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
// depth ของของในเมือง: บีบให้อยู่ช่วง 2-36 เพื่อไม่ทับ HUD ของ Main (HUD ใช้ depth 100+)
function townDepth(y) { return 2 + y * 0.015; }

// เข้ากันได้กับไฟล์เก่าที่เช็ก window._townBusy (= ตอนนี้อยู่ในเมืองไหม)
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

// ชุบชีวิตหลังตาย: หัก EXP 1% (ยกเว้น PvP), ฟื้น HP/MP, ล้างมอนที่ไล่, เซฟ (ตำแหน่งจะถูกตั้งตอนเข้าเมือง)
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

// ---------- พื้นหญ้า + ถนนหิน (สร้างด้วยโค้ด) ----------
function townMakeGroundTextures(m) {
  if (m.textures.exists('town_grass')) return;
  const S = 128;
  let seed = 11;
  const rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const wrapRect = function (c, x, y, w, h) {
    for (const ox of [0, -S]) for (const oy of [0, -S]) c.fillRect(x + ox, y + oy, w, h);
  };
  const gt = m.textures.createCanvas('town_grass', S, S);
  const gc = gt.getContext('2d');
  gc.fillStyle = '#44703c'; gc.fillRect(0, 0, S, S);
  const gcols = ['#3a6334', '#4f7c43', '#5b8a4a', '#33582f', '#668f4e'];
  for (let i = 0; i < 560; i++) {
    gc.fillStyle = gcols[Math.floor(rnd() * gcols.length)];
    wrapRect(gc, Math.floor(rnd() * S), Math.floor(rnd() * S), 2 + Math.floor(rnd() * 3), 1 + Math.floor(rnd() * 2));
  }
  const fcols = ['#e9e2c8', '#f2c9d0', '#f0dc7a'];
  for (let i = 0; i < 9; i++) {
    gc.fillStyle = fcols[i % 3];
    wrapRect(gc, Math.floor(rnd() * S), Math.floor(rnd() * S), 2, 2);
  }
  gt.refresh();

  const ct = m.textures.createCanvas('town_cobble', S, S);
  const cc = ct.getContext('2d');
  cc.fillStyle = '#4d453a'; cc.fillRect(0, 0, S, S);
  const scols = ['#8d8473', '#9a917f', '#847b6b', '#a39a88', '#8a806f'];
  const N = 4, C = S / N;
  for (let gx = 0; gx < N; gx++) {
    for (let gy = 0; gy < N; gy++) {
      const x = gx * C + 2 + Math.floor(rnd() * 3), y = gy * C + 2 + Math.floor(rnd() * 3);
      const w = C - 5 - Math.floor(rnd() * 3), h = C - 5 - Math.floor(rnd() * 3);
      cc.fillStyle = scols[Math.floor(rnd() * scols.length)];
      cc.fillRect(x + 2, y, w - 4, h); cc.fillRect(x, y + 2, w, h - 4); cc.fillRect(x + 1, y + 1, w - 2, h - 2);
      cc.fillStyle = 'rgba(255,255,255,.18)'; cc.fillRect(x + 3, y + 1, w - 7, 2);
      cc.fillStyle = 'rgba(0,0,0,.18)';       cc.fillRect(x + 3, y + h - 2, w - 6, 2);
    }
  }
  for (let i = 0; i < 30; i++) {
    cc.fillStyle = (i % 2) ? 'rgba(70,110,60,.55)' : 'rgba(0,0,0,.18)';
    cc.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), 2, 2);
  }
  ct.refresh();
}

// ---------- NPC (ย้ายมาจากฉาก Town เดิม) ----------
function townMakeNpc(m, n, ox, oy, atlas, objs) {
  const nx = ox + n.x, ny = oy + n.y;
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

  // ปุ่ม "💬 คุย" ลอยเหนือชื่อ
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

  // พื้นที่กด (Zone) — depth 60 = เหนือของในเมือง แต่ต่ำกว่า HUD ของ Main (ถ้าปุ่ม HUD ถูกบัง ให้ลดเลขนี้)
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

// กด NPC: ใกล้พอ = คุยเลย | ไกล = เดินไปหาแล้วคุยให้เอง (townTick เช็กระยะ 110)
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
function townBuild(m) {
  const wb = m.physics.world.bounds;
  // วางผังเมืองไว้กลางโลกของ Main
  const ox = Math.round(wb.x + (wb.width - TOWN.w) / 2);
  const oy = Math.round(wb.y + (wb.height - TOWN.h) / 2);
  const objs = [], blockers = [];
  const atlas = m.textures.exists('town');
  const has = function (k) { return atlas && !!m.textures.getFrame('town', k); };

  townMakeGroundTextures(m);
  objs.push(m.add.tileSprite(wb.x, wb.y, wb.width, wb.height, 'town_grass').setOrigin(0).setDepth(1));
  const edge = m.add.graphics().setDepth(1.5);
  objs.push(edge);
  TOWN_ROADS.forEach(function (r) {
    objs.push(m.add.tileSprite(ox + r.x, oy + r.y, r.w, r.h, 'town_cobble').setOrigin(0).setDepth(1.2));
    edge.lineStyle(5, 0x3a342b, 0.95).strokeRect(ox + r.x, oy + r.y, r.w, r.h);
    edge.lineStyle(2, 0x6f9a55, 0.8).strokeRect(ox + r.x - 4, oy + r.y - 4, r.w + 8, r.h + 8);
  });

  TOWN_BUILDINGS.forEach(function (b) {
    if (!has(b.k)) return;
    const bx = ox + b.x, by = oy + b.y;
    const s = m.add.image(bx, by, 'town', b.k).setOrigin(0.5, 1);
    const w = s.displayWidth, h = s.displayHeight, left = bx - w / 2, top = by - h;
    s.setDepth(townDepth(by - h * (1 - b.foot)));
    objs.push(s);
    b.block.forEach(function (f) {
      blockers.push({ x0: left + f[0] * w, y0: top + f[1] * h, x1: left + f[2] * w, y1: top + f[3] * h });
    });
  });

  TOWN_PROPS.forEach(function (p) {
    if (!has(p.k)) return;
    const px = ox + p.x, py = oy + p.y;
    const s = m.add.image(px, py, 'town', p.k).setOrigin(0.5, 1).setDepth(townDepth(p.bw === undefined ? py - 1 : py));
    if (p.flip) s.setFlipX(true);
    objs.push(s);
    if (p.bw) blockers.push({ x0: px - p.bw / 2, y0: py - (p.bh || 24), x1: px + p.bw / 2, y1: py });
  });

  objs.push(m.add.text(ox + TOWN.w / 2, oy + 56, '🏰 เมืองเริ่มต้น', {
    fontFamily: 'Mitr, sans-serif', fontSize: '34px', color: '#ffe28a', stroke: '#000', strokeThickness: 5,
  }).setOrigin(0.5).setDepth(40));

  TOWN_NPCS.forEach(function (n) { townMakeNpc(m, n, ox, oy, atlas, objs); });

  return { ox: ox, oy: oy, objs: objs, blockers: blockers,
           bounds: { x0: ox, y0: oy, x1: ox + TOWN.w, y1: oy + TOWN.h } };
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

// มอนของด่านก่อนหน้าต้องไม่เหลือในเมือง (กันกรณี loadStage ยังเสกมอน/บอสมาให้)
function townClearMonsters(m) {
  ['enemies', 'bosses', 'miniBosses', 'enemyShots'].forEach(function (k) {
    const g = m[k];
    if (g && typeof g.clear === 'function') { try { g.clear(true, true); } catch (e) {} }
  });
  m.autoMode = false; m.target = null; m.manualTarget = null;
}

function townEnter(m) {
  townTeardown(m);
  m._town = townBuild(m);
  const T = m._town;
  const sx = T.ox + TOWN.spawnX, sy = T.oy + TOWN.spawnY;
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
  if (window.TOWN_NOTICE) {
    townDialog(m, '🏰 เมือง', window.TOWN_NOTICE, [{ label: 'ตกลง', primary: true }]);
    window.TOWN_NOTICE = null;
  }
}

// ทำงานทุกเฟรมตอนอยู่ในเมือง: เดินไปหา NPC, ชนอาคาร, กันออกนอกเมือง, เรียง depth
function townTick(m) {
  const T = m._town, p = m.player;
  if (!T || !p || !p.active) return;
  m.autoMode = false;                       // ในเมืองไม่ออโต้
  const body = p.body, F = TOWN.feet;

  // เดินอัตโนมัติไปหา NPC (ผู้เล่นขยับเองเมื่อไหร่ก็ยกเลิก)
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

  // กันออกนอกเมือง + ชนอาคาร/พรอพ (แยกแกน = ไถลตามขอบได้)
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

  // เรียงลำดับซ้อน: ผู้เล่นเรา + คนอื่นที่เห็นในห้อง
  const dp = townDepth(y + F);
  p.setDepth(dp);
  if (m.myLabel && m.myLabel.setDepth) m.myLabel.setDepth(dp + 0.01);
  Object.values(m.others || {}).forEach(function (o) {
    if (!o || !o.s || !o.s.setDepth) return;
    const d2 = townDepth(o.s.y + F);
    o.s.setDepth(d2);
    if (o.t && o.t.setDepth) o.t.setDepth(d2 + 0.01);
  });

  // ถึงตัว NPC แล้ว = เปิดบทสนทนา
  if (m.townPending) {
    const q = m.townPending;
    if (Math.hypot(q.x - x, q.y - (y + F)) < 110) {
      m.townPending = null; m.townGoal = null; m._townMine = null;
      if (body) body.setVelocity(0, 0);
      townTalk(m, q.n);
    }
  }
}

// ---------- เข้า/ออกเมือง (ชื่อเดิม — ไฟล์อื่นเรียกได้เหมือนเดิม) ----------
function townGoToTown(scene, notice, died) {
  if (inTown(scene) || scene._goingTown) return;
  const idx = townIdx();
  if (idx < 0) { console.warn('ไม่พบด่านเมืองใน ZONES (ต้องมี town:true)'); return; }
  scene._goingTown = true;
  window.TOWN_NOTICE = notice || null;
  if (died) townRevive(scene);
  try { if (scene.closePanel) scene.closePanel(); } catch (e) {}
  scene.time.delayedCall(30, function () { scene.loadStage(idx); });   // เลื่อนไปเฟรมถัดไป กันทำลายของกลางลูป update
}

function townLeave(m) {
  if (!inTown(m)) return;
  try { if (m.closePanel) m.closePanel(); } catch (e) {}
  m.loadStage(m.lastFieldStage || 0);
}

// ---------- ครอบ Main ----------
(function patchMainForTown() {
  const target = (typeof Main === 'function') ? Main.prototype : Main;

  // ฟังก์ชันกล่องข้อความ (เผื่อ TownHooks เดิมเรียก scene.dialog / domCard / domCloseBtn / closeDialog)
  if (!target.dialog)       target.dialog = function (t, x, b) { townDialog(this, t, x, b); };
  if (!target.domCard)      target.domCard = function (t) { return townDomCard(this, t); };
  if (!target.domCloseBtn)  target.domCloseBtn = function (c) { townCloseBtn(this, c); };
  if (!target.closeDialog)  target.closeDialog = function () { townCloseDialog(this); };

  // โหลดอะตลาสภาพเมือง
  const origPreload = target.preload;
  target.preload = function () {
    if (origPreload) origPreload.apply(this, arguments);
    if (!this.textures.exists('town')) {
      this.load.on('loaderror', function (f) { if (f && f.key === 'town') console.warn('town asset missing:', f.src); });
      this.load.multiatlas('town', TOWN.atlas + 'town.json?v=' + TOWN.ver, TOWN.atlas);
    }
  };

  // สร้างเสร็จ: ใส่ปุ่มกลับเมือง และเข้าเมืองทันที (เริ่มเกมที่เมือง)
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

  // ทุกครั้งที่เปลี่ยนด่าน: ล้างของเมืองเก่า -> โหลดด่าน -> ถ้าเป็นเมืองให้สร้างเมือง
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

  // HP หมด = กลับเมือง | อยู่ในเมืองทำงานของเมือง
  const origUpdate = target.update;
  target.update = function () {
    if (origUpdate) origUpdate.apply(this, arguments);
    const s = this.stats;
    if (inTown(this)) { townTick(this); return; }
    if (s && typeof s.hp === 'number' && s.hp <= 0) townGoToTown(this, TOWN_DEAD_MSG, true);
  };
})();
