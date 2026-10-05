// brokerExchange.js v3 -- NPC นายหน้า: หินตีบวก + ทอง => สุ่มกล่อง (ฟ้า/แดง/ทอง)
// โหลดหลัง enhance.js และ town.js | ผูกกับ NPC 'trade' เองผ่าน TownHooks.trade
(function () {
  var CFG = {
    baseStones: 200, baseGold: 100000,
    levels: [50, 60, 70, 80, 90],                 // ราคา x2 ทุกขั้น
    rates: [['blue', 70], ['red', 29], ['gold', 1]],
    // ชื่อสี -> ค่า tier จริงของเกม (ดูใน TIER_ORDER ของ items.js) แก้ตรงนี้ถ้าไม่ตรง
    tier: { blue: 'blue', red: 'red', gold: 'gold' },
    colorName: { blue: 'ฟ้า', red: 'แดง', gold: 'ทอง' }
  };

  function cost(i) { var m = Math.pow(2, i); return { stones: CFG.baseStones * m, gold: CFG.baseGold * m }; }

  function roll() {
    var r = Math.random() * 100, acc = 0;
    for (var i = 0; i < CFG.rates.length; i++) { acc += CFG.rates[i][1]; if (r < acc) return CFG.rates[i][0]; }
    return CFG.rates[0][0];
  }

  function boxTier(s) { return (typeof tierOf === 'function') ? tierOf(s) : s.tier; }

  // ใส่กล่อง 1 ใบ (ซ้อนกองเดิมถ้าเวล+tier เดียวกัน) คืน false ถ้าเต็ม
  function giveBox(m, lv, tier) {
    var max = (typeof MAX_BOX_STACK !== 'undefined') ? MAX_BOX_STACK : 99;
    var st = m.bag.find(function (s) { return s && s.kind === 'box' && s.level === lv && boxTier(s) === tier && (s.count || 1) < max; });
    if (st) { st.count = (st.count || 1) + 1; return true; }
    var idx = m.findEmptyBagSlot();
    if (idx === -1) return false;
    m.bag[idx] = { kind: 'box', level: lv, tier: tier, count: 1 };
    return true;
  }

  function exchange(m, i) {
    var c = cost(i), lv = CFG.levels[i];
    if (m.countStones() < c.stones) return { ok: false, msg: 'หินตีบวกไม่พอ (มี ' + m.countStones() + ')' };
    if (m.stats.gold < c.gold) return { ok: false, msg: 'ทองไม่พอ' };
    if (m.findEmptyBagSlot() === -1) return { ok: false, msg: 'กระเป๋าเต็ม เหลือที่ว่างอย่างน้อย 1 ช่อง' };
    var color = roll();
    if (!giveBox(m, lv, CFG.tier[color])) return { ok: false, msg: 'กระเป๋าเต็ม' };
    m.consumeStones(c.stones);
    m.stats.gold -= c.gold;
    if (m.saveSoon) m.saveSoon();
    return { ok: true, msg: '🎁 ได้กล่อง' + CFG.colorName[color] + ' เวล ' + lv + '!', color: color };
  }

  function open(scene) {
    var m = (typeof townMain === 'function') ? townMain(scene) : null;
    if (!m) return;
    if (typeof TIER_ORDER !== 'undefined') {
      Object.keys(CFG.tier).forEach(function (k) {
        if (TIER_ORDER.indexOf(CFG.tier[k]) === -1) console.warn('brokerExchange: tier ไม่ตรงกับ TIER_ORDER:', CFG.tier[k], TIER_ORDER);
      });
    }
    var card = scene.domCard('🔄 นายหน้าแลกกล่อง');
    var info = document.createElement('div');
    info.style.cssText = 'font-size:12px;color:#ccc;margin-bottom:6px';
    info.textContent = 'โอกาส: ฟ้า 70% / แดง 29% / ทอง 1%';
    var have = document.createElement('div');
    have.style.cssText = 'font-size:13px;color:#ffe28a;margin-bottom:6px';
    var res = document.createElement('div');
    res.style.cssText = 'min-height:20px;font-size:15px;margin-bottom:6px';
    function refresh() { have.textContent = 'หินตีบวก ' + m.countStones().toLocaleString() + ' | ทอง ' + Math.floor(m.stats.gold).toLocaleString(); }
    refresh();
    card.append(info, have, res);

    CFG.levels.forEach(function (lv, i) {
      var c = cost(i);
      var b = document.createElement('button');
      b.style.cssText = 'display:block;width:100%;margin:5px 0;padding:10px;border:1px solid #ffd45c;border-radius:8px;background:#3a1219;color:#ffe28a;font:14px Mitr,sans-serif;cursor:pointer';
      b.textContent = 'กล่องเวล ' + lv + ' — หิน ' + c.stones.toLocaleString() + ' + ทอง ' + c.gold.toLocaleString();
      b.addEventListener('click', function () {
        var r = exchange(m, i);
        res.style.color = r.ok ? '#8f8' : '#f88';
        res.textContent = r.msg;
        refresh();
      });
      card.appendChild(b);
    });
    scene.domCloseBtn(card);
  }

  window.TownHooks = window.TownHooks || {};
  window.TownHooks.trade = function (scene) { open(scene); };
  window.BrokerExchange = { open: open, exchange: exchange, cfg: CFG };
})();
