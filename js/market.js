// ===== ตลาดกลาง (js/market.js) — ผูกกับ NPC id 'market' ใน town.js =====
// ต้องโหลดหลัง town.js และหลัง firebase-functions-compat.js
(function () {
  const REGION = 'asia-southeast1';   // ต้องตรงกับ functions/market.js
  const TAX = 0.05;
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
  function label(it) { try { return itemLabel(it); } catch (e) { return it.kind; } }

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
    try { ks.push(iconKeyForItem(it)); } catch (e) {}
    if (it.kind === 'equip') {
      if (it.baseSlot === 'weapon' && it.class) ks.push('img_weapon_' + it.class);
      ks.push('img_' + it.baseSlot);
    } else if (it.kind === 'optstone') ks.push('img_opt_' + it.color, 'icon_opt_' + it.color);
    else if (it.kind === 'potion') ks.push('icon_potion_' + it.pid);
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
    w.style.cssText = 'width:46px;height:46px;flex:none;position:relative;border-radius:8px;background:#1c0a0f;display:flex;align-items:center;justify-content:center;border:2px solid ' + rarHex(it);
    const src = iconSrc(m, it);
    if (src) {
      const im = document.createElement('img');
      im.src = src; im.style.cssText = 'width:36px;height:36px;image-rendering:pixelated;object-fit:contain';
      w.appendChild(im);
    } else { w.textContent = '📦'; w.style.fontSize = '22px'; }
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
    tabs.style.cssText = 'display:flex;gap:6px;justify-content:center;margin-bottom:8px';
    const body = document.createElement('div');
    body.style.cssText = 'min-height:120px;max-height:55vh;overflow:auto';
    card.append(goldEl, tabs, body);
    scene.domCloseBtn(card);

    let tab = 'buy', busy = false;
    function gold() { goldEl.textContent = '💰 ' + m.stats.gold.toLocaleString() + ' (ภาษีขาย 5%)'; }
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
          });
        });
        return p.then(function () { if (n) { m.toastMsg('รับของจากตลาด ' + n + ' รายการ'); save(); } return r.entries.length - n; });
      });
    }

    function show(t) {
      tab = t; gold();
      tabs.innerHTML = '';
      [['buy', 'ซื้อ'], ['sell', 'ขายของฉัน'], ['mine', 'ที่ลงไว้']].forEach(function (x) {
        const b = btn(x[1], function () { if (!busy) show(x[0]); }, x[0] === t);
        tabs.appendChild(b);
      });
      if (t === 'buy') showBuy(); else if (t === 'sell') showSell(); else showMine();
    }

    function showBuy() {
      msg('กำลังโหลด...');
      claimAll().then(function (left) {
        gold();
        return firebase.firestore().collection('market_listings').where('status', '==', 'active').limit(100).get().then(function (qs) {
          const ls = qs.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
            .filter(function (l) { return l.sellerId !== u.uid; })
            .sort(function (a, b) { return a.price - b.price; });
          body.innerHTML = '';
          if (left > 0) { const w = document.createElement('div'); w.style.cssText = 'color:#e08a8a;font-size:12px;margin-bottom:6px'; w.textContent = 'มีของรอรับ ' + left + ' ชิ้น แต่กระเป๋าเต็ม'; body.appendChild(w); }
          if (!ls.length) { const d = document.createElement('div'); d.style.cssText = 'padding:20px;color:#bbb'; d.textContent = 'ยังไม่มีสินค้า'; body.appendChild(d); return; }
          ls.forEach(function (l) {
            body.appendChild(row('<b>' + esc(label(l.item)) + '</b><br><small style="color:#bbb">โดย ' + esc(l.sellerName) + ' • ' + priceTxt(l) + '</small>',
              btn('ซื้อ', function () {
                if (m.stats.gold < l.price) { m.toastMsg('ทองไม่พอ'); return; }
                m.stats.gold -= l.price;                           // หักก่อน ล้มเหลวค่อยคืน
                run(call('buyItem', { id: l.id }).then(function () { m.toastMsg('ซื้อสำเร็จ ของอยู่ในกล่องรับ'); })
                  .catch(function (e) { m.stats.gold += l.price; throw e; }), function () { save(); });
              }, true), icon(m, l.item)));
          });
        });
      }).catch(function (e) { msg('โหลดไม่สำเร็จ: ' + errMsg(e)); });
    }

    function sellFlow(i, it) {
      if (m.bag[i] !== it) return;
      let qty = 1;
      if (it.count !== undefined && it.count > 1) {
        const q = window.prompt(label(it) + '\nขายกี่ชิ้น? (มี ' + it.count + ' ชิ้น)', String(it.count));
        qty = Math.floor(Number(q));
        if (!q || !isFinite(qty) || qty < 1 || qty > it.count) return;
      }
      const v = window.prompt('ตั้งราคา "ต่อชิ้น" (ทอง) ของ ' + label(it) + '\nได้รับสุทธิหลังหักภาษี 5%', '1000');
      const unit = Math.floor(Number(v));
      if (!v || !isFinite(unit) || unit < 1 || unit * qty > 1e9) return;
      const sold = it.count !== undefined ? Object.assign({}, it, { count: qty }) : it;
      if (it.count !== undefined && qty < it.count) it.count -= qty; else m.bag[i] = null;   // หักออกจากกระเป๋าก่อน
      save();
      run(call('listItem', { item: sold, price: unit * qty, sellerName: m.playerName || u.displayName || 'ผู้เล่น' })
        .then(function () { m.toastMsg('ลงขายแล้ว'); })
        .catch(function (e) { addToBag(m, sold); save(); throw e; }), function () {});
    }

    // แสดงของในกระเป๋าเป็นช่องรูป แตะไอเทมที่ต้องการขาย
    function showSell() {
      body.innerHTML = '';
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:12px;color:#bbb;margin-bottom:6px';
      hint.textContent = 'แตะไอเทมในกระเป๋าที่ต้องการขาย';
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:6px;justify-items:center';
      let n = 0;
      m.bag.forEach(function (it, i) {
        if (!it) return;
        n++;
        const ic = icon(m, it);
        ic.style.cursor = 'pointer';
        ic.addEventListener('click', function () { sellFlow(i, it); });
        grid.appendChild(ic);
      });
      if (!n) { msg('กระเป๋าว่าง'); return; }
      body.append(hint, grid);
    }

    function showMine() {
      msg('กำลังโหลด...');
      firebase.firestore().collection('market_listings').where('sellerId', '==', u.uid).where('status', '==', 'active').get().then(function (qs) {
        body.innerHTML = '';
        if (qs.empty) { msg('ไม่มีรายการที่ลงไว้'); return; }
        qs.docs.forEach(function (d) {
          const l = d.data();
          body.appendChild(row('<b>' + esc(label(l.item)) + '</b><br><small style="color:#bbb">' + priceTxt(l) + '</small>',
            btn('ยกเลิก', function () { run(call('cancelListing', { id: d.id }), function () { m.toastMsg('ยกเลิกแล้ว ไปรับของที่แท็บ ซื้อ'); }); }), icon(m, l.item)));
        });
      }).catch(function (e) { msg('โหลดไม่สำเร็จ: ' + errMsg(e)); });
    }

    show('buy');
  }

  window.TownHooks = window.TownHooks || {};
  window.TownHooks.market = openMarket;
})();
