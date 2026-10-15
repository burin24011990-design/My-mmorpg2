// ===== แถบเมนูด้านบน (ไอคอนวาดเอง) =====
// ปรับขนาดปุ่มที่นี่: w = กว้าง, h = สูง, gap = ระยะห่าง, top = ระยะจากขอบบน
// bigW / bigH = ขนาดปุ่ม "เลือกด่าน" (แนวนอนอยู่กลางจอ | แนวตั้งอยู่ในตารางปุ่ม)
const TB = { w: 62, h: 58, gap: 6, top: 8, bigW: 88, bigH: 76 };

// ===== ตัวหนังสือบนปุ่ม (ปรับตรงนี้) =====
// ขนาดตัวอักษร (px) แยกตามชนิดปุ่ม | สีทอง + ขอบน้ำตาลเข้ม มองชัดทุกพื้นหลัง | ปุ่ม "บอท" เปลี่ยนสีตามสถานะ (เปิด = เขียว, ปิด = ส้มอ่อน)
// ข้อความยาวเกินปุ่มจะถูกย่อให้พอดีอัตโนมัติ
const TB_LABEL = {
  sizeCompact: 12, sizeNormal: 14, sizeBig: 18,
  color: '#ffe28a', colorBig: '#fff0b0', colorOn: '#9dff9d', colorOff: '#ffb59a',
  stroke: '#2a1204',
};
// ตัวหนังสือบนปุ่ม DOM (เมือง / CH / สังคม / เสียง / จุติ ฯลฯ ที่ใช้คลาส .hb-t) ขยายตัวอักษร (เท่า) | 1 = ไม่ขยาย
const TB_DOM_LABEL_SCALE = 1.3;

// ===== แนวตั้ง: ปุ่มทุกอัน (ทั้งปุ่มในแคนวาสและปุ่ม DOM เมือง/CH/สังคม/เสียง/จุติ) จัดเป็นตารางเดียวกัน 7 คอลัมน์ x 2 แถว (ยกเว้นปุ่มเลือกด่าน) =====
// อยู่ขวาของกรอบ HP/MP (ซ้ายบน) ไม่ทับกัน | ไฟล์ town.js / social.js / music.js / portraitTop.js ดึงตำแหน่งจากที่นี่
// ปรับขนาด/ระยะ: w, h, gap, top (ระยะจากขอบบน), right (ระยะจากขอบขวา)
// ถ้ากรอบ HP/MP ทางซ้ายยังทับ ให้ลด w ลงเล็กน้อย (เช่น 43) แนวนอนไม่ได้ใช้ค่าชุดนี้
const TBP = { w: 45, h: 46, gap: 3, top: 4, right: 4, cols: 7 };
const TBP_ROWS = [
  ['bagBtn', 'bookBtn', 'autoBtn', 'botCfgBtn', 'equipBtn', 'statusBtn', 'shopBtn'],
  ['fsBtn', 'cashBtn', 'townBtn', 'chBtn', 'socialBtn', 'soundBtn', 'rebirthBtn'],   // fsBtn = ปุ่มขยายเต็มจอ (fullscreenBtn.js)
];
// ปุ่ม "เลือกด่าน" แยกออกมา ใหญ่กว่าปุ่มอื่น วางชิดมินิแมป (ขวาของกรอบมินิแมป) | ขยับได้ที่ x, y | ขนาด w, h
const TBP_STAGE = { x: 214, y: 108, w: 72, h: 62 };
const tbIsPortrait = () =>
  (typeof PORTRAIT !== 'undefined' && !!PORTRAIT) ||
  (typeof W !== 'undefined' && typeof H !== 'undefined' && W < H);
