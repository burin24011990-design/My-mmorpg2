// ===== ระบบบ้าน v2: แมพบ้านส่วนตัว + ตกปลา + แปลงผัก + สมุดอาหาร 100 เมนู + ร้านค้า + ดรอปวัตถุดิบ =====
// ไฟล์: js/systems/house.js | โหลด "หลัง" town.js (และ stats.js) และหลัง houseData.js ก่อน js/main.js
// - ประตู "บ้านของฉัน" ในเมือง (เพิ่มผ่าน TOWN_NPCS) -> เข้าแมพบ้านส่วนตัว: เมืองถูกซ่อนชั่วคราว ผู้เล่นอื่นถูกซ่อนในเครื่องเรา
// - บ้านเป็นของใครของมัน: ข้อมูลอยู่ที่ scene.house (เซฟผ่าน save.js) { v, plots, cookbook, fished, gift2 }
// - สถานะถาวรจากสมุดอาหารบวกเข้าสเตตัสผ่านการครอบ recalcStats (ไม่ต้องแก้ stats.js)
// - ดรอปวัตถุดิบจากมอนผ่านการครอบ dropLoot (ไม่ต้องแก้ monsters.js)
// หมายเหตุ v2: เวลาโตของผัก/ผลตกปลา/การทำอาหารคิดในเครื่อง (ยังไม่กันโกง) ขั้นถัดไปค่อยย้ายไป Firebase Functions

