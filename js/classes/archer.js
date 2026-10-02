// ===== อาชีพธนู (archer) — แก้ความสามารถสกิลของธนูที่ไฟล์นี้ =====
// สกิล 1 ยิงคู่ลดพลัง (ar_shot)   | ยิง 2 ดอก ศัตรูที่โดนตีเบาลง | ลากเลือกทิศได้
// สกิล 2 ธนูตรึงขา   (ar_multi)  | ยิง 1 ดอก ล็อกขาศัตรู (เดินไม่ได้) | ลากเลือกทิศได้
// สกิล 3 ธนูเจาะเกราะ (ar_pierce) | ดาเมจรุนแรง ระยะไกลขึ้น | ลากเลือกทิศได้
// สกิล 4 ฝนลูกศร     (ar_rain)   | วางลงพื้นที่ที่ลากเล็ง ดาเมจ 3 ช่วง
// อัลติ  ธนูทลวงฟ้า              | ชาร์จธนูแล้วยิงเป็นแนวกว้าง ดาเมจรุนแรง ไกล ทะลุทุกตัว | ลากเลือกทิศได้
// dmg = ค่าฐาน | range = ระยะ | cd = คูลดาวน์ (มิลลิวินาที) | mp = มานา
// scale = ตัวคูณสเตตัส: ดาเมจ = dmg x เลเวลสกิล + ตัวคูณ x สเตตัส
(function () {
  const Classes = window.Classes;
  if (!Classes) throw new Error('archer.js: ไม่พบ window.Classes -> _shared.js ไม่ทำงาน/โหลดไม่ขึ้น (ดู error ก่อนหน้า)');

  const P = Main.prototype;
  const TEST_UNLOCK = true;     // true = ปลดล็อกสกิลธนูทันทีเพื่อทดสอบ (ทดสอบเสร็จเปลี่ยนเป็น false ให้ได้จากหนังสือสกิล)
  const AR_IDS = ['ar_shot', 'ar_rain', 'ar_pierce', 'ar_multi'];
  const ARROW_SPEED = 900;      // ความเร็วลูกศร (พิกเซล/วินาที) ใช้คิดเวลาที่ดาเมจเข้า
  const BOSS_ROOT_MUL = 0.5;    // บอสโดนล็อกขาสั้นลงครึ่งหนึ่ง (ตั้ง 1 = เท่ามอนทั่วไป)
  const CHARGE_ROOTS_PLAYER = true;   // true = ขณะชาร์จอัลติ ตัวละครเดินไม่ได้
  const ATK_FIELDS = ['atk', 'dmg', 'attack'];   // ชื่อฟิลด์พลังโจมตีของมอน (ใช้กับสถานะ "ตีเบาลง" ดู monsters.js)

  // คูลดาวน์อัลติ: ใช้ค่ากลางจาก _shared.js ถ้ามี ไม่มีก็ใช้ 60 วินาที (กันไฟล์พังทั้งไฟล์ถ้าไม่มีตัวแปร ULTI_CD)
  const ULTI_COOLDOWN = (typeof window.ULTI_CD === 'number') ? window.ULTI_CD
    : (typeof ULTI_CD === 'number' ? ULTI_CD : 60000);

  // ---------- ข้อมูลสกิล (ปรับตัวเลขได้ตรงนี้) ----------
  Classes.basic('archer', { name: 'โจมตี', dmg: 9, range: 360, cd: 650, type: 'proj', class: 'archer' });

  // สกิล 1: ยิงคู่ — ยิง shots ดอก ห่างกัน gap มิลลิวินาที ดอกละ hitMul ของดาเมจ | ศัตรูที่โดนตีเบาลง weakPct นาน weakMs
  Classes.skill('ar_shot', {
    name: 'ยิงคู่ลดพลัง', class: 'archer', type: 'ashot2', noInfo: true,
    dmg: 11, range: 420, hw: 12, cd: 3000, mp: 12,
    shots: 2, gap: 140, hitMul: 0.7, weakPct: 0.25, weakMs: 5000,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => 'ยิง ' + def.shots + ' ดอก ดอกละ ≈' + Math.round(Classes.power(def.id, def, lv, S) * def.hitMul) +
      ' ศัตรูที่โดนตีเบาลง ' + Math.round(def.weakPct * 100) + '% นาน ' + (def.weakMs / 1000) + ' วิ • ลากเลือกทิศได้ • คูลดาวน์ ' + Classes.cdText(def, S),
  });

  // สกิล 2: ธนูตรึงขา — ยิง 1 ดอก ล็อกขาศัตรู rootMs มิลลิวินาที (ศัตรูเดินไม่ได้ แต่ยังตีได้ถ้าอยู่ในระยะ)
  Classes.skill('ar_multi', {
    name: 'ธนูตรึงขา', class: 'archer', type: 'aroot', noInfo: true,
    dmg: 13, range: 480, hw: 12, cd: 5000, mp: 14, rootMs: 2200,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => 'ยิง 1 ดอก ดาเมจ ≈' + Classes.power(def.id, def, lv, S) +
      ' ล็อกขาศัตรู ' + (def.rootMs / 1000) + ' วิ • ลากเลือกทิศได้ • คูลดาวน์ ' + Classes.cdText(def, S),
  });

  // สกิล 3: ธนูเจาะเกราะ — ดาเมจรุนแรง ระยะไกล (เดิม 24 / 420)
  Classes.skill('ar_pierce', {
    name: 'ธนูเจาะเกราะ', class: 'archer', type: 'aheavy', noInfo: true,
    dmg: 40, range: 650, hw: 16, cd: 6000, mp: 22,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => 'ยิงดอกใหญ่ ดาเมจ ≈' + Classes.power(def.id, def, lv, S) +
      ' ระยะไกล ' + def.range + ' • ลากเลือกทิศได้ • คูลดาวน์ ' + Classes.cdText(def, S),
  });

  // สกิล 4: ฝนลูกศร — วางโซนรัศมี range ที่จุดลากเล็ง ลงดาเมจ ticks ครั้ง ห่างกัน tickMs | ดาเมจต่อครั้ง = tickMul ของดาเมจ
  Classes.skill('ar_rain', {
    name: 'ฝนลูกศร', class: 'archer', type: 'arain', noInfo: true,
    dmg: 14, range: 120, cd: 6500, mp: 20,
    ticks: 3, tickMs: 700, tickMul: 0.6,
  }, {
    scale: { patk: 1 }, ground: { cast: 340 },
    info: (def, lv, S) => 'วางฝนลูกศรลงพื้นที่ ดาเมจ ≈' + Math.round(Classes.power(def.id, def, lv, S) * def.tickMul) +
      ' x ' + def.ticks + ' ครั้ง ห่างกัน ' + (def.tickMs / 1000) + ' วิ • คูลดาวน์ ' + Classes.cdText(def, S),
  });

  // อัลติ ธนูทลวงฟ้า — ชาร์จ chargeMs มิลลิวินาที แล้วยิงแนวยาว range กว้าง halfW*2 ทะลุทุกตัว
  Classes.ulti('archer', {
    name: 'ธนูทลวงฟ้า', dmg: 120, range: 650, halfW: 95, cd: ULTI_COOLDOWN, mp: 50, type: 'ault', chargeMs: 800,
  }, { scale: { patk: 1 } });

  if (TEST_UNLOCK) Classes.testUnlock(AR_IDS);

  // ลงทะเบียนลากเลือกทิศกับ aimDash.js (len = ความยาวลูกศรที่โชว์, w = ครึ่งความกว้างแถบ)
  (function registerDir() {
    if (window.DIR_CFG) {
      ['ar_shot', 'ar_multi', 'ar_pierce'].forEach(id => {
        window.DIR_CFG[id] = { len: SKILL_DEFS[id].range, w: SKILL_DEFS[id].hw };
      });
    }
    if (window.DIR_ULTI) window.DIR_ULTI.archer = { len: ULTI_DEFS.archer.range, w: ULTI_DEFS.archer.halfW };
    if (window.GROUND_ULTI) delete window.GROUND_ULTI.archer;   // อัลติใหม่เป็นแบบเลือกทิศ ไม่ใช่วางพื้นที่
  })();

  // ---------- ตัวช่วย ----------
  const archerColor = () => (CLASSES.archer && CLASSES.archer.color) || 0xffffff;

  // มีภาพเอฟเฟกต์สไปรต์ (skillFx.js) พร้อมใช้หรือยัง
  const hasAnim = (scene, key) => !!(window.SkillFx && scene.anims && scene.anims.exists(key));
  const hasTex = (scene, key) => !!(scene.textures && scene.textures.exists(key));

  // ทิศที่จะยิง: ลากเลือก (gp.dir) > หันไปหามอนที่ล็อกอยู่ > ทิศที่หันอยู่
  function aimDir(scene, gp) {
    if (gp && gp.dir) {
      const v = new Phaser.Math.Vector2(gp.x, gp.y);
      if (v.length() > 0.001) return v.normalize();
    }
    const p = scene.player, t = scene.target && scene.target.active ? scene.target : null;
    if (t) {
      const v = new Phaser.Math.Vector2(t.x - p.x, t.y - p.y);
      if (v.length() > 1) return v.normalize();
    }
    const f = new Phaser.Math.Vector2(scene.facing.x, scene.facing.y);
    return f.length() > 0.001 ? f.normalize() : new Phaser.Math.Vector2(1, 0);
  }

  function unit(fx, fy) {
    const l = Math.hypot(fx, fy);
    return l < 0.001 ? { x: 1, y: 0 } : { x: fx / l, y: fy / l };
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

  // ยิงลูกศร 1 ดอกไปตามทิศ: โดนศัตรูตัวแรกในแนวยิง (ระยะ def.range, กว้าง def.hw) | onHit(ศัตรู) ทำงานตอนลูกศรถึง
  // ใช้ภาพสไปรต์จาก skillFx.js (SkillFx.arrow) ถ้าไม่มีภาพ จะใช้สี่เหลี่ยมแทน
  function shootArrow(scene, ux, uy, def, big, onHit) {
    const p = scene.player, sx = p.x, sy = p.y, hw = def.hw || 14;
    let best = null, bestAlong = Infinity;
    scene.enemies.getChildren().forEach(e => {
      if (!e.active) return;
      const rx = e.x - sx, ry = e.y - sy;
      const along = rx * ux + ry * uy, perp = Math.abs(-rx * uy + ry * ux);
      if (along < 0 || along > def.range || perp > hw + 14) return;
      if (along < bestAlong) { bestAlong = along; best = e; }
    });
    const d = best ? bestAlong : def.range;
    const dur = Math.max(60, d / ARROW_SPEED * 1000);

    let a = null;
    try { a = window.SkillFx && window.SkillFx.arrow ? window.SkillFx.arrow(scene, def, sx, sy, ux, uy, d, dur, big) : null; }
    catch (err) { console.error('archer.arrow', err); a = null; }
    if (!a) {
      a = scene.add.rectangle(sx, sy, big ? 44 : 26, big ? 7 : 4, big ? 0xffe9a8 : archerColor())
        .setRotation(Math.atan2(uy, ux)).setDepth(61);
    }
    scene.tweens.add({ targets: a, x: sx + ux * d, y: sy + uy * d, duration: dur, onComplete: () => a.destroy() });
    if (best) scene.time.delayedCall(dur, () => { if (best.active) onHit(best); });
  }

  // ---------- เอฟเฟกต์สกิล (this = scene) ----------
  // สกิล 1: ยิงคู่ + ตีเบาลง
  Classes.handlers.ashot2 = function (def, x, y, dmg, fx, fy) {
    const scene = this, u = unit(fx, fy), per = Math.round(dmg * def.hitMul);
    for (let i = 0; i < def.shots; i++) {
      scene.time.delayedCall(i * def.gap, () => {
        shootArrow(scene, u.x, u.y, def, false, e => {
          Classes.status(scene, e, 'weak', { pct: def.weakPct }, def.weakMs);
          scene.damage(e, per);
        });
      });
    }
  };

  // สกิล 2: ยิง 1 ดอก ล็อกขา (มีเถาวัลย์พันขาตลอดเวลาที่ล็อก)
  Classes.handlers.aroot = function (def, x, y, dmg, fx, fy) {
    const scene = this, u = unit(fx, fy);
    shootArrow(scene, u.x, u.y, def, false, e => {
      const ms = e.isBoss ? def.rootMs * BOSS_ROOT_MUL : def.rootMs;
      Classes.status(scene, e, 'root', {}, ms);
      scene.damage(e, dmg);
      scene.popText(e.x, e.y - 30, 'ล็อกขา!', '#7dff9a');
      if (window.SkillFx && window.SkillFx.hit) window.SkillFx.hit(scene, 'ar_multi', e, ms);
    });
  };

  // สกิล 3: ดอกใหญ่ ดาเมจแรง ระยะไกล
  Classes.handlers.aheavy = function (def, x, y, dmg, fx, fy) {
    const scene = this, u = unit(fx, fy);
    shootArrow(scene, u.x, u.y, def, true, e => {
      scene.flash(e.x, e.y, 38, 0xffe9a8);
      scene.damage(e, dmg);
    });
  };

  // สกิล 4: ฝนลูกศรวางพื้นที่ — วาดด้วยโค้ดทั้งหมด (ไม่ใช้สไปรต์ชีต) ลูกศรตกตรงจากฟ้าลงพื้น ไม่แกว่งซ้ายขวา
  // ปรับได้: RAIN_PER_TICK = จำนวนลูกศรต่อรอบ | RAIN_FALL = เวลาตก (ms) | RAIN_SPAN = ช่วงที่ลูกศรทยอยตก (ms) | RAIN_HEIGHT = ความสูงที่ตกลงมา
  const RAIN_HIT_MS = 400;   // ดาเมจเข้าหลังเริ่มแต่ละรอบกี่ ms (ตรงกับเฟรมลูกศรปักพื้นในภาพ)
  const RAIN_PER_TICK = 12, RAIN_FALL = 280, RAIN_SPAN = 320, RAIN_HEIGHT = 300;

  function ensureRainTex(scene) {
    if (scene.textures.exists('ar_rain_arrow')) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xb8742a, 1); g.fillRect(8, 10, 4, 30);          // ก้านลูกศร
    g.fillStyle(0xffe08a, 1); g.fillRect(9, 10, 2, 30);
    g.fillStyle(0xfff3c4, 1); g.fillTriangle(10, 54, 3, 38, 17, 38);   // หัวลูกศร (ชี้ลง)
    g.fillStyle(0xe0a23a, 1); g.fillTriangle(10, 54, 10, 38, 17, 38);
    g.fillStyle(0xffffff, 0.95);                                 // ขนนก
    g.fillTriangle(10, 12, 2, 0, 10, 6); g.fillTriangle(10, 12, 18, 0, 10, 6);
    g.generateTexture('ar_rain_arrow', 20, 56);
    g.destroy();
  }

  function rainArrow(scene, ax, ay) {
    const arr = scene.add.image(ax, ay - RAIN_HEIGHT, 'ar_rain_arrow').setOrigin(0.5, 0.96).setDepth(62).setScale(1.1).setAlpha(0);
    const trail = scene.add.rectangle(ax, ay - RAIN_HEIGHT, 5, 90, 0xffd35a, 0.35).setOrigin(0.5, 1).setDepth(61);
    scene.tweens.add({
      targets: arr, y: ay, alpha: 1, duration: RAIN_FALL, ease: 'Quad.easeIn',
      onUpdate: () => { trail.setPosition(arr.x, arr.y - 50); trail.setAlpha(0.35 * arr.alpha); },
      onComplete: () => {
        trail.destroy();
        const ring = scene.add.ellipse(ax, ay, 14, 8, 0xffe08a, 0.85).setDepth(41);
        scene.tweens.add({ targets: ring, scaleX: 3.2, scaleY: 3.2, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
        for (let s = 0; s < 3; s++) {
          const sp = scene.add.circle(ax, ay, 2, 0xfff3c4, 1).setDepth(63);
          const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 18;
          scene.tweens.add({ targets: sp, x: ax + Math.cos(a) * d, y: ay + Math.sin(a) * d * 0.6 - 8, alpha: 0, duration: 300, onComplete: () => sp.destroy() });
        }
        scene.tweens.add({ targets: arr, alpha: 0, delay: 200, duration: 220, onComplete: () => arr.destroy() });
      },
    });
  }

  Classes.handlers.arain = function (def, x, y, dmg) {
    const scene = this, pt = takeGround(scene, def, x, y);
    const R = def.range, per = Math.round(dmg * def.tickMul), GOLD = 0xffc94a;

    // มีภาพสไปรต์ฝนลูกศร (skillFx.js เล่นให้เอง) -> คิดแค่ดาเมจ
    if (hasAnim(scene, 'ar_rain')) {
      for (let i = 0; i < def.ticks; i++) {
        scene.time.delayedCall(i * def.tickMs + RAIN_HIT_MS, () => {
          Classes.enemiesIn(scene, pt.x, pt.y, R).forEach(e => scene.damage(e, per));
        });
      }
      return;
    }
    // ไม่มีภาพ -> วาดด้วยโค้ดแทน (สำรอง)
    ensureRainTex(scene);

    // วงพื้นที่ (ตรงกับรัศมีดาเมจจริง)
    const zone = scene.add.circle(pt.x, pt.y, R, GOLD, 0.10).setStrokeStyle(2, 0xffe08a, 0.8).setDepth(40).setScale(0.6);
    const inner = scene.add.circle(pt.x, pt.y, R * 0.62, GOLD, 0).setStrokeStyle(1, 0xffe08a, 0.45).setDepth(40).setScale(0.6);
    scene.tweens.add({ targets: [zone, inner], scale: 1, duration: 180, ease: 'Back.easeOut' });

    for (let i = 0; i < def.ticks; i++) {
      scene.time.delayedCall(i * def.tickMs, () => {
        scene.tweens.add({ targets: zone, scale: 1.05, yoyo: true, duration: 120 });
        const rot = Math.random() * Math.PI * 2;
        for (let k = 0; k < RAIN_PER_TICK; k++) {           // กระจายตำแหน่งให้ทั่ววง (golden angle)
          const r = Math.sqrt((k + 0.5) / RAIN_PER_TICK) * R * 0.9, th = rot + k * 2.39996;
          const ax = pt.x + Math.cos(th) * r, ay = pt.y + Math.sin(th) * r;
          scene.time.delayedCall(Math.random() * RAIN_SPAN, () => rainArrow(scene, ax, ay));
        }
        scene.time.delayedCall(RAIN_SPAN + RAIN_FALL, () => {   // ดาเมจเข้าตอนลูกศรลงถึงพื้น
          Classes.enemiesIn(scene, pt.x, pt.y, R).forEach(e => scene.damage(e, per));
        });
      });
    }
    scene.time.delayedCall((def.ticks - 1) * def.tickMs + RAIN_SPAN + RAIN_FALL + 150, () => {
      scene.tweens.add({ targets: [zone, inner], alpha: 0, duration: 250, onComplete: () => { zone.destroy(); inner.destroy(); } });
    });
  };

  // อัลติ: ชาร์จ แล้วยิงแนวกว้างทะลุทุกตัว
  // ถ้ามีภาพลำแสง (ar_ult.png จาก skillFx.js) จะไม่วาดลำแสงสี่เหลี่ยมซ้ำ
  Classes.handlers.ault = function (def, x, y, dmg, fx, fy) {
    const scene = this, u = unit(fx, fy), col = archerColor();
    const len = def.range, hw = def.halfW, ang = Math.atan2(u.y, u.x);
    const p0 = scene.player;

    // ช่วงชาร์จ: แถบบอกแนวยิงกะพริบ + วงรวมพลัง
    scene._archerCharge = { until: scene.time.now + def.chargeMs };
    const prev = scene.add.rectangle(p0.x + u.x * len / 2, p0.y + u.y * len / 2, len, hw * 2, col, 0.12)
      .setRotation(ang).setDepth(55);
    const pulse = scene.tweens.add({ targets: prev, alpha: 0.35, yoyo: true, repeat: -1, duration: 160 });
    const ring = scene.add.circle(p0.x, p0.y, 70, col, 0).setStrokeStyle(3, 0xffffff, 0.9).setDepth(61);
    scene.tweens.add({ targets: ring, scale: 0.2, duration: def.chargeMs });
    scene.toastMsg('🏹 กำลังชาร์จ...');

    scene.time.delayedCall(def.chargeMs, () => {
      pulse.stop(); prev.destroy(); ring.destroy();
      scene._archerCharge = null;
      const p = scene.player;
      if (!hasTex(scene, 'ar_ult')) {
        const cx = p.x + u.x * len / 2, cy = p.y + u.y * len / 2;
        const beam = scene.add.rectangle(cx, cy, len, hw * 2, col, 0.5).setRotation(ang).setDepth(60);
        const core = scene.add.rectangle(cx, cy, len, hw * 0.45, 0xffffff, 0.9).setRotation(ang).setDepth(61);
        scene.tweens.add({ targets: [beam, core], alpha: 0, duration: 380, onComplete: () => { beam.destroy(); core.destroy(); } });
      }
      scene.flash(p.x, p.y, 60, 0xffffff);
      if (scene.cameras && scene.cameras.main) scene.cameras.main.shake(150, 0.004);
      scene.enemies.getChildren().slice().forEach(e => {
        if (!e.active) return;
        const rx = e.x - p.x, ry = e.y - p.y;
        const along = rx * u.x + ry * u.y, perp = Math.abs(-rx * u.y + ry * u.x);
        if (along >= -20 && along <= len + 15 && perp <= hw + 12) scene.damage(e, dmg);
      });
    });
  };

  // ---------- ตั้งทิศก่อนยิง (ลากเลือก / หันหามอน / ทิศที่หันอยู่) ----------
  const DIR_TYPES = { ashot2: 1, aroot: 1, aheavy: 1 };
  const _useSkill = P.useSkill;
  P.useSkill = function (idx, gp) {
    const sid = this.slots && this.slots[idx];
    const def = sid && SKILL_DEFS[sid];
    if (def && DIR_TYPES[def.type] && !this.panel &&
        this.time.now >= (this.cdEnd['slot' + idx] || 0) && this.stats.mp >= def.mp) {
      const d = aimDir(this, gp);
      this.facing.set(d.x, d.y);
    }
    return _useSkill.call(this, idx, gp);
  };

  const _useUlti = P.useUlti;
  P.useUlti = function (gp) {
    const def = this.ultiClass === 'archer' && ULTI_DEFS.archer;
    if (def && !this.panel && this.time.now >= (this.cdEnd.ulti || 0) && this.stats.mp >= def.mp) {
      const d = aimDir(this, gp);
      this.facing.set(d.x, d.y);
    }
    return _useUlti.call(this, gp);
  };

  // ขณะชาร์จอัลติ ตัวละครเดินไม่ได้
  const _um = P.updateMovement;
  P.updateMovement = function () {
    _um.call(this);
    const c = this._archerCharge;
    if (CHARGE_ROOTS_PLAYER && c && this.time.now < c.until && this.player && this.player.body) {
      this.player.setVelocity(0, 0);
    }
  };

  // ---------- สถานะบนมอน: ล็อกขา (root) / ตีเบาลง (weak) ----------
  // ตีเบาลง: ลดค่าพลังโจมตีของมอนตามชื่อฟิลด์ใน ATK_FIELDS (เดาอัตโนมัติ)
  // ถ้ามอนตียังแรงเท่าเดิม ให้เรียก window.enemyAtkMul(e) ในโค้ดตีผู้เล่นของ monsters.js
  window.enemyAtkMul = function (e) {
    const w = e && e._fx && e._fx.weak, sc = window.__mainScene;
    return w && sc && sc.time.now < w.until ? Math.max(0, 1 - w.pct) : 1;
  };
  function applyWeak(e, pct) {
    if (!e._weakBase) {
      e._weakBase = {};
      ATK_FIELDS.forEach(k => { if (typeof e[k] === 'number') e._weakBase[k] = e[k]; });
      if (e.getData) ATK_FIELDS.forEach(k => { const v = e.getData(k); if (typeof v === 'number') e._weakBase['d:' + k] = v; });
    }
    Object.keys(e._weakBase).forEach(k => {
      const v = e._weakBase[k] * (1 - pct);
      if (k.indexOf('d:') === 0) e.setData(k.slice(2), v); else e[k] = v;
    });
    e._weakOn = true;
  }
  function clearWeak(e) {
    if (e._weakBase) {
      Object.keys(e._weakBase).forEach(k => {
        if (k.indexOf('d:') === 0) e.setData(k.slice(2), e._weakBase[k]); else e[k] = e._weakBase[k];
      });
      e._weakBase = null;
    }
    e._weakOn = false;
  }

  const _ue = P.updateEnemies;
  P.updateEnemies = function (time) {
    window.__mainScene = this;   // ให้ enemyAtkMul ใช้งานได้เสมอ
    _ue.call(this, time);
    this.enemies.getChildren().forEach(e => {
      const fx = e._fx;
      if (!fx) return;

      const rt = fx.root;
      if (rt) {
        if (time >= rt.until) {
          delete fx.root;
          if (e._rootTint) { e.clearTint(); e._rootTint = false; }
        } else {
          if (e.body) e.setVelocity(0, 0);
          e.setTint(0x7dff9a); e._rootTint = true;
        }
      } else if (e._rootTint) { e.clearTint(); e._rootTint = false; }

      const wk = fx.weak;
      if (wk) {
        if (time >= wk.until) {
          delete fx.weak; clearWeak(e);
          if (e._weakTint) { e.clearTint(); e._weakTint = false; }
        } else {
          if (!e._weakOn) applyWeak(e, wk.pct);
          if (!e._rootTint) { e.setTint(0xc58bff); e._weakTint = true; }
        }
      } else if (e._weakTint) { e.clearTint(); e._weakTint = false; }
    });
  };

  // ---------- ไอคอน ----------
  try {
    if (typeof skillIconKey === 'function') {
      const _sik = skillIconKey;
      skillIconKey = function (type) {
        if (type === 'ashot2' || type === 'aroot' || type === 'aheavy') return _sik('proj');
        if (type === 'arain' || type === 'ault') return _sik('aoe');
        return _sik(type);
      };
    }
  } catch (err) { console.error('archer.js skillIconKey', err); }
})();
