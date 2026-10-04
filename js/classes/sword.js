// ===== อาชีพดาบ (sword) — แก้ความสามารถสกิลของดาบที่ไฟล์นี้ =====
// ฟันตรง (sw_slash)          | สกิลเริ่มต้น ฟันเป็นแนวสี่เหลี่ยม (ยาว range กว้าง halfW*2) + เพิ่มพลังโจมตีชั่วคราว (เป็น %)
// สกิล 1 พุ่งทะยาน (sw_dash)  | พุ่งทะลวงเป็นแนว โจมตีศัตรูทุกตัวที่ขวางทาง | บล็อกการโจมตี 1 ครั้ง (3 วิ) | ลากเลือกทิศได้
// สกิล 2 ฟันสตั้น   (sw_cross) | ฟันตรงด้านหน้าเป็นแนวกว้าง สตั้นมอน | ลากเลือกทิศได้
// สกิล 3 ฟันหมุน    (sw_spin)  | ฟันรอบตัววงกว้าง 2 ครั้ง + เพิ่มเกราะ (เป็น %) + บล็อกการโจมตี 1 ครั้ง (3 วิ)
// อัลติ  ดาบสังหาร           | ฟันตรงเป็นแนวกว้างมาก สตั้นมอน | ลากเลือกทิศได้ | คูลดาวน์ 30 วิ
// dmg = ค่าฐาน | range = ระยะ (ฟันตรง = ความยาว, ฟันหมุน = รัศมี) | cd = คูลดาวน์ (มิลลิวินาที) | mp = มานา
// blockMs = บล็อกการโจมตีของมอนได้ 1 ครั้ง ภายในเวลานี้ (3000 = 3 วิ)
// scale = ตัวคูณสเตตัส: ดาเมจ = dmg x เลเวลสกิล + ตัวคูณ x สเตตัส
(function () {
  const Classes = window.Classes;
  if (!Classes) throw new Error('sword.js: ไม่พบ window.Classes -> _shared.js ไม่ทำงาน/โหลดไม่ขึ้น (ดู error ก่อนหน้า)');

  const P = Main.prototype;
  const clamp = Phaser.Math.Clamp;
  const TEST_UNLOCK = true;   // true = ปลดล็อกสกิลดาบทันทีเพื่อทดสอบ (ทดสอบเสร็จเปลี่ยนเป็น false ให้ได้จากหนังสือสกิล)
  const SW_IDS = ['sw_spin', 'sw_dash', 'sw_cross'];
  const BOSS_STUN_MUL = 0.5;  // บอสโดนสตั้นสั้นลงครึ่งหนึ่ง (ตั้ง 1 = เท่ามอนทั่วไป)
  const ARMOR_STAT = null;    // ชื่อสเตตัสเกราะใน stats.js (null = เดาอัตโนมัติจาก pdef/def/armor/defense)
  const ARMOR_KEYS = ['pdef', 'def', 'armor', 'defense', 'pdf'];
  const ATK_STAT = 'patk';    // ชื่อสเตตัสพลังโจมตีที่ใช้บัพของฟันตรง
  const SWORD_ULTI_CD = 30000; // คูลดาวน์อัลติดาบ (มิลลิวินาที): 30000 = 30 วินาที

  // ---------- ข้อมูลสกิล (ปรับตัวเลขได้ตรงนี้) ----------
  Classes.basic('sword', { name: 'โจมตี', dmg: 10, range: 60, cd: 650, type: 'melee', class: 'sword' });

  // ฟันตรง: ฟันเป็นแนวสี่เหลี่ยม ยาว range (เดิม 60 -> 140) กว้าง halfW*2 (halfW 55 = กว้าง 110)
  // ทุกครั้งที่ฟัน เพิ่มพลังโจมตี atkBuffPct (0.25 = +25%) นาน atkBuffMs มิลลิวินาที
  Classes.skill('sw_slash', {
    name: 'ฟันตรง', class: 'sword', type: 'sslash',
    dmg: 20, range: 140, halfW: 55, cd: 4000, mp: 8,
    atkBuffPct: 0.25, atkBuffMs: 3000,
  }, {
    scale: { patk: 1 },
    noInfo: true,
    info: (def, lv, S) => 'ฟันตรงเป็นแนวยาวกว้าง ดาเมจ ≈' + Classes.power(def.id, def, lv, S) +
      ' • ฟันแล้วเพิ่มพลังโจมตี +' + Math.round(def.atkBuffPct * 100) + '% นาน ' + (def.atkBuffMs / 1000) + ' วิ • คูลดาวน์ ' + Classes.cdText(def, S),
  });

  // สกิล 1: พุ่งทะยาน (แบบกลุ่ม) — พุ่งทะลวงระยะ range ตีทุกตัวที่อยู่ในแนวทางพุ่ง กว้าง pathW*2 | บล็อก 1 ครั้ง blockMs
  Classes.skill('sw_dash', {
    name: 'พุ่งทะยาน', class: 'sword', type: 'dash', noInfo: true,
    dmg: 16, range: 150, cd: 3600, mp: 14, pathW: 55, blockMs: 3000,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => 'พุ่งทะลวงเป็นแนว โจมตีศัตรูทุกตัวที่ขวางทาง ดาเมจ ≈' + Classes.power(def.id, def, lv, S) +
      ' ต่อตัว • บล็อกการโจมตี 1 ครั้ง (นาน ' + (def.blockMs / 1000) + ' วิ) • ลากเลือกทิศได้ • คูลดาวน์ ' + Classes.cdText(def, S),
  });

  // สกิล 2: ฟันสตั้น — ฟันตรงด้านหน้า ยาว range กว้าง halfW*2 | สตั้น stunMs มิลลิวินาที
  // healPct = ฟื้นเลือดทันทีที่ใช้ เป็น % ของ HP สูงสุด (0.4 = 40%)
  Classes.skill('sw_cross', {
    name: 'ฟันสตั้น', class: 'sword', type: 'sstun', noInfo: true,
    dmg: 22, range: 260, halfW: 80, cd: 4000, mp: 14, stunMs: 1500, healPct: 0.4,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => 'ฟันตรงด้านหน้าเป็นแนวกว้าง ดาเมจ ≈' + Classes.power(def.id, def, lv, S) +
      ' สตั้น ' + (def.stunMs / 1000) + ' วิ • ฟื้นเลือด ' + Math.round(def.healPct * 100) + '% ของ HP สูงสุด • ลากเลือกทิศได้ • คูลดาวน์ ' + Classes.cdText(def, S),
  });

  // สกิล 3: ฟันหมุน — ฟันรอบตัวรัศมี range จำนวน spins ครั้ง ห่างกัน spinGap มิลลิวินาที (ดาเมจต่อครั้ง = dmg)
  // เพิ่มเกราะ armorPct (0.3 = +30%) นาน armorMs มิลลิวินาที | บล็อก 1 ครั้ง blockMs
  Classes.skill('sw_spin', {
    name: 'ฟันหมุน', class: 'sword', type: 'sspin', noInfo: true,
    dmg: 18, range: 150, cd: 5000, mp: 18, spins: 2, spinGap: 350, armorPct: 0.3, armorMs: 6000, blockMs: 3000,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => 'ฟันรอบตัววงกว้าง ' + def.spins + ' ครั้ง ครั้งละ ≈' + Classes.power(def.id, def, lv, S) +
      ' เพิ่มเกราะ +' + Math.round(def.armorPct * 100) + '% นาน ' + (def.armorMs / 1000) + ' วิ' +
      ' • บล็อกการโจมตี 1 ครั้ง (นาน ' + (def.blockMs / 1000) + ' วิ) • คูลดาวน์ ' + Classes.cdText(def, S),
  });

  // อัลติ ดาบสังหาร — ฟันตรงยาว range กว้าง halfW*2 | สตั้น stunMs | ลากเลือกทิศได้ | คูลดาวน์ 30 วิ
  Classes.ulti('sword', {
    name: 'ดาบสังหาร', dmg: 70, range: 300, halfW: 130, cd: SWORD_ULTI_CD, mp: 50, type: 'sult', stunMs: 2000,
  }, { scale: { patk: 1 } });

  if (TEST_UNLOCK) Classes.testUnlock(SW_IDS);

  // ลงทะเบียนสกิลที่ลากเลือกทิศได้กับ aimDash.js (len = ความยาวลูกศร, w = ครึ่งความกว้างแถบที่โชว์)
  (function registerDir() {
    if (window.DIR_CFG) window.DIR_CFG.sw_cross = { len: SKILL_DEFS.sw_cross.range, w: SKILL_DEFS.sw_cross.halfW };
    if (window.DIR_ULTI) window.DIR_ULTI.sword = { len: ULTI_DEFS.sword.range, w: ULTI_DEFS.sword.halfW };
  })();

  // ---------- ตัวช่วย ----------
  // ทิศที่จะฟัน: ลากเลือก (gp.dir) > หันไปหามอนที่ล็อกอยู่ > ทิศที่หันอยู่
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

  function stun(scene, e, ms) {
    Classes.status(scene, e, 'stun', {}, e.isBoss ? ms * BOSS_STUN_MUL : ms);
  }

  // ฟันตรงเป็นแนวสี่เหลี่ยม: ยาว def.range กว้าง def.halfW*2 ไปทางทิศ (fx,fy)
  // withStun = true จะสตั้นทุกตัวที่โดนด้วย (ฟันสตั้น/อัลติ) | false = ฟันเฉยๆ (ฟันตรง)
  function slashBox(scene, def, dmg, fx, fy, color, withStun) {
    const p = scene.player;
    let ux = fx, uy = fy;
    const l = Math.hypot(ux, uy);
    if (l < 0.001) { ux = 1; uy = 0; } else { ux /= l; uy /= l; }
    const len = def.range, hw = def.halfW;

    const r = scene.add.rectangle(p.x + ux * len / 2, p.y + uy * len / 2, len, hw * 2, color, 0.4)
      .setRotation(Math.atan2(uy, ux)).setDepth(60);
    scene.tweens.add({ targets: r, alpha: 0, duration: 280, onComplete: () => r.destroy() });

    const list = scene.enemies.getChildren().filter(e => {
      if (!e.active) return false;
      const rx = e.x - p.x, ry = e.y - p.y;
      const along = rx * ux + ry * uy, perp = Math.abs(-rx * uy + ry * ux);
      return along >= -15 && along <= len + 12 && perp <= hw + 12;
    });
    list.forEach(e => { if (withStun) stun(scene, e, def.stunMs); scene.damage(e, dmg); });
    if (withStun && list.length) scene.popText(p.x, p.y - 40, 'สตั้น!', '#ffe066');
  }

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
  function warnOnce(scene, text) {
    if (scene.time.now > (scene._swWarnAt || 0)) {
      scene._swWarnAt = scene.time.now + 4000;
      console.warn('sword.js: ' + text);
      scene.toastMsg('⚠ ' + text);
    }
  }

  // บัพแบบ % ของสเตตัส: คิดจากค่าสเตตัสตอนที่ยังไม่มีบัพนี้ (จดไว้ตลอดที่บัพยังอยู่) กันการทบซ้ำเวลาร่ายต่อ
  // คืน { ok, flat } flat = ค่าที่บวกจริง
  function pctBuff(scene, id, key, pct, ms) {
    const now = scene.time.now;
    const book = scene._swPct = scene._swPct || {};
    let rec = book[id];
    if (!rec || now >= rec.until) {
      let base = 0;
      try {
        const S = scene.getStats ? scene.getStats() : null;
        if (S && typeof S[key] === 'number') base = S[key];
      } catch (e) { console.error('pctBuff', id, e); }
      rec = book[id] = { base: base, until: 0 };
    }
    const flat = Math.max(1, Math.round(rec.base * pct));
    rec.until = now + ms;
    return { ok: statBuff(scene, id, key, flat, ms), flat: flat };
  }

  // เพิ่มเกราะให้ตัวเอง (% ของเกราะปัจจุบัน)
  function armorBuff(scene, def) {
    let key = ARMOR_STAT;
    try {
      const S = scene.getStats ? scene.getStats() : null;
      if (!key) key = ARMOR_KEYS.find(k => S && (k in S));
    } catch (e) { console.error('armorBuff', e); }
    const r = pctBuff(scene, 'sw_armor', key, def.armorPct, def.armorMs);
    if (r.ok) scene.toastMsg('🛡 เกราะ +' + Math.round(def.armorPct * 100) + '% นาน ' + (def.armorMs / 1000) + ' วิ');
    else warnOnce(scene, 'เพิ่มเกราะไม่ได้ (ไม่พบสเตตัสเกราะ/addStatBuff) ใส่ชื่อที่ ARMOR_STAT');
  }

  // เพิ่มพลังโจมตีชั่วคราวจากฟันตรง (% ของพลังโจมตีปัจจุบัน) แสดงข้อความตอนบัพเริ่ม ไม่เด้งซ้ำทุกครั้งที่ฟันต่อ
  function atkBuff(scene, def) {
    const now = scene.time.now;
    const r = pctBuff(scene, 'sw_atk', ATK_STAT, def.atkBuffPct, def.atkBuffMs);
    if (r.ok) {
      if (now >= (scene._swAtkUntil || 0)) scene.popText(scene.player.x, scene.player.y - 40, '⚔ ATK +' + Math.round(def.atkBuffPct * 100) + '%', '#ffb36b');
      scene._swAtkUntil = now + def.atkBuffMs;
    } else warnOnce(scene, 'เพิ่มพลังโจมตีไม่ได้ (ไม่พบ addStatBuff) ดู stats.js');
  }

  // ---------- บล็อกการโจมตี 1 ครั้ง ----------
  // เปิดบล็อก: ไม่โดนดาเมจ 1 ครั้ง ภายใน ms มิลลิวินาที (ร่ายซ้ำ = ต่ออายุ ไม่สะสมเป็นหลายครั้ง)
  function giveBlock(scene, ms) {
    scene.swordBlock = { until: scene.time.now + (ms || 2000) };
    const p = scene.player;
    if (p) scene.popText(p.x, p.y - 62, '🛡 พร้อมบล็อก!', '#9be7ff');
  }

  // ดักที่ hurtPlayer: ครอบคลุมมอนชน กระสุน และสกิลวงแดงของบอส เพราะทุกอย่างเรียก hurtPlayer
  const _hurtPlayer = P.hurtPlayer;
  if (_hurtPlayer) {
    P.hurtPlayer = function (raw) {
      const b = this.swordBlock;
      if (b) {
        this.swordBlock = null;   // หมดอายุหรือใช้แล้ว ล้างทิ้งเสมอ
        if (this.time.now < b.until) {
          if (this.player) {
            this.popText(this.player.x, this.player.y - 40, 'บล็อก!', '#9be7ff');
            this.flash(this.player.x, this.player.y, 40, 0x9be7ff);
          }
          return;
        }
      }
      return _hurtPlayer.apply(this, arguments);
    };
  } else {
    console.error('sword.js: ไม่พบ hurtPlayer ระบบบล็อกจึงไม่ทำงาน (ตรวจว่า fixes.js โหลดก่อน sword.js)');
  }

  // ระยะจากจุด (px,py) ถึงเส้นตรงช่วง (ax,ay)-(bx,by)
  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // ปิดเสียงดาเมจชั่วคราวระหว่างเรียกฟังก์ชัน (ใช้ให้การพุ่งเดิมเคลื่อนตัวอย่างเดียว ไม่ตีซ้ำ)
  function withoutDamage(scene, fn) {
    const own = Object.prototype.hasOwnProperty.call(scene, 'damage');
    const real = scene.damage;
    scene.damage = function () {};
    try { return fn(); } finally { if (own) scene.damage = real; else delete scene.damage; }
  }

  // ---------- พุ่งทะยานแบบกลุ่ม ----------
  // ให้ระบบเดิมพุ่งตัวละคร (รวมเอฟเฟกต์/ทิศที่ลากเลือก) แล้วคิดดาเมจใหม่: ตีทุกตัวในแนวพุ่ง + จุดเริ่ม + จุดปลาย ตัวละ 1 ครั้ง
  const _apply = P.applySkillEffect;
  P.applySkillEffect = function (def, x, y, fx, fy, dmg, kind) {
    if (!def || !(def.id === 'sw_dash' || def === SKILL_DEFS.sw_dash) || !this.player) return _apply.apply(this, arguments);
    const scene = this, p = scene.player, args = arguments;
    giveBlock(scene, def.blockMs);   // พุ่งทะยาน = บล็อก 1 ครั้ง
    const sx = p.x, sy = p.y;
    const nx = clamp(sx + (fx || 0) * def.range, 20, WORLD_W - 20);
    const ny = clamp(sy + (fy || 0) * def.range, 20, WORLD_H - 20);
    const res = withoutDamage(scene, () => _apply.apply(scene, args));
    let n = 0;
    scene.enemies.getChildren().slice().forEach(e => {
      if (!e.active) return;
      const hit = distToSeg(e.x, e.y, sx, sy, nx, ny) <= (def.pathW || 55)
        || Phaser.Math.Distance.Between(x, y, e.x, e.y) < 90
        || Phaser.Math.Distance.Between(nx, ny, e.x, e.y) < 70;
      if (hit) { n++; scene.damage(e, dmg); }
    });
    if (n > 1) scene.popText(sx, sy - 40, 'ทะลวง x' + n + '!', '#ffe066');
    return res;
  };

  // ---------- เอฟเฟกต์สกิล (this = scene) ----------
  // ฟันตรง: ฟันเป็นแนวยาวกว้าง ไม่สตั้น (บัพโจมตีอยู่ใน useSkill ด้านล่าง)
  Classes.handlers.sslash = function (def, x, y, dmg, fx, fy) {
    slashBox(this, def, dmg, fx, fy, 0xffffff, false);
  };

  Classes.handlers.sstun = function (def, x, y, dmg, fx, fy) {
    slashBox(this, def, dmg, fx, fy, 0xffd45e, true);
    // ฟื้นเลือดอย่างมากทันทีที่ใช้ (% ของ HP สูงสุด)
    if (def.healPct && this.healPlayer) {
      const amt = Math.round(this.maxHp() * def.healPct);
      this.healPlayer(amt);
      this.popText(this.player.x, this.player.y - 62, '💚 +' + amt, '#7dff9b');
    }
  };

  // ฟันหมุน: ฟันรอบตัวหลายครั้ง (spins) | ครั้งแรกเพิ่มเกราะ + บล็อก + นัดต่อไปเรียกตัวเองซ้ำเพื่อให้ภาพหมุนเล่นใหม่ทุกครั้ง
  Classes.handlers.sspin = function (def, x, y, dmg, fx, fy) {
    const scene = this, p = scene.player, col = CLASSES.sword ? CLASSES.sword.color : 0xffffff;
    const now = scene.time.now, cont = scene._swSpin;
    scene._swSpin = null;
    const fresh = !(cont && now - cont.t < 250);
    const left = fresh ? Math.max(0, (def.spins || 1) - 1) : cont.left;   // จำนวนครั้งที่ยังเหลือหลังครั้งนี้

    scene.flash(p.x, p.y, def.range, col);
    scene.time.delayedCall(110, () => scene.flash(p.x, p.y, def.range * 0.6, 0xffffff));
    Classes.enemiesIn(scene, p.x, p.y, def.range).forEach(e => scene.damage(e, dmg));
    if (fresh) { armorBuff(scene, def); giveBlock(scene, def.blockMs); }   // บล็อกเฉพาะตอนร่ายจริง ไม่ใช่ทุกรอบหมุน

    if (left > 0) {
      scene.time.delayedCall(def.spinGap || 350, () => {
        if (!scene.player) return;
        scene._swSpin = { t: scene.time.now, left: left - 1 };
        scene.applySkillEffect(def, scene.player.x, scene.player.y, fx, fy, dmg, def.class);
      });
    }
  };

  Classes.handlers.sult = function (def, x, y, dmg, fx, fy) {
    slashBox(this, def, dmg, fx, fy, 0xff6b5e, true);
  };

  // ---------- ใช้สกิล: ตั้งทิศ (ฟันสตั้น/ฟันตรง) + บัพโจมตี (ฟันตรง) ----------
  const _useSkill = P.useSkill;
  P.useSkill = function (idx, gp) {
    const sid = this.slots && this.slots[idx];
    const def = sid && SKILL_DEFS[sid];
    if (def && (def.type === 'sstun' || def.type === 'sslash') && !this.panel &&
        this.time.now >= (this.cdEnd['slot' + idx] || 0) && this.stats.mp >= def.mp) {
      const d = aimDir(this, gp);
      this.facing.set(d.x, d.y);
    }
    if (def && sid === 'sw_slash' && !this.panel) {
      const key = 'slot' + idx, before = this.cdEnd[key];
      const r = _useSkill.call(this, idx, gp);
      if (this.cdEnd[key] !== before) atkBuff(this, def);   // ฟันสำเร็จจริงเท่านั้นถึงได้บัพ
      return r;
    }
    return _useSkill.call(this, idx, gp);
  };

  const _useUlti = P.useUlti;
  P.useUlti = function (gp) {
    const def = this.ultiClass === 'sword' && ULTI_DEFS.sword;
    if (def && !this.panel && this.time.now >= (this.cdEnd.ulti || 0) && this.stats.mp >= def.mp) {
      const d = aimDir(this, gp);
      this.facing.set(d.x, d.y);
    }
    return _useUlti.call(this, gp);
  };

  // ---------- สตั้น: มอนที่โดนจะหยุดเดินจนหมดเวลา (เปลี่ยนสีเหลือง) ----------
  const _ue = P.updateEnemies;
  P.updateEnemies = function (time) {
    _ue.call(this, time);
    this.enemies.getChildren().forEach(e => {
      const fx = e._fx, st = fx && fx.stun;
      if (st) {
        if (time >= st.until) {
          delete fx.stun;
          if (e._stunTint) { e.clearTint(); e._stunTint = false; }
        } else {
          if (e.body) e.setVelocity(0, 0);
          e.setTint(0xfff27a); e._stunTint = true;
        }
      } else if (e._stunTint) { e.clearTint(); e._stunTint = false; }
    });
  };

  // ---------- ไอคอน ----------
  const _sik = skillIconKey;
  skillIconKey = function (type) {
    if (type === 'sstun' || type === 'sslash') return _sik('melee');
    if (type === 'sspin' || type === 'sult') return _sik('aoe');
    return _sik(type);
  };
})();
