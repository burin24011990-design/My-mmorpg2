// ===== ปุ่ม − / + ย่อ-ขยายหน้าต่าง กระเป๋า / สกิล / อุปกรณ์ =====
// ใช้คุณสมบัติ CSS "scale" (แยกจาก transform ที่ไฟล์เดิมใช้อยู่) ไม่ต้องแก้ไฟล์เดิม
// ต้องโหลดหลัง bagWindow.js และ pixelPanels.js (วางก่อน main.js ได้เลย)
// v3: ปุ่มอยู่ "ในแถบหัวหน้าต่าง" ซ้ายของปุ่ม ✕ (ไม่ลอยทับหน้าต่างอื่นอีก)
//     กระเป๋า: แถบหัวถูกวาดใหม่บ่อย -> ใช้ MutationObserver ใส่ปุ่มกลับทันที
(function () {
  'use strict';

  // ---------- ตั้งค่า (ปรับตรงนี้) ----------
  var MIN = 0.5, MAX = 1.6, STEP = 0.1;   // ช่วงขนาด (1 = ขนาดเดิมของเกม)
  var KEY = 'xh_zoom_v1_';                // ที่จำขนาดที่เลือก (เก็บในเครื่อง)

  function load(k) {
    try { var v = parseFloat(localStorage.getItem(KEY + k)); if (v > 0) return v; } catch (e) {}
    return 1;
  }
  function save(k, v) { try { localStorage.setItem(KEY + k, String(v)); } catch (e) {} }

  function keyOf(el) {
    if (el.id === 'bag-win') return 'bag';
    var h = el.querySelector('.pp-head h2');
    var t = h ? (h.textContent || '').trim() : '';
    return 'pp:' + (t || el.id || 'win');
  }
  function allTargets() {
    var out = [];
    document.querySelectorAll('.pp-win').forEach(function (e) { out.push(e); });
    var b = document.getElementById('bag-win');
    if (b) out.push(b);
    return out;
  }
  function apply(el) {
    var v = load(keyOf(el));
    var str = Math.abs(v - 1) < 0.001 ? '' : String(v);
    if ((el.style.getPropertyValue('scale') || '') !== str) {
      if (str) el.style.setProperty('scale', str); else el.style.removeProperty('scale');
    }
  }

  // ---------- สไตล์ปุ่ม ----------
  function addStyle() {
    if (document.getElementById('pz-style')) return;
    var st = document.createElement('style');
    st.id = 'pz-style';
    st.textContent =
      '.pz-ctl{display:inline-flex;align-items:center;gap:3px;flex:0 0 auto;font-family:Mitr,sans-serif}' +
      '.pz-ctl button{height:26px;min-width:26px;padding:0 6px;border:2px solid #c9a24a;border-radius:6px;' +
        'background:linear-gradient(#7a1510,#3b0907);color:#ffe9b0;font:600 15px/1 Mitr,sans-serif;cursor:pointer;' +
        'touch-action:manipulation;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 1px 0 #000}' +
      '.pz-ctl button:active{filter:brightness(1.3)}' +
      '.pz-ctl .pz-v{min-width:44px;font-size:12px;background:linear-gradient(#2a1214,#150709);color:#ffd45c}' +
      // กระเป๋า: ปุ่มใหญ่ขึ้นนิดเพราะหน้าต่างถูกย่อ | แนวตั้งบีบแท็บให้มีที่พอ
      '#bag-win .pz-ctl button{height:28px;min-width:28px}' +
      '#bag-win .win-head .win-tabs{min-width:0!important}' +
      '#bag-win.bag-portrait .win-head{gap:5px!important}' +
      '#bag-win.bag-portrait .win-head .win-tabs .win-tab{padding:5px 9px!important}';
    document.head.appendChild(st);
  }

  // ---------- ใส่ปุ่มในแถบหัวหน้าต่าง ----------
  function headOf(el) {
    return el.id === 'bag-win' ? el.querySelector('.win-head') : el.querySelector('.pp-head');
  }
  function ensureCtl(el) {
    var head = headOf(el);
    if (!head) return;
    var c = head.querySelector('.pz-ctl');
    if (!c) {
      c = document.createElement('div');
      c.className = 'pz-ctl';
      c.innerHTML = '<button data-z="-" aria-label="ย่อ">−</button>' +
                    '<button class="pz-v" data-z="0" aria-label="รีเซ็ต">100%</button>' +
                    '<button data-z="+" aria-label="ขยาย">+</button>';
      var x = head.querySelector('.win-x, .pp-x');
      if (x) head.insertBefore(c, x); else head.appendChild(c);
    }
    var v = c.querySelector('.pz-v');
    var t = Math.round(load(keyOf(el)) * 100) + '%';
    if (v && v.textContent !== t) v.textContent = t;
  }

  // กระเป๋าวาดแถบหัวใหม่ทุกครั้งที่กด/รีเฟรช -> ดักแล้วใส่ปุ่มกลับทันที (ไม่กะพริบ)
  var bagObs = null, bagObsEl = null;
  function watchBag() {
    var b = document.getElementById('bag-win');
    if (!b || bagObsEl === b) return;
    if (bagObs) bagObs.disconnect();
    bagObsEl = b;
    bagObs = new MutationObserver(function () { ensureCtl(b); });
    bagObs.observe(b, { childList: true });
  }

  // ---------- การกดปุ่ม (ดักที่ document ใช้ได้กับทุกหน้าต่าง) ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.pz-ctl [data-z]');
    if (!b) return;
    var win = b.closest('#bag-win, .pp-win');
    if (!win) return;
    var k = keyOf(win), v = load(k);
    if (b.dataset.z === '-') v -= STEP;
    else if (b.dataset.z === '+') v += STEP;
    else v = 1;
    v = Math.round(Math.max(MIN, Math.min(MAX, v)) * 10) / 10;
    save(k, v);
    apply(win);
    ensureCtl(win);
  });

  function tick() {
    addStyle();
    watchBag();
    allTargets().forEach(function (el) { apply(el); ensureCtl(el); });
  }

  setInterval(tick, 250);
  window.addEventListener('resize', function () { setTimeout(tick, 100); });
})();
