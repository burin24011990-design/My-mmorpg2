// ===== ซ่อน HUD ตอนเปิดหน้าต่างใดๆ + ตกแต่งหน้าต่างให้สวยขึ้น =====
// ซ่อน: ช่องยา, ปุ่ม 📦, ปุ่มสังคม, กรอบปาร์ตี้, และปุ่มเมนูบนขวา (ในแคนวาสเกม)
(function () {
  var css = document.createElement('style');
  css.textContent =
    '.pot-hide{visibility:hidden !important;pointer-events:none !important}' +

    /* ---- ตกแต่งหน้าต่าง (กระเป๋า/อุปกรณ์ ฯลฯ) ---- */
    '#ui-layer .win{font-family:"Mitr",sans-serif !important;color:#f6efdc;' +
      'background:linear-gradient(180deg,#1b2338 0%,#0d1220 100%) !important;' +
      'border:2px solid #d4af37 !important;border-radius:18px !important;' +
      'box-shadow:0 12px 40px rgba(0,0,0,.75),inset 0 0 0 1px rgba(255,226,138,.18),inset 0 0 40px rgba(212,175,55,.06) !important;' +
      'text-shadow:0 1px 2px rgba(0,0,0,.7);letter-spacing:.2px}' +
    '#ui-layer .win button{font-family:"Mitr",sans-serif !important;border-radius:10px !important;' +
      'background:linear-gradient(180deg,#26324d,#161e33) !important;' +
      'border:1px solid #5b6d96 !important;color:#f6efdc !important;' +
      'box-shadow:0 2px 0 #0a0e18,inset 0 1px 0 rgba(255,255,255,.12) !important;transition:transform .08s}' +
    '#ui-layer .win button:active{transform:translateY(2px);box-shadow:none !important}' +
    '#ui-layer .win input{font-family:"Mitr",sans-serif !important;border-radius:8px !important;' +
      'background:#0a0f1c !important;border:1px solid #d4af37 !important;color:#ffe28a !important}' +
    '#ui-layer .win ::-webkit-scrollbar{width:6px}' +
    '#ui-layer .win ::-webkit-scrollbar-thumb{background:#d4af37;border-radius:3px}';
  document.head.appendChild(css);

  var LABELS = [/^HP\s*10\s*%$/, /^ATK$/, /^DEF$/, /^HP\+$/];
  var targets = null;
  var hiddenObjs = [];   // ปุ่มในแคนวาสที่ถูกซ่อน

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

  // ซ่อนปุ่ม HTML ที่ลอยทับหน้าต่าง (📦, สังคม, กรอบปาร์ตี้)
  function toggleHtmlHud(open) {
    ['box-btn', 'btn-social', 'party-hud'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.classList.toggle('pot-hide', open);
    });
  }

  // ซ่อนปุ่มเมนูบนขวาที่วาดในแคนวาส Phaser (วัตถุที่ติดจอ อยู่แถบบน ฝั่งขวา)
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
          if (b.y < H * 0.12 && b.x > W * 0.6) hiddenObjs.push(o);
        });
        hiddenObjs.forEach(function (o) { o.setVisible(false); });
      } else if (!open && hiddenObjs.length) {
        hiddenObjs.forEach(function (o) { if (o.scene) o.setVisible(true); });
        hiddenObjs = [];
      }
    } catch (e) {}
  }

  var tick = 0;
  setInterval(function () {
    var open = windowOpen();
    toggleHtmlHud(open);
    toggleCanvasTop(open);
    if (!targets || targets.some(function (t) { return !t.isConnected; })) {
      if (tick++ % 6 === 0) targets = locate();
      if (!targets) return;
    }
    targets.forEach(function (t) { t.classList.toggle('pot-hide', open); });
  }, 150);
})();
