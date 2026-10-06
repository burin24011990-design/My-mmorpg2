// js/systems/boxPanel.js — ปุ่ม 📦 + หน้าต่างเปิดกล่องเงิน (ใช้ ServerBoxes)
// + จัดตำแหน่ง: กล่องอยู่ข้างปุ่ม "จุติ" / ปุ่มยา ATK DEF HP+ เรียงมุมซ้ายล่าง
(function () {
  const SB = window.ServerBoxes;
  if (!SB) return;
  const ROWS = [
    { k: 'blue', name: 'กล่องฟ้า', c: '#4aa3ff' },
    { k: 'red',  name: 'กล่องแดง', c: '#ff5a5a' },
    { k: 'gold', name: 'กล่องทอง', c: '#ffd45c' }
  ];
  const MAX_SETS = 10;
  const POTION_SCALE = 0.6;   // ขนาดปุ่มยา (1 = เดิม, ยิ่งน้อยยิ่งเล็ก)
  const POTION_GAP = 8;       // ระยะห่างระหว่างปุ่มยา (px)
  const POTION_EDGE = 8;      // ระยะจากขอบซ้าย/ล่าง (px)
  const BOX_GAP = 8;          // ระยะห่างปุ่มกล่องกับปุ่มจุติ (px)
  let busy = false, timer = null;

  const st = document.createElement('style');
  st.textContent =
    '#box-btn{position:fixed;left:8px;top:96px;z-index:9000;width:44px;height:44px;border-radius:10px;' +
    'background:#26090f;border:2px solid #ffd45c;font-size:22px;display:none;align-items:center;justify-content:center;' +
    'cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;box-sizing:border-box}' +
    '#box-btn img{max-width:80%;max-height:80%;object-fit:contain}' +
    '#box-panel{position:fixed;left:60px;top:60px;z-index:9001;width:300px;max-width:70vw;display:none;' +
    'background:rgba(20,8,12,.95);border:2px solid #ffd45c;border-radius:12px;padding:10px;color:#fff;' +
    'font-family:Mitr,sans-serif;font-size:14px;touch-action:manipulation}' +
    '#box-panel h3{margin:0 0 8px;font-size:16px;color:#ffe28a;display:flex;justify-content:space-between}' +
    '#box-panel .x{cursor:pointer;padding:0 6px}' +
    '#box-panel .r{display:flex;align-items:center;gap:6px;margin:6px 0}' +
    '#box-panel .n{flex:1}#box-panel .n b{display:block}#box-panel .n small{color:#aaa}' +
    '#box-panel button{font-family:inherit;font-size:13px;padding:6px 8px;border-radius:8px;border:1px solid #ffd45c;' +
    'background:#3a0f18;color:#ffe28a}' +
    '#box-panel button:disabled{opacity:.35}';
  document.head.appendChild(st);

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
    panel.style.display = 'block'; render();
    SB.refresh().then(render).catch(function () {});
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

  // ---------- ปุ่มกล่อง: วางข้างปุ่ม "จุติ" ----------
  function findJuti() {
    const leaves = findLeaves(/^จุติ$/);
    for (let i = 0; i < leaves.length; i++) {
      let n = leaves[i];
      while (n.parentElement && n.parentElement !== document.body) {
        const r = n.parentElement.getBoundingClientRect();
        if (r.width > 140 || r.height > 140) break;
        n = n.parentElement;
      }
      const rr = n.getBoundingClientRect();
      if (rr.width >= 40 && rr.width <= 140 && rr.height >= 40) return n;
    }
    return null;
  }

  // ===== ปุ่มกล่อง: วางต่อท้ายแถวปุ่ม เมือง / CH1-1 / จุติ =====
  // ปรับ 3 ค่านี้ให้ตรงกับเกม (หน่วยเป็น px ของหน้าจอ CSS)
  const BOX_SIZE = 44;      // ขนาดปุ่มกล่อง (ให้เท่าปุ่มจุติ)
  const BOX_LEFT_PX = 0;    // ถ้าอยากขยับซ้าย/ขวาเพิ่ม ใส่ค่าบวก/ลบ
  const BOX_TOP_PX = 0;     // ถ้าอยากขยับขึ้น/ลงเพิ่ม

  function placeBox() {
    const sc = window.__mainScene;
    const canvas = document.querySelector('canvas');
    if (!sc || !canvas) return;
    const cr = canvas.getBoundingClientRect();
    const k = cr.width / (sc.scale ? sc.scale.width : cr.width);   // อัตราส่วนแคนวาสเทียบหน้าจอ

    // ตำแหน่งปุ่มจุติในเกม (ปุ่มที่ 3 ของแถวบน: เมือง, CH1-1, จุติ)
    const jx = 747 / 2412 * cr.width + cr.left;   // กลางปุ่มจุติ
    const jy = 55 / 1080 * cr.height + cr.top;    // กลางแนวตั้งของปุ่ม
    const size = Math.round(88 / 2412 * cr.width);

    const left = Math.round(jx + size / 2 + 8 + BOX_LEFT_PX);
    const top = Math.round(jy - size / 2 + BOX_TOP_PX);
    setImp(btn, 'position', 'fixed');
    setImp(btn, 'left', left + 'px');
    setImp(btn, 'top', top + 'px');
    setImp(btn, 'right', 'auto');
    setImp(btn, 'bottom', 'auto');
    setImp(btn, 'width', size + 'px');
    setImp(btn, 'height', size + 'px');
    setImp(btn, 'margin', '0');
    setImp(btn, 'font-size', Math.round(size * 0.5) + 'px');
    panel.style.left = left + 'px';
    panel.style.top = (top + size + 8) + 'px';
  }

  // ---------- ปุ่มยา ATK / DEF / HP+ : เรียงแนวนอนมุมซ้ายล่าง ----------
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
      if (others.some(function (o) { return o.test(txt.replace(/\s/g, '')) ; })) break;
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

  function placePotions() {
    if (!potionEls || potionEls.some(function (e) { return !e.isConnected; })) {
      potionEls = locatePotions();
      if (!potionEls) return;
    }
    let x = POTION_EDGE;
    potionEls.forEach(function (el) {
      const w = el.offsetWidth || 100;
      setImp(el, 'position', 'fixed');
      setImp(el, 'left', 'calc(env(safe-area-inset-left, 0px) + ' + Math.round(x) + 'px)');
      setImp(el, 'bottom', 'calc(env(safe-area-inset-bottom, 0px) + ' + POTION_EDGE + 'px)');
      setImp(el, 'top', 'auto');
      setImp(el, 'right', 'auto');
      setImp(el, 'margin', '0');
      setImp(el, 'transform', 'scale(' + POTION_SCALE + ')');
      setImp(el, 'transform-origin', 'left bottom');
      x += w * POTION_SCALE + POTION_GAP;
    });
  }

  function place() { placeBox(); placePotions(); }

  // โชว์ปุ่มเฉพาะตอนเข้าเกมแล้ว
  setInterval(function () {
    btn.style.display = window.__mainScene ? 'flex' : 'none';
    if (window.__mainScene) place();
  }, 1000);
  window.addEventListener('resize', function () { setTimeout(place, 300); });
})();
