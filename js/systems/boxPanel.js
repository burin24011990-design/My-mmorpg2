// js/systems/boxPanel.js — ปุ่ม 📦 + หน้าต่างเปิดกล่องเงิน (ใช้ ServerBoxes)
(function () {
  const SB = window.ServerBoxes;
  if (!SB) return;
  const ROWS = [
    { k: 'blue', name: 'กล่องฟ้า', c: '#4aa3ff' },
    { k: 'red',  name: 'กล่องแดง', c: '#ff5a5a' },
    { k: 'gold', name: 'กล่องทอง', c: '#ffd45c' }
  ];
  const MAX_SETS = 10;
  let busy = false, timer = null;

  const st = document.createElement('style');
  st.textContent =
    '#box-btn{position:fixed;left:8px;top:96px;z-index:9000;width:44px;height:44px;border-radius:10px;' +
    'background:#26090f;border:2px solid #ffd45c;font-size:22px;display:none;align-items:center;justify-content:center;' +
    'cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}' +
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

  // โชว์ปุ่มเฉพาะตอนเข้าเกมแล้ว
  setInterval(function () { btn.style.display = window.__mainScene ? 'flex' : 'none'; }, 1000);
})();
