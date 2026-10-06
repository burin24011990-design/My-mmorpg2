// ===== ซ่อน HUD ตอนเปิดหน้าต่าง + ตกแต่งหน้าต่าง + ย่อหน้าต่างสถานะ/ไอคอนสกิล =====
(function () {
  // ---------- ปรับขนาดตรงนี้ ----------
  var STATUS_ZOOM = 0.5;   // หน้าต่างสถานะตัวละคร (1 = เดิม, ยิ่งน้อยยิ่งเล็ก)
  var SKILL_ICON = 80;     // ขนาดรูปสกิลในหน้าต่างสกิล (px)

  var CSS = [
    '.pot-hide{visibility:hidden !important;pointer-events:none !important}',
    '.pp-small{zoom:' + STATUS_ZOOM + ' !important}',
    '.sk-small img,.sk-small canvas{width:' + SKILL_ICON + 'px !important;height:' + SKILL_ICON + 'px !important;' +
      'max-width:' + SKILL_ICON + 'px !important;max-height:' + SKILL_ICON + 'px !important;object-fit:contain !important}',

    /* กรอบหน้าต่าง */
    '#ui-layer .win{font-family:"Mitr",sans-serif !important;color:#f6efdc;' +
      'background:linear-gradient(180deg,#1b2338 0%,#0d1220 100%) !important;' +
      'border:2px solid #d4af37 !important;border-radius:18px !important;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.75),inset 0 0 0 1px rgba(255,226,138,.18),inset 0 0 40px rgba(212,175,55,.06) !important;' +
      'text-shadow:0 1px 2px rgba(0,0,0,.7)}',
    '#ui-layer .win .win-title{color:#ffe28a !important;font-size:17px !important;letter-spacing:.5px}',

    /* ปุ่มทั่วไป */
    '#ui-layer .win button{font-family:"Mitr",sans-serif !important;border-radius:10px !important;' +
      'background:linear-gradient(180deg,#2a3654,#171f35) !important;border:1px solid #5b6d96 !important;' +
      'color:#f6efdc !important;box-shadow:0 2px 0 #0a0e18,inset 0 1px 0 rgba(255,255,255,.12) !important}',
    '#ui-layer .win button:active{transform:translateY(2px);box-shadow:none !important}',

    /* ช่องไอเทม (คืนสีขอบตามระดับ + มุมมน ไม่กลม) */
    '#ui-layer .win button.cell{border-radius:7px !important;border:2px solid #232b3c !important;' +
      'background:linear-gradient(160deg,#1c2535,#0d121b) !important;box-shadow:inset 0 0 6px rgba(0,0,0,.65) !important}',
    '#ui-layer .win button.cell.has{border-color:var(--c,#9a9a9a) !important;' +
      'box-shadow:inset 0 0 8px rgba(0,0,0,.65),0 0 5px var(--c,#000) !important}',
    '#ui-layer .win button.cell.sel{border-color:#ffe28a !important;box-shadow:0 0 0 2px #ffd45c,0 0 10px #ffd45c !important}',
    '#ui-layer .win button.cell.tick{box-shadow:0 0 0 2px #5ee08a !important}',
    '#ui-layer .win .grid.bag button.cell{border-width:1.5px !important;border-radius:6px !important}',

    /* แท็บ */
    '#ui-layer .win button.win-tab{border-radius:10px 10px 0 0 !important;background:#121722 !important;' +
      'border:1px solid #2a3142 !important;border-bottom:0 !important;color:#8d95a3 !important;box-shadow:none !important}',
    '#ui-layer .win button.win-tab.on{background:linear-gradient(180deg,#4a3a14,#2a2210) !important;' +
      'color:#ffe28a !important;border-color:#d4af37 !important}',

    /* ปุ่มปิด */
    '#ui-layer .win button.win-x{background:linear-gradient(180deg,#7a2a30,#4a1519) !important;' +
      'border:1px solid #d65a60 !important;color:#fff !important}',

    /* ปุ่มสีตามหน้าที่ */
    '#ui-layer .win button.btn.ok{background:linear-gradient(180deg,#3a9254,#215a33) !important;border-color:#5fc27c !important}',
    '#ui-layer .win button.btn.info{background:linear-gradient(180deg,#3d62a6,#223a6a) !important;border-color:#6f97e0 !important}',
    '#ui-layer .win button.btn.danger{background:linear-gradient(180deg,#a03a40,#64191e) !important;border-color:#e0646a !important}',
    '#ui-layer .win .bag-tools button.on{background:linear-gradient(180deg,#3a9254,#215a33) !important;border-color:#5fc27c !important}',
    '#ui-layer .win .bag-tools button.dz{background:linear-gradient(180deg,#5a2226,#331014) !important;border-color:#a4383d !important;color:#ffc8c8 !important}',
    '#ui-layer .win .bag-tools button.dz.cf{background:linear-gradient(180deg,#c03a3a,#7a1a1a) !important;border-color:#ff7a7a !important;color:#fff !important}',
    '#ui-layer .win .bag-tools .qty button{background:transparent !important;border:0 !important;box-shadow:none !important}',

    '#ui-layer .win input{font-family:"Mitr",sans-serif !important;border-radius:8px !important;' +
      'background:#0a0f1c !important;border:1px solid #d4af37 !important;color:#ffe28a !important}',
    '#ui-layer .win .win-right,#ui-layer .win .d-stats{border-radius:12px !important}',
    '#ui-layer .win ::-webkit-scrollbar{width:6px}',
    '#ui-layer .win ::-webkit-scrollbar-thumb{background:#d4af37;border-radius:3px}'
  ].join('');
  var css = document.createElement('style');
  css.textContent = CSS;
  document.head.appendChild(css);

  // ---------- ตัวช่วยค้นหาจากข้อความ ----------
  var LABELS = [/^HP\s*10\s*%$/, /^ATK$/, /^DEF$/, /^HP\+$/];
  var targets = null, topBtns = [], hiddenObjs = [];

  function findText(re, root) {
    var w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, null);
    while (w.nextNode()) {
      var n = w.currentNode;
      if (re.test((n.nodeValue || '').trim())) return n.parentElement;
    }
    return null;
  }

  function locate() {
    var hp = findText(LABELS[0]);
    if (!hp) return null;
    var a = hp;
    while (a && a !== document.body) {
      if (findText(LABELS[1], a) && findText(LABELS[2], a) && findText(LABELS[3], a)) break;
      a = a.parentElement;
    }
    if (!a || a === document.body) return null;
    var tooBig = a.id === 'ui-layer' || !!a.querySelector('canvas');
    if (!tooBig) return [a];
    var res = [];
    LABELS.forEach(function (re) {
      var l = findText(re, a);
      if (!l) return;
      while (l.parentElement && l.parentElement !== a) l = l.parentElement;
      if (res.indexOf(l) < 0) res.push(l);
    });
    return res.length ? res : null;
  }

  // ปุ่ม CH1-1 และ จุติ (ที่ลอยทับหน้าต่าง)
  function locateTopBtns() {
    var res = [];
    [/^CH\d+-\d+$/, /^จุติ$/].forEach(function (re) {
      var l = findText(re);
      if (!l) return;
      var n = l;
      while (n.parentElement && n.parentElement !== document.body) {
        var r = n.parentElement.getBoundingClientRect();
        if (r.width > 140 || r.height > 140) break;
        n = n.parentElement;
      }
      if (res.indexOf(n) < 0) res.push(n);
    });
    return res;
  }

  // หาแผงหน้าต่างจากข้อความหัวข้อ (ไล่ขึ้นจนถึงชั้นก่อนเต็มจอ)
  function findPanel(re) {
    var l = findText(re);
    if (!l) return null;
    var n = l;
    while (n.parentElement && n.parentElement !== document.body) {
      var r = n.parentElement.getBoundingClientRect();
      if (r.width >= window.innerWidth * 0.95 && r.height >= window.innerHeight * 0.95) break;
      n = n.parentElement;
    }
    return n;
  }

  function shrinkPanels() {
    var s = findPanel(/^สถานะตัวละคร$/);
    if (s && !s.classList.contains('pp-small')) s.classList.add('pp-small');
    var k = findPanel(/^สกิลทั่วไป$/);
    if (k && !k.classList.contains('sk-small')) k.classList.add('sk-small');
  }

  function windowOpen() {
    var sc = window.__mainScene;
    if (sc && sc.panel) return true;
    if (window.PixelPanels && PixelPanels.isOpen && PixelPanels.isOpen()) return true;
    var wins = document.querySelectorAll('#ui-layer .win');
    for (var i = 0; i < wins.length; i++) {
      if (getComputedStyle(wins[i]).display !== 'none') return true;
    }
    var el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return !!(el && el.tagName !== 'CANVAS' && el.tagName !== 'HTML' && el.tagName !== 'BODY');
  }

  function toggleHtmlHud(open) {
    ['box-btn', 'btn-social', 'party-hud'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.classList.toggle('pot-hide', open);
    });
  }

  // ซ่อนปุ่มในแคนวาส: แถบบนขวา + ปุ่มแถบบนซ้าย (เมือง / CH / จุติ)
  function toggleCanvasTop(open) {
    try {
      var sc = window.__mainScene;
      if (!sc || !sc.children || !sc.scale) return;
      if (open && !hiddenObjs.length) {
        var W = sc.scale.width, H = sc.scale.height;
        sc.children.list.forEach(function (o) {
          if (!o.visible || o.scrollFactorX !== 0 || !o.getBounds) return;
          var b = o.getBounds();
          if (b.width > W * 0.5 || b.height > H * 0.2) return;
          var topRight = b.y < H * 0.12 && b.x > W * 0.6;
          var topLeft = b.y < H * 0.12 && b.x > W * 0.2 && b.x < W * 0.37 && b.width < W * 0.12;
          if (topRight || topLeft) hiddenObjs.push(o);
        });
        hiddenObjs.forEach(function (o) { o.setVisible(false); });
      } else if (!open && hiddenObjs.length) {
        hiddenObjs.forEach(function (o) { if (o.scene) o.setVisible(true); });
        hiddenObjs = [];
      }
    } catch (e) {}
  }

  var tick = 0, tickB = 0, tickS = 0;
  setInterval(function () {
    var open = windowOpen();
    toggleHtmlHud(open);
    toggleCanvasTop(open);

    if (!topBtns.length || topBtns.some(function (t) { return !t.isConnected; })) {
      if (tickB++ % 7 === 0) topBtns = locateTopBtns();
    }
    topBtns.forEach(function (t) { t.classList.toggle('pot-hide', open); });

    if (open && tickS++ % 4 === 0) shrinkPanels();

    if (!targets || targets.some(function (t) { return !t.isConnected; })) {
      if (tick++ % 6 === 0) targets = locate();
      if (!targets) return;
    }
    targets.forEach(function (t) { t.classList.toggle('pot-hide', open); });
  }, 150);
})();