(function () {
  const P = Main.prototype;
  const el = function (tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  };
  const HOUSE = { w: 1300, h: 1000, feet: 20, speed: 190 };

  // ================= สถานะบ้าน =================
  P.houseState = function () {
    let h = this.house;
    if (!h || typeof h !== 'object') h = this.house = {};
    if (!h._ok) {
      Object.defineProperty(h, '_ok', { value: true, enumerable: false, writable: true });
      h.v = 2;
      h.fished = Number.isFinite(h.fished) ? h.fished : 0;
      const plots = [];
      for (let i = 0; i < PLOT_COUNT; i++) {
        const p = Array.isArray(h.plots) ? h.plots[i] : null;
        plots.push(p && CROPS[p.seed] && Number.isFinite(p.at) ? { seed: p.seed, at: p.at } : null);
      }
      h.plots = plots;
      const src = (h.cookbook && typeof h.cookbook === 'object') ? h.cookbook : {};
      const cb = {};
      COOK_RECIPES.forEach(function (r) {
        const n = Math.floor(Number(src[r.id]));
        if (n > 0) cb[r.id] = Math.min(COOK_MAX_BOOKS, n);
      });
      h.cookbook = cb;
    }
    return h;
  };

  // ================= วัตถุดิบในกระเป๋า =================
  P.countMat = function (mid) {
    let n = 0;
    this.bag.forEach(function (s) { if (s && s.kind === 'material' && s.mid === mid) n += s.count; });
    return n;
  };
  P.addMat = function (mid, n) {   // คืนจำนวนที่ใส่ไม่ได้ (0 = ครบ)
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

  P.canAddMat = function (mid, n) {   // ใส่ครบ n ชิ้นได้ไหม (เช็กก่อนหักทอง จะได้ไม่ต้องคืนทอง)
    let room = 0;
    this.bag.forEach(function (s) {
      if (!s) room += MAX_MAT_STACK;
      else if (s.kind === 'material' && s.mid === mid) room += Math.max(0, MAX_MAT_STACK - s.count);
    });
    return room >= n;
  };

  // ชื่อ/ไอคอน/สีกรอบของวัตถุดิบในกระเป๋า
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
      if (isMat(item)) { const d = MAT_DEFS[item.mid]; return (d ? d.name : item.mid) + (item.count > 1 ? '  x' + item.count : ''); }
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

  // ================= สถานะถาวรจากสมุดอาหาร =================
  P.cookbookBonus = function () {
    const cb = this.houseState().cookbook, out = {};
    COOK_RECIPES.forEach(function (r) {
      const n = cb[r.id] | 0;
      if (n > 0) Object.keys(r.bonus).forEach(function (k) { out[k] = (out[k] || 0) + r.bonus[k] * n; });
    });
    return out;
  };
  const _recalc = P.recalcStats;
  if (typeof _recalc === 'function') {
    P.recalcStats = function () {
      const out = _recalc.apply(this, arguments);
      try {
        const b = this.cookbookBonus(), D = window.STAT_DEFS || {};
        Object.keys(b).forEach(function (k) {
          out[k] = (out[k] || 0) + b[k];
          const d = D[k];
          if (d && d.cap != null && out[k] > d.cap) out[k] = d.cap;
        });
        const st = this.stats || {};
        this.equipHpBonus = out.hp - (st.maxHp || 0);
        this.equipMpBonus = out.mp - (st.maxMp || 0);
      } catch (e) { console.warn('cookbook bonus', e); }
      return out;
    };
  }

  // ================= ดรอปวัตถุดิบจากมอน =================
  let lastDropToast = 0;
  const _drop = P.dropLoot;
  if (typeof _drop === 'function') {
    P.dropLoot = function (x, y, lv, boxLevel, isBoss, isEpic) {
      const r = _drop.apply(this, arguments);
      try { rollMats(this, isBoss, isEpic); } catch (e) { console.warn('mat drop', e); }
      return r;
    };
  }
  function rollMats(sc, isBoss, isEpic) {
    const z = ZONES[sc.stageIdx];
    if (!z || z.town) return;
    const th = Math.max(0, Math.min(DROP_THEMES.length - 1, (z.look !== undefined) ? z.look : sc.stageIdx));
    const mul = (isBoss ? 4 : (isEpic ? 2 : 1)) * MAT_DROP_MUL;
    const got = [];
    DROP_THEMES[th].forEach(function (d) {
      if (Math.random() < d.p * mul) {
        const n = isBoss ? 2 + Math.floor(Math.random() * 3) : 1 + (Math.random() < 0.25 ? 1 : 0);
        got.push([d.id, n]);
      }
    });
    // เมล็ดผัก: สุ่มระดับความหายาก (ด่านสูง/บอส = ของหายากง่ายขึ้น) แล้วสุ่มชนิดในระดับนั้น
    if (Math.random() < SEED_DROP.chance * (isBoss ? 4 : (isEpic ? 2 : 1)) * MAT_DROP_MUL) {
      const ws = SEED_DROP.tiers.map(function (t) {
        return Math.max(1, t.w + t.shift * th) * ((isBoss && t.key === 'rare') ? SEED_DROP.bossRareMul : 1);
      });
      let tot = 0; ws.forEach(function (w) { tot += w; });
      let x = Math.random() * tot, ti = 0;
      for (; ti < ws.length - 1; ti++) { x -= ws[ti]; if (x <= 0) break; }
      const tier = SEED_DROP.tiers[ti];
      const key = tier.seeds[Math.floor(Math.random() * tier.seeds.length)];
      got.push(['seed_' + key, 1 + ((tier.key === 'common' && Math.random() < 0.2) ? 1 : 0)]);
    }
    if (Math.random() < BAIT_DROP_CHANCE * (isBoss ? 3 : 1)) got.push(['bait_basic', 1 + Math.floor(Math.random() * 2)]);
    if (!got.length) return;
    const names = [];
    let full = false;
    got.forEach(function (g) {
      const left = sc.addMat(g[0], g[1]);
      if (left >= g[1]) full = true;
      else {
        const md = MAT_DEFS[g[0]];
        names.push(md.icon + md.name + ((md.rarity && md.rarity !== 'ธรรมดา') ? ' [' + md.rarity + ']' : '') + ' x' + (g[1] - left));
      }
    });
    const now = Date.now();
    if (now - lastDropToast > 1200 && sc.toastMsg) {
      lastDropToast = now;
      if (names.length) sc.toastMsg('ได้ ' + names.join(' '));
      else if (full) sc.toastMsg('กระเป๋าเต็ม วัตถุดิบหลุดมือ');
    }
  }

  // ================= ตัวช่วยแผง =================
  const fmtVal = function (k, v) {
    const D = window.STAT_DEFS || {}, d = D[k];
    const s = String(Math.round(v * 100) / 100);
    return (d ? d.short : k) + ' +' + s + ((d && d.fmt === 'pct') ? '%' : '');
  };
  const fmtTime = function (ms) {
    const s = Math.ceil(ms / 1000), mm = Math.floor(s / 60), ss = s % 60;
    return mm + ':' + String(ss).padStart(2, '0');
  };
  const matName = function (id) { const d = MAT_DEFS[id]; return d ? d.icon + d.name : id; };
  const toast = function (m, t) { if (m.toastMsg) m.toastMsg(t); };
  const spendGold = function (m, n) {
    if (typeof m.spendGold === 'function') return m.spendGold(n);
    if ((m.stats.gold || 0) < n) return false;
    m.stats.gold -= n;
    return true;
  };

  // ---------- ตกปลา ----------
  const tri = function (t) { const x = t % 2; return x < 1 ? x : 2 - x; };
  function rollFish(baited) {
    const list = FISH_TABLE.map(function (f) { return { id: f.id, w: f.w * (baited && f.rare ? FISH_CFG.baitRareMul : 1) }; });
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
    const waterBtn = el('button', 'hs-btn hs-alt', '💧 ตักน้ำ ×10 (ใช้ทำอาหาร)');
    const stock = el('div', 'hs-stock', '');
    body.append(msg, bar, res, baitBtn, act, waterBtn, stock);

    function refresh() {
      baitBtn.textContent = (useBait ? '☑' : '☐') + ' ใช้เหยื่อ (มี ' + m.countMat('bait_basic') + ') ปลาหายากง่ายขึ้น';
      baitBtn.disabled = state !== 'idle';
      const fs = [];
      FISH_TABLE.forEach(function (f) { const n = m.countMat(f.id); if (n) fs.push(MAT_DEFS[f.id].icon + MAT_DEFS[f.id].name + ' x' + n); });
      stock.textContent = (fs.length ? 'ปลาในกระเป๋า: ' + fs.join('   ') : 'ยังไม่มีปลาในกระเป๋า') + '   💧 น้ำ x' + m.countMat('water');
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
      if (useBait) { if (m.takeMat('bait_basic', 1)) baited = true; else useBait = false; }
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
      const fid = rollFish(baited), n = (perfect && FISH_CFG.perfectDouble) ? 2 : 1;
      const left = m.addMat(fid, n), d = MAT_DEFS[fid];
      h.fished = (h.fished || 0) + 1;
      if (left >= n) msg.textContent = '🎒 กระเป๋าเต็ม! ปลาหลุดมือ';
      else {
        msg.textContent = perfect ? '⭐ สุดยอด! จังหวะเป๊ะ' : '✅ ตกได้แล้ว!';
        res.textContent = d.icon + ' ' + d.name + ' x' + (n - left);
        toast(m, 'ตกได้: ' + d.name + ' x' + (n - left));
      }
      if (m.saveSoon) m.saveSoon();
      refresh();
    }
    baitBtn.addEventListener('click', function () {
      if (state !== 'idle') return;
      if (!useBait && m.countMat('bait_basic') < 1) { toast(m, 'ไม่มีเหยื่อ (ซื้อได้ที่แท็บร้านค้า)'); return; }
      useBait = !useBait; refresh();
    });
    waterBtn.addEventListener('click', function () {
      const left = m.addMat('water', 10);
      toast(m, left >= 10 ? 'กระเป๋าเต็ม' : '💧 ได้น้ำ x' + (10 - left));
      refresh();
    });
    act.addEventListener('click', function () {
      if (state === 'idle') { cast(); return; }
      if (state === 'wait') { toIdle(); msg.textContent = '😅 ดึงเร็วไป ปลาหนีแล้ว'; return; }
      if (state === 'bite') { const d = Math.abs(pos - center); finish(d <= FISH_CFG.zoneW / 2, d <= FISH_CFG.zoneW * 0.15); }
    });
    refresh();
    return function () { clearTimeout(timer); cancelAnimationFrame(raf); };
  }

  // ---------- แปลงผัก ----------
  function plotInfo(p) {
    const c = p && CROPS[p.seed];
    if (!c) return { st: 'empty' };
    const e = Math.max(0, Date.now() - p.at);
    if (e >= c.growMs) return { st: 'ready', crop: c, frac: 1 };
    return { st: 'grow', crop: c, left: c.growMs - e, frac: e / c.growMs };
  }
  function plantSeed(m, i, seed) {
    const h = m.houseState();
    if (h.plots[i] || !CROPS[seed] || !m.takeMat(seed, 1)) return false;
    h.plots[i] = { seed: seed, at: Date.now() };
    if (m.saveSoon) m.saveSoon();
    refreshPlots(m);
    return true;
  }
  function harvestPlot(m, i) {   // คืนข้อความ หรือ null ถ้าเก็บไม่ได้
    const h = m.houseState(), p = h.plots[i], inf = plotInfo(p);
    if (inf.st !== 'ready') return null;
    const c = inf.crop, n = c.yieldMin + Math.floor(Math.random() * (c.yieldMax - c.yieldMin + 1));
    const left = m.addMat(c.veg, n);
    if (left >= n) { toast(m, 'กระเป๋าเต็ม เก็บเกี่ยวไม่ได้'); return null; }
    h.plots[i] = null;
    let txt = MAT_DEFS[c.veg].icon + MAT_DEFS[c.veg].name + ' x' + (n - left);
    if (Math.random() < SEED_RETURN_CHANCE && m.addMat(p.seed, 1) === 0) txt += ' + เมล็ดคืน 1';
    if (m.saveSoon) m.saveSoon();
    refreshPlots(m);
    return txt;
  }

  function farmView(m, card, body, arg) {
    const h = m.houseState();
    const alive = function () { return document.body.contains(card); };
    const wrap = el('div', 'hs-list');
    body.append(wrap);
    let picking = (arg && Number.isInteger(arg.plot) && !h.plots[arg.plot]) ? arg.plot : null;
    let rows = [], timer = 0;

    function refreshRows() {
      rows.forEach(function (r) {
        const inf = plotInfo(h.plots[r.i]);
        if (inf.st === 'empty') { r.txt.textContent = 'ว่าง'; r.btn.textContent = '🌱 ปลูก'; r.btn.disabled = false; r.fill.style.width = '0%'; }
        else if (inf.st === 'ready') { r.txt.textContent = MAT_DEFS[inf.crop.veg].icon + ' ' + MAT_DEFS[inf.crop.veg].name + ' พร้อมเก็บ!'; r.btn.textContent = '✂️ เก็บเกี่ยว'; r.btn.disabled = false; r.fill.style.width = '100%'; }
        else { r.txt.textContent = MAT_DEFS[inf.crop.veg].icon + ' ' + MAT_DEFS[inf.crop.veg].name + ' อีก ' + fmtTime(inf.left); r.btn.textContent = '⏳ รอ'; r.btn.disabled = true; r.fill.style.width = Math.round(inf.frac * 100) + '%'; }
      });
    }
    function draw() {
      clearInterval(timer);
      wrap.innerHTML = ''; rows = [];
      if (picking !== null) {
        wrap.append(el('div', 'hs-sec', 'เลือกเมล็ดที่จะปลูกในแปลง ' + (picking + 1)));
        let any = false;
        Object.keys(CROPS).forEach(function (seed) {
          const own = m.countMat(seed);
          if (own < 1) return;
          any = true;
          const c = CROPS[seed], row = el('div', 'hs-row');
          const left = el('div', 'hs-nm');
          left.append(el('div', '', MAT_DEFS[c.veg].icon + ' ' + MAT_DEFS[seed].name + ' (มี ' + own + ')'),
            el('div', 'hs-sub', 'โต ' + Math.round(c.growMs / 60000) + ' นาที • ได้ ' + c.yieldMin + '-' + c.yieldMax + ' ชิ้น'));
          const b = el('button', 'hs-mini', 'ปลูก');
          b.addEventListener('click', function () { if (plantSeed(m, picking, seed)) { picking = null; draw(); } });
          row.append(left, b); wrap.append(row);
        });
        if (!any) wrap.append(el('div', 'hs-note', 'ไม่มีเมล็ด เมล็ดได้จากการล่ามอนสเตอร์ (หรือเก็บเกี่ยวผักแล้วมีโอกาสได้เมล็ดคืน)'));
        const back = el('button', 'hs-btn hs-alt', '◀ กลับ');
        back.addEventListener('click', function () { picking = null; draw(); });
        wrap.append(back);
        return;
      }
      const all = el('button', 'hs-btn hs-main2', '✂️ เก็บเกี่ยวทั้งหมดที่พร้อม');
      all.addEventListener('click', function () {
        const got = [];
        for (let i = 0; i < PLOT_COUNT; i++) { const t = harvestPlot(m, i); if (t) got.push(t); }
        toast(m, got.length ? 'เก็บเกี่ยว: ' + got.join(' / ') : 'ยังไม่มีผักพร้อมเก็บ');
        draw();
      });
      wrap.append(all);
      for (let i = 0; i < PLOT_COUNT; i++) {
        const row = el('div', 'hs-row');
        const left = el('div', 'hs-nm');
        const title = el('div', '', 'แปลง ' + (i + 1));
        const txt = el('div', 'hs-sub', '');
        const pg = el('div', 'hs-pg'), fill = el('div', 'hs-pgf');
        pg.append(fill);
        left.append(title, txt, pg);
        const btn = el('button', 'hs-mini', '');
        (function (idx) {
          btn.addEventListener('click', function () {
            const inf = plotInfo(h.plots[idx]);
            if (inf.st === 'empty') { picking = idx; draw(); }
            else if (inf.st === 'ready') { const t = harvestPlot(m, idx); if (t) toast(m, 'เก็บเกี่ยว: ' + t); draw(); }
          });
        })(i);
        row.append(left, btn); wrap.append(row);
        rows.push({ i: i, txt: txt, btn: btn, fill: fill });
      }
      timer = setInterval(function () { if (!alive()) { clearInterval(timer); return; } refreshRows(); }, 1000);
    }
    draw(); refreshRows();
    return function () { clearInterval(timer); };
  }

  // ---------- ทำอาหาร / สมุดอาหาร ----------
  function costFor(r, books) {
    const o = {};
    Object.keys(r.need).forEach(function (id) { o[id] = Math.ceil(r.need[id] * (100 + COOK_STEP_PCT * books) / 100); });
    return o;
  }
  function cookOnce(m, r) {   // 'ok' | 'max' | 'lack'
    const h = m.houseState(), n = h.cookbook[r.id] || 0;
    if (n >= COOK_MAX_BOOKS) return 'max';
    const cost = costFor(r, n), ids = Object.keys(cost);
    for (let i = 0; i < ids.length; i++) if (m.countMat(ids[i]) < cost[ids[i]]) return 'lack';
    ids.forEach(function (id) { m.takeMat(id, cost[id]); });
    h.cookbook[r.id] = n + 1;
    return 'ok';
  }

  function cookView(m, card, body) {
    const h = m.houseState();
    let tier = 1, onlyCan = false;
    const sum = el('div', 'hs-sum', '');
    const tabs = el('div', 'hs-tabs hs-sub-tabs');
    const filt = el('button', 'hs-btn hs-alt', '');
    const list = el('div', 'hs-list');
    body.append(sum, tabs, filt, list);

    function canCook(r) {
      const n = h.cookbook[r.id] || 0;
      if (n >= COOK_MAX_BOOKS) return false;
      const c = costFor(r, n);
      return Object.keys(c).every(function (id) { return m.countMat(id) >= c[id]; });
    }
    function summary() {
      const b = m.cookbookBonus(), ks = Object.keys(b);
      let books = 0; Object.keys(h.cookbook).forEach(function (k) { books += h.cookbook[k]; });
      sum.textContent = '📖 ทำแล้ว ' + books + ' เล่ม • โบนัสถาวรรวม: ' + (ks.length ? ks.map(function (k) { return fmtVal(k, b[k]); }).join(' · ') : 'ยังไม่มี');
    }
    function drawTabs() {
      tabs.innerHTML = '';
      for (let t = 1; t <= 5; t++) {
        const b = el('button', 'hs-tab' + (t === tier ? ' on' : ''), 'ระดับ ' + t);
        b.addEventListener('click', function () { tier = t; draw(); });
        tabs.append(b);
      }
    }
    function doCook(r, times) {
      let ok = 0, why = '';
      for (let i = 0; i < times; i++) { const x = cookOnce(m, r); if (x === 'ok') ok++; else { why = x; break; } }
      if (ok > 0) {
        m.computeAtk();
        if (m.saveSoon) m.saveSoon();
        toast(m, '🍳 ทำ ' + r.name + ' ได้ ' + ok + ' เล่ม (รวม ' + h.cookbook[r.id] + ')');
      } else toast(m, why === 'max' ? 'ครบ ' + COOK_MAX_BOOKS + ' เล่มแล้ว' : 'วัตถุดิบไม่พอ');
      draw();
    }
    function draw() {
      summary(); drawTabs();
      filt.textContent = (onlyCan ? '☑' : '☐') + ' แสดงเฉพาะที่ทำได้ตอนนี้';
      list.innerHTML = '';
      let shown = 0;
      COOK_RECIPES.forEach(function (r) {
        if (r.tier !== tier) return;
        const n = h.cookbook[r.id] || 0, can = canCook(r);
        if (onlyCan && !can) return;
        shown++;
        const row = el('div', 'hs-dish' + (n >= COOK_MAX_BOOKS ? ' max' : ''));
        const head = el('div', 'hs-dh');
        head.append(el('span', 'hs-dn', r.icon + ' ' + r.name), el('span', 'hs-dc', 'เล่ม ' + n + '/' + COOK_MAX_BOOKS));
        const eff = el('div', 'hs-sub', 'ต่อเล่ม: ' + Object.keys(r.bonus).map(function (k) { return fmtVal(k, r.bonus[k]); }).join(' · ')
          + (n > 0 ? '  (รวมแล้ว ' + Object.keys(r.bonus).map(function (k) { return fmtVal(k, r.bonus[k] * n); }).join(' · ') + ')' : ''));
        row.append(head, eff);
        if (n < COOK_MAX_BOOKS) {
          const cost = costFor(r, n), ing = el('div', 'hs-ing');
          Object.keys(cost).forEach(function (id) {
            const have = m.countMat(id), s = el('span', have >= cost[id] ? 'hs-ok' : 'hs-no', matName(id) + ' ' + have + '/' + cost[id]);
            ing.append(s);
          });
          row.append(ing);
          const bt = el('div', 'hs-bt');
          const b1 = el('button', 'hs-mini', '🍳 ทำ ×1'), b10 = el('button', 'hs-mini', '🍳 ทำต่อเนื่อง ×10');
          b1.disabled = !can; b10.disabled = !can;
          b1.addEventListener('click', function () { doCook(r, 1); });
          b10.addEventListener('click', function () { doCook(r, 10); });
          bt.append(b1, b10); row.append(bt);
        } else row.append(el('div', 'hs-ok', '✔ ครบ ' + COOK_MAX_BOOKS + ' เล่ม'));
        list.append(row);
      });
      if (!shown) list.append(el('div', 'hs-note', 'ยังไม่มีเมนูที่ทำได้ในระดับนี้'));
    }
    filt.addEventListener('click', function () { onlyCan = !onlyCan; draw(); });
    draw();
  }

  // ---------- ร้านค้า ----------
  function shopView(m, card, body) {
    const goldEl = el('div', 'hs-sum', '');
    const list = el('div', 'hs-list');
    body.append(goldEl, list);
    const refs = [];
    function refreshAll() {
      goldEl.textContent = '🪙 ทอง ' + Number(m.stats.gold || 0).toLocaleString();
      refs.forEach(function (r) { r.own.textContent = 'มี ' + m.countMat(r.id); });
    }
    function section(title, ids) {
      list.append(el('div', 'hs-sec', title));
      ids.forEach(function (id) {
        const d = MAT_DEFS[id], row = el('div', 'hs-row'), left = el('div', 'hs-nm');
        const own = el('div', 'hs-sub', '');
        left.append(el('div', '', d.icon + ' ' + d.name + '  🪙' + d.price), own);
        const bt = el('div', 'hs-bt');
        [1, 10].forEach(function (q) {
          const b = el('button', 'hs-mini', 'ซื้อ ×' + q);
          b.addEventListener('click', function () {
            const cost = d.price * q;
            if (!m.canAddMat(id, q)) { toast(m, 'กระเป๋าเต็ม'); return; }
            if (!spendGold(m, cost)) { toast(m, 'ทองไม่พอ'); return; }   // ลดทองในเกม -> goldSync.js ส่งส่วนต่างติดลบขึ้นเซิร์ฟเวอร์เอง
            m.addMat(id, q);
            toast(m, 'ซื้อ ' + d.name + ' x' + q);
            if (m.saveSoon) m.saveSoon();
            refreshAll();
          });
          bt.append(b);
        });
        row.append(left, bt); list.append(row);
        refs.push({ id: id, own: own });
      });
    }
    section('🧂 เครื่องปรุง', ['sp_salt', 'sp_sugar', 'sp_sauce', 'sp_spice', 'sp_oil']);
    section('🎣 เหยื่อ', ['bait_basic']);
    refreshAll();
  }

  // ---------- แผงบ้าน (มีแท็บ) ----------
  function openHouse(m, tab, arg) {
    if (m.townModal) return;
    const h = m.houseState();
    if (!h.gift2) {   // ชุดเริ่มต้น
      h.gift2 = 1;
      m.addMat('bait_basic', FISH_CFG.giftBait);
      m.addMat('water', 20); m.addMat('sp_salt', 5); m.addMat('sp_oil', 5);
      ['cabbage', 'carrot', 'tomato', 'corn', 'potato', 'onion'].forEach(function (k) { m.addMat('seed_' + k, 3); });
      toast(m, '🎁 ได้ชุดเริ่มต้น: เหยื่อ น้ำ เครื่องปรุง และเมล็ดผัก');
    }
    const card = townDomCard(m, '🏠 บ้านของฉัน');
    card.classList.add('hs-card');
    const tabs = el('div', 'hs-tabs'), body = el('div', 'hs-body');
    card.append(tabs, body);
    const TABS = [['fish', '🎣 ตกปลา', fishView], ['farm', '🥬 แปลงผัก', farmView], ['cook', '🍳 ทำอาหาร', cookView], ['shop', '🛒 ร้านค้า', shopView]];
    let cleanup = null;
    function show(key, a) {
      if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
      body.innerHTML = '';
      tabs.innerHTML = '';
      TABS.forEach(function (t) {
        const b = el('button', 'hs-tab' + (t[0] === key ? ' on' : ''), t[1]);
        b.addEventListener('click', function () { show(t[0]); });
        tabs.append(b);
      });
      const t = TABS.filter(function (x) { return x[0] === key; })[0];
      cleanup = t[2](m, card, body, a) || null;
    }
    show(tab || 'fish', arg);
    townCloseBtn(m, card);
  }
  window.openHouse = openHouse;

  // ================= แมพบ้านส่วนตัว =================
  const hasFrame = function (m, k) { return m.textures.exists('town') && !!m.textures.getFrame('town', k); };

  // ================= ภาพจริงของบ้าน (assets/house/*.png) =================
  // ไม่มีไฟล์ = ใช้ภาพที่วาดด้วยโค้ดแทนอัตโนมัติ | ไฟล์ที่พื้นหลังเป็นสีขาว/ม่วงแดง ระบบลบพื้นหลังให้เองตอนโหลด (ไม่ต้องทำโปร่งใสก่อน)
  const HOUSE_IMG_DIR = 'assets/house/';
  const HOUSE_IMG_VER = 1;
  const HOUSE_CROP_IMAGES = [];    // ถ้ามีภาพพืชเฉพาะชนิด ใส่ key ที่นี่ เช่น ['cabbage','carrot'] แล้วมีไฟล์ crop_cabbage.png (ใช้โครงเดียวกับ crops.png)
  const HOUSE_CROP_FRAMES = 4;     // crops.png = 4 เฟรมเท่ากันเรียงซ้าย->ขวา: งอก / โตเล็ก / โตใหญ่ / สุก
  const PLOT_IMG_W = 150;          // ความกว้างภาพแปลงตอนมีต้นผัก (px ในเกม)
  const PLOT_EMPTY_W = 135;        // ความกว้างภาพแปลงว่าง (ถ้าใช้ plot_empty.png ที่สไตล์เดียวกับ crops.png ตั้งเป็น 150)
  const HIMG = {};
  const HIMG_MISSING = [];         // ไฟล์ที่หาไม่เจอ/ประมวลผลไม่ได้ (แจ้งเตือนตอนเข้าบ้าน)

  function himgKey(img, mode) {    // ลบพื้นหลังที่ติดขอบภาพ (ขาว/เทาอ่อน หรือม่วงแดง) ไม่ลบสีขาวที่อยู่ในตัวภาพ
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, w, h), p = d.data;
    const isBg = function (i) {
      const r = p[i], g = p[i + 1], b = p[i + 2];
      if (p[i + 3] < 10) return true;
      if (mode === 'magenta') return r > 170 && b > 170 && g < 120;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      return mn > 205 && (mx - mn) < 28;
    };
    const seen = new Uint8Array(w * h), stack = new Int32Array(w * h);
    let sp = 0;
    const tryPush = function (i) { if (!seen[i]) { seen[i] = 1; if (isBg(i * 4)) stack[sp++] = i; } };
    for (let i = 0; i < w; i++) { tryPush(i); tryPush((h - 1) * w + i); }
    for (let j = 0; j < h; j++) { tryPush(j * w); tryPush(j * w + w - 1); }
    while (sp > 0) {
      const i = stack[--sp];
      p[i * 4 + 3] = 0;
      const px = i % w, py = (i / w) | 0;
      if (px > 0) tryPush(i - 1);
      if (px < w - 1) tryPush(i + 1);
      if (py > 0) tryPush(i - w);
      if (py < h - 1) tryPush(i + w);
    }
    if (mode === 'magenta') {      // ขอบที่เหลือสีชมพูอมม่วง
      for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        if (p[o + 3] && p[o] > 170 && p[o + 2] > 170 && p[o + 1] < 120) p[o + 3] = 0;
      }
    }
    x.putImageData(d, 0, 0);
    return c;
  }
  function himgBox(c, x0, y0, w, h) {
    const d = c.getContext('2d').getImageData(x0, y0, w, h).data;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    return maxX < 0 ? null : { x: x0 + minX, y: y0 + minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }
  function himgTrim(c) {
    const b = himgBox(c, 0, 0, c.width, c.height);
    if (!b) return c;
    const o = document.createElement('canvas');
    o.width = b.w; o.height = b.h;
    o.getContext('2d').drawImage(c, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    return o;
  }
  function himgScale(cv, w) {      // ย่อภาพให้ใกล้ขนาดที่โชว์จริง (เป็น 2 เท่า) ภาพไม่แตกและกินแรมน้อยลง
    const tw = Math.max(1, Math.round(w));
    if (cv.width <= tw) return cv;
    const o = document.createElement('canvas');
    o.width = tw; o.height = Math.max(1, Math.round(cv.height * tw / cv.width));
    const c = o.getContext('2d');
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(cv, 0, 0, o.width, o.height);
    return o;
  }
  function himgLoad(name, files, mode, sheet) {   // files = ชื่อไฟล์เดียว หรือรายการชื่อสำรอง (ลองทีละชื่อ)
    const list = Array.isArray(files) ? files : [files];
    let tried = 0;
    const img = new Image();
    img.onload = function () {
      try {
        const k = himgKey(img, mode);
        if (!sheet) { HIMG[name] = himgTrim(k); return; }
        const n = HOUSE_CROP_FRAMES, fw = Math.floor(k.width / n);
        let top = k.height, bot = -1;
        for (let i = 0; i < n; i++) {
          const b = himgBox(k, i * fw, 0, fw, k.height);
          if (b) { top = Math.min(top, b.y); bot = Math.max(bot, b.y + b.h); }
        }
        if (bot < 0) return;
        const frames = [];
        for (let i = 0; i < n; i++) {
          const o = document.createElement('canvas');
          o.width = fw; o.height = bot - top;
          o.getContext('2d').drawImage(k, i * fw, top, fw, bot - top, 0, 0, fw, bot - top);
          frames.push(o);
        }
        HIMG[name] = { frames: frames };
      } catch (e) { console.warn('house img', name, e); HIMG_MISSING.push(list[0] + ' (อ่านภาพไม่ได้)'); }
    };
    img.onerror = function () {
      tried++;
      if (tried < list.length) img.src = HOUSE_IMG_DIR + list[tried] + '?v=' + HOUSE_IMG_VER;
      else { HIMG_MISSING.push(list[0]); console.warn('house img: ไม่พบไฟล์', HOUSE_IMG_DIR + list[0]); }
    };
    img.src = HOUSE_IMG_DIR + list[0] + '?v=' + HOUSE_IMG_VER;   // ไม่มีไฟล์ = ใช้ภาพวาดด้วยโค้ดแทน
  }
  // คืน { key, w, h } ของ texture (สร้างครั้งแรกที่ใช้) หรือ null ถ้ายังไม่มีภาพ
  function himgTex(m, name, idx, targetW) {
    const e = HIMG[name];
    if (!e) return null;
    const cv = (idx === null || idx === undefined) ? e : (e.frames && e.frames[idx]);
    if (!cv) return null;
    const key = 'hi_' + name + ((idx === null || idx === undefined) ? '' : '_' + idx);
    let w = cv.width, h = cv.height;
    if (!m.textures.exists(key)) {
      const sc = himgScale(cv, (targetW || cv.width) * 2);
      m.textures.addCanvas(key, sc);
      w = sc.width; h = sc.height;
    } else {
      const f = m.textures.get(key).getSourceImage();
      w = f.width; h = f.height;
    }
    return { key: key, w: w, h: h };
  }
  function cropFrames(m, seedKey) {
    const name = HIMG['crop_' + seedKey] ? 'crop_' + seedKey : 'crops';
    if (!HIMG[name] || !HIMG[name].frames) return null;
    const out = [];
    for (let i = 0; i < HOUSE_CROP_FRAMES; i++) {
      const t = himgTex(m, name, i, PLOT_IMG_W);
      if (!t) return null;
      out.push(t);
    }
    return out;
  }
  [['cabin', ['cabin.png', 'house.png', 'home.png', 'cabin.jpg', 'cabin.webp'], 'white'],
   ['campfire', ['campfire.png', 'fire.png', 'campfire.jpg', 'campfire.webp'], 'white'],
   ['pond', ['pond.png', 'fishing_pond.png', 'pond.jpg', 'pond.webp'], 'magenta'],
   ['plot', ['plot.png', 'plot.jpg', 'plot.webp'], 'white'],
   ['plot_empty', ['plot_empty.png'], 'white']].forEach(function (r) { himgLoad(r[0], r[1], r[2], false); });
  himgLoad('crops', ['crops.png', 'crop.png', 'crops.jpg', 'crops.webp'], 'white', true);
  HOUSE_CROP_IMAGES.forEach(function (k) { himgLoad('crop_' + k, 'crop_' + k + '.png', 'white', true); });

  function houseBuild(m, T) {
    const wb = m.physics.world.bounds;
    const L = Math.round(T.ox + TOWN.w / 2 - HOUSE.w / 2), Tp = Math.round(T.oy + TOWN.h / 2 - HOUSE.h / 2);
    const R = L + HOUSE.w, Bm = Tp + HOUSE.h, cx = L + HOUSE.w / 2;
    const objs = [], blockers = [];
    const H = { L: L, Tp: Tp, R: R, Bm: Bm, objs: objs, blockers: blockers, plots: [], hidden: [] };
    const add = function (o) { objs.push(o); return o; };
    const tween = function (cfg) { const t = m.tweens.add(cfg); objs.push({ destroy: function () { t.remove(); } }); return t; };
    const label = function (x, y, txt, size) {
      return add(m.add.text(x, y, txt, { fontFamily: 'Mitr, sans-serif', fontSize: (size || 16) + 'px', color: '#ffe28a', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(45));
    };
    const zone = function (x, y, w, h, fn) {
      const z = add(m.add.zone(x, y, w, h).setDepth(60).setInteractive({ useHandCursor: true }));
      z.on('pointerdown', fn);
      return z;
    };

    townMakeGroundTextures(m);
    add(m.add.tileSprite(wb.x, wb.y, wb.width, wb.height, 'town_grass').setOrigin(0).setDepth(0.9).setTint(0x5d7a58));
    add(m.add.tileSprite(L, Tp, HOUSE.w, HOUSE.h, 'town_grass').setOrigin(0).setDepth(1));
    add(m.add.tileSprite(cx - 55, Tp + 400, 110, HOUSE.h - 400, 'town_cobble').setOrigin(0).setDepth(1.2));

    // รั้ว (เว้นช่องประตูด้านล่าง)
    const fg = add(m.add.graphics().setDepth(1.6));
    fg.lineStyle(6, 0x5a3a1f, 1);
    fg.lineBetween(L, Tp, R, Tp); fg.lineBetween(L, Tp, L, Bm); fg.lineBetween(R, Tp, R, Bm);
    fg.lineBetween(L, Bm, cx - 85, Bm); fg.lineBetween(cx + 85, Bm, R, Bm);
    fg.fillStyle(0x7a5230, 1);
    for (let x = L; x <= R; x += 70) fg.fillRect(x - 5, Tp - 14, 10, 24);
    for (let y = Tp; y <= Bm; y += 70) { fg.fillRect(L - 5, y - 5, 10, 24); fg.fillRect(R - 5, y - 5, 10, 24); }
    for (let x = L; x <= cx - 85; x += 70) fg.fillRect(x - 5, Bm - 14, 10, 24);
    for (let x = cx + 85; x <= R; x += 70) fg.fillRect(x - 5, Bm - 14, 10, 24);
    fg.fillStyle(0x9a6a38, 1);
    fg.fillRect(cx - 95, Bm - 60, 16, 70); fg.fillRect(cx + 79, Bm - 60, 16, 70); fg.fillRect(cx - 95, Bm - 68, 190, 14);

    label(cx, Tp + 34, '🏡 บ้านของฉัน', 30);

    // กระท่อม (ตกแต่ง)
    const cabY = Tp + 320, cabImg = himgTex(m, 'cabin', null, 400);
    if (cabImg) {
      const CW = 400, CH = Math.round(CW * cabImg.h / cabImg.w), cabX = L + 710;
      add(m.add.image(cabX, cabY, cabImg.key).setOrigin(0.5, 0.94).setDisplaySize(CW, CH).setDepth(townDepth(cabY)));
      blockers.push({ x0: cabX - CW * 0.42, y0: cabY - CH * 0.45, x1: cabX + CW * 0.42, y1: cabY });
    }
    const cab = add(m.add.graphics().setDepth(townDepth(cabY)));
    if (cabImg) cab.setVisible(false);
    cab.fillStyle(0x000000, 0.3).fillEllipse(cx, cabY + 4, 340, 30);
    cab.fillStyle(0xc9a16a, 1).fillRect(cx - 140, cabY - 110, 280, 110);
    cab.lineStyle(4, 0x6a4a2a, 1).strokeRect(cx - 140, cabY - 110, 280, 110);
    cab.fillStyle(0x8a3a2a, 1).fillTriangle(cx - 175, cabY - 105, cx + 175, cabY - 105, cx, cabY - 215);
    cab.fillStyle(0x5a3a1a, 1).fillRect(cx - 28, cabY - 76, 56, 76);
    cab.fillStyle(0x8fd0ff, 1).fillRect(cx - 115, cabY - 85, 48, 40).fillRect(cx + 67, cabY - 85, 48, 40);
    cab.lineStyle(3, 0x6a4a2a, 1).strokeRect(cx - 115, cabY - 85, 48, 40).strokeRect(cx + 67, cabY - 85, 48, 40);
    if (!cabImg) blockers.push({ x0: cx - 150, y0: cabY - 100, x1: cx + 150, y1: cabY });

    // บ่อตกปลา
    const pondImg = himgTex(m, 'pond', null, 480);
    const pX = L + 270, pY = Tp + 260;
    let rx = 200, ry = 120;
    if (pondImg) {
      const PW = 480, PH = Math.round(PW * pondImg.h / pondImg.w);
      add(m.add.image(pX, pY, pondImg.key).setDisplaySize(PW, PH).setDepth(1.3));
      rx = PW / 2; ry = PH / 2 * 0.9;
      blockers.push({ x0: pX - rx * 0.8, y0: pY - ry * 0.75, x1: pX + rx * 0.8, y1: pY + ry * 0.45 });
    }
    const pg = add(m.add.graphics().setDepth(1.3));
    if (pondImg) pg.setVisible(false);
    pg.fillStyle(0x8a7a5a, 1).fillEllipse(pX, pY, rx * 2 + 24, ry * 2 + 24);
    pg.fillStyle(0x2f6fa8, 1).fillEllipse(pX, pY, rx * 2, ry * 2);
    pg.fillStyle(0x4a95d0, 0.55).fillEllipse(pX - 20, pY - 14, rx * 1.4, ry * 1.2);
    pg.fillStyle(0x9a6a38, 1).fillRect(pX - 36, pY + ry - 70, 72, 100);
    pg.lineStyle(2, 0x5a3a1f, 1);
    for (let k = 0; k < 5; k++) pg.lineBetween(pX - 36, pY + ry - 70 + k * 20, pX + 36, pY + ry - 70 + k * 20);
    const rip = add(m.add.ellipse(pX + 60, pY - 30, 60, 22).setStrokeStyle(2, 0xffffff, 0.7).setDepth(1.35));
    if (pondImg) rip.setVisible(false);
    tween({ targets: rip, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 1800, repeat: -1 });
    if (!pondImg) blockers.push({ x0: pX - rx * 0.85, y0: pY - ry * 0.8, x1: pX + rx * 0.85, y1: pY + ry * 0.55 });
    label(pX, pY - ry - 26, '🎣 บ่อตกปลา / ตักน้ำ', 18);
    zone(pX, pY + 30, rx * 2, ry * 2 + 100, function () { houseApproach(m, { kind: 'pond' }, pX, pY + ry + 60); });

    // กองไฟ
    const fX = L + 1040, fY = Tp + 330, fireImg = himgTex(m, 'campfire', null, 210);
    let fH = 120;
    if (fireImg) {
      const FW = 210;
      fH = Math.round(FW * fireImg.h / fireImg.w);
      add(m.add.image(fX, fY + 20, fireImg.key).setOrigin(0.5, 1).setDisplaySize(FW, fH).setDepth(townDepth(fY + 20)));
      blockers.push({ x0: fX - 60, y0: fY - 30, x1: fX + 60, y1: fY + 20 });
    }
    const fg2 = add(m.add.graphics().setDepth(townDepth(fY)));
    if (fireImg) fg2.setVisible(false);
    fg2.fillStyle(0x000000, 0.3).fillEllipse(fX, fY + 4, 120, 22);
    fg2.fillStyle(0x6a4a2a, 1).fillRoundedRect(fX - 50, fY - 14, 100, 16, 6);
    fg2.fillStyle(0x7a5230, 1).fillRoundedRect(fX - 40, fY - 24, 80, 14, 6);
    fg2.fillStyle(0x777777, 1);
    for (let k = -3; k <= 3; k++) fg2.fillCircle(fX + k * 17, fY + 8, 8);
    const glow = add(m.add.circle(fX, fY - 30, 70, 0xffa040, 0.18).setDepth(1.4));
    tween({ targets: glow, alpha: 0.32, scale: 1.15, yoyo: true, repeat: -1, duration: 600 });
    const flame = add(m.add.text(fX, fY - 8, '🔥', { fontSize: '52px' }).setOrigin(0.5, 1).setDepth(townDepth(fY) + 0.1));
    if (fireImg) flame.setVisible(false);
    tween({ targets: flame, scaleX: 1.12, scaleY: 1.18, yoyo: true, repeat: -1, duration: 380 });
    if (!fireImg) blockers.push({ x0: fX - 55, y0: fY - 26, x1: fX + 55, y1: fY });
    label(fX, fY + 20 - (fireImg ? fH : 120) - 18, '🍳 กองไฟ (ทำอาหาร)', 18);
    zone(fX, fY + 20 - (fireImg ? fH / 2 : 50), 180, fireImg ? fH : 140, function () { houseApproach(m, { kind: 'fire' }, fX, fY + 90); });

    // แปลงผัก
    const plotE = himgTex(m, 'plot_empty', null, 300) || himgTex(m, 'plot', null, 300);
    for (let i = 0; i < PLOT_COUNT; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const x = L + 170 + col * 150, y = Tp + 640 + row * 140;
      const g = add(m.add.graphics().setDepth(1.3));
      if (plotE) g.setVisible(false);
      g.fillStyle(0x5a3a1f, 1).fillRoundedRect(x - 64, y - 49, 128, 98, 10);
      g.fillStyle(0x6b4a2a, 1).fillRoundedRect(x - 60, y - 45, 120, 90, 8);
      g.lineStyle(3, 0x4a2e16, 1);
      for (let k = -1; k <= 1; k++) g.lineBetween(x - 54, y + k * 26, x + 54, y + k * 26);
      const plant = add(m.add.text(x, y + 14, '', { fontSize: '34px' }).setOrigin(0.5, 1).setDepth(plotE ? townDepth(y + 34) + 0.05 : 1.8));
      const tx = add(m.add.text(x, y + 56, '', { fontFamily: 'Mitr, sans-serif', fontSize: '14px', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(45));
      add(m.add.text(x - 52, y - 44, String(i + 1), { fontFamily: 'Mitr, sans-serif', fontSize: '13px', color: '#d8c08a' }).setOrigin(0.5).setDepth(1.9));
      let pImg = null;
      if (plotE) {
        pImg = add(m.add.image(x, y + 34, plotE.key).setOrigin(0.5, 1)
          .setDisplaySize(PLOT_EMPTY_W, Math.round(PLOT_EMPTY_W * plotE.h / plotE.w)).setDepth(townDepth(y + 34)));
        blockers.push({ x0: x - 62, y0: y - 26, x1: x + 62, y1: y + 34 });
      }
      H.plots.push({ plant: plant, tx: tx, img: pImg, emptyT: plotE, sig: '', tw: null, x: x, y: y });
      zone(x, y - 10, 150, 130, function () { houseApproach(m, { kind: 'plot', idx: i }, x, y + 70); });
    }
    label(L + 320, Tp + 540, '🥬 แปลงผัก', 18);

    // ต้นไม้/หิน/โคม (ถ้ามีภาพในแอตลาสเมือง)
    [
      { k: 'tree_pine', x: 1120, y: 740, bw: 110 }, { k: 'tree_plum', x: 960, y: 870, bw: 100 },
      { k: 'tree_bamboo', x: 1190, y: 930, bw: 150 }, { k: 'tree_bamboo', x: 90, y: 960, bw: 150 },
      { k: 'rock1', x: 840, y: 760 }, { k: 'lantern', x: 560, y: 520, bw: 34, bh: 20 }, { k: 'lantern', x: 740, y: 520, bw: 34, bh: 20 },
    ].forEach(function (p) {
      if (!hasFrame(m, p.k)) return;
      const px = L + p.x, py = Tp + p.y;
      add(m.add.image(px, py, 'town', p.k).setOrigin(0.5, 1).setDepth(townDepth(py)));
      if (p.bw) blockers.push({ x0: px - p.bw / 2, y0: py - (p.bh || 24), x1: px + p.bw / 2, y1: py });
    });

    // ประตูออก
    label(cx, Bm - 100, '🚪 ออกจากบ้าน', 17);
    zone(cx, Bm - 30, 180, 110, function () { houseApproach(m, { kind: 'gate' }, cx, Bm - 70); });

    H.spawn = { x: cx, y: Bm - 130 };
    H.bounds = { x0: L + 30, y0: Tp + 80, x1: R - 30, y1: Bm - 16 };
    return H;
  }

  function refreshPlots(m) {
    const H = m._house;
    if (!H) return;
    const h = m.houseState();
    H.plots.forEach(function (pl, i) {
      const inf = plotInfo(h.plots[i]);
      let stage = 'e', icon = '', size = 34, tx = '';
      if (inf.st === 'grow') {
        stage = inf.frac < 0.33 ? 's1' : (inf.frac < 0.66 ? 's2' : 's3');
        icon = stage === 's1' ? '🌱' : '🌿'; size = stage === 's1' ? 28 : (stage === 's2' ? 36 : 46);
        tx = fmtTime(inf.left);
      } else if (inf.st === 'ready') {
        stage = 'r'; icon = MAT_DEFS[inf.crop.veg].icon; size = 50; tx = '✨ เก็บได้!';
      }
      pl.tx.setText(tx);
      const sig = inf.st + stage + (h.plots[i] ? h.plots[i].seed : '');
      if (sig === pl.sig) return;
      pl.sig = sig;
      pl.plant.setText(icon).setFontSize(size).setScale(1);
      if (pl.tw) { pl.tw.remove(); pl.tw = null; }
      let fr = null;   // ภาพต้นผักจริง 4 ระยะ (ถ้ามี crops.png) | ไม่มี = ใช้อีโมจิบนภาพแปลง
      if (pl.img) {
        fr = (stage !== 'e') ? cropFrames(m, h.plots[i].seed.slice(5)) : null;
        const fi = stage === 's1' ? 0 : (stage === 's2' ? 1 : (stage === 's3' ? 2 : 3));
        const t = fr ? fr[fi] : pl.emptyT;
        if (t) {
          const W = (t === pl.emptyT) ? PLOT_EMPTY_W : PLOT_IMG_W;
          pl.img.setTexture(t.key);
          pl.img.setDisplaySize(W, Math.round(W * t.h / t.w));
        }
        pl.plant.setVisible(!fr);
      }
      if (stage === 'r' && !fr) pl.tw = m.tweens.add({ targets: pl.plant, scale: 1.18, yoyo: true, repeat: -1, duration: 480 });
    });
  }

  function houseApproach(m, target, fx, fy) {
    if (!m._house || m.townModal || m.panel || !m.player) return;
    const p = m.player;
    if (Math.hypot(fx - p.x, fy - (p.y + HOUSE.feet)) < 110) {
      m.houseGoal = null; m.housePending = null;
      houseInteract(m, target);
      return;
    }
    m.housePending = { t: target, x: fx, y: fy };
    m.houseGoal = { x: fx, y: fy - HOUSE.feet };
    toast(m, 'กำลังเดินไป...');
  }
  function houseInteract(m, t) {
    if (t.kind === 'pond') openHouse(m, 'fish');
    else if (t.kind === 'fire') openHouse(m, 'cook');
    else if (t.kind === 'plot') openHouse(m, 'farm', { plot: t.idx });
    else if (t.kind === 'gate') houseExit(m);
  }

  function houseTick(m) {
    const H = m._house, p = m.player;
    if (!H || !p || !p.active) return;
    m.autoMode = false;
    const body = p.body, F = HOUSE.feet;

    if (m.houseGoal && body) {
      const v = body.velocity, mine = m._houseMine;
      const userMoved = v.length() > 5 && (!mine || Math.abs(v.x - mine.x) > 5 || Math.abs(v.y - mine.y) > 5);
      if (userMoved || m.townModal) { m.houseGoal = null; m.housePending = null; m._houseMine = null; }
      else {
        const dx = m.houseGoal.x - p.x, dy = m.houseGoal.y - p.y, d = Math.hypot(dx, dy);
        if (d < 6) { m.houseGoal = null; m._houseMine = null; body.setVelocity(0, 0); }
        else {
          m._houseMine = { x: dx / d * HOUSE.speed, y: dy / d * HOUSE.speed };
          body.setVelocity(m._houseMine.x, m._houseMine.y);
        }
      }
    }

    const B = H.bounds;
    let x = Phaser.Math.Clamp(p.x, B.x0, B.x1), y = Phaser.Math.Clamp(p.y, B.y0, B.y1);
    if (H.lx !== undefined && townBlocked(H, x, y + F) && !townBlocked(H, H.lx, H.ly + F)) {
      if (!townBlocked(H, H.lx, y + F)) x = H.lx;
      else if (!townBlocked(H, x, H.ly + F)) y = H.ly;
      else { x = H.lx; y = H.ly; }
    }
    if (x !== p.x || y !== p.y) p.setPosition(x, y);
    H.lx = x; H.ly = y;

    const dp = townDepth(y + F);
    p.setDepth(dp);
    if (m.myLabel && m.myLabel.setDepth) m.myLabel.setDepth(dp + 0.01);

    // ซ่อนผู้เล่นอื่นในเครื่องเรา (บ้านส่วนตัว)
    Object.values(m.others || {}).forEach(function (o) {
      if (!o) return;
      Object.keys(o).forEach(function (k) {
        const v = o[k];
        if (v && typeof v === 'object' && typeof v.setVisible === 'function') {
          if (v.visible) { v.setVisible(false); if (H.hidden.indexOf(v) < 0) H.hidden.push(v); }
        }
      });
    });

    if (m.housePending) {
      const q = m.housePending;
      if (Math.hypot(q.x - x, q.y - (y + F)) < 90) {
        m.housePending = null; m.houseGoal = null; m._houseMine = null;
        if (body) body.setVelocity(0, 0);
        houseInteract(m, q.t);
      }
    }
    const now = m.time ? m.time.now : 0;
    if (now - (H.lastRef || 0) > 500) { H.lastRef = now; refreshPlots(m); }
  }

  function houseEnter(m) {
    const T = m._town;
    if (m._house || !T || !inTown(m)) return;
    townCloseDialog(m);
    T.objs.forEach(function (o) { if (o && typeof o.setVisible === 'function') o.setVisible(false); });
    const H = houseBuild(m, T);
    m._house = H;
    m.townGoal = null; m.townPending = null; m._townMine = null;
    m.houseGoal = null; m.housePending = null; m._houseMine = null;
    if (m.player) {
      m.player.setPosition(H.spawn.x, H.spawn.y);
      if (m.player.body) m.player.body.setVelocity(0, 0);
    }
    try { m.cameras.main.centerOn(H.spawn.x, H.spawn.y); } catch (e) {}
    H.lx = H.spawn.x; H.ly = H.spawn.y;
    m.houseState();
    refreshPlots(m);
    const miss = HIMG_MISSING.filter(function (f) { return f !== 'plot_empty.png' && f.indexOf('crop_') !== 0; });
    if (miss.length && !window._houseMissToast) {
      window._houseMissToast = 1;
      toast(m, 'ไม่พบไฟล์ภาพใน assets/house/ : ' + miss.join(', '));
    }
  }

  function houseExit(m, silent) {
    const H = m._house;
    if (!H) return;
    townCloseDialog(m);
    H.plots.forEach(function (pl) { if (pl.tw) { try { pl.tw.remove(); } catch (e) {} } });
    H.objs.forEach(function (o) { try { o.destroy(); } catch (e) {} });
    H.hidden.forEach(function (v) { try { v.setVisible(true); } catch (e) {} });
    m._house = null;
    m.houseGoal = null; m.housePending = null; m._houseMine = null;
    if (silent) return;
    const T = m._town;
    if (T) {
      T.objs.forEach(function (o) { if (o && typeof o.setVisible === 'function') o.setVisible(true); });
      const px = T.ox + 900, py = T.oy + 1450;
      if (m.player) {
        m.player.setPosition(px, py);
        if (m.player.body) m.player.body.setVelocity(0, 0);
      }
      T.lx = px; T.ly = py;
      try { m.cameras.main.centerOn(px, py); } catch (e) {}
    }
  }

  // ================= เชื่อมกับ town.js =================
  TOWN_NPCS.push({ id: 'house', name: 'ประตูบ้าน', title: 'บ้านของฉัน', x: 900, y: 1400, sprite: 'npc_house', color: 0x8bc34a, icon: '🏠' });
  TOWN_TEXT.house = 'บ้านของคุณ';
  window.TownHooks = window.TownHooks || {};
  window.TownHooks.house = function (m) { houseEnter(m); };

  // ขณะอยู่ในบ้าน: ผู้เล่นอื่นเห็นเรายืนนิ่งที่หน้าประตูบ้านในเมือง (ไม่เห็นเราเดินในบ้าน) heartbeat ยังส่งตามปกติ
  const _sendNet = P.sendNet;
  if (typeof _sendNet === 'function') {
    P.sendNet = function (ev, data) {
      if (ev === 'move' && this._house && this._town) {
        data = Object.assign({}, data, { x: this._town.ox + 900, y: this._town.oy + 1450 });
      }
      return _sendNet.call(this, ev, data);
    };
  }

  if (typeof window.townTick === 'function') {
    const o = window.townTick;
    window.townTick = function (m) { if (m && m._house) return houseTick(m); return o.apply(this, arguments); };
  }
  if (typeof window.townApproach === 'function') {   // กันแตะ NPC เมืองที่ซ่อนอยู่ตอนอยู่ในบ้าน
    const o = window.townApproach;
    window.townApproach = function (m) { if (m && m._house) return; return o.apply(this, arguments); };
  }
  if (typeof window.townTeardown === 'function') {   // ล้างบ้านเมื่อเปลี่ยนด่าน/ตาย
    const o = window.townTeardown;
    window.townTeardown = function (m) { if (m && m._house) houseExit(m, true); return o.apply(this, arguments); };
  }
})();
