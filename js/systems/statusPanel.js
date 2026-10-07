// ===== หน้าต่างสเตตัสแบบกะทัดรัด: โชว์ค่าสถานะอย่างเดียว =====
// โหลดหลัง pixelPanels.js / pixelBridge.js / stats.js (วางก่อน main.js)
// ไม่แก้ไฟล์เดิม: แค่ดักเมื่อเปิดหน้า 'status' แล้วใช้หน้าต่างนี้แทน
// หน้าอื่น (อุปกรณ์ / สกิล) ยังใช้ของเดิมทุกอย่าง
(function () {
  var PP = window.PixelPanels;
  if (!PP) return;
  var layer = document.getElementById('ui-layer') || document.body;
  var win = null, body = null;

  // กลุ่มค่าสถานะ (คีย์ตาม STAT_DEFS ใน stats.js) — ค่าไหนไม่มีในเกมจะข้ามเอง
  var GROUPS = [
    { t: '⚔️ โจมตี',  c: '#ff6a5e', k: ['patk', 'ap', 'aspd', 'crit', 'critdmg', 'ppen', 'mpen'] },
    { t: '🛡️ ป้องกัน', c: '#5db0ff', k: ['pdef', 'mdef', 'dodge', 'hpregen', 'mpregen'] },
    { t: '✨ พิเศษ',   c: '#f2d48a', k: ['cdr', 'mspd', 'lifesteal', 'spellvamp'] }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(n) { return typeof n === 'number' ? n.toLocaleString('en-US') : esc(n); }
  function num(v) { return (typeof v === 'number' && !isNaN(v)) ? v : 0; }
  function pct(v) { return Math.max(0, Math.min(100, v)); }

  function build() {
    if (win) return;
    win = document.createElement('div');
    win.className = 'sp-win';
    win.innerHTML = '<div class="sp-head"></div><div class="sp-bars"></div><div class="sp-body"></div>';
    layer.appendChild(win);
    body = win.querySelector('.sp-body');
    win.addEventListener('click', function (e) {
      if (e.target.closest('.sp-x')) hide();
    });
    ['pointerdown', 'touchstart', 'touchmove', 'mousedown'].forEach(function (evn) {
      win.addEventListener(evn, function (e) { e.stopPropagation(); }, { passive: true });
    });
  }

  function render() {
    build();
    var s = window.__mainScene;
    var head = win.querySelector('.sp-head');
    var bars = win.querySelector('.sp-bars');
    if (!s || !s.stats || !s.getStats) {
      head.innerHTML = '<div class="sp-id"><div class="sp-name">กำลังโหลด...</div></div><button class="sp-x" aria-label="ปิด">✕</button>';
      return;
    }
    var st = s.stats, S = s.getStats();
    var cls = '';
    try { cls = (s.currentClass && window.WEAPON_CLASS_LABEL) ? (WEAPON_CLASS_LABEL[s.currentClass()] || '') : ''; } catch (e) {}

    var hp = Math.floor(num(st.hp)), hpMax = s.maxHp ? s.maxHp() : hp;
    var mp = Math.floor(num(st.mp)), mpMax = s.maxMp ? s.maxMp() : mp;
    var exp = st.expNext ? +(num(st.exp) / st.expNext * 100).toFixed(1) : 0;

    head.innerHTML =
      '<div class="sp-seal"><span>🦊</span></div>' +
      '<div class="sp-id"><div class="sp-name">Player</div>' +
      '<div class="sp-meta"><span class="sp-lv">Lv. ' + num(st.level || 1) + '</span>' +
      (cls ? '<span class="sp-cls">' + esc(cls) + '</span>' : '') + '</div></div>' +
      '<button class="sp-x" aria-label="ปิด">✕</button>';

    bars.innerHTML =
      '<div class="sp-bar hp"><i style="width:' + pct(hpMax ? hp / hpMax * 100 : 0) + '%"></i><b><span>❤️ HP</span><span>' + fmt(hp) + ' / ' + fmt(hpMax) + '</span></b></div>' +
      '<div class="sp-bar mp"><i style="width:' + pct(mpMax ? mp / mpMax * 100 : 0) + '%"></i><b><span>💧 MP</span><span>' + fmt(mp) + ' / ' + fmt(mpMax) + '</span></b></div>' +
      '<div class="sp-bar xp"><i style="width:' + pct(exp) + '%"></i><b>EXP ' + exp + '%</b></div>';

    var defs = window.STAT_DEFS || {};
    var f = window.fmtStat || function (k, v) { return Math.round(v); };
    var cards = '';
    GROUPS.forEach(function (g) {
      var rows = '';
      g.k.forEach(function (k) {
        var d = defs[k];
        if (!d) return;
        if (d.hideZero && !S[k]) return;
        rows += '<div class="sp-row"><span>' + esc(d.label) + '</span><b>' + esc(f(k, S[k])) + '</b></div>';
      });
      if (rows) cards += '<div class="sp-card" style="--c:' + g.c + '"><h3>' + g.t + '</h3>' + rows + '</div>';
    });

    var top = body.scrollTop;
    body.innerHTML =
      '<div class="sp-grid">' + cards + '</div>' +
      '<div class="sp-foot">' +
      '<div class="sp-chip"><span>🪙 ทอง</span><b>' + fmt(num(st.gold)) + '</b></div>' +
      '<div class="sp-chip"><span>☠️ ฆ่าแล้ว</span><b>' + fmt(num(s.kills)) + '</b></div></div>';
    body.scrollTop = top;
  }

  function show() { render(); win.classList.add('open'); }
  function hide() { if (win) win.classList.remove('open'); }
  function isOpen() { return !!(win && win.classList.contains('open')); }

  // ---- ครอบฟังก์ชันของ PixelPanels: 'status' ใช้หน้าต่างนี้ / ชื่ออื่นใช้ของเดิม ----
  var o = {
    open: PP.open, close: PP.close, closeAll: PP.closeAll,
    toggle: PP.toggle, isOpen: PP.isOpen, refresh: PP.refresh
  };
  PP.open = function (name) {
    if (name === 'status') { o.closeAll.call(PP); show(); }
    else { hide(); o.open.call(PP, name); }
  };
  PP.close = function (name) {
    if (name === 'status') hide(); else o.close.call(PP, name);
  };
  PP.closeAll = function () { hide(); o.closeAll.call(PP); };
  PP.toggle = function (name) {
    if (name === 'status') { isOpen() ? hide() : PP.open('status'); }
    else o.toggle.call(PP, name);
  };
  PP.isOpen = function () { return isOpen() || o.isOpen.call(PP); };
  PP.refresh = function () { if (isOpen()) render(); o.refresh.call(PP); };
})();
