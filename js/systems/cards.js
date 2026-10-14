// ===== ระบบการ์ด (แทนระบบรวมดาว) — js/systems/cards.js =====
// - อุปกรณ์มีช่องใส่การ์ดตามสี: ขาว 1 | ฟ้า 2 | แดง 3 | ทอง 4 (ปรับที่ TIER_SOCKETS)
// - การ์ดมอน: มอนเลเวล 1-10 (ด่านเดียวกัน) ดรอปการ์ดใบเดียวกัน | การ์ดบอส: มินิบอสด่านนั้นดรอป เพิ่มสเตตัสอีกแบบ
// - ใส่การ์ดซ้ำใบเดิมได้ไม่จำกัด | ถอดการ์ดได้ แต่ต้องใช้ "กุญแจถอดการ์ด" 1 อัน/ใบ
// - การ์ดเป็นไอเทมซ้อนได้ ขายในตลาดได้ (kind:'card', cid:'m1' = การ์ดมอนด่าน id 1 | 'b1' = การ์ดบอสด่าน id 1)
// - ปิดระบบรวมดาวเดิม (itemsMatch = false)
// ต้องโหลดหลัง stats.js, enhance.js, monsters.js และก่อน main.js
(function () {
  'use strict';
  const P = Main.prototype;

  // ---------- ค่าที่ปรับได้ ----------
  const TIER_SOCKETS = { white: 1, blue: 2, red: 3, gold: 4 };
  const MAX_CARD_STACK = 999;          // ต้องตรงกับ MAX_CARD_COUNT ใน functions/market.js
  const DROP_MONSTER = 0.03;           // มอนธรรมดาดรอปการ์ดมอน 3% (Epic x3)
  const DROP_BOSS = 0.35;              // มินิบอสดรอปการ์ดบอส 35%
  const DROP_BOSS_MON = 0.5;           // มินิบอสดรอปการ์ดมอนของด่านด้วย 50%
  const KEY_DROP_MONSTER = 0.008;      // กุญแจถอดการ์ดจากมอน 0.8% (Epic x3)
  const KEY_DROP_BOSS = 0.2;           // กุญแจถอดการ์ดจากมินิบอส 20%
  const EPIC_MULT_DROP = 3;

  // สเตตัสของการ์ด: การ์ดมอน/การ์ดบอส วนตามเลข id ด่าน (id 1 = ตัวแรก ...)
  const MON_STAT = ['patk', 'hp', 'pdef', 'ap', 'mp', 'mdef', 'aspd', 'mspd', 'cdr', 'crit'];
  const BOSS_STAT = ['crit', 'critdmg', 'ppen', 'lifesteal', 'hpregen', 'dodge', 'mpregen', 'cdr', 'mpen', 'spellvamp'];
  const BOSS_MUL = 1.6;                // การ์ดบอสแรงกว่า 1.6 เท่า
  // ค่าฐานต่อใบ (ด่าน 1) -> ด่านสูงขึ้นแรงขึ้น: จำนวนเต็ม x(1+0.5*(b-1)) | เปอร์เซ็นต์/ทศนิยม x(1+0.4*(b-1))
  const INT_BASE = { patk: 6, ap: 6, hp: 40, mp: 30, pdef: 5, mdef: 5 };
  const PCT_BASE = { aspd: 2, mspd: 1.5, cdr: 1, crit: 1.5, critdmg: 6, ppen: 1.5, mpen: 1.5, lifesteal: 1, spellvamp: 1, dodge: 1, hpregen: 0.5, mpregen: 0.3 };

  const sv = (s) => { if (s && s.saveSoon) s.saveSoon(); };
  const toast = (s, m) => { if (s && s.toastMsg) s.toastMsg(m); };
  const SD = () => window.STAT_DEFS || {};

  // ---------- ข้อมูลการ์ด ----------
  function parseCid(cid) {
    const m = /^([mnb])(\d{1,3})$/.exec(String(cid || ''));   // 'n' = ชื่อเรียกอื่นของการ์ดมอน (เหมือน 'm')
    if (!m || +m[2] < 1) return null;
    return { boss: m[1] === 'b', z: +m[2] };
  }
  const zoneBase = (z) => (z <= 9 ? z : 9 + (z - 9) * 0.5);
  function zoneName(z) {
    try {
      const f = ZONES.find((q) => q.id === z);
      if (f) return f.name;
    } catch (e) { /* ignore */ }
    return 'ด่าน ' + z;
  }
  const cardCache = {};
  function cardInfo(cid) {
    if (cardCache[cid]) return cardCache[cid];
    const p = parseCid(cid);
    if (!p) return null;
    const stat = (p.boss ? BOSS_STAT : MON_STAT)[(p.z - 1) % 10];
    const b = zoneBase(p.z);
    let v;
    if (INT_BASE[stat] !== undefined) v = INT_BASE[stat] * (1 + 0.5 * (b - 1));
    else v = PCT_BASE[stat] * (1 + 0.4 * (b - 1));
    if (p.boss) v *= BOSS_MUL;
    v = INT_BASE[stat] !== undefined ? Math.round(v) : Math.round(v * 10) / 10;
    const d = SD()[stat];
    const info = {
      cid: cid, boss: p.boss, z: p.z, stat: stat, val: v,
      statName: d ? d.short : stat,
      name: (p.boss ? 'การ์ดบอส ' : 'การ์ด ') + zoneName(p.z) + ' · ' + (d ? d.short : stat),
      valText: '+' + (window.fmtStat ? window.fmtStat(stat, v) : v),
    };
    return (cardCache[cid] = info);
  }
  const isCid = (c) => !!parseCid(c);

  // ---------- ช่องการ์ดบนอุปกรณ์ ----------
  const tierName = (it) => (typeof tierOf === 'function' ? tierOf(it) : (it.tier || 'white'));
  const socketCountOf = (it) => TIER_SOCKETS[tierName(it)] || 1;
  // อ่านช่อง (ไม่แก้ item): คืนอาร์เรย์ยาวเท่าจำนวนช่องของสีนั้น
  function getSockets(it) {
    const n = socketCountOf(it), src = Array.isArray(it.sockets) ? it.sockets : [], out = [];
    for (let i = 0; i < n; i++) out.push(isCid(src[i]) ? src[i] : null);
    return out;
  }
  const hasCards = (it) => !!it && it.kind === 'equip' && getSockets(it).some(Boolean);
  const filledCount = (it) => getSockets(it).filter(Boolean).length;
  function pips(it) {
    return getSockets(it).map((c) => (c ? '●' : '○')).join('');
  }
  // สเตตัสรวมจากการ์ดทั้งหมดบนอุปกรณ์ชิ้นนี้
  function cardBonusOf(it) {
    const out = {};
    if (!it || it.kind !== 'equip') return out;
    getSockets(it).forEach((c) => {
      const i = c && cardInfo(c);
      if (i) out[i.stat] = (out[i.stat] || 0) + i.val;
    });
    return out;
  }

  // ---------- การ์ดในกระเป๋า ----------
  const isCardKind = (it) => !!it && (it.kind === 'card' || it.kind === 'cardkey');
  const sameStack = (s, p) => !!s && s.kind === p.kind && (s.cid || '') === (p.cid || '');
  const cnt = (s) => (s.count || 1);
  function stackAdd(sc, proto, n) {            // คืนจำนวนที่ใส่ไม่ได้ (0 = ครบ)
    let left = n;
    sc.bag.forEach((s) => {
      if (left > 0 && sameStack(s, proto) && cnt(s) < MAX_CARD_STACK) {
        const a = Math.min(left, MAX_CARD_STACK - cnt(s));
        s.count = cnt(s) + a; left -= a;
      }
    });
    while (left > 0) {
      const i = sc.bag.findIndex((s) => !s);
      if (i < 0) break;
      const a = Math.min(left, MAX_CARD_STACK);
      sc.bag[i] = Object.assign({}, proto, { count: a });
      left -= a;
    }
    return left;
  }
  function stackRoom(sc, proto, n) {
    let room = 0;
    sc.bag.forEach((s) => {
      if (!s) room += MAX_CARD_STACK;
      else if (sameStack(s, proto)) room += MAX_CARD_STACK - cnt(s);
    });
    return room >= n;
  }
  function stackTake(sc, proto, n) {
    let have = 0;
    sc.bag.forEach((s) => { if (sameStack(s, proto)) have += cnt(s); });
    if (have < n) return false;
    for (let i = 0; i < sc.bag.length && n > 0; i++) {
      const s = sc.bag[i];
      if (!sameStack(s, proto)) continue;
      const t = Math.min(n, cnt(s));
      s.count = cnt(s) - t; n -= t;
      if (s.count <= 0) sc.bag[i] = null;
    }
    return true;
  }
  const countOf = (sc, proto) => sc.bag.reduce((n, s) => n + (sameStack(s, proto) ? cnt(s) : 0), 0);
  const KEY = { kind: 'cardkey' };
  const countKeys = (sc) => countOf(sc, KEY);
  function addCardToBag(sc, cid, n) { return stackAdd(sc, { kind: 'card', cid: cid }, n || 1); }
  function addKeyToBag(sc, n) { return stackAdd(sc, { kind: 'cardkey' }, n || 1); }

  // ---------- ใส่ / ถอดการ์ด ----------
  const getItem = (sc, src, id) => (src === 'bag' ? sc.bag[id] : sc.equipment[id]);
  function setItem(sc, src, id, it) { if (src === 'bag') sc.bag[id] = it; else sc.equipment[id] = it; }

  function socketCard(sc, src, id, i, cid) {
    const it = getItem(sc, src, id);
    if (!it || it.kind !== 'equip') return false;
    const sk = getSockets(it);
    if (i < 0 || i >= sk.length) return false;
    if (sk[i]) { toast(sc, 'ช่องนี้มีการ์ดอยู่แล้ว (ถอดก่อนด้วยกุญแจถอดการ์ด)'); return false; }
    if (!isCid(cid) || !stackTake(sc, { kind: 'card', cid: cid }, 1)) { toast(sc, 'ไม่มีการ์ดนี้ในกระเป๋า'); return false; }
    sk[i] = cid;
    setItem(sc, src, id, Object.assign({}, it, { sockets: sk }));
    sc.computeAtk(); sv(sc);
    toast(sc, 'ใส่การ์ด ' + cardInfo(cid).name + ' แล้ว');
    return true;
  }
  function unsocketCard(sc, src, id, i) {
    const it = getItem(sc, src, id);
    if (!it || it.kind !== 'equip') return false;
    const sk = getSockets(it), cid = sk[i];
    if (!cid) return false;
    if (countKeys(sc) < 1) { toast(sc, 'ต้องมี "กุญแจถอดการ์ด" 1 อัน'); return false; }
    if (!stackRoom(sc, { kind: 'card', cid: cid }, 1)) { toast(sc, 'กระเป๋าเต็ม ถอดการ์ดไม่ได้'); return false; }
    stackTake(sc, KEY, 1);
    sk[i] = null;
    setItem(sc, src, id, Object.assign({}, it, { sockets: sk }));
    addCardToBag(sc, cid, 1);
    sc.computeAtk(); sv(sc);
    toast(sc, 'ถอดการ์ด ' + cardInfo(cid).name + ' แล้ว (ใช้กุญแจ 1 อัน)');
    return true;
  }

  // ---------- ไอคอน (วาดเองด้วยโค้ด) ----------
  const urlCache = {};
  function drawCard(cid) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d'), info = cardInfo(cid);
    const boss = info && info.boss;
    const grad = g.createLinearGradient(0, 0, 0, 32);
    grad.addColorStop(0, boss ? '#6a4a12' : '#27425e'); grad.addColorStop(1, boss ? '#2a1c06' : '#101c2c');
    g.fillStyle = grad;
    g.beginPath();
    if (g.roundRect) g.roundRect(5, 2, 22, 28, 3); else g.rect(5, 2, 22, 28);
    g.fill();
    g.lineWidth = 2; g.strokeStyle = boss ? '#ffc83d' : '#7fb8ff'; g.stroke();
    g.fillStyle = boss ? 'rgba(255,200,61,.25)' : 'rgba(127,184,255,.25)';
    g.beginPath(); g.arc(16, 15, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String((info && info.statName) || '?').charAt(0), 16, 16);
    if (boss) {
      g.fillStyle = '#ffc83d';
      g.beginPath(); g.moveTo(10, 8); g.lineTo(12, 3); g.lineTo(16, 7); g.lineTo(20, 3); g.lineTo(22, 8); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.8)'; g.font = 'bold 7px sans-serif';
    g.fillText(String(info ? info.z : ''), 16, 26);
    return c;
  }
  function drawKey() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    g.strokeStyle = '#d9a6ff'; g.fillStyle = '#d9a6ff'; g.lineWidth = 3;
    g.beginPath(); g.arc(11, 11, 6, 0, Math.PI * 2); g.stroke();
    g.fillRect(15, 14, 4, 15); g.fillRect(19, 22, 5, 3); g.fillRect(19, 27, 4, 2);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(9, 9, 2, 0, Math.PI * 2); g.fill();
    return c;
  }
  const texKey = (it) => (it.kind === 'cardkey' ? 'icon_cardkey' : 'icon_card_' + it.cid);
  function ensureTex(it) {
    const key = texKey(it);
    try {
      const sc = window.__mainScene;
      if (sc && sc.textures && !sc.textures.exists(key)) sc.textures.addCanvas(key, it.kind === 'cardkey' ? drawKey() : drawCard(it.cid));
    } catch (e) { /* ignore */ }
    return key;
  }
  function iconURL(it) {
    const key = texKey(it);
    if (!urlCache[key]) {
      try { urlCache[key] = (it.kind === 'cardkey' ? drawKey() : drawCard(it.cid)).toDataURL(); } catch (e) { urlCache[key] = ''; }
    }
    return urlCache[key];
  }

  // ---------- ทับฟังก์ชันกลางของไอเทม ----------
  const _label = window.itemLabel;
  window.itemLabel = function (item) {
    if (item && item.kind === 'card') {
      const i = cardInfo(item.cid);
      return (i ? i.name : 'การ์ด') + (item.count > 1 ? '  x' + item.count : '');
    }
    if (item && item.kind === 'cardkey') return 'กุญแจถอดการ์ด' + (item.count > 1 ? '  x' + item.count : '');
    return _label(item);
  };
  const _icon = window.iconKeyForItem;
  window.iconKeyForItem = function (item) {
    if (isCardKind(item)) return ensureTex(item);
    return _icon(item);
  };
  const _rar = window.rarityColor;
  window.rarityColor = function (item) {
    if (item && item.kind === 'card') { const i = cardInfo(item.cid); return i && i.boss ? 0xffc83d : 0x7fb8ff; }
    if (item && item.kind === 'cardkey') return 0xc77dff;
    return _rar(item);
  };
  // อุปกรณ์ที่สุ่มได้ใหม่ มีช่องการ์ดว่างตามสีเสมอ
  const _rand = window.randomEquipItem;
  window.randomEquipItem = function (level, tier) {
    const it = _rand(level, tier);
    if (it && it.kind === 'equip') it.sockets = new Array(socketCountOf(it)).fill(null);
    return it;
  };

  // ---------- ปิดระบบรวมดาวเดิม ----------
  window.itemsMatch = function () { return false; };
  const noMerge = function () { toast(this, 'ระบบรวมดาวถูกยกเลิกแล้ว ใช้การ์ดแทน'); return 0; };
  P.mergeSingleItem = noMerge; P.mergeAllInBag = noMerge; P.mergeSelectedCount = noMerge; P.mergeIndices = noMerge;
  P.countMatches = function () { return 0; };

  // ---------- เชื่อมกับระบบเดิม ----------
  // การ์ด/กุญแจ ซ้อนในกระเป๋าเอง (ไม่พึ่งโค้ด addItemToBag เดิมที่ไม่รู้จักชนิดนี้)
  const _addItem = P.addItemToBag;
  P.addItemToBag = function (item) {
    if (isCardKind(item)) return stackAdd(this, item, item.count || 1) === 0;
    return _addItem.apply(this, arguments);
  };

  // จัดกระเป๋า: เอาการ์ดออกก่อน (โค้ดเดิมจะรวมการ์ดต่างชนิดเป็นกองเดียว) แล้วใส่กลับแบบแยกตามใบ
  const _sort = P.sortBag;
  P.sortBag = function () {
    const held = [];
    this.bag.forEach((s, i) => { if (isCardKind(s)) { held.push(s); this.bag[i] = null; } });
    const r = _sort.apply(this, arguments);
    held.sort((a, b) => (a.kind === b.kind ? 0 : (a.kind === 'cardkey' ? -1 : 1)) || String(a.cid || '').localeCompare(String(b.cid || ''), undefined, { numeric: true }));
    held.forEach((s) => {
      if (stackAdd(this, s, cnt(s)) > 0) {      // ไม่น่าเกิด (ช่องที่ยกออกว่างให้ครบ) กันของหายไว้
        const i = this.bag.findIndex((q) => !q);
        if (i >= 0) this.bag[i] = s;
      }
    });
    sv(this);
    return r;
  };

  // ห้ามย่อยอุปกรณ์ที่ยังมีการ์ดอยู่ (กันการ์ดหาย)
  const _dis = P.dismantleBagItem;
  P.dismantleBagItem = function (idx) {
    const it = this.bag[idx];
    if (hasCards(it)) { toast(this, 'ถอดการ์ดออกก่อนจึงจะย่อยได้'); return false; }
    return _dis.apply(this, arguments);
  };

  // บวกสเตตัสจากการ์ดที่ใส่ในอุปกรณ์ที่สวมอยู่
  const _recalc = P.recalcStats;
  P.recalcStats = function () {
    const out = _recalc.apply(this, arguments);
    try {
      ensureTexturesSoon();
      const eq = this.equipment || {};
      const defs = SD();
      EQUIP_SLOT_KEYS.forEach((k) => {
        const b = cardBonusOf(eq[k]);
        Object.keys(b).forEach((s) => { out[s] = (out[s] || 0) + b[s]; });
      });
      Object.keys(out).forEach((k) => {
        const d = defs[k];
        if (d && d.cap != null && out[k] > d.cap) out[k] = d.cap;
      });
      const st = this.stats || {};
      this.equipHpBonus = out.hp - (st.maxHp || 0);
      this.equipMpBonus = out.mp - (st.maxMp || 0);
    } catch (e) { /* ignore */ }
    return out;
  };
  let texDone = false;
  function ensureTexturesSoon() {
    if (texDone || !window.__mainScene || !window.__mainScene.textures) return;
    texDone = true;
    ensureTex({ kind: 'cardkey' });
  }

  // ดรอปการ์ด/กุญแจ: ห่อ dropLoot (ใช้ได้ทั้งโหมดในเครื่องและโหมดห้อง เพราะทั้งคู่เรียก dropLoot)
  function rollCards(sc, isBoss, isEpic) {
    const z = (typeof ZONES !== 'undefined') ? ZONES[sc.stageIdx] : null;
    if (!z || z.town || z.safe) return;
    const mul = isEpic ? EPIC_MULT_DROP : 1, got = [];
    const give = (cid) => {
      if (addCardToBag(sc, cid, 1) === 0) got.push(cardInfo(cid).name);
      else toast(sc, '⚠ กระเป๋าเต็ม การ์ดหายไป 1 ใบ');
    };
    if (isBoss) {
      if (Math.random() < DROP_BOSS) give('b' + z.id);
      if (Math.random() < DROP_BOSS_MON) give('m' + z.id);
    } else if (Math.random() < DROP_MONSTER * mul) give('m' + z.id);
    if (Math.random() < (isBoss ? KEY_DROP_BOSS : KEY_DROP_MONSTER * mul)) {
      if (addKeyToBag(sc, 1) === 0) got.push('กุญแจถอดการ์ด'); else toast(sc, '⚠ กระเป๋าเต็ม กุญแจหายไป');
    }
    if (got.length) { toast(sc, '🃏 ได้ ' + got.join(' , ')); sv(sc); }
  }
  const _drop = P.dropLoot;
  P.dropLoot = function () {
    const r = _drop.apply(this, arguments);
    try { rollCards(this, !!arguments[4], !!arguments[5]); } catch (e) { /* ignore */ }
    return r;
  };

  // ---------- หน้าจอ (HTML) ----------
  function css() {
    if (typeof document === 'undefined' || document.getElementById('card-css')) return;
    const st = document.createElement('style');
    st.id = 'card-css';
    st.textContent = [
      '#bag-win .cell .sk{position:absolute;bottom:0;left:50%;transform:translateX(-50%);font-size:clamp(6px,16cqh,10px);line-height:1;color:#ffd45c;text-shadow:0 0 2px #000,0 0 2px #000;letter-spacing:-1px;pointer-events:none}',
      '.cs-wrap{margin:6px 0;padding:6px;border:1px solid #3a4a66;border-radius:8px;background:rgba(20,30,50,.5)}',
      '.cs-title{font-size:11px;color:#ffd45c;margin-bottom:4px;font-weight:700}',
      '.cs-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px}',
      '.cs-slot{width:38px;height:38px;border-radius:8px;border:2px dashed #5a6f94;background:#0d131f;color:#8aa;font-size:20px;line-height:1;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer}',
      '.cs-slot.f{border-style:solid;border-color:#ffd45c}',
      '.cs-slot img{width:30px;height:30px;object-fit:contain;pointer-events:none}',
      '.cs-line{display:flex;justify-content:space-between;gap:6px;font-size:11px;padding:1px 0;color:#cfe}',
      '.cs-ov{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:8px;box-sizing:border-box}',
      '.cs-pn{touch-action:pan-y;-webkit-overflow-scrolling:touch;width:min(92vw,420px);max-height:86vh;overflow:auto;box-sizing:border-box;background:#101826;border:2px solid #ffd45c;border-radius:12px;padding:12px;color:#e8f0ff;font-family:inherit}',
      '.cs-pn h3{margin:0 0 8px;font-size:15px;color:#ffd45c}',
      '.cs-it{display:flex;align-items:center;gap:8px;padding:6px;margin-bottom:4px;border-radius:8px;background:#1a2438}',
      '.cs-it img{width:34px;height:34px;object-fit:contain}',
      '.cs-it .t{flex:1;min-width:0;font-size:12px;line-height:1.3}',
      '.cs-it .t small{color:#9fd0ff;display:block}',
      '.cs-b{font-family:inherit;font-size:13px;padding:7px 12px;border-radius:8px;border:2px solid #ffd45c;background:#ffd45c;color:#26090f;cursor:pointer}',
      '.cs-b.g{background:#26090f;color:#ffe28a}',
      '.cs-b[disabled]{opacity:.4;cursor:not-allowed}',
      '.cs-note{font-size:11px;color:#aab;margin:6px 0}',
    ].join('');
    document.head.appendChild(st);
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hexc = (c) => '#' + ('000000' + c.toString(16)).slice(-6);

  // ส่วน "ช่องการ์ด" ในหน้ารายละเอียดอุปกรณ์ (bagWindow.js เรียก)
  function socketsHTML(it) {
    if (!it || it.kind !== 'equip') return '';
    css();
    const sk = getSockets(it);
    let h = '<div class="cs-wrap"><div class="cs-title">🃏 ช่องการ์ด (' + filledCount(it) + '/' + sk.length + ')</div><div class="cs-row">';
    sk.forEach((c, i) => {
      h += '<button class="cs-slot' + (c ? ' f' : '') + '" data-act="sock" data-id="' + i + '">'
        + (c ? '<img src="' + iconURL({ kind: 'card', cid: c }) + '" alt="">' : '+') + '</button>';
    });
    h += '</div>';
    sk.forEach((c) => {
      const i = c && cardInfo(c);
      if (i) h += '<div class="cs-line"><span>' + esc(i.name) + '</span><b>' + esc(i.valText) + '</b></div>';
    });
    h += '<div class="cs-note">แตะช่องเพื่อใส่/ถอดการ์ด (ถอดต้องใช้กุญแจ)</div></div>';
    return h;
  }

  // รายละเอียดการ์ด / กุญแจ ในกระเป๋า
  function itemDetailHTML(it) {
    css();
    const col = hexc(window.rarityColor(it));
    const src = iconURL(it);
    if (it.kind === 'cardkey') {
      return '<div class="d-top" style="--c:' + col + '"><div class="d-icon"><img src="' + src + '" alt=""></div>'
        + '<div><div class="d-name">กุญแจถอดการ์ด</div><div class="d-type">ไอเทมใช้ถอดการ์ด</div></div></div>'
        + '<div class="d-note">ใช้ 1 อัน ต่อการถอดการ์ด 1 ใบ ออกจากอุปกรณ์ (เลือกอุปกรณ์ แล้วแตะช่องการ์ด)</div>'
        + '<div class="d-row"><span>มีในกระเป๋า</span><span>' + countKeys(window.__mainScene) + ' อัน</span></div>';
    }
    const i = cardInfo(it.cid);
    if (!i) return '<div class="d-empty">การ์ดไม่ถูกต้อง</div>';
    return '<div class="d-top" style="--c:' + col + '"><div class="d-icon"><img src="' + src + '" alt=""></div>'
      + '<div><div class="d-name">' + esc(i.name) + '</div><div class="d-type">' + (i.boss ? 'การ์ดบอส' : 'การ์ดมอน') + ' • ' + esc(zoneName(i.z)) + '</div></div></div>'
      + '<div class="d-stats"><div><span>' + esc(i.statName) + '</span><span>' + esc(i.valText) + '</span></div></div>'
      + '<div class="d-note">เลือกอุปกรณ์ แล้วแตะช่องการ์ดเพื่อใส่ • ใส่ซ้ำใบเดิมได้ • ขายในตลาดได้</div>'
      + '<div class="d-row"><span>จำนวน</span><span>x' + (it.count || 1) + '</span></div>';
  }

  function modal(build) {
    css();
    const ov = document.createElement('div');
    ov.className = 'cs-ov';
    const pn = document.createElement('div');
    pn.className = 'cs-pn';
    ov.appendChild(pn);
    const close = () => { if (ov.parentNode) ov.parentNode.removeChild(ov); };
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    build(pn, close);
    document.body.appendChild(ov);
    return close;
  }
  const refresh = () => { if (window.BagWindowRefresh) window.BagWindowRefresh(); };

  // เปิดหน้าต่างใส่/ถอดการ์ดของช่อง i
  function openSocket(sc, src, id, i) {
    const it = getItem(sc, src, id);
    if (!it || it.kind !== 'equip') return;
    const sk = getSockets(it), cid = sk[i];
    if (cid) {
      const info = cardInfo(cid), keys = countKeys(sc);
      modal((pn, close) => {
        pn.innerHTML = '<h3>ถอดการ์ด</h3><div class="cs-it"><img src="' + iconURL({ kind: 'card', cid: cid }) + '" alt="">'
          + '<div class="t">' + esc(info.name) + '<small>' + esc(info.statName) + ' ' + esc(info.valText) + '</small></div></div>'
          + '<div class="cs-note">ต้องใช้ กุญแจถอดการ์ด 1 อัน (มี ' + keys + ' อัน) การ์ดจะกลับเข้ากระเป๋า</div>'
          + '<div style="display:flex;gap:8px"><button class="cs-b g" data-x="c" style="flex:1">ยกเลิก</button>'
          + '<button class="cs-b" data-x="ok" style="flex:2"' + (keys < 1 ? ' disabled' : '') + '>ถอดการ์ด</button></div>';
        pn.addEventListener('click', (e) => {
          const x = e.target.closest('[data-x]');
          if (!x || x.disabled) return;
          if (x.dataset.x === 'ok') { unsocketCard(sc, src, id, i); refresh(); }
          close();
        });
      });
      return;
    }
    // เลือกการ์ดจากกระเป๋า (รวมกองเดียวกัน)
    const by = {};
    sc.bag.forEach((s) => { if (s && s.kind === 'card' && cardInfo(s.cid)) by[s.cid] = (by[s.cid] || 0) + cnt(s); });
    const ids = Object.keys(by).sort((a, b) => {
      const A = cardInfo(a), B = cardInfo(b);
      return (A.boss - B.boss) || (A.z - B.z);
    });
    modal((pn, close) => {
      let h = '<h3>ใส่การ์ดช่องที่ ' + (i + 1) + '</h3>';
      if (!ids.length) h += '<div class="cs-note">ไม่มีการ์ดในกระเป๋า (ดรอปจากมอน/มินิบอส หรือซื้อจากตลาด)</div>';
      ids.forEach((c) => {
        const inf = cardInfo(c);
        h += '<div class="cs-it"><img src="' + iconURL({ kind: 'card', cid: c }) + '" alt="">'
          + '<div class="t">' + esc(inf.name) + '<small>' + esc(inf.statName) + ' ' + esc(inf.valText) + ' • มี ' + by[c] + '</small></div>'
          + '<button class="cs-b" data-c="' + c + '">ใส่</button></div>';
      });
      h += '<div style="margin-top:8px"><button class="cs-b g" data-x="c" style="width:100%">ปิด</button></div>';
      pn.innerHTML = h;
      pn.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.c) { socketCard(sc, src, id, i, b.dataset.c); refresh(); }
        close();
      });
    });
  }

  window.CardUI = {
    socketsHTML: socketsHTML, itemDetailHTML: itemDetailHTML, openSocket: openSocket,
    pips: pips, filled: filledCount, count: (it) => getSockets(it).length,
  };
  window.CardSys = {
    TIER_SOCKETS: TIER_SOCKETS, MAX_CARD_STACK: MAX_CARD_STACK, cardInfo: cardInfo, getSockets: getSockets,
    hasCards: hasCards, socketCard: socketCard, unsocketCard: unsocketCard, addCardToBag: addCardToBag,
    addKeyToBag: addKeyToBag, countKeys: countKeys, cardBonusOf: cardBonusOf, isCid: isCid,
  };
  css();
})();
