// ===== หน้าต่างกระเป๋า / อุปกรณ์ (HTML ซ้อนบนแคนวาส) =====
// แทนที่ openInventory เดิม แต่ใช้ข้อมูลและฟังก์ชันเดิมทั้งหมด
// (this.bag, this.equipment, equipItem, unequipSlot, mergeSingleItem, mergeAllInBag ...)
// รองรับไอเทม "หนังสือสกิล" (kind: 'skillbook') ซ้อนได้ กดใช้เพื่อเรียนรู้/อัปสกิล
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

  // ---- ตัวช่วยรองรับหนังสือสกิล (ไม่ต้องแก้ items.js) ----
  const isBook = (it) => !!it && it.kind === 'skillbook';
  const itemIcon = (it) => isBook(it) ? skillIconKey(SKILL_DEFS[it.sid].type) : iconKeyForItem(it);
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
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 200));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);

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
    const stackable = it.kind === 'box' || isBook(it);
    const cnt = stackable && it.count > 1 ? 'x' + it.count : '';
    return '<button class="cell has' + (selected ? ' sel' : '') + '" style="--c:' + hex(itemColor(it)) + '" data-act="' + act + '" data-id="' + id + '">'
      + '<img src="' + iconSrc(itemIcon(it)) + '" alt="">'
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

  function detailHTML() {
    const s = scene;
    const sel = state.sel;
    if (!sel) return '<div class="d-empty">แตะไอเทมหรือช่องอุปกรณ์<br>เพื่อดูรายละเอียด</div>';
    const it = sel.src === 'bag' ? s.bag[sel.id] : s.equipment[sel.id];
    if (!it) return '<div class="d-empty">ช่องนี้ยังว่างอยู่</div>';

    if (isBook(it)) return bookDetailHTML(it);

    const color = hex(itemColor(it));
    const typeLabel = it.kind === 'box' ? 'กล่องอุปกรณ์'
      : (it.baseSlot === 'weapon' ? 'อาวุธ (' + CLASSES[it.class].label + ')' : SLOT_LABELS[it.baseSlot]);

    let h = '<div class="d-top" style="--c:' + color + '">'
      + '<div class="d-icon"><img src="' + iconSrc(itemIcon(it)) + '" alt=""></div>'
      + '<div><div class="d-name">' + itemName(it) + '</div><div class="d-type">' + typeLabel + '</div></div></div>';

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
    else if (act === 'use-book' && sel && sel.src === 'bag') {
      s.useSkillBook(sel.id);
      if (!s.bag[sel.id]) state.sel = null;   // หนังสือหมดกอง -> ยกเลิกการเลือก
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
    fit();
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
