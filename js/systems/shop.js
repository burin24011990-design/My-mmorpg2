// ===== ร้านค้ายา + บัฟชั่วคราว (ไฟล์ใหม่ ไม่แตะระบบเดิม ยกเว้นแก้ save.js 1 บรรทัด) =====
// ยาเก็บในกระเป๋าเป็นไอเทม { kind:'potion', pid, count } ซ้อนได้ -> เซฟ/คลาวด์ทำงานเหมือนไอเทมอื่น
// บัฟเป็นชั่วคราว ไม่เซฟ (รีเฟรชหน้าแล้วหาย)

const POTION_MAX_STACK = 99;
const POTION_USE_CD = 1000;   // ms คูลดาวน์การกินยาฟื้นฟู

// แก้ราคา/ค่าต่างๆ ตรงนี้ได้เลย
// heal: { hp, mp }  |  buff: { stat: 'atk'|'def'|'hp'|'mp', value, sec }
const POTIONS = {
  // heal.hp = เปอร์เซ็นต์ของ Max HP (10 = ฟื้น 10%)
  hp_s: { tab: 'heal', icon: '🧪', color: '#e0413a', name: 'ยาเลือดเล็ก',   price: 20,  desc: 'ฟื้น HP 10%',  heal: { hp: 10 } },
  hp_m: { tab: 'heal', icon: '🧪', color: '#ff6b5a', name: 'ยาเลือดกลาง',   price: 60,  desc: 'ฟื้น HP 20%',  heal: { hp: 20 } },
  hp_l: { tab: 'heal', icon: '🧪', color: '#ff9a8a', name: 'ยาเลือดใหญ่',   price: 160, desc: 'ฟื้น HP 30%',  heal: { hp: 30 } },
  // buff.value = เปอร์เซ็นต์ (10 = +10%)
  b_atk: { tab: 'buff', icon: '⚔️', color: '#e0413a', name: 'ยาพลังโจมตี',  price: 120, desc: 'ATK +10% นาน 60 วิ',    buff: { stat: 'atk', value: 10, sec: 60 } },
  b_def: { tab: 'buff', icon: '🛡️', color: '#c9a227', name: 'ยาเกราะแกร่ง', price: 100, desc: 'DEF +15% นาน 60 วิ',    buff: { stat: 'def', value: 15, sec: 60 } },
  b_hp:  { tab: 'buff', icon: '❤️', color: '#3fbf6f', name: 'ยาเลือดเพิ่ม',  price: 100, desc: 'Max HP +20% นาน 60 วิ', buff: { stat: 'hp',  value: 20, sec: 60 } },
};
const BUFF_LABEL = { atk: 'ATK', def: 'DEF', hp: 'Max HP' };