// ตำแหน่งช่อง (หน่วยพิกัดเกม) ของปุ่มแนวตั้ง | คืน null ถ้าไม่ใช่แนวตั้งหรือไม่มีปุ่มนี้
window.PortraitTop = {
  is: tbIsPortrait,
  slot: function (key) {
    if (!tbIsPortrait()) return null;
    if (key === 'stageBtn') return { x: TBP_STAGE.x, y: TBP_STAGE.y, w: TBP_STAGE.w, h: TBP_STAGE.h };
    const x0 = W - TBP.right - (TBP.cols * TBP.w + (TBP.cols - 1) * TBP.gap);
    for (let r = 0; r < TBP_ROWS.length; r++) {
      const c = TBP_ROWS[r].indexOf(key);
      if (c >= 0) return { x: x0 + c * (TBP.w + TBP.gap), y: TBP.top + r * (TBP.h + TBP.gap), w: TBP.w, h: TBP.h };
    }
    return null;
  },
};

Main.prototype.makeTopIcons = function () {
  if (this.textures.exists('tb_bag')) return;
  const g = this.make.graphics({ x: 0, y: 0, add: false });
  const mk = (key, fn) => { g.clear(); fn(g); g.generateTexture(key, 40, 40); };

  mk('tb_bag', g => {
    g.lineStyle(3, 0x6b4423); g.beginPath(); g.arc(20, 12, 7, Math.PI, 0, false); g.strokePath();
    g.fillStyle(0xb5763a); g.fillRoundedRect(7, 12, 26, 24, 6);
    g.fillStyle(0x8f5a28); g.fillRoundedRect(7, 12, 26, 10, 5);
    g.fillStyle(0xf2c94c); g.fillRect(17, 19, 6, 7);
    g.lineStyle(2, 0x4a2c12); g.strokeRoundedRect(7, 12, 26, 24, 6);
  });
  mk('tb_scroll', g => {
    g.fillStyle(0xf3e2b3); g.fillRect(9, 8, 22, 24);
    g.fillStyle(0xd9b36a); g.fillRoundedRect(6, 5, 28, 6, 3); g.fillRoundedRect(6, 29, 28, 6, 3);
    g.fillStyle(0x8a6a32); [14, 19, 24].forEach(y => g.fillRect(12, y, 16, 2));
  });
  mk('tb_bot', g => {
    g.fillStyle(0x8fb4d9); g.fillRoundedRect(8, 12, 24, 20, 5);
    g.fillRect(5, 18, 3, 8); g.fillRect(32, 18, 3, 8); g.fillRect(19, 6, 2, 6);
    g.fillStyle(0xe04040); g.fillCircle(20, 5, 3);
    g.fillStyle(0x1a2a3a); g.fillCircle(15, 21, 3.5); g.fillCircle(25, 21, 3.5); g.fillRect(14, 27, 12, 2);
  });
  mk('tb_shield', g => {
    g.fillStyle(0x5a7fc4); g.beginPath();
    g.moveTo(20, 4); g.lineTo(34, 9); g.lineTo(33, 22); g.lineTo(20, 36); g.lineTo(7, 22); g.lineTo(6, 9);
    g.closePath(); g.fillPath();
    g.fillStyle(0x8fb0ea); g.beginPath();
    g.moveTo(20, 8); g.lineTo(20, 31); g.lineTo(10, 21); g.lineTo(10, 12); g.closePath(); g.fillPath();
    g.lineStyle(2, 0x1d2f5a); g.strokePath();
  });
  mk('tb_map', g => {
    g.fillStyle(0x9bd6b0); g.fillRect(6, 10, 9, 22); g.fillRect(25, 10, 9, 22);
    g.fillStyle(0x6fb88e); g.fillRect(15, 8, 10, 22);
    g.lineStyle(3, 0xe04040); g.lineBetween(17, 15, 23, 22); g.lineBetween(23, 15, 17, 22);
  });
  mk('tb_chart', g => {
    g.fillStyle(0x5ec26a); g.fillRect(8, 22, 6, 12);
    g.fillStyle(0xf2c94c); g.fillRect(17, 14, 6, 20);
    g.fillStyle(0xe06060); g.fillRect(26, 7, 6, 27);
    g.fillStyle(0xcccccc); g.fillRect(6, 34, 28, 2);
  });
  mk('tb_gear', g => {
    g.fillStyle(0xb8c0cc);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      g.fillCircle(20 + Math.cos(a) * 13, 20 + Math.sin(a) * 13, 4);
    }
    g.fillCircle(20, 20, 12);
    g.fillStyle(0x3a2a3a); g.fillCircle(20, 20, 5);
    g.lineStyle(2, 0x5a6270); g.strokeCircle(20, 20, 12);
  });
  // ไอคอนร้านแคช: เพชรสีฟ้า
  mk('tb_cash', g => {
    g.fillStyle(0x3fb8ee); g.fillTriangle(5, 15, 20, 36, 35, 15);
    g.fillStyle(0x7fdcff); g.fillTriangle(5, 15, 13, 5, 20, 15); g.fillTriangle(20, 15, 27, 5, 35, 15);
    g.fillRect(13, 5, 14, 10);
    g.fillStyle(0xd8f6ff); g.fillTriangle(13, 5, 20, 15, 20, 5);
    g.lineStyle(2, 0x1d5f86); g.lineBetween(5, 15, 35, 15); g.lineBetween(13, 5, 27, 5);
    g.lineBetween(5, 15, 13, 5); g.lineBetween(35, 15, 27, 5);
    g.lineBetween(5, 15, 20, 36); g.lineBetween(35, 15, 20, 36);
  });
  g.destroy();
};

