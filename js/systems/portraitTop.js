// ===== จัดปุ่มแถบบนสำหรับแนวตั้ง (แนวนอนไม่ทำอะไรเลย) =====
// โหลดหลัง shop.js และก่อน main.js (ดูลำดับใน index.html)
// 1) shop.js เขียน setupTopBar ใหม่เองเป็นแถวเดียว 8 ปุ่ม จึงล้นจอแนวตั้ง -> ที่นี่ดักการสร้างปุ่มแล้วย้ายเข้าตารางใน topbar.js (PortraitTop)
// 2) ปุ่ม "จุติ" เป็นปุ่ม DOM จากไฟล์อื่น -> ค้นหาจากข้อความแล้วย้ายเข้าช่องที่จองไว้ (rebirthBtn)
(function () {
  const P = Main.prototype;
  const isP = () => !!(window.PortraitTop && window.PortraitTop.is());

  // ---------- 1) ปุ่มในแคนวาส ----------
  const KEY_BY_ICON = {
    tb_bag: 'bagBtn', tb_scroll: 'bookBtn', tb_bot: 'autoBtn', tb_gear: 'botCfgBtn',
    tb_shield: 'equipBtn', tb_map: 'stageBtn', tb_chart: 'statusBtn', tb_shop: 'shopBtn', tb_cash: 'cashBtn',
  };
  const _setup = P.setupTopBar;
  P.setupTopBar = function () {
    if (!isP()) return _setup.apply(this, arguments);
    const orig = this.makeTopBtn;                     // ฟังก์ชันของ prototype (topbar.js)
    this.makeTopBtn = function (x, y, w, h, iconKey, label, color, onClick, big) {
      const key = KEY_BY_ICON[iconKey], s = key && window.PortraitTop.slot(key);
      if (s) return orig.call(this, s.x, s.y, s.w, s.h, iconKey, label, color, onClick, key === 'stageBtn');
      return orig.call(this, x, y, w, h, iconKey, label, color, onClick, big);
    };
    try { return _setup.apply(this, arguments); }
    finally { delete this.makeTopBtn; }               // คืนให้ใช้ของ prototype ตามเดิม
  };

  // ---------- 2) ปุ่ม DOM (เมือง / CH / สังคม / เสียง / จุติ) + กรอบปาร์ตี้ ----------
  // ไฟล์เจ้าของปุ่ม (town.js, social.js, music.js, จุติ) เขียนตำแหน่งทับทุกครึ่งวินาที
  // -> ที่นี่ดักการเปลี่ยน style แล้วย้ายกลับเข้าช่องในตารางทันที (ไม่กะพริบ) ทำเฉพาะแนวตั้ง
  function findText(re) {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    while (w.nextNode()) {
      const n = w.currentNode;
      if (re.test((n.nodeValue || '').trim())) return n.parentElement;
    }
    return null;
  }
  function locateByText(re) {
    const l = findText(re);
    if (!l) return null;
    let n = l;
    while (n.parentElement && n.parentElement !== document.body) {
      const r = n.parentElement.getBoundingClientRect();
      if (r.width > 140 || r.height > 140) break;
      n = n.parentElement;
    }
    return n;
  }
  // slot: ชื่อช่องใน PortraitTop | top: ถ้าระบุ = ย้ายเฉพาะแนวตั้ง (หน่วยพิกัดเกม) ไม่ยุ่งเรื่องขนาด
  const ITEMS = [
    { find: () => document.getElementById('btn-to-town'), slot: 'townBtn' },
    { find: () => document.getElementById('btn-ch'),      slot: 'chBtn' },
    { find: () => document.getElementById('btn-social'),  slot: 'socialBtn' },
    { find: () => document.getElementById('btn-sound'),   slot: 'soundBtn' },
    { find: () => locateByText(/^จุติ$/),                  slot: 'rebirthBtn', slow: true },
    { find: () => document.getElementById('party-hud'),   top: 242 },   // กรอบปาร์ตี้ลงมาอยู่ใต้มินิแมป
  ];
  ITEMS.forEach(it => { it.el = null; it.obs = null; it.busy = false; it.n = 0; });

  function applyItem(it) {
    const el = it.el;
    if (!el || !el.isConnected) return;
    const cv = document.querySelector('canvas');
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    if (r.width < 50) return;
    const k = r.width / W;
    const want = {};
    if (it.slot) {
      const s = window.PortraitTop.slot(it.slot);
      if (!s) return;
      want.position = 'fixed';
      want.left = (r.left + s.x * k) + 'px';
      want.top = (r.top + s.y * k) + 'px';
      want.width = (s.w * k) + 'px';
      want.height = (s.h * k) + 'px';
      want['box-sizing'] = 'border-box';
      want.overflow = 'hidden';
      want.margin = '0';
    } else {
      want.top = (r.top + it.top * k) + 'px';
    }
    it.busy = true;
    Object.keys(want).forEach(p => {
      if (el.style.getPropertyValue(p) !== want[p] || el.style.getPropertyPriority(p) !== 'important') {
        el.style.setProperty(p, want[p], 'important');
      }
    });
    it.busy = false;
    if (it.obs) it.obs.takeRecords();                 // ทิ้งบันทึกการเปลี่ยนแปลงที่เราทำเอง กันวนซ้ำ
  }

  function tick() {
    if (!isP()) return;
    ITEMS.forEach(it => {
      if (!it.el || !it.el.isConnected) {
        if (it.slow && (it.n++ % 5)) return;          // ค้นหาจากข้อความไม่ต้องทำถี่
        it.el = it.find();
        if (it.obs) { it.obs.disconnect(); it.obs = null; }
        if (it.el) {
          it.obs = new MutationObserver(() => { if (!it.busy) applyItem(it); });
          it.obs.observe(it.el, { attributes: true, attributeFilter: ['style'] });
        }
      }
      applyItem(it);
    });
  }
  setInterval(tick, 400);
  const all = () => ITEMS.forEach(applyItem);
  window.addEventListener('resize', all);
  window.addEventListener('orientationchange', () => setTimeout(all, 300));
  document.addEventListener('fullscreenchange', () => setTimeout(all, 300));
})();
