// ===== ซ่อนช่องยาด้านซ้าย (HP 10% / ATK / DEF / HP+) ตอนเปิดหน้าต่างใดๆ =====
// ไม่ต้องแก้ไฟล์อื่น: สคริปต์หาช่องยาเองจากข้อความบนปุ่ม แล้วซ่อนตอนมีหน้าต่างเปิดอยู่
// หน้าต่างที่ตรวจ: กระเป๋า/อุปกรณ์/สกิล/สเตตัส (HTML) และแผงที่วาดในเกม (เลือกด่าน, ตั้งค่าบอท ฯลฯ)
(function () {
  var css = document.createElement('style');
  css.textContent = '.pot-hide{visibility:hidden !important;pointer-events:none !important}';
  document.head.appendChild(css);

  // ข้อความบนปุ่มช่องยา (ถ้าแก้ชื่อปุ่มในเกม ให้แก้ตรงนี้ให้ตรงกัน)
  var LABELS = [/^HP\s*10\s*%$/, /^ATK$/, /^DEF$/, /^HP\+$/];

  var targets = null;

  function findText(re, root) {
    var w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, null);
    while (w.nextNode()) {
      var n = w.currentNode;
      if (re.test((n.nodeValue || '').trim())) return n.parentElement;
    }
    return null;
  }

  // หาช่องยา: ไล่ขึ้นจากปุ่ม "HP 10%" จนเจอกล่องที่ครอบทั้ง 4 ช่อง
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
    // กล่องครอบกว้างเกิน: ซ่อนเฉพาะแต่ละช่อง
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
    if (sc && sc.panel) return true;                                   // แผงที่วาดในเกม
    if (window.PixelPanels && PixelPanels.isOpen && PixelPanels.isOpen()) return true;   // สถานะ/อุปกรณ์/สกิล
    var wins = document.querySelectorAll('#ui-layer .win');            // กระเป๋า ฯลฯ
    for (var i = 0; i < wins.length; i++) {
      if (getComputedStyle(wins[i]).display !== 'none') return true;
    }
    // กันเหนียว: ถ้ากลางจอมีสิ่งอื่นนอกจากแคนวาสเกมบังอยู่ = มีหน้าต่างเปิด
    var el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return !!(el && el.tagName !== 'CANVAS' && el.tagName !== 'HTML' && el.tagName !== 'BODY');
  }

  var tick = 0;
  setInterval(function () {
    if (!targets || targets.some(function (t) { return !t.isConnected; })) {
      if (tick++ % 6 === 0) targets = locate();       // ยังไม่เจอ ลองใหม่ทุก ~1 วิ
      if (!targets) return;
    }
    var open = windowOpen();
    targets.forEach(function (t) { t.classList.toggle('pot-hide', open); });
  }, 150);
})();