(function () {
  const buffs = {};          // pid -> { until }
  let scene = null;
  let tab = 'heal';
  let lastUse = 0;
  let panel, quick, quickR;
  let lastSig = '';
  const HP_PICK_KEY = 'shop_hp_pick_v1';
  const HP_ORDER = ['hp_s', 'hp_m', 'hp_l'];   // ลำดับสลับเมื่อกดค้าง: เล็ก -> กลาง -> ใหญ่
  const LONG_PRESS_MS = 500;
  let hpPick = null;                            // null = อัตโนมัติ (ใช้ตัวใหญ่สุดที่มี)
  try { const v = localStorage.getItem(HP_PICK_KEY); if (HP_ORDER.indexOf(v) !== -1) hpPick = v; } catch (e) {}

  const now = () => Date.now();
  const toast = m => { if (scene && scene.toastMsg) scene.toastMsg(m); };

  // ---------- ยาในกระเป๋า ----------
  function countPotion(pid) {
    let n = 0;
    if (scene && scene.bag) scene.bag.forEach(s => { if (s && s.kind === 'potion' && s.pid === pid) n += s.count; });
    return n;
  }
  function canAddPotion(pid) {
    return scene.bag.some(s => s && s.kind === 'potion' && s.pid === pid && s.count < POTION_MAX_STACK) ||
           scene.bag.some(s => s === null);
  }
  function addPotion(pid, n) {
    let left = n;
    scene.bag.forEach(s => {
      if (left > 0 && s && s.kind === 'potion' && s.pid === pid && s.count < POTION_MAX_STACK) {
        const a = Math.min(left, POTION_MAX_STACK - s.count); s.count += a; left -= a;
      }
    });
    while (left > 0) {
      const i = scene.bag.findIndex(s => s === null);
      if (i === -1) break;
      const a = Math.min(left, POTION_MAX_STACK);
      scene.bag[i] = { kind: 'potion', pid, count: a }; left -= a;
    }
    return left === 0;
  }
  function takePotion(pid) {
    for (let i = 0; i < scene.bag.length; i++) {
      const s = scene.bag[i];
      if (s && s.kind === 'potion' && s.pid === pid) {
        s.count--; if (s.count <= 0) scene.bag[i] = null; return true;
      }
    }
    return false;
  }

  // ---------- ซื้อ / ใช้ ----------
  function buy(pid) {
    const p = POTIONS[pid]; if (!scene || !p) return;
    if (scene.stats.gold < p.price) { toast('ทองไม่พอ'); return; }
    if (!canAddPotion(pid)) { toast('กระเป๋าเต็ม'); return; }
    scene.stats.gold -= p.price;
    addPotion(pid, 1);
    toast('ซื้อ ' + p.name + ' (มี ' + countPotion(pid) + ')');
    if (scene.saveSoon) scene.saveSoon();
    render();
  }

  function use(pid) {
    const p = POTIONS[pid]; if (!scene || !p) return;
    if (countPotion(pid) <= 0) { toast('ไม่มี ' + p.name); return; }
    const st = scene.stats;
    if (p.heal) {
      if (now() - lastUse < POTION_USE_CD) return;
      if (st.hp >= scene.maxHp()) { toast('HP เต็มอยู่แล้ว'); return; }
      takePotion(pid); lastUse = now();
      const amt = Math.ceil(scene.maxHp() * p.heal.hp / 100);
      st.hp = Math.min(scene.maxHp(), st.hp + amt);
      toast(p.name + ' +' + amt + ' HP');
    } else if (p.buff) {
      takePotion(pid);
      buffs[pid] = { until: now() + p.buff.sec * 1000 };
      scene.computeAtk();
      toast('บัฟ: ' + p.desc);
    }
    if (scene.saveSoon) scene.saveSoon();
    render();
  }

  // ---------- รวมค่าบัฟ ----------
  function activeBuffTotals() {
    const t = { atk: 0, def: 0, hp: 0 };   // รวมเป็น % ต่อสถานะ
    const n = now();
    Object.keys(buffs).forEach(pid => {
      if (buffs[pid].until > n) { const b = POTIONS[pid].buff; t[b.stat] += b.value; }
    });
    return t;
  }

  // ---------- เชื่อมเข้ากับระบบเดิม (ไม่แก้ไฟล์เดิม) ----------
  // 1) เอาค่าบัฟไปบวกใน computeAtk
  const _computeAtk = Main.prototype.computeAtk;
  Main.prototype.computeAtk = function () {
    _computeAtk.apply(this, arguments);
    const b = activeBuffTotals();
    // คิด % จากค่าก่อนบัฟ (ค่าฐาน + อุปกรณ์)
    const baseHp = this.stats.maxHp + this.equipHpBonus;
    this.atk += Math.round(this.atk * b.atk / 100);
    if (b.def > 0) this.equipDefBonus += Math.max(1, Math.round(this.equipDefBonus * b.def / 100));
    this.equipHpBonus += Math.round(baseHp * b.hp / 100);
  };

  // 2) จับ scene + สร้างไอคอนยา (ครั้งแรกที่โหลดด่าน)
  const _loadStage = Main.prototype.loadStage;
  Main.prototype.loadStage = function () {
    scene = this; window.__mainScene = this;
    makeIcons(this);
    initUI();
    return _loadStage.apply(this, arguments);
  };

  // ---------- ปุ่มร้านค้าในแถบเมนูบนขวา (แถบนี้วาดด้วย Phaser ใน topbar.js) ----------
  const _makeTopIcons = Main.prototype.makeTopIcons;
  Main.prototype.makeTopIcons = function () {
    _makeTopIcons.apply(this, arguments);
    if (this.textures.exists('tb_shop')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x6b4423); g.fillRect(15, 8, 10, 7);                 // ปากถุง
    g.fillStyle(0x8f5a28); g.fillRoundedRect(8, 14, 24, 22, 9);      // ตัวถุง
    g.fillStyle(0xb5763a); g.fillRoundedRect(8, 14, 24, 12, 7);
    g.fillStyle(0xf2c94c); g.fillCircle(20, 26, 6.5);                // เหรียญ
    g.fillStyle(0xc9a227); g.fillCircle(20, 26, 3.5);
    g.lineStyle(2, 0x4a2c12); g.strokeRoundedRect(8, 14, 24, 22, 9);
    g.generateTexture('tb_shop', 40, 40); g.destroy();
  };

  // จัดแถบใหม่ให้มี 8 ปุ่ม (เหมือนของเดิม + ร้านค้าท้ายแถว)
  Main.prototype.setupTopBar = function () {
    this.makeTopIcons();
    const items = [
      ['tb_bag',    'กระเป๋า',    0x2a4a2a, () => this.openInventory('bag'),   'bagBtn'],
      ['tb_scroll', 'สกิล',       0x2a2a4a, () => this.openSkillBook(),        'bookBtn'],
      ['tb_bot',    'บอท: ปิด',   0x4a3a2a, () => this.toggleAuto(),           'autoBtn'],
      ['tb_gear',   'ตั้งค่าบอท', 0x4a3a4a, () => this.openBotPanel(),         'botCfgBtn'],
      ['tb_shield', 'อุปกรณ์',    0x2a2a5a, () => this.openInventory('equip'), 'equipBtn'],
      ['tb_map',    'เลือกด่าน',  0x2a4a5a, () => this.openStageSelect(),      'stageBtn'],
      ['tb_chart',  'สเตตัส',     0x3a2a4a, () => this.openStatusPanel(),      'statusBtn'],
      ['tb_shop',   'ร้านค้า',    0x5a3a1a, () => toggle(),                    'shopBtn'],
    ];
    let x = W - 12 - (items.length * TB.w + (items.length - 1) * TB.gap);
    items.forEach(it => {
      this[it[4]] = this.makeTopBtn(x, TB.top, TB.w, TB.h, it[0], it[1], it[2], it[3]);
      x += TB.w + TB.gap;
    });
  };

  // 3) ให้กระเป๋า/ช่องไอเทมรู้จัก kind:'potion'
  const _itemLabel = itemLabel;
  itemLabel = function (it) {
    if (it && it.kind === 'potion') { const p = POTIONS[it.pid]; return (p ? p.name : 'ยา') + (it.count > 1 ? '  x' + it.count : ''); }
    return _itemLabel(it);
  };
  const _iconKey = iconKeyForItem;
  iconKeyForItem = function (it) {
    if (it && it.kind === 'potion') return 'icon_potion_' + it.pid;
    return _iconKey(it);
  };
  const _rarity = rarityColor;
  rarityColor = function (it) {
    if (it && it.kind === 'potion') { const p = POTIONS[it.pid]; return p ? parseInt(p.color.slice(1), 16) : 0x9a9a9a; }
    return _rarity(it);
  };

  function makeIcons(sc) {
    Object.keys(POTIONS).forEach(pid => {
      const key = 'icon_potion_' + pid;
      if (sc.textures.exists(key)) return;
      const c = parseInt(POTIONS[pid].color.slice(1), 16);
      const g = sc.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xcccccc, 1); g.fillRect(12, 3, 8, 5);          // จุกขวด
      g.fillStyle(0x222222, 1); g.fillRect(10, 8, 12, 3);         // คอ
      g.fillStyle(c, 1);       g.fillRoundedRect(6, 11, 20, 18, 5); // ตัวขวด
      g.fillStyle(0xffffff, 0.45); g.fillRect(10, 14, 3, 9);      // เงา
      g.generateTexture(key, 32, 32); g.destroy();
    });
  }

  // ---------- ช่องยาด่วนแนวตั้ง (ใต้มินิแมพฝั่งซ้าย): ยา HP + บัฟ ATK / DEF / Max HP ----------
  const QSLOTS = [
    { ids: ['hp_l', 'hp_m', 'hp_s'], lab: 'HP',  tab: 'heal', cycle: true },   // กดค้างเพื่อสลับขนาดขวด
    { ids: ['b_atk'],                lab: 'ATK', tab: 'buff' },
    { ids: ['b_def'],                lab: 'DEF', tab: 'buff' },
    { ids: ['b_hp'],                 lab: 'HP+', tab: 'buff' },
  ];
  const qslots = [];
  const BOTTLE = '<svg viewBox="0 0 32 32"><rect x="12" y="3" width="8" height="5" fill="#cfcfcf"/>' +
    '<rect x="10" y="8" width="12" height="3" fill="#2a2a2a"/>' +
    '<rect x="6" y="11" width="20" height="18" rx="5" style="fill:var(--pc)"/>' +
    '<rect x="10" y="14" width="3" height="9" fill="#fff" opacity=".45"/></svg>';

  function cycleHp(q) {
    const next = HP_ORDER[(HP_ORDER.indexOf(q.id) + 1) % HP_ORDER.length];
    hpPick = next;
    try { localStorage.setItem(HP_PICK_KEY, next); } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) {}
    const p = POTIONS[next];
    toast('เลือก ' + p.name + ' (' + p.desc + ')' + (countPotion(next) ? '' : ' - ยังไม่มี'));
    updateQuick();
  }

  function buildQuick() {
    QSLOTS.forEach(d => {
      const el = document.createElement('button');
      el.className = 'qs';
      el.innerHTML = '<i class="qs-fill"></i>' + BOTTLE + '<span class="qs-lab">' + d.lab + '</span>' +
                     '<b class="qs-cnt"></b><em class="qs-time"></em>';
      const q = { el, d, id: d.ids[0], has: false, longFired: false,
        fill: el.querySelector('.qs-fill'), cnt: el.querySelector('.qs-cnt'),
        time: el.querySelector('.qs-time'), lab: el.querySelector('.qs-lab') };

      // กดค้างที่ช่อง HP = สลับขนาดขวด
      if (d.cycle) {
        let timer = null;
        const stop = () => { clearTimeout(timer); timer = null; el.classList.remove('hold'); };
        el.addEventListener('pointerdown', () => {
          q.longFired = false; stop();
          el.classList.add('hold');
          timer = setTimeout(() => { timer = null; q.longFired = true; el.classList.remove('hold'); cycleHp(q); }, LONG_PRESS_MS);
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, stop));
        el.addEventListener('contextmenu', e => e.preventDefault());   // กันเมนูค้างของมือถือ
      }

      el.addEventListener('click', () => {
        if (q.longFired) { q.longFired = false; return; }              // กดค้างเสร็จแล้ว ไม่นับเป็นการแตะ
        if (q.has) {
          const before = lastUse;
          use(q.id);
          if (lastUse !== before) {            // กินยาฟื้นฟูสำเร็จ -> เล่นแอนิเมชันคูลดาวน์
            el.style.setProperty('--cd', POTION_USE_CD + 'ms');
            el.classList.remove('cd'); void el.offsetWidth; el.classList.add('cd');
          }
          updateQuick();
        } else { tab = d.tab; toggle(true); }   // ช่องว่าง = เปิดร้านที่แท็บนั้น
      });
      (d.cycle ? quickR : quick).appendChild(el);
      qslots.push(q);
    });
  }

  function updateQuick() {
    const n = now();
    qslots.forEach(q => {
      const d = q.d;
      let id;
      if (d.cycle) id = hpPick || d.ids.find(x => countPotion(x) > 0) || 'hp_m';   // เลือกเอง หรือ อัตโนมัติ
      else id = d.ids[0];
      const p = POTIONS[id];
      const have = countPotion(id);
      q.id = id; q.has = have > 0;
      q.el.style.setProperty('--pc', p.color);
      q.el.classList.toggle('empty', !have);
      q.cnt.textContent = have ? have : '+';
      q.lab.textContent = d.cycle ? 'HP ' + p.heal.hp + '%' : d.lab;
      const b = p.buff && buffs[id];
      const left = b ? (b.until - n) / 1000 : 0;
      q.el.classList.toggle('on', left > 0);
      q.fill.style.height = left > 0 ? Math.min(100, left / p.buff.sec * 100) + '%' : '0';
      q.time.textContent = left > 0 ? Math.ceil(left) : '';
    });
  }

  // วางช่องให้ตรงกับกรอบเกม (ใต้มินิแมพ) ไม่ว่าจอจะมีขอบดำเท่าไร
  function layoutQuick() {
    const cv = document.querySelector('canvas');
    if (!cv || !quick) return;
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    const sz = Math.max(34, Math.min(52, r.height * 0.1));
    quick.style.setProperty('--qs', sz + 'px');
    quick.style.left = (r.left + 8) + 'px';
    quick.style.top = (r.top + r.height * 0.47) + 'px';
    if (quickR) {
      quickR.style.setProperty('--qs', sz + 'px');
      quickR.style.right = (window.innerWidth - r.right + 14) + 'px';
      quickR.style.top = (r.top + r.height * 0.27) + 'px';   // เหนือปุ่ม ULTI / สกิล
    }
  }

  // ---------- UI ----------
  function initUI() {
    if (panel) return;

    quick = document.createElement('div'); quick.id = 'potion-quick';
    document.body.appendChild(quick);
    quickR = document.createElement('div'); quickR.id = 'potion-quick-r';
    document.body.appendChild(quickR);
    buildQuick();
    window.addEventListener('resize', layoutQuick);

    panel = document.createElement('div'); panel.id = 'shop-panel'; panel.hidden = true;
    document.body.appendChild(panel);
    panel.addEventListener('click', e => {
      const t = e.target.closest('[data-act]'); if (!t) return;
      const a = t.dataset.act, id = t.dataset.id;
      if (a === 'close') toggle(false);
      else if (a === 'tab') { tab = id; render(); }
      else if (a === 'buy') buy(id);
      else if (a === 'use') use(id);
    });

    setInterval(tick, 500);
    tick();
  }

  function toggle(force) {
    if (!panel) return;
    panel.hidden = force === undefined ? !panel.hidden : !force;
    if (!panel.hidden) render();
  }

  function render() {
    if (!panel || panel.hidden || !scene) return;
    const rows = Object.keys(POTIONS).filter(id => POTIONS[id].tab === tab).map(id => {
      const p = POTIONS[id], own = countPotion(id), afford = scene.stats.gold >= p.price;
      return '<div class="sp-row">' +
        '<div class="sp-ico" style="border-color:' + p.color + '">' + p.icon + '</div>' +
        '<div class="sp-info"><b>' + p.name + '</b><small>' + p.desc + '</small><small>มี ' + own + ' ชิ้น</small></div>' +
        '<div class="sp-btns">' +
          '<button class="sp-buy' + (afford ? '' : ' off') + '" data-act="buy" data-id="' + id + '">ซื้อ<br>' + p.price + '💰</button>' +
          '<button class="sp-use' + (own ? '' : ' off') + '" data-act="use" data-id="' + id + '">ใช้</button>' +
        '</div></div>';
    }).join('');
    panel.innerHTML =
      '<div class="sp-head"><span>🛒 ร้านค้า</span><span class="sp-gold">💰 ' + scene.stats.gold + '</span>' +
      '<button data-act="close">✕</button></div>' +
      '<div class="sp-tabs">' +
        '<button class="' + (tab === 'heal' ? 'on' : '') + '" data-act="tab" data-id="heal">ยาฟื้นฟู</button>' +
        '<button class="' + (tab === 'buff' ? 'on' : '') + '" data-act="tab" data-id="buff">ยาบัฟสถานะ</button>' +
      '</div><div class="sp-list">' + rows + '</div>';
  }

  // ทำงานทุก 0.5 วิ: ลบบัฟหมดเวลา, อัปเดตแถบบัฟ/ปุ่มกินยาด่วน
  function tick() {
    if (!scene || !scene.stats) return;
    const n = now(); let expired = false;
    Object.keys(buffs).forEach(pid => { if (buffs[pid].until <= n) { delete buffs[pid]; expired = true; } });
    if (expired) { scene.computeAtk(); toast('บัฟหมดเวลา'); }

    layoutQuick();
    updateQuick();

    if (!panel.hidden) {
      const sig = scene.stats.gold + '|' + Object.keys(POTIONS).map(countPotion).join(',');
      if (sig !== lastSig) { lastSig = sig; render(); }
    }
  }
})();
