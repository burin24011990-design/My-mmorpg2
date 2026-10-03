// ===== ร้านค้ายา + บัฟชั่วคราว (ไฟล์ใหม่ ไม่แตะระบบเดิม ยกเว้นแก้ save.js 1 บรรทัด) =====
// ยาเก็บในกระเป๋าเป็นไอเทม { kind:'potion', pid, count } ซ้อนได้ -> เซฟ/คลาวด์ทำงานเหมือนไอเทมอื่น
// บัฟเป็นชั่วคราว ไม่เซฟ (รีเฟรชหน้าแล้วหาย)

const POTION_MAX_STACK = 99;
const POTION_USE_CD = 1000;   // ms คูลดาวน์การกินยาฟื้นฟู

// แก้ราคา/ค่าต่างๆ ตรงนี้ได้เลย
// heal: { hp, mp }  |  buff: { stat: 'atk'|'def'|'hp'|'mp', value, sec }
const POTIONS = {
  hp_s: { tab: 'heal', icon: '🧪', color: '#e0413a', name: 'ยาเลือดเล็ก',   price: 20,  desc: 'ฟื้น HP 50',   heal: { hp: 50 } },
  hp_m: { tab: 'heal', icon: '🧪', color: '#ff6b5a', name: 'ยาเลือดกลาง',   price: 60,  desc: 'ฟื้น HP 150',  heal: { hp: 150 } },
  hp_l: { tab: 'heal', icon: '🧪', color: '#ff9a8a', name: 'ยาเลือดใหญ่',   price: 160, desc: 'ฟื้น HP 400',  heal: { hp: 400 } },
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
  let panel, btn, strip, quick;

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
      st.hp = Math.min(scene.maxHp(), st.hp + p.heal.hp);
      toast(p.name + ' ' + p.desc.replace('ฟื้น', '+'));
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

  // ---------- UI ----------
  function initUI() {
    if (panel) return;
    btn = document.createElement('button');
    btn.id = 'shop-btn'; btn.textContent = '🛒';
    btn.addEventListener('click', () => toggle());
    document.body.appendChild(btn);

    quick = document.createElement('div'); quick.id = 'potion-quick';
    document.body.appendChild(quick);

    strip = document.createElement('div'); strip.id = 'buff-strip';
    document.body.appendChild(strip);

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
    quick.addEventListener('click', e => {
      const t = e.target.closest('[data-id]'); if (t) use(t.dataset.id);
    });

    setInterval(tick, 500);
    tick();
  }

  function toggle(force) {
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

    strip.innerHTML = Object.keys(buffs).map(pid => {
      const p = POTIONS[pid], s = Math.ceil((buffs[pid].until - n) / 1000);
      return '<div class="bf" style="border-color:' + p.color + '">' + p.icon + ' ' + BUFF_LABEL[p.buff.stat] + ' +' + p.buff.value + '%' +
             ' <i>' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '</i></div>';
    }).join('');

    // ปุ่มกินยาด่วน: ยา HP ตัวที่มีอยู่ (เลือกใหญ่สุดก่อน)
    const hp = ['hp_l', 'hp_m', 'hp_s'].find(id => countPotion(id) > 0);
    const html = hp
      ? '<button data-id="' + hp + '">' + POTIONS[hp].icon + '<small>' + countPotion(hp) + '</small></button>'
      : '';
    if (quick.innerHTML !== html) quick.innerHTML = html;

    if (!panel.hidden) render();
  }
})();
