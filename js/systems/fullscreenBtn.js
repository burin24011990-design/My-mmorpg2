// ===== ปุ่ม "เต็มจอ" =====
// กดแล้วเข้าโหมดเต็มจอ (ซ่อนแถบเบราว์เซอร์) ใช้ได้ทั้งแนวตั้งและแนวนอน | ซ่อนตัวเองเมื่ออยู่ในโหมดเต็มจอแล้ว
// เบราว์เซอร์อนุญาตให้เข้าเต็มจอได้เฉพาะตอนผู้เล่นแตะจอ จึงต้องมีปุ่มนี้ (เกมโหลดใหม่ตอนหมุนจอ แล้วเต็มจอหลุด)
// แนวตั้ง: อยู่ในตารางปุ่มบน (ช่อง fsBtn ใน topbar.js) | แนวนอน: อยู่ซ้ายของปุ่มเมือง ปรับที่ FS_LAND
// โหลดหลัง portraitTop.js และก่อน main.js | ใช้คู่กับ GameFS ใน index.html
(function () {
  const FS_LAND = { x: 198, y: 8, w: 46, h: 46 };   // แนวนอน (หน่วยพิกัดเกม)
  const de = document.documentElement;
  const reqFS = de.requestFullscreen || de.webkitRequestFullscreen || de.msRequestFullscreen;
  const isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const isInstalled = () => (window.matchMedia && (window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: standalone)').matches)) || window.navigator.standalone === true;
  const store = (k, v) => { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} };
  const load = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };

  function enterFS() {
    try {
      if (window.GameFS && GameFS.enter) { GameFS.enter(); return; }
      if (reqFS) reqFS.call(de, { navigationUI: 'hide' });
    } catch (e) {}
  }

  // จำว่ากำลังเล่นแบบเต็มจอ: ถ้าเกมโหลดใหม่ตอนหมุนจอ แล้วเต็มจอหลุด แตะจอครั้งแรกจะกลับเข้าเต็มจอให้เอง
  let unloading = false;
  window.addEventListener('pagehide', () => { unloading = true; });
  window.addEventListener('beforeunload', () => { unloading = true; });
  function onFsChange() {
    if (isFS()) store('xhFS', '1');
    else if (!unloading) store('xhFS', null);
  }
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  if (load('xhFS') === '1' && reqFS && !isFS() && !isInstalled()) {
    const once = () => {
      document.removeEventListener('pointerdown', once, true);
      if (!isFS()) enterFS();
    };
    document.addEventListener('pointerdown', once, true);
  }

  // ---------- ปุ่ม ----------
  let btn = null;
  function make() {
    if (btn || !document.body) return;
    btn = document.createElement('button');
    btn.id = 'btn-fs';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;line-height:1.1';
    const i = document.createElement('div'); i.className = 'hb-i'; i.textContent = '⛶';
    const t = document.createElement('div'); t.className = 'hb-t'; t.textContent = 'เต็มจอ';
    wrap.append(i, t);
    btn.appendChild(wrap);
    btn.addEventListener('click', enterFS);
    document.body.appendChild(btn);
  }

  function layout() {
    make();
    if (!btn) return;
    const cv = document.querySelector('canvas');
    const Wv = (typeof W !== 'undefined') ? W : 960;
    if (!cv || !reqFS || isFS() || isInstalled()) { btn.style.display = 'none'; return; }   // ไม่รองรับ / เต็มจออยู่แล้ว = ซ่อน
    const r = cv.getBoundingClientRect();
    if (r.width < 50) { btn.style.display = 'none'; return; }
    const k = r.width / Wv;
    const s = (window.PortraitTop && window.PortraitTop.slot('fsBtn')) || FS_LAND;
    btn.style.cssText =
      'display:block;position:fixed;z-index:9000;box-sizing:border-box;padding:0;margin:0;cursor:pointer;touch-action:manipulation;' +
      '-webkit-tap-highlight-color:transparent;font-family:Mitr,sans-serif;color:#fff;overflow:hidden;' +
      'left:' + (r.left + s.x * k) + 'px;top:' + (r.top + s.y * k) + 'px;width:' + (s.w * k) + 'px;height:' + (s.h * k) + 'px;' +
      'border:' + Math.max(1, 2 * k) + 'px solid #8a6a32;border-radius:' + (8 * k) + 'px;' +
      'background:linear-gradient(180deg,rgba(255,255,255,.16) 0,rgba(255,255,255,0) 45%),#2a4a3a;' +
      'box-shadow:0 ' + (2 * k) + 'px ' + (4 * k) + 'px rgba(0,0,0,.45);';
    const ic = btn.querySelector('.hb-i'), tx = btn.querySelector('.hb-t');
    if (ic) ic.style.cssText = 'font-size:' + (22 * k) + 'px;margin-top:' + (-2 * k) + 'px';
    if (tx) tx.style.cssText = 'font-size:' + (9 * k) + 'px;margin-top:' + (1 * k) + 'px;' +
      'text-shadow:-1px 0 #000,1px 0 #000,0 -1px #000,0 1px #000;white-space:nowrap';
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 300));
  document.addEventListener('fullscreenchange', () => setTimeout(layout, 300));
  document.addEventListener('webkitfullscreenchange', () => setTimeout(layout, 300));
  setInterval(layout, 500);
})();
