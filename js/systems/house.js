// ===== ระบบบ้าน v1: ตกปลา (แผงโต้ตอบ ไม่ใช่โซนแยก) =====
// ไฟล์: js/systems/house.js | โหลด "หลัง" town.js และ houseData.js ก่อน js/main.js
// - เพิ่มประตู "บ้านของฉัน" ในเมืองผ่าน TOWN_NPCS (ไม่ต้องแก้ town.js)
// - วัตถุดิบเก็บในกระเป๋าเป็น { kind:'material', mid, count } ซ้อนได้
// - ข้อมูลบ้านอยู่ที่ scene.house (เซฟผ่าน save.js) เป็นของผู้เล่นแต่ละคนอยู่แล้ว
// หมายเหตุ v1: เวลา/ผลตกปลาคิดในเครื่อง (ยังไม่กันโกง) ขั้นปลูกผักจะย้ายเวลาไปเช็กที่เซิร์ฟเวอร์

(function () {
  const P = Main.prototype;
  const el = function (tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  };

  // ---------- สถานะบ้าน ----------
  P.houseState = function () {
    if (!this.house || typeof this.house !== 'object') this.house = { v: 1, fished: 0, plots: [] };
    if (!Array.isArray(this.house.plots)) this.house.plots = [];
    return this.house;
  };

  // ---------- วัตถุดิบในกระเป๋า ----------
  P.countMat = function (mid) {
    let n = 0;
    this.bag.forEach(function (s) { if (s && s.kind === 'material' && s.mid === mid) n += s.count; });
    return n;
  };
  // ใส่ n ชิ้น คืนจำนวนที่ใส่ไม่ได้ (0 = ครบ)
  P.addMat = function (mid, n) {
    let left = n || 1;
    if (!MAT_DEFS[mid]) return left;
    this.bag.forEach(function (s) {
      if (left > 0 && s && s.kind === 'material' && s.mid === mid && s.count < MAX_MAT_STACK) {
        const a = Math.min(left, MAX_MAT_STACK - s.count);
        s.count += a; left -= a;
      }
    });
    while (left > 0) {
      const i = this.findEmptyBagSlot();
      if (i === -1) break;
      const a = Math.min(left, MAX_MAT_STACK);
      this.bag[i] = { kind: 'material', mid: mid, count: a };
      left -= a;
    }
    return left;
  };
  P.takeMat = function (mid, n) {
    if (this.countMat(mid) < n) return false;
    for (let i = 0; i < this.bag.length && n > 0; i++) {
      const s = this.bag[i];
      if (!s || s.kind !== 'material' || s.mid !== mid) continue;
      const t = Math.min(n, s.count);
      s.count -= t; n -= t;
      if (s.count <= 0) this.bag[i] = null;
    }
    return true;
  };

  // ---------- ให้ชื่อ/ไอคอน/สีกรอบของวัตถุดิบแสดงในกระเป๋าได้ ----------
  function matTex(mid) {
    const sc = window.__mainScene, d = MAT_DEFS[mid];
    if (!sc || !d) return 'box';
    const key = 'mat_' + mid;
    if (sc.textures.exists(key)) return key;
    const S = 48;
    const t = sc.textures.createCanvas(key, S, S);
    const c = t.getContext();
    c.fillStyle = '#1d1d1d'; c.fillRect(0, 0, S, S);
    c.font = '30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(d.icon, S / 2, S / 2 + 2);
    t.refresh();
    return key;
  }
  const isMat = function (it) { return !!(it && it.kind === 'material'); };

  if (typeof window.itemLabel === 'function') {
    const o = window.itemLabel;
    window.itemLabel = function (item) {
      if (isMat(item)) {
        const d = MAT_DEFS[item.mid];
        return (d ? d.name : item.mid) + (item.count > 1 ? '  x' + item.count : '');
      }
      return o.apply(this, arguments);
    };
  }
  if (typeof window.iconKeyForItem === 'function') {
    const o = window.iconKeyForItem;
    window.iconKeyForItem = function (item) { return isMat(item) ? matTex(item.mid) : o.apply(this, arguments); };
  }
  if (typeof window.rarityColor === 'function') {
    const o = window.rarityColor;
    window.rarityColor = function (item) {
      if (isMat(item)) { const d = MAT_DEFS[item.mid]; return d ? d.color : 0x9a9a9a; }
      return o.apply(this, arguments);
    };
  }

  // ---------- ประตูบ้านในเมือง ----------
  TOWN_NPCS.push({ id: 'house', name: 'ประตูบ้าน', title: 'บ้านของฉัน', x: 900, y: 1400, sprite: 'npc_house', color: 0x8bc34a, icon: '🏠' });
  TOWN_TEXT.house = 'บ้านของคุณ';
  window.TownHooks = window.TownHooks || {};
  window.TownHooks.house = function (m) { openHouse(m); };

  // ---------- ตกปลา ----------
  function tri(t) { const x = t % 2; return x < 1 ? x : 2 - x; }

  function rollFish(baited) {
    const list = FISH_TABLE.map(function (f) {
      return { id: f.id, w: f.w * (baited && f.rare ? FISH_CFG.baitRareMul : 1) };
    });
    let total = 0; list.forEach(function (f) { total += f.w; });
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) { r -= list[i].w; if (r <= 0) return list[i].id; }
    return list[0].id;
  }

  function fishView(m, card, body) {
    const h = m.houseState();
    const alive = function () { return document.body.contains(card); };
    let state = 'idle', useBait = false, baited = false, timer = 0, raf = 0, center = 0.5, t0 = 0, pos = 0;

    const msg = el('div', 'hs-msg', 'กดทอดเบ็ดเพื่อเริ่มตกปลา');
    const res = el('div', 'hs-res', '');
    const bar = el('div', 'hs-bar');
    const zone = el('div', 'hs-zone'), mk = el('div', 'hs-mark');
    bar.append(zone, mk);
    bar.style.visibility = 'hidden';
    const baitBtn = el('button', 'hs-btn hs-alt', '');
    const act = el('button', 'hs-btn hs-main', '🎣 ทอดเบ็ด');
    const stock = el('div', 'hs-stock', '');
    body.append(msg, bar, res, baitBtn, act, stock);

    function refresh() {
      baitBtn.textContent = (useBait ? '☑' : '☐') + ' ใช้เหยื่อ (มี ' + m.countMat('bait_basic') + ') ปลาหายากง่ายขึ้น';
      baitBtn.disabled = state !== 'idle';
      const fs = [];
      Object.keys(MAT_DEFS).forEach(function (id) {
        const d = MAT_DEFS[id];
        if (d.cat !== 'fish') return;
        const n = m.countMat(id);
        if (n) fs.push(d.icon + ' ' + d.name + ' x' + n);
      });
      stock.textContent = fs.length ? 'ในกระเป๋า: ' + fs.join('   ') : 'ยังไม่มีปลาในกระเป๋า';
    }

    function toIdle() {
      state = 'idle';
      clearTimeout(timer); cancelAnimationFrame(raf);
      bar.style.visibility = 'hidden';
      act.textContent = '🎣 ทอดเบ็ด';
      refresh();
    }

    function cast() {
      baited = false;
      if (useBait) {
        if (m.takeMat('bait_basic', 1)) baited = true; else useBait = false;
      }
      state = 'wait';
      res.textContent = '';
      msg.textContent = '🌊 รอปลากิน...';
      act.textContent = '🪝 ดึงเบ็ด';
      refresh();
      timer = setTimeout(bite, FISH_CFG.waitMin + Math.random() * (FISH_CFG.waitMax - FISH_CFG.waitMin));
    }

    function bite() {
      if (!alive() || state !== 'wait') return;
      state = 'bite';
      center = 0.2 + Math.random() * 0.6;
      const w = FISH_CFG.zoneW;
      zone.style.left = ((center - w / 2) * 100) + '%';
      zone.style.width = (w * 100) + '%';
      bar.style.visibility = 'visible';
      msg.textContent = '❗ ปลากินเบ็ด! แตะตอนตัวชี้อยู่ในโซนเขียว';
      act.textContent = '✊ ดึง!';
      try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
      t0 = performance.now();
      raf = requestAnimationFrame(loop);
    }

    function loop(now) {
      if (state !== 'bite' || !alive()) return;
      if (now - t0 > FISH_CFG.biteLimitMs) { finish(false, false); return; }
      pos = tri((now - t0) / 1000 * FISH_CFG.speed);
      mk.style.left = (pos * 100) + '%';
      raf = requestAnimationFrame(loop);
    }

    function finish(ok, perfect) {
      toIdle();
      if (!ok) { msg.textContent = '💨 ปลาหลุดไปแล้ว...'; return; }
      const fid = rollFish(baited);
      const n = (perfect && FISH_CFG.perfectDouble) ? 2 : 1;
      const left = m.addMat(fid, n);
      const d = MAT_DEFS[fid];
      h.fished = (h.fished || 0) + 1;
      if (left >= n) {
        msg.textContent = '🎒 กระเป๋าเต็ม! ปลาหลุดมือ';
      } else {
        msg.textContent = perfect ? '⭐ สุดยอด! จังหวะเป๊ะ' : '✅ ตกได้แล้ว!';
        res.textContent = d.icon + ' ' + d.name + ' x' + (n - left);
        if (m.toastMsg) m.toastMsg('ตกได้: ' + d.name + ' x' + (n - left));
      }
      if (m.saveSoon) m.saveSoon();
      refresh();
    }

    baitBtn.addEventListener('click', function () {
      if (state !== 'idle') return;
      if (!useBait && m.countMat('bait_basic') < 1) { if (m.toastMsg) m.toastMsg('ไม่มีเหยื่อ'); return; }
      useBait = !useBait;
      refresh();
    });

    act.addEventListener('click', function () {
      if (state === 'idle') { cast(); return; }
      if (state === 'wait') { toIdle(); msg.textContent = '😅 ดึงเร็วไป ปลาหนีแล้ว'; return; }
      if (state === 'bite') {
        const d = Math.abs(pos - center);
        finish(d <= FISH_CFG.zoneW / 2, d <= FISH_CFG.zoneW * 0.15);
      }
    });

    refresh();
  }

  // ---------- แผงบ้าน ----------
  function openHouse(m) {
    if (m.townModal) return;
    const h = m.houseState();
    if (!h.gift && FISH_CFG.giftBait > 0) {
      h.gift = 1;
      m.addMat('bait_basic', FISH_CFG.giftBait);
      if (m.toastMsg) m.toastMsg('ได้รับเหยื่อ x' + FISH_CFG.giftBait);
    }
    const card = townDomCard(m, '🏠 บ้านของฉัน');
    card.classList.add('hs-card');
    const tabs = el('div', 'hs-tabs');
    tabs.append(el('button', 'hs-tab on', '🎣 ตกปลา'), el('button', 'hs-tab off', '🥬 แปลงผัก (เร็วๆ นี้)'), el('button', 'hs-tab off', '🍳 เตา (เร็วๆ นี้)'));
    const body = el('div', 'hs-body');
    card.append(tabs, body);
    fishView(m, card, body);
    townCloseBtn(m, card);
  }
  window.openHouse = openHouse;
})();
