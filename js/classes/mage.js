// ===== อาชีพคทา (mage) — รวม สกิล + VFX + SFX ไว้ไฟล์เดียว =====
// สกิล 1 สายฟ้า (mg_bolt) | สกิล 2 เวทวาป (mg_nova) | สกิล 3 ลูกไฟ (mg_fire) | สกิล 4 ธารน้ำแข็ง (mg_ice) | อัลติ ระเบิดมหาเวท
// dmg = ค่าฐาน | range = ระยะ/รัศมี | cd = คูลดาวน์ (ms) | mp = มานา
// ดาเมจ = dmg x เลเวลสกิล + AP_PCT x พลังเวท  (แก้ AP_PCT ที่เดียว: 1.2 = +120%)
// *** ไฟล์นี้แทน MageVFX.js และ MageSFX.js แล้ว ลบ 2 ไฟล์นั้นออกจาก index.html ได้เลย ***
(function () {
  const Classes = window.Classes;
  if (!Classes) throw new Error('mage.js: ไม่พบ window.Classes -> shared.js ไม่ทำงาน/โหลดไม่ขึ้น');

  const P = Main.prototype;
  const clamp = Phaser.Math.Clamp;
  const TAU = Math.PI * 2;

  // ---------- ตั้งค่า ----------
  const TEST_UNLOCK = true;     // true = ปลดล็อกสกิลเวททันทีเพื่อทดสอบ (เสร็จแล้วเปลี่ยนเป็น false)
  const MG_IDS = ['mg_fire', 'mg_ice', 'mg_bolt', 'mg_nova'];
  const SHOCK_TICK = 500;       // ไฟช็อตลงดาเมจทุกกี่ ms
  const BOSS_CC_MUL = 0.5;      // บอสโดนสตั้น/แช่แข็งสั้นลงครึ่งหนึ่ง
  const ARMOR_STAT = null;      // ชื่อสเตตัสเกราะใน stats.js (null = เดาอัตโนมัติ)
  const ARMOR_KEYS = ['pdef', 'def', 'armor', 'defense', 'pdf'];
  const MANA_TICK = 500;        // บัพรีเจนมานาเติมทุกกี่ ms
  const CRIT_MUL = 1.5;         // ตัวคูณคริ (ใช้เฉพาะระบบสำรอง)
  const CRIT_STAT = 'crit';     // ชื่อสเตตัสคริใน stats.js (ค่าเป็น % ตรงๆ)
  const FX_QUALITY = 0.6;       // 0.3-1 | ปรับจำนวนอนุภาคเอฟเฟกต์ (มือถือแรงต่ำให้ลดลง)
  const SHAKE = true;           // false = ปิดจอสั่น

  const AP_PCT = { mg_bolt: 1.2, mg_fire: 1.5, mg_ice: 0.8, ulti: 3.0 };

  const pct = v => Math.round((v || 0) * 100);
  const secs = ms => (Math.round((ms || 0) / 100) / 10) + ' วิ';
  const pw = (def, lv, S) => {
    let v = NaN;
    try { v = Classes.power(def.id, def, lv, S); } catch (e) { v = NaN; }
    return isFinite(v) ? v : def.dmg;
  };

  // ============================================================
  // SFX — ยังไม่มีไฟล์เสียง = ข้ามอัตโนมัติ (โหลดไฟล์เสียงด้วย key ด้านล่างเมื่อพร้อม)
  // ============================================================
  const SFX_KEYS = {
    bolt: 'mage_bolt', teleport: 'mage_teleport', fire: 'mage_fire', ice: 'mage_ice',
    iceHit: 'mage_ice_hit', ultimateCharge: 'mage_ultimate_charge', ultimate: 'mage_ultimate',
  };
  function sfx(scene, name, vol) {
    try {
      const key = SFX_KEYS[name];
      if (!key || !scene.sound || !scene.cache.audio.exists(key)) return;
      scene.sound.play(key, { volume: vol != null ? vol : 0.7 });
    } catch (e) { /* ไม่มีเสียงก็ไม่เป็นไร */ }
  }

  // ============================================================
  // VFX — วาดอย่างเดียว ไม่ยุ่งดาเมจ
  // ============================================================
  const rnd = (a, b) => a + Math.random() * (b - a);
  const alive = s => !!(s && s.sys && s.sys.isActive());
  const shake = (s, ms, i) => { if (SHAKE && s.cameras && s.cameras.main) s.cameras.main.shake(ms, i); };
  const cnt = n => Math.max(2, Math.round(n * FX_QUALITY));

  function spark(scene, x, y, color, count, speed, life, depth) {
    for (let i = 0; i < cnt(count); i++) {
      const a = Math.random() * TAU, s = rnd(speed * 0.35, speed);
      const g = scene.add.circle(x, y, rnd(1, 3), color, rnd(0.55, 1)).setDepth(depth || 80);
      scene.tweens.add({
        targets: g, x: x + Math.cos(a) * s, y: y + Math.sin(a) * s, alpha: 0, scale: 0.1,
        duration: rnd(life * 0.55, life), ease: 'Cubic.easeOut', onComplete: () => g.destroy(),
      });
    }
  }

  function ring(scene, x, y, radius, color, duration, depth) {
    const g = scene.add.circle(x, y, radius, color, 0).setStrokeStyle(3, color, 0.85)
      .setDepth(depth || 70).setScale(0.05);
    scene.tweens.add({
      targets: g, scale: 1, alpha: 0, duration: duration || 400, ease: 'Cubic.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  // วงเวท (วาดที่ 0,0 แล้วย้ายตำแหน่ง เพื่อให้หมุนรอบจุดกึ่งกลางจริง)
  // วงเวท + ดาวเต็มวง | points: 5 = ดาวห้าแฉก, 6 = ดาวหกแฉก (ค่าเริ่มต้น), 0 = ไม่มีดาว
function magicCircle(scene, x, y, radius, color, duration, points) {
  const n = points === undefined ? 6 : points;
  const g = scene.add.graphics({ x: x, y: y }).setDepth(55);

  // กรอบวง
  g.lineStyle(3, color, 0.9);
  g.strokeCircle(0, 0, radius);

  // ดาว: ปลายแฉกแตะขอบวงพอดี (R = radius)
  if (n >= 5) {
    const R = radius, rot = -Math.PI / 2;   // rot = ให้แฉกแรกชี้ขึ้นบน
    const poly = (cnt, step, off) => {
      g.beginPath();
      for (let i = 0; i < cnt; i++) {
        const a = rot + off + ((i * step) % cnt) * TAU / cnt;
        const px = Math.cos(a) * R, py = Math.sin(a) * R;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath(); g.strokePath();
    };
    g.lineStyle(2, color, 0.75);
    if (n % 2) poly(n, (n - 1) / 2, 0);                    // เลขคี่ = ดาวห้าแฉก
    else { poly(n / 2, 1, 0); poly(n / 2, 1, TAU / n); }   // เลขคู่ = สามเหลี่ยมซ้อน (หกแฉก)
  }

  scene.tweens.add({
    targets: g, angle: 180, alpha: 0, duration: duration || 900, ease: 'Cubic.easeOut',
    onComplete: () => g.destroy(),
  });
  }

  // เส้นสายฟ้าซิกแซก 1 เส้น (กราฟิกเดียว วาด 3 ชั้น)
  function lightning(scene, x, y, ux, uy, length, width, depth) {
    const nx = -uy, ny = ux, N = 10, pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, off = (i === 0 || i === N) ? 0 : rnd(-width, width);
      pts.push({ x: x + ux * length * t + nx * off, y: y + uy * length * t + ny * off });
    }
    const g = scene.add.graphics().setDepth(depth || 80);
    [[12, 0x7c5cff, 0.25], [6, 0x9d8cff, 0.65], [3, 0xffffff, 1]].forEach(s => {
      g.lineStyle(s[0], s[1], s[2]);
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.strokePath();
    });
    scene.tweens.add({ targets: g, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
  }

  const VFX = {};

  // สกิล 1: สายฟ้า
  VFX.bolt = function (scene, x, y, ux, uy, range, hw) {
    const beam = scene.add.rectangle(x + ux * range / 2, y + uy * range / 2, range, hw * 2, 0x806cff, 0.13)
      .setRotation(Math.atan2(uy, ux)).setDepth(57);
    scene.tweens.add({ targets: beam, alpha: 0, scaleY: 1.4, duration: 300, onComplete: () => beam.destroy() });

    for (let i = 0; i < 2; i++) {
      scene.time.delayedCall(i * 40, () => {
        if (alive(scene)) lightning(scene, x, y, ux, uy, range, hw * (i ? 0.25 : 0.45), 75 + i);
      });
    }
    for (let i = 0; i < cnt(5); i++) {
      const t = rnd(0.15, 0.9), side = Math.random() < 0.5 ? -1 : 1;
      const bx = x + ux * range * t, by = y + uy * range * t;
      const bd = unit(ux * 0.3 - uy * side, uy * 0.3 + ux * side);
      scene.time.delayedCall(rnd(0, 100), () => {
        if (alive(scene)) lightning(scene, bx, by, bd.x, bd.y, rnd(25, 65), 10, 73);
      });
    }
    ring(scene, x, y, 45, 0xb59cff, 280, 76);
    spark(scene, x, y, 0xffffff, 10, 55, 350, 82);
    const ex = x + ux * range, ey = y + uy * range;
    ring(scene, ex, ey, 70, 0x8e7cff, 360, 76);
    spark(scene, ex, ey, 0xb8adff, 14, 100, 500, 82);
    shake(scene, 100, 0.002);
  };

  // สกิล 2: วาป (ก่อน + หลัง)
  VFX.blink = function (scene, x, y, ex, ey, ux, uy) {
    magicCircle(scene, x, y, 42, 0xb68cff, 450);
    ring(scene, x, y, 55, 0xa879ff, 350);
    spark(scene, x, y, 0xe4d5ff, 14, 75, 350, 82);
    const dist = Math.hypot(ex - x, ey - y);
    for (let i = 0; i < 6; i++) {
      const d = dist * i / 6, px = x + ux * d, py = y + uy * d;
      const s = scene.add.circle(px, py, rnd(2, 5), 0xb99aff, 0.7).setDepth(76);
      scene.tweens.add({
        targets: s, x: px + ux * 30, y: py + uy * 30, alpha: 0, scale: 0.1,
        duration: 250 + i * 20, onComplete: () => s.destroy(),
      });
    }
    scene.time.delayedCall(70, () => {
      if (!alive(scene)) return;
      magicCircle(scene, ex, ey, 45, 0xe0c8ff, 550);
      ring(scene, ex, ey, 65, 0xc39aff, 420);
      spark(scene, ex, ey, 0xffffff, 14, 90, 450, 82);
    });
  };

  // สกิล 3: ลูกไฟตก (ก่อนระเบิดครั้งแรก) + ระเบิดแต่ละครั้ง
  VFX.fireMeteor = function (scene, x, y, radius, delay) {
    magicCircle(scene, x, y, radius, 0xff6a28, 700);
    const m = scene.add.circle(x - 30, y - radius - 100, 13, 0xffd05a, 1).setDepth(90);
    scene.tweens.add({
      targets: m, x: x, y: y, scale: 2, duration: delay || 400, ease: 'Quad.easeIn',
      onComplete: () => m.destroy(),
    });
  };
  VFX.fireBlast = function (scene, x, y, radius) {
    const core = scene.add.circle(x, y, radius * 0.2, 0xfff4b0, 0.95).setDepth(78);
    scene.tweens.add({ targets: core, scale: 2.5, alpha: 0, duration: 220, ease: 'Cubic.easeOut', onComplete: () => core.destroy() });
    ring(scene, x, y, radius, 0xff7628, 330, 76);
    ring(scene, x, y, radius * 0.7, 0xffc04a, 250, 77);
    spark(scene, x, y, 0xffb52e, 22, radius * 0.9, 550, 83);
    spark(scene, x, y, 0xfff1a0, 8, radius * 0.65, 400, 84);
    shake(scene, 160, 0.003);
  };

  // สกิล 4: น้ำแข็งแตก (ต่อ 1 tick)
  function iceShard(scene, cx, cy, big) {
    const g = scene.add.graphics().setDepth(82);
    g.fillStyle(Math.random() < 0.5 ? 0x9fe8ff : 0xd9f8ff, 0.85);
    g.beginPath();
    g.moveTo(cx, cy - rnd(8, big ? 18 : 12)); g.lineTo(cx + rnd(4, 7), cy);
    g.lineTo(cx, cy + rnd(10, big ? 22 : 16)); g.lineTo(cx - rnd(4, 7), cy);
    g.closePath(); g.fillPath();
    scene.tweens.add({
      targets: g, y: -rnd(15, 40), alpha: 0, duration: rnd(450, 750), ease: 'Cubic.easeOut',
      onComplete: () => g.destroy(),
    });
  }
  VFX.iceBurst = function (scene, x, y, radius) {
    ring(scene, x, y, radius, 0x9deaff, 400, 76);
    ring(scene, x, y, radius * 0.65, 0xd9f8ff, 330, 77);
    for (let i = 0; i < cnt(10); i++) {
      const a = Math.random() * TAU, r = rnd(radius * 0.25, radius * 0.9);
      iceShard(scene, x + Math.cos(a) * r, y + Math.sin(a) * r, false);
    }
    spark(scene, x, y, 0xe8fbff, 16, radius * 0.75, 500, 84);
  };

  // อัลติ: ระเบิด (ส่วนชาจทำใน handler เพราะต้องตามตัวผู้เล่น)
  VFX.ultBlast = function (scene, x, y, radius) {
    const blast = scene.add.circle(x, y, 30, 0xffffff, 0.95).setDepth(90);
    scene.tweens.add({ targets: blast, scale: radius / 30, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => blast.destroy() });
    ring(scene, x, y, radius, 0xb8f4ff, 520, 86);
    ring(scene, x, y, radius * 0.78, 0xd3a4ff, 440, 87);
    ring(scene, x, y, radius * 0.5, 0xffe98a, 350, 88);
    const n = cnt(10);
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + rnd(-0.15, 0.15);
      scene.time.delayedCall(rnd(0, 120), () => {
        if (alive(scene)) lightning(scene, x, y, Math.cos(a), Math.sin(a), radius * rnd(0.65, 1), 30, 89);
      });
    }
    for (let i = 0; i < cnt(16); i++) {
      const a = Math.random() * TAU, r = rnd(radius * 0.45, radius);
      iceShard(scene, x + Math.cos(a) * r, y + Math.sin(a) * r, true);
    }
    spark(scene, x, y, 0xffffff, 40, radius, 750, 92);
    spark(scene, x, y, 0x9fe8ff, 24, radius * 0.8, 650, 93);
    spark(scene, x, y, 0xd0a2ff, 24, radius * 0.65, 600, 94);
    shake(scene, 400, 0.008);
  };

  window.MageVFX = VFX;   // เผื่อไฟล์อื่นเรียกใช้
  window.MageSFX = { play: (scene, name, cfg) => sfx(scene, name, cfg && cfg.volume) };

  // ============================================================
  // ข้อมูลสกิล (ปรับตัวเลขได้ตรงนี้)
  // ============================================================
  Classes.basic('mage', { name: 'โจมตี', dmg: 8, range: 380, cd: 700, type: 'proj', class: 'mage' });

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
    if (window.GROUND_CFG) delete window.GROUND_CFG.mg_nova;
    if (window.GROUND_ULTI) delete window.GROUND_ULTI.mage;
  })();

  // ============================================================
  // ตัวช่วย
  // ============================================================
  function unit(fx, fy) {
    const l = Math.hypot(fx, fy);
    return l < 0.001 ? { x: 1, y: 0 } : { x: fx / l, y: fy / l };
  }

  // ทิศสายฟ้า: ลากเลือก > หันหามอนที่ล็อก > ทิศที่หันอยู่
  function aimDir(scene, gp) {
    if (gp && gp.dir) return unit(gp.x, gp.y);
    const p = scene.player, t = scene.target && scene.target.active ? scene.target : null;
    if (t && Math.hypot(t.x - p.x, t.y - p.y) > 1) return unit(t.x - p.x, t.y - p.y);
    return unit(scene.facing.x, scene.facing.y);
  }

  // ทิศวาป: ลากเลือก > ทิศที่กำลังเดิน > ทิศที่หันอยู่
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

  // จุดตกของสกิลวางพื้นที่ (ที่ลากเล็งไว้จาก aimDash.js)
  function takeGround(scene, def, x, y) {
    const q = scene._groundQ;
    if (q && q.length) {
      const i = q.findIndex(e => e.def === def || (e.def.name === def.name && e.def.range === def.range));
      if (i >= 0) { const e = q.splice(i, 1)[0]; return { x: e.x, y: e.y }; }
    }
    return { x: x, y: y };
  }

  const ccMs = (e, ms) => (e.isBoss ? ms * BOSS_CC_MUL : ms);
  function shock(scene, e, dps, ms) { Classes.status(scene, e, 'shock', { dps: dps }, ms); }
  const warnOnce = (scene, msg, toast) => {
    if (scene.time.now > (scene._mgWarnAt || 0)) {
      scene._mgWarnAt = scene.time.now + 4000;
      console.warn('mage.js: ' + msg);
      if (toast) scene.toastMsg(toast);
    }
  };

  // บัพสเตตัสตัวเองผ่าน addStatBuff
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
    } else {
      warnOnce(scene, 'เพิ่มเกราะไม่ได้ (ไม่พบสเตตัสเกราะ/addStatBuff) ใส่ชื่อที่ ARMOR_STAT', '⚠ เพิ่มเกราะไม่ได้ (ดู console)');
    }
  }

  // บัพคริ (ร่ายซ้ำ = รีเฟรชเวลา) ถ้า addStatBuff ใช้ไม่ได้ ใช้ระบบสำรอง
  function critBuff(scene, def) {
    const c = Math.round(def.critBuff * 100);
    if (statBuff(scene, 'mg_crit', CRIT_STAT, c, def.critMs)) {
      scene._mgCrit = null;
    } else {
      scene._mgCrit = { until: scene.time.now + def.critMs, chance: def.critBuff };
      warnOnce(scene, 'addStatBuff ใช้ไม่ได้ -> ใช้ระบบคริสำรอง');
    }
    scene.toastMsg('💥 คริติคอล +' + c + '% นาน ' + (def.critMs / 1000) + ' วิ');
  }
  function critDmg(scene, e, dmg) {
    const c = scene._mgCrit;
    if (c && scene.time.now < c.until && Math.random() < c.chance) {
      scene.popText(e.x, e.y - 34, '💥 คริ!', '#ffd24a');
      return Math.round(dmg * CRIT_MUL);
    }
    return dmg;
  }

  // ---------- มานา ----------
  function maxMpOf(scene) {
    try {
      if (typeof scene.maxMp === 'function') return scene.maxMp() || 0;
      const st = scene.stats || {};
      return st.maxMp || st.mpMax || 0;
    } catch (e) { console.error('maxMpOf', e); }
    return 0;
  }
  function manaRegenBuff(scene, def) {
    if (!def.mpRegen || !def.mpRegenMs) return;
    const now = scene.time.now;
    scene._mgMana = { until: now + def.mpRegenMs, rate: def.mpRegen, next: now + MANA_TICK };
    scene.toastMsg('💧 รีเจนมานา +' + pct(def.mpRegen) + '%/วิ นาน ' + (def.mpRegenMs / 1000) + ' วิ');
  }
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

  // ============================================================
  // เอฟเฟกต์สกิล (this = scene)
  // ============================================================
  Classes.handlers.mbolt = function (def, x, y, dmg, fx, fy) {
    const scene = this, p = scene.player, u = unit(fx, fy), len = def.range, hw = def.halfW;
    VFX.bolt(scene, p.x, p.y, u.x, u.y, len, hw);
    sfx(scene, 'bolt');
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

  Classes.handlers.mblink = function (def, x, y, dmg, fx, fy) {
    const scene = this, p = scene.player, u = unit(fx, fy);
    let d = def.range;
    if (scene.segmentBlocked) {
      while (d > 0 && scene.segmentBlocked(p.x, p.y, p.x + u.x * d, p.y + u.y * d, 14)) d -= 15;
    }
    d = Math.max(0, d);
    const sx = p.x, sy = p.y;
    const nx = clamp(sx + u.x * d, 20, WORLD_W - 20), ny = clamp(sy + u.y * d, 20, WORLD_H - 20);
    VFX.blink(scene, sx, sy, nx, ny, u.x, u.y);
    sfx(scene, 'teleport');
    if (p.body) p.body.reset(nx, ny); else p.setPosition(nx, ny);
    armorBuff(scene, def);
    manaRegenBuff(scene, def);
  };

  Classes.handlers.mfire = function (def, x, y, dmg) {
    const scene = this, pt = takeGround(scene, def, x, y);
    const hits = def.hits || 1, gap = def.hitMs || 400;
    const warn = scene.add.circle(pt.x, pt.y, def.range, 0xff6a2a, 0.12).setStrokeStyle(3, 0xff6a2a, 0.8).setDepth(40);
    const tw = scene.tweens.add({ targets: warn, alpha: 0.5, yoyo: true, repeat: -1, duration: 120 });
    VFX.fireMeteor(scene, pt.x, pt.y, def.range, def.delay);
    sfx(scene, 'fire');
    for (let h = 0; h < hits; h++) {
      scene.time.delayedCall(def.delay + h * gap, () => {
        if (!alive(scene)) return;
        VFX.fireBlast(scene, pt.x, pt.y, def.range);
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

  Classes.handlers.mice = function (def, x, y, dmg) {
    const scene = this, pt = takeGround(scene, def, x, y);
    magicCircle(scene, pt.x, pt.y, def.range, 0x79dfff, 950);
    sfx(scene, 'ice');
    const zone = scene.add.circle(pt.x, pt.y, def.range, 0x9fe8ff, 0.18).setStrokeStyle(2, 0xffffff, 0.7).setDepth(40);
    for (let i = 0; i < def.ticks; i++) {
      scene.time.delayedCall(i * def.tickMs + 150, () => {
        if (!alive(scene)) return;
        VFX.iceBurst(scene, pt.x, pt.y, def.range);
        sfx(scene, 'iceHit', 0.5);
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

  // อัลติ: ชาจพลัง (ตามตัวผู้เล่น) -> ระเบิดรอบตัว + แช่แข็ง + ไฟช็อต + เติมมานาเต็ม
  Classes.handlers.mult = function (def, x, y, dmg) {
    const scene = this, p = scene.player;
    const charge = def.chargeMs || 0;

    const edge = scene.add.circle(p.x, p.y, def.range, 0x9fe8ff, 0.06).setStrokeStyle(3, 0xffffff, 0.7).setDepth(59);
    const core = scene.add.circle(p.x, p.y, def.range, 0xffe14a, 0.25).setStrokeStyle(3, 0xffe14a, 0.9).setDepth(60).setScale(0.05);
    scene.tweens.add({ targets: core, scale: 1, duration: Math.max(1, charge), ease: 'Quad.easeIn' });
    const follow = scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => { if (p && p.active) { edge.setPosition(p.x, p.y); core.setPosition(p.x, p.y); } },
    });
    sfx(scene, 'ultimateCharge');
    if (charge > 0) scene.popText(p.x, p.y - 60, '⚡ ชาจพลัง...', '#ffe28a');

    scene.time.delayedCall(charge, () => {
      follow.remove(false); edge.destroy(); core.destroy();
      if (!alive(scene) || !p || !p.active || (scene.stats && scene.stats.hp <= 0)) return;

      VFX.ultBlast(scene, p.x, p.y, def.range);
      sfx(scene, 'ultimate');
      const dps = Math.round(dmg * def.shockMul);
      const list = Classes.enemiesIn(scene, p.x, p.y, def.range);
      list.forEach(e => {
        Classes.status(scene, e, 'freeze', {}, ccMs(e, def.freezeMs));
        shock(scene, e, dps, def.shockMs);
        scene.damage(e, critDmg(scene, e, dmg));
      });
      if (list.length) scene.popText(p.x, p.y - 50, '❄ แช่แข็ง + ⚡ ไฟช็อต!', '#d9f4ff');

      if (def.mpFull && scene.stats) {
        const max = maxMpOf(scene);
        if (max > 0) {
          scene.stats.mp = max;
          ring(scene, p.x, p.y, 60, 0x4aa8ff, 400, 95);
          scene.popText(p.x, p.y - 72, '💧 มานาเต็ม!', '#7cc4ff');
        } else {
          warnOnce(scene, 'เติมมานาไม่ได้ (ไม่พบ maxMp() หรือ stats.maxMp)', '⚠ เติมมานาไม่ได้ (ดู console)');
        }
      }
    });
  };

  // ---------- ตั้งทิศก่อนใช้สกิล + บอทไม่ใช้เวทวาป ----------
  const _useSkill = P.useSkill;
  P.useSkill = function (idx, gp) {
    const sid = this.slots && this.slots[idx];
    const def = sid && SKILL_DEFS[sid];
    if (def && def.type === 'mblink' && this.autoMode) return;
    if (def && (def.type === 'mbolt' || def.type === 'mblink') && !this.panel &&
        this.time.now >= (this.cdEnd['slot' + idx] || 0) && this.stats.mp >= def.mp) {
      const d = def.type === 'mbolt' ? aimDir(this, gp) : moveDir(this, gp);
      this.facing.set(d.x, d.y);
    }
    return _useSkill.call(this, idx, gp);
  };

  // ---------- สถานะบนมอน: แช่แข็ง / ไฟช็อต + บัพรีเจนมานา ----------
  const _ue = P.updateEnemies;
  P.updateEnemies = function (time) {
    _ue.call(this, time);
    tickMana(this);
    const scene = this;
    this.enemies.getChildren().slice().forEach(e => {
      const fx = e._fx;
      if (!fx || !e.active) return;

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
