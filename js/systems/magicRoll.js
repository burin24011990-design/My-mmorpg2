// ===== ระบบสุ่มพลังวิเศษอุปกรณ์ (ช่างพลังวิเศษ) =====
// - อุปกรณ์ 1 ชิ้นมีพลังวิเศษได้ 4 แถว (item.magic) แต่ละแถว = ความสามารถสกิล +1% ถึง +10%
// - สุ่มต้องใช้ "หินพลังวิเศษ" 1 ก้อน + ทอง | หินดรอปจากมอน 0.1%
// - สุ่มครั้งแรก = ได้ครบ 4 แถว | ครั้งต่อไปแถวที่ไม่ล็อกจะสุ่มใหม่ทุกครั้ง | ล็อกได้สูงสุด 3 แถว (ล็อกแล้วค่าใช้จ่ายเพิ่ม)
// โหลดหลัง stats.js และไฟล์ classes/*.js ทั้งหมด (วางไว้ก่อน main.js ได้เลย)
(function () {
  const P = Main.prototype;

  // ---------- ค่าที่ปรับได้ ----------
  const TEST_MODE = true;          // true = มีปุ่ม "แจกหิน+ทอง" ในหน้าต่างช่างพลังวิเศษ (ทดสอบเสร็จเปลี่ยนเป็น false)
  const ROWS = 4;                  // จำนวนแถวสูงสุด
  const MIN_PCT = 1, MAX_PCT = 10; // ค่าต่อแถว (%)
  const DROP_RATE = 0.001;         // โอกาสดรอปหินต่อมอน 1 ตัว (0.001 = 0.1%)
  const STONE_PER_ROLL = 1;        // หินที่ใช้ต่อการสุ่ม 1 ครั้ง
  const MAX_LOCK = 3;              // ล็อกได้สูงสุดกี่แถว
  // ราคาทองต่อการสุ่ม ตามจำนวนแถวที่ล็อก: [ไม่ล็อก, ล็อก 1, ล็อก 2, ล็อก 3]
  const COST_BY_LOCKS = [1000000, 2000000, 3000000, 4000000];
  const MAGIC_CAP = 200;           // เพดานรวมของโบนัสสกิล (%) จากทุกชิ้นรวมกัน
  const NPC_IMG = 'assets/npc/magic_npc.png';
  const STONE_IMG = 'assets/items/magicstone.png';

  // ชนิดของพลังวิเศษ (w = น้ำหนักโอกาสออก)
  const CLASS_TH = { sword: 'ดาบ', mage: 'คทา', archer: 'ธนู', priest: 'พระ', rogue: 'โจร' };
  const TYPES = [{ k: 'sdmg', label: 'ดาเมจสกิลทุกสาย', w: 3 }]
    .concat(Object.keys(CLASS_TH).map(c => ({ k: 'sdmg_' + c, label: 'ดาเมจสกิล' + CLASS_TH[c], w: 2 })))
    .concat([{ k: 'cdr', label: 'ลดคูลดาวน์สกิล', w: 2 }]);
  const TYPE_BY_KEY = {};
  TYPES.forEach(t => { TYPE_BY_KEY[t.k] = t; });

  // ---------- ลงทะเบียนสเตตัสใหม่ (ให้หน้าต่างสเตตัสโชว์เอง) ----------
  if (window.STAT_DEFS) {
    TYPES.forEach(t => {
      if (t.k !== 'cdr' && !window.STAT_DEFS[t.k]) {
        window.STAT_DEFS[t.k] = { label: t.label, short: t.label.replace('ดาเมจสกิล', 'สกิล'), fmt: 'pct', hideZero: true };
      }
    });
  }

  // ---------- ตัวช่วย ----------
  function scene() { return window.__mainScene; }
  function toast(t) { const s = scene(); if (s && s.toastMsg) s.toastMsg(t); }
  function gold() { const s = scene(); return s && s.stats ? Math.floor(Number(s.stats.gold) || 0) : 0; }
  // หินพลังวิเศษ = ไอเทมในกระเป๋า { kind:'magicstone', count } ซ้อนได้
  function stones(sc) {
    sc = sc || scene();
    let n = 0;
    if (sc && Array.isArray(sc.bag)) sc.bag.forEach(i => { if (i && i.kind === 'magicstone') n += i.count || 0; });
    return n;
  }
  // คืนจำนวนที่ใส่ไม่ได้ (กระเป๋าเต็ม) 0 = ใส่ครบ
  function addStones(n, sc) {
    sc = sc || scene();
    if (!sc || !Array.isArray(sc.bag)) return n;
    let left = n;
    sc.bag.forEach(i => {
      if (left > 0 && i && i.kind === 'magicstone' && i.count < MAX_STONE_STACK) {
        const add = Math.min(left, MAX_STONE_STACK - i.count); i.count += add; left -= add;
      }
    });
    while (left > 0) {
      const idx = sc.findEmptyBagSlot();
      if (idx === -1) break;
      const add = Math.min(left, MAX_STONE_STACK);
      sc.bag[idx] = { kind: 'magicstone', count: add };
      left -= add;
    }
    if (sc.saveSoon) sc.saveSoon();
    return left;
  }
  function takeStones(n, sc) {
    sc = sc || scene();
    if (stones(sc) < n) return false;
    for (let i = 0; i < sc.bag.length && n > 0; i++) {
      const it = sc.bag[i];
      if (!it || it.kind !== 'magicstone') continue;
      const t = Math.min(n, it.count); it.count -= t; n -= t;
      if (it.count <= 0) sc.bag[i] = null;
    }
    return true;
  }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }

  function pickType() {
    let total = 0; TYPES.forEach(t => { total += t.w; });
    let r = Math.random() * total;
    for (let i = 0; i < TYPES.length; i++) { r -= TYPES[i].w; if (r < 0) return TYPES[i]; }
    return TYPES[0];
  }
  function newRow() {
    const t = pickType();
    const v = Math.round((MIN_PCT + Math.random() * (MAX_PCT - MIN_PCT)) * 10) / 10;
    return { k: t.k, v: v };
  }
  function costFor(lockCount) { return COST_BY_LOCKS[Math.max(0, Math.min(MAX_LOCK, lockCount))]; }

  // ---------- ตรรกะสุ่ม ----------
  // locked = array ของ boolean ยาว 4 | คืน { ok, msg, changed:[index] }
  function roll(item, locked) {
    const s = scene();
    if (!s || !s.stats) return { ok: false, msg: 'เกมยังไม่พร้อม' };
    if (!item || item.kind !== 'equip') return { ok: false, msg: 'เลือกอุปกรณ์ก่อน' };
    const had = Array.isArray(item.magic) && item.magic.length === ROWS;
    const lk = [];
    for (let i = 0; i < ROWS; i++) lk.push(had && !!(locked && locked[i]));
    const n = lk.filter(Boolean).length;
    if (n > MAX_LOCK) return { ok: false, msg: 'ล็อกได้สูงสุด ' + MAX_LOCK + ' แถว' };
    const cost = costFor(n);
    if (stones() < STONE_PER_ROLL) return { ok: false, msg: 'ไม่มีหินพลังวิเศษ' };
    if (gold() < cost) return { ok: false, msg: 'ทองไม่พอ (ต้องใช้ ' + fmt(cost) + ')' };

    s.stats.gold -= cost;
    takeStones(STONE_PER_ROLL, s);
    const old = had ? item.magic : [];
    const rows = [], changed = [];
    for (let i = 0; i < ROWS; i++) {
      if (lk[i]) rows.push(old[i]);
      else { rows.push(newRow()); changed.push(i); }
    }
    item.magic = rows;
    if (s.computeAtk) s.computeAtk();
    if (s.saveSoon) s.saveSoon();
    return { ok: true, changed: changed, cost: cost };
  }

  // ---------- เอาโบนัสเข้าสเตตัส ----------
  const _rs = P.recalcStats;
  P.recalcStats = function () {
    const out = _rs.apply(this, arguments);
    const eq = this.equipment || {};
    EQUIP_SLOT_KEYS.forEach(k => {
      const it = eq[k];
      if (it && Array.isArray(it.magic)) {
        it.magic.forEach(r => { if (r && r.k) out[r.k] = (out[r.k] || 0) + (Number(r.v) || 0); });
      }
    });
    TYPES.forEach(t => {
      if (t.k === 'cdr') {
        const d = window.STAT_DEFS && window.STAT_DEFS.cdr;
        if (d && d.cap != null && out.cdr > d.cap) out.cdr = d.cap;
      } else if ((out[t.k] || 0) > MAGIC_CAP) out[t.k] = MAGIC_CAP;
    });
    return out;
  };

  // ---------- เพิ่มดาเมจสกิล ----------
  // ติดโทเคนตอนกดสกิล/อัลติสำเร็จ แล้วให้ applySkillEffect ตัวแรกที่ตามมาคูณดาเมจ 1 ครั้ง
  // (กันคูณซ้ำกรณีสกิลเรียกตัวเองต่อ เช่น ฟันหมุน) | โจมตีธรรมดาไม่ได้รับโบนัสนี้
  const _useSkill = P.useSkill;
  P.useSkill = function (idx, gp) {
    const key = 'slot' + idx, before = this.cdEnd ? this.cdEnd[key] : 0;
    this._mrTok = { until: this.time.now + 900 };
    const r = _useSkill.call(this, idx, gp);
    if (!this.cdEnd || this.cdEnd[key] === before) this._mrTok = null;
    return r;
  };
  const _useUlti = P.useUlti;
  P.useUlti = function (gp) {
    const before = this.cdEnd ? this.cdEnd.ulti : 0;
    this._mrTok = { until: this.time.now + 900 };
    const r = _useUlti.call(this, gp);
    if (!this.cdEnd || this.cdEnd.ulti === before) this._mrTok = null;
    return r;
  };
  const _apply = P.applySkillEffect;
  P.applySkillEffect = function (def, x, y, fx, fy, dmg, kind) {
    const tok = this._mrTok;
    if (tok) {
      this._mrTok = null;
      if (this.time.now < tok.until && def && typeof dmg === 'number') {
        const S = this.getStats(), cls = def.class || kind;
        const pct = (S.sdmg || 0) + (S['sdmg_' + cls] || 0);
        if (pct > 0) dmg = Math.round(dmg * (1 + pct / 100));
      }
    }
    return _apply.call(this, def, x, y, fx, fy, dmg, kind);
  };

  // ---------- ดรอปหินจากมอน ----------
  // ผูกกับ dropLoot (เรียกตอนมอนตาย ทั้งโหมดมอนในเครื่องและโหมดห้องออนไลน์ -- โหมดห้องเรียกเฉพาะคนที่ได้สิทธิ์ของดรอป)
  const _dropLoot = P.dropLoot;
  if (typeof _dropLoot === 'function') {
    P.dropLoot = function () {
      const r = _dropLoot.apply(this, arguments);
      try {
        if (Math.random() < DROP_RATE) {
          const left = addStones(1, this);
          if (this.toastMsg) this.toastMsg(left > 0 ? '🔮 กระเป๋าเต็ม! ไม่ได้รับหินพลังวิเศษ' : '🔮 ได้รับ หินพลังวิเศษ x1 !');
        }
      } catch (e) { console.warn('magicRoll drop', e); }
      return r;
    };
  } else console.warn('magicRoll: ไม่พบ dropLoot หินจึงไม่ดรอป');

  // ---------- เซฟหิน ----------
  // save.js ตัดไอเทมชนิดที่ไม่รู้จักทิ้งตอนโหลด จึงอ่านหินกลับจากเซฟเองตามช่องเดิม (ไม่ต้องแก้ save.js)
  // + ย้ายหินแบบตัวเลขเก่า (stats.magicStones) เข้ากระเป๋า
  const _loadGame = P.loadGame;
  if (typeof _loadGame === 'function') {
    P.loadGame = function () {
      const r = _loadGame.apply(this, arguments);
      try {
        const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
        if (d && Array.isArray(d.bag) && Array.isArray(this.bag)) {
          d.bag.forEach((it, i) => {
            if (i < this.bag.length && !this.bag[i] && it && it.kind === 'magicstone') {
              const n = Math.floor(Number(it.count));
              if (n > 0) this.bag[i] = { kind: 'magicstone', count: Math.min(MAX_STONE_STACK, n) };
            }
          });
        }
        const old = Math.floor(Number(d && d.stats && d.stats.magicStones));
        if (old > 0) { addStones(old, this); if (this.stats) delete this.stats.magicStones; }
      } catch (e) { /* ไม่มีเซฟ ข้าม */ }
      return r;
    };
  }

  // ---------- แสดงผลในกระเป๋า/ชื่อไอเทม ----------
  try {
    const _label = itemLabel;
    itemLabel = function (item) {
      if (item && item.kind === 'magicstone') return 'หินพลังวิเศษ' + (item.count > 1 ? '  x' + item.count : '');
      const t = _label.apply(this, arguments);
      return (item && item.kind === 'equip' && Array.isArray(item.magic) && item.magic.length) ? t + ' ✦' : t;
    };
    const _icon = iconKeyForItem;
    iconKeyForItem = function (item) {
      if (item && item.kind === 'magicstone') {
        const sc = scene();
        return (sc && sc.textures && sc.textures.exists('img_magicstone')) ? 'img_magicstone' : 'icon_opt_purple';
      }
      return _icon.apply(this, arguments);
    };
    const _rar = rarityColor;
    rarityColor = function (item) { return (item && item.kind === 'magicstone') ? 0xff3a5c : _rar.apply(this, arguments); };
    const _match = itemsMatch;   // ชิ้นที่มีพลังวิเศษแล้วไม่ให้รวมดาว (กันของที่ลงทุนหาย)
    itemsMatch = function (a, b) {
      if ((a && a.magic && a.magic.length) || (b && b.magic && b.magic.length)) return false;
      return _match.apply(this, arguments);
    };
  } catch (e) { console.warn('magicRoll: ผูกชื่อไอเทมไม่ได้', e); }

  // ============================================================
  // หน้าต่างช่างพลังวิเศษ (DOM)
  // ============================================================
  const css = document.createElement('style');
  css.textContent = [
    '#mr-wrap{position:fixed;inset:0;z-index:9000;background:rgba(10,4,6,.82);display:none;align-items:center;justify-content:center;font-family:"Mitr",sans-serif;color:#f3e6c8;-webkit-tap-highlight-color:transparent}',
    '#mr-box{width:min(94vw,740px);max-height:94vh;overflow:auto;display:flex;gap:12px;background:#1b0a0f;border:2px solid #c9a24a;border-radius:10px;padding:12px;box-shadow:0 0 0 3px #3a1119 inset}',
    '#mr-npc{flex:0 0 30%;display:flex;align-items:flex-end;justify-content:center}',
    '#mr-npc img{max-width:100%;max-height:62vh;image-rendering:pixelated}',
    '#mr-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}',
    '#mr-head{display:flex;align-items:center;gap:8px}',
    '#mr-head b{font-size:17px;color:#ffd45c;flex:1;font-weight:600}',
    '#mr-x{background:#3a1119;color:#f3e6c8;border:1px solid #c9a24a;border-radius:6px;padding:4px 10px;font:inherit}',
    '#mr-items{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}',
    '.mr-it{flex:0 0 auto;background:#2a0e15;color:#f3e6c8;border:1px solid #5b2a33;border-radius:6px;padding:5px 9px;font:inherit;font-size:12px;white-space:nowrap}',
    '.mr-it.on{border-color:#ffd45c;background:#4a1a22}',
    '.mr-row{display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:8px;background:#2a0e15;border:1px solid #5b2a33;border-radius:6px;padding:6px 8px;position:relative;overflow:hidden}',
    '.mr-row .bar{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,rgba(201,162,74,.28),rgba(201,162,74,0));pointer-events:none}',
    '.mr-row .lk{background:#1b0a0f;border:1px solid #5b2a33;border-radius:6px;font-size:18px;padding:3px 0;color:#f3e6c8}',
    '.mr-row .lk.on{border-color:#ffd45c;background:#5a2a14}',
    '.mr-row .nm{font-size:13px;position:relative}',
    '.mr-row .vl{font-size:15px;color:#ffd45c;font-weight:600;position:relative}',
    '.mr-row.max .vl{color:#ff8a5c}',
    '.mr-row.empty .nm,.mr-row.empty .vl{color:#7a5a60}',
    '.mr-row.flash{animation:mrFlash .55s ease-out}',
    '@keyframes mrFlash{0%{background:#7a3a1a}100%{background:#2a0e15}}',
    '#mr-info{display:flex;align-items:center;gap:10px;font-size:12px;color:#d8c79a}',
    '#mr-info img{width:34px;height:34px}',
    '#mr-go{background:linear-gradient(#e0b84a,#a8782a);color:#2a0e15;border:0;border-radius:8px;padding:10px;font:inherit;font-size:16px;font-weight:600}',
    '#mr-go:disabled{filter:grayscale(1) brightness(.6)}',
    '#mr-msg{min-height:18px;font-size:12px;color:#ff9a8a}',
    '#mr-test{background:#16323a;color:#9fe8ff;border:1px dashed #9fe8ff;border-radius:6px;padding:5px;font:inherit;font-size:12px}',
    '@media (max-aspect-ratio:1/1){#mr-box{flex-direction:column}#mr-npc{flex:0 0 auto}#mr-npc img{max-height:16vh}}',
  ].join('\n');
  document.head.appendChild(css);

  const wrap = document.createElement('div');
  wrap.id = 'mr-wrap';
  wrap.innerHTML =
    '<div id="mr-box">' +
      '<div id="mr-npc"><img alt="" src="' + NPC_IMG + '"></div>' +
      '<div id="mr-main">' +
        '<div id="mr-head"><b>ช่างพลังวิเศษ</b><button id="mr-x">ปิด</button></div>' +
        '<div id="mr-items"></div>' +
        '<div id="mr-rows"></div>' +
        '<div id="mr-info"><img alt="" src="' + STONE_IMG + '"><div id="mr-cost"></div></div>' +
        '<div id="mr-msg"></div>' +
        '<button id="mr-go">สุ่มพลังวิเศษ</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);
  const $ = id => wrap.querySelector(id);

  let sel = null, locked = [false, false, false, false];

  function candidates() {
    const s = scene(), out = [];
    if (!s) return out;
    const eq = s.equipment || {};
    EQUIP_SLOT_KEYS.forEach(k => { if (eq[k]) out.push({ it: eq[k], on: true }); });
    const bag = [s.bag, s.bagItems, s.inventory].find(a => Array.isArray(a));
    if (bag) bag.forEach(i => { if (i && i.kind === 'equip') out.push({ it: i, on: false }); });
    return out;
  }
  function hex(n) { return '#' + ('000000' + (n >>> 0).toString(16)).slice(-6); }

  function drawItems() {
    const box = $('#mr-items'); box.textContent = '';
    const list = candidates();
    if (!list.length) { box.textContent = 'ไม่มีอุปกรณ์'; return; }
    if (!sel || !list.some(c => c.it === sel)) { sel = list[0].it; locked = [false, false, false, false]; }
    list.forEach(c => {
      const b = document.createElement('button');
      b.className = 'mr-it' + (c.it === sel ? ' on' : '');
      b.textContent = (c.on ? '● ' : '') + itemLabel(c.it);
      try { b.style.color = hex(rarityColor(c.it)); } catch (e) { /* ใช้สีเดิม */ }
      b.onclick = () => { sel = c.it; locked = [false, false, false, false]; $('#mr-msg').textContent = ''; draw(); };
      box.appendChild(b);
    });
  }

  function drawRows(changed) {
    const box = $('#mr-rows'); box.textContent = '';
    const has = sel && Array.isArray(sel.magic) && sel.magic.length === ROWS;
    for (let i = 0; i < ROWS; i++) {
      const r = has ? sel.magic[i] : null;
      const row = document.createElement('div');
      row.className = 'mr-row' + (r ? '' : ' empty') + (r && r.v >= MAX_PCT ? ' max' : '') + (changed && changed.indexOf(i) >= 0 ? ' flash' : '');
      const bar = document.createElement('div'); bar.className = 'bar'; bar.style.width = (r ? (r.v / MAX_PCT) * 100 : 0) + '%';
      const lk = document.createElement('button'); lk.className = 'lk' + (locked[i] ? ' on' : '');
      lk.textContent = locked[i] ? '🔒' : '🔓';
      lk.disabled = !has;
      lk.onclick = () => {
        if (!locked[i] && locked.filter(Boolean).length >= MAX_LOCK) { $('#mr-msg').textContent = 'ล็อกได้สูงสุด ' + MAX_LOCK + ' แถว'; return; }
        locked[i] = !locked[i]; $('#mr-msg').textContent = ''; draw();
      };
      const nm = document.createElement('div'); nm.className = 'nm';
      nm.textContent = r ? ((TYPE_BY_KEY[r.k] || { label: r.k }).label) : 'ยังไม่มีพลัง';
      const vl = document.createElement('div'); vl.className = 'vl';
      vl.textContent = r ? '+' + r.v + '%' : '—';
      row.appendChild(bar); row.appendChild(lk); row.appendChild(nm); row.appendChild(vl);
      box.appendChild(row);
    }
  }

  function drawFooter() {
    const has = sel && Array.isArray(sel.magic) && sel.magic.length === ROWS;
    const n = has ? locked.filter(Boolean).length : 0;
    const cost = costFor(n);
    $('#mr-cost').textContent = 'ราคา ' + fmt(cost) + ' ทอง + หิน x' + STONE_PER_ROLL +
      ' | มีหิน ' + fmt(stones()) + ' | ทอง ' + fmt(gold());
    const go = $('#mr-go');
    go.disabled = !sel;
    go.textContent = has ? 'สุ่มใหม่' + (n ? ' (ล็อก ' + n + ' แถว)' : '') : 'สุ่มพลังวิเศษ (ได้ 4 แถว)';
  }

  function draw(changed) { drawItems(); drawRows(changed); drawFooter(); }

  $('#mr-go').onclick = () => {
    const res = roll(sel, locked);
    $('#mr-msg').textContent = res.ok ? '' : res.msg;
    if (res.ok) toast('✨ สุ่มพลังวิเศษสำเร็จ (−' + fmt(res.cost) + ' ทอง)');
    draw(res.ok ? res.changed : null);
  };
  $('#mr-x').onclick = () => { wrap.style.display = 'none'; };
  wrap.addEventListener('click', e => { if (e.target === wrap) wrap.style.display = 'none'; });

  if (TEST_MODE) {
    const t = document.createElement('button');
    t.id = 'mr-test'; t.textContent = 'ทดสอบ: แจกหิน +10 และทอง +10 ล้าน';
    t.onclick = () => {
      const s = scene(); if (!s || !s.stats) return;
      addStones(10, s); s.stats.gold += 10000000; draw();
    };
    $('#mr-main').appendChild(t);
  }

  function open() { sel = null; locked = [false, false, false, false]; $('#mr-msg').textContent = ''; draw(); wrap.style.display = 'flex'; }

  window.MagicRoll = {
    open: open, addStones: addStones, stones: stones,
    types: TYPES, roll: roll,
  };

  // ============================================================
  // แสดงพลังวิเศษในรายละเอียดอุปกรณ์ (หน้าต่างกระเป๋า)
  // ============================================================
  const _extra = window.itemExtraInfoHTML;
  window.itemExtraInfoHTML = function (sc, it) {
    let h = (typeof _extra === 'function') ? (_extra.apply(this, arguments) || '') : '';
    if (it && Array.isArray(it.magic) && it.magic.length) {
      h += '<div class="d-row"><span>✦ พลังวิเศษ</span><span></span></div>';
      it.magic.forEach(r => {
        if (!r) return;
        h += '<div class="d-row"><span>' + ((TYPE_BY_KEY[r.k] || { label: r.k }).label) + '</span><span>+' + r.v + '%</span></div>';
      });
    }
    return h;
  };

  // ============================================================
  // NPC "ช่างพลังวิเศษ" ในเมือง (js/systems/town.js)
  // ============================================================
  if (typeof TOWN_NPCS !== 'undefined' && !TOWN_NPCS.some(n => n.id === 'magic')) {
    TOWN_NPCS.push({ id: 'magic', name: 'ช่างพลังวิเศษ', title: 'สุ่มพลังวิเศษอุปกรณ์', x: 1200, y: 1010, sprite: 'npc_magic', color: 0xa25cff, icon: '🔮' });
  }
  if (typeof TOWN_TEXT !== 'undefined') TOWN_TEXT.magic = 'สุ่มพลังวิเศษให้อุปกรณ์ ต้องใช้หินพลังวิเศษ';
  window.TownHooks = window.TownHooks || {};
  window.TownHooks.magic = function () { open(); };

  // โหลดรูป NPC (ต่อท้าย preload ของ town.js)
  const _preload = P.preload;
  P.preload = function () {
    if (_preload) _preload.apply(this, arguments);
    if (!this.textures.exists('img_magicstone')) this.load.image('img_magicstone', STONE_IMG + '?v=1');
    if (!this.textures.exists('npc_magic')) this.load.image('npc_magic', NPC_IMG + '?v=1');
  };

  // วาด NPC ด้วยรูปของเราเอง (ลอกวิธีวาดของ townMakeNpc ในรูปแบบมีรูป) ถ้ารูปไม่โหลดใช้ของเดิม (กล่อง+ไอคอน)
  if (typeof townMakeNpc === 'function') {
    const _mk = townMakeNpc;
    townMakeNpc = function (m, n, ox, oy, atlas, objs) {
      if (n.id !== 'magic' || !m.textures.exists('npc_magic')) return _mk.apply(this, arguments);
      const nx = ox + n.x, ny = oy + n.y;
      const npcH = Phaser.Math.Clamp((m.player && m.player.displayHeight) ? m.player.displayHeight * 1.15 : 96, 80, 150);
      const c = m.add.container(nx, ny).setDepth(townDepth(ny));
      const g = m.add.graphics();
      g.fillStyle(0x000000, 0.35).fillEllipse(0, 2, 62, 16);
      const spr = m.add.image(0, 8, 'npc_magic').setOrigin(0.5, 1);
      const k = npcH / spr.height;
      spr.setScale(k);
      const w = spr.displayWidth, h = spr.displayHeight;
      const tw = m.tweens.add({ targets: spr, scaleY: k * 1.018, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
      objs.push({ destroy: function () { tw.remove(); } });
      const nameY = 8 - h - 14;
      const name = m.add.text(0, nameY, n.name, { fontFamily: 'Mitr, sans-serif', fontSize: '16px', color: '#ffe28a', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
      const title = m.add.text(0, 26, n.title, { fontFamily: 'Mitr, sans-serif', fontSize: '13px', color: '#fff', backgroundColor: '#000000aa', padding: { x: 6, y: 2 } }).setOrigin(0.5);
      c.add([g, spr, name, title]);

      const BW = 112, BH = 42, btnY = nameY - 42;
      const bg = m.add.graphics();
      bg.fillStyle(0x000000, 0.35).fillRoundedRect(-BW / 2 + 2, -BH / 2 + 4, BW, BH, 14);
      bg.fillStyle(0xffd45c, 1).fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 14);
      bg.lineStyle(3, 0x26090f, 1).strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 14);
      const bt = m.add.text(0, 0, '💬 คุย', { fontFamily: 'Mitr, sans-serif', fontSize: '22px', color: '#26090f', fontStyle: 'bold' }).setOrigin(0.5);
      const btn = m.add.container(0, btnY, [bg, bt]);
      c.add(btn);
      const tw2 = m.tweens.add({ targets: btn, y: btnY - 6, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
      objs.push({ destroy: function () { tw2.remove(); } });

      const onTap = function () { townApproach(m, n, nx, ny); };
      const zBody = m.add.zone(nx, ny + 8 - h / 2, Math.max(w + 40, 130), h + 60).setDepth(60).setInteractive({ useHandCursor: true });
      zBody.on('pointerdown', onTap);
      const zBtn = m.add.zone(nx, ny + btnY, BW + 50, BH + 36).setDepth(61).setInteractive({ useHandCursor: true });
      zBtn.on('pointerdown', onTap);
      objs.push(c, zBody, zBtn);
    };
  }

  // ============================================================
  // หน้าต่างกระเป๋า (bagWindow.js): ใส่จำนวน xN และแผงรายละเอียดของหิน (ไม่ต้องแก้ bagWindow.js)
  // ============================================================
  function stoneDetailHTML(it) {
    return '<div class="d-top" style="--c:#ff3a5c"><div class="d-icon"><img src="' + STONE_IMG + '" alt=""></div>' +
      '<div><div class="d-name">หินพลังวิเศษ</div><div class="d-type">วัสดุสุ่มพลังวิเศษ</div></div></div>' +
      '<div class="d-note">นำไปสุ่มพลังวิเศษให้อุปกรณ์ที่ช่างพลังวิเศษในเมือง ใช้ 1 ก้อนต่อการสุ่ม 1 ครั้ง ดรอปจากมอนสเตอร์</div>' +
      '<div class="d-row"><span>รวมในกระเป๋า</span><span>' + fmt(stones()) + ' ก้อน</span></div>' +
      '<div class="d-row"><span>กองนี้</span><span>x' + (it.count || 1) + '</span></div>';
  }
  let decoQueued = false;
  function decorateBag() {
    decoQueued = false;
    const sc = scene(), win = document.getElementById('bag-win');
    if (!sc || !win || !Array.isArray(sc.bag)) return;
    win.querySelectorAll('button.cell[data-act="sel-bag"]').forEach(c => {
      const it = sc.bag[Number(c.dataset.id)];
      if (it && it.kind === 'magicstone' && it.count > 1 && !c.querySelector('.cnt')) {
        const sp = document.createElement('span'); sp.className = 'cnt'; sp.textContent = 'x' + it.count; c.appendChild(sp);
      }
    });
    const cell = win.querySelector('button.cell.sel[data-act="sel-bag"]');
    const right = win.querySelector('.win-right');
    if (cell && right) {
      const it = sc.bag[Number(cell.dataset.id)];
      if (it && it.kind === 'magicstone' && !right.querySelector('[data-mr]')) {
        right.innerHTML = '<div data-mr="1">' + stoneDetailHTML(it) + '</div>';
      }
    }
  }
  (function watchBag() {
    const layer = document.getElementById('ui-layer');
    if (!layer) return setTimeout(watchBag, 500);
    new MutationObserver(() => {
      if (!decoQueued) { decoQueued = true; requestAnimationFrame(decorateBag); }
    }).observe(layer, { childList: true, subtree: true });
  })();
})();
