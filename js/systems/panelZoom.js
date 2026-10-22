// ===== ปุ่ม − / + ย่อ-ขยายหน้าต่าง กระเป๋า / สกิล / อุปกรณ์ =====
// ไม่ต้องแก้ไฟล์เดิม: ใช้คุณสมบัติ CSS "scale" (แยกจาก transform ที่ไฟล์เดิมใช้อยู่)
// ต้องโหลดหลัง bagWindow.js และ pixelPanels.js (วางก่อน main.js ได้เลย)
// v2: ปุ่มย้ายเข้าไปอยู่ในแถบหัวหน้าต่าง (ซ้ายของปุ่ม ✕) แทนการลอยอยู่เหนือหน้าต่าง
(function () {
  'use strict';

  // ---------- ตั้งค่า (ปรับตรงนี้) ----------
  var MIN = 0.5, MAX = 1.6, STEP = 0.1;   // ช่วงขนาด (1 = ขนาดเดิมของเกม)
  var BTN = 24;                           // ขนาดปุ่ม (px)
  var GAP_X = 8;                          // ระยะห่างจากปุ่ม ✕ (px)
  var KEY = 'xh_zoom_v1_';                // ที่จำขนาดที่เลือก (เก็บในเครื่อง)

  var bar = null, cur = null, curKey = '';

  function load(k) {
    try { var v = parseFloat(localStorage.getItem(KEY + k)); if (v > 0) return v; } catch (e) {}
    return 1;
  }
  function save(k, v) { try { localStorage.setItem(KEY + k, String(v)); } catch (e) {} }

  function visible(el) {
    if (!el) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    var r = el.getBoundingClientRect();
    return r.width > 20 && r.height > 20;
  }
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

  // หาปุ่มปิด (✕) ของหน้าต่าง ใช้เป็นจุดอ้างอิงวางปุ่ม − + ไว้ซ้ายของมัน
  function findClose(el) {
    if (el._pzClose && el._pzClose.isConnected) return el._pzClose;
    var c = null;
    try {
      c = el.querySelector('.pp-x,[aria-label*="ปิด"],[class*="close" i],[id*="close" i]');
    } catch (e) { c = null; }
    if (!c) {
      var bs = el.querySelectorAll('button,div,span');
      for (var i = 0; i < bs.length; i++) {
        if (/^[✕✖×xX]$/.test((bs[i].textContent || '').trim())) { c = bs[i]; break; }
      }
    }
    el._pzClose = c;
    return c;
  }

  // ---------- แถบปุ่ม ----------
  function build() {
    if (bar) return;
    var st = document.createElement('style');
    st.textContent =
      '#pz-bar{position:fixed;z-index:100000;display:none;align-items:center;gap:4px;font-family:Mitr,sans-serif}' +
      '#pz-bar button{height:' + BTN + 'px;min-width:' + BTN + 'px;border:2px solid #c9a24a;background:linear-gradient(#7a1510,#3b0907);color:#ffe9b0;font-size:14px;border-radius:4px;cursor:pointer;padding:0 5px;line-height:1;font-family:inherit}' +
      '#pz-bar button:active{filter:brightness(1.3)}' +
      '#pz-bar .pz-v{font-size:11px;min-width:40px}';
    document.head.appendChild(st);

    bar = document.createElement('div');
    bar.id = 'pz-bar';
    bar.innerHTML = '<button data-z="-" aria-label="ย่อ">−</button><button class="pz-v" data-z="0" aria-label="รีเซ็ต">100%</button><button data-z="+" aria-label="ขยาย">+</button>';
    document.body.appendChild(bar);

    ['pointerdown', 'touchstart', 'mousedown'].forEach(function (evn) {
      bar.addEventListener(evn, function (e) { e.stopPropagation(); }, { passive: true });
    });
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-z]');
      if (!b || !cur) return;
      var v = load(curKey);
      if (b.dataset.z === '-') v -= STEP;
      else if (b.dataset.z === '+') v += STEP;
      else v = 1;
      v = Math.round(Math.max(MIN, Math.min(MAX, v)) * 10) / 10;
      save(curKey, v);
      apply(cur);
      place();
    });
  }

  // วางปุ่มในแถบหัวหน้าต่าง: ซ้ายของปุ่ม ✕ และกึ่งกลางแนวตั้งเดียวกัน
  function place() {
    if (!bar || !cur) return;
    var r = cur.getBoundingClientRect();
    var bw = bar.offsetWidth || 100;
    var left, top;
    var x = findClose(cur);
    var xr = x ? x.getBoundingClientRect() : null;
    if (xr && xr.width > 0) {
      left = xr.left - bw - GAP_X;
      top = xr.top + (xr.height - BTN) / 2;
    } else {                                   // หาปุ่มปิดไม่เจอ: วางมุมขวาบนของหน้าต่าง
      left = r.right - bw - 48;
      top = r.top + 8;
    }
    left = Math.max(r.left + 4, Math.min(left, window.innerWidth - bw - 2));
    top = Math.max(2, top);
    bar.style.left = Math.round(left) + 'px';
    bar.style.top = Math.round(top) + 'px';
    var v = bar.querySelector('.pz-v');
    var t = Math.round(load(curKey) * 100) + '%';
    if (v && v.textContent !== t) v.textContent = t;
  }

  function tick() {
    build();
    var list = allTargets();
    list.forEach(apply);
    var active = null;
    // หน้าต่างสกิล/อุปกรณ์ที่เปิดอยู่มาก่อน แล้วค่อยกระเป๋า
    for (var i = 0; i < list.length; i++) {
      if (visible(list[i])) { active = list[i]; if (list[i].id !== 'bag-win') break; }
    }
    if (active) {
      cur = active; curKey = keyOf(active);
      bar.style.display = 'flex';
      place();
    } else {
      cur = null;
      bar.style.display = 'none';
    }
  }

  setInterval(tick, 150);
  window.addEventListener('resize', function () { setTimeout(tick, 100); });
})();
