// ===== เชื่อมระบบการ์ดเข้าหน้าต่างกระเป๋า (ไม่ต้องแก้ bagWindow.js) =====
// แก้: ช่องใส่การ์ดในรายละเอียดอุปกรณ์หาย + รูป/รายละเอียดการ์ดไม่ขึ้น
// สาเหตุ: bagWindow.js ไม่ได้เรียก CardUI (จาก cards.js) เลย จึงไม่มีช่องการ์ด และการ์ดถูกแสดงเป็นรายละเอียดอุปกรณ์/กล่อง
// ไฟล์นี้คอยดูหน้าต่างกระเป๋า แล้วเติมให้เมื่อวาดเสร็จ:
//   1) รายละเอียดอุปกรณ์: เติมแถบ "🃏 ช่องการ์ด" (แตะช่องเพื่อใส่/ถอด)
//   2) รายละเอียดการ์ด/กุญแจ: แทนที่ด้วยหน้าตาของการ์ดพร้อมรูปเต็ม (แตะรูปเพื่อขยาย)
//   3) ช่องในตาราง: การ์ดขึ้นจำนวน xN | อุปกรณ์ขึ้นสัญลักษณ์ช่องการ์ด ○●
// ต้องโหลดหลัง bagWindow.js และ cards.js (วางไว้ท้ายสุดก่อน main.js ได้เลย)
(function () {
  'use strict';
  const sc = () => window.__mainScene;
  const UI = () => window.CardUI;

  // อ่านว่าตอนนี้เลือกช่องไหนอยู่ในหน้าต่างกระเป๋า
  function selected() {
    const win = document.getElementById('bag-win'), s = sc();
    if (!win || !s) return null;
    const c = win.querySelector('button.cell.sel[data-act]');
    if (!c) return null;
    if (c.dataset.act === 'sel-bag') { const id = Number(c.dataset.id); return { src: 'bag', id: id, it: s.bag[id] }; }
    if (c.dataset.act === 'sel-equip') { const id = c.dataset.id; return { src: 'equip', id: id, it: s.equipment[id] }; }
    return null;
  }

  function decorate(force) {
    queued = false;
    const win = document.getElementById('bag-win'), s = sc(), ui = UI();
    if (!win || !s || !ui || win.style.display === 'none') return;

    // 3) ช่องในตาราง
    win.querySelectorAll('button.cell[data-act="sel-bag"], button.cell[data-act="sel-equip"]').forEach(function (c) {
      const it = c.dataset.act === 'sel-bag' ? s.bag[Number(c.dataset.id)] : s.equipment[c.dataset.id];
      if (!it) return;
      if ((it.kind === 'card' || it.kind === 'cardkey') && it.count > 1 && !c.querySelector('.cnt')) {
        const sp = document.createElement('span'); sp.className = 'cnt'; sp.textContent = 'x' + it.count; c.appendChild(sp);
      }
      if (it.kind === 'equip' && !c.querySelector('.sk')) {
        const p = ui.pips(it);
        if (p) { const sp = document.createElement('span'); sp.className = 'sk'; sp.textContent = p; c.appendChild(sp); }
      }
    });

    // 1) และ 2) แผงรายละเอียด
    const sel = selected(), right = win.querySelector('.win-right');
    if (!sel || !sel.it || !right) return;
    const it = sel.it;

    if (it.kind === 'card' || it.kind === 'cardkey') {
      if (force || !right.querySelector('[data-cd]')) {
        right.innerHTML = '<div data-cd="1">' + ui.itemDetailHTML(it) + '</div>';
      }
      return;
    }

    if (it.kind === 'equip') {
      const sig = JSON.stringify([it.tier || '', it.sockets || null]);
      let wrap = right.querySelector('.cs-wrap');
      if (wrap && !force && wrap.dataset.sig === sig) return;
      if (wrap) wrap.remove();
      const tmp = document.createElement('div');
      tmp.innerHTML = ui.socketsHTML(it);
      wrap = tmp.firstElementChild;
      if (!wrap) return;
      wrap.dataset.sig = sig;
      const actions = right.querySelector('.d-actions');
      if (actions) right.insertBefore(wrap, actions); else right.appendChild(wrap);
    }
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { decorate(false); });
  }

  // cards.js เรียกหลังโหลดรูปเสร็จ / ใส่-ถอดการ์ดเสร็จ เพื่อวาดแผงรายละเอียดใหม่
  window.BagWindowRefresh = function () { decorate(true); };

  // แตะช่องการ์ด = เปิดหน้าต่างใส่/ถอด (bagWindow.js วาดหน้าต่างใหม่หลังแตะ จึงอ่านช่องที่เลือกจากหน้าจอ)
  document.addEventListener('click', function (e) {
    const b = e.target && e.target.closest && e.target.closest('.cs-slot');
    if (!b || !UI()) return;
    const sel = selected();
    if (!sel || !sel.it || sel.it.kind !== 'equip') return;
    UI().openSocket(sc(), sel.src, sel.id, Number(b.dataset.id));
  });


  // (การจัดกระเป๋าไม่ให้การ์ดรวมกัน ย้ายไปอยู่ใน cards.js แล้ว)

  (function watch() {
    const layer = document.getElementById('ui-layer');
    if (!layer) return setTimeout(watch, 500);
    new MutationObserver(schedule).observe(layer, { childList: true, subtree: true });
  })();
})();
