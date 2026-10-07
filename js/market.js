// ===== ตลาดกลาง (js/market.js) v7 — ผูกกับ NPC id 'market' ใน town.js =====
// ต้องโหลดหลัง town.js, หลัง goldSync.js และหลัง firebase-functions-compat.js
// ฟีเจอร์: หมวดหมู่ + ค้นหา + เรียงราคา | ขายได้เฉพาะของแรร์ | ตั๋วลงขาย (เก็บที่เซิร์ฟเวอร์) | ผู้ขายนิรนาม
// v7: ซื้อของ = เซิร์ฟเวอร์หักทองเอง (ผ่าน GoldSync.tx) | รับทองจากกล่อง = เซิร์ฟเวอร์เติมให้ (GoldSync.credit)
//     ส่ง reqId + ลองใหม่เมื่อเน็ตสะดุด (ซื้อ/ลงขาย/รับของ ไม่ซ้ำ ไม่หาย) | เก็บรายการลงขายที่ค้างไว้ตรวจใหม่ตอนเปิดตลาด
//     แก้บั๊ก: รับของหลายชิ้นตอนกระเป๋าใกล้เต็มแล้วของหาย
(function () {
  const REGION = 'asia-southeast1';   // ต้องตรงกับ functions/market.js
  const SHOW_LIMIT = 100;             // แสดงสูงสุดกี่รายการในหน้าซื้อ
  const BUY_TICKET_URL = '';          // หน้าชำระเงินสำหรับซื้อตั๋ว (ว่าง = ยังไม่เปิดขาย)
  const TIER_RANK = ['white', 'blue', 'red', 'gold'];
  const PEND_KEY = 'mkt_pending_list_v1';

  // หมวดหมู่ในหน้าซื้อ
  const CATS = [
    { id: 'all', name: 'ทั้งหมด' },
    { id: 'box', name: '📦 กล่อง' },
    { id: 'equip', name: '⚔️ อุปกรณ์' },
    { id: 'gem', name: '💎 อัญมณี' },
    { id: 'stone', name: '🪨 หินตีบวก' },
    { id: 'book', name: '📖 สมุดสกิล' },
    { id: 'other', name: 'อื่นๆ' }
  ];
  function categoryOf(it) {
    if (!it) return 'other';
    if (it.kind === 'box') return 'box';
    if (it.kind === 'equip') return 'equip';
    if (it.kind === 'optstone' || it.kind === 'cleanstone') return 'gem';   // หินสุ่มออฟ / หินลบออฟ = อัญมณี
    if (it.kind === 'stone') return 'stone';
    if (it.kind === 'skillbook') return 'book';
    return 'other';
  }

  // ---------- กฎจากเซิร์ฟเวอร์ (R = rules) ----------
  function tierKey(it) { return (typeof tierOf === 'function') ? tierOf(it) : (it.tier || 'white'); }
  function sellBlock(it, R) {          // เหตุผลที่ขายไม่ได้ หรือ '' ถ้าขายได้
    if (!it) return 'ขายไม่ได้';
    if (it.kind === 'box' || it.kind === 'equip') return TIER_RANK.indexOf(tierKey(it)) >= 2 ? '' : 'ขายได้เฉพาะสีแดงขึ้นไป';
    if (it.kind === 'optstone' || it.kind === 'cleanstone' || it.kind === 'skillbook') return '';
    if (it.kind === 'stone') return (it.count || 1) >= R.stoneStack ? '' : 'หินตีบวกต้องเป็นกองเต็ม ' + R.stoneStack.toLocaleString() + ' ก้อน';
    return 'ไอเทมชนิดนี้ขายในตลาดไม่ได้';
  }
  function maxUnitPrice(it, R) {
    const C = R.cap, t = tierKey(it);
    let c;
    if (it.kind === 'box') c = C.box[t];
    else if (it.kind === 'equip') c = C.equip[t] * (1 + C.equipPlusBonus * (it.plus || 0) + C.equipStarBonus * (it.star || 0));
    else if (it.kind === 'optstone') c = C.optstone;
    else if (it.kind === 'cleanstone') c = C.cleanstone;
    else if (it.kind === 'stone') c = C.stone;
    else c = C.book;
    return Math.min(R.maxPrice, Math.floor(c));
  }
  function minUnitPrice(it, R) {       // ราคาต่ำสุดต่อชิ้น (ตรงกับฝั่งเซิร์ฟเวอร์)
    return Math.max(1, Math.floor(maxUnitPrice(it, R) * (R.minPriceRatio || 0)));
  }
  function ticketFor(R, total) { return total <= R.ticketMax[1] ? 1 : (total <= R.ticketMax[2] ? 2 : 3); }
  function ticketName(R, tk) {
    return 'ตั๋วลงขาย (ไม่เกิน ' + (tk === 3 ? R.maxPrice.toLocaleString() : (R.ticketMax[tk] / 1000000) + ' ล้าน') + ')';
  }

  let fns = null;
  function call(name, data) {
    if (!fns) fns = firebase.app().functions(REGION);
    return fns.httpsCallable(name)(data || {}).then(function (r) { return r.data; });
  }
  function errMsg(e) { return (e && e.message) ? e.message : 'เกิดข้อผิดพลาด'; }
  // ข้อผิดพลาดที่ "ไม่แน่ใจว่าเซิร์ฟเวอร์ทำไปหรือยัง" (เน็ตหลุด/หมดเวลา) -> ส่งซ้ำด้วย reqId เดิมได้อย่างปลอดภัย
  function uncertain(e) { return /unavailable|deadline|internal|unknown/.test(String((e && e.code) || '')); }
  function callRetry(name, data, n) {
    return call(name, data).catch(function (e) {
      if (n > 0 && uncertain(e)) return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return callRetry(name, data, n - 1); });
      throw e;
    });
  }
  function rid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

  // รายการลงขายที่ยังไม่รู้ผล (เก็บในเครื่อง เผื่อปิดเกม/เน็ตหลุดกลางคัน)
  function pendGet() { try { return JSON.parse(localStorage.getItem(PEND_KEY) || 'null'); } catch (e) { return null; } }
  function pendSet(v) { try { if (v) localStorage.setItem(PEND_KEY, JSON.stringify(v)); else localStorage.removeItem(PEND_KEY); } catch (e) {} }

  // ---------- ช่วยจัดการกระเป๋า ----------
  function capOf(it) {
    if (it.kind === 'box' && typeof MAX_BOX_STACK !== 'undefined') return MAX_BOX_STACK;
    if ((it.kind === 'stone' || it.kind === 'optstone' || it.kind === 'cleanstone') && typeof MAX_STONE_STACK !== 'undefined') return MAX_STONE_STACK;
    if (it.kind === 'skillbook' && typeof MAX_SKILLBOOK_STACK !== 'undefined') return MAX_SKILLBOOK_STACK;
    return 999;
  }
  function key(it) { const c = Object.assign({}, it); delete c.count; return JSON.stringify(c); }
  function canAdd(m, it) {
    if (it.count === undefined) return m.bag.some(function (s) { return s === null; });
    const cap = capOf(it), k = key(it);
    let room = 0;
    m.bag.forEach(function (s) {
      if (s === null) room += cap;
      else if (s.count !== undefined && s.kind === it.kind && key(s) === k) room += cap - s.count;
    });
    return room >= it.count;
  }
  function addToBag(m, it) {
    if (!canAdd(m, it)) return false;
    if (it.count === undefined) { m.bag[m.bag.findIndex(function (s) { return s === null; })] = it; return true; }
    const cap = capOf(it), k = key(it);
    let left = it.count;
    m.bag.forEach(function (s) {
      if (left > 0 && s && s.count !== undefined && s.kind === it.kind && key(s) === k && s.count < cap) {
        const a = Math.min(left, cap - s.count); s.count += a; left -= a;
      }
    });
    while (left > 0) {
      const i = m.bag.findIndex(function (s) { return s === null; });
      const a = Math.min(left, cap);
      m.bag[i] = Object.assign({}, it, { count: a }); left -= a;
    }
    return true;
  }
  function label(it) {
    try {
      if (it.kind === 'skillbook') {
        const d = (typeof SKILL_DEFS !== 'undefined') ? SKILL_DEFS[it.sid] : null;
        return 'สมุดสกิล ' + ((d && (d.name || d.label)) || it.sid) + (it.count > 1 ? '  x' + it.count : '');
      }
      return itemLabel(it);
    } catch (e) { return it.kind; }
  }
  function leftTxt(l) {
    if (typeof l.expiresAt !== 'number') return '';
    const ms = l.expiresAt - Date.now();
    if (ms <= 0) return 'หมดอายุแล้ว';
    const h = Math.floor(ms / 3600000), mi = Math.floor((ms % 3600000) / 60000);
    return 'เหลือ ' + (h ? h + ' ชม. ' : '') + mi + ' นาที';
  }

  // ---------- UI ----------
  function btn(text, fn, primary) {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = 'font-family:inherit;font-size:13px;padding:6px 10px;border-radius:8px;cursor:pointer;border:2px solid #ffd45c;' +
      'color:' + (primary ? '#26090f' : '#ffe28a') + ';background:' + (primary ? '#ffd45c' : '#26090f');
    b.addEventListener('click', fn);
    return b;
  }
  const iconCache = {};
  function rarHex(it) { try { return '#' + ('000000' + rarityColor(it).toString(16)).slice(-6); } catch (e) { return '#8a6a32'; } }
  // หารูปไอเทม: ลองคีย์จาก iconKeyForItem ก่อน แล้วสำรองด้วยชื่อรูปจาก assets/items (img_*)
  function iconKeys(it) {
    const ks = [];
    if (it.kind === 'ticket' || it.kind === 'skillbook') return ks;
    try { ks.push(iconKeyForItem(it)); } catch (e) {}
    if (it.kind === 'equip') {
      if (it.baseSlot === 'weapon' && it.class) ks.push('img_weapon_' + it.class);
      ks.push('img_' + it.baseSlot);
    } else if (it.kind === 'optstone') ks.push('img_opt_' + it.color, 'icon_opt_' + it.color);
    else ks.push('img_' + it.kind);
    return ks;
  }
  function iconSrc(m, it) {
    const ks = iconKeys(it);
    for (let i = 0; i < ks.length; i++) {
      const k = ks[i];
      if (!k || !m.textures.exists(k)) continue;
      if (iconCache[k]) return iconCache[k];
      try {
        const d = m.textures.getBase64(k);
        if (d) { iconCache[k] = d; return d; }
      } catch (e) {}
    }
    return null;
  }
  function icon(m, it) {
    const w = document.createElement('div');
    w.style.cssText = 'width:46px;height:46px;flex:none;position:relative;border-radius:8px;background:#1c0a0f;display:flex;align-items:center;justify-content:center;border:2px solid ' +
      (it.kind === 'ticket' ? '#ffd45c' : rarHex(it));
    const src = iconSrc(m, it);
    if (src) {
      const im = document.createElement('img');
      im.src = src; im.style.cssText = 'width:36px;height:36px;image-rendering:pixelated;object-fit:contain';
      w.appendChild(im);
    } else { w.textContent = it.kind === 'ticket' ? '🎫' : (it.kind === 'skillbook' ? '📖' : '📦'); w.style.fontSize = '22px'; }
    if (it.count > 1) {
      const c = document.createElement('span');
      c.textContent = 'x' + it.count;
      c.style.cssText = 'position:absolute;right:1px;bottom:0;font-size:11px;color:#fff;text-shadow:-1px 0 #000,1px 0 #000,0 -1px #000,0 1px #000';
      w.appendChild(c);
    }
    return w;
  }
  function row(left, right, ic) {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;margin-bottom:4px;border-radius:8px;background:#3a1620;font-size:13px;text-align:left';
    const l = document.createElement('div'); l.style.cssText = 'flex:1;min-width:0'; l.innerHTML = left;
    if (ic) r.append(ic);
    r.append(l); if (right) r.append(right);
    return r;
  }
  function priceTxt(l) {
    const n = l.item.count || 1;
    return n > 1 ? '💰 ' + l.price.toLocaleString() + ' (ชิ้นละ ' + Math.round(l.price / n).toLocaleString() + ')' : '💰 ' + l.price.toLocaleString();
  }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function chip(text, on, fn) {
    const b = btn(text, fn, on);
    b.style.flex = 'none'; b.style.whiteSpace = 'nowrap'; b.style.padding = '5px 9px'; b.style.fontSize = '12px';
    return b;
  }

  // ================= หน้าต่างตั้งจำนวน + ราคา (แทน window.prompt) =================
  // คืน Promise<{qty, unit} | null>  (null = ยกเลิก)
  function sellDialog(m, it, R, w) {
    return new Promise(function (resolve) {
      const stack = it.count !== undefined && it.count > 1 && it.kind !== 'stone';   // เลือกจำนวนได้
      const maxQty = it.count === undefined ? 1 : it.count;
      const cap = maxUnitPrice(it, R), floor = Math.min(minUnitPrice(it, R), cap);
      const tkMap = w.tickets || {};
      const quotaLeft = w.dailyLimit - w.listedToday;
      let qty = it.kind === 'stone' ? it.count : (stack ? it.count : 1);
      let unit = cap;

      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:8px;box-sizing:border-box;touch-action:pan-y';
      const pn = document.createElement('div');
      pn.style.cssText = 'width:min(96vw,680px);max-height:96vh;overflow:auto;box-sizing:border-box;background:#26090f;border:2px solid #ffd45c;border-radius:14px;padding:12px 14px;color:#ffe28a;font-family:inherit;text-align:left;box-shadow:0 8px 30px rgba(0,0,0,.6)';
      ov.appendChild(pn);

      function mk(tag, css, txt) { const e = document.createElement(tag); if (css) e.style.cssText = css; if (txt !== undefined) e.textContent = txt; return e; }
      const small = 'font-size:11px;color:#bbb;margin-bottom:3px';

      // ส่วนหัว: รูป + ชื่อ
      const head = mk('div', 'display:flex;gap:10px;align-items:center;margin-bottom:10px');
      head.appendChild(icon(m, it));
      const ht = mk('div', 'flex:1;min-width:0');
      ht.appendChild(mk('div', 'font-size:16px;font-weight:600;color:#fff;line-height:1.3', label(it)));
      ht.appendChild(mk('div', 'font-size:11px;color:#bbb', 'ตั้งราคา "ต่อชิ้น" • ต่ำสุด ' + floor.toLocaleString() + ' • สูงสุด ' + cap.toLocaleString()));
      head.appendChild(ht);
      const x = btn('✕', function () { done(null); });
      x.style.flex = 'none'; x.style.padding = '4px 9px';
      head.appendChild(x);
      pn.appendChild(head);

      const cols = mk('div', 'display:flex;gap:12px;flex-wrap:wrap');
      const left = mk('div', 'flex:1 1 280px;min-width:0');
      const right = mk('div', 'flex:1 1 220px;min-width:0');
      cols.append(left, right);
      pn.appendChild(cols);

      function numInput(val, onChange) {
        const i = document.createElement('input');
        i.type = 'text'; i.inputMode = 'numeric'; i.autocomplete = 'off'; i.value = String(val);
        i.style.cssText = 'flex:1;min-width:0;box-sizing:border-box;text-align:center;padding:8px 6px;border-radius:8px;border:2px solid #ffd45c;background:#0d0406;color:#fff;font-family:inherit;font-size:18px';
        i.addEventListener('focus', function () { try { i.select(); } catch (e) {} });
        i.addEventListener('input', function () {
          const d = i.value.replace(/[^0-9]/g, '').slice(0, 9);
          if (i.value !== d) i.value = d;
          onChange(d === '' ? 0 : parseInt(d, 10), true);
        });
        return i;
      }
      function sq(text, fn) {       // ปุ่มสี่เหลี่ยมสำหรับ + / -
        const b = btn(text, fn, false);
        b.style.cssText += ';width:42px;flex:none;font-size:20px;padding:4px 0;line-height:1';
        return b;
      }
      function chipRow(items) {
        const r = mk('div', 'display:flex;gap:5px;flex-wrap:wrap;margin-top:6px');
        items.forEach(function (c) { r.appendChild(chip(c[0], false, c[1])); });
        return r;
      }

      // ----- จำนวน -----
      let qtyIn = null;
      if (stack) {
        left.appendChild(mk('div', small, 'จำนวนที่จะขาย (มี ' + maxQty.toLocaleString() + ')'));
        const qr = mk('div', 'display:flex;gap:6px;align-items:stretch');
        qtyIn = numInput(qty, function (v, fromTyping) { qty = Math.min(maxQty, Math.max(0, v)); if (!fromTyping || qty !== v) qtyIn.value = String(qty || ''); refresh(); });
        qr.append(sq('−', function () { setQty(qty - 1); }), qtyIn, sq('+', function () { setQty(qty + 1); }));
        left.appendChild(qr);
        const qc = [['1', 1], ['½', Math.max(1, Math.floor(maxQty / 2))], ['MAX', maxQty]].map(function (c) {
          return [c[0], function () { setQty(c[1]); }];
        });
        left.appendChild(chipRow(qc));
      } else {
        const fixed = mk('div', 'font-size:13px;color:#ddd;margin-bottom:6px', it.kind === 'stone'
          ? 'หินตีบวกขายยกกองเต็ม ' + qty.toLocaleString() + ' ก้อน'
          : 'ขาย 1 ชิ้น');
        left.appendChild(fixed);
      }
      function setQty(v) { qty = Math.min(maxQty, Math.max(1, v)); if (qtyIn) qtyIn.value = String(qty); refresh(); }

      // ----- ราคาต่อชิ้น -----
      left.appendChild(mk('div', small + ';margin-top:10px', 'ราคาต่อชิ้น (ทอง)'));
      const pr = mk('div', 'display:flex;gap:6px;align-items:stretch');
      const unitIn = numInput(unit, function (v) { unit = v; refresh(); });
      const step = Math.max(1, Math.round(cap / 100));
      pr.append(sq('−', function () { setUnit(unit - step); }), unitIn, sq('+', function () { setUnit(unit + step); }));
      left.appendChild(pr);
      function setUnit(v) { unit = Math.min(cap, Math.max(1, v)); unitIn.value = String(unit); refresh(); }
      left.appendChild(chipRow([
        ['ต่ำสุด', function () { setUnit(floor); }],
        ['25%', function () { setUnit(Math.max(floor, Math.floor(cap * 0.25))); }],
        ['50%', function () { setUnit(Math.max(floor, Math.floor(cap * 0.5))); }],
        ['75%', function () { setUnit(Math.max(floor, Math.floor(cap * 0.75))); }],
        ['สูงสุด', function () { setUnit(cap); }]
      ]));

      // ----- สรุป (ฝั่งขวา) -----
      const sum = mk('div', 'background:#3a1620;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.9');
      function line(k, vEl) {
        const r = mk('div', 'display:flex;justify-content:space-between;gap:8px');
        r.appendChild(mk('span', 'color:#bbb', k)); r.appendChild(vEl);
        sum.appendChild(r);
        return vEl;
      }
      const vTotal = line('ราคารวม', mk('b', 'color:#fff'));
      const vTax = line('ภาษีขาย ' + Math.round(R.tax * 100) + '%', mk('span', 'color:#e08a8a'));
      const vNet = line('ได้รับสุทธิ', mk('b', 'color:#7be07b;font-size:16px'));
      const vTk = line('ตั๋วที่ใช้', mk('span', 'color:#fff;text-align:right'));
      line('อยู่ในตลาด', mk('span', 'color:#fff', R.listHours + ' ชม.'));
      line('โควตาวันนี้', mk('span', 'color:#fff', w.listedToday + '/' + w.dailyLimit));
      right.appendChild(sum);

      const warn = mk('div', 'color:#ff9a9a;font-size:12px;min-height:16px;margin-top:6px');
      right.appendChild(warn);

      const act = mk('div', 'display:flex;gap:8px;margin-top:8px');
      const cancelB = btn('ยกเลิก', function () { done(null); });
      cancelB.style.flex = '1'; cancelB.style.padding = '10px';
      const okB = btn('ลงขาย', function () { if (!okB.disabled) done({ qty: qty, unit: unit }); }, true);
      okB.style.flex = '2'; okB.style.padding = '10px'; okB.style.fontSize = '15px';
      act.append(cancelB, okB);
      right.appendChild(act);

      function refresh() {
        const total = unit * qty;
        const net = Math.floor(total * (1 - R.tax));
        const tk = ticketFor(R, Math.max(1, total));
        const have = tkMap[tk] || 0;
        vTotal.textContent = '💰 ' + total.toLocaleString();
        vTax.textContent = '−' + (total - net).toLocaleString();
        vNet.textContent = '💰 ' + net.toLocaleString();
        vTk.textContent = ticketName(R, tk) + ' (มี ' + have + ')';
        vTk.style.color = have > 0 ? '#fff' : '#ff9a9a';
        let why = '';
        if (qty < 1) why = 'ใส่จำนวนอย่างน้อย 1';
        else if (unit < floor) why = 'ราคาต่ำสุดต่อชิ้น ' + floor.toLocaleString();
        else if (unit > cap) why = 'ราคาสูงสุดต่อชิ้น ' + cap.toLocaleString();
        else if (total > R.maxPrice) why = 'ราคารวมต้องไม่เกิน ' + R.maxPrice.toLocaleString();
        else if (have < 1) why = 'ไม่มี ' + ticketName(R, tk) + ' (ดูที่แท็บ 🎫 ตั๋ว)';
        else if (quotaLeft < 1) why = 'ลงขายครบ ' + w.dailyLimit + ' รายการใน 24 ชม. แล้ว';
        warn.textContent = why;
        okB.disabled = !!why;
        okB.style.opacity = why ? '.4' : '1';
        okB.style.cursor = why ? 'not-allowed' : 'pointer';
      }

      function done(r) { if (ov.parentNode) ov.parentNode.removeChild(ov); resolve(r); }
      ov.addEventListener('click', function (e) { if (e.target === ov) done(null); });
      document.body.appendChild(ov);
      refresh();
    });
  }

  function openMarket(scene) {
    const m = townMain(scene);
    if (!m) return;
    if (!window.firebase || !firebase.functions) { scene.dialog('🏪 ตลาดกลาง', 'ยังไม่ได้โหลด firebase-functions (ดูขั้นตอนใน index.html)', [{ label: 'ตกลง', primary: true }]); return; }
    const u = firebase.auth().currentUser;
    if (!u) { scene.dialog('🏪 ตลาดกลาง', 'ต้องล็อกอินด้วย Google ก่อนจึงจะใช้ตลาดได้', [{ label: 'ตกลง', primary: true }]); return; }

    const card = scene.domCard('🏪 ตลาดกลาง');
    const goldEl = document.createElement('div');
    goldEl.style.cssText = 'color:#ffe28a;font-size:14px;margin-bottom:6px';
    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;gap:6px;justify-content:center;margin-bottom:8px;flex-wrap:wrap';
    const body = document.createElement('div');
    body.style.cssText = 'min-height:120px;max-height:55vh;overflow:auto;touch-action:pan-y';
    card.append(goldEl, tabs, body);
    scene.domCloseBtn(card);

    let tab = 'buy', busy = false, rules = null;
    // สถานะตัวกรองหน้าซื้อ (จำไว้ตอนสลับแท็บ)
    let cache = [], cat = 'all', q = '', asc = true;

    function gold() { goldEl.textContent = '💰 ' + m.stats.gold.toLocaleString() + (rules ? ' (ภาษีขาย ' + Math.round(rules.tax * 100) + '%)' : ''); }
    function msg(t) { body.innerHTML = ''; const d = document.createElement('div'); d.style.cssText = 'padding:20px;color:#bbb'; d.textContent = t; body.appendChild(d); }
    function save() { if (m.saveSoon) m.saveSoon(); }
    function run(p, ok) {
      if (busy) return; busy = true; msg('กำลังดำเนินการ...');
      p.then(ok).catch(function (e) { m.toastMsg(errMsg(e)); }).then(function () { busy = false; show(tab); });
    }
    function goldReady() { return !!(window.GoldSync && window.GoldSync.isReady()); }

    // ตรวจรายการลงขายที่ค้างอยู่ (เน็ตหลุดตอนลงขาย) ด้วย reqId เดิม: ถ้าลงไปแล้วเซิร์ฟเวอร์จะคืนผลเดิม ไม่ลงซ้ำ
    function resolvePending() {
      const p = pendGet();
      if (!p || !p.item) { if (p) pendSet(null); return Promise.resolve(); }
      return callRetry('listItem', { item: p.item, price: p.price, reqId: p.reqId }, 2).then(function () {
        pendSet(null); m.toastMsg('ตรวจสอบรายการลงขายที่ค้างอยู่เรียบร้อย');
      }).catch(function (e) {
        if (uncertain(e)) return;                     // ยังไม่แน่ใจ เก็บไว้ตรวจรอบหน้า
        if (!canAdd(m, p.item)) { m.toastMsg('มีของที่ลงขายไม่สำเร็จรอคืน แต่กระเป๋าเต็ม เว้นที่ว่างแล้วเปิดตลาดใหม่'); return; }
        pendSet(null); addToBag(m, p.item); save();
        m.toastMsg('ลงขายไม่สำเร็จ คืนของเข้ากระเป๋าแล้ว');
      });
    }

    // รับของจากกล่อง (ทองเข้าที่เซิร์ฟเวอร์ / ไอเทมเข้ากระเป๋าถ้ามีที่)
    function claimAll() {
      return call('listInbox').then(function (r) {
        let p = Promise.resolve(), n = 0, skipped = 0;
        r.entries.forEach(function (e) {
          p = p.then(function () {
            // ตรวจ "ตอนถึงคิวของชิ้นนี้" (ไม่ใช่ตอนสร้างคิว) เพราะชิ้นก่อนหน้าอาจใช้ที่กระเป๋าไปแล้ว
            if (e.type === 'item' && !canAdd(m, e.item)) { skipped++; return; }
            if (e.type === 'gold' && !goldReady()) { skipped++; return; }
            const doClaim = function () { return callRetry('claimInbox', { id: e.id, reqId: 'c_' + e.id }, 3); };
            const pr = e.type === 'gold'
              ? GoldSync.run(function () {
                  return doClaim().then(function (c) { if (c && c.entry && c.server) GoldSync.credit(c.entry.amount); return c; });
                })
              : doClaim();
            return pr.then(function (c) {
              if (!c || !c.entry) { skipped++; return; }         // ยังอยู่ในช่วงพัก (wait) ข้ามไปก่อน
              if (c.entry.type !== 'gold') {
                if (!addToBag(m, c.entry.item)) m.toastMsg('กระเป๋าเต็มระหว่างรับของ กรุณาแจ้งผู้ดูแล');
              }
              n++;
              save();                                            // เซฟทันทีหลังรับแต่ละชิ้น กันของหายถ้าปิดเกมกลางคัน
            });
          });
        });
        return p.then(function () { if (n) m.toastMsg('รับของจากตลาด ' + n + ' รายการ'); return skipped; });
      });
    }

    function show(t) {
      tab = t; gold();
      tabs.innerHTML = '';
      [['buy', 'ซื้อ'], ['sell', 'ขายของฉัน'], ['mine', 'ที่ลงไว้'], ['ticket', '🎫 ตั๋ว']].forEach(function (x) {
        tabs.appendChild(btn(x[1], function () { if (!busy) show(x[0]); }, x[0] === t));
      });
      if (t === 'buy') showBuy(); else if (t === 'sell') showSell(); else if (t === 'mine') showMine(); else showTicket();
    }

    // ================= ซื้อ (หมวดหมู่ + ค้นหา) =================
    function showBuy() {
      msg('กำลังโหลด...');
      claimAll().then(function (left) {
        gold();
        return Promise.all([
          firebase.firestore().collection('market_listings').where('status', '==', 'active').limit(300).get(),
          call('myListings')                                     // รู้ว่ารายการไหนเป็นของเรา เพื่อซ่อนจากหน้าซื้อ
        ]).then(function (res) {
          const own = {};
          res[1].listings.forEach(function (l) { own[l.id] = 1; });
          const now = Date.now();
          cache = res[0].docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
            .filter(function (l) { return !own[l.id]; })
            .filter(function (l) { return typeof l.expiresAt !== 'number' || l.expiresAt > now; });   // ซ่อนรายการหมดอายุ
          buildBuyUI(left);
        });
      }).catch(function (e) { msg('โหลดไม่สำเร็จ: ' + errMsg(e)); });
    }

    function buildBuyUI(left) {
      body.innerHTML = '';
      if (left > 0) {
        const w = document.createElement('div');
        w.style.cssText = 'color:#e08a8a;font-size:12px;margin-bottom:6px';
        w.textContent = 'มีของรอรับ ' + left + ' ชิ้น (กระเป๋าเต็ม หรือยังอยู่ในช่วงพัก)';
        body.appendChild(w);
      }
      // ช่องค้นหา + ปุ่มเรียงราคา
      const bar = document.createElement('div');
      bar.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
      const input = document.createElement('input');
      input.type = 'search'; input.value = q; input.placeholder = '🔍 ค้นหา เช่น ดาบ, ทอง, เลเวล 50';
      input.setAttribute('enterkeyhint', 'search'); input.autocomplete = 'off';
      input.style.cssText = 'flex:1;min-width:0;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:2px solid #ffd45c;background:#0d0406;color:#fff;font-family:inherit;font-size:16px';
      const sortB = btn('', function () { asc = !asc; render(); });
      sortB.style.flex = 'none';
      bar.append(input, sortB);

      const chipsEl = document.createElement('div');
      chipsEl.style.cssText = 'display:flex;gap:5px;overflow-x:auto;margin-bottom:8px;padding-bottom:2px;touch-action:pan-x';
      const listEl = document.createElement('div');
      body.append(bar, chipsEl, listEl);

      input.addEventListener('input', function () { q = input.value; render(); });

      function render() {
        sortB.textContent = asc ? 'ราคา ↑' : 'ราคา ↓';
        const toks = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const matched = cache.filter(function (l) {
          if (!toks.length) return true;
          const t = label(l.item).toLowerCase();
          return toks.every(function (k) { return t.indexOf(k) !== -1; });
        });
        const counts = { all: matched.length };
        matched.forEach(function (l) { const c = categoryOf(l.item); counts[c] = (counts[c] || 0) + 1; });
        if (cat === 'other' && !counts.other) cat = 'all';

        chipsEl.innerHTML = '';
        CATS.forEach(function (c) {
          if (c.id === 'other' && !counts.other) return;
          chipsEl.appendChild(chip(c.name + ' (' + (counts[c.id] || 0) + ')', c.id === cat, function () { cat = c.id; render(); }));
        });

        const unit = function (l) { return l.price / (l.item.count || 1); };
        const shown = matched.filter(function (l) { return cat === 'all' || categoryOf(l.item) === cat; })
          .sort(function (a, b) { return asc ? unit(a) - unit(b) : unit(b) - unit(a); });

        listEl.innerHTML = '';
        if (!shown.length) {
          const d = document.createElement('div');
          d.style.cssText = 'padding:20px;color:#bbb';
          d.textContent = toks.length ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้าในหมวดนี้';
          listEl.appendChild(d);
          return;
        }
        shown.slice(0, SHOW_LIMIT).forEach(function (l) { listEl.appendChild(buyRow(l)); });
        if (shown.length > SHOW_LIMIT) {
          const d = document.createElement('div');
          d.style.cssText = 'padding:8px;color:#bbb;font-size:12px';
          d.textContent = 'แสดง ' + SHOW_LIMIT + ' จาก ' + shown.length + ' รายการ — พิมพ์ค้นหาเพื่อกรอง';
          listEl.appendChild(d);
        }
      }
      render();
    }

    // ซื้อ: ซิงก์ทองขึ้นเซิร์ฟเวอร์ก่อน -> เซิร์ฟเวอร์ตรวจ/หักทองเอง -> เกมปรับยอดตาม (ไม่หักล่วงหน้าในเครื่องอีกแล้ว)
    function buyRow(l) {
      const lt = leftTxt(l);
      return row('<b>' + esc(label(l.item)) + '</b><br><small style="color:#bbb">' + priceTxt(l) + (lt ? ' • ' + lt : '') + '</small>',
        btn('ซื้อ', function () {
          if (busy) return;
          if (!goldReady()) { m.toastMsg('ทองยังซิงก์กับเซิร์ฟเวอร์ไม่เสร็จ รอสักครู่แล้วลองใหม่'); return; }
          if (m.stats.gold < l.price) { m.toastMsg('ทองไม่พอ'); return; }
          const rq = rid();
          run(GoldSync.tx(function () {
            return callRetry('buyItem', { id: l.id, reqId: rq }, 3).then(function () {
              GoldSync.credit(-l.price);                         // เซิร์ฟเวอร์หักแล้ว ปรับยอดในเกมให้ตรง
              m.toastMsg('ซื้อสำเร็จ ของอยู่ในกล่องรับ');
            });
          }), function () { save(); });
        }, true), icon(m, l.item));
    }

    // ================= ขาย =================
    function sellFlow(i, it) {
      if (busy || m.bag[i] !== it || !rules) return;
      const R = rules;
      const why = sellBlock(it, R);
      if (why) { m.toastMsg(why); return; }

      busy = true;
      call('getWallet').then(function (w) {          // ยอดตั๋วและโควตาวันนี้มาจากเซิร์ฟเวอร์
        rules = w.rules;
        return sellDialog(m, it, w.rules, w).then(function (res) {
          busy = false;
          if (!res) return;
          if (m.bag[i] !== it) { m.toastMsg('ไอเทมในกระเป๋าเปลี่ยนไป ลองใหม่'); show(tab); return; }
          const qty = it.kind === 'stone' ? it.count : Math.min(res.qty, it.count === undefined ? 1 : it.count);
          const total = res.unit * qty;
          const sold = it.count !== undefined ? Object.assign({}, it, { count: qty }) : it;
          const rq = rid();
          if (it.count !== undefined && qty < it.count) it.count -= qty; else m.bag[i] = null;   // หักของออกจากกระเป๋าก่อน
          pendSet({ reqId: rq, item: sold, price: total });   // จดไว้ก่อน เผื่อเน็ตหลุดหรือปิดเกมกลางคัน
          save();
          run(callRetry('listItem', { item: sold, price: total, reqId: rq }, 3)
            .then(function () { pendSet(null); m.toastMsg('ลงขายแล้ว (' + w.rules.listHours + ' ชม.)'); })
            .catch(function (e) {
              if (uncertain(e)) {                              // ไม่รู้ว่าลงสำเร็จไหม: ไม่คืนของ รอตรวจใหม่ตอนเปิดตลาดครั้งหน้า
                m.toastMsg('เน็ตไม่เสถียร ระบบจะตรวจรายการนี้ให้เมื่อเปิดตลาดครั้งหน้า');
                return;
              }
              pendSet(null); addToBag(m, sold); save(); throw e;
            }), function () {});
        });
      }).catch(function (e) { busy = false; m.toastMsg('ตรวจสอบไม่สำเร็จ: ' + errMsg(e)); show(tab); });
    }

    // แสดงของที่ขายได้ในกระเป๋าเป็นช่องรูป แตะไอเทมที่ต้องการขาย
    function showSell() {
      msg('กำลังโหลด...');
      call('getWallet').then(function (w) {
        rules = w.rules; gold();
        const R = rules, tk = w.tickets || {};
        body.innerHTML = '';
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:12px;color:#bbb;margin-bottom:6px;line-height:1.5';
        hint.innerHTML = 'ขายได้เฉพาะ: กล่อง/อุปกรณ์สีแดงขึ้นไป • หินออฟ • หินตีบวกกองเต็ม ' + R.stoneStack.toLocaleString() + ' • สมุดสกิล<br>' +
          'แตะไอเทมที่ต้องการขาย • ลงวันนี้ ' + w.listedToday + '/' + w.dailyLimit + ' • อยู่ ' + R.listHours + ' ชม.<br>' +
          '🎫 ตั๋วที่มี: ' + [1, 2, 3].map(function (n) { return 'ระดับ ' + n + ' ×' + (tk[n] || 0); }).join(' | ');
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:6px;justify-items:center';
        let n = 0;
        m.bag.forEach(function (it, i) {
          if (!it || sellBlock(it, R)) return;     // แสดงเฉพาะของที่ขายได้
          n++;
          const ic = icon(m, it);
          ic.style.cursor = 'pointer';
          ic.addEventListener('click', function () { sellFlow(i, it); });
          grid.appendChild(ic);
        });
        body.append(hint);
        if (!n) { const d = document.createElement('div'); d.style.cssText = 'padding:16px;color:#bbb'; d.textContent = 'ไม่มีไอเทมที่ขายได้ในกระเป๋า'; body.append(d); return; }
        body.append(grid);
      }).catch(function (e) { msg('โหลดไม่สำเร็จ: ' + errMsg(e)); });
    }

    // ================= ที่ลงไว้ =================
    function showMine() {
      msg('กำลังโหลด...');
      Promise.all([call('myListings'), call('getWallet')]).then(function (res) {
        const ls = res[0].listings, w = res[1];
        rules = w.rules;
        body.innerHTML = '';
        const head = document.createElement('div');
        head.style.cssText = 'font-size:12px;color:#bbb;margin-bottom:6px';
        head.textContent = 'ลงขายอยู่ ' + ls.length + ' รายการ • ลงวันนี้ ' + w.listedToday + '/' + w.dailyLimit;
        body.appendChild(head);
        if (!ls.length) { const d = document.createElement('div'); d.style.cssText = 'padding:20px;color:#bbb'; d.textContent = 'ไม่มีรายการที่ลงไว้'; body.appendChild(d); return; }
        ls.forEach(function (l) {
          const expired = typeof l.expiresAt === 'number' && l.expiresAt <= Date.now(), lt = leftTxt(l);
          body.appendChild(row('<b>' + esc(label(l.item)) + '</b><br><small style="color:' + (expired ? '#e08a8a' : '#bbb') + '">' + priceTxt(l) + (lt ? ' • ' + lt : '') + '</small>',
            btn(expired ? 'รับคืน' : 'ยกเลิก', function () { run(call('cancelListing', { id: l.id }), function () { m.toastMsg('คืนของแล้ว ไปรับที่แท็บ ซื้อ'); }); }), icon(m, l.item)));
        });
      }).catch(function (e) { msg('โหลดไม่สำเร็จ: ' + errMsg(e)); });
    }

    // ================= ตั๋ว (ซื้อด้วยเงินจริง เก็บฝั่งเซิร์ฟเวอร์) =================
    function buyTicketReal() {
  if (!window.CashShop) { m.toastMsg('ยังไม่เปิดขายตั๋ว'); return; }
  window.CashShop.open(function () { if (tab === 'ticket') show('ticket'); });
}
    function showTicket() {
      msg('กำลังโหลด...');
      call('getWallet').then(function (w) {
        rules = w.rules;
        body.innerHTML = '';
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:12px;color:#bbb;margin-bottom:6px;line-height:1.5';
        hint.textContent = 'ต้องใช้ตั๋ว 1 ใบต่อการลงขาย 1 รายการ เลือกตั๋วตามราคารวมที่จะตั้ง • ตั๋วซื้อด้วยเงินจริง เก็บไว้ที่เซิร์ฟเวอร์ (ไม่อยู่ในกระเป๋า) • ลงวันนี้ ' + w.listedToday + '/' + w.dailyLimit;
        body.appendChild(hint);
        [1, 2, 3].forEach(function (n) {
          const have = (w.tickets || {})[n] || 0;
          body.appendChild(row('<b>' + esc(ticketName(rules, n)) + '</b><br><small style="color:#bbb">มีอยู่ ' + have + ' ใบ</small>',
            btn('ซื้อ', buyTicketReal, true), icon(m, { kind: 'ticket' })));
        });
        const idEl = document.createElement('div');
        idEl.style.cssText = 'font-size:11px;color:#888;margin-top:8px;word-break:break-all;user-select:all';
        idEl.textContent = 'รหัสผู้เล่น: ' + u.uid;
        body.appendChild(idEl);
      }).catch(function (e) { msg('โหลดไม่สำเร็จ: ' + errMsg(e)); });
    }

    msg('กำลังโหลด...');
    resolvePending().then(function () { show('buy'); });
  }

  window.TownHooks = window.TownHooks || {};
  window.TownHooks.market = openMarket;
})();
