// ===== อาชีพคทา (mage) — แก้ความสามารถสกิลของคทาที่ไฟล์นี้ =====
// สกิล 1 สายฟ้า     (mg_bolt) | ยิงสายฟ้าไปข้างหน้าเป็นแนวใหญ่ ติดไฟช็อต + บัพคริติคอลให้ตัวเอง 40% นาน 3 วิ | ลากเลือกทิศได้
// สกิล 2 เวทวาป     (mg_nova) | วาปไปทางที่กำหนด + เพิ่มเกราะชั่วขณะ + รีเจนมานาเพิ่มขึ้นชั่วขณะ | ลากเลือกทิศได้
// สกิล 3 ลูกไฟ      (mg_fire) | วางระเบิดลูกไฟวงกว้างลงพื้น 2 ครั้ง ติดสตั้น | ลากเล็งวางได้
// สกิล 4 ธารน้ำแข็ง (mg_ice)  | วางวงน้ำแข็งลงพื้น ดาเมจ 3 ครั้ง มีโอกาสแช่แข็ง | ลากเล็งวางได้
// อัลติ  ระเบิดมหาเวท         | ชาจพลัง 1 วิ แล้วระเบิดรอบตัววงกว้างมาก รุนแรง ติดแช่แข็ง + ไฟช็อต + เติมมานาเต็ม | คูลดาวน์ 60 วิ
// dmg = ค่าฐาน | range = ระยะ/รัศมี | cd = คูลดาวน์ (มิลลิวินาที) | mp = มานา
// scale = ตัวคูณสเตตัส: ดาเมจ = dmg x เลเวลสกิล + ตัวคูณ x สเตตัส (ap = พลังเวท)
// ** ตัวคูณดาเมจเวท (% ของพลังเวท) แก้ที่ AP_PCT ด้านล่างที่เดียว (1.2 = +120%) **
(function () {
  const Classes = window.Classes;
  if (!Classes) throw new Error('mage.js: ไม่พบ window.Classes -> _shared.js ไม่ทำงาน/โหลดไม่ขึ้น (ดู error ก่อนหน้า)');

  const P = Main.prototype;
  const clamp = Phaser.Math.Clamp;
  const TEST_UNLOCK = true;     // true = ปลดล็อกสกิลเวททันทีเพื่อทดสอบ (ทดสอบเสร็จเปลี่ยนเป็น false ให้ได้จากหนังสือสกิล)
  const MG_IDS = ['mg_fire', 'mg_ice', 'mg_bolt', 'mg_nova'];
  const SHOCK_TICK = 500;       // ไฟช็อตลงดาเมจทุกกี่มิลลิวินาที (dps ต่อวินาทีถูกหารตามนี้)
  const BOSS_CC_MUL = 0.5;      // บอสโดนสตั้น/แช่แข็งสั้นลงครึ่งหนึ่ง (ตั้ง 1 = เท่ามอนทั่วไป)
  const ARMOR_STAT = null;      // ชื่อสเตตัสเกราะใน stats.js (null = เดาอัตโนมัติจาก pdef/def/armor/defense)
  const ARMOR_KEYS = ['pdef', 'def', 'armor', 'defense', 'pdf'];
  const MANA_TICK = 500;        // บัพรีเจนมานาเติมทุกกี่มิลลิวินาที
  const CRIT_MUL = 1.5;         // ตัวคูณดาเมจเมื่อคริ (ใช้เฉพาะกรณี addStatBuff ใช้ไม่ได้ แล้วใช้ระบบคริสำรองในไฟล์นี้)
  const CRIT_STAT = 'crit';     // ชื่อสเตตัสคริใน stats.js (ธนูตรึงขาใช้ 'crit' ค่าเป็น % ตรงๆ เช่น 40 = +40%)
  const CRIT_KEYS = ['crit', 'critRate', 'critChance', 'cri', 'cr'];   // (ไม่ได้ใช้แล้ว เก็บไว้เผื่ออ้างอิง)

  // ตัวคูณดาเมจเวทเป็น % ของพลังเวท (ap) ของแต่ละสกิล: 1.2 = ดาเมจฐาน + 120% ของพลังเวท
  // ธารน้ำแข็งโดน 3 ครั้ง จึงตั้งต่อครั้งต่ำกว่า | เวทวาปไม่มีดาเมจ
  const AP_PCT = { mg_bolt: 1.2, mg_fire: 1.5, mg_ice: 0.8, ulti: 3.0 };

  // ตัวช่วยเขียนข้อความอธิบายสกิล (แต่ละท่อนที่คั่นด้วย ' • ' = 1 บรรทัดในหน้าต่างสกิล)
  const pct = v => Math.round((v || 0) * 100);
  const secs = ms => (Math.round((ms || 0) / 100) / 10) + ' วิ';
  const pw = (def, lv, S) => {
    let v = NaN;
    try { v = Classes.power(def.id, def, lv, S); } catch (e) { v = NaN; }
    return isFinite(v) ? v : def.dmg;
  };

  // ---------- ข้อมูลสกิล (ปรับตัวเลขได้ตรงนี้) ----------
  Classes.basic('mage', { name: 'โจมตี', dmg: 8, range: 380, cd: 700, type: 'proj', class: 'mage' });

  // สกิล 1: สายฟ้าแนวใหญ่ ยาว range กว้าง halfW*2 | ไฟช็อต: ดาเมจ shockMul ของดาเมจสกิล ต่อวินาที นาน shockMs
  // critBuff = บัพโอกาสคริติคอลให้ตัวเองตอนใช้สกิล (0.4 = 40%) นาน critMs มิลลิวินาที
  Classes.skill('mg_bolt', {
    name: 'สายฟ้า', class: 'mage', type: 'mbolt', noInfo: true,
    dmg: 39, range: 380, halfW: 60, cd: 3500, mp: 20, shockMul: 0.25, shockMs: 4000, critBuff: 0.4, critMs: 3000,
  }, {
    scale: { ap: AP_PCT.mg_bolt },
    info: (def, lv, S) => ['ยิงสายฟ้าแนวใหญ่ ยาว ' + def.range + ' กว้าง ' + (def.halfW * 2),
      'ดาเมจ ≈' + pw(def, lv, S) + ' (ฐาน + ' + pct(AP_PCT.mg_bolt) + '% ของพลังเวท)',
      'ไฟช็อต ≈' + Math.round(pw(def, lv, S) * def.shockMul) + '/วิ นาน ' + secs(def.shockMs) + ' (รวม ≈' + Math.round(pw(def, lv, S) * def.shockMul * def.shockMs / 1000) + ')',
      'ตัวเอง: คริติคอล +' + pct(def.critBuff) + '% นาน ' + secs(def.critMs),
      'ลากเลือกทิศได้',
      'คูลดาวน์ ' + Classes.cdText(def, S)].join(' • '),
  });

  // สกิล 2: เวทวาป — วาประยะ range ไปทางที่เลือก | เพิ่มเกราะ armor นาน armorMs มิลลิวินาที
  // รีเจนมานา: mpRegen = ฟื้นมานาเพิ่มต่อวินาที เป็น % ของมานาสูงสุด (0.05 = 5%/วิ) นาน mpRegenMs มิลลิวินาที
  Classes.skill('mg_nova', {
    name: 'เวทวาป', class: 'mage', type: 'mblink', noInfo: true,
    dmg: 0, range: 220, cd: 8000, mp: 16, armor: 25, armorMs: 4000, mpRegen: 0.05, mpRegenMs: 6000,
  }, {
    scale: { ap: 1 },
    info: (def, lv, S) => ['วาปไปทางที่ลาก ระยะ ' + def.range,
      'เกราะ +' + def.armor + ' นาน ' + secs(def.armorMs),
      'รีเจนมานา +' + pct(def.mpRegen) + '%/วิ นาน ' + secs(def.mpRegenMs) + ' (รวม ≈' + pct(def.mpRegen * def.mpRegenMs / 1000) + '% ของมานาสูงสุด)',
      'ลากเลือกทิศได้ (บอทไม่ใช้สกิลนี้)',
      'คูลดาวน์ ' + Classes.cdText(def, S)].join(' • '),
  });

  // สกิล 3: ลูกไฟวงกว้าง — วางลงพื้นรัศมี range ระเบิด hits ครั้ง (ครั้งแรกหลังเตือน delay มิลลิวินาที ครั้งต่อไปห่างกัน hitMs) | สตั้น stunMs
  Classes.skill('mg_fire', {
    name: 'ลูกไฟ', class: 'mage', type: 'mfire', noInfo: true,
    dmg: 45, range: 200, cd: 7000, mp: 24, delay: 400, hits: 2, hitMs: 450, stunMs: 1500,
  }, {
    scale: { ap: AP_PCT.mg_fire }, ground: { cast: 340 },
    info: (def, lv, S) => ['วางลูกไฟวงกว้างลงพื้น รัศมี ' + def.range + ' ระเบิดหลังเตือน ' + secs(def.delay),
      'ดาเมจครั้งละ ≈' + pw(def, lv, S) + ' (ฐาน + ' + pct(AP_PCT.mg_fire) + '% ของพลังเวท) x ' + def.hits + ' ครั้ง ห่างกัน ' + secs(def.hitMs) + ' (รวม ≈' + (pw(def, lv, S) * def.hits) + ')',
      'สตั้น ' + secs(def.stunMs) + ' ทุกครั้งที่โดน (บอสสั้นลง ' + pct(1 - BOSS_CC_MUL) + '%)',
      'ลากเล็งวางได้',
      'คูลดาวน์ ' + Classes.cdText(def, S)].join(' • '),
  });

  // สกิล 4: ธารน้ำแข็ง — วางวงรัศมี range ดาเมจ ticks ครั้ง ห่างกัน tickMs | ทุกครั้งมีโอกาส freezeChance (0-1) แช่แข็ง freezeMs
  Classes.skill('mg_ice', {
    name: 'ธารน้ำแข็ง', class: 'mage', type: 'mice', noInfo: true,
    dmg: 20, range: 170, cd: 6000, mp: 20,
    ticks: 3, tickMs: 900, freezeChance: 0.4, freezeMs: 1800,
  }, {
    scale: { ap: AP_PCT.mg_ice }, ground: { cast: 320 },
    info: (def, lv, S) => ['วางวงน้ำแข็งลงพื้น รัศมี ' + def.range,
      'ดาเมจครั้งละ ≈' + pw(def, lv, S) + ' (ฐาน + ' + pct(AP_PCT.mg_ice) + '% ของพลังเวท) x ' + def.ticks + ' ครั้ง ห่างกัน ' + secs(def.tickMs) + ' (รวม ≈' + (pw(def, lv, S) * def.ticks) + ')',
      'โอกาสแช่แข็ง ' + pct(def.freezeChance) + '% ต่อครั้ง นาน ' + secs(def.freezeMs) + ' (บอสสั้นลง ' + pct(1 - BOSS_CC_MUL) + '%)',
      'ลากเล็งวางได้',
      'คูลดาวน์ ' + Classes.cdText(def, S)].join(' • '),
  });

  // อัลติ ระเบิดมหาเวท — ชาจพลัง chargeMs มิลลิวินาที แล้วระเบิดรอบตัวรัศมี range | แช่แข็ง freezeMs + ไฟช็อต shockMs | คูลดาวน์ 60 วิ
  // mpFull: true = เติมมานาเต็มทันทีหลังระเบิด (ตั้ง false ถ้าไม่ต้องการ)
  Classes.ulti('mage', {
    name: 'ระเบิดมหาเวท', dmg: 220, range: 420, cd: 60000, mp: 60, type: 'mult',
    chargeMs: 1000, freezeMs: 2500, shockMul: 0.3, shockMs: 5000, mpFull: true, noInfo: true,
  }, {
    scale: { ap: AP_PCT.ulti },
    info: (def, lv, S) => ['ชาจพลัง ' + secs(def.chargeMs) + ' แล้วระเบิดรอบตัว รัศมี ' + def.range,
      'ดาเมจ ≈' + pw(def, lv, S) + ' (ฐาน + ' + pct(AP_PCT.ulti) + '% ของพลังเวท)',
      'แช่แข็ง ' + secs(def.freezeMs) + ' ทุกตัวที่โดน (บอสสั้นลง ' + pct(1 - BOSS_CC_MUL) + '%)',
      'ไฟช็อต ≈' + Math.round(pw(def, lv, S) * def.shockMul) + '/วิ นาน ' + secs(def.shockMs),
      def.mpFull ? 'เติมมานาเต็มทันทีหลังระเบิด' : 'ไม่เติมมานา',
      'คูลดาวน์ ' + Classes.cdText(def, S)].join(' • '),
  });

  if (TEST_UNLOCK) Classes.testUnlock(MG_IDS);

  // ลงทะเบียนกับ aimDash.js
  (function register() {
    if (window.DIR_CFG) {
      window.DIR_CFG.mg_bolt = { len: SKILL_DEFS.mg_bolt.range, w: SKILL_DEFS.mg_bolt.halfW };
      window.DIR_CFG.mg_nova = { len: SKILL_DEFS.mg_nova.range, w: 18 };
    }
    if (window.GROUND_CFG) delete window.GROUND_CFG.mg_nova;     // เวทวาปเป็นแบบเลือกทิศ ไม่ใช่วางพื้นที่แล้ว
    if (window.GROUND_ULTI) delete window.GROUND_ULTI.mage;      // อัลติใหม่ระเบิดรอบตัว ไม่ต้องลากเล็ง
  })();

  // ---------- ตัวช่วย ----------
  function unit(fx, fy) {
    const l = Math.hypot(fx, fy);
    return l < 0.001 ? { x: 1, y: 0 } : { x: fx / l, y: fy / l };
  }

  // ทิศยิงสายฟ้า: ลากเลือก > หันหามอนที่ล็อก > ทิศที่หันอยู่
  function aimDir(scene, gp) {
    if (gp && gp.dir) return unit(gp.x, gp.y);
    const p = scene.player, t = scene.target && scene.target.active ? scene.target : null;
    if (t && Math.hypot(t.x - p.x, t.y - p.y) > 1) return unit(t.x - p.x, t.y - p.y);
    return unit(scene.facing.x, scene.facing.y);
  }

  // ทิศวาป: ลากเลือก > ทิศที่กำลังเดิน (จอย/คีย์บอร์ด) > ทิศที่หันอยู่ (ไม่หันหามอน เพราะไม่ต้องการวาปเข้าหามอนโดยไม่ตั้งใจ)
  function moveDir(scene, gp) {
    if (gp && gp.dir) return unit(gp.x, gp.y);
    let vx = scene.joy ? scene.joy.dx : 0, vy = scene.joy ? scene.joy.dy : 0;
    if (scene.cursors && scene.wasd) {
      if (scene.cursors.left.isDown || scene.wasd.A.isDown) vx = -1;
      if (scene.cursors.right.isDown || scene.wasd.D.isDown) vx = 1;
      if (scene.cursors.up.isDown || scene.wasd.W.isDown) vy = -1;
      if (scene.cursors.down.isDown || scene.wasd.S.isDown) vy = 1;
    }
    if (Math.hypot(vx, vy) >= 0.25) return unit(vx, vy);
    return unit(scene.facing.x, scene.facing.y);
  }

  // จุดตกของสกิลวางพื้นที่ (ที่ลากเล็งไว้จาก aimDash.js) ถ้าไม่มี ใช้ตำแหน่งที่ได้รับ
  function takeGround(scene, def, x, y) {
    const q = scene._groundQ;
    if (q && q.length) {
      const i = q.findIndex(e => e.def === def || (e.def.name === def.name && e.def.range === def.range));
      if (i >= 0) { const e = q.splice(i, 1)[0]; return { x: e.x, y: e.y }; }
    }
    return { x: x, y: y };
  }

  const ccMs = (e, ms) => (e.isBoss ? ms * BOSS_CC_MUL : ms);

  // ติดไฟช็อต: dps ต่อวินาที นาน ms
  function shock(scene, e, dps, ms) { Classes.status(scene, e, 'shock', { dps: dps }, ms); }

  // บัพสเตตัสตัวเอง (ผ่านระบบบัพของ stats.js) คืน true ถ้าสำเร็จ
  function statBuff(scene, id, key, value, ms) {
    try {
      if (key && scene.addStatBuff) {
        const o = {}; o[key] = value;
        scene.addStatBuff(id, o, ms);
        return true;
      }
    } catch (e) { console.error('statBuff', id, e); }
    return false;
  }
  function armorBuff(scene, def) {
    let key = ARMOR_STAT;
    try {
      const S = scene.getStats ? scene.getStats() : null;
      if (!key) key = ARMOR_KEYS.find(k => S && (k in S));
    } catch (e) { console.error('armorBuff', e); }
    if (statBuff(scene, 'mg_armor', key, def.armor, def.armorMs)) {
      scene.toastMsg('🛡 เกราะ +' + def.armor + ' นาน ' + (def.armorMs / 1000) + ' วิ');
    } else if (scene.time.now > (scene._mgWarnAt || 0)) {
      scene._mgWarnAt = scene.time.now + 4000;
      console.warn('mage.js: เพิ่มเกราะไม่ได้ (ไม่พบสเตตัสเกราะ/addStatBuff) ใส่ชื่อที่ ARMOR_STAT');
      scene.toastMsg('⚠ เพิ่มเกราะไม่ได้ (ดู console)');
    }
  }

  // บัพคริติคอลให้ตัวเอง (จากสายฟ้า) | ร่ายซ้ำ = รีเฟรชเวลา ไม่ซ้อนกัน
  // ใช้วิธีเดียวกับธนูตรึงขา: addStatBuff({ crit: เปอร์เซ็นต์ตรงๆ }) เช่น 40 = +40%
  // ถ้า addStatBuff ใช้ไม่ได้ จะใช้ระบบสำรอง: ระหว่างบัพ ดาเมจจากสกิลเมจมีโอกาสคริ x CRIT_MUL
  function critBuff(scene, def) {
    const pct = Math.round(def.critBuff * 100);   // 0.4 -> 40
    if (statBuff(scene, 'mg_crit', CRIT_STAT, pct, def.critMs)) {
      scene._mgCrit = null;
    } else {
      scene._mgCrit = { until: scene.time.now + def.critMs, chance: def.critBuff };
      if (scene.time.now > (scene._mgWarnAt || 0)) {
        scene._mgWarnAt = scene.time.now + 4000;
        console.warn('mage.js: addStatBuff ใช้ไม่ได้ -> ใช้ระบบคริสำรอง');
      }
    }
    scene.toastMsg('💥 คริติคอล +' + pct + '% นาน ' + (def.critMs / 1000) + ' วิ');
  }
  // ระบบคริสำรอง (ทำงานเฉพาะเมื่อ critBuff ใช้สเตตัสจริงไม่ได้)
  function critDmg(scene, e, dmg) {
    const c = scene._mgCrit;
    if (c && scene.time.now < c.until && Math.random() < c.chance) {
      scene.popText(e.x, e.y - 34, '💥 คริ!', '#ffd24a');
      return Math.round(dmg * CRIT_MUL);
    }
    return dmg;
  }

  // ---------- มานา ----------
  // หามานาสูงสุด (รองรับหลายชื่อ เผื่อระบบสเตตัสตั้งชื่อต่างกัน) คืน 0 ถ้าหาไม่เจอ
  function maxMpOf(scene) {
    try {
      if (typeof scene.maxMp === 'function') return scene.maxMp() || 0;
      const st = scene.stats || {};
      return st.maxMp || st.mpMax || 0;
    } catch (e) { console.error('maxMpOf', e); }
    return 0;
  }

  // บัพรีเจนมานาเพิ่ม (จากเวทวาป) | ร่ายซ้ำ = รีเฟรชเวลา ไม่ซ้อนกัน
  function manaRegenBuff(scene, def) {
    if (!def.mpRegen || !def.mpRegenMs) return;
    const now = scene.time.now;
    scene._mgMana = { until: now + def.mpRegenMs, rate: def.mpRegen, next: now + MANA_TICK };
    scene.toastMsg('💧 รีเจนมานา +' + Math.round(def.mpRegen * 100) + '%/วิ นาน ' + (def.mpRegenMs / 1000) + ' วิ');
  }

  // เรียกทุกเฟรม: เติมมานาเพิ่มตามบัพ
  function tickMana(scene) {
    const b = scene._mgMana;
    if (!b) return;
    const now = scene.time.now;
    if (now >= b.until) { scene._mgMana = null; return; }
    if (now < b.next) return;
    b.next = now + MANA_TICK;
    const st = scene.stats, max = maxMpOf(scene);
    if (!st || !(max > 0) || st.hp <= 0) return;
    st.mp = Math.min(max, st.mp + max * b.rate * (MANA_TICK / 1000));
  }

  // วาดสายฟ้าซิกแซกตามทิศ
  function drawBolt(scene, p, u, len, hw) {
    const nx = -u.y, ny = u.x, N = 10, pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, off = (i === 0 || i === N) ? 0 : (Math.random() - 0.5) * 36;
      pts.push({ x: p.x + u.x * len * t + nx * off, y: p.y + u.y * len * t + ny * off });
    }
    const area = scene.add.rectangle(p.x + u.x * len / 2, p.y + u.y * len / 2, len, hw * 2, 0xffe14a, 0.18)
      .setRotation(Math.atan2(u.y, u.x)).setDepth(58);
    const g = scene.add.graphics().setDepth(62);
    [[14, 0xffe14a, 0.55], [4, 0xffffff, 1]].forEach(s => {
      g.lineStyle(s[0], s[1], s[2]);
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.strokePath();
    });
    scene.tweens.add({ targets: [g, area], alpha: 0, duration: 320, onComplete: () => { g.destroy(); area.destroy(); } });
  }

  // ---------- เอฟเฟกต์สกิล (this = scene) ----------
  // สกิล 1: สายฟ้าแนวใหญ่ + ไฟช็อต + บัพคริ
  Classes.handlers.mbolt = function (def, x, y, dmg, fx, fy) {
    const scene = this, p = scene.player, u = unit(fx, fy), len = def.range, hw = def.halfW;
    drawBolt(scene, p, u, len, hw);
    const dps = Math.round(dmg * def.shockMul);
    critBuff(scene, def);
    scene.enemies.getChildren().slice().forEach(e => {
      if (!e.active) return;
      const rx = e.x - p.x, ry = e.y - p.y;
      const along = rx * u.x + ry * u.y, perp = Math.abs(-rx * u.y + ry * u.x);
      if (along < -15 || along > len + 12 || perp > hw + 12) return;
      shock(scene, e, dps, def.shockMs);
      scene.damage(e, critDmg(scene, e, dmg));
    });
  };

  // สกิล 2: วาป + เกราะ + รีเจนมานา
  Classes.handlers.mblink = function (def, x, y, dmg, fx, fy) {
    const scene = this, p = scene.player, u = unit(fx, fy);
    let d = def.range;
    if (scene.segmentBlocked) {
      while (d > 0 && scene.segmentBlocked(p.x, p.y, p.x + u.x * d, p.y + u.y * d, 14)) d -= 15;
    }
    d = Math.max(0, d);
    const nx = clamp(p.x + u.x * d, 20, WORLD_W - 20), ny = clamp(p.y + u.y * d, 20, WORLD_H - 20);
    scene.flash(p.x, p.y, 38, 0xb98cff);
    if (p.body) p.body.reset(nx, ny); else p.setPosition(nx, ny);
    scene.flash(nx, ny, 48, 0xe0c8ff);
    armorBuff(scene, def);
    manaRegenBuff(scene, def);
  };

  // สกิล 3: ลูกไฟวงกว้างวางพื้น (เตือนสั้นๆ แล้วระเบิด hits ครั้ง) + สตั้น
  Classes.handlers.mfire = function (def, x, y, dmg) {
    const scene = this, pt = takeGround(scene, def, x, y);
    const hits = def.hits || 1, gap = def.hitMs || 400;
    const warn = scene.add.circle(pt.x, pt.y, def.range, 0xff6a2a, 0.12).setStrokeStyle(3, 0xff6a2a, 0.8).setDepth(40);
    const tw = scene.tweens.add({ targets: warn, alpha: 0.5, yoyo: true, repeat: -1, duration: 120 });
    for (let h = 0; h < hits; h++) {
      scene.time.delayedCall(def.delay + h * gap, () => {
        scene.flash(pt.x, pt.y, def.range, 0xff7a2a);
        scene.time.delayedCall(90, () => scene.flash(pt.x, pt.y, def.range * 0.6, 0xffffff));
        const list = Classes.enemiesIn(scene, pt.x, pt.y, def.range);
        list.forEach(e => {
          Classes.status(scene, e, 'stun', {}, ccMs(e, def.stunMs));
          scene.damage(e, critDmg(scene, e, dmg));
        });
        if (h === 0 && list.length) scene.popText(pt.x, pt.y - 40, 'สตั้น!', '#ffb36b');
        if (h === hits - 1) { tw.stop(); warn.destroy(); }
      });
    }
  };

  // สกิล 4: วงน้ำแข็งวางพื้น ดาเมจ ticks ครั้ง มีโอกาสแช่แข็ง
  Classes.handlers.mice = function (def, x, y, dmg) {
    const scene = this, pt = takeGround(scene, def, x, y);
    const zone = scene.add.circle(pt.x, pt.y, def.range, 0x9fe8ff, 0.18).setStrokeStyle(2, 0xffffff, 0.7).setDepth(40);
    for (let i = 0; i < def.ticks; i++) {
      scene.time.delayedCall(i * def.tickMs + 150, () => {
        scene.flash(pt.x, pt.y, def.range, 0x9fe8ff);
        Classes.enemiesIn(scene, pt.x, pt.y, def.range).forEach(e => {
          if (Math.random() < def.freezeChance) {
            Classes.status(scene, e, 'freeze', {}, ccMs(e, def.freezeMs));
            scene.popText(e.x, e.y - 30, '❄ แช่แข็ง!', '#9fe8ff');
          }
          scene.damage(e, critDmg(scene, e, dmg));
        });
      });
    }
    scene.time.delayedCall((def.ticks - 1) * def.tickMs + 500, () => zone.destroy());
  };

  // อัลติ: ชาจพลัง 1 วิ (chargeMs) แล้วระเบิดรอบตัว + แช่แข็ง + ไฟช็อต + เติมมานาเต็มทันที
  Classes.handlers.mult = function (def, x, y, dmg) {
    const scene = this, p = scene.player;
    const charge = def.chargeMs || 0;

    // วงเตือนขอบเขตระเบิด + วงพลังที่ค่อยๆ ขยายเข้าหาขอบ
    const edge = scene.add.circle(p.x, p.y, def.range, 0x9fe8ff, 0.06).setStrokeStyle(3, 0xffffff, 0.7).setDepth(59);
    const core = scene.add.circle(p.x, p.y, def.range, 0xffe14a, 0.25).setStrokeStyle(3, 0xffe14a, 0.9).setDepth(60).setScale(0.05);
    scene.tweens.add({ targets: core, scale: 1, duration: Math.max(1, charge), ease: 'Quad.easeIn' });
    const follow = scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => { if (p && p.active) { edge.setPosition(p.x, p.y); core.setPosition(p.x, p.y); } }
    });
    if (charge > 0) scene.popText(p.x, p.y - 60, '⚡ ชาจพลัง...', '#ffe28a');

    scene.time.delayedCall(charge, () => {
      follow.remove(false); edge.destroy(); core.destroy();
      if (!p || !p.active || (scene.stats && scene.stats.hp <= 0)) return;

      const ring = scene.add.circle(p.x, p.y, def.range, 0x9fe8ff, 0.25).setStrokeStyle(4, 0xffffff, 0.9).setDepth(60).setScale(0.1);
      scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
      scene.flash(p.x, p.y, def.range * 0.5, 0xffe14a);
      scene.cameras.main.shake(260, 0.006);
      const dps = Math.round(dmg * def.shockMul);
      const list = Classes.enemiesIn(scene, p.x, p.y, def.range);
      list.forEach(e => {
        Classes.status(scene, e, 'freeze', {}, ccMs(e, def.freezeMs));
        shock(scene, e, dps, def.shockMs);
        scene.damage(e, critDmg(scene, e, dmg));
      });
      if (list.length) scene.popText(p.x, p.y - 50, '❄ แช่แข็ง + ⚡ ไฟช็อต!', '#d9f4ff');

      // เติมมานาเต็มทันที (หลังหักมานาที่ใช้ร่ายแล้ว)
      if (def.mpFull && scene.stats) {
        const max = maxMpOf(scene);
        if (max > 0) {
          scene.stats.mp = max;
          scene.flash(p.x, p.y, 44, 0x4aa8ff);
          scene.popText(p.x, p.y - 72, '💧 มานาเต็ม!', '#7cc4ff');
        } else if (scene.time.now > (scene._mgWarnAt || 0)) {
          scene._mgWarnAt = scene.time.now + 4000;
          console.warn('mage.js: เติมมานาไม่ได้ (ไม่พบ maxMp() หรือ stats.maxMp)');
          scene.toastMsg('⚠ เติมมานาไม่ได้ (ดู console)');
        }
      }
    });
  };

  // ---------- ตั้งทิศก่อนใช้สกิล + บอทไม่ใช้เวทวาป ----------
  const _useSkill = P.useSkill;
  P.useSkill = function (idx, gp) {
    const sid = this.slots && this.slots[idx];
    const def = sid && SKILL_DEFS[sid];
    if (def && def.type === 'mblink' && this.autoMode) return;   // บอทอย่าวาปมั่ว
    if (def && (def.type === 'mbolt' || def.type === 'mblink') && !this.panel &&
        this.time.now >= (this.cdEnd['slot' + idx] || 0) && this.stats.mp >= def.mp) {
      const d = def.type === 'mbolt' ? aimDir(this, gp) : moveDir(this, gp);
      this.facing.set(d.x, d.y);
    }
    return _useSkill.call(this, idx, gp);
  };

  // ---------- สถานะบนมอน: แช่แข็ง (freeze) / ไฟช็อต (shock) + บัพรีเจนมานาของตัวเรา ----------
  // แช่แข็ง: มอนหยุดเดิน (สีฟ้า) | ไฟช็อต: ลดเลือดทุก SHOCK_TICK มิลลิวินาที (สีเหลือง)
  const _ue = P.updateEnemies;
  P.updateEnemies = function (time) {
    _ue.call(this, time);
    tickMana(this);
    const scene = this;
    this.enemies.getChildren().slice().forEach(e => {
      const fx = e._fx;
      if (!fx || !e.active) return;

      // กันกรณีสตั้น (id 'stun') ยังไม่ถูกจัดการจากไฟล์อื่น: หยุดเดินไว้เสมอ
      if (fx.stun && time < fx.stun.until && e.body) e.setVelocity(0, 0);

      const fr = fx.freeze;
      if (fr) {
        if (time >= fr.until) {
          delete fx.freeze;
          if (e._frzTint) { e.clearTint(); e._frzTint = false; }
        } else {
          if (e.body) e.setVelocity(0, 0);
          e.setTint(0x9fe8ff); e._frzTint = true;
        }
      } else if (e._frzTint) { e.clearTint(); e._frzTint = false; }

      const sk = fx.shock;
      if (sk) {
        if (time >= sk.until) {
          delete fx.shock; e._shockNext = 0;
          if (e._shkTint) { e.clearTint(); e._shkTint = false; }
        } else {
          if (!e._shockNext || time >= e._shockNext) {
            e._shockNext = time + SHOCK_TICK;
            scene.damage(e, Math.max(1, Math.round(sk.dps * SHOCK_TICK / 1000)));
            if (!e.active) return;
          }
          if (!e._frzTint) { e.setTint(0xffe14a); e._shkTint = true; }
        }
      } else if (e._shkTint) { e.clearTint(); e._shkTint = false; }
    });
  };

  // ---------- ไอคอน ----------
  const _sik = skillIconKey;
  skillIconKey = function (type) {
    if (type === 'mbolt') return _sik('proj');
    if (type === 'mblink') return _sik('dash');
    if (type === 'mfire' || type === 'mice' || type === 'mult') return _sik('aoe');
    return _sik(type);
  };
})();