// ตำแหน่งช่องของแต่ละปุ่ม
// - แนวนอน: เลือกด่าน = กึ่งกลางจอด้านบน (ใหญ่กว่าปุ่มอื่น) | ปุ่มอื่นเรียง 2 แถว x 4 คอลัมน์ ชิดขวา
// - แนวตั้ง: ทุกปุ่มอยู่ในตารางเล็ก 7 คอลัมน์ x 2 แถว ชิดขวา (ดู TBP ด้านบน) ยกเว้น "เลือกด่าน" ที่แยกไปชิดมินิแมป (TBP_STAGE)
// (shopBtn / cashBtn เตรียมช่องไว้ให้ไฟล์ร้านค้า/ร้านแคชมาใช้)
Main.prototype.topSlot = function (key) {
  if (tbIsPortrait()) {
    const sp = window.PortraitTop.slot(key);
    return sp ? { x: sp.x, y: sp.y, w: sp.w, h: sp.h, big: key === 'stageBtn' } : null;
  }

  if (key === 'stageBtn') {
    return { x: Math.round(W / 2 - TB.bigW / 2), y: TB.top, w: TB.bigW, h: TB.bigH, big: true };
  }
  const rows = [
    ['bagBtn', 'bookBtn', 'autoBtn', 'botCfgBtn'],
    ['equipBtn', 'statusBtn', 'shopBtn', 'cashBtn'],
  ];
  const cols = 4;
  for (let r = 0; r < rows.length; r++) {
    const c = rows[r].indexOf(key);
    if (c >= 0) {
      const x0 = W - 12 - (cols * TB.w + (cols - 1) * TB.gap);
      return { x: x0 + c * (TB.w + TB.gap), y: TB.top + r * (TB.h + TB.gap), w: TB.w, h: TB.h, big: false };
    }
  }
  return null;
};

