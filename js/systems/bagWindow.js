// ===== หน้าต่างกระเป๋า / อุปกรณ์ (HTML ซ้อนบนแคนวาส) =====
// แทนที่ openInventory เดิม แต่ใช้ข้อมูลและฟังก์ชันเดิมทั้งหมด
// (this.bag, this.equipment, equipItem, unequipSlot, mergeSingleItem, mergeAllInBag ...)
// รองรับไอเทม "หนังสือสกิล" (kind: 'skillbook') ซ้อนได้ กดใช้เพื่อเรียนรู้/อัปสกิล
// รองรับ "หินตีบวก" (kind: 'stone'), ตีบวก และย่อยอุปกรณ์ (ดู enhance.js)
// ปุ่ม "ย่อยทั้งหมดตามสี" (ย่อยสีขาวทั้งหมด / สีฟ้าทั้งหมด ...) กด 2 ครั้งเพื่อยืนยัน
// v29: ย่อหน้าต่างกระเป๋า (BAG_SCALE) และ "ไม่หยุดเกม" ตอนเปิดกระเป๋า -> บอทสู้ต่อได้ | กระเป๋าที่เปิดค้างรีเฟรชเองเมื่อของ/ทองเปลี่ยน
// v30: จัดเลย์เอาต์ใหม่ให้ช่องไอเทมใหญ่ขึ้น: ช่องไอเทมกินพื้นที่ซ้ายเต็ม (ไม่มีที่ว่างสองข้าง)
//      รายละเอียดไอเทมเล็กลงและแคบลง | หัวเรื่อง+แท็บอยู่แถวเดียว | ปุ่มเปลี่ยนหน้ารวมอยู่ในแถบปุ่ม
// v31: จอแนวตั้ง: หน้าต่างกว้างเกือบเต็มจอ ไม่ย่อ, ช่องไอเทมเป็นสี่เหลี่ยมจัตุรัส, รายละเอียดย้ายลงล่างตาราง
//      (แนวนอนทำงานเหมือนเดิม) ปรับได้ที่ค่า PORTRAIT_* ด้านล่าง
// ต้องโหลดหลัง fixes.js และก่อน main.js
(function () {
  // ใส่ไฟล์รูปจริงของไอคอนที่นี่ได้ ถ้าไม่ใส่จะใช้รูปที่เกมวาดไว้ตามเดิม
  // ตัวอย่าง: icon_sword: 'assets/icons/sword.png'
  const ICON_FILES = {};

  // ---------- ตั้งค่าขนาด/ตำแหน่งหน้าต่างกระเป๋า (ปรับตรงนี้) ----------
  const BAG_SCALE = 0.62;    // ขนาดหน้าต่าง: 1 = เต็มจอ | 0.5 = ครึ่งนึง | ใหญ่ขึ้นปรับเป็น 0.7 - 0.8 ได้
  const BAG_ANCHOR_X = 0.72; // ตำแหน่งกึ่งกลางหน้าต่างแนวนอน (0.5 = กลางจอ, 1 = ขวาสุด) | ระบบจะดันให้ไม่ล้นขอบจออัตโนมัติ
  const BAG_ANCHOR_Y = 0.5;  // ตำแหน่งกึ่งกลางหน้าต่างแนวตั้ง
  const BAG_BASE_W = 0.86;   // ขนาด "ก่อนย่อ" ของหน้าต่าง เทียบกับจอ (ลดตัวเลขนี้ = หน้าต่างแคบลง ช่องแคบลง)
  const BAG_BASE_H = 0.96;
  const BAG_COLS = 10;       // จำนวนคอลัมน์ช่องไอเทมในกระเป๋า
  const DETAIL_W = 25;       // ความกว้างช่องรายละเอียดไอเทม (% ของหน้าต่าง) ยิ่งน้อยยิ่งเหลือที่ให้ช่องไอเทม

  // ---------- ตั้งค่าสำหรับจอแนวตั้ง (ปรับตรงนี้) ----------
  const PORTRAIT_SCALE = 0.62;   // ขนาดหน้าต่างแนวตั้ง (ใหญ่ขึ้นเพิ่มเป็น 0.7, เล็กลงลดเป็น 0.55)
  const PORTRAIT_W = 0.96;       // ความกว้างก่อนย่อ เทียบกับจอ
  const PORTRAIT_H = 0.78;       // ความสูงก่อนย่อ เทียบกับจอ
  const PORTRAIT_ANCHOR_Y = 0.6; // ตำแหน่งแนวตั้ง (0.5 = กลางจอ, มากขึ้น = ลงล่าง)

  // ---------- ตั้งค่า "ย่อยทั้งหมดตามสี" (ปรับตรงนี้) ----------
  // สีที่ "ไม่ให้มีปุ่มย่อยทั้งหมด" (ใช้ id ของสีใน TIER_DEFS ถ้า id ไม่ตรงกับที่ใส่ไว้ ปุ่มของสีนั้นจะยังโชว์ แต่ยังต้องกดยืนยัน 2 ครั้ง)
  const DISMANTLE_PROTECT_TIERS = ['red', 'gold'];
  // ข้ามชิ้นที่อัพดาวแล้ว / ตีบวกแล้ว (กันย่อยของที่ลงทุนไปโดยไม่ตั้งใจ) ตั้ง false = ย่อยหมด
  const DISMANTLE_SKIP_STARRED = true;
  const DISMANTLE_SKIP_PLUS = true;

  const iconCache = {};
  const state = { tab: 'bag', page: 0, sel: null, msg: '', qty: 1, multi: false, ticks: new Set(), confirmTier: null };
  let root = null;
  let scene = null;
  let lastSig = '';

  const hex = (c) => '#' + c.toString(16).padStart(6, '0');

  // ---- ตัวช่วยรองรับหนังสือสกิล (ไม่ต้องแก้ items.js) ----
  const isBook = (it) => !!it && it.kind === 'skillbook';
  const itemIcon = (it) => isBook(it) ? itemImgKey('skillbook', skillIconKey(SKILL_DEFS[it.sid].type)) : iconKeyForItem(it);
  const itemColor = (it) => isBook(it)
    ? ((CLASSES[SKILL_DEFS[it.sid].class] || {}).color || 0xffffff)
    : rarityColor(it);
  const itemName = (it) => isBook(it) ? '📕 ' + SKILL_DEFS[it.sid].name : itemLabel(it);

  // แปลงเท็กซ์เจอร์ของ Phaser เป็นรูปที่ HTML ใช้ได้
  function iconSrc(key) {
    if (!key) return '';
    if (ICON_FILES[key]) return ICON_FILES[key];
    if (iconCache[key]) return iconCache[key];
    try {
      if (!scene.textures.exists(key)) return '';
      const tex = scene.textures.get(key);
      const fr = tex.get();
      const c = document.createElement('canvas');
      c.width = fr.cutWidth; c.height = fr.cutHeight;
      c.getContext('2d').drawImage(tex.getSourceImage(), fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
      return (iconCache[key] = c.toDataURL());
    } catch (e) { return ''; }
  }

  // ย่อ/จัดตำแหน่งหน้าต่างกระเป๋า: วางหน้าต่างขนาดเดิมแล้วย่อด้วย scale
  // ใช้ !important เพื่อทับ CSS เดิมของ .win โดยไม่ต้องแก้ไฟล์ css
  // จอแนวตั้ง: ใช้ขนาด/ตำแหน่งชุด PORTRAIT_* และใส่คลาส bag-portrait ให้ CSS จัดเลย์เอาต์ใหม่
  function applyScale() {
    if (!root) return;
    const layer = document.getElementById('ui-layer');
    const vv = window.visualViewport;
    const lw = (layer && (parseFloat(layer.style.width) || layer.clientWidth)) || (vv ? vv.width : window.innerWidth);
    const lh = (layer && (parseFloat(layer.style.height) || layer.clientHeight)) || (vv ? vv.height : window.innerHeight);
    const portrait = lh > lw;
    root.classList.toggle('bag-portrait', portrait);

    const scale = portrait ? PORTRAIT_SCALE : BAG_SCALE;
    const bw = portrait ? PORTRAIT_W : BAG_BASE_W;
    const bh = portrait ? PORTRAIT_H : BAG_BASE_H;

    // ดันตำแหน่งไม่ให้หน้าต่างล้นขอบจอ
    const halfW = bw * scale / 2, halfH = bh * scale / 2;
    const wantX = portrait ? 0.5 : BAG_ANCHOR_X;   // แนวตั้งอยู่กลางจอ
    const wantY = portrait ? PORTRAIT_ANCHOR_Y : BAG_ANCHOR_Y;
    const ax = Math.min(Math.max(wantX, halfW), 1 - halfW);
    const ay = Math.min(Math.max(wantY, halfH), 1 - halfH);
    const set = (k, v) => root.style.setProperty(k, v, 'important');
    set('position', 'absolute');
    set('left', (ax * 100) + '%');
    set('top', (ay * 100) + '%');
    set('right', 'auto');
    set('bottom', 'auto');
    set('margin', '0');
    set('width', Math.round(lw * bw) + 'px');
    set('height', Math.round(lh * bh) + 'px');
    set('max-width', 'none');
    set('max-height', 'none');
    set('transform', 'translate(-50%,-50%) scale(' + scale + ')');
    set('transform-origin', 'center center');
  }

  // ปรับเลเยอร์ UI ให้เท่าพื้นที่ที่มองเห็นจริง (ไม่รวมแถบที่อยู่/แถบสถานะของเบราว์เซอร์)
  function fit() {
    const layer = document.getElementById('ui-layer');
    if (!layer) return;
    const vv = window.visualViewport;
    layer.style.right = 'auto';
    layer.style.bottom = 'auto';
    layer.style.left = (vv ? vv.offsetLeft : 0) + 'px';
    layer.style.top = (vv ? vv.offsetTop : 0) + 'px';
    layer.style.width = (vv ? vv.width : window.innerWidth) + 'px';
    layer.style.height = (vv ? vv.height : window.innerHeight) + 'px';
    applyScale();
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 200));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);

  // CSS เลย์เอาต์ของหน้าต่างกระเป๋า (ใช้ !important ทับ css/ui.css เดิม)
  function bagCSS() {
    const B = '#bag-win ';
    const P = '#bag-win.bag-portrait ';
    return [
      // ---- กรอบหน้าต่าง: หัวเรื่อง+แท็บแถวเดียว / เนื้อหา / ท้าย ----
      B + '{flex-direction:column!important;overflow:hidden!important;box-sizing:border-box!important}',
      B + '.win-head{display:flex!important;align-items:center!important;gap:8px!important;padding:4px 8px!important;min-height:0!important;flex:0 0 auto!important}',
      B + '.win-head .win-title{font-size:16px!important;margin:0 4px 0 0!important}',
      B + '.win-head .win-tabs{display:flex!important;gap:4px!important;padding:0!important;margin:0!important;border:0!important;background:none!important;flex:1 1 auto!important;min-height:0!important}',
      B + '.win-head .win-tab{padding:4px 14px!important;font-size:12px!important;min-height:0!important;margin:0!important}',
      B + '.win-head .win-x{width:28px!important;height:28px!important;min-width:0!important;padding:0!important;font-size:14px!important;margin-left:auto!important;flex:0 0 auto!important}',
      B + '.win-body{display:flex!important;flex-direction:row!important;flex:1 1 auto!important;min-height:0!important;gap:6px!important;padding:4px 6px!important;overflow:hidden!important}',
      B + '.win-left{display:flex!important;flex-direction:column!important;flex:1 1 0!important;min-width:0!important;min-height:0!important;gap:4px!important;padding:0!important;margin:0!important;overflow:hidden!important;align-items:stretch!important;justify-content:flex-start!important}',
      B + '.win-right{flex:0 0 ' + DETAIL_W + '%!important;width:' + DETAIL_W + '%!important;max-width:' + DETAIL_W + '%!important;min-width:0!important;min-height:0!important;padding:6px!important;margin:0!important;overflow-y:auto!important;overflow-x:hidden!important;box-sizing:border-box!important}',
      B + '.win-foot{padding:3px 10px!important;min-height:0!important;font-size:11px!important;flex:0 0 auto!important}',

      // ---- ตารางช่องไอเทม: ยืดเต็มพื้นที่ที่เหลือ (ไม่มีที่ว่าง) ----
      B + '.grid{display:grid!important;grid-template-columns:repeat(var(--cols,10),minmax(0,1fr))!important;grid-template-rows:repeat(var(--rows,5),minmax(0,1fr))!important;gap:3px!important;width:100%!important;max-width:none!important;flex:1 1 auto!important;min-height:0!important;margin:0!important;padding:0!important;align-content:stretch!important;justify-content:stretch!important}',
      B + '.grid .cell{width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;aspect-ratio:auto!important;padding:0!important;margin:0!important;position:relative!important;container-type:size}',
      B + '.grid .cell img{position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:min(86cqw,86cqh)!important;height:min(86cqw,86cqh)!important;max-width:none!important;object-fit:contain!important;pointer-events:none!important}',
      B + '.grid.equip{gap:6px!important}',
      B + '.grid.equip .cell img{top:56%!important;width:min(62cqw,62cqh)!important;height:min(62cqw,62cqh)!important}',
      B + '.cell .slot-name{position:absolute!important;top:2px!important;left:0!important;right:0!important;text-align:center!important;font-size:clamp(9px,15cqh,13px)!important;line-height:1.1!important;color:#aab4c4!important}',
      B + '.cell .cnt{position:absolute!important;right:2px!important;bottom:1px!important;left:auto!important;top:auto!important;font-size:clamp(10px,32cqh,17px)!important;font-weight:700!important;line-height:1!important;color:#fff!important;text-shadow:0 0 2px #000,0 0 2px #000,0 0 3px #000!important}',
      B + '.cell .lv{position:absolute!important;left:2px!important;bottom:1px!important;right:auto!important;top:auto!important;font-size:clamp(9px,26cqh,15px)!important;font-weight:700!important;line-height:1!important;color:#ffd45c!important;text-shadow:0 0 2px #000,0 0 2px #000,0 0 3px #000!important}',
      B + '.cell .pl{position:absolute;top:1px;left:2px;font-size:clamp(9px,26cqh,15px);line-height:1;color:#ff9a3c;font-weight:700;text-shadow:0 0 2px #000,0 0 2px #000}',
      B + '.cell .st{position:absolute;top:1px;right:2px;font-size:clamp(8px,22cqh,13px);line-height:1;color:#8fd0ff;text-shadow:0 0 2px #000,0 0 2px #000}',
      B + '.cell .ck{position:absolute;right:2px;bottom:1px;font-size:clamp(10px,28cqh,16px);line-height:1;color:#5ee08a;background:rgba(0,0,0,.65);border-radius:3px;padding:0 2px}',
      B + '.cell.tick{box-shadow:0 0 0 2px #5ee08a}',

      // ---- แถบปุ่มใต้ช่องไอเทม (รวมปุ่มเปลี่ยนหน้า) ----
      B + '.bag-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:4px;flex:0 0 auto}',
      B + '.bag-tools button{min-height:28px;padding:3px 8px;font-size:12px;white-space:nowrap;border:1px solid #3a4150;background:#1c2230;color:var(--text);border-radius:6px}',
      B + '.bag-tools button:active{background:#2a3550}',
      B + '.bag-tools .qty{display:flex;align-items:center;gap:2px;padding:0 3px;border:1px solid #2a3142;border-radius:6px;background:#10151e}',
      B + '.bag-tools .qty button{border:0;background:transparent;padding:3px 7px}',
      B + '.bag-tools button.on{background:#2c6a3a;border-color:#3f8d51}',
      B + '.bag-tools button.dz{border-color:#7a3a3a;color:#ffb8b8}',
      B + '.bag-tools button.dz.cf{background:#8a2a2a;border-color:#ff6a6a;color:#fff;font-weight:700}',
      B + '.bag-tools .dz-label{font-size:12px;color:#aaa;padding:0 2px}',
      B + '.bag-tools .qty-in{width:46px;height:26px;text-align:center;color:var(--gold);background:#0a0d13;border:1px solid #34507f;border-radius:4px;font-size:14px;font-family:inherit;-webkit-user-select:text;user-select:text}',
      B + '.bag-tools .bw-pg{display:inline-flex;align-items:center;gap:4px;margin-left:auto}',
      B + '.bag-tools .bw-pg .page-no{font-size:12px;color:#9aa4b5;white-space:nowrap}',

      // ---- ช่องรายละเอียดไอเทม: เล็กลง ----
      B + '.win-right .d-top{gap:6px!important;margin-bottom:4px!important}',
      B + '.win-right .d-icon{width:34px!important;height:34px!important;min-width:34px!important;flex:0 0 34px!important}',
      B + '.win-right .d-icon img{width:100%!important;height:100%!important;object-fit:contain!important}',
      B + '.win-right .d-name{font-size:13px!important;line-height:1.2!important}',
      B + '.win-right .d-type{font-size:10px!important}',
      B + '.win-right .d-note{font-size:10px!important;line-height:1.3!important;margin:3px 0!important}',
      B + '.win-right .d-row{font-size:11px!important;padding:2px 0!important;min-height:0!important}',
      B + '.win-right .d-stats{font-size:11px!important;gap:1px 8px!important}',
      B + '.win-right .d-empty{font-size:11px!important;line-height:1.4!important;padding:6px!important}',
      B + '.win-right .d-actions{gap:4px!important;margin-top:6px!important}',
      B + '.win-right .d-actions .btn{font-size:11px!important;padding:6px 6px!important;min-height:0!important;line-height:1.1!important}',

      // ---- จอแนวตั้ง: ตารางอยู่บน รายละเอียดอยู่ล่าง ช่องเป็นสี่เหลี่ยมจัตุรัส ----
      P + '.win-body{flex-direction:column!important}',
      P + '.win-left{flex:0 0 auto!important;min-height:auto!important}',
      P + '.grid{flex:0 0 auto!important;grid-template-rows:none!important;grid-auto-rows:auto!important;align-content:start!important}',
      P + '.grid .cell{height:auto!important;aspect-ratio:1/1!important}',
      P + '.win-right{flex:1 1 0!important;width:100%!important;max-width:none!important;min-height:70px!important}',
      P + '.win-head .win-title{font-size:17px!important}',
      P + '.win-head .win-tab{font-size:13px!important;padding:5px 14px!important}',
      P + '.win-head .win-x{width:32px!important;height:32px!important}',
      P + '.bag-tools button{min-height:32px!important;padding:4px 8px!important;font-size:12px!important}',
      P + '.win-right .d-name{font-size:14px!important}',
      P + '.win-right .d-row{font-size:12px!important}',
      P + '.win-right .d-note{font-size:11px!important}',
      P + '.win-right .d-stats{font-size:12px!important}',
      P + '.win-right .d-empty{font-size:12px!important;padding:10px!important}',
      P + '.win-right .d-actions .btn{font-size:12px!important;padding:8px 6px!important}',
      P + '.win-foot{font-size:12px!important}',
    ].join('');
  }

  function ensureRoot() {
    if (root) return;
    let layer = document.getElementById('ui-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'ui-layer';
      document.body.appendChild(layer);
    }
    root = document.createElement('div');
    root.className = 'win';
    root.id = 'bag-win';
    layer.appendChild(root);
    root.addEventListener('click', onClick);
    // กันการแตะในหน้าต่างกระเป๋าทะลุไปโดนตัวเกม (ส่วนที่เหลือของจอแตะเล่นเกมได้)
    ['pointerdown', 'touchstart', 'touchmove', 'mousedown'].forEach((evn) => {
      root.addEventListener(evn, (e) => { e.stopPropagation(); }, { passive: true });
    });
    // ช่องพิมพ์จำนวน: อัปเดตค่าโดยไม่วาดใหม่ (กันคีย์บอร์ดหลุด) และกันปุ่มลัดของเกมทำงานตอนพิมพ์
    const onType = (e) => {
      if (!e.target.classList || !e.target.classList.contains('qty-in')) return;
      syncQty();
      root.querySelectorAll('.ql').forEach(el => { el.textContent = '×' + state.qty; });
    };
    root.addEventListener('input', onType);
    root.addEventListener('change', onType);
    root.addEventListener('keydown', (e) => {
      if (e.target.classList && e.target.classList.contains('qty-in')) {
        e.stopPropagation();
        if (e.key === 'Enter') e.target.blur();
      }
    });
    if (!document.getElementById('bag-qty-style')) {
      const st = document.createElement('style');
      st.id = 'bag-qty-style';
      st.textContent = bagCSS();
      document.head.appendChild(st);
    }
    applyScale();
  }

  function hide() {
    if (root) root.style.display = 'none';
    state.sel = null;
    state.confirmTier = null;
    window.BAG_OPEN = false;
    if (scene) scene.bagOpen = false;
  }

  // ---------- จำนวนที่เลือก (ใช้กับ เปิดกล่อง / ย่อยกล่อง / รวมดาว) ----------
  function selBagItem() {
    const sel = state.sel;
    return sel && sel.src === 'bag' ? scene.bag[sel.id] : null;
  }
  function maxQty() {
    const it = selBagItem();
    if (!it) return 1;
    if (it.kind === 'box' || it.kind === 'optstone') return Math.max(1, it.count || 1);
    if (it.kind === 'equip') return Math.max(1, Math.floor(scene.countMatches(state.sel.id) / 2));
    return 1;
  }
  // อ่านจำนวนที่พิมพ์ในช่องมาเก็บใน state.qty
  function syncQty() {
    const inp = root && root.querySelector('.qty-in');
    if (!inp) return;
    const v = parseInt(String(inp.value).replace(/[^0-9]/g, ''), 10);
    if (v > 0) state.qty = v;
  }
  function clampQty() { state.qty = Math.max(1, Math.min(state.qty, maxQty())); }

  // ---------- ย่อยทั้งหมดตามสี ----------
  // ชิ้นที่ถูก "กันไว้" ไม่ย่อย (อัพดาวแล้ว / ตีบวกแล้ว ตามค่าตั้งด้านบน)
  function dismantleGuard(it) {
    return (DISMANTLE_SKIP_STARRED && it.star > 0) || (DISMANTLE_SKIP_PLUS && it.plus > 0);
  }
  // รายการสีที่มีของในกระเป๋า: [{ id, name, n (ย่อยได้), skip (ถูกกันไว้) }] เรียงตาม TIER_DEFS
  function tierList() {
    const out = {};
    const defs = (typeof TIER_DEFS !== 'undefined') ? TIER_DEFS : {};
    Object.keys(defs).forEach((id) => { out[id] = { id: id, name: defs[id].name || id, n: 0, skip: 0 }; });
    scene.bag.forEach((it) => {
      if (!it || it.kind !== 'equip') return;
      const t = String(tierOf(it));
      if (!out[t]) out[t] = { id: t, name: t, n: 0, skip: 0 };
      if (dismantleGuard(it)) out[t].skip++; else out[t].n++;
    });
    return Object.keys(out).map((k) => out[k])
      .filter((t) => (t.n > 0 || t.skip > 0) && DISMANTLE_PROTECT_TIERS.indexOf(t.id) < 0);
  }
  function dismantleTier(tier) {
    const s = scene;
    let done = 0, skipped = 0, failed = 0;
    for (let i = 0; i < s.bag.length; i++) {
      const it = s.bag[i];
      if (!it || it.kind !== 'equip' || String(tierOf(it)) !== String(tier)) continue;
      if (dismantleGuard(it)) { skipped++; continue; }
      if (s.dismantleBagItem(i)) done++; else failed++;
    }
    const nm = (typeof TIER_DEFS !== 'undefined' && TIER_DEFS[tier]) ? TIER_DEFS[tier].name : tier;
    let msg = done > 0 ? 'ย่อยสี' + nm + ' ' + done + ' ชิ้น' : 'ไม่มีชิ้นที่ย่อยได้';
    if (skipped) msg += ' (ข้ามที่อัพดาว/ตีบวก ' + skipped + ' ชิ้น)';
    if (failed) msg += ' (ย่อยไม่สำเร็จ ' + failed + ' ชิ้น)';
    s.toastMsg(msg);
    if (done > 0 && s.saveSoon) s.saveSoon();
  }

  // แถบปุ่มใต้ช่องไอเทม (รวมปุ่มเปลี่ยนหน้าไว้ในแถบเดียวกัน ประหยัดที่แนวตั้ง)
  function toolbarHTML() {
    const mergeLabel = state.multi
      ? '🔗 รวมที่ติ๊ก (' + state.ticks.size + ')'
      : '🔗 รวมที่เลือก <span class="ql">×' + state.qty + '</span>';
    let h = '<div class="bag-tools">'
      + '<span class="qty"><button data-act="qty" data-id="-1">−</button>'
      + '<input class="qty-in" type="text" inputmode="numeric" pattern="[0-9]*" value="' + state.qty + '" aria-label="จำนวน">'
      + '<button data-act="qty" data-id="1">+</button><button data-act="qty" data-id="max">MAX</button></span>'
      + '<button data-act="multi" class="' + (state.multi ? 'on' : '') + '">' + (state.multi ? '☑' : '☐') + ' เลือกหลายชิ้น</button>'
      + '<button data-act="merge-all">🔗 รวมทั้งหมด</button>'
      + '<button data-act="merge-sel">' + mergeLabel + '</button>'
      + '<button data-act="sort-bag">🧹 จัดกระเป๋า</button>'
      + '<span class="bw-pg">'
      + '<button data-act="page" data-id="-1">◀</button>'
      + '<span class="page-no">หน้า ' + (state.page + 1) + ' / ' + PAGES + '</span>'
      + '<button data-act="page" data-id="1">▶</button>'
      + '</span>';
    // ปุ่มย่อยทั้งหมดตามสี (โชว์เฉพาะสีที่มีของในกระเป๋า)
    const tiers = tierList();
    if (tiers.length) {
      h += '<span class="dz-label">♻ ย่อยทั้งหมด:</span>';
      tiers.forEach((t) => {
        const cf = state.confirmTier === t.id;
        h += '<button class="dz' + (cf ? ' cf' : '') + '" data-act="dis-tier" data-id="' + t.id + '">'
          + (cf ? 'ยืนยันย่อยสี' + t.name + ' ' + t.n + ' ชิ้น?' : 'สี' + t.name + ' (' + t.n + ')')
          + (!cf && t.skip ? ' ข้าม' + t.skip : '')
          + '</button>';
      });
    }
    return h + '</div>';
  }

  // ---------- ส่วนแสดงผล ----------
  function cellHTML(it, act, id, selected, ticked) {
    if (!it) return '<button class="cell"></button>';
    const lv = it.kind === 'equip' ? 'Lv' + it.level : '';
    const pl = it.kind === 'equip' && it.plus > 0 ? '+' + it.plus : '';
    const st = it.kind === 'equip' && it.star > 0 ? it.star + '★' : '';
    const stackable = it.kind === 'box' || it.kind === 'stone' || it.kind === 'optstone' || it.kind === 'cleanstone' || isBook(it);
    const cnt = stackable && it.count > 1 ? 'x' + it.count : '';
    return '<button class="cell has' + (selected ? ' sel' : '') + (ticked ? ' tick' : '') + '" style="--c:' + hex(itemColor(it)) + '" data-act="' + act + '" data-id="' + id + '">'
      + '<img src="' + iconSrc(itemIcon(it)) + '" alt="">'
      + (ticked ? '<span class="ck">✔</span>' : '')
      + (pl ? '<span class="pl">' + pl + '</span>' : '')
      + (st ? '<span class="st">' + st + '</span>' : '')
      + (lv ? '<span class="lv">' + lv + '</span>' : '')
      + (cnt ? '<span class="cnt">' + cnt + '</span>' : '')
      + '</button>';
  }

  function bagGridHTML() {
    const s = scene;
    const rows = Math.max(1, Math.ceil(PAGE_SIZE / BAG_COLS));
    let h = '<div class="grid bag" style="--cols:' + BAG_COLS + ';--rows:' + rows + '">';
    for (let i = 0; i < PAGE_SIZE; i++) {
      const idx = state.page * PAGE_SIZE + i;
      const sel = state.sel && state.sel.src === 'bag' && state.sel.id === idx;
      h += cellHTML(s.bag[idx], 'sel-bag', idx, sel, state.multi && state.ticks.has(idx));
    }
    h += '</div>';
    h += toolbarHTML();
    return h;
  }

  function equipGridHTML() {
    const s = scene;
    const emptyIcons = { weapon: 'icon_sword', helmet: 'icon_helmet', armor: 'icon_armor', gloves: 'icon_gloves', shoes: 'icon_shoes', ring1: 'icon_ring', ring2: 'icon_ring', necklace: 'icon_necklace' };
    const cols = 4, rows = Math.max(1, Math.ceil(EQUIP_SLOT_KEYS.length / cols));
    let h = '<div class="grid equip" style="--cols:' + cols + ';--rows:' + rows + '">';
    EQUIP_SLOT_KEYS.forEach((key) => {
      const it = s.equipment[key];
      const name = SLOT_LABELS[baseSlotOf(key)] + (key === 'ring1' ? ' (ซ้าย)' : key === 'ring2' ? ' (ขวา)' : '');
      const sel = state.sel && state.sel.src === 'equip' && state.sel.id === key;
      const lv = it ? 'Lv' + it.level + (it.plus > 0 ? ' +' + it.plus : '') + (it.star > 0 ? ' ' + it.star + '★' : '') : '';
      h += '<button class="cell' + (it ? ' has' : '') + (sel ? ' sel' : '') + '"'
        + (it ? ' style="--c:' + hex(itemColor(it)) + '"' : '') + ' data-act="sel-equip" data-id="' + key + '">'
        + '<span class="slot-name">' + name + '</span>'
        + '<img src="' + iconSrc(it ? itemIcon(it) : emptyIcons[key]) + '" alt="">'
        + (lv ? '<span class="lv">' + lv + '</span>' : '')
        + '</button>';
    });
    return h + '</div>';
  }

  // รายละเอียด + ปุ่มใช้ของหนังสือสกิล
  function bookDetailHTML(it) {
    const s = scene;
    const d = SKILL_DEFS[it.sid];
    const learned = s.learnedSkills.has(it.sid);
    const lv = (s.skillLv && s.skillLv[it.sid]) || 1;
    const have = s.countSkillBooks(it.sid);
    const maxed = learned && lv >= SKILL_MAX_LV;
    const need = !learned ? 1 : (maxed ? 0 : booksNeeded(lv));
    const can = !maxed && have >= need;

    let action;
    if (!learned) action = 'เรียนรู้สกิล (ใช้ 1 เล่ม)';
    else if (maxed) action = 'เลเวลสูงสุดแล้ว';
    else action = 'อัปเป็น Lv.' + (lv + 1) + ' (ใช้ ' + need + ' เล่ม)';

    const color = hex(itemColor(it));
    let h = '<div class="d-top" style="--c:' + color + '">'
      + '<div class="d-icon"><img src="' + iconSrc(itemIcon(it)) + '" alt=""></div>'
      + '<div><div class="d-name">' + itemName(it) + '</div>'
      + '<div class="d-type">หนังสือสกิล (' + (WEAPON_CLASS_LABEL[d.class] || d.class) + ')</div></div></div>';

    h += '<div class="d-note">กดใช้เพื่อเรียนรู้สกิลนี้ หรืออัปเลเวลถ้าเรียนแล้ว</div>'
      + '<div class="d-row"><span>สถานะ</span><span>' + (learned ? 'เรียนแล้ว Lv.' + lv + ' / ' + SKILL_MAX_LV : 'ยังไม่เรียน') + '</span></div>'
      + '<div class="d-row"><span>การใช้ครั้งนี้</span><span>' + action + '</span></div>'
      + '<div class="d-row"><span>มีในกระเป๋า (ทุกกอง)</span><span>' + have + (maxed ? '' : ' / ' + need) + ' เล่ม</span></div>'
      + '<div class="d-row"><span>ดาเมจสกิล</span><span>x' + skillLvMul(learned ? lv : 1).toFixed(1) + '</span></div>';

    h += '<div class="d-actions">'
      + '<button class="btn ok" data-act="use-book"' + (can ? '' : ' disabled') + '>'
      + (maxed ? 'MAX' : (learned ? 'อัปสกิล' : 'เรียนรู้')) + '</button></div>';
    return h;
  }

  // รายละเอียดหินตีบวก
  function stoneDetailHTML(it) {
    return '<div class="d-top" style="--c:#6fc3ff"><div class="d-icon"><img src="' + iconSrc(itemIcon(it)) + '" alt=""></div>'
      + '<div><div class="d-name">' + itemName(it) + '</div><div class="d-type">วัสดุตีบวก</div></div></div>'
      + '<div class="d-note">ได้จากการย่อยอุปกรณ์ ใช้ตีบวก (เลือกอุปกรณ์แล้วกด 🔨 ตีบวก)</div>'
      + '<div class="d-row"><span>รวมในกระเป๋า</span><span>' + scene.countStones() + ' ก้อน</span></div>';
  }

  // รายละเอียดหินลบออฟ
  function cleanStoneDetailHTML(it) {
    return '<div class="d-top" style="--c:#dfe6ee"><div class="d-icon"><img src="' + iconSrc(itemIcon(it)) + '" alt=""></div>'
      + '<div><div class="d-name">' + itemName(it) + '</div><div class="d-type">วัสดุลบออฟชั่น</div></div></div>'
      + '<div class="d-note">เลือกอุปกรณ์ที่มีออฟชั่น แล้วกดปุ่ม 🧽 ลบออฟ ในหน้ารายละเอียดอุปกรณ์ ออฟทั้งหมดจะถูกลบ ทำให้รวมดาวได้อีกครั้ง (ถ้ายังไม่ตีบวก)</div>'
      + '<div class="d-row"><span>รวมในกระเป๋า</span><span>' + scene.bag.reduce((n, s) => n + (s && s.kind === 'cleanstone' ? s.count : 0), 0) + ' เม็ด</span></div>';
  }

  // รายละเอียดหินสุ่มออฟ (ไม่มีเลเวลแล้ว มี 4 สี)
  function optStoneDetailHTML(it) {
    const c = OPT_COLORS[it.color] || OPT_COLORS.red;
    const pool = c.pool.map(k => STAT_DEFS[k].short).join(' / ');
    const q = Math.min(state.qty, it.count || 1);
    return '<div class="d-top" style="--c:' + hex(c.color) + '"><div class="d-icon"><img src="' + iconSrc(itemIcon(it)) + '" alt=""></div>'
      + '<div><div class="d-name">' + itemName(it) + '</div><div class="d-type">หินสุ่มออฟชั่น (สี' + c.name + ')</div></div></div>'
      + '<div class="d-note">เลือกอุปกรณ์ แล้วกดปุ่ม 💎 ฝัง ในหน้ารายละเอียดอุปกรณ์ จะสุ่มได้ 1-2 ออฟ สุ่มซ้ำได้ไม่จำกัด (ออฟเดิมจะถูกแทนที่) ถ้าอยากลบออฟใช้หินลบออฟ</div>'
      + '<div class="d-row"><span>ออฟที่สุ่มได้</span><span>' + pool + '</span></div>'
      + '<div class="d-row"><span>ย่อยได้หินตีบวก</span><span>' + window.optStoneYield() + ' ก้อน/เม็ด</span></div>'
      + '<div class="d-row"><span>ขายได้</span><span>' + window.optStonePrice() + ' ทอง/เม็ด</span></div>'
      + '<div class="d-actions">'
      + '<button class="btn danger" data-act="dismantle-opt">♻ ย่อย <span class="ql">×' + q + '</span></button>'
      + '<button class="btn info" data-act="sell-opt">💰 ขาย <span class="ql">×' + q + '</span></button></div>';
  }

  // โหมดเลือกหลายชิ้น: สรุปจำนวนที่ติ๊ก
  function multiDetailHTML() {
    const list = Array.from(state.ticks);
    const can = list.length ? scene.mergeIndices(list, true) : 0;
    return '<div class="d-empty">โหมดเลือกหลายชิ้น<br>แตะอุปกรณ์เพื่อติ๊ก (ข้ามหน้าได้)<br><br>'
      + 'ติ๊กไว้ ' + list.length + ' ชิ้น<br>รวมดาวได้ ' + can + ' ครั้ง</div>'
      + '<div class="d-actions"><button class="btn ok" data-act="merge-sel">🔗 รวมที่ติ๊ก</button>'
      + '<button class="btn danger" data-act="tick-clear">ล้างที่ติ๊ก</button></div>';
  }

  function detailHTML() {
    const s = scene;
    const sel = state.sel;
    if (state.multi && state.tab === 'bag') return multiDetailHTML();
    if (!sel) return '<div class="d-empty">แตะไอเทมหรือช่องอุปกรณ์<br>เพื่อดูรายละเอียด</div>';
    const it = sel.src === 'bag' ? s.bag[sel.id] : s.equipment[sel.id];
    if (!it) return '<div class="d-empty">ช่องนี้ยังว่างอยู่</div>';

    if (isBook(it)) return bookDetailHTML(it);
    if (it.kind === 'stone') return stoneDetailHTML(it);
    if (it.kind === 'optstone') return optStoneDetailHTML(it);
    if (it.kind === 'cleanstone') return cleanStoneDetailHTML(it);

    const color = hex(itemColor(it));
    const typeLabel = it.kind === 'box' ? 'กล่องอุปกรณ์'
      : (it.baseSlot === 'weapon' ? 'อาวุธ (' + weaponClassLabel(it.class) + ')' : SLOT_LABELS[it.baseSlot]);

    let h = '<div class="d-top" style="--c:' + color + '">'
      + '<div class="d-icon"><img src="' + iconSrc(itemIcon(it)) + '" alt=""></div>'
      + '<div><div class="d-name">' + itemName(it) + '</div><div class="d-type">' + typeLabel + '</div></div></div>';

    if (it.kind === 'equip') {
      const st = computeItemStats(it);
      const keys = Object.keys(st);
      h += keys.length
        ? '<div class="d-stats">' + keys.map((k) => '<div><span>' + (STAT_DEFS[k] ? STAT_DEFS[k].short : k) + '</span><span>+' + fmtStat(k, st[k]) + '</span></div>').join('') + '</div>'
        : '<div class="d-note">ไม่มีค่าพลังพิเศษ</div>';
      h += '<div class="d-row"><span>ระดับ</span><span>Lv.' + it.level + '</span></div>'
        + '<div class="d-row"><span>ระดับดาว</span><span>' + (it.star > 0 ? it.star + ' ★ / ' + MAX_STAR : '- (ยังไม่อัพดาว)') + '</span></div>'
        + '<div class="d-row"><span>อัพดาว</span><span>รวมของเหมือนกัน 2 ชิ้น</span></div>';
      h += window.enhanceInfoHTML(s, it);
      h += window.itemExtraInfoHTML(s, it);
    } else {
      h += '<div class="d-note">เปิดแล้วจะได้อุปกรณ์สุ่ม 1 ชิ้น สี' + TIER_DEFS[tierOf(it)].name + ' (เลเวล ' + it.level + ')</div>'
        + '<div class="d-row"><span>เลเวลกล่อง</span><span>Lv.' + it.level + '</span></div>'
        + '<div class="d-row"><span>จำนวนคงเหลือ</span><span>x' + (it.count || 1) + '</span></div>'
        + '<div class="d-row"><span>ย่อยกล่องได้หิน</span><span>' + window.boxStoneYield(it.level, it.tier) + ' ก้อน/ใบ</span></div>';
    }

    h += '<div class="d-actions">';
    if (sel.src === 'equip') {
      h += '<button class="btn danger" data-act="unequip">ถอดอุปกรณ์</button>';
    } else if (it.kind === 'box') {
      const q = Math.min(state.qty, it.count || 1);
      h += '<button class="btn ok" data-act="open-box">เปิดกล่อง <span class="ql">×' + q + '</span></button>'
        + '<button class="btn danger" data-act="dismantle-box">♻ ย่อยกล่อง <span class="ql">×' + q + '</span></button>';
    } else if (it.baseSlot === 'ring') {
      h += '<button class="btn ok" data-act="wear" data-id="ring1">ใส่แหวนซ้าย</button>'
        + '<button class="btn ok" data-act="wear" data-id="ring2">ใส่แหวนขวา</button>'
        + '<button class="btn info" data-act="merge">🔗 รวมดาว</button>';
    } else {
      h += '<button class="btn ok" data-act="wear" data-id="' + it.baseSlot + '">สวมใส่</button>'
        + '<button class="btn info" data-act="merge">🔗 รวมดาว</button>';
    }
    if (it.kind === 'equip') {
      h += '<button class="btn info" data-act="enhance">🔨 ตีบวก</button>'
        + (sel.src === 'bag' ? '<button class="btn danger" data-act="dismantle">♻ ย่อย</button>' : '')
        + window.itemEmbedButtonsHTML(s, it);
    }
    return h + '</div>';
  }

  // ลายเซ็นของกระเป๋า (จำนวนช่องที่มีของ + จำนวนรวม + ทอง) ไว้เช็กว่าต้องรีเฟรชหน้าต่างหรือไม่
  function bagSig() {
    const s = scene;
    let n = 0, c = 0;
    s.bag.forEach((it) => { if (it) { n++; c += (it.count || 1); } });
    return n + '|' + c + '|' + Math.floor(s.stats.gold);
  }

  function render() {
    const s = scene;
    const used = s.bag.filter(Boolean).length;
    clampQty();
    lastSig = bagSig();
    root.innerHTML =
      '<div class="win-head"><span class="win-title">กระเป๋า</span>'
      + '<div class="win-tabs">'
      + '<button class="win-tab' + (state.tab === 'bag' ? ' on' : '') + '" data-act="tab" data-id="bag">กระเป๋า</button>'
      + '<button class="win-tab' + (state.tab === 'equip' ? ' on' : '') + '" data-act="tab" data-id="equip">อุปกรณ์</button>'
      + '</div>'
      + '<button class="win-x" data-act="close">✕</button></div>'
      + '<div class="win-body">'
      + '<div class="win-left">' + (state.tab === 'bag' ? bagGridHTML() : equipGridHTML()) + '</div>'
      + '<div class="win-right">' + detailHTML() + '</div>'
      + '</div>'
      + '<div class="win-foot"><span>ช่อง ' + used + ' / ' + s.bag.length + '</span>'
      + '<span class="gold">🪙 ' + Number(s.stats.gold).toLocaleString() + '</span>'
      + '<span class="msg" id="bw-msg">' + (state.msg || '') + '</span></div>';
  }

  // เปิดกระเป๋าค้างไว้ตอนบอทเก็บของ/ดื่มยา: รีเฟรชเองเมื่อของหรือทองเปลี่ยน (ไม่รีเฟรชตอนกำลังพิมพ์จำนวน)
  setInterval(function () {
    if (!root || !scene || root.style.display === 'none') return;
    const a = document.activeElement;
    if (a && a.classList && a.classList.contains('qty-in')) return;
    try {
      if (bagSig() !== lastSig) render();
    } catch (e) { /* ignore */ }
  }, 800);

  // ---------- การกดปุ่ม ----------
  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    syncQty();
    const s = scene;
    const act = el.dataset.act;
    const id = el.dataset.id;
    const sel = state.sel;

    if (act !== 'dis-tier') state.confirmTier = null;   // กดอย่างอื่น = ยกเลิกการรอยืนยันย่อยทั้งหมด

    if (act === 'close') { s.closePanel(); return; }
    if (act === 'tab') { state.tab = id; state.sel = null; state.qty = 1; state.ticks.clear(); }
    else if (act === 'page') { state.page = Math.max(0, Math.min(PAGES - 1, state.page + Number(id))); state.sel = null; state.qty = 1; }
    else if (act === 'sel-bag') {
      if (state.multi) {
        const i = Number(id), cell = s.bag[i];
        if (cell && cell.kind === 'equip') { if (state.ticks.has(i)) state.ticks.delete(i); else state.ticks.add(i); }
        else if (cell) s.toastMsg('ติ๊กได้เฉพาะอุปกรณ์');
      } else { state.sel = { src: 'bag', id: Number(id) }; state.qty = 1; }
    }
    else if (act === 'multi') { state.multi = !state.multi; state.ticks.clear(); state.sel = null; state.qty = 1; }
    else if (act === 'tick-clear') { state.ticks.clear(); }
    else if (act === 'sel-equip') { state.sel = { src: 'equip', id: id }; state.qty = 1; }
    else if (act === 'qty') {
      state.qty = id === 'max' ? maxQty() : state.qty + Number(id);
    }
    else if (act === 'dis-tier') {
      if (state.confirmTier !== id) {
        state.confirmTier = id;                          // กดครั้งแรก: รอยืนยัน
        s.toastMsg('กดปุ่มสีแดงอีกครั้งเพื่อยืนยันการย่อย (ย่อยแล้วเอาคืนไม่ได้)');
      } else {
        state.confirmTier = null;                        // กดครั้งที่สอง: ย่อยจริง
        dismantleTier(id);
        state.sel = null; state.qty = 1; state.ticks.clear();
      }
    }
    else if (act === 'merge-sel') {
      if (state.multi) {
        if (state.ticks.size) { s.mergeIndices(Array.from(state.ticks)); state.ticks.clear(); }
        else s.toastMsg('ยังไม่ได้ติ๊กอุปกรณ์');
      }
      else if (sel && sel.src === 'bag') { if (s.mergeSelectedCount(sel.id, state.qty)) state.sel = null; }
      else s.toastMsg('เลือกอุปกรณ์ในกระเป๋าก่อน');
    }
    else if (act === 'sort-bag') { s.sortBag(); state.sel = null; state.qty = 1; state.ticks.clear(); }
    else if (act === 'merge-all') {
      const n = s.mergeAllInBag();
      s.toastMsg(n > 0 ? 'รวมอุปกรณ์สำเร็จ ' + n + ' ครั้ง' : 'ไม่มีของที่รวมกันได้');
      state.sel = null;
    }
    else if (act === 'wear' && sel && sel.src === 'bag') {
      const item = s.bag[sel.id];
      if (item) { s.bag[sel.id] = null; s.equipItem(id, item); s.toastMsg('สวมใส่: ' + itemLabel(item)); }
      state.sel = null;
    }
    else if (act === 'merge' && sel && sel.src === 'bag') {
      if (s.mergeSingleItem(sel.id)) state.sel = null;
    }
    else if (act === 'open-box' && sel && sel.src === 'bag') {
      s.openBoxes(sel.id, state.qty);
      const cur = s.bag[sel.id];
      if (!cur || cur.kind !== 'box') state.sel = null;
    }
    else if (act === 'dismantle-box' && sel && sel.src === 'bag') {
      s.dismantleBoxes(sel.id, state.qty);
      const cur = s.bag[sel.id];
      if (!cur || cur.kind !== 'box') state.sel = null;
    }
    else if (act === 'use-book' && sel && sel.src === 'bag') {
      s.useSkillBook(sel.id);
      if (!s.bag[sel.id]) state.sel = null;   // หนังสือหมดกอง -> ยกเลิกการเลือก
    }
    else if (act === 'enhance' && sel) { s.enhanceItem(sel.src, sel.id); }
    else if (act === 'dismantle' && sel && sel.src === 'bag') { if (s.dismantleBagItem(sel.id)) state.sel = null; }
    else if (act === 'clean-opt' && sel) { s.cleanOpts(sel.src, sel.id); }
    else if (act === 'embed' && sel) { s.embedOptStone(Number(id), sel.src, sel.id); }
    else if (act === 'dismantle-opt' && sel && sel.src === 'bag') {
      s.dismantleOptStones(sel.id, state.qty);
      const cur = s.bag[sel.id];
      if (!cur || cur.kind !== 'optstone') state.sel = null;
    }
    else if (act === 'sell-opt' && sel && sel.src === 'bag') {
      s.sellOptStones(sel.id, state.qty);
      const cur = s.bag[sel.id];
      if (!cur || cur.kind !== 'optstone') state.sel = null;
    }
    else if (act === 'unequip' && sel && sel.src === 'equip') {
      s.unequipSlot(sel.id);
      state.sel = null;
    }
    render();
  }

  // ---------- เชื่อมกับเกมเดิม ----------
  const origClosePanel = Main.prototype.closePanel;

  Main.prototype.openInventory = function (tab, page) {
    scene = this;
    // ปิดหน้าต่างแบบ Phaser อื่นที่เปิดค้างอยู่ก่อน (ถ้ามี)
    if (this.panel && origClosePanel) origClosePanel.call(this);
    ensureRoot();
    fit();
    state.tab = tab || state.tab || 'bag';
    if (page !== undefined) state.page = page;
    state.sel = null;
    state.confirmTier = null;
    this.invTab = state.tab;
    this.invPage = state.page;
    render();
    root.style.display = 'flex';
    // ไม่ตั้ง this.panel = [] แล้ว (เดิมทำให้เกม/บอทหยุดตอนเปิดกระเป๋า) ใช้แฟลก bagOpen / window.BAG_OPEN แทน
    this.bagOpen = true;
    window.BAG_OPEN = true;
  };

  Main.prototype.closePanel = function () {
    hide();
    if (origClosePanel) return origClosePanel.apply(this, arguments);
  };

  // ข้อความแจ้งเตือนของเกมจะถูกบังด้วยหน้าต่าง จึงแสดงซ้ำที่ท้ายหน้าต่างด้วย
  const origToast = Main.prototype.toastMsg;
  Main.prototype.toastMsg = function (m) {
    state.msg = m;
    const el = document.getElementById('bw-msg');
    if (el && root && root.style.display !== 'none') el.textContent = m;
    if (origToast) return origToast.apply(this, arguments);
  };
})();
