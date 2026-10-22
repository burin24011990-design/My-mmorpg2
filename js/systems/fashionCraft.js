// ===== แฟชั่น: ปีก / หาง / สัตว์เลี้ยง (อย่างละ 30 แบบ) =====
// ไฟล์: js/systems/fashionCraft.js | โหลด "หลัง" house.js และ js/data/fashion.js ก่อน js/main.js
// - สร้างในบ้าน (แท็บ "แฟชั่น") แบบเดียวกับอาหาร: สร้างซ้ำได้ชิ้นละสูงสุด MAX_CRAFT ครั้ง ยิ่งสร้างยิ่งใช้ของเพิ่ม
// - ทุกสูตรต้องใช้ "ของดรอปจากบอส" (แก่นบอสประจำด่าน + หัวใจ/วิญญาณ/มงกุฎ ตามระดับ)
// - สร้างครั้งแรกแล้วมีปุ่ม "สวมใส่" (ใส่ได้หมวดละ 1 ชิ้น) | โบนัสสถานะถาวรบวกตามจำนวนครั้งที่สร้าง (เหมือนสมุดอาหาร)
// - ข้อมูลเก็บใน this.house.fashion (save.js เซฟ this.house ทั้งก้อนอยู่แล้ว ไม่ต้องแก้ save.js)
(function () {
  const P = Main.prototype;
  if (!window.FashionData || typeof MAT_DEFS === 'undefined') { console.warn('fashionCraft: ต้องโหลด fashion.js และ houseData.js ก่อน'); return; }

  // ===== ปรับตรงนี้ =====
  const MAX_CRAFT = 30;                 // สร้างได้สูงสุดกี่ครั้งต่อชิ้น
  const STEP_PCT = 15;                  // ครั้งถัดไปใช้ของเพิ่ม 15% ของราคาตั้งต้น (บวกเพิ่มทีละเท่ากัน)
  const COMPLETE_BONUS = 5;             // สร้างครบ MAX_CRAFT ครั้ง = ได้โบนัสพิเศษเพิ่มเท่ากับสร้างอีก 5 ครั้ง
  const BONUS_MUL = 1;                  // ตัวคูณโบนัสสถานะรวม (แรงไป = 0.5 / เบาไป = 2)
  const TIER_MUL = [0, 0.6, 0.9, 1.3, 2];            // ตัวคูณโบนัสตามระดับ 1-4 (ใช้กับ STAT_PER_BOOK ใน houseData.js)
  // ของที่ต้องใช้ตอนสร้างครั้งแรก (ดัชนี = ระดับ 1-4)
  const Z_BASE = [0, 25, 40, 65, 100];                // ของมอนประจำด่าน
  const C_BASE = [0, 12, 20, 32, 50];                 // ของประจำหมวด (ขนปีก/ขนหาง/ไข่)
  const B_BASE = [0, 2, 3, 5, 8];                    // แก่นบอสประจำด่าน
  const HEART_BASE = [0, 0, 2, 3, 5];                // หัวใจบอส (ระดับ 2 ขึ้นไป)
  const SOUL_BASE = [0, 0, 0, 2, 3];                 // วิญญาณบอส (ระดับ 3 ขึ้นไป)
  const CROWN_BASE = [0, 0, 0, 0, 2];                // มงกุฎราชันย์ (ระดับ 4)
  const GOLD_BASE = [0, 5000, 15000, 40000, 100000];   // ทอง
  // โอกาสดรอป
  const DROP = {
    zone: 0.05,        // มอนธรรมดา: ของประจำด่าน (Epic x2)
    cat: 0.025,        // มอนธรรมดา: ของประจำหมวดแต่ละชนิด (Epic x2)
    epicMul: 2,
    bossZoneQty: [3, 6],   // บอส: ของประจำด่าน
    coreExtra: 0.3,        // บอส: แก่นบอสประจำด่านได้ 1 ชิ้นเสมอ + โอกาสได้เพิ่มอีก 1
    bossCat: 0.5,          // บอส: โอกาสได้ของประจำหมวดแต่ละชนิด (2-4 ชิ้น)
    heart: 0.20, soul: 0.08, crown: 0.03,   // บอส: ของหายาก (ด่านสูงขึ้นโอกาสเพิ่มด่านละ 8%)
  };

  // ด่านพิเศษระหว่างทาง: ครั้งที่ 11+ ต้องมีหัวใจบอสเพิ่ม | ครั้งที่ 21+ วิญญาณบอสเพิ่ม | ครั้งที่ 30 (ครั้งสุดท้าย) มงกุฎราชันย์เพิ่ม (ดัชนี = ระดับ 1-4)
  const MILESTONE = {
    10: { id: 'fb_heart', n: [0, 1, 1, 2, 3] },
    20: { id: 'fb_soul', n: [0, 1, 1, 2, 3] },
    29: { id: 'fb_crown', n: [0, 1, 2, 3, 4] },
  };

  const CAT = {
    wing: { label: 'ปีก', icon: '🪽', mat: 'fm_feather', stats: ['hp', 'pdef', 'mdef', 'dodge', 'mspd'] },
    tail: { label: 'หาง', icon: '🦊', mat: 'fm_fur', stats: ['patk', 'ap', 'crit', 'critdmg', 'aspd'] },
    pet:  { label: 'สัตว์เลี้ยง', icon: '🐾', mat: 'fm_egg', stats: ['hp', 'mp', 'hpregen', 'mpregen', 'cdr'] },
  };
  const TYPES = ['wing', 'tail', 'pet'];

  const el = function (tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  };
  const r3 = function (v) { return Math.round(v * 1000) / 1000; };
  const rnd = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };

  // ================= วัตถุดิบใหม่ (เข้า MAT_DEFS = เก็บในกระเป๋า/เซฟได้เหมือนวัตถุดิบเดิม) =================
  const ZONE_MATS = [
    ['วุ้นสไลม์ประกาย', '💚'], ['ใยแมงมุมเงิน', '🕸️'], ['ผงพิษเขียว', '☠️'], ['ผลึกถ้ำ', '💎'], ['ทรายทอง', '🏜️'],
    ['เถ้าลาวา', '🌋'], ['เกล็ดน้ำแข็ง', '❄️'], ['ผงวิญญาณ', '👻'], ['เศษเงามืด', '🌑'],
  ];
  const CORE_MATS = [
    ['แก่นราชาสไลม์', '👑'], ['ตาราชินีแมงมุม', '👁️'], ['หัวใจเจ้าหนอง', '💔'], ['เขี้ยวเจ้าถ้ำ', '🦷'], ['เกล็ดราชันทราย', '🔶'],
    ['แก่นมังกรเพลิง', '🔥'], ['หัวใจราชาน้ำแข็ง', '🧊'], ['มงกุฎจอมวิญญาณ', '👑'], ['ตราจอมมาร', '😈'],
  ];
  ZONE_MATS.forEach(function (r, i) { MAT_DEFS['fm_z' + (i + 1)] = { name: r[0], icon: r[1], cat: 'fmat', color: 0x6bd66b }; });
  CORE_MATS.forEach(function (r, i) { MAT_DEFS['fb_z' + (i + 1)] = { name: r[0], icon: r[1], cat: 'fmat', color: 0xffc83d, boss: true }; });
  MAT_DEFS.fm_feather = { name: 'ขนปีกวิเศษ', icon: '🪶', cat: 'fmat', color: 0x4aa3ff };
  MAT_DEFS.fm_fur = { name: 'ขนหางวิเศษ', icon: '🧶', cat: 'fmat', color: 0x4aa3ff };
  MAT_DEFS.fm_egg = { name: 'ไข่วิเศษ', icon: '🪺', cat: 'fmat', color: 0x4aa3ff };
  MAT_DEFS.fb_heart = { name: 'หัวใจบอส', icon: '💖', cat: 'fmat', color: 0xa25cff, boss: true };
  MAT_DEFS.fb_soul = { name: 'วิญญาณบอส', icon: '🔮', cat: 'fmat', color: 0xe0413a, boss: true };
  MAT_DEFS.fb_crown = { name: 'มงกุฎราชันย์', icon: '🏆', cat: 'fmat', color: 0xffe28a, boss: true };

  // ================= สูตรสร้าง (90 สูตรจาก FashionData) =================
  const RECIPES = {};
  TYPES.forEach(function (type) {
    window.FashionData.list(type).forEach(function (it) {
      const T = it.tier, n = it.n, stage = Math.ceil(n * 9 / 30);   // ชิ้นที่ 1-30 ไล่ตามด่าน 1-9
      const need = {};
      need['fm_z' + stage] = Z_BASE[T];
      need[CAT[type].mat] = C_BASE[T];
      need['fb_z' + stage] = B_BASE[T];                 // ทุกสูตรต้องมีแก่นบอส
      if (T >= 3 && stage > 1) need['fm_z' + (stage - 1)] = Math.ceil(Z_BASE[T] / 2);   // ระดับสูงต้องไล่ล่าด่านก่อนหน้าด้วย
      if (T >= 4 && stage > 2) need['fm_z' + (stage - 2)] = Math.ceil(Z_BASE[T] / 3);
      if (HEART_BASE[T]) need.fb_heart = HEART_BASE[T];
      if (SOUL_BASE[T]) need.fb_soul = SOUL_BASE[T];
      if (CROWN_BASE[T]) need.fb_crown = CROWN_BASE[T];
      const st = CAT[type].stats, spb = (typeof STAT_PER_BOOK !== 'undefined') ? STAT_PER_BOOK : {};
      const bonus = {};
      const k1 = st[(n - 1) % 5];
      bonus[k1] = r3((spb[k1] || 1) * TIER_MUL[T] * BONUS_MUL);
      if (T >= 3) { const k2 = st[n % 5]; bonus[k2] = r3((spb[k2] || 1) * TIER_MUL[T] * 0.5 * BONUS_MUL); }
      RECIPES[it.id] = Object.assign({}, it, { stage: stage, need: need, gold: GOLD_BASE[T], bonus: bonus });
    });
  });
  const costAt = function (r, k) {
    const f = (100 + STEP_PCT * k) / 100, mats = {};
    Object.keys(r.need).forEach(function (id) { mats[id] = Math.ceil(r.need[id] * f); });
    Object.keys(MILESTONE).forEach(function (at) {
      const m = MILESTONE[at], n = m.n[r.tier];
      if (!n) return;
      if (Number(at) === MAX_CRAFT - 1 ? k === MAX_CRAFT - 1 : k >= Number(at)) mats[m.id] = (mats[m.id] || 0) + n;
    });
    return { mats: mats, gold: Math.ceil(r.gold * f) };
  };

  // ================= สถานะ =================
  function fstate(m) {
    const h = m.houseState();
    let f = h.fashion;
    if (!f || typeof f !== 'object') f = h.fashion = {};
    if (!f._ok) {
      Object.defineProperty(f, '_ok', { value: true, enumerable: false, writable: true });
      const src = (f.crafted && typeof f.crafted === 'object') ? f.crafted : {}, c = {};
      Object.keys(RECIPES).forEach(function (id) {
        const n = Math.floor(Number(src[id]));
        if (n > 0) c[id] = Math.min(MAX_CRAFT, n);
      });
      f.crafted = c;
      const w = (f.worn && typeof f.worn === 'object') ? f.worn : {}, nw = {};
      TYPES.forEach(function (t) { nw[t] = (w[t] && RECIPES[w[t]] && RECIPES[w[t]].type === t && c[w[t]] > 0) ? w[t] : null; });
      f.worn = nw;
    }
    return f;
  }
  function fashionBonus(m) {
    const c = fstate(m).crafted, out = {};
    Object.keys(c).forEach(function (id) {
      const r = RECIPES[id];
      const times = c[id] + (c[id] >= MAX_CRAFT ? COMPLETE_BONUS : 0);
      Object.keys(r.bonus).forEach(function (k) { out[k] = (out[k] || 0) + r.bonus[k] * times; });
    });
    return out;
  }
  P.fashionBonus = function () { return fashionBonus(this); };

  // บวกโบนัสเข้าสเตตัส (ครอบ recalcStats ต่อจาก house.js)
  const _recalc = P.recalcStats;
  if (typeof _recalc === 'function') {
    P.recalcStats = function () {
      const out = _recalc.apply(this, arguments);
      try {
        const b = fashionBonus(this), D = window.STAT_DEFS || {};
        Object.keys(b).forEach(function (k) {
          out[k] = (out[k] || 0) + b[k];
          const d = D[k];
          if (d && d.cap != null && out[k] > d.cap) out[k] = d.cap;
        });
        const st = this.stats || {};
        if (out.hp !== undefined) this.equipHpBonus = out.hp - (st.maxHp || 0);
        if (out.mp !== undefined) this.equipMpBonus = out.mp - (st.maxMp || 0);
      } catch (e) { console.warn('fashion bonus', e); }
      return out;
    };
  }

  // ================= ดรอปจากมอน/บอส =================
  let lastToast = 0;
  const _drop = P.dropLoot;
  if (typeof _drop === 'function') {
    P.dropLoot = function (x, y, lv, boxLevel, isBoss, isEpic) {
      const r = _drop.apply(this, arguments);
      try { rollFashion(this, isBoss, isEpic); } catch (e) { console.warn('fashion drop', e); }
      return r;
    };
  }
  function rollFashion(sc, isBoss, isEpic) {
    const z = ZONES[sc.stageIdx];
    if (!z || z.town) return;
    const th = Math.max(0, Math.min(8, (z.look !== undefined) ? z.look : sc.stageIdx));
    const got = [], cats = ['fm_feather', 'fm_fur', 'fm_egg'];
    if (isBoss) {
      got.push(['fm_z' + (th + 1), rnd(DROP.bossZoneQty[0], DROP.bossZoneQty[1])]);
      got.push(['fb_z' + (th + 1), 1 + (Math.random() < DROP.coreExtra ? 1 : 0)]);
      cats.forEach(function (id) { if (Math.random() < DROP.bossCat) got.push([id, rnd(2, 4)]); });
      const bias = 1 + 0.08 * th;
      if (Math.random() < DROP.heart * bias) got.push(['fb_heart', 1]);
      if (Math.random() < DROP.soul * bias) got.push(['fb_soul', 1]);
      if (Math.random() < DROP.crown * bias) got.push(['fb_crown', 1]);
    } else {
      const mul = isEpic ? DROP.epicMul : 1;
      if (Math.random() < DROP.zone * mul) got.push(['fm_z' + (th + 1), 1 + (Math.random() < 0.15 ? 1 : 0)]);
      cats.forEach(function (id) { if (Math.random() < DROP.cat * mul) got.push([id, 1]); });
    }
    if (!got.length) return;
    const names = []; let full = false;
    got.forEach(function (g) {
      const left = sc.addMat(g[0], g[1]);
      if (left >= g[1]) full = true;
      else names.push(MAT_DEFS[g[0]].icon + MAT_DEFS[g[0]].name + ' x' + (g[1] - left));
    });
    const now = Date.now();
    if (sc.toastMsg && (isBoss || now - lastToast > 1200)) {
      lastToast = now;
      if (names.length) sc.toastMsg('ได้ ' + names.join(' '));
      else if (full) sc.toastMsg('กระเป๋าเต็ม วัตถุดิบแฟชั่นหลุดมือ');
    }
  }

  // ================= สร้าง / สวมใส่ =================
  function spendGold(m, n) {
    if (typeof m.spendGold === 'function') return m.spendGold(n);
    if ((m.stats.gold || 0) < n) return false;
    m.stats.gold -= n;
    return true;
  }
  function craftOnce(m, r) {   // 'ok' | 'max' | 'lack' | 'gold'
    const f = fstate(m), k = f.crafted[r.id] || 0;
    if (k >= MAX_CRAFT) return 'max';
    const c = costAt(r, k), ids = Object.keys(c.mats);
    for (let i = 0; i < ids.length; i++) if (m.countMat(ids[i]) < c.mats[ids[i]]) return 'lack';
    if ((m.stats.gold || 0) < c.gold) return 'gold';
    if (!spendGold(m, c.gold)) return 'gold';
    ids.forEach(function (id) { m.takeMat(id, c.mats[id]); });
    f.crafted[r.id] = k + 1;
    return 'ok';
  }
  function setWorn(m, r, on) {
    const f = fstate(m);
    f.worn[r.type] = on ? r.id : null;
    if (m.saveSoon) m.saveSoon();
  }

  // ================= หน้าต่างแท็บ "แฟชั่น" (เรียกจาก house.js) =================
  const IMG_OK = {};
  function probe(path, cb) {
    if (IMG_OK[path] !== undefined) { cb(IMG_OK[path]); return; }
    const im = new Image();
    im.onload = function () { IMG_OK[path] = true; cb(true); };
    im.onerror = function () { IMG_OK[path] = false; cb(false); };
    im.src = path;
  }
  function iconBox(r, size) {   // รูปจริงถ้ามีไฟล์ ไม่มี = อีโมจิประจำหมวด
    const b = el('div', '', CAT[r.type].icon);
    b.style.cssText = 'width:' + size + 'px;height:' + size + 'px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:' + Math.round(size * 0.6) + 'px;background-repeat:no-repeat;background-position:center;';
    const path = r.type === 'wing' ? r.img.back : r.img.main;
    probe(path, function (ok) {
      if (!ok) return;
      b.textContent = '';
      b.style.backgroundImage = 'url(' + path + ')';
      if (r.type === 'pet') { b.style.backgroundSize = '300% 100%'; b.style.backgroundPosition = '0% center'; }
      else b.style.backgroundSize = 'contain';
    });
    return b;
  }
  const fmtVal = function (k, v) {
    const d = (window.STAT_DEFS || {})[k];
    return (d ? d.short : k) + ' +' + (Math.round(v * 100) / 100) + ((d && d.fmt === 'pct') ? '%' : '');
  };

  function view(m, card, body) {
    let cat = 'wing', tier = 1, onlyCan = false;
    const sum = el('div', 'hs-sum', '');
    const catTabs = el('div', 'hs-tabs hs-sub-tabs'), tierTabs = el('div', 'hs-tabs hs-sub-tabs');
    catTabs.style.gridTemplateColumns = 'repeat(3,1fr)';
    tierTabs.style.gridTemplateColumns = 'repeat(4,1fr)';
    const filt = el('button', 'hs-btn hs-alt', '');
    const list = el('div', 'hs-list');
    body.append(sum, catTabs, tierTabs, filt, list);

    const canCraft = function (r) {
      const f = fstate(m), k = f.crafted[r.id] || 0;
      if (k >= MAX_CRAFT) return false;
      const c = costAt(r, k);
      return (m.stats.gold || 0) >= c.gold && Object.keys(c.mats).every(function (id) { return m.countMat(id) >= c.mats[id]; });
    };
    function summary() {
      const f = fstate(m), b = fashionBonus(m), ks = Object.keys(b);
      let total = 0;
      Object.keys(f.crafted).forEach(function (id) { total += f.crafted[id]; });
      sum.textContent = '';
      sum.append(el('b', '', '👗 สร้างแล้วรวม ' + total + ' ครั้ง'));
      sum.append(el('div', 'hs-sub', 'โบนัสถาวรรวม: ' + (ks.length ? ks.map(function (k) { return fmtVal(k, b[k]); }).join(' · ') : 'ยังไม่มี')));
      const wn = TYPES.map(function (t) { return CAT[t].label + ': ' + (f.worn[t] ? RECIPES[f.worn[t]].name : '-'); }).join(' | ');
      sum.append(el('div', 'hs-sub', 'สวมอยู่ → ' + wn));
    }
    function doCraft(r, times) {
      const had = fstate(m).crafted[r.id] || 0;
      let ok = 0, why = '';
      for (let i = 0; i < times; i++) { const x = craftOnce(m, r); if (x === 'ok') ok++; else { why = x; break; } }
      if (ok > 0) {
        m.computeAtk();
        if (m.saveSoon) m.saveSoon();
        const now = fstate(m).crafted[r.id];
        if (m.toastMsg) m.toastMsg((had === 0 ? '✨ ได้ ' + r.name + ' แล้ว! กด "สวมใส่" ได้เลย' : '🛠️ ' + r.name + ' เพิ่มเป็น ' + now + '/' + MAX_CRAFT));
      } else if (m.toastMsg) m.toastMsg(why === 'max' ? 'ครบ ' + MAX_CRAFT + ' ครั้งแล้ว' : (why === 'gold' ? 'ทองไม่พอ' : 'วัตถุดิบไม่พอ'));
      draw();
    }
    function draw() {
      summary();
      catTabs.innerHTML = ''; tierTabs.innerHTML = '';
      TYPES.forEach(function (t) {
        const b = el('button', 'hs-tab' + (t === cat ? ' on' : ''), CAT[t].icon + ' ' + CAT[t].label);
        b.addEventListener('click', function () { cat = t; draw(); });
        catTabs.append(b);
      });
      for (let t = 1; t <= 4; t++) {
        const b = el('button', 'hs-tab' + (t === tier ? ' on' : ''), window.FashionData.TIER_NAME[t]);
        b.addEventListener('click', function () { tier = t; draw(); });
        tierTabs.append(b);
      }
      filt.textContent = (onlyCan ? '☑' : '☐') + ' แสดงเฉพาะที่สร้างได้ตอนนี้';
      list.innerHTML = '';
      const f = fstate(m);
      let shown = 0;
      window.FashionData.list(cat).forEach(function (it) {
        if (it.tier !== tier) return;
        const r = RECIPES[it.id], k = f.crafted[r.id] || 0, can = canCraft(r), worn = f.worn[r.type] === r.id;
        if (onlyCan && !can) return;
        shown++;
        const row = el('div', 'hs-dish' + (k >= MAX_CRAFT ? ' max' : '') + (can ? ' can' : ''));
        const head = el('div', 'hs-dh');
        const dn = el('span', 'hs-dn', '');
        dn.append(iconBox(r, 48), el('span', '', r.name + (worn ? ' ✅' : '')));
        head.append(dn, el('span', 'hs-dc', k + '/' + MAX_CRAFT));
        const pgb = el('div', 'hs-pg'), pgf = el('div', 'hs-pgf');
        pgf.style.width = Math.round(k / MAX_CRAFT * 100) + '%';
        pgb.append(pgf);
        const chips = el('div', 'hs-chips');
        Object.keys(r.bonus).forEach(function (s) { chips.append(el('span', 'hs-bn', fmtVal(s, r.bonus[s]) + ' /ครั้ง')); });
        row.append(head, pgb, chips);
        if (k > 0) {
          const tt = k + (k >= MAX_CRAFT ? COMPLETE_BONUS : 0);
          row.append(el('div', 'hs-sub', 'รวมแล้ว: ' + Object.keys(r.bonus).map(function (s) { return fmtVal(s, r.bonus[s] * tt); }).join(' · ')));
        }
        if (k >= 9 && k < MAX_CRAFT) row.append(el('div', 'hs-sub', k < 20 ? '⚠ ครั้งที่ 11 ขึ้นไปต้องใช้หัวใจบอสเพิ่ม' : (k < 29 ? '⚠ ครั้งที่ 21 ขึ้นไปต้องใช้วิญญาณบอสเพิ่ม' : '👑 ครั้งสุดท้าย! ต้องใช้มงกุฎราชันย์เพิ่ม')));
        if (k < MAX_CRAFT) {
          const c = costAt(r, k), ing = el('div', 'hs-ing');
          Object.keys(c.mats).forEach(function (id) {
            const d = MAT_DEFS[id], have = m.countMat(id);
            ing.append(el('span', (have >= c.mats[id] ? 'hs-ok' : 'hs-no') + ' hs-ig', d.icon + ' ' + d.name + ' ' + have + '/' + c.mats[id] + (d.boss ? ' (บอส)' : '')));
          });
          const gold = Number(m.stats.gold || 0);
          ing.append(el('span', (gold >= c.gold ? 'hs-ok' : 'hs-no') + ' hs-ig', '🪙 ทอง ' + c.gold.toLocaleString()));
          row.append(ing);
        } else row.append(el('div', 'hs-ok', '✔ ครบ ' + MAX_CRAFT + ' ครั้ง (โบนัสพิเศษ +' + COMPLETE_BONUS + ' ครั้ง)'));
        const bt = el('div', 'hs-bt');
        bt.style.gridTemplateColumns = k > 0 ? '1fr 1fr 1fr' : '1fr 1fr';
        const b1 = el('button', 'hs-mini', '🛠️ ×1'), b10 = el('button', 'hs-mini', '🛠️ ×10');
        b1.disabled = !can; b10.disabled = !can;
        b1.addEventListener('click', function () { doCraft(r, 1); });
        b10.addEventListener('click', function () { doCraft(r, 10); });
        bt.append(b1, b10);
        if (k > 0) {
          const bw = el('button', 'hs-mini', worn ? 'ถอด' : '👗 สวมใส่');
          bw.addEventListener('click', function () { setWorn(m, r, !worn); draw(); });
          bt.append(bw);
        }
        row.append(bt);
        list.append(row);
      });
      if (!shown) list.append(el('div', 'hs-note', 'ยังไม่มีชิ้นที่สร้างได้ในระดับนี้'));
    }
    filt.addEventListener('click', function () { onlyCan = !onlyCan; draw(); });
    draw();
    return null;
  }

  // ================= แสดงปีก/หาง/สัตว์เลี้ยงที่ตัวละคร =================
  // รูปโหลดตอนสวมครั้งแรก (assets/fashion/) | ยังไม่มีไฟล์รูป = โชว์อีโมจิแทน เกมไม่พัง
  // ปีก: ใช้ภาพ front (หันลง/ข้าง) และ back (หันขึ้น) แยกไฟล์ wing_XX_front.png / wing_XX_back.png | หาง: ภาพด้านข้างชี้ขวา | สัตว์เลี้ยง: แผ่น 3 มุมมอง หน้า/ข้าง/หลัง
  const WING_W = 116, TAIL_W = 60, PET_W = 48;
  const LOAD = {};
  function ensureTex(m, key, path, isPet) {
    if (m.textures.exists(key)) return true;
    const st = LOAD[key];
    if (st === 'fail' || st === 'loading') return false;
    LOAD[key] = 'loading';
    const L = m.load;
    L.image(key, path);
    L.once('filecomplete-image-' + key, function () {
      LOAD[key] = 'ok';
      if (isPet) {
        try {
          const t = m.textures.get(key), src = t.getSourceImage(), fw = Math.floor(src.width / 3);
          for (let i = 0; i < 3; i++) t.add('f' + i, 0, i * fw, 0, fw, src.height);
        } catch (e) {}
      }
    });
    L.on('loaderror', function onE(f) { if (f && f.key === key) { LOAD[key] = 'fail'; L.off('loaderror', onE); } });
    if (!L.isLoading()) L.start();
    return false;
  }
  function visual(m, o, key, path, emoji, isPet) {   // คืน true ถ้าเป็นรูปจริง
    if (ensureTex(m, key, path, isPet)) {
      if (!o.obj || o.curKey !== key) {
        if (o.obj) o.obj.destroy();
        o.obj = m.add.image(0, 0, key);
        o.curKey = key; o.isText = false;
        if (isPet) o.obj.setFrame('f0');
      }
      return true;
    }
    if (!o.obj || !o.isText) {
      if (o.obj) o.obj.destroy();
      o.obj = m.add.text(0, 0, emoji, { fontSize: '30px' }).setOrigin(0.5);
      o.isText = true; o.curKey = 'txt';
    }
    return false;
  }
  function fit(img, w) { const fr = img.frame; img.setDisplaySize(w, w * fr.height / fr.width); }
  function dropSlot(fm, t) { if (fm[t]) { try { if (fm[t].obj) fm[t].obj.destroy(); } catch (e) {} fm[t] = null; } }
  function getSlot(fm, t, id) {
    if (!id) { dropSlot(fm, t); return null; }
    if (fm[t] && fm[t].id === id) return fm[t];
    dropSlot(fm, t);
    fm[t] = { id: id, r: RECIPES[id], obj: null, curKey: '', isText: false, px: null, py: 0, flip: false };
    return fm[t];
  }

  function tick(m) {
    const p = m.player;
    const fm = m._fm || (m._fm = { wing: null, tail: null, pet: null, dir: 'down', face: 1 });
    if (!p || !p.active || !m.houseState) { TYPES.forEach(function (t) { dropSlot(fm, t); }); return; }
    let w;
    try { w = fstate(m).worn; } catch (e) { return; }
    const v = p.body && p.body.velocity;
    if (v && (Math.abs(v.x) > 8 || Math.abs(v.y) > 8)) {
      fm.dir = Math.abs(v.x) >= Math.abs(v.y) ? (v.x < 0 ? 'left' : 'right') : (v.y < 0 ? 'up' : 'down');
      if (Math.abs(v.x) > 8) fm.face = v.x < 0 ? -1 : 1;
    }
    const d = fm.dir, dep = p.depth || 0, vis = p.visible !== false;

    const wo = getSlot(fm, 'wing', w.wing);
    if (wo) {
      // หันหน้า(ลง) = เห็นปีกอยู่ข้างหลังตัว ใช้ภาพ front | หันหลัง(ขึ้น) = ปีกกางทับหลังตัว ใช้ภาพ back | หันข้าง = ใช้ภาพ front บีบให้แคบ
      const up = d === 'up', side = (d === 'left' || d === 'right'), r = wo.r;
      const real = visual(m, wo, 'fm_' + r.id + (up ? '_back' : '_front'), up ? r.img.back : r.img.front, '🪽', false);
      if (real) fit(wo.obj, side ? WING_W * 0.6 : WING_W);
      wo.obj.setPosition(p.x + (side ? (d === 'right' ? -12 : 12) : 0), p.y - 10);
      wo.obj.setDepth(up ? dep + 0.05 : dep - 0.05).setVisible(vis);
    }
    const to = getSlot(fm, 'tail', w.tail);
    if (to) {
      const r = to.r;
      const real = visual(m, to, 'fm_' + r.id, r.img.main, '🦊', false);
      if (real) fit(to.obj, TAIL_W);
      const side = d === 'left' ? 1 : (d === 'right' ? -1 : 0);
      to.obj.setPosition(p.x + side * TAIL_W * 0.4, p.y + (side ? 8 : (d === 'up' ? 14 : 8)));
      if (real) to.obj.setFlipX(side < 0);
      to.obj.setDepth(d === 'up' ? dep + 0.05 : dep - 0.04).setVisible(vis);
    }
    const po = getSlot(fm, 'pet', w.pet);
    if (po) {
      const r = po.r;
      const real = visual(m, po, 'fm_' + r.id, r.img.main, '🐾', true);
      if (real) fit(po.obj, PET_W);
      const tx = p.x - fm.face * 34, ty = p.y + 18;
      if (po.px === null) { po.px = tx; po.py = ty; }
      const dx = tx - po.px, dy = ty - po.py;
      po.px += dx * 0.1; po.py += dy * 0.1;
      const moving = Math.hypot(dx, dy) > 8, t = m.time.now;
      const bob = moving ? Math.sin(t / 90) * 4 : Math.sin(t / 400) * 1.5;
      if (Math.abs(dx) > 3) po.flip = dx < 0;
      if (real) {
        const fr = !moving ? 'f0' : (Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'f2' : 'f0') : 'f1');
        if (po.obj.frame && po.obj.frame.name !== fr) { try { po.obj.setFrame(fr); fit(po.obj, PET_W); } catch (e) {} }
        po.obj.setFlipX(fr === 'f1' && po.flip);
      }
      po.obj.setPosition(po.px, po.py + bob);
      po.obj.setDepth(po.py < p.y ? dep - 0.05 : dep + 0.05).setVisible(vis);
    }
  }

  const _create = P.create;
  P.create = function () {
    const r = _create ? _create.apply(this, arguments) : undefined;
    try {
      this._fm = null;
      if (this._fmHandler) this.events.off('update', this._fmHandler);
      const self = this;
      this._fmHandler = function () { try { tick(self); } catch (e) {} };
      this.events.on('update', this._fmHandler);
    } catch (e) { console.warn('fashion render', e); }
    return r;
  };

  window.FashionCraft = { view: view, RECIPES: RECIPES, costAt: costAt, MAX_CRAFT: MAX_CRAFT };
})();