Main.prototype.makeTopBtn = function (x, y, w, h, iconKey, label, color, onClick, big) {
  const cx = x + w / 2, cy = y + h / 2;
  const compact = h < 52;   // ปุ่มเล็ก (แนวตั้ง): ย่อไอคอนกับตัวหนังสือ | แนวนอนไม่เข้าเงื่อนไขนี้
  const bg = this.add.graphics().setScrollFactor(0).setDepth(98);
  const draw = (down) => {
    bg.clear();
    bg.fillStyle(color, down ? 1 : 0.92); bg.fillRoundedRect(x, y, w, h, 9);
    bg.fillStyle(0xffffff, down ? 0.05 : 0.14); bg.fillRoundedRect(x + 2, y + 2, w - 4, h * 0.4, 7);
    bg.lineStyle(big ? 3 : 2, down ? 0xffe28a : (big ? 0xffd45c : 0x8a6a32), 1); bg.strokeRoundedRect(x, y, w, h, 9);
  };
  draw(false);
  const c = this.add.rectangle(cx, cy, w, h, color, 0.01).setScrollFactor(0).setDepth(99).setInteractive();
  const isz = compact ? Math.round(h * 0.5) : (big ? 48 : 34);
  const icon = this.add.image(cx, cy - (compact ? Math.round(h * 0.17) : (big ? 12 : 9)), iconKey).setDisplaySize(isz, isz).setScrollFactor(0).setDepth(101);

  // ตัวหนังสือบนปุ่ม: ใหญ่ ชัด สีทอง ขอบเข้ม | ปุ่มบอทเปลี่ยนสีตามสถานะ (ดูจากคำว่า เปิด/ปิด)
  const isBot = /บอท/.test(label);
  const colorOf = (txt) => isBot ? (/เปิด/.test(txt) ? TB_LABEL.colorOn : TB_LABEL.colorOff) : (big ? TB_LABEL.colorBig : TB_LABEL.color);
  const fsz = compact ? TB_LABEL.sizeCompact : (big ? TB_LABEL.sizeBig : TB_LABEL.sizeNormal);
  const t = this.add.text(cx, y + h - (compact ? 9 : (big ? 14 : 12)), label, {
    fontFamily: 'Mitr, sans-serif', fontSize: fsz + 'px', fontStyle: 'bold',
    color: colorOf(label), stroke: TB_LABEL.stroke, strokeThickness: compact ? 3 : 4
  }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
  t.setShadow(0, 1, '#000000', 0, true, true);
  t.setResolution(2);
  t._tbOwn = true;   // ข้อความนี้จัดสไตล์เองแล้ว ให้ตัวสแกนด้านล่างข้ามไป
  const fitLabel = () => {   // ข้อความยาวเกินปุ่ม = ย่อให้พอดี
    t.setScale(1);
    const maxW = w - 4;
    if (t.width > maxW) t.setScale(maxW / t.width);
  };
  const baseSetText = t.setText.bind(t);
  t.setText = function (v) {   // ไฟล์อื่นเปลี่ยนข้อความปุ่มภายหลัง (เช่น บอท: เปิด/ปิด) ให้สีและขนาดตามไปด้วย
    baseSetText(v);
    t.setColor(colorOf(String(v)));
    fitLabel();
    return t;
  };
  fitLabel();

  c.on('pointerdown', () => { draw(true); onClick(); });
  c.on('pointerup', () => draw(false));
  c.on('pointerout', () => draw(false));
  return { c, t, bg, icon };
};

Main.prototype.setupTopBar = function () {
  this.makeTopIcons();
  const items = [
    ['tb_bag',    'กระเป๋า',    0x2a4a2a, () => this.openInventory('bag'),   'bagBtn'],
    ['tb_scroll', 'สกิล',       0x2a2a4a, () => this.openSkillBook(),        'bookBtn'],
    ['tb_bot',    'บอท: ปิด',   0x4a3a2a, () => this.toggleAuto(),           'autoBtn'],
    ['tb_gear',   'ตั้งค่าบอท', 0x4a3a4a, () => this.openBotPanel(),         'botCfgBtn'],
    ['tb_shield', 'อุปกรณ์',    0x2a2a5a, () => this.openInventory('equip'), 'equipBtn'],
    ['tb_map',    'เลือกด่าน',  0x2a4a5a, () => this.openStageSelect(),      'stageBtn'],
    ['tb_chart',  'สเตตัส',     0x3a2a4a, () => this.openStatusPanel(),      'statusBtn'],
  ];
  items.forEach(it => {
    const s = this.topSlot(it[4]);
    this[it[4]] = this.makeTopBtn(s.x, s.y, s.w, s.h, it[0], it[1], it[2], it[3], s.big);
  });
};

// ตัวหนังสือบนปุ่ม DOM (.hb-t จาก town.js และไฟล์ที่ใช้รูปแบบเดียวกัน): สีทอง ขอบเข้ม ขยายขึ้น
(function () {
  if (document.getElementById('tb-label-style')) return;
  const st = document.createElement('style');
  st.id = 'tb-label-style';
  const sh = '-1px 0 #2a1204,1px 0 #2a1204,0 -1px #2a1204,0 1px #2a1204,0 2px 3px #000';
  st.textContent = '.hb-t{color:#ffe28a !important;font-weight:600 !important;text-shadow:' + sh + ' !important;' +
    (TB_DOM_LABEL_SCALE !== 1 ? 'transform:scale(' + TB_DOM_LABEL_SCALE + ');transform-origin:50% 40%;' : '') + '}';
  document.head.appendChild(st);
})();

// ===== จัดสไตล์ตัวหนังสือปุ่มแถบบนที่ไฟล์อื่นวาดเอง (shop.js / hudLayout.js ฯลฯ) =====
// ปุ่มแถวบนในเกมจริงอาจไม่ได้สร้างจาก makeTopBtn ด้านบน จึงสแกนหาข้อความตามชื่อปุ่มแล้วปรับให้ใหญ่/สีทอง/ขอบเข้มเหมือนกัน
// รวมข้อความชื่อด่านใต้มินิแมปและข้อความสถานะออนไลน์ | ปรับขนาด/สีที่ TB_LABEL ด้านบน
(function () {
  const NAMES = ['กระเป๋า', 'สกิล', 'บอท: ปิด', 'บอท: เปิด', 'บอท', 'ตั้งค่าบอท', 'อุปกรณ์', 'สเตตัส', 'ร้านค้า', 'ร้านแคช', 'เลือกด่าน'];
  const FONT = 'Mitr, sans-serif';

  function labelStyle(o, size, color, stroke, maxW) {
    const sz = size + 'px';
    if (o._tbSz !== sz) {
      o.setFontFamily(FONT).setFontSize(sz).setFontStyle('bold').setStroke(TB_LABEL.stroke, stroke);
      o.setShadow(0, 1, '#000000', 0, true, true);
      if (o.setResolution) o.setResolution(2);
      o._tbSz = sz;
    }
    if (o._tbCol !== color) { o.setColor(color); o._tbCol = color; }
    if (maxW) {
      o.setScale(1);
      if (o.width > maxW) o.setScale(maxW / o.width);
    }
  }

  function styleAll(sc) {
    const list = sc.children && sc.children.list;
    if (!list) return;
    const portrait = tbIsPortrait();
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (!o || o.type !== 'Text' || !o.scene || o._tbOwn || o.scrollFactorX !== 0 || o.y > 300) continue;
      const txt = String(o.text || '').trim();
      if (NAMES.indexOf(txt) < 0) continue;
      const big = txt === 'เลือกด่าน';
      const isBot = txt.indexOf('บอท') === 0;
      const size = portrait ? (big ? TB_LABEL.sizeBig - 2 : TB_LABEL.sizeCompact) : (big ? TB_LABEL.sizeBig : TB_LABEL.sizeNormal);
      const maxW = portrait ? (big ? TBP_STAGE.w - 4 : TBP.w - 3) : (big ? TB.bigW - 4 : TB.w - 4);
      const color = isBot ? (/เปิด/.test(txt) ? TB_LABEL.colorOn : TB_LABEL.colorOff) : (big ? TB_LABEL.colorBig : TB_LABEL.color);
      labelStyle(o, size, color, portrait ? 3 : 4, maxW);
    }
    // ชื่อด่านใต้มินิแมป (เดิมเล็กและสีจาง)
    if (sc.stageText && sc.stageText.scene) labelStyle(sc.stageText, 15, '#d4ffbe', 4, 0);
    // ข้อความสถานะออนไลน์มุมล่างขวา
    if (sc.statusText && sc.statusText.scene) labelStyle(sc.statusText, 13, '#ffe9a0', 3, 0);
  }

  const P = Main.prototype;
  const oUpd = P.updateHud;
  let frame = 0;
  P.updateHud = function () {
    const r = typeof oUpd === 'function' ? oUpd.apply(this, arguments) : undefined;
    if ((frame++ % 20) === 0) { try { styleAll(this); } catch (e) { /* ไม่ให้ HUD ทำเกมค้าง */ } }
    return r;
  };
})();
