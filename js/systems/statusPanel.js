// ===== หน้าต่างสเตตัสแนวกำลังภายใน (ยุทธภพ) =====
// โหลดหลัง pixelPanels.js / pixelBridge.js / stats.js (วางก่อน main.js)
// v7: ปุ่ม − / + / ✕ ย้ายไปมุมขวาบน ขนาดเล็ก (ไม่เบียดชื่อ) | ป้าย Lv/ฉายาไม่ตกบรรทัด
//     ปุ่ม − / + ปรับขนาดหน้าต่างในเกม (จำค่าไว้) | ซ่อนปุ่ม HTML (.hb-t) ตอนเปิด แล้วคืนเมื่อปิด
//     ชื่อตัวละครอ่านจาก mmo_cloud_lastname | ใส่รูปตัวละครได้ | อุปกรณ์ = เขียว, การ์ด = ฟ้า
(function () {
  var PP = window.PixelPanels;
  if (!PP) return;

  // ---------- ตั้งค่า (ปรับตรงนี้) ----------
  var WIN_SCALE = 0.5;              // ขนาดเริ่มต้นจอแนวนอน (ถ้ายังไม่เคยกด − / +)
  var PORTRAIT_SCALE = 0.85;        // ขนาดเริ่มต้นจอแนวตั้ง
  var SCALE_MIN = 0.3, SCALE_MAX = 1.3, SCALE_STEP = 0.1;
  var SCALE_KEY = 'xh_status_scale_v1';   // ที่จำขนาดที่ผู้เล่นเลือก (เก็บในเครื่อง)
  var TOOL_BTN = 24;                // ขนาดปุ่ม − / + / ✕ (px)
  var TOOL_INV_MAX = 1.8;           // ปุ่มขยายสวนทางหน้าต่างได้สูงสุดกี่เท่า (กันกดยากตอนย่อเล็ก)
  var PORTRAIT_URL = '';            // ใส่ path รูปเริ่มต้นได้ เช่น 'assets/portrait.png' (ว่าง = ใช้อีโมจิ 🦊)
  var PORTRAIT_EMOJI = '🦊';
  var PORTRAIT_KEY = 'xh_portrait_v1';   // ที่เก็บรูปที่ผู้เล่นเลือกเอง (เก็บในเครื่อง)
  var PORTRAIT_SIZE = 192;          // ย่อรูปเป็นสี่เหลี่ยมจัตุรัสขนาดนี้ก่อนเก็บ
  // ปุ่ม HTML ที่จะซ่อนตอนเปิดหน้าสเตตัส: ทุกอันที่ใช้คลาส .hb-t + ข้อความที่ตรงกับ RegExp นี้ (เผื่อบางปุ่มไม่มีคลาส)
  var HIDE_SELECTOR = '.hb-t';
  var HIDE_BTN_RE = /^(เสียง|เมือง|CH\s?\d+(-\d+)?)$/;
  // ฉายาตามเลเวล (เลเวลขึ้นไป -> ฉายา)
  var RANKS = [
    [1, 'หน้าใหม่ยุทธภพ'], [20, 'ศิษย์สำนัก'], [40, 'ยอดฝีมือ'],
    [60, 'จอมยุทธ์'], [80, 'ปรมาจารย์'], [100, 'เทพยุทธ์']
  ];

  var layer = document.getElementById('ui-layer') || document.body;
  var win = null, body = null, fileIn = null;

  var GROUPS = [
    { z: '攻', t: 'โจมตี',    c: '#d6403a', k: ['patk', 'ap', 'aspd', 'crit', 'critdmg', 'ppen', 'mpen'] },
    { z: '守', t: 'ป้องกัน',   c: '#3f86c8', k: ['pdef', 'mdef', 'dodge', 'hpregen', 'mpregen'] },
    { z: '奇', t: 'พิเศษ',     c: '#c9a24a', k: ['cdr', 'mspd', 'lifesteal', 'spellvamp'] }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(n) { return typeof n === 'number' ? n.toLocaleString('en-US') : esc(n); }
  function num(v) { return (typeof v === 'number' && !isNaN(v)) ? v : 0; }
  function pct(v) { return Math.max(0, Math.min(100, v)); }

  // ---------- ฟอนต์จีน (ดึงเฉพาะตัวอักษรที่ใช้ ไฟล์เล็กมาก) ----------
  (function () {
    if (document.getElementById('wx-font')) return;
    var zh = '攻守奇俠江湖氣血內力經驗銀兩殺敵錄武';
    var l = document.createElement('link');
    l.id = 'wx-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@700;900&text=' + encodeURIComponent(zh) + '&display=swap';
    document.head.appendChild(l);
  })();

  // ---------- ขนาดหน้าต่าง (ปรับในเกมด้วยปุ่ม − / +) ----------
  function isPortrait() { return window.innerHeight > window.innerWidth; }
  function userScale() {
    try { var v = parseFloat(localStorage.getItem(SCALE_KEY)); if (v > 0) return v; } catch (e) {}
    return 0;
  }
  function curScale() {
    return userScale() || (isPortrait() ? PORTRAIT_SCALE : WIN_SCALE);
  }
  function applyScale() {
    if (!win) return;
    var s = Math.max(SCALE_MIN, Math.min(SCALE_MAX, curScale()));
    win.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
    // ปุ่มควบคุมมุมขวาบนขยายสวนทางเล็กน้อย ให้กดง่ายแม้หน้าต่างย่อเล็ก
    win.style.setProperty('--inv', String(Math.max(1, Math.min(TOOL_INV_MAX, 1 / s))));
    win.title = '';
  }
  function stepScale(d) {
    var s = Math.round((curScale() + d) * 10) / 10;
    s = Math.max(SCALE_MIN, Math.min(SCALE_MAX, s));
    try { localStorage.setItem(SCALE_KEY, String(s)); } catch (e) {}
    applyScale();
  }
  window.addEventListener('resize', applyScale);
  window.addEventListener('orientationchange', function () { setTimeout(applyScale, 250); });

  // ---------- CSS ----------
  function css() {
    if (document.getElementById('wx-css')) return;
    var st = document.createElement('style');
    st.id = 'wx-css';
    st.textContent = [
      '[data-wxh]{visibility:hidden !important}',
      '.wx-win{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(0.5);transform-origin:center center;width:min(94%,820px);max-height:94%;display:none;flex-direction:column;box-sizing:border-box;z-index:9000;pointer-events:auto;',
      "font-family:'Noto Serif SC','Mitr',sans-serif;color:#f3e3bf;padding:10px 12px 12px;border:3px solid #c9a24a;border-radius:6px;",
      'background:radial-gradient(ellipse at 50% 0%,rgba(140,24,24,.45),transparent 62%),repeating-linear-gradient(45deg,rgba(255,255,255,.018) 0 2px,transparent 2px 7px),linear-gradient(#1d0d0d,#0d0505);',
      'box-shadow:0 0 0 2px #3b0d0d,0 0 0 4px rgba(201,162,74,.45),0 10px 40px rgba(0,0,0,.8),inset 0 0 36px rgba(0,0,0,.75)}',
      '.wx-win.open{display:flex}',
      '.wx-cn{position:absolute;width:13px;height:13px;background:#8e1b16;border:2px solid #e6c36a;transform:rotate(45deg);box-shadow:0 0 6px #000}',
      '.wx-cn.a{left:-9px;top:-9px}.wx-cn.b{right:-9px;top:-9px}.wx-cn.c{left:-9px;bottom:-9px}.wx-cn.d{right:-9px;bottom:-9px}',
      // เว้นที่สองข้างหัวข้อให้ปุ่มมุมขวาบน (ซ้าย-ขวาเท่ากัน หัวข้อจึงอยู่กลางเหมือนเดิม)
      '.wx-banner{text-align:center;font-size:11px;letter-spacing:3px;color:#c9a24a;margin:-2px 0 6px;display:flex;align-items:center;gap:8px;padding:0 calc(var(--inv,1) * 82px + 6px);white-space:nowrap}',
      '.wx-banner:before,.wx-banner:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,#c9a24a,transparent)}',
      '.wx-banner b{font-weight:900;font-size:13px;color:#e6c36a;text-shadow:0 0 6px rgba(201,162,74,.5)}',
      '.wx-head{display:flex;align-items:center;gap:12px;flex:0 0 auto}',
      '.wx-pt{position:relative;flex:0 0 auto;width:clamp(54px,17vh,92px);height:clamp(54px,17vh,92px);border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:clamp(28px,9vh,50px);',
      'background:radial-gradient(circle at 35% 30%,#4a1414,#170707);border:3px solid #e6c36a;box-shadow:0 0 0 2px #5a1010,0 0 0 4px #c9a24a,0 0 14px rgba(0,0,0,.9);overflow:hidden}',
      '.wx-pt img{width:100%;height:100%;object-fit:cover;pointer-events:none}',
      '.wx-cam{position:absolute;right:0;bottom:0;left:0;text-align:center;font-size:10px;line-height:1.5;background:rgba(0,0,0,.6);color:#e6c36a;font-family:inherit;white-space:nowrap}',
      '.wx-id{flex:1;min-width:0}',
      '.wx-name{font-size:clamp(18px,5.4vh,28px);font-weight:900;color:#f6dc8c;letter-spacing:1px;text-shadow:0 2px 0 #5a1010,0 0 10px rgba(201,162,74,.45);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.wx-meta{display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap}',
      '.wx-meta span{white-space:nowrap}',
      '.wx-lv{background:linear-gradient(#b3261e,#6e100c);border:2px solid #e6c36a;border-radius:4px;padding:1px 9px;font-weight:900;font-size:14px;color:#fff3cf;box-shadow:0 0 6px rgba(0,0,0,.7)}',
      '.wx-rank{font-size:12px;color:#e6c36a;border-bottom:1px solid rgba(201,162,74,.5);padding:0 2px}',
      '.wx-cls{font-size:12px;color:#d9c6a0}',
      '.wx-rm{font-size:10px;color:#9a8a6a;text-decoration:underline;cursor:pointer;margin-left:2px}',
      // ปุ่ม − / + / ✕ : ลอยอยู่มุมขวาบนของหน้าต่าง ขนาดเล็ก
      '.wx-tools{position:absolute;top:5px;right:8px;z-index:3;display:flex;align-items:center;gap:4px;transform:scale(var(--inv,1));transform-origin:top right}',
      '.wx-tools button{width:' + TOOL_BTN + 'px;height:' + TOOL_BTN + 'px;border:2px solid #c9a24a;background:linear-gradient(#7a1510,#3b0907);color:#ffe9b0;font-size:14px;border-radius:4px;cursor:pointer;font-family:inherit;padding:0;line-height:1;display:flex;align-items:center;justify-content:center}',
      '.wx-tools button:active{filter:brightness(1.3)}',
      '.wx-bars{display:flex;flex-direction:column;gap:5px;margin:9px 0 8px;flex:0 0 auto}',
      '.wx-bar{position:relative;height:clamp(17px,5vh,24px);border:2px solid #c9a24a;border-radius:3px;background:#0a0404;overflow:hidden;box-shadow:inset 0 0 8px #000}',
      '.wx-bar i{position:absolute;left:0;top:0;bottom:0}',
      '.wx-bar.hp i{background:linear-gradient(#e0443a,#8e1510)}',
      '.wx-bar.mp i{background:linear-gradient(#3f9ad8,#164a86)}',
      '.wx-bar.xp i{background:linear-gradient(#e6c36a,#9a741c)}',
      '.wx-bar b{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 8px;font-size:clamp(10px,3vh,13px);font-weight:600;text-shadow:0 1px 2px #000,0 0 3px #000;color:#fff}',
      '.wx-bar b em{font-style:normal;font-family:"Noto Serif SC","Mitr",sans-serif;font-weight:900;color:#ffe9b0;margin-right:5px}',
      '.wx-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:2px 2px 0}',
      '.wx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}',
      '.wx-card{border:1px solid rgba(201,162,74,.7);border-radius:5px;background:rgba(0,0,0,.38);box-shadow:inset 0 0 14px rgba(0,0,0,.6);overflow:hidden}',
      '.wx-card h3{margin:0;display:flex;align-items:center;gap:8px;padding:5px 8px;font-size:14px;font-weight:700;color:var(--c);background:linear-gradient(90deg,rgba(255,255,255,.07),transparent);border-bottom:2px solid var(--c)}',
      '.wx-card h3 i{font-style:normal;width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:var(--c);color:#fff;border-radius:3px;font-weight:900;font-size:15px;box-shadow:0 0 0 1px #000,inset 0 0 0 1px rgba(255,255,255,.35)}',
      '.wx-row{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:6px 9px;border-bottom:1px dashed rgba(201,162,74,.28);font-size:13px}',
      '.wx-row:last-child{border-bottom:0}',
      '.wx-row span{color:#d9c6a0}',
      '.wx-row b{color:#fff3cf;font-weight:700;text-align:right}',
      '.wx-row small{font-size:11px;font-weight:700;margin-left:3px}',
      '.wx-foot{display:flex;gap:8px;margin-top:8px}',
      '.wx-chip{flex:1;display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border:1px solid rgba(201,162,74,.7);border-radius:5px;background:rgba(0,0,0,.4);font-size:13px}',
      '.wx-chip span em{font-style:normal;font-family:"Noto Serif SC","Mitr",sans-serif;font-weight:900;color:#e6c36a;margin-right:4px}',
      '.wx-chip b{color:#f6dc8c}',
      '.wx-legend{margin-top:7px;text-align:center;font-size:11px;color:#9a8a6a}',
      '.wx-legend u{text-decoration:none;font-weight:700}'
    ].join('');
    document.head.appendChild(st);
  }

  // ---------- ซ่อน/คืนปุ่ม HTML (เสียง เมือง แชนแนล ฯลฯ) ----------
  var hidden = [];        // ปุ่มที่ติดป้าย data-wxh ไว้ (ไว้ถอดคืน)
  var hudTimer = null;
  function markHide(el) {
    // ไต่ขึ้นหากล่องปุ่มที่ลอยอยู่บนจอ (fixed/absolute) แต่ไม่ใหญ่เกินปุ่ม
    var t = el, found = null;
    for (var n = 0; n < 5 && t && t !== document.body && t !== document.documentElement; n++) {
      var pos = '';
      try { pos = getComputedStyle(t).position; } catch (e) {}
      if (pos === 'fixed' || pos === 'absolute') { found = t; break; }
      t = t.parentElement;
    }
    if (!found) found = el.parentElement || el;
    var r = found.getBoundingClientRect();
    if (r.width > 220 || r.height > 220) found = el.parentElement && el.parentElement.getBoundingClientRect().width <= 220 ? el.parentElement : el;
    if (found === layer || found === win || (win && win.contains(found)) || found === document.body) return;
    if (found.hasAttribute('data-wxh')) return;
    found.setAttribute('data-wxh', '1');
    hidden.push(found);
  }
  function hideHud() {
    try {
      var list = document.querySelectorAll(HIDE_SELECTOR);
      for (var i = 0; i < list.length; i++) {
        if (win && win.contains(list[i])) continue;
        markHide(list[i]);
      }
      // สำรอง: ปุ่มที่ไม่มีคลาส แต่ข้อความตรงชื่อ
      var all = document.querySelectorAll('body *');
      for (var j = 0; j < all.length; j++) {
        var el = all[j];
        if (el.childElementCount > 0 || (win && win.contains(el))) continue;
        var tx = (el.textContent || '').trim();
        if (tx && tx.length <= 8 && HIDE_BTN_RE.test(tx)) markHide(el);
      }
    } catch (e) {}
  }
  function restoreHud() {
    hidden.forEach(function (el) { try { el.removeAttribute('data-wxh'); } catch (e) {} });
    hidden = [];
  }

  // ---------- ชื่อตัวละคร ----------
  // startScreen.js เก็บชื่อที่ตั้งตอนกดเริ่มเล่นไว้ที่ localStorage คีย์ mmo_cloud_lastname (ผู้เยี่ยมชมจะมี G- นำหน้า)
  function playerName(s) {
    var c = [];
    try {
      c.push(localStorage.getItem('mmo_cloud_lastname'));
      c.push(window.PLAYER_NAME, window.playerName, window.myName);
      if (s) c.push(s.playerName, s.charName, s.myName, s.nickname, s.name, s.stats && s.stats.name);
      if (window.Net) c.push(window.Net.name, window.Net.myName);
    } catch (e) {}
    for (var i = 0; i < c.length; i++) {
      if (typeof c[i] === 'string' && c[i].trim()) return c[i].trim();
    }
    return 'Player';
  }
  function rankOf(lv) {
    var r = RANKS[0][1];
    RANKS.forEach(function (x) { if (lv >= x[0]) r = x[1]; });
    return r;
  }

  // ---------- รูปตัวละคร ----------
  function getPortrait() {
    try { var v = localStorage.getItem(PORTRAIT_KEY); if (v) return v; } catch (e) {}
    return PORTRAIT_URL || '';
  }
  function hasCustomPortrait() {
    try { return !!localStorage.getItem(PORTRAIT_KEY); } catch (e) { return false; }
  }
  function pickFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = c.height = PORTRAIT_SIZE;
          var side = Math.min(im.width, im.height);
          c.getContext('2d').drawImage(im, (im.width - side) / 2, (im.height - side) / 2, side, side, 0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
          localStorage.setItem(PORTRAIT_KEY, c.toDataURL('image/jpeg', 0.85));
        } catch (e) {
          var s = window.__mainScene; if (s && s.toastMsg) s.toastMsg('บันทึกรูปไม่สำเร็จ');
        }
        render();
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  // ---------- แยกโบนัสจากอุปกรณ์ / การ์ด (เฉพาะชิ้นที่สวมอยู่) ----------
  function bonusSplit(s) {
    var eqB = {}, cdB = {};
    try {
      var eq = s.equipment || {};
      (window.EQUIP_SLOT_KEYS || Object.keys(eq)).forEach(function (k) {
        var it = eq[k];
        if (!it) return;
        var a = window.computeItemStats ? window.computeItemStats(it) : {};
        Object.keys(a).forEach(function (key) { eqB[key] = (eqB[key] || 0) + a[key]; });
        var c = window.CardSys ? window.CardSys.cardBonusOf(it) : {};
        Object.keys(c).forEach(function (key) { cdB[key] = (cdB[key] || 0) + c[key]; });
      });
    } catch (e) {}
    return { eq: eqB, cd: cdB };
  }

  // ---------- สร้างหน้าต่าง ----------
  function build() {
    if (win) return;
    css();
    win = document.createElement('div');
    win.className = 'wx-win';
    win.innerHTML =
      '<span class="wx-cn a"></span><span class="wx-cn b"></span><span class="wx-cn c"></span><span class="wx-cn d"></span>' +
      '<div class="wx-tools"><button class="wx-zm" aria-label="ย่อ">−</button>' +
      '<button class="wx-zp" aria-label="ขยาย">+</button>' +
      '<button class="wx-x" aria-label="ปิด">✕</button></div>' +
      '<div class="wx-banner"><b>俠客錄</b><span>ทำเนียบยอดยุทธ์</span></div>' +
      '<div class="wx-head"></div><div class="wx-bars"></div>' +
      '<div class="wx-scroll"></div>';
    layer.appendChild(win);
    body = win.querySelector('.wx-scroll');

    fileIn = document.createElement('input');
    fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.style.display = 'none';
    fileIn.addEventListener('change', function () {
      if (fileIn.files && fileIn.files[0]) pickFile(fileIn.files[0]);
      fileIn.value = '';
    });
    win.appendChild(fileIn);

    win.addEventListener('click', function (e) {
      if (e.target.closest('.wx-x')) { hide(); return; }
      if (e.target.closest('.wx-zm')) { stepScale(-SCALE_STEP); return; }
      if (e.target.closest('.wx-zp')) { stepScale(SCALE_STEP); return; }
      if (e.target.closest('.wx-rm')) {
        try { localStorage.removeItem(PORTRAIT_KEY); } catch (er) {}
        render(); return;
      }
      if (e.target.closest('.wx-pt')) fileIn.click();
    });
    ['pointerdown', 'touchstart', 'touchmove', 'mousedown'].forEach(function (evn) {
      win.addEventListener(evn, function (e) { e.stopPropagation(); }, { passive: true });
    });
    applyScale();
  }

  function render() {
    build();
    var s = window.__mainScene;
    var head = win.querySelector('.wx-head');
    var bars = win.querySelector('.wx-bars');
    if (!s || !s.stats || !s.getStats) {
      head.innerHTML = '<div class="wx-id"><div class="wx-name">กำลังโหลด...</div></div>';
      return;
    }
    var st = s.stats, S = s.getStats();
    var cls = '';
    try { cls = (s.currentClass && window.WEAPON_CLASS_LABEL) ? (WEAPON_CLASS_LABEL[s.currentClass()] || '') : ''; } catch (e) {}

    var lv = num(st.level || 1);
    var hp = Math.floor(num(st.hp)), hpMax = s.maxHp ? s.maxHp() : hp;
    var mp = Math.floor(num(st.mp)), mpMax = s.maxMp ? s.maxMp() : mp;
    var exp = st.expNext ? +(num(st.exp) / st.expNext * 100).toFixed(1) : 0;

    var pic = getPortrait();
    head.innerHTML =
      '<div class="wx-pt" title="แตะเพื่อเปลี่ยนรูป">' +
      (pic ? '<img src="' + esc(pic) + '" alt="">' : PORTRAIT_EMOJI) +
      '<span class="wx-cam">📷 เปลี่ยนรูป</span></div>' +
      '<div class="wx-id"><div class="wx-name">' + esc(playerName(s)) + '</div>' +
      '<div class="wx-meta"><span class="wx-lv">Lv. ' + lv + '</span>' +
      '<span class="wx-rank">' + esc(rankOf(lv)) + '</span>' +
      (cls ? '<span class="wx-cls">' + esc(cls) + '</span>' : '') +
      (hasCustomPortrait() ? '<span class="wx-rm">ลบรูป</span>' : '') + '</div></div>';

    bars.innerHTML =
      '<div class="wx-bar hp"><i style="width:' + pct(hpMax ? hp / hpMax * 100 : 0) + '%"></i><b><span><em>血</em>HP</span><span>' + fmt(hp) + ' / ' + fmt(hpMax) + '</span></b></div>' +
      '<div class="wx-bar mp"><i style="width:' + pct(mpMax ? mp / mpMax * 100 : 0) + '%"></i><b><span><em>氣</em>MP</span><span>' + fmt(mp) + ' / ' + fmt(mpMax) + '</span></b></div>' +
      '<div class="wx-bar xp"><i style="width:' + pct(exp) + '%"></i><b><span><em>經驗</em>EXP</span><span>' + exp + '%</span></b></div>';

    var defs = window.STAT_DEFS || {};
    var f = window.fmtStat || function (k, v) { return Math.round(v); };
    var split = bonusSplit(s);
    var cards = '';
    GROUPS.forEach(function (g) {
      var rows = '';
      g.k.forEach(function (k) {
        var d = defs[k];
        if (!d) return;
        if (d.hideZero && !S[k]) return;
        var add = '';
        if (split.eq[k] > 0) add += '<small style="color:#5ee08a">+' + esc(f(k, split.eq[k])) + '</small>';
        if (split.cd[k] > 0) add += '<small style="color:#5db8ff">+' + esc(f(k, split.cd[k])) + '</small>';
        rows += '<div class="wx-row"><span>' + esc(d.label) + '</span><b>' + esc(f(k, S[k])) + add + '</b></div>';
      });
      if (rows) cards += '<div class="wx-card" style="--c:' + g.c + '"><h3><i>' + g.z + '</i>' + g.t + '</h3>' + rows + '</div>';
    });

    var top = body.scrollTop;
    body.innerHTML =
      '<div class="wx-grid">' + cards + '</div>' +
      '<div class="wx-foot">' +
      '<div class="wx-chip"><span><em>銀兩</em>ทอง</span><b>' + fmt(num(st.gold)) + '</b></div>' +
      '<div class="wx-chip"><span><em>殺敵</em>ฆ่าแล้ว</span><b>' + fmt(num(s.kills)) + '</b></div></div>' +
      '<div class="wx-legend"><u style="color:#5ee08a">+เขียว</u> จากอุปกรณ์ • <u style="color:#5db8ff">+ฟ้า</u> จากการ์ด</div>';
    body.scrollTop = top;
  }

  function show() {
    render();
    win.classList.add('open');
    applyScale();
    hideHud();
    // ปุ่มบางตัวถูกวาดใหม่เป็นระยะ -> เช็กซ้ำระหว่างเปิดอยู่
    if (!hudTimer) hudTimer = setInterval(function () { if (isOpen()) hideHud(); }, 600);
  }
  function hide() {
    if (win) win.classList.remove('open');
    if (hudTimer) { clearInterval(hudTimer); hudTimer = null; }
    restoreHud();
  }
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
