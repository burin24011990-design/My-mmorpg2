// ===== ตลาดกลาง (js/market.js) v5 — ผูกกับ NPC id 'market' ใน town.js =====
// ต้องโหลดหลัง town.js และหลัง firebase-functions-compat.js
// ฟีเจอร์: หมวดหมู่ + ค้นหา + เรียงราคา | ขายได้เฉพาะของแรร์ | ตั๋วลงขาย (เก็บที่เซิร์ฟเวอร์) | ผู้ขายนิรนาม
// กฎ/เพดานราคาทั้งหมดอ่านมาจากเซิร์ฟเวอร์ (getWallet → rules) จึงแก้ที่ functions/market.js ที่เดียว
(function () {
  const REGION = 'asia-southeast1';   // ต้องตรงกับ functions/market.js
  const SHOW_LIMIT = 100;             // แสดงสูงสุดกี่รายการในหน้าซื้อ
  const BUY_TICKET_URL = '';          // หน้าชำระเงินสำหรับซื้อตั๋ว (ว่าง = ยังไม่เปิดขาย)
  const TIER_RANK = ['white', 'blue', 'red', 'gold'];

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

    // รับของจากกล่อง (ทองเข้าทันที / ไอเทมเข้ากระเป๋าถ้ามีที่)
    function claimAll() {
      return call('listInbox').then(function (r) {
        let p = Promise.resolve(), n = 0;
        r.entries.forEach(function (e) {
          if (e.type === 'item' && !canAdd(m, e.item)) return;   // กระเป๋าเต็ม: รอไว้ก่อน
          p = p.then(function () { return call('claimInbox', { id: e.id }); }).then(function (c) {
            const en = c.entry;
            if (en.type === 'gold') m.stats.gold += en.amount; else addToBag(m, en.item);
            n++;
            save();                                              // เซฟทันทีหลังรับแต่ละชิ้น กันของหายถ้าปิดเกมกลางคัน
          });
        });
        return p.then(function () { if (n) m.toastMsg('รับของจากตลาด ' + n + ' รายการ'); return r.entries.length - n; });
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
        w.textContent = 'มีของรอรับ ' + left + ' ชิ้น แต่กระเป๋าเต็ม';
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

    function buyRow(l) {
      const lt = leftTxt(l);
      return row('<b>' + esc(label(l.item)) + '</b><br><small style="color:#bbb">' + priceTxt(l) + (lt ? ' • ' + lt : '') + '</small>',
        btn('ซื้อ', function () {
          if (busy) return;
          if (m.stats.gold < l.price) { m.toastMsg('ทองไม่พอ'); return; }
          m.stats.gold -= l.price;                           // หักก่อน ล้มเหลวค่อยคืน
          run(call('buyItem', { id: l.id }).then(function () { m.toastMsg('ซื้อสำเร็จ ของอยู่ในกล่องรับ'); })
            .catch(function (e) { m.stats.gold += l.price; throw e; }), function () { save(); });
        }, true), icon(m, l.item));
    }

    // ================= ขาย =================
    function sellFlow(i, it) {
      if (busy || m.bag[i] !== it || !rules) return;
      const R = rules;
      const why = sellBlock(it, R);
      if (why) { m.toastMsg(why); return; }
      let qty = 1;
      if (it.kind === 'stone') qty = it.count;          // หินตีบวก: ขายยกกองเท่านั้น
      else if (it.count !== undefined && it.count > 1) {
        const q2 = window.prompt(label(it) + '\nขายกี่ชิ้น? (มี ' + it.count + ' ชิ้น)', String(it.count));
        qty = Math.floor(Number(q2));
        if (!q2 || !isFinite(qty) || qty < 1 || qty > it.count) return;
      }
      const cap = maxUnitPrice(it, R);
      const v = window.prompt('ตั้งราคา "ต่อชิ้น" (ทอง) ของ ' + label(it) + '\nราคาสูงสุดต่อชิ้น ' + cap.toLocaleString() + ' (รวมไม่เกิน ' + R.maxPrice.toLocaleString() + ')\nได้รับสุทธิหลังหักภาษี ' + Math.round(R.tax * 100) + '%', String(Math.min(1000, cap)));
      const unit = Math.floor(Number(v));
      if (!v || !isFinite(unit) || unit < 1) return;
      if (unit > cap) { m.toastMsg('ราคาต่อชิ้นของไอเทมนี้สูงสุด ' + cap.toLocaleString()); return; }
      const total = unit * qty;
      if (total > R.maxPrice) { m.toastMsg('ราคารวมต้องไม่เกิน ' + R.maxPrice.toLocaleString()); return; }

      const tk = ticketFor(R, total), tName = ticketName(R, tk);
      busy = true; msg('กำลังตรวจสอบ...');
      call('getWallet').then(function (w) {          // ยอดตั๋วและโควตาวันนี้มาจากเซิร์ฟเวอร์
        busy = false;
        if (((w.tickets || {})[tk] || 0) < 1) { m.toastMsg('ต้องมี "' + tName + '" (ดูที่แท็บ 🎫 ตั๋ว)'); show(tab); return; }
        if (w.listedToday >= w.dailyLimit) { m.toastMsg('ลงขายครบ ' + w.dailyLimit + ' รายการใน 24 ชม. แล้ว'); show(tab); return; }
        if (m.bag[i] !== it) { show(tab); return; }
        const net = Math.floor(total * (1 - R.tax));
        if (!window.confirm('ลงขาย ' + label(it) + (qty > 1 && it.kind !== 'stone' ? ' x' + qty : '') + '\nราคารวม ' + total.toLocaleString() + ' (ได้รับสุทธิ ' + net.toLocaleString() + ')\nใช้ ' + tName + ' 1 ใบ\nอยู่ในตลาด ' + R.listHours + ' ชม.')) { show(tab); return; }

        const sold = it.count !== undefined ? Object.assign({}, it, { count: qty }) : it;
        if (it.count !== undefined && qty < it.count) it.count -= qty; else m.bag[i] = null;   // หักของออกจากกระเป๋าก่อน
        save();
        run(call('listItem', { item: sold, price: total })
          .then(function () { m.toastMsg('ลงขายแล้ว (' + R.listHours + ' ชม.)'); })
          .catch(function (e) { addToBag(m, sold); save(); throw e; }), function () {});
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
      if (!BUY_TICKET_URL) { m.toastMsg('ยังไม่เปิดขายตั๋ว'); return; }
      window.open(BUY_TICKET_URL, '_blank');
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

    show('buy');
  }

  window.TownHooks = window.TownHooks || {};
  window.TownHooks.market = openMarket;
})();
