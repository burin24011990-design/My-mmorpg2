// ===== ฉากเมืองเริ่มต้น (Town) v7.5 — เมืองจีนย้อนยุคพลังภายใน =====
// ไฟล์: js/systems/town.js  (โหลดก่อน js/main.js)
// - เกมเริ่มที่เมืองเสมอ (Main ถูกสร้างก่อนแล้ว "พัก" ไว้ แล้วเปิดเมืองทับ)
// - ใช้ปุ่มเลือกด่านเดิมของเกม: กดเลือกด่านแล้วออกจากเมืองไปด่านนั้นทันที ไม่ต้องเดินไปประตู
// - ตาย = กลับเมือง (เติม HP/MP) + หัก EXP 1% (PvP ไม่หัก) | ปุ่ม "🏠 เมือง" ในฉากล่ามอนกลับเมืองได้
// - ต้องใช้คู่กับ main.js ที่ตั้งค่า scene: [Main, Town]
// - v6: ตัวละคร hero + อนิเมชันเดิน/ยืน, จอยสติ๊กลอยแบบเดียวกับข้างนอก (แตะซ้าย 40% ของจอ), ความเร็ว 190
// - v7: ใช้ภาพจริง (อะตลาส assets/town/town.json + town-0.png), แผนผังเมืองใหม่ 2400x1900,
//       ชนอาคาร/พรอพ, NPC เป็นสไปรต์, พื้นหญ้า/ถนนหินสร้างด้วยโค้ด (ไม่ต้องมีไฟล์)
//       ถ้าไม่มีไฟล์ภาพ จะถอยกลับไปใช้กล่องสีเหมือนเดิม เกมไม่พัง
// - v7.1: หน้าสเตตัสในเมืองแสดงสเตตัสครบเหมือนหน้าสเตตัสจริง (มีคริติคอล ฯลฯ) อ่านจาก STAT_DEFS ใน stats.js
// - v7.3: ปุ่ม "💬 คุย" ลอยเหนือหัว NPC + พื้นที่กดใหญ่ขึ้น (แก้จุดกดเพี้ยน) + กดไกลแล้วเดินไปคุยให้เอง
// - v7.2: ตายจริง (fixes.js เรียก townGoToTown) + หัก EXP 1% (ไม่หักใน PvP) + เซฟตอนตาย + อมตะ 3 วิตอนออกจากเมือง
// - v7.4: แก้อนิเมชันตัวละครในเมือง (เลือกสกินดาบ/มีดตามคลาส + ส่ง skin ให้ HeroAnims.play)
//         เพิ่มปุ่ม "จัดสกิล" มุมขวาล่างในเมือง (เปิดหน้าสกิลเดิมของ Main)
// - v7.5: แทนปุ่ม "จัดสกิล" ด้วยช่องสกิลชุดเดียวกับข้างนอก (โจมตี + สกิล 4 ช่อง + อัลติ + แดช เรียงโค้ดตำแหน่งเดิม)
//         แตะช่องสกิล = เปิดหน้าสกิลเพื่อเลือก/เปลี่ยนสกิลช่องนั้น | กดค้าง 0.5 วิ = ถอดสกิลออก
//         ปุ่มโจมตี/แดช/อัลติในเมืองเป็นแค่แสดงผล (ใช้ไม่ได้ในเมือง) | จอยสติ๊กไม่ทำงานขณะเปิดหน้าสกิล

const TOWN = {
  w: 2400, h: 1900, spawnX: 1200, spawnY: 1360, speed: 190,
  atlas: 'assets/town/', ver: 2,          // เปลี่ยน ver เมื่ออัปเดตไฟล์ภาพ
};

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


// ----- NPC 4 ตัว (id/ข้อความ/Hook เดิมทั้งหมด เปลี่ยนแค่หน้าตาและตำแหน่ง) -----
// x,y = จุดเท้า | sprite = ชื่อเฟรมในอะตลาส | color/icon ใช้เป็นตัวสำรองเมื่อไม่มีภาพ
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

// ----- แผนผังเมือง (พิกัดโลก 2400 x 1900) -----
// ถนน: ตรงกลางแนวตั้ง 1 สาย + แนวนอน 2 สาย
const TOWN_ROADS = [
  { x: 1125, y: 640,  w: 150,  h: 1260 },   // ถนนหลัก ประตูเมือง -> สำนัก
  { x: 330,  y: 665,  w: 1740, h: 110 },    // ถนนเหนือ
  { x: 330,  y: 1315, w: 1740, h: 110 },    // ถนนใต้ (จุดเกิดอยู่ตรงนี้)
];

// อาคาร: k=ชื่อเฟรม, x=กึ่งกลาง, y=ชายล่าง
// foot = ส่วนสูง (0-1) ที่ตัวอาคารจบลง ผู้เล่นที่ยืนต่ำกว่าเส้นนี้จะถูกวาดทับอาคาร (เดินในลานได้)
// block = กล่องห้ามเดิน [x0,y0,x1,y1] เป็นสัดส่วนของภาพ (0-1)
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

