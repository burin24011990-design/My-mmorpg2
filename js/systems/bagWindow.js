// ===== หน้าต่างกระเป๋า / อุปกรณ์ (HTML ซ้อนบนแคนวาส) =====
// แทนที่ openInventory เดิม แต่ใช้ข้อมูลและฟังก์ชันเดิมทั้งหมด
// (this.bag, this.equipment, equipItem, unequipSlot, mergeSingleItem, mergeAllInBag ...)
// รองรับไอเทม "หนังสือสกิล" (kind: 'skillbook') ซ้อนได้ กดใช้เพื่อเรียนรู้/อัปสกิล
// รองรับ "หินตีบวก" (kind: 'stone'), ตีบวก และย่อยอุปกรณ์ (ดู enhance.js)
// ต้องโหลดหลัง fixes.js และก่อน main.js
(function () {
  // ใส่ไฟล์รูปจริงของไอคอนที่นี่ได้ ถ้าไม่ใส่จะใช้รูปที่เกมวาดไว้ตามเดิม
  // ตัวอย่าง: icon_sword: 'assets/icons/sword.png'
  const ICON_FILES = {};

  const iconCache = {};
  const state = { tab: 'bag', page: 0, sel: null, msg: '', qty: 1 };
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
    if (!document.getElementById('bag-qty-style')) {
      const st = document.createElement('style');
      st.id = 'bag-qty-style';
      st.textContent =
        '#bag-win .bag-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px}'
        + '#bag-win .bag-tools button{min-height:28px;padding:3px 7px;font-size:11px;white-space:nowrap;border:1px solid #3a4150;background:#1c2230;color:var(--text);border-radius:6px}'
        + '#bag-win .bag-tools button:active{background:#2a3550}'
        + '#bag-win .bag-tools .qty{display:flex;align-items:center;gap:2px;padding:0 3px;border:1px solid #2a3142;border-radius:6px;background:#10151e}'
        + '#bag-win .bag-tools .qty button{border:0;background:transparent;padding:3px 6px}'
        + '#bag-win .bag-tools .qty b{min-width:26px;text-align:center;color:var(--gold);font-size:13px}'
        + '#bag-win .cell .pl{position:absolute;top:0;left:1px;font-size:7px;line-height:1;color:#ff9a3c;font-weight:700;text-shadow:0 0 2px #000,0 0 2px #000}'
        + '#bag-win .cell .st{position:absolute;top:0;right:1px;font-size:6px;line-height:1;color:#8fd0ff;text-shadow:0 0 2px #000,0 0 2px #000}';
      document.head.appendChild(st);
    }
  }

  function hide() { if (root) root.style.display = 'none'; state.sel = null; }

  // ---------- จำนวนที่เลือก (ใช้กับ เปิดกล่อง / ย่อยกล่อง / รวมดาว) ----------
  function selBagItem() {
    const sel = state.sel;
    return sel && sel.src === 'bag' ? scene.bag[sel.id] : null;
  }
  function maxQty() {
    const it = selBagItem();
    if (!it) return 1;
    if (it.kind === 'box') return Math.max(1, it.count || 1);
    if (it.kind === 'equip') return Math.max(1, Math.floor(scene.countMatches(state.sel.id) / 2));
    return 1;
  }
  function clampQty() { state.qty = Math.max(1, Math.min(state.qty, maxQty())); }

  function toolbarHTML() {
    return '<div class="bag-tools">'
      + '<span class="qty"><button data-act="qty" data-id="-1">−</button><b>' + state.qty + '</b>'
      + '<button data-act="qty" data-id="1">+</button><button data-act="qty" data-id="max">MAX</button></span>'
      + '<button data-act="merge-all">🔗 รวมทั้งหมด</button>'
      + '<button data-act="merge-sel">🔗 รวมที่เลือก ×' + state.qty + '</button>'
      + '<button data-act="sort-bag">🧹 จัดกระเป๋า</button>'
      + '</div>';
  }

  // ---------- ส่วนแสดงผล ----------
  function cellHTML(it, act, id, selected) {
    if (!it) return '<button class="cell"></button>';
    const lv = it.kind === 'equip' ? 'Lv' + it.level : '';
    const pl = it.kind === 'equip' && it.plus > 0 ? '+' + it.plus : '';
    const st = it.kind === 'equip' && it.star > 0 ? it.star + '★' : '';
    const stackable = it.kind === 'box' || it.kind === 'stone' || isBook(it);
    const cnt = stackable && it.count > 1 ? 'x' + it.count : '';
    return '<button class="cell has' + (selected ? ' sel' : '') + '" style="--c:' + hex(itemColor(it)) + '" data-act="' + act + '" data-id="' + id + '">'
      + '<img src="' + iconSrc(itemIcon(it)) + '" alt="">'
      + (pl ? '<span class="pl">' + pl + '</span>' : '')
      + (st ? '<span class="st">' + st + '</span>' : '')
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
    h += toolbarHTML();
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
    return '<div class="d-top" style="--c:#6fc3ff"><div class="d-icon"><img src="' + iconSrc('icon_stone') + '" alt=""></div>'
      + '<div><div class="d-name">' + itemName(it) + '</div><div class="d-type">วัสดุตีบวก</div></div></div>'
      + '<div class="d-note">ได้จากการย่อยอุปกรณ์ ใช้ตีบวก (เลือกอุปกรณ์แล้วกด 🔨 ตีบวก)</div>'
      + '<div class="d-row"><span>รวมในกระเป๋า</span><span>' + scene.countStones() + ' ก้อน</span></div>';
  }

  function detailHTML() {
    const s = scene;
    const sel = state.sel;
    if (!sel) return '<div class="d-empty">แตะไอเทมหรือช่องอุปกรณ์<br>เพื่อดูรายละเอียด</div>';
    const it = sel.src === 'bag' ? s.bag[sel.id] : s.equipment[sel.id];
    if (!it) return '<div class="d-empty">ช่องนี้ยังว่างอยู่</div>';

    if (isBook(it)) return bookDetailHTML(it);
    if (it.kind === 'stone') return stoneDetailHTML(it);

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
    } else {
      h += '<div class="d-note">เปิดแล้วจะได้อุปกรณ์สุ่ม 1 ชิ้น (เลเวล ' + it.level + ')</div>'
        + '<div class="d-row"><span>เลเวลกล่อง</span><span>Lv.' + it.level + '</span></div>'
        + '<div class="d-row"><span>จำนวนคงเหลือ</span><span>x' + (it.count || 1) + '</span></div>'
        + '<div class="d-row"><span>ย่อยกล่องได้หิน</span><span>' + window.boxStoneYield(it.level) + ' ก้อน/ใบ</span></div>';
    }

    h += '<div class="d-actions">';
    if (sel.src === 'equip') {
      h += '<button class="btn danger" data-act="unequip">ถอดอุปกรณ์</button>';
    } else if (it.kind === 'box') {
      const q = Math.min(state.qty, it.count || 1);
      h += '<button class="btn ok" data-act="open-box">เปิดกล่อง ×' + q + '</button>'
        + '<button class="btn danger" data-act="dismantle-box">♻ ย่อยกล่อง ×' + q + '</button>';
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
        + (sel.src === 'bag' ? '<button class="btn danger" data-act="dismantle">♻ ย่อย</button>' : '');
    }
    return h + '</div>';
  }

  function render() {
    const s = scene;
    const used = s.bag.filter(Boolean).length;
    clampQty();
    root.innerHTML =
      '<div class="win-head"><span class="win-title">กระเป๋า</span><button class="win-x" data-act="close">✕</button></div>'
      + '<div class="win-tabs">'
      + '<button class="win-tab' + (state.tab === 'bag' ? ' on' : '') + '" data-act="tab" data-id="bag">กระเป๋า</button>'
      + '<button class="win-tab' + (state.tab === 'equip' ? ' on' : '') + '" data-act="tab" data-id="equip">อุปกรณ์</button>'
      + '<span class="spacer"></span>'
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
    if (act === 'tab') { state.tab = id; state.sel = null; state.qty = 1; }
    else if (act === 'page') { state.page = Math.max(0, Math.min(PAGES - 1, state.page + Number(id))); state.sel = null; state.qty = 1; }
    else if (act === 'sel-bag') { state.sel = { src: 'bag', id: Number(id) }; state.qty = 1; }
    else if (act === 'sel-equip') { state.sel = { src: 'equip', id: id }; state.qty = 1; }
    else if (act === 'qty') {
      state.qty = id === 'max' ? maxQty() : state.qty + Number(id);
    }
    else if (act === 'merge-sel') {
      if (sel && sel.src === 'bag') { if (s.mergeSelectedCount(sel.id, state.qty)) state.sel = null; }
      else s.toastMsg('เลือกอุปกรณ์ในกระเป๋าก่อน');
    }
    else if (act === 'sort-bag') { s.sortBag(); state.sel = null; state.qty = 1; }
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
