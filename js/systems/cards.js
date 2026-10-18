// ===== ระบบการ์ด (แทนระบบรวมดาว) — js/systems/cards.js =====
// - อุปกรณ์มีช่องใส่การ์ดตามสี: ขาว 1 | ฟ้า 2 | แดง 3 | ทอง 4 (ปรับที่ TIER_SOCKETS)
// - การ์ดมอน: มอนเลเวล 1-10 (ด่านเดียวกัน) ดรอปการ์ดใบเดียวกัน | การ์ดบอส: มินิบอสด่านนั้นดรอป เพิ่มสเตตัสอีกแบบ
// - ใส่การ์ดซ้ำใบเดิมได้ไม่จำกัด | ถอดการ์ดได้ แต่ต้องใช้ "กุญแจถอดการ์ด" 1 อัน/ใบ
// - การ์ดเป็นไอเทมซ้อนได้ ขายในตลาดได้ (kind:'card', cid:'m1' = การ์ดมอนด่าน id 1 | 'b1' = การ์ดบอสด่าน id 1)
// - ปิดระบบรวมดาวเดิม (itemsMatch = false)
// v2: ไอคอนในช่องกระเป๋า = กรอบการ์ดเปล่า (ฝังในไฟล์) + เลขด่าน/ตัวอักษรสเตตัสทับตรงกลาง (บอสย้อมทอง)
//     กดดูรายละเอียดการ์ด = โชว์รูปการ์ดเต็ม assets/cards/m1.webp ... b9.webp (แตะรูปเพื่อขยาย)
//     ด่านจุติ (id 10 ขึ้นไป) ใช้รูปการ์ดของด่านเดิมวนซ้ำตามลำดับ (id 10 = รูปด่าน 1, 11 = ด่าน 2 ...)
//     รูปที่ยังไม่มีไฟล์จะไม่แสดง (ไม่ error) และไอคอนสำรองวาดด้วยโค้ด
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
  const ART_PATH = 'assets/cards/';    // รูปการ์ดเต็ม: m1.webp ... m9.webp, b1.webp ... b9.webp
  const ART_EXT = '.webp';
  const ART_COUNT = 9;                 // จำนวนรูปการ์ดต่อชนิด (ด่านจุติวนใช้ซ้ำ)
  const SHOW_ZONE_NUM = true;          // true = โชว์เลขด่านกลางไอคอนการ์ดในกระเป๋า | false = ไม่มีตัวอักษร/ตัวเลขใดๆ

  // กรอบการ์ดเปล่า (ฝังในไฟล์ ไม่ต้องอัปโหลดรูป) | รูปใหญ่ assets/cards/frame.png ไว้ใช้ที่อื่น
  const FRAME_URI = 'data:image/png;base64,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';

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

  // ---------- รูปการ์ดเต็ม (โหลดเมื่อต้องใช้ ถ้าไฟล์ไม่มีจะไม่แสดงและไม่ขึ้น error) ----------
  const artState = {};                 // id -> 1 กำลังโหลด | 2 พร้อม | 3 ไม่มีไฟล์
  function artIdOf(info) {
    const idx = info.z <= ART_COUNT ? info.z : ((info.z - 10) % ART_COUNT) + 1;   // ด่านจุติ id 10+ วนใช้รูปด่าน 1-9
    return (info.boss ? 'b' : 'm') + idx;
  }
  function loadArt(id, done) {
    if (artState[id]) return;
    artState[id] = 1;
    const im = new Image();            // ไม่ใส่ในหน้าเว็บ จึงไม่ทำให้กล่องแจ้ง error ขึ้นถ้าไฟล์ไม่มี
    im.onload = () => { artState[id] = 2; if (done) done(); };
    im.onerror = () => { artState[id] = 3; };
    im.src = ART_PATH + id + ART_EXT;
  }

  // ---------- ไอคอน (กรอบการ์ดเปล่า + เลขด่านทับ) ----------
  const frameImg = new Image();
  let frameReady = false;
  frameImg.onload = () => { frameReady = true; };
  frameImg.src = FRAME_URI;

  const urlCache = {};
  const S = 96;                        // ขนาดไอคอน (พิกเซล)
  function drawCardFallback(g, boss, info) {   // สำรองตอนกรอบยังโหลดไม่เสร็จ (วาดด้วยโค้ดแบบเดิม)
    g.save(); g.scale(S / 32, S / 32);
    const grad = g.createLinearGradient(0, 0, 0, 32);
    grad.addColorStop(0, boss ? '#6a4a12' : '#27425e'); grad.addColorStop(1, boss ? '#2a1c06' : '#101c2c');
    g.fillStyle = grad;
    g.beginPath();
    if (g.roundRect) g.roundRect(5, 2, 22, 28, 3); else g.rect(5, 2, 22, 28);
    g.fill();
    g.lineWidth = 2; g.strokeStyle = boss ? '#ffc83d' : '#7fb8ff'; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(info ? info.z : ''), 16, 16);
    g.restore();
  }
  function drawCard(cid) {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d'), info = cardInfo(cid);
    const boss = !!(info && info.boss);
    if (!frameReady) { drawCardFallback(g, boss, info); return c; }

    const fh = S - 2, fw = Math.round(frameImg.width * fh / frameImg.height), fx = Math.round((S - fw) / 2);
    const t = document.createElement('canvas');          // วาดกรอบลงผืนชั่วคราวก่อน เพื่อย้อนสีทองให้บอสโดยไม่กระทบพื้นโปร่งใส
    t.width = t.height = S;
    const tg = t.getContext('2d');
    tg.drawImage(frameImg, fx, 1, fw, fh);
    if (boss) {
      tg.globalCompositeOperation = 'source-atop';
      tg.fillStyle = 'rgba(255,176,40,0.55)';
      tg.fillRect(0, 0, S, S);
      tg.globalCompositeOperation = 'source-over';
    }
    g.drawImage(t, 0, 0);

    // ตราสัญลักษณ์กลางการ์ด: เลขด่านตัวใหญ่อย่างเดียว (ไม่ใส่ตัวอักษรสเตตัส เพราะอักษรไทยตัวแรกมักเป็นสระนำ เช่น เ โ ไ ดูแปลก)
    if (SHOW_ZONE_NUM) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.font = 'bold 34px sans-serif';
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,30,50,.9)';
      g.strokeText(String(info ? info.z : ''), S / 2, S / 2);
      g.fillStyle = boss ? '#fff0b0' : '#ffffff';
      g.fillText(String(info ? info.z : ''), S / 2, S / 2);
    }
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
  const texKey = (it) => (it.kind === 'cardkey' ? 'icon_cardkey' : 'icon_card2_' + it.cid);
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
    if (urlCache[key]) return urlCache[key];
    let u = '';
    try { u = (it.kind === 'cardkey' ? drawKey() : drawCard(it.cid)).toDataURL(); } catch (e) { u = ''; }
    if (it.kind === 'cardkey' || frameReady) urlCache[key] = u;   // ถ้ากรอบยังไม่พร้อม อย่าจำไอคอนสำรองไว้
    return u;
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

  // จัดกระเป๋า: ห้ามรวมการ์ดต่างด่านเป็นกองเดียว
  // sortBag เดิม (enhance.js) จัดกลุ่มของซ้อนกองตาม "ชนิด" การ์ดทุกใบเลยรวมกัน -> ยกการ์ดออกก่อนจัด แล้วใส่กลับแยกตามรหัสการ์ด
  // ใช้ตัวรับ-ส่งค่า (getter/setter) บน prototype: ไม่ว่าไฟล์ไหนจะมาตั้ง sortBag ทีหลัง (แม้โหลดหลังไฟล์นี้) ก็ยังผ่านตัวครอบนี้เสมอ
  (function installSort() {
    let inner = P.sortBag;
    const wrapper = function () {
      const held = [];
      this.bag.forEach((s, i) => { if (s && s.kind === 'card') { held.push(s); this.bag[i] = null; } });
      const r = typeof inner === 'function' ? inner.apply(this, arguments) : undefined;
      held.sort((a, b) => {
        const A = cardInfo(a.cid) || { boss: false, z: 0 }, B = cardInfo(b.cid) || { boss: false, z: 0 };
        return (A.boss - B.boss) || (A.z - B.z);
      });
      held.forEach((c) => {
        const left = stackAdd(this, { kind: 'card', cid: c.cid }, cnt(c));
        if (left > 0) {                          // สำรอง: ใส่ไม่ได้ให้วางช่องว่างช่องแรก ของไม่หาย
          const i = this.bag.findIndex((q) => !q);
          if (i >= 0) this.bag[i] = { kind: 'card', cid: c.cid, count: left };
        }
      });
      sv(this);
      return r;
    };
    Object.defineProperty(P, 'sortBag', {
      configurable: true,
      get: function () { return wrapper; },
      set: function (fn) { inner = fn; },
    });
  })();

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
      '.cd-art{display:block;width:100%;max-height:36vh;object-fit:contain;margin:4px auto 6px;cursor:zoom-in;filter:drop-shadow(0 2px 6px rgba(0,0,0,.7))}',
      '.cs-zoom{background:transparent;border:0;padding:0;max-width:96vw;text-align:center;overflow:visible}',
      '.cs-zoom img{max-width:92vw;max-height:78vh;object-fit:contain;filter:drop-shadow(0 6px 18px rgba(0,0,0,.8))}',
      '.cs-zoom .zt{margin-top:6px;font-size:14px;color:#ffe28a;text-shadow:0 0 4px #000}',
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

  // รูปการ์ดเต็มในหน้ารายละเอียด (แตะเพื่อขยาย) | ยังไม่โหลด/ไม่มีไฟล์ = ไม่แสดง
  function artHTML(info) {
    const id = artIdOf(info);
    if (artState[id] === 2) return '<img class="cd-art" data-zoom="' + id + '" data-zcid="' + info.cid + '" src="' + ART_PATH + id + ART_EXT + '" alt="">';
    loadArt(id, function () { refresh(); });
    return '';
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
      + artHTML(i)
      + '<div class="d-stats"><div><span>' + esc(i.statName) + '</span><span>' + esc(i.valText) + '</span></div></div>'
      + '<div class="d-note">เลือกอุปกรณ์ แล้วแตะช่องการ์ดเพื่อใส่ • ใส่ซ้ำใบเดิมได้ • ขายในตลาดได้</div>'
      + '<div class="d-row"><span>จำนวน</span><span>x' + (it.count || 1) + '</span></div>';
  }

  function modal(build, cls) {
    css();
    const ov = document.createElement('div');
    ov.className = 'cs-ov';
    const pn = document.createElement('div');
    pn.className = 'cs-pn' + (cls ? ' ' + cls : '');
    ov.appendChild(pn);
    const close = () => { if (ov.parentNode) ov.parentNode.removeChild(ov); };
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    build(pn, close);
    document.body.appendChild(ov);
    return close;
  }
  const refresh = () => { if (window.BagWindowRefresh) window.BagWindowRefresh(); };

  // แตะรูปการ์ดเต็ม = ขยายดู (แตะที่ใดก็ได้เพื่อปิด)
  document.addEventListener('click', function (e) {
    const t = e.target;
    if (!t || !t.dataset || !t.dataset.zoom) return;
    const info = cardInfo(t.dataset.zcid);
    modal(function (pn, close) {
      pn.innerHTML = '<img src="' + t.src + '" alt=""><div class="zt">' + (info ? esc(info.name) + ' • ' + esc(info.statName) + ' ' + esc(info.valText) : '') + '</div>';
      pn.addEventListener('click', close);
    }, 'cs-zoom');
  });

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