// พรอพ/ต้นไม้/ลานฝึก: bw = ความกว้างตัวกั้นที่ฐาน (0 = เดินทะลุได้), bh = ความลึกตัวกั้น
const TOWN_PROPS = [
  // ขอบเมือง
  { k: 'tree_bamboo', x: 150,  y: 560,  bw: 150 }, { k: 'tree_bamboo', x: 2250, y: 560,  bw: 150, flip: 1 },
  { k: 'tree_pine',   x: 130,  y: 930,  bw: 110 }, { k: 'tree_pine',   x: 2270, y: 930,  bw: 110, flip: 1 },
  { k: 'tree_plum',   x: 130,  y: 1230, bw: 100 }, { k: 'tree_plum',   x: 2270, y: 1230, bw: 100, flip: 1 },
  { k: 'tree_bamboo', x: 150,  y: 1620, bw: 150 }, { k: 'tree_bamboo', x: 2260, y: 1640, bw: 150, flip: 1 },
  // เสาโคมปลายถนน
  { k: 'pole1', x: 330,  y: 780,  bw: 40, bh: 20 }, { k: 'pole1', x: 2070, y: 780,  bw: 40, bh: 20, flip: 1 },
  { k: 'pole2', x: 330,  y: 1400, bw: 40, bh: 20 }, { k: 'pole2', x: 2070, y: 1400, bw: 40, bh: 20, flip: 1 },
  // กลางเมือง
  { k: 'burner',  x: 1200, y: 770,  bw: 80, bh: 30 },
  { k: 'lantern', x: 1100, y: 800,  bw: 34, bh: 20 }, { k: 'lantern', x: 1300, y: 800,  bw: 34, bh: 20 },
  { k: 'lantern', x: 1100, y: 1335, bw: 34, bh: 20 }, { k: 'lantern', x: 1300, y: 1335, bw: 34, bh: 20 },
  // ตลาด
  { k: 'stall_green', x: 860,  y: 1010, bw: 150, bh: 50 },
  { k: 'stall_cream', x: 1540, y: 1010, bw: 150, bh: 50 },
  // ลานฝึก
  { k: 'rack_spear',   x: 1790, y: 1590, bw: 150, bh: 30 }, { k: 'rack_sword',  x: 2040, y: 1590, bw: 150, bh: 30 },
  { k: 'dummy_a',      x: 1760, y: 1730, bw: 34,  bh: 20 }, { k: 'dummy_hat',   x: 1850, y: 1730, bw: 34, bh: 20 },
  { k: 'dummy_target', x: 1990, y: 1730, bw: 34,  bh: 20 }, { k: 'dummy_big',   x: 2080, y: 1730, bw: 38, bh: 20 },
  { k: 'low_wall',     x: 1960, y: 1800, bw: 330, bh: 20 },
  // กำแพงข้างประตูเมือง
  { k: 'wall_l', x: 800,  y: 1895, bw: 380, bh: 36 }, { k: 'wall_l', x: 1600, y: 1895, bw: 380, bh: 36, flip: 1 },
  // ก้อนหินประดับ (เดินทะลุได้)
  { k: 'rock1', x: 760,  y: 1480 }, { k: 'rock2', x: 1660, y: 1520 },
  { k: 'rock2', x: 330,  y: 1560 }, { k: 'rock1', x: 2150, y: 880  },
  { k: 'rock1', x: 980,  y: 1130 }, { k: 'rock2', x: 1420, y: 1160 },
];

// ผูกระบบจริงทีหลัง เช่น TownHooks.market = function (scene) { ... };
window.TownHooks = window.TownHooks || {};

const TOWN_DEAD_MSG = '💀 คุณตายแล้ว ฟื้นคืนชีพที่เมือง';
const DEATH_EXP_LOSS = 0.01;   // ตายแล้วเสีย EXP 1% ของ EXP ที่มีในเลเวลปัจจุบัน (PvP ไม่เสีย)

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

// ----- อยู่ในโหมด PvP ไหม (ตายใน PvP ไม่หัก EXP) -----
// เช็กชื่อตัวแปรที่พบบ่อย ถ้า pvp.js ใช้ชื่ออื่น ให้ตั้ง scene.inPvp = true ตอนเข้า PvP และ false ตอนออก
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

