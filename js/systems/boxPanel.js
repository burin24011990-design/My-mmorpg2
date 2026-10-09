// js/systems/boxPanel.js — ปุ่ม 📦 + หน้าต่างเปิดกล่องเงิน (ใช้ ServerBoxes)
// + จัดตำแหน่ง: กล่องอยู่ข้างปุ่ม "จุติ" / ปุ่มยา ATK DEF HP+ / ปุ่มยา HP % แยกตำแหน่ง แนวนอน-แนวตั้ง
// วิธีจัดตำแหน่งปุ่มยา: เขียนเป็นกฎ CSS (!important) ลงใน <style id="pot-pos">
// ชนะ inline style ของไฟล์อื่น (เช่น shop.js) -> ปุ่มไม่วิ่งสลับไปมาอีก
(function () {
  const SB = window.ServerBoxes;
  if (!SB) return;
  const ROWS = [
    { k: 'blue', name: 'กล่องฟ้า', c: '#4aa3ff' },
    { k: 'red',  name: 'กล่องแดง', c: '#ff5a5a' },
    { k: 'gold', name: 'กล่องทอง', c: '#ffd45c' }
  ];
  const MAX_SETS = 10;
  const BOX_GAP = 8;          // ระยะห่างปุ่มกล่องกับปุ่มจุติ (px)

  // ===== ตำแหน่งปุ่มยา แยกตามแนวจอ (ปรับเลขตรงนี้ได้เลย) =====
  // left/right/bottom = ระยะจากขอบ (px) | scale = ขนาด (1 = เดิม) | gap = ระยะห่างระหว่างปุ่ม
  const POT_CFG = {
    landscape: {
      hp:   { right: 8, bottom: 190, scale: 0.6 },            // ปุ่ม HP 20% (ยกขึ้นให้พ้นปุ่มสกิล)
      pots: { left: 8,  bottom: 8,   gap: 8, scale: 0.6 }     // ATK DEF HP+
    },
    portrait: {
      hp:   { right: 8, bottom: 160, scale: 0.6 },
      pots: { left: 8,  bottom: 160, gap: 8, scale: 0.6 }
    }
  };
  function orient() { return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'; }

  // ----- ค่าสำหรับปุ่มกล่อง จอแนวตั้ง (ปรับได้) -----
  const BOX_SIZE_PORTRAIT = 40;   // ขนาดปุ่มกล่อง (px)
  const PORTRAIT_CX = 0.463;      // กึ่งกลางปุ่มในแนวนอน (สัดส่วนความกว้างแคนวาส) เพิ่ม = ขวา
  const PORTRAIT_Y = 0.178;       // ขอบบนของปุ่มในแนวตั้ง (สัดส่วนความสูงแคนวาส) เพิ่ม = ลงล่าง
  const PANEL_W_LANDSCAPE = 300;
  const PANEL_W_PORTRAIT = 340;

  let busy = false, timer = null;

  const st = document.createElement('style');
  st.textContent =
    '#box-btn{position:fixed;left:8px;top:96px;z-index:9000;width:44px;height:44px;border-radius:10px;' +
    'background:#26090f;border:2px solid #ffd45c;font-size:22px;display:none;align-items:center;justify-content:center;' +
    'cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;box-sizing:border-box}' +
    '#box-btn img{max-width:80%;max-height:80%;object-fit:contain}' +
    '#box-panel{position:fixed;left:60px;top:60px;z-index:9001;width:300px;max-width:calc(100vw - 16px);display:none;' +
    'box-sizing:border-box;background:rgba(20,8,12,.95);border:2px solid #ffd45c;border-radius:12px;padding:10px;color:#fff;' +
    'font-family:Mitr,sans-serif;font-size:14px;touch-action:manipulation}' +
    '#box-panel h3{margin:0 0 8px;font-size:16px;color:#ffe28a;display:flex;justify-content:space-between}' +
    '#box-panel .x{cursor:pointer;padding:0 6px}' +
    '#box-panel .r{display:flex;align-items:center;gap:6px;margin:6px 0}' +
    '#box-panel .n{flex:1;min-width:0}#box-panel .n b{display:block}#box-panel .n small{color:#aaa}' +
    '#box-panel button{font-family:inherit;font-size:13px;padding:6px 8px;border-radius:8px;border:1px solid #ffd45c;' +
    'background:#3a0f18;color:#ffe28a;white-space:nowrap}' +
    '#box-panel button:disabled{opacity:.35}' +
    '@media (orientation:portrait){' +
      '#box-panel{font-size:15px;padding:12px}' +
      '#box-panel h3{font-size:18px}' +
      '#box-panel .r{gap:8px;margin:10px 0}' +
      '#box-panel button{font-size:14px;padding:9px 10px;min-height:40px}' +
    '}';
  document.head.appendChild(st);

  // สไตล์ชีตสำหรับตำแหน่งปุ่มยา (เขียนใหม่ทุกครั้งที่ place())
  const potSheet = document.createElement('style');
  potSheet.id = 'pot-pos';
  document.head.appendChild(potSheet);

  const btn = document.createElement('div');
  btn.id = 'box-btn'; btn.textContent = '📦';
  const panel = document.createElement('div');
  panel.id = 'box-panel';
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  // กันไม่ให้ทัชทะลุไปโดนเกม
  ['pointerdown', 'touchstart', 'mousedown'].forEach(function (ev) {
    btn.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true });
    panel.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true });
  });

  function render() {
    let h = '<h3><span>📦 กล่องเงิน</span><span class="x" id="bx-close">✕</span></h3>';
    ROWS.forEach(function (r) {
      const have = SB.boxes[r.k] || 0, need = SB.need[r.k] || 1;
      const sets = Math.floor(have / need);
      h += '<div class="r"><div class="n"><b style="color:' + r.c + '">' + r.name + '</b>' +
           '<small>' + have + ' ใบ (ชุดละ ' + need + ')</small></div>' +
           '<button data-k="' + r.k + '" data-s="1"' + (sets < 1 ? ' disabled' : '') + '>เปิด 1 ชุด</button>' +
           '<button data-k="' + r.k + '" data-s="' + Math.min(sets, MAX_SETS) + '"' + (sets < 2 ? ' disabled' : '') + '>เปิดสูงสุด</button></div>';
    });
    if (!window.firebase || !firebase.auth().currentUser || firebase.auth().currentUser.isAnonymous)
      h += '<small style="color:#f88">ต้องล็อกอินด้วย Google จึงจะได้กล่อง</small>';
    panel.innerHTML = h;
  }

  panel.addEventListener('click', function (e) {
    if (e.target.id === 'bx-close') return close();
    const k = e.target.getAttribute && e.target.getAttribute('data-k');
    if (!k || busy) return;
    busy = true;
    SB.open(k, Number(e.target.getAttribute('data-s')) || 1)
      .then(function () { return SB.refresh(); })
      .catch(function () {})
      .then(function () { busy = false; render(); });
  });

  function open() {
    panel.style.display = 'block'; render(); place();
    SB.refresh().then(render).catch(function () {});
    clearInterval(timer);
    timer = setInterval(render, 2000);
  }
  function close() { panel.style.display = 'none'; clearInterval(timer); }
  btn.addEventListener('click', function () { panel.style.display === 'block' ? close() : open(); });

  // ===== ค้นหา element จากข้อความบนจอ =====
  function setImp(el, prop, val) { el.style.setProperty(prop, val, 'important'); }

  function findLeaves(re) {
    const out = [];
    const all = document.querySelectorAll('body *');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el === btn || panel.contains(el) || btn.contains(el)) continue;
      if (el.children.length === 0 && re.test((el.textContent || '').trim())) out.push(el);
    }
    return out;
  }

  // ===== ปุ่มกล่อง: วางต่อท้ายแถวปุ่ม เมือง / CH1-1 / จุติ (แนวนอน) =====
  const BOX_SIZE = 44;      // ขนาดปุ่มกล่อง (ให้เท่าปุ่มจุติ)
  const BOX_LEFT_PX = 0;    // ขยับซ้าย/ขวาเพิ่ม ใส่ค่าบวก/ลบ
  const BOX_TOP_PX = 0;     // ขยับขึ้น/ลงเพิ่ม

  function placeBox() {
    const sc = window.__mainScene;
    const canvas = document.querySelector('canvas');
    if (!sc || !canvas) return;
    const cr = canvas.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const portrait = vh > vw;

    let left, top, size, pw;

    if (portrait) {
      size = BOX_SIZE_PORTRAIT;
      left = Math.round(cr.left + PORTRAIT_CX * cr.width - size / 2);
      top = Math.round(cr.top + PORTRAIT_Y * cr.height);
      pw = Math.min(PANEL_W_PORTRAIT, vw - 16);
    } else {
      // ตำแหน่งปุ่มจุติในเกม (ปุ่มที่ 3 ของแถวบน: เมือง, CH1-1, จุติ)
      const jx = 747 / 2412 * cr.width + cr.left;   // กลางปุ่มจุติ
      const jy = 55 / 1080 * cr.height + cr.top;    // กลางแนวตั้งของปุ่ม
      size = Math.max(BOX_SIZE, Math.round(88 / 2412 * cr.width));
      left = Math.round(jx + size / 2 + BOX_GAP + BOX_LEFT_PX);
      top = Math.round(jy - size / 2 + BOX_TOP_PX);
      pw = Math.min(PANEL_W_LANDSCAPE, vw - 16);
    }

    setImp(btn, 'position', 'fixed');
    setImp(btn, 'left', left + 'px');
    setImp(btn, 'top', top + 'px');
    setImp(btn, 'right', 'auto');
    setImp(btn, 'bottom', 'auto');
    setImp(btn, 'width', size + 'px');
    setImp(btn, 'height', size + 'px');
    setImp(btn, 'margin', '0');
    setImp(btn, 'font-size', Math.round(size * 0.5) + 'px');

    // แผง: ไม่ให้ล้นขอบจอ
    let pl = portrait ? Math.round((vw - pw) / 2) : left;
    pl = Math.max(8, Math.min(pl, vw - pw - 8));
    panel.style.width = pw + 'px';
    panel.style.left = pl + 'px';
    panel.style.top = (top + size + 8) + 'px';
  }

  // ---------- ปุ่มยา ATK / DEF / HP+ ----------
  const POTION_LABELS = [/^ATK$/, /^DEF$/, /^HP\+$/];
  let potionEls = null;

  function findPotionSlot(re, others) {
    const leaves = findLeaves(re);
    if (!leaves.length) return null;
    let n = leaves[0];
    while (n.parentElement && n.parentElement !== document.body) {
      const p = n.parentElement;
      if (p.offsetWidth > 160 || p.offsetHeight > 160) break;
      const txt = (p.textContent || '');
      if (others.some(function (o) { return o.test(txt.replace(/\s/g, '')); })) break;
      n = p;
    }
    return n;
  }

  function locatePotions() {
    const els = POTION_LABELS.map(function (re, i) {
      const others = POTION_LABELS.filter(function (_, k) { return k !== i; });
      return findPotionSlot(re, others.map(function (o) {
        // ใช้ตรวจว่าข้อความของ parent มีป้ายของช่องอื่นปนอยู่
        return new RegExp(o.source.replace(/^\^|\$$/g, ''));
      }));
    });
    return els.every(Boolean) ? els : null;
  }

  // คืนค่าเป็นกฎ CSS (ข้อความ) ไม่แก้ inline style
  function potionRules() {
    if (!potionEls || potionEls.some(function (e) { return !e.isConnected; })) {
      potionEls = locatePotions();
      if (!potionEls) return '';
    }
    const c = POT_CFG[orient()].pots;
    let x = c.left, css = '';
    potionEls.forEach(function (el, i) {
      el.setAttribute('data-pot', String(i));
      const w = el.offsetWidth || 100;
      css += '[data-pot="' + i + '"]{' +
        'position:fixed!important;' +
        'left:calc(env(safe-area-inset-left,0px) + ' + Math.round(x) + 'px)!important;' +
        'bottom:calc(env(safe-area-inset-bottom,0px) + ' + c.bottom + 'px)!important;' +
        'top:auto!important;right:auto!important;margin:0!important;' +
        'transform:scale(' + c.scale + ')!important;transform-origin:left bottom!important}';
      x += w * c.scale + c.gap;
    });
    return css;
  }

  // ---------- ปุ่มยาเพิ่มเลือด "HP 20%" ----------
  const HP_POT_RE = /^HP\s*\d+\s*%$/;
  let hpPotEl = null;

  function locateHpPotion() {
    const byId = document.getElementById('potion-quick-r');
    if (byId) return byId;
    const leaves = findLeaves(HP_POT_RE);
    if (!leaves.length) return null;
    let n = leaves[0];
    while (n.parentElement && n.parentElement !== document.body) {
      const p = n.parentElement;
      if (p.offsetWidth > 200 || p.offsetHeight > 200) break;
      n = p;
    }
    return n;
  }

  function hpPotionRules() {
    if (!hpPotEl || !hpPotEl.isConnected) {
      hpPotEl = locateHpPotion();
      if (!hpPotEl) return '';
    }
    const c = POT_CFG[orient()].hp;
    hpPotEl.setAttribute('data-hp-pot', '1');
    return '[data-hp-pot="1"]{' +
      'position:fixed!important;' +
      'right:calc(env(safe-area-inset-right,0px) + ' + c.right + 'px)!important;' +
      'bottom:calc(env(safe-area-inset-bottom,0px) + ' + c.bottom + 'px)!important;' +
      'left:auto!important;top:auto!important;margin:0!important;' +
      'transform:scale(' + c.scale + ')!important;transform-origin:right bottom!important}';
  }

  function place() {
    placeBox();
    const css = potionRules() + hpPotionRules();
    if (potSheet.textContent !== css) potSheet.textContent = css;
  }

  // โชว์ปุ่มเฉพาะตอนเข้าเกมแล้ว
  setInterval(function () {
    btn.style.display = window.__mainScene ? 'flex' : 'none';
    if (window.__mainScene) place();
  }, 1000);
  window.addEventListener('resize', function () { setTimeout(place, 300); });
  window.addEventListener('orientationchange', function () { setTimeout(place, 400); });
})();
