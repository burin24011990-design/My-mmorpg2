// ===== ระบบจุติ (Rebirth) =====
// เลเวล 90 แล้วจุติ: เลเวลกลับเป็น 1 | จุติสูงสุด 24 ขั้น
//  - EXP ที่ต้องใช้ = ค่าเดิม x BASE_EXP_MULT(2) x (จุติ+1)   ไม่จุติ = x2, จุติ1 = x4, จุติ2 = x6, ... จุติ24 = x50
//  - ค่าสถานะหลัก x (จุติ+1)          HP/MP/โจมตี/พลังเวท/เกราะ/ฟื้นเลือด-มานา (ค่า % อย่างคริ/ดูดเลือด ไม่คูณ)
//  - ของที่ใช้จุติขั้น N: หินสุ่มออฟ 4 สี สีละ N ก้อน + หินลบออฟ N ก้อน + เงิน N ล้าน
// อุปกรณ์/กระเป๋า/สกิล/ทอง(ส่วนที่เหลือ) เก็บไว้ครบ | ระดับจุติเซฟไปกับ stats.rebirth (เซฟเครื่อง + คลาวด์)
// โหลดหลัง save.js / stats.js / lootOptions.js / shop.js / town.js และก่อน main.js
(function () {
  const P = Main.prototype;

  // ---------- ค่าที่ปรับได้ ----------
  const MAX_REBIRTH = 24;
  const BASE_EXP_MULT = 2;                       // EXP ที่ต้องใช้เลเวลอัพของทุกคน x เท่านี้ (ก่อนคูณจุติ) | ปรับตรงนี้
  const GOLD_PER_STEP = 1000000;                 // เงินต่อขั้น (ขั้น N ใช้ N x ค่านี้)
  const STONES_PER_STEP = 1;                     // หินแต่ละชนิดต่อขั้น (ขั้น N ใช้ N x ค่านี้)
  const RESET = { maxHp: 100, maxMp: 50, baseAtk: 10 };   // ค่าตอนเลเวล 1 (เท่า initPlayerState)
  const MULT_KEYS = ['hp', 'mp', 'patk', 'ap', 'pdef', 'mdef', 'hpregen', 'mpregen'];   // สเตตัสที่คูณตามจุติ

  let scene = null;
  const rb = sc => Math.max(0, Math.min(MAX_REBIRTH, Math.floor((sc && sc.stats && sc.stats.rebirth) || 0)));
  const fmt = n => Number(n).toLocaleString();

  // ---------- EXP ยากขึ้นตามจุติ ----------
  const _expNeeded = levelExpNeeded;
  levelExpNeeded = function (level) {
    return Math.floor(_expNeeded(level) * BASE_EXP_MULT * (rb(window.__mainScene || scene) + 1));
  };

  // ---------- ค่าสถานะคูณตามจุติ ----------
  const _recalc = P.recalcStats;
  P.recalcStats = function () {
    const out = _recalc.apply(this, arguments);
    const r = rb(this);
    if (r > 0) {
      const m = r + 1;
      MULT_KEYS.forEach(k => { if (out[k]) out[k] *= m; });
      const st = this.stats || {};
      this.equipHpBonus = out.hp - (st.maxHp || 0);
      this.equipMpBonus = out.mp - (st.maxMp || 0);
    }
    return out;
  };

  // ---------- โหลดเซฟ: อ่านระดับจุติกลับมา (save.js คืนเฉพาะค่าที่ระบุไว้) ----------
  const _loadGame = P.loadGame;
  P.loadGame = function () {
    const res = _loadGame.apply(this, arguments);
    if (res === null) return res;
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      const r = d && d.stats ? Number(d.stats.rebirth) : 0;
      this.stats.rebirth = Number.isFinite(r) ? Math.max(0, Math.min(MAX_REBIRTH, Math.floor(r))) : 0;
      this.stats.expNext = levelExpNeeded(this.stats.level);
      this.computeAtk();
      if (!(this.stats.hp > 0)) this.stats.hp = this.maxHp();
      // ด่านจุติเช็กได้หลังรู้ขั้นจุติแล้วเท่านั้น (save.js เช็กก่อนหน้านี้ จึงเด้งกลับด่าน 1)
      const si = d && Number.isInteger(d.stageIdx) ? d.stageIdx : -1;
      if (ZONES[si] && this.stats.level >= ZONES[si].reqLv) return si;
    } catch (e) { console.warn('[rebirth] โหลดระดับจุติไม่สำเร็จ', e); }
    return res;
  };

  // ---------- ของในกระเป๋า ----------
  const isStone = (s, color) => s && s.kind === 'optstone' && s.color === color;
  const isClean = s => s && s.kind === 'cleanstone';
  function countBag(pred) {
    let n = 0;
    scene.bag.forEach(s => { if (pred(s)) n += s.count || 0; });
    return n;
  }
  function takeBag(pred, n) {
    for (let i = 0; i < scene.bag.length && n > 0; i++) {
      const s = scene.bag[i];
      if (!pred(s)) continue;
      const t = Math.min(n, s.count);
      s.count -= t; n -= t;
      if (s.count <= 0) scene.bag[i] = null;
    }
  }

  // รายการของที่ต้องใช้สำหรับจุติขั้นที่ n
  function needs(n) {
    const list = OPT_COLOR_KEYS.map(k => ({
      label: 'หินสุ่มออฟ' + OPT_COLORS[k].name,
      have: countBag(s => isStone(s, k)), need: n * STONES_PER_STEP,
      take: () => takeBag(s => isStone(s, k), n * STONES_PER_STEP),
    }));
    list.push({
      label: 'หินลบออฟ', have: countBag(isClean), need: n * STONES_PER_STEP,
      take: () => takeBag(isClean, n * STONES_PER_STEP),
    });
    list.push({
      label: 'เงิน', have: scene.stats.gold, need: n * GOLD_PER_STEP, money: true,
      take: () => { scene.stats.gold -= n * GOLD_PER_STEP; },
    });
    return list;
  }

  // ---------- ทำการจุติ ----------
  P.doRebirth = function () {
    const st = this.stats, cur = rb(this);
    if (cur >= MAX_REBIRTH) { this.toastMsg('จุติสูงสุดแล้ว'); return false; }
    if (st.level < LEVEL_CAP) { this.toastMsg('ต้องเลเวล ' + LEVEL_CAP + ' ก่อนจุติ'); return false; }
    const n = cur + 1, list = needs(n);
    if (list.some(r => r.have < r.need)) { this.toastMsg('ของไม่พอสำหรับจุติขั้น ' + n); return false; }

    list.forEach(r => r.take());
    st.rebirth = n;
    st.level = 1; st.exp = 0;
    st.maxHp = RESET.maxHp; st.maxMp = RESET.maxMp; st.baseAtk = RESET.baseAtk;
    st.expNext = levelExpNeeded(1);
    this.computeAtk();
    st.hp = this.maxHp(); st.mp = this.maxMp();
    this.loadStage(0);                       // กลับด่านแรก (เลเวล 1 เข้าด่านสูงไม่ได้)
    this.toastMsg('✨ จุติขั้น ' + n + ' สำเร็จ! ค่าสถานะ x' + (n + 1) + ' • EXP ยากขึ้น x' + (n + 1));
    this.saveSoon();
    return true;
  };

  // ---------- หน้าต่างจุติ (DOM) ----------
  let overlay = null;
  function closeUI() { if (overlay) { overlay.remove(); overlay = null; } }

  function openUI() {
    if (!scene || !scene.stats) return;
    closeUI();
    const cur = rb(scene), n = cur + 1, maxed = cur >= MAX_REBIRTH;
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,.6);font-family:Mitr,sans-serif;touch-action:manipulation';
    const card = document.createElement('div');
    card.style.cssText = 'width:min(480px,92vw);max-height:92vh;overflow:auto;background:#26090f;border:2px solid #ffd45c;' +
      'border-radius:14px;padding:12px 14px;color:#fff;box-shadow:0 8px 30px #000a';
    const add = (txt, css) => { const d = document.createElement('div'); d.style.cssText = css || ''; d.textContent = txt; card.appendChild(d); return d; };

    add('✨ จุติ', 'font-size:20px;color:#ffe28a;text-align:center;margin-bottom:6px');
    add('ขั้นจุติปัจจุบัน: ' + cur + ' / ' + MAX_REBIRTH + '  (ค่าสถานะ x' + (cur + 1) + ' • EXP x' + (cur + 1) + ')',
      'text-align:center;font-size:14px;color:#c9b27a;margin-bottom:8px');

    if (maxed) {
      add('จุติสูงสุดแล้ว 🎉', 'text-align:center;font-size:16px;padding:14px');
    } else {
      add('จุติขั้น ' + n + ': เลเวลกลับเป็น 1 • ค่าสถานะ x' + (n + 1) + ' • EXP ที่ต้องใช้ x' + (n + 1),
        'text-align:center;font-size:13px;margin-bottom:8px');
      const lvOk = scene.stats.level >= LEVEL_CAP;
      const rows = [{ label: 'เลเวล', have: scene.stats.level, need: LEVEL_CAP }].concat(needs(n));
      let all = true;
      rows.forEach(r => {
        const ok = r.have >= r.need; if (!ok) all = false;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;padding:6px 10px;margin-bottom:4px;border-radius:8px;font-size:14px;background:' + (ok ? '#1f3a24' : '#3a1620');
        const a = document.createElement('span'); a.textContent = r.label;
        const b = document.createElement('span');
        b.style.cssText = 'font-weight:600;color:' + (ok ? '#9adf9a' : '#ff9a9a');
        b.textContent = fmt(r.have) + ' / ' + fmt(r.need);
        row.append(a, b); card.appendChild(row);
      });
      add('อุปกรณ์ กระเป๋า และสกิล เก็บไว้ครบ | ของที่ใช้จะถูกหักทันที', 'font-size:11px;color:#c9b27a;text-align:center;margin:6px 0');
      const go = document.createElement('button');
      go.textContent = all ? '✨ ยืนยันจุติขั้น ' + n : (lvOk ? 'ของยังไม่ครบ' : 'ต้องเลเวล ' + LEVEL_CAP + ' ก่อน');
      go.disabled = !all;
      go.style.cssText = 'width:100%;font-family:inherit;font-size:16px;padding:9px;border-radius:10px;margin-top:4px;' +
        'border:2px solid #ffd45c;cursor:' + (all ? 'pointer' : 'default') + ';color:' + (all ? '#26090f' : '#888') +
        ';background:' + (all ? '#ffd45c' : '#3a3a3a');
      go.addEventListener('click', () => { if (scene.doRebirth()) closeUI(); else openUI(); });
      card.appendChild(go);
    }
    const close = document.createElement('button');
    close.textContent = 'ปิด';
    close.style.cssText = 'width:100%;font-family:inherit;font-size:14px;padding:7px;border-radius:10px;margin-top:8px;' +
      'border:2px solid #ffd45c;color:#ffe28a;background:#26090f;cursor:pointer';
    close.addEventListener('click', closeUI);
    card.appendChild(close);
    overlay.appendChild(card);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeUI(); });
    ['pointerdown', 'touchstart', 'mousedown'].forEach(ev => overlay.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    document.body.appendChild(overlay);
  }

  // ---------- ปุ่ม "จุติ" ข้างปุ่มเมือง/แชนเนล (ใช้ระบบจัดปุ่มของ town.js) ----------
  function ensureBtn() {
    if (document.getElementById('btn-rebirth')) return;
    const b = document.createElement('button');
    b.id = 'btn-rebirth';
    if (typeof hudBtnFill === 'function' && typeof HUD_BTN_IDS !== 'undefined') {
      hudBtnFill(b, '✨', 'จุติ');
      HUD_BTN_IDS.push({ id: 'btn-rebirth', color: '#5a2a6a' });
    } else {
      b.textContent = '✨ จุติ';
      b.style.cssText = 'position:fixed;left:250px;top:8px;z-index:9000';
    }
    b.addEventListener('click', openUI);
    document.body.appendChild(b);
    try { if (typeof hudBtnLayout === 'function') hudBtnLayout(); } catch (e) { /* ignore */ }
  }

  const _loadStage = P.loadStage;
  P.loadStage = function () {
    scene = this;
    ensureBtn();
    return _loadStage.apply(this, arguments);
  };

  // ---------- แสดงขั้นจุติบน HUD ----------
  const _updateHud = P.updateHud;
  P.updateHud = function () {
    _updateHud.apply(this, arguments);
    const r = rb(this);
    if (r > 0 && this.hudNameText) this.hudNameText.setText('จุติ ' + r + '  Lv.' + this.stats.level);
  };

  // ---------- ด่านจุติ: มอนแรงขึ้น + EXP/ทองคูณ (ค่าตั้งใน zones.js) ----------
  // มอนเกิดใหม่ทุกชนิด (ธรรมดา/ยิงไกล/บอส/Epic) คูณ HP และดาเมจตาม hpMul / dmgMul ของด่าน
  ['spawnEnemyInZone', 'spawnBoss', 'spawnEpic'].forEach(function (name) {
    const orig = P[name];
    if (typeof orig !== 'function') return;
    P[name] = function (zi) {
      const e = orig.apply(this, arguments), z = ZONES[zi];
      if (e && z && z.hpMul) {
        e.hp = e.hp * z.hpMul; e.maxHp = e.hp;
        e.dmg = Math.round((e.dmg || 0) * (z.dmgMul || 1));
      }
      return e;
    };
  });

  // EXP และทองในด่านจุติคูณตาม expMul / goldMul (การได้ EXP ทั้งหมดเกิดในด่านที่ผู้เล่นอยู่)
  const _gainExp = P.gainExp;
  P.gainExp = function (n) {
    const z = ZONES[this.stageIdx || 0];
    return _gainExp.call(this, z && z.expMul ? n * z.expMul : n);
  };
  const _dropLoot = P.dropLoot;
  P.dropLoot = function () {
    const g0 = this.stats.gold;
    const r = _dropLoot.apply(this, arguments);
    const z = ZONES[this.stageIdx || 0];
    if (z && z.goldMul > 1) {
      const gain = this.stats.gold - g0;
      if (gain > 0) this.stats.gold += Math.round(gain * (z.goldMul - 1));
    }
    return r;
  };

  // หน้าตา/ชื่อมอน: ด่านจุติยืมของด่านเดิมตาม z.look (monsterDefs.js มีข้อมูลแค่ 9 ด่านแรก)
  try {
    const _gmd = getMonsterDef;
    getMonsterDef = function (zi, kind) {
      const z = ZONES[zi];
      return _gmd(z && z.look !== undefined ? z.look : zi, kind);
    };
  } catch (e) { console.warn('[rebirth] ครอบ getMonsterDef ไม่ได้ (ส่ง monsterDefs.js มาตรวจ)', e); }

  // ---------- แสดงในหน้าสเตตัส (ถ้าระบบแผงรองรับ) ----------
  function installHook() {
    if (!window.PixelPanels || !PixelPanels.addDataHook) return false;
    PixelPanels.addDataHook(function (d) {
      const sc = window.__mainScene;
      if (!sc || !sc.stats || !d || !d.stats) return d;
      return Object.assign({}, d, { stats: Object.assign({ 'ขั้นจุติ': rb(sc) }, d.stats) });
    });
    return true;
  }
  if (!installHook()) {
    const t = setInterval(function () { if (installHook()) clearInterval(t); }, 200);
  }
})();