// ----- ชุบชีวิตหลังตาย: หัก EXP 1% (ยกเว้น PvP), ฟื้น HP/MP, ล้างมอน, เซฟ -----
function townRevive(m) {
  try {
    // 1) หัก EXP 1% (ปัดขึ้น ไม่ติดลบ ไม่ลดเลเวล) | PvP ไม่หัก
    let lost = 0;
    if (!townInPvp(m)) {
      const cur = m.stats.exp || 0;
      lost = Math.min(cur, Math.ceil(cur * DEATH_EXP_LOSS));
      m.stats.exp = cur - lost;
    }
    const base = window.TOWN_NOTICE || TOWN_DEAD_MSG;
    window.TOWN_NOTICE = base + (lost > 0 ? '\nเสีย EXP ' + lost + ' (1%)' : '\n(ไม่เสีย EXP)');

    // 2) หยุดบอท ล้างเป้าหมาย มอนเลิกไล่ ล้างกระสุนมอน
    m.autoMode = false; m.target = null; m.manualTarget = null;
    if (m.enemies) m.enemies.getChildren().forEach(function (e) { if (e.state === 'chase') e.state = 'return'; });
    if (m.enemyShots) m.enemyShots.getChildren().slice().forEach(function (s) { s.destroy(); });

    // 3) ฟื้น HP/MP + วางตัวละครที่จุดเกิดของด่านปัจจุบัน
    m.stats.hp = m.maxHp();
    m.stats.mp = m.maxMp();
    if (m.player && typeof ZONES !== 'undefined') {
      const z = ZONES[m.stageIdx] || ZONES[0];
      m.player.setPosition(z.x, z.y);
      if (m.player.body) m.player.body.setVelocity(0, 0);
    }

    // 4) เซฟทันที (กันปิดเกมแล้ว EXP กลับมา)
    if (typeof m.saveSoon === 'function') m.saveSoon();
    else if (typeof m.saveGame === 'function') m.saveGame();
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
  try { m.invulnUntil = m.time.now + 3000; } catch (e) {}   // อมตะ 3 วินาทีหลังออกจากเมือง
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

  // โหลดอะตลาสภาพเมือง (โหลดครั้งเดียว ครั้งต่อไปใช้ของเดิม)
  preload() {
    if (this.textures.exists('town')) return;
    this.load.on('loaderror', function (f) { console.warn('town asset missing:', f && f.src); });
    this.load.multiatlas('town', TOWN.atlas + 'town.json?v=' + TOWN.ver, TOWN.atlas);
  }

  create() {
    const T = TOWN;
    this.modal = null;
    this.target = null;
    this.pending = null;
    this.joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.heroDir = 'down';
    this.heroSkin = 'hero';
    this.blockers = [];
    this.slotUI = null;
    this.hasAtlas = this.textures.exists('town');

    const cam = this.cameras.main;
    cam.setBounds(0, 0, T.w, T.h);
    cam.setBackgroundColor('#1b241b');

    this.buildGround();
    this.buildLayout();

    this.add.text(T.w / 2, 56, '🏰 เมืองเริ่มต้น', {
      fontFamily: 'Mitr, sans-serif', fontSize: '34px', color: '#ffe28a', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(99999);

    // ----- ผู้เล่น (ต้องรู้ความสูงตัวละครก่อนสร้าง NPC เพื่อให้สเกลสัมพันธ์กัน) -----
    const mm = townMain(this);
    const mp = mm && mm.player;
    this.npcH = Phaser.Math.Clamp((mp && mp.displayHeight) ? mp.displayHeight * 1.15 : 96, 80, 150);

    this.npcs = TOWN_NPCS.map(function (n) { return this.makeNpc(n); }, this);

    this.player = this.add.container(T.spawnX, T.spawnY).setDepth(T.spawnY);
    const parts = [];
    const sh = this.add.graphics();
    sh.fillStyle(0x000000, 0.35).fillEllipse(0, 22, 34, 12);
    parts.push(sh);
    // ตัวละครจริง (sprite ตามสกินของคลาส + อนิเมชันเดียวกับข้างนอก)
    let labelY = -34;
    this.hero = null;
    if (this.textures.exists('hero')) {
      try { HeroAnims.create(this); } catch (e) {}   // กันกรณีอนิเมชันยังไม่ถูกสร้าง
      let skin = 'hero';
      try { skin = HeroAnims.skinOf(mm.currentClass()); } catch (e) {}
      if (!this.textures.exists(skin)) skin = 'hero';
      this.heroSkin = skin;
      const hero = this.add.sprite(0, 0, skin, 18);
      hero.heroSkin = skin;
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

    this.add.text(W / 2, H - 8, 'ลากนิ้วฝั่งซ้ายเพื่อเดิน • แตะ NPC เพื่อคุย • แตะช่องสกิลมุมขวาล่างเพื่อจัดสกิล (กดค้างเพื่อถอด)', {
      fontFamily: 'Mitr, sans-serif', fontSize: '14px', color: '#fff', backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(100000);


    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.wasd = kb.addKeys('W,A,S,D');
    }

    this.events.once('shutdown', this.cleanup, this);

    // แถบปุ่มด้านบน + ช่องสกิล + จอยสติ๊ก (ปุ่มของ Main ถูกฉากเมืองบัง จึงสร้างชุดใหม่ในเมือง)
    try { this.buildTownHud(); } catch (e) { console.warn('town hud failed', e); }

    if (window.TOWN_NOTICE) {
      this.dialog('🏰 เมือง', window.TOWN_NOTICE, [{ label: 'ตกลง', primary: true }]);
      window.TOWN_NOTICE = null;
    }
  }

  // ----- พื้นหญ้า + ถนนหิน: วาดด้วยโค้ด ต่อกันได้เนียน ไม่ต้องใช้ไฟล์ -----
  makeGroundTextures() {
    if (this.textures.exists('town_grass')) return;
    const S = 128;
    let seed = 11;
    const rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const wrapRect = function (c, x, y, w, h) {   // วาดซ้ำฝั่งตรงข้าม ให้ขอบต่อกันพอดี
      for (const ox of [0, -S]) for (const oy of [0, -S]) c.fillRect(x + ox, y + oy, w, h);
    };

    // หญ้า
    const gt = this.textures.createCanvas('town_grass', S, S);
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

    // ถนนหินกลม
    const ct = this.textures.createCanvas('town_cobble', S, S);
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
        cc.fillStyle = 'rgba(255,255,255,.18)'; cc.fillRect(x + 3, y + 1, w - 7, 2);       // ไฮไลต์ด้านบน
        cc.fillStyle = 'rgba(0,0,0,.18)';       cc.fillRect(x + 3, y + h - 2, w - 6, 2);  // เงาด้านล่าง
      }
    }
    for (let i = 0; i < 30; i++) {
      cc.fillStyle = (i % 2) ? 'rgba(70,110,60,.55)' : 'rgba(0,0,0,.18)';
      cc.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), 2, 2);
    }
    ct.refresh();
  }

  buildGround() {
    const T = TOWN;
    this.makeGroundTextures();
    this.add.tileSprite(0, 0, T.w, T.h, 'town_grass').setOrigin(0).setDepth(0);
    const edge = this.add.graphics().setDepth(1.5);
    TOWN_ROADS.forEach(function (r) {
      this.add.tileSprite(r.x, r.y, r.w, r.h, 'town_cobble').setOrigin(0).setDepth(1);
      edge.lineStyle(5, 0x3a342b, 0.95).strokeRect(r.x, r.y, r.w, r.h);
      edge.lineStyle(2, 0x6f9a55, 0.8).strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
    }, this);
  }

  // ----- วางอาคาร/พรอพ + สร้างกล่องกั้นการเดิน -----
  buildLayout() {
    if (!this.hasAtlas) return;   // ไม่มีไฟล์ภาพ: เหลือแค่พื้น + NPC สำรอง
    const self = this;
    const has = function (k) { return !!self.textures.getFrame('town', k); };

    TOWN_BUILDINGS.forEach(function (b) {
      if (!has(b.k)) return;
      const s = self.add.image(b.x, b.y, 'town', b.k).setOrigin(0.5, 1);
      const w = s.displayWidth, h = s.displayHeight, left = b.x - w / 2, top = b.y - h;
      s.setDepth(b.y - h * (1 - b.foot));
      b.block.forEach(function (f) {
        self.blockers.push({ x0: left + f[0] * w, y0: top + f[1] * h, x1: left + f[2] * w, y1: top + f[3] * h });
      });
    });

    TOWN_PROPS.forEach(function (p) {
      if (!has(p.k)) return;
      const s = self.add.image(p.x, p.y, 'town', p.k).setOrigin(0.5, 1).setDepth(p.bw === undefined ? p.y - 1 : p.y);
      if (p.flip) s.setFlipX(true);
      if (p.bw) {
        self.blockers.push({ x0: p.x - p.bw / 2, y0: p.y - (p.bh || 24), x1: p.x + p.bw / 2, y1: p.y });
      }
    });
  }

  // จุดเท้า (x,y) ชนกล่องกั้นไหม
  isBlocked(x, y) {
    const bs = this.blockers;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (x > b.x0 - 6 && x < b.x1 + 6 && y > b.y0 && y < b.y1) return true;
    }
    return false;
  }

  // ----- แถบปุ่มด้านบน + ช่องสกิลมุมขวาล่าง + จอยสติ๊ก (เรียกฟังก์ชันเดิมของ Main) -----
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

    // ช่องสกิลมุมขวาล่าง (หน้าตา/ตำแหน่งเดียวกับข้างนอก) ใช้จัดสกิลในเมือง
    try { this.buildSkillSlots(); } catch (e) { console.warn('town skill slots failed', e); }

    this.setupJoystick();
  }

  // ----- ช่องสกิลในเมือง: โจมตี + สกิล 4 ช่อง + อัลติ + แดช เรียงโค้ดเหมือน ROV ใน hudLayout.js -----
  // แตะช่องสกิล = เปิดหน้าสกิลของ Main เพื่อเลือกสกิลช่องนั้น | กดค้าง 0.5 วิ = ถอดสกิล
  // ปุ่มโจมตี/แดช/อัลติ = แสดงผลอย่างเดียว (ใช้ในเมืองไม่ได้)
  buildSkillSlots() {
    const self = this;
    // ใช้ค่าจาก ROV (hudLayout.js) ถ้ามี ไม่มีใช้ค่าเริ่มต้นเดียวกัน
    const R = (typeof ROV !== 'undefined') ? ROV
      : { ax: W - 150, ay: H - 120, attackR: 62, skillR: 38, ultiR: 38, ring: 185, startDeg: 170, stepDeg: 30 };
    const pos = function (i) {
      const a = Phaser.Math.DegToRad(R.startDeg + i * R.stepDeg);
      return { x: R.ax + R.ring * Math.cos(a), y: R.ay + R.ring * Math.sin(a) };
    };
    const D = 100010;
    const nameStyle = { fontFamily: 'Mitr, sans-serif', fontSize: '10px', color: '#fff', align: 'center', stroke: '#000', strokeThickness: 3 };

    // แถบโค้งจาง ๆ รองใต้ปุ่ม
    const deco = this.add.graphics().setScrollFactor(0).setDepth(D - 1);
    deco.lineStyle(92, 0xffffff, 0.07);
    deco.beginPath();
    deco.arc(R.ax, R.ay, R.ring, Phaser.Math.DegToRad(155), Phaser.Math.DegToRad(305), false);
    deco.strokePath();

    // ปุ่มโจมตี (แสดงผล)
    const atk = this.add.circle(R.ax, R.ay, R.attackR, 0xcf3d3d, 0.55).setScrollFactor(0).setDepth(D).setInteractive();
    atk.setStrokeStyle(5, 0xffffff, 0.6);
    this.add.circle(R.ax, R.ay, R.attackR - 9).setStrokeStyle(2, 0xffffff, 0.3).setScrollFactor(0).setDepth(D);
    const atkIcon = this.add.image(R.ax, R.ay - 8, 'atk_sword').setScrollFactor(0).setDepth(D + 1).setAlpha(0.6).setVisible(false);
    const atkText = this.add.text(R.ax, R.ay + R.attackR * 0.58, 'โจมตี', {
      fontFamily: 'Mitr, sans-serif', fontSize: '14px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2);
    atk.on('pointerdown', function () {
      if (self.modal) return;
      self.flash('ในเมืองโจมตีไม่ได้ • แตะช่องสกิลเพื่อจัดสกิล');
    });
    this.atkUI = { icon: atkIcon };

    // สกิล 4 ช่อง
    this.slotUI = [];
    for (let i = 0; i < 4; i++) {
      const p = pos(i);
      const c = this.add.circle(p.x, p.y, R.skillR, 0x3a3a3a, 0.8).setScrollFactor(0).setDepth(D).setInteractive();
      c.setStrokeStyle(4, 0xffffff, 0.75);
      const icon = this.add.image(p.x, p.y - 6, 'ic_melee').setDisplaySize(46, 46).setScrollFactor(0).setDepth(D + 1).setVisible(false);
      const plus = this.add.text(p.x, p.y, '+', {
        fontFamily: 'Mitr, sans-serif', fontSize: '34px', color: '#ffe28a', fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2);
      const name = this.add.text(p.x, p.y + 27, '', nameStyle).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2).setVisible(false);
      this.slotUI.push({ c: c, icon: icon, plus: plus, name: name });

      let heldTimer = null, longPressed = false;
      const idx = i;
      const cancelHold = function () { if (heldTimer) { heldTimer.remove(false); heldTimer = null; } };
      c.on('pointerdown', function () {
        if (self.modal) return;
        const m = townMain(self);
        if (!m || m.panel) return;
        longPressed = false;
        cancelHold();
        // ช่องที่มีสกิลอยู่: กดค้างเพื่อถอด | ช่องว่าง: ไม่มีอะไรให้ถอด
        if (m.slots && m.slots[idx]) {
          heldTimer = self.time.delayedCall(500, function () {
            heldTimer = null;
            longPressed = true;
            const mm = townMain(self);
            if (!mm || !mm.slots) return;
            mm.slots[idx] = null;
            try { if (mm.computeCombo) mm.computeCombo(); } catch (e) {}
            try {
              if (typeof mm.saveSoon === 'function') mm.saveSoon();
              else if (typeof mm.saveGame === 'function') mm.saveGame();
            } catch (e) {}
            self.flash('ถอดสกิลช่อง ' + (idx + 1));
            self.refreshSkillSlots();
          });
        }
      });
      c.on('pointerup', function () {
        cancelHold();
        if (longPressed) { longPressed = false; return; }
        if (self.modal) return;
        const m = townMain(self);
        if (!m || m.panel) return;
        if (m.openSkillBook) m.openSkillBook(idx);
      });
      c.on('pointerout', cancelHold);
      c.on('pointerupoutside', cancelHold);
    }

    // อัลติ (ปลายโค้ด)
    const up = pos(4);
    const uRing = this.add.circle(up.x, up.y, R.ultiR).setStrokeStyle(3, 0xffffff, 0.22).setScrollFactor(0).setDepth(D - 1);
    const uC = this.add.circle(up.x, up.y, R.ultiR, 0xd4af37, 0.6).setScrollFactor(0).setDepth(D).setInteractive().setVisible(false);
    uC.setStrokeStyle(5, 0xfff3c4, 0.95);
    const uIcon = this.add.image(up.x, up.y - 4, 'ic_aoe').setScrollFactor(0).setDepth(D + 1).setVisible(false);
    const uText = this.add.text(up.x, up.y, 'ULTI', {
      fontFamily: 'Mitr, sans-serif', fontSize: '12px', color: '#3a2a00', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2).setVisible(false);
    uC.on('pointerdown', function () {
      if (self.modal) return;
      self.flash('อัลติใช้ในเมืองไม่ได้ • ใส่สกิลคลาสเดียวกัน 3 ช่องเพื่อปลดล็อก');
    });
    this.ultiUI = { ring: uRing, c: uC, icon: uIcon, text: uText, x: up.x, y: up.y };

    // แดช (ใช้ตำแหน่ง/ขนาดจากปุ่มแดชของ Main ถ้ามี)
    const m0 = townMain(this);
    const db = m0 && m0.dashBtn && m0.dashBtn.c;
    if (db) {
      const dr = db.radius || 28;
      const dC = this.add.circle(db.x, db.y, dr, 0x2f6fcf, 0.55).setScrollFactor(0).setDepth(D).setInteractive();
      dC.setStrokeStyle(3, 0xffffff, 0.6);
      const dk = this.textures.exists('sk_dash') ? 'sk_dash' : 'gen_dash';
      if (this.textures.exists(dk)) this.add.image(db.x, db.y - 6, dk).setDisplaySize(38, 38).setScrollFactor(0).setDepth(D + 1).setAlpha(0.6);
      this.add.text(db.x, db.y + dr * 0.55, 'แดช', {
        fontFamily: 'Mitr, sans-serif', fontSize: '11px', color: '#fff', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2);
      dC.on('pointerdown', function () {
        if (self.modal) return;
        self.flash('ในเมืองแดชไม่ได้');
      });
    }

    this.refreshSkillSlots();
  }

  // อัปเดตรูป/ชื่อสกิลในช่อง ให้ตรงกับสกิลที่ติดตั้งอยู่ใน Main (เรียกทุกเฟรม)
  refreshSkillSlots() {
    const m = townMain(this);
    if (!m || !this.slotUI) return;
    const slots = m.slots || [];
    const hasDefs = (typeof SKILL_DEFS !== 'undefined');

    this.slotUI.forEach(function (u, i) {
      const sid = slots[i];
      const def = (sid && hasDefs) ? SKILL_DEFS[sid] : null;
      if (def) {
        const key = 'sk_' + sid;
        if (this.textures.exists(key)) {
          u.icon.setTexture(key).setDisplaySize(46, 46).setPosition(u.c.x, u.c.y - 6).setVisible(true);
        } else {
          u.icon.setVisible(false);
        }
        u.name.setText(def.name || '').setVisible(true);
        u.plus.setVisible(false);
      } else {
        u.icon.setVisible(false);
        u.name.setVisible(false);
        u.plus.setVisible(true);
      }
    }, this);

    // ปุ่มโจมตี: รูปตามอาชีพที่ถืออยู่
    if (this.atkUI && this.atkUI.icon) {
      let cls = null;
      try { cls = m.currentClass(); } catch (e) {}
      const k = (cls && this.textures.exists('sk_basic_' + cls)) ? 'sk_basic_' + cls
        : ((cls && this.textures.exists('atk_' + cls)) ? 'atk_' + cls
          : (this.textures.exists('atk_sword') ? 'atk_sword' : null));
      if (k) {
        const R = (typeof ROV !== 'undefined') ? ROV : { ax: W - 150, ay: H - 120 };
        this.atkUI.icon.setTexture(k).setDisplaySize(58, 58).setPosition(R.ax, R.ay - 8).setVisible(true);
      }
    }

    // อัลติ: โชว์เมื่อใส่สกิลคลาสเดียวกันครบ 3 ช่อง (m.ultiClass)
    const u = this.ultiUI;
    if (u) {
      const cls = m.ultiClass;
      u.c.setVisible(!!cls);
      u.ring.setVisible(!cls);
      if (cls) {
        const key = 'sk_ulti_' + cls;
        if (this.textures.exists(key)) {
          u.icon.setTexture(key).setDisplaySize(54, 54).setPosition(u.x, u.y - 4).setVisible(true);
          u.text.setVisible(false);
        } else {
          u.icon.setVisible(false);
          u.text.setVisible(true);
        }
      } else {
        u.icon.setVisible(false);
        u.text.setVisible(false);
      }
    }
  }

  // ----- จอยสติ๊กลอยแบบเดียวกับข้างนอก: แตะฝั่งซ้าย 40% ของจอแล้วลาก -----
  setupJoystick() {
    const self = this, J = this.joy;
    this.input.addPointer(2);
    this.joyBase = this.add.circle(0, 0, 50, 0xffffff, 0.15).setScrollFactor(0).setDepth(100020).setVisible(false);
    this.joyKnob = this.add.circle(0, 0, 22, 0xffffff, 0.4).setScrollFactor(0).setDepth(100021).setVisible(false);
    this.input.on('pointerdown', function (p, over) {
      if (self.modal) return;
      const m = townMain(self);
      if (m && m.panel) return;            // เปิดหน้าสกิล/กระเป๋าอยู่: ไม่สร้างจอยสติ๊ก
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

  // ----- สถานะตัวละคร (DOM) — อ่านสเตตัสครบจาก STAT_DEFS (stats.js) เหมือนหน้าสเตตัสจริง -----
  openTownStatus() {
    const m = townMain(this);
    if (!m || !m.stats) return;
    const card = this.domCard('สถานะตัวละคร');
    let cls = '-';
    try { cls = CLASSES[m.currentClass()].label; } catch (e) {}
    const S = (m.getStats && m.getStats()) || null;
    const rows = [
      ['เลเวล', m.stats.level + ' / ' + LEVEL_CAP],
      ['EXP', Math.floor(m.stats.exp) + ' / ' + m.stats.expNext],
      ['HP', Math.max(0, Math.floor(m.stats.hp)) + ' / ' + m.maxHp()],
      ['MP', Math.floor(m.stats.mp) + ' / ' + m.maxMp()],
    ];
    if (S && window.STAT_DEFS) {
      Object.keys(STAT_DEFS).forEach(function (k) {
        if (k === 'hp' || k === 'mp') return;                  // แสดงอยู่แถวบนแล้ว
        if (STAT_DEFS[k].hideZero && !S[k]) return;            // ซ่อนค่าที่เป็น 0 (เหมือนหน้าสเตตัสจริง)
        rows.push([STAT_DEFS[k].label, window.fmtStat ? fmtStat(k, S[k]) : String(Math.round(S[k] || 0))]);
      });
    } else {
      rows.push(['ATK', String(m.atk)]);                       // สำรอง ถ้า stats.js ไม่ทำงาน
    }
    rows.push(['ทอง', String(m.stats.gold)], ['มอนที่ฆ่าแล้ว', String(m.kills)], ['อาชีพ', cls]);
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

  // ----- NPC: ใช้สไปรต์จากอะตลาส (ไม่มีภาพ = กล่องสีเดิม) | n.x,n.y = จุดเท้า -----
  // v7.2: มีปุ่ม "💬 คุย" ลอยเหนือหัว NPC + พื้นที่กดใหญ่ (ใช้ Zone เพราะกดติดง่ายกว่า Container)
  //       กดตอนอยู่ไกล = ตัวละครเดินไปหา NPC แล้วเปิดบทสนทนาให้เอง
  makeNpc(n) {
    const c = this.add.container(n.x, n.y).setDepth(n.y);
    const g = this.add.graphics();
    const textStyle = { fontFamily: 'Mitr, sans-serif', fontSize: '16px', color: '#ffe28a', stroke: '#000', strokeThickness: 4 };
    const titleStyle = { fontFamily: 'Mitr, sans-serif', fontSize: '13px', color: '#fff', backgroundColor: '#000000aa', padding: { x: 6, y: 2 } };
    let box;      // กรอบกดตัว NPC: ศูนย์กลางเทียบจุดเท้า (cx, cy) + ขนาด (w, h)
    let nameY;    // ตำแหน่งชื่อ NPC (เทียบจุดเท้า) ใช้วางปุ่มไว้เหนือชื่อ

    if (this.hasAtlas && this.textures.getFrame('town', n.sprite)) {
      g.fillStyle(0x000000, 0.35).fillEllipse(0, 2, 62, 16);
      const spr = this.add.image(0, 8, 'town', n.sprite).setOrigin(0.5, 1);
      const k = this.npcH / spr.height;
      spr.setScale(k);
      const w = spr.displayWidth, h = spr.displayHeight;
      // หายใจเบา ๆ ให้ดูมีชีวิต (ยืดจากเท้า)
      this.tweens.add({
        targets: spr, scaleY: k * 1.018, yoyo: true, repeat: -1,
        duration: 950 + Math.floor(Math.random() * 400), ease: 'Sine.easeInOut',
      });
      nameY = 8 - h - 14;
      const name = this.add.text(0, nameY, n.name, textStyle).setOrigin(0.5);
      const title = this.add.text(0, 26, n.title, titleStyle).setOrigin(0.5);
      c.add([g, spr, name, title]);
      box = { cx: 0, cy: 8 - h / 2, w: Math.max(w + 40, 130), h: h + 60 };
    } else {
      g.fillStyle(0x000000, 0.35).fillEllipse(0, 30, 54, 16);
      g.fillStyle(n.color, 1).fillRoundedRect(-28, -28, 56, 56, 14);
      g.lineStyle(4, 0xffffff, 1).strokeRoundedRect(-28, -28, 56, 56, 14);
      const icon = this.add.text(0, 0, n.icon, { fontSize: '32px' }).setOrigin(0.5);
      nameY = -52;
      const name = this.add.text(0, nameY, n.name, textStyle).setOrigin(0.5);
      const title = this.add.text(0, 46, n.title, titleStyle).setOrigin(0.5);
      c.add([g, icon, name, title]);
      box = { cx: 0, cy: 0, w: 130, h: 140 };
    }

    // ----- ปุ่ม "💬 คุย" ลอยเหนือชื่อ (เด้งขึ้นลงเบา ๆ ให้เห็นชัด) -----
    const BW = 112, BH = 42, btnY = nameY - 42;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.35).fillRoundedRect(-BW / 2 + 2, -BH / 2 + 4, BW, BH, 14);   // เงา
    bg.fillStyle(0xffd45c, 1).fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 14);
    bg.lineStyle(3, 0x26090f, 1).strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 14);
    const bt = this.add.text(0, 0, '💬 คุย', {
      fontFamily: 'Mitr, sans-serif', fontSize: '22px', color: '#26090f', fontStyle: 'bold',
    }).setOrigin(0.5);
    const btn = this.add.container(0, btnY, [bg, bt]);
    c.add(btn);
    this.tweens.add({ targets: btn, y: btnY - 6, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });

    // ----- พื้นที่กด (Zone ในพิกัดโลก) : ตัว NPC + ปุ่ม (ปุ่มกดได้กว้างกว่าที่เห็น) -----
    // depth 50000 = อยู่เหนือของในเมือง แต่ต่ำกว่าปุ่มแถบบน (100010+) จึงไม่บังปุ่ม HUD
    const onTap = function () { this.approachNpc(n); };
    const zBody = this.add.zone(n.x + box.cx, n.y + box.cy, box.w, box.h).setDepth(50000).setInteractive({ useHandCursor: true });
    zBody.on('pointerdown', onTap, this);
    const zBtn = this.add.zone(n.x, n.y + btnY, BW + 50, BH + 36).setDepth(50001).setInteractive({ useHandCursor: true });
    zBtn.on('pointerdown', onTap, this);
    return c;
  }

  // กด NPC/ปุ่มคุย: ใกล้พอ = คุยเลย | ไกล = เดินไปหาแล้วคุยให้อัตโนมัติ (update() เช็กระยะ 110)
  approachNpc(n) {
    if (this.modal) return;
    const m = townMain(this);
    if (m && m.panel) return;
    const p = this.player;
    if (Math.hypot(n.x - p.x, n.y - (p.y + 20)) < 150) {
      this.target = null; this.pending = null;
      this.talk(n);
      return;
    }
    this.pending = n;
    this.target = { x: n.x, y: n.y - 20 };   // p.y = จุดเท้า - 20
    this.flash('กำลังเดินไปหา ' + n.name);
  }

  update(time, delta) {
    // อัปเดตช่องสกิลทุกเฟรม (เปลี่ยนสกิลในหน้าสกิลแล้วเห็นผลทันที)
    this.refreshSkillSlots();

    if (this.modal) return;
    const mn = townMain(this);
    if (mn && mn.panel) return;   // เปิดหน้าสกิล/กระเป๋าอยู่: หยุดเดิน

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
      const FEET = 20;   // จุดเท้าอยู่ต่ำกว่ากึ่งกลางตัวละคร
      const nx = Phaser.Math.Clamp(p.x + vx * T.speed * dt, 20, T.w - 20);
      const ny = Phaser.Math.Clamp(p.y + vy * T.speed * dt, 20, T.h - 24);
      const stuck = this.isBlocked(p.x, p.y + FEET);          // เผื่อเกิดทับกล่องกั้น: ให้เดินออกได้อิสระ
      if (stuck || !this.isBlocked(nx, p.y + FEET)) p.x = nx;
      if (stuck || !this.isBlocked(p.x, ny + FEET)) p.y = ny;  // แยกแกน = ไถลไปตามขอบอาคารได้
      p.setDepth(p.y + FEET);
    }

    // อนิเมชันเดิน/ยืน (HeroAnims จาก heroAnims.js) — ส่งสกินตามคลาสเข้าไปด้วย
    if (this.hero && window.HeroAnims) {
      const moving = !!(vx || vy);
      if (moving) {
        this.heroDir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
      }
      try { HeroAnims.play(this.hero, moving ? 'walk' : 'idle', this.heroDir, this.heroSkin); } catch (e) {}
    }

    if (this.pending) {
      const n = this.pending;
      if (Math.hypot(n.x - p.x, n.y - (p.y + 20)) < 110) {
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
    t.style.cssText = 'font-size:15px;line-height:1.5;margin-bottom:14px;white-space:pre-line';
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
    this.slotUI = null;
    this.atkUI = null;
    this.ultiUI = null;
  }
}
