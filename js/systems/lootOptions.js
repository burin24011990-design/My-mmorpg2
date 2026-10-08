// ===== หินสุ่มออฟชั่น + ดรอปกล่องสี/หินจากมอนสเตอร์ =====
// โหลดหลัง stats.js และ enhance.js ก่อน main.js
(function () {
  const P = Main.prototype;

  // ---------- ค่าที่ปรับได้ ----------
  // หมายเหตุ: 1 = 100%, 0.01 = 1%, 0.0005 = 0.05%, 0.0001 = 0.01%
  const DROP = {
    optStoneNormal: 0.01,   // มอนทั่วไป ดรอปหินสุ่มออฟ 1%
    optStoneBoss: 0.10,     // บอส ดรอปหินสุ่มออฟ 10%
    goldBoxBoss: 0.05,      // บอสเท่านั้น: กล่องทอง 5%
    redBoxBoss: 0.10,       // บอสเท่านั้น: กล่องแดง 10%
    blueBoxNormal: 0.05,    // กล่องที่ตกจากมอนทั่วไป: 5% เป็นสีฟ้า ที่เหลือสีขาว
  };
  const OPT_TWO_CHANCE = 0.4;                 // โอกาสสุ่มได้ 2 ออฟ (ไม่งั้นได้ 1)
  const CLEAN_DROP = { normal: 0.005, boss: 0.005 };   // โอกาสดรอปหินลบออฟ 0.5% (ทั้งมอนทั่วไปและบอส)
  // หินสุ่มออฟไม่มีเลเวลแล้ว: มี 4 สี (แดง/เขียว/ม่วง/เหลือง)
  // ค่าออฟสุ่มในช่วง [ต่ำสุด, สูงสุด] ของแต่ละสถานะ (แก้ตัวเลขในตาราง OPT_RANGE ได้เลย)
  const OPT_SELL_PRICE = 300;                 // ขายหินสุ่มออฟ 1 เม็ด ได้กี่ทอง
  const OPT_DISMANTLE_YIELD = 8;              // ย่อยหินสุ่มออฟ 1 เม็ด ได้หินตีบวกเท่านี้
  const OPT_SKEW = 1;                         // 1 = สุ่มเท่ากันทั้งช่วง | 2 = ค่าสูงๆ ออกยากขึ้น | 3 = ยากมาก
  const OPT_RANGE = {
    patk: [10, 200], ap: [10, 200], lifesteal: [1, 10], spellvamp: [1, 10],
    hp: [50, 1000], dodge: [1, 15], hpregen: [0.5, 8], pdef: [5, 100], mdef: [5, 100],
    mp: [30, 500], mpregen: [0.5, 8], cdr: [1, 15], mspd: [2, 25],
    crit: [1, 20], critdmg: [5, 100], aspd: [2, 30], ppen: [1, 20], mpen: [1, 20],
  };

  window.optStoneYield = function () { return OPT_DISMANTLE_YIELD; };
  window.optStonePrice = function () { return OPT_SELL_PRICE; };

  // ---------- ตัวช่วยใส่ของซ้อนได้ลงกระเป๋า (คืนจำนวนที่ใส่ไม่ได้) ----------
  function addStack(scene, proto, same, max, n) {
    let left = n;
    scene.bag.forEach(s => {
      if (left > 0 && s && same(s) && s.count < max) {
        const a = Math.min(left, max - s.count);
        s.count += a; left -= a;
      }
    });
    while (left > 0) {
      const idx = scene.findEmptyBagSlot();
      if (idx === -1) break;
      const a = Math.min(left, max);
      scene.bag[idx] = Object.assign({}, proto, { count: a });
      left -= a;
    }
    return left;
  }
  const maxBox = () => (typeof MAX_BOX_STACK !== 'undefined' ? MAX_BOX_STACK : 99);

  function addBox(scene, level, tier, n) {
    return addStack(scene, { kind: 'box', level: level, tier: tier },
      s => s.kind === 'box' && s.level === level && tierOf(s) === tier, maxBox(), n);
  }
  function addCleanStone(scene, n) {
    return addStack(scene, { kind: 'cleanstone' }, s => s.kind === 'cleanstone', MAX_STONE_STACK, n);
  }
  function addOptStone(scene, color, n) {
    return addStack(scene, { kind: 'optstone', color: color },
      s => s.kind === 'optstone' && s.color === color, MAX_STONE_STACK, n);
  }

  // ---------- กล่องที่ตกลงพื้น (ระบบเดิม) -> ใส่สี ขาว/ฟ้า ตอนเก็บ ----------
  const _pickup = P.pickup;
  P.pickup = function (item) {
    if (item.getData('kind') === 'box') {
      const lvl = item.getData('level');
      const tier = item.getData('tier') || (Math.random() < DROP.blueBoxNormal ? 'blue' : 'white');
      const stack = this.bag.find(s => s && s.kind === 'box' && s.level === lvl && tierOf(s) === tier && s.count < maxBox());
      if (stack) stack.count++;
      else this.addItemToBag({ kind: 'box', level: lvl, count: 1, tier: tier });
      this.toastMsg('ได้รับ ' + itemLabel({ kind: 'box', level: lvl, tier: tier, count: 1 }));
      item.destroy();
      return;
    }
    return _pickup.call(this, item);
  };

  // ---------- ดรอปตอนฆ่ามอน: หินสุ่มออฟ (ทุกตัว) + กล่องแดง/ทอง (บอสเท่านั้น) ----------
  // ใส่ตรงเข้ากระเป๋าเลย (ไม่ตกลงพื้น) ถ้ากระเป๋าเต็มจะแจ้งเตือนว่าพลาดรางวัล
  P.rollKillLoot = function (e) {
    const boss = !!e.isBoss, lvl = e.level || 1;

    if (Math.random() < (boss ? DROP.optStoneBoss : DROP.optStoneNormal)) {
      const color = OPT_COLOR_KEYS[Math.floor(Math.random() * OPT_COLOR_KEYS.length)];
      const left = addOptStone(this, color, 1);
      const label = itemLabel({ kind: 'optstone', color: color, count: 1 });
      this.toastMsg(left === 0 ? 'ได้รับ ' + label : 'กระเป๋าเต็ม! พลาด ' + label);
    }

    if (Math.random() < (boss ? CLEAN_DROP.boss : CLEAN_DROP.normal)) {
      const left = addCleanStone(this, 1);
      this.toastMsg(left === 0 ? 'ได้รับ หินลบออฟ' : 'กระเป๋าเต็ม! พลาด หินลบออฟ');
    }

    if (boss) {
      const r = Math.random();
      const tier = r < DROP.goldBoxBoss ? 'gold' : (r < DROP.goldBoxBoss + DROP.redBoxBoss ? 'red' : null);
      if (tier) {
        const left = addBox(this, lvl, tier, 1);
        const label = itemLabel({ kind: 'box', level: lvl, tier: tier, count: 1 });
        this.toastMsg(left === 0 ? '✨ ได้รับ ' + label : 'กระเป๋าเต็ม! พลาด ' + label);
      }
    }
  };

  // ตรวจว่ามอนตายจากดาเมจของผู้เล่น (ห่อ damage ที่ stats.js ห่อไว้อีกชั้น)
  const _dmg = P.damage;
  P.damage = function (e, dmg) {
    const alive = !!(e && e.active);
    if (alive && typeof e.hp === 'number' && e.hp > 0) e._lootDone = false;   // กันมอนที่ถูกรีไซเคิล
    const r = _dmg.call(this, e, dmg);
    if (alive && !e._lootDone && (!e.active || (typeof e.hp === 'number' && e.hp <= 0))) {
      e._lootDone = true;
      this.rollKillLoot(e);
    }
    return r;
  };

  // ---------- สุ่มออฟชั่น ----------
  function rollOptions(stone) {
    const pool = (OPT_COLORS[stone.color] || OPT_COLORS.red).pool.slice();
    const n = Math.random() < OPT_TWO_CHANCE ? 2 : 1;
    const out = [];
    for (let i = 0; i < n && pool.length; i++) {
      const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const r = OPT_RANGE[k] || [1, 5];
      let v = r[0] + (r[1] - r[0]) * Math.pow(Math.random(), OPT_SKEW);
      const d = window.STAT_DEFS[k];
      v = (d && d.fmt === 'int') ? Math.max(1, Math.round(v)) : Math.max(0.1, Math.round(v * 10) / 10);
      out.push({ k: k, v: v });
    }
    return out;
  }
  const optText = o => window.statLine(o.k, o.v);

  // ฝังหินเข้าอุปกรณ์ (src = 'bag' | 'equip') สุ่มใหม่ได้ไม่จำกัด ออฟเดิมจะถูกแทนที่
  P.embedOptStone = function (stoneIdx, src, id) {
    const st = this.bag[stoneIdx];
    const it = src === 'bag' ? this.bag[id] : this.equipment[id];
    if (!st || st.kind !== 'optstone' || !it || it.kind !== 'equip') return false;
    const opts = rollOptions(st);
    st.count -= 1;
    if (st.count <= 0) this.bag[stoneIdx] = null;
    const up = Object.assign({}, it, { opts: opts });
    if (src === 'bag') this.bag[id] = up; else this.equipment[id] = up;
    this.computeAtk();
    this.toastMsg('ฝังหินสำเร็จ! ' + opts.map(optText).join('  '));
    return true;
  };

  // ย่อยหินสุ่มออฟ n ก้อน เป็นหินตีบวก
  P.dismantleOptStones = function (idx, n) {
    const st = this.bag[idx];
    if (!st || st.kind !== 'optstone') return 0;
    const count = st.count || 1;
    n = Math.max(1, Math.min(n || 1, count));
    const total = OPT_DISMANTLE_YIELD * n;
    st.count = count - n;
    if (st.count <= 0) this.bag[idx] = null;
    if (this.stoneRoom() < total) {
      if (!this.bag[idx]) this.bag[idx] = st;
      st.count = count;
      this.toastMsg('กระเป๋าเต็ม ใส่หินไม่พอ');
      return 0;
    }
    this.addStonesToBag(total);
    this.toastMsg('ย่อยหินสุ่มออฟ ' + n + ' ก้อน ได้หินตีบวก ' + total + ' ก้อน');
    return n;
  };

  // ขายหินสุ่มออฟ n ก้อน
  P.sellOptStones = function (idx, n) {
    const st = this.bag[idx];
    if (!st || st.kind !== 'optstone') return 0;
    const count = st.count || 1;
    n = Math.max(1, Math.min(n || 1, count));
    const gold = OPT_SELL_PRICE * n;
    st.count = count - n;
    if (st.count <= 0) this.bag[idx] = null;
    this.stats.gold += gold;
    this.toastMsg('ขายหินสุ่มออฟ ' + n + ' ก้อน ได้ +' + gold + ' ทอง');
    return n;
  };

  // ลบออฟทั้งหมดของอุปกรณ์ด้วยหินลบออฟ 1 เม็ด (เพื่อให้รวมดาวได้)
  P.cleanOpts = function (src, id) {
    const it = src === 'bag' ? this.bag[id] : this.equipment[id];
    if (!it || it.kind !== 'equip' || !(it.opts && it.opts.length)) { this.toastMsg('อุปกรณ์ชิ้นนี้ไม่มีออฟชั่น'); return false; }
    const si = this.bag.findIndex(s => s && s.kind === 'cleanstone');
    if (si === -1) { this.toastMsg('ไม่มีหินลบออฟ'); return false; }
    this.bag[si].count -= 1;
    if (this.bag[si].count <= 0) this.bag[si] = null;
    const up = Object.assign({}, it, { opts: [] });
    if (src === 'bag') this.bag[id] = up; else this.equipment[id] = up;
    this.computeAtk();
    this.toastMsg('ลบออฟสำเร็จ' + ((it.plus || 0) > 0 ? '' : ' รวมดาวได้แล้ว'));
    return true;
  };

  // ---------- ข้อความในหน้ารายละเอียด (bagWindow.js เรียกใช้) ----------
  const hexOf = c => '#' + c.toString(16).padStart(6, '0');

  window.itemExtraInfoHTML = function (s, it) {
    const t = TIER_DEFS[tierOf(it)];
    let h = '<div class="d-row"><span>ระดับสี</span><span style="color:' + hexOf(t.color) + '">'
      + t.name + ' (พลัง x' + t.mult + ')</span></div>';
    const opts = it.opts || [];
    if (opts.length) {
      h += '<div class="d-stats">' + opts.map(o => '<div><span>✦ ' + (window.STAT_DEFS[o.k] ? window.STAT_DEFS[o.k].short : o.k)
        + '</span><span>+' + window.fmtStat(o.k, o.v) + '</span></div>').join('') + '</div>';
    } else {
      h += '<div class="d-row"><span>ออฟชั่น</span><span>- (ฝังหินสุ่มออฟได้)</span></div>';
    }
    return h;
  };

  // ปุ่มฝังหินของทุกกองในกระเป๋า (เรียงสี/เลเวล) + ปุ่มลบออฟ
  window.itemEmbedButtonsHTML = function (s, it) {
    const stacks = [];
    s.bag.forEach((st, i) => { if (st && st.kind === 'optstone') stacks.push({ st: st, i: i }); });
    stacks.sort((a, b) => OPT_COLOR_KEYS.indexOf(a.st.color) - OPT_COLOR_KEYS.indexOf(b.st.color));
    let h = '';
    stacks.forEach(o => {
      h += '<button class="btn info" data-act="embed" data-id="' + o.i + '">💎 ฝัง ' + OPT_COLORS[o.st.color].name
        + ' ×' + o.st.count + '</button>';
    });
    if (it && it.opts && it.opts.length) {
      let clean = 0;
      s.bag.forEach(st => { if (st && st.kind === 'cleanstone') clean += st.count; });
      h += '<button class="btn danger" data-act="clean-opt"' + (clean ? '' : ' disabled') + '>🧽 ลบออฟ (มีหิน ' + clean + ')</button>';
    }
    return h;
  };

  // ---------- ไอคอนหินสุ่มออฟ (วาดเอง 4 สี) ----------
  function ensureOptTextures(scene) {
    if (!scene.textures) return;
    OPT_COLOR_KEYS.forEach(k => {
      const key = 'icon_opt_' + k;
      if (scene.textures.exists(key)) return;
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const g = c.getContext('2d');
      g.fillStyle = hexOf(OPT_COLORS[k].color);
      g.beginPath(); g.arc(16, 16, 11, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.beginPath(); g.arc(20, 21, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)';
      g.beginPath(); g.arc(12, 11, 4, 0, Math.PI * 2); g.fill();
      scene.textures.addCanvas(key, c);
    });
  }
  function ensureCleanTexture(scene) {
    if (!scene.textures || scene.textures.exists('icon_cleanstone')) return;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#dfe6ee';
    g.beginPath(); g.arc(16, 16, 11, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#6b7686'; g.lineWidth = 2; g.stroke();
    g.strokeStyle = '#c0392b'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(10, 10); g.lineTo(22, 22); g.moveTo(22, 10); g.lineTo(10, 22); g.stroke();
    scene.textures.addCanvas('icon_cleanstone', c);
  }
  const _open = P.openInventory;
  P.openInventory = function () {
    ensureOptTextures(this);
    ensureCleanTexture(this);
    return _open.apply(this, arguments);
  };
})();
