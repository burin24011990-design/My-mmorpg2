// ===== หน้าต่างกระเป๋า / อุปกรณ์ (HTML ซ้อนบนแคนวาส) =====
// แทนที่ openInventory เดิม แต่ใช้ข้อมูลและฟังก์ชันเดิมทั้งหมด
// (this.bag, this.equipment, equipItem, unequipSlot, mergeSingleItem, mergeAllInBag ...)
// ต้องโหลดหลัง fixes.js และก่อน main.js
(function () {
  // ใส่ไฟล์รูปจริงของไอคอนที่นี่ได้ ถ้าไม่ใส่จะใช้รูปที่เกมวาดไว้ตามเดิม
  // ตัวอย่าง: icon_sword: 'assets/icons/sword.png'
  const ICON_FILES = {};

  const iconCache = {};
  const state = { tab: 'bag', page: 0, sel: null, msg: '' };
  let root = null;
  let scene = null;

  const hex = (c) => '#' + c.toString(16).padStart(6, '0');

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
  }

  function hide() { if (root) root.style.display = 'none'; state.sel = null; }

  // ---------- ส่วนแสดงผล ----------
  function cellHTML(it, act, id, selected) {
    if (!it) return '<button class="cell"></button>';
    const lv = it.kind === 'equip' ? 'Lv' + it.level + (it.star > 0 ? ' ' + it.star + '★' : '') : '';
    const cnt = it.kind === 'box' && it.count > 1 ? 'x' + it.count : '';
    return '<button class="cell has' + (selected ? ' sel' : '') + '" style="--c:' + hex(rarityColor(it)) + '" data-act="' + act + '" data-id="' + id + '">'
      + '<img src="' + iconSrc(iconKeyForItem(it)) + '" alt="">'
      + (lv ? '<span class="lv">' + lv + '</span>' : '')
      + (cnt ? '<span class="cnt">' + cnt + '</span>' : '')
      + '</button>';
  }

  function bagGridHTML() {
    const s = scene;
    let h = '<div class="grid bag">';
    for (let i = 0; i < PAGE_SIZE; i++) {
      const idx = state.page * PAGE_SIZE + i;
      const sel = state.sel && state.sel.src === 'bag' && state.sel.id === idx;
      h += cellHTML(s.bag[idx], 'sel-bag', idx, sel);
    }
    h += '</div>';
    h += '<div class="pager">'
      + '<button data-act="page" data-id="-1">◀ ก่อนหน้า</button>'
      + '<span class="page-no">หน้า ' + (state.page + 1) + ' / ' + PAGES + '</span>'
      + '<button data-act="page" data-id="1">ถัดไป ▶</button>'
      + '</div>';
    return h;
  }

  function equipGridHTML() {
    const s = scene;
    const emptyIcons = { weapon: 'icon_sword', helmet: 'icon_helmet', armor: 'icon_armor', gloves: 'icon_gloves', shoes: 'icon_shoes', ring1: 'icon_ring', ring2: 'icon_ring', necklace: 'icon_necklace' };
    let h = '<div class="grid equip">';
    EQUIP_SLOT_KEYS.forEach((key) => {
      const it = s.equipment[key];
      const name = SLOT_LABELS[baseSlotOf(key)] + (key === 'ring1' ? ' (ซ้าย)' : key === 'ring2' ? ' (ขวา)' : '');
      const sel = state.sel && state.sel.src === 'equip' && state.sel.id === key;
      const lv = it ? 'Lv' + it.level + (it.star > 0 ? ' ' + it.star + '★' : '') : '';
      h += '<button class="cell' + (it ? ' has' : '') + (sel ? ' sel' : '') + '"'
        + (it ? ' style="--c:' + hex(rarityColor(it)) + '"' : '') + ' data-act="sel-equip" data-id="' + key + '">'
        + '<span class="slot-name">' + name + '</span>'
        + '<img src="' + iconSrc(it ? iconKeyForItem(it) : emptyIcons[key]) + '" alt="">'
        + (lv ? '<span class="lv">' + lv + '</span>' : '')
        + '</button>';
    });
    return h + '</div>';
  }

  function detailHTML() {
    const s = scene;
    const sel = state.sel;
    if (!sel) return '<div class="d-empty">แตะไอเทมหรือช่องอุปกรณ์<br>เพื่อดูรายละเอียด</div>';
    const it = sel.src === 'bag' ? s.bag[sel.id] : s.equipment[sel.id];
    if (!it) return '<div class="d-empty">ช่องนี้ยังว่างอยู่</div>';

    const color = hex(rarityColor(it));
    const typeLabel = it.kind === 'box' ? 'กล่องอุปกรณ์'
      : (it.baseSlot === 'weapon' ? 'อาวุธ (' + CLASSES[it.class].label + ')' : SLOT_LABELS[it.baseSlot]);

    let h = '<div class="d-top" style="--c:' + color + '">'
      + '<div class="d-icon"><img src="' + iconSrc(iconKeyForItem(it)) + '" alt=""></div>'
      + '<div><div class="d-name">' + itemLabel(it) + '</div><div class="d-type">' + typeLabel + '</div></div></div>';

    if (it.kind === 'equip') {
      const st = computeItemStats(it);
      const keys = Object.keys(st);
      h += keys.length
        ? '<div class="d-stats">' + keys.map((k) => '<div><span>' + k.toUpperCase() + '</span><span>+' + st[k] + '</span></div>').join('') + '</div>'
        : '<div class="d-note">ไม่มีค่าพลังพิเศษ</div>';
      h += '<div class="d-row"><span>ระดับ</span><span>Lv.' + it.level + '</span></div>'
        + '<div class="d-row"><span>ระดับดาว</span><span>' + (it.star > 0 ? it.star + ' ★ / ' + MAX_STAR : '- (ยังไม่อัพดาว)') + '</span></div>'
        + '<div class="d-row"><span>อัพดาว</span><span>รวมของเหมือนกัน 2 ชิ้น</span></div>';
    } else {
      h += '<div class="d-note">เปิดแล้วจะได้อุปกรณ์สุ่ม 1 ชิ้น (เลเวล ' + it.level + ')</div>'
        + '<div class="d-row"><span>เลเวลกล่อง</span><span>Lv.' + it.level + '</span></div>'
        + '<div class="d-row"><span>จำนวนคงเหลือ</span><span>x' + (it.count || 1) + '</span></div>';
    }

    h += '<div class="d-actions">';
    if (sel.src === 'equip') {
      h += '<button class="btn danger" data-act="unequip">ถอดอุปกรณ์</button>';
    } else if (it.kind === 'box') {
      h += '<button class="btn ok" data-act="open-box">เปิดกล่อง</button>';
    } else if (it.baseSlot === 'ring') {
      h += '<button class="btn ok" data-act="wear" data-id="ring1">ใส่แหวนซ้าย</button>'
        + '<button class="btn ok" data-act="wear" data-id="ring2">ใส่แหวนขวา</button>'
        + '<button class="btn info" data-act="merge">🔗 รวมดาว</button>';
    } else {
      h += '<button class="btn ok" data-act="wear" data-id="' + it.baseSlot + '">สวมใส่</button>'
        + '<button class="btn info" data-act="merge">🔗 รวมดาว</button>';
    }
    return h + '</div>';
  }

  function render() {
    const s = scene;
    const used = s.bag.filter(Boolean).length;
    root.innerHTML =
      '<div class="win-head"><span class="win-title">กระเป๋า</span><button class="win-x" data-act="close">✕</button></div>'
      + '<div class="win-tabs">'
      + '<button class="win-tab' + (state.tab === 'bag' ? ' on' : '') + '" data-act="tab" data-id="bag">กระเป๋า</button>'
      + '<button class="win-tab' + (state.tab === 'equip' ? ' on' : '') + '" data-act="tab" data-id="equip">อุปกรณ์</button>'
      + '<span class="spacer"></span>'
      + (state.tab === 'bag' ? '<button class="win-tab act" data-act="merge-all">🔗 รวมอุปกรณ์ทั้งหมด</button>' : '')
      + '</div>'
      + '<div class="win-body">'
      + '<div class="win-left">' + (state.tab === 'bag' ? bagGridHTML() : equipGridHTML()) + '</div>'
      + '<div class="win-right">' + detailHTML() + '</div>'
      + '</div>'
      + '<div class="win-foot"><span>ช่อง ' + used + ' / ' + s.bag.length + '</span>'
      + '<span class="gold">🪙 ' + Number(s.stats.gold).toLocaleString() + '</span>'
      + '<span class="msg" id="bw-msg">' + (state.msg || '') + '</span></div>';
  }

  // ---------- การกดปุ่ม ----------
  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const s = scene;
    const act = el.dataset.act;
    const id = el.dataset.id;
    const sel = state.sel;

    if (act === 'close') { s.closePanel(); return; }
    if (act === 'tab') { state.tab = id; state.sel = null; }
    else if (act === 'page') { state.page = Math.max(0, Math.min(PAGES - 1, state.page + Number(id))); state.sel = null; }
    else if (act === 'sel-bag') state.sel = { src: 'bag', id: Number(id) };
    else if (act === 'sel-equip') state.sel = { src: 'equip', id: id };
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
      const item = s.bag[sel.id];
      if (item && item.kind === 'box') {
        item.count -= 1;
        if (item.count <= 0) s.bag[sel.id] = null;
        s.addEquipItemToBag(randomEquipItem(item.level));
      }
      state.sel = null;
    }
    else if (act === 'unequip' && sel && sel.src === 'equip') {
      s.unequipSlot(sel.id);
      state.sel = null;
    }
    render();
  }

  // ---------- เชื่อมกับเกมเดิม ----------
  Main.prototype.openInventory = function (tab, page) {
    scene = this;
    ensureRoot();
    state.tab = tab || state.tab || 'bag';
    if (page !== undefined) state.page = page;
    state.sel = null;
    this.invTab = state.tab;
    this.invPage = state.page;
    render();
    root.style.display = 'flex';
    this.panel = []; // ให้โค้ดเดิมรู้ว่ามีหน้าต่างเปิดอยู่
  };

  const origClosePanel = Main.prototype.closePanel;
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
