// ===== อาชีพดาบ (sword) — แก้ความสามารถสกิลของดาบที่ไฟล์นี้ =====
// สกิล 1 พุ่งทะยาน (sw_dash)  | ลากเลือกทิศได้
// สกิล 2 ฟันสตั้น   (sw_cross) | ฟันตรงด้านหน้าเป็นแนวกว้าง สตั้นมอน | ลากเลือกทิศได้
// สกิล 3 ฟันหมุน    (sw_spin)  | ฟันรอบตัววงกว้าง + เพิ่มเกราะให้ตัวเอง
// อัลติ  ดาบสังหาร           | ฟันตรงเป็นแนวกว้างมาก สตั้นมอน | ลากเลือกทิศได้
// dmg = ค่าฐาน | range = ระยะ (ฟันตรง = ความยาว, ฟันหมุน = รัศมี) | cd = คูลดาวน์ (มิลลิวินาที) | mp = มานา
// scale = ตัวคูณสเตตัส: ดาเมจ = dmg x เลเวลสกิล + ตัวคูณ x สเตตัส
(function () {
  const Classes = window.Classes;
  if (!Classes) throw new Error('sword.js: ไม่พบ window.Classes -> _shared.js ไม่ทำงาน/โหลดไม่ขึ้น (ดู error ก่อนหน้า)');

  const P = Main.prototype;
  const TEST_UNLOCK = true;   // true = ปลดล็อกสกิลดาบทันทีเพื่อทดสอบ (ทดสอบเสร็จเปลี่ยนเป็น false ให้ได้จากหนังสือสกิล)
  const SW_IDS = ['sw_spin', 'sw_dash', 'sw_cross'];
  const BOSS_STUN_MUL = 0.5;  // บอสโดนสตั้นสั้นลงครึ่งหนึ่ง (ตั้ง 1 = เท่ามอนทั่วไป)
  const ARMOR_STAT = null;    // ชื่อสเตตัสเกราะใน stats.js (null = เดาอัตโนมัติจาก pdef/def/armor/defense)
  const ARMOR_KEYS = ['pdef', 'def', 'armor', 'defense', 'pdf'];

  // ---------- ข้อมูลสกิล (ปรับตัวเลขได้ตรงนี้) ----------
  Classes.basic('sword', { name: 'โจมตี', dmg: 10, range: 60, cd: 650, type: 'melee', class: 'sword' });

  Classes.skill('sw_slash', { name: 'ฟันตรง', class: 'sword', dmg: 12, range: 60, cd: 650, mp: 8, type: 'melee' }, { scale: { patk: 1 } });

  // สกิล 1: พุ่งทะยาน (เหมือนเดิม)
  Classes.skill('sw_dash', { name: 'พุ่งทะยาน', class: 'sword', dmg: 16, range: 150, cd: 3600, mp: 14, type: 'dash' }, { scale: { patk: 1 } });

  // สกิล 2: ฟันสตั้น — ฟันตรงด้านหน้า ยาว range กว้าง halfW*2 | สตั้น stunMs มิลลิวินาที
  Classes.skill('sw_cross', {
    name: 'ฟันสตั้น', class: 'sword', type: 'sstun', noInfo: true,
    dmg: 22, range: 120, halfW: 50, cd: 4000, mp: 14, stunMs: 1500,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => 'ฟันตรงด้านหน้าเป็นแนวกว้าง ดาเมจ ≈' + Classes.power(def.id, def, lv, S) +
      ' สตั้น ' + (def.stunMs / 1000) + ' วิ • ลากเลือกทิศได้ • คูลดาวน์ ' + Classes.cdText(def, S),
  });

  // สกิล 3: ฟันหมุน — ฟันรอบตัวรัศมี range | เพิ่มเกราะ armor นาน armorMs มิลลิวินาที
  Classes.skill('sw_spin', {
    name: 'ฟันหมุน', class: 'sword', type: 'sspin', noInfo: true,
    dmg: 18, range: 150, cd: 5000, mp: 18, armor: 30, armorMs: 6000,
  }, {
    scale: { patk: 1 },
    info: (def, lv, S) => 'ฟันรอบตัววงกว้าง ดาเมจ ≈' + Classes.power(def.id, def, lv, S) +
      ' เพิ่มเกราะ +' + def.armor + ' นาน ' + (def.armorMs / 1000) + ' วิ • คูลดาวน์ ' + Classes.cdText(def, S),
  });

  // อัลติ ดาบสังหาร — ฟันตรงยาว range กว้าง halfW*2 | สตั้น stunMs | ลากเลือกทิศได้
  Classes.ulti('sword', {
    name: 'ดาบสังหาร', dmg: 70, range: 240, halfW: 85, cd: ULTI_CD, mp: 50, type: 'sult', stunMs: 2000,
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

  // ฟันตรงเป็นแนวสี่เหลี่ยม: ยาว def.range กว้าง def.halfW*2 ไปทางทิศ (fx,fy) แล้วสตั้นทุกตัวที่โดน
  function slashBox(scene, def, dmg, fx, fy, color) {
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
    list.forEach(e => { stun(scene, e, def.stunMs); scene.damage(e, dmg); });
    if (list.length) scene.popText(p.x, p.y - 40, 'สตั้น!', '#ffe066');
  }

  // เพิ่มเกราะให้ตัวเอง (ผ่านระบบบัพสเตตัสของ stats.js)
  function armorBuff(scene, def) {
    let ok = false;
    try {
      const S = scene.getStats ? scene.getStats() : null;
      const key = ARMOR_STAT || ARMOR_KEYS.find(k => S && (k in S));
      if (key && scene.addStatBuff) {
        const o = {}; o[key] = def.armor;
        scene.addStatBuff('sw_armor', o, def.armorMs);
        ok = true;
      }
    } catch (e) { console.error('armorBuff', e); }
    if (ok) scene.toastMsg('🛡 เกราะ +' + def.armor + ' นาน ' + (def.armorMs / 1000) + ' วิ');
    else if (scene.time.now > (scene._swArmorWarnAt || 0)) {
      scene._swArmorWarnAt = scene.time.now + 4000;
      console.warn('sword.js: เพิ่มเกราะไม่ได้ (ไม่พบสเตตัสเกราะ/addStatBuff) ดูชื่อสเตตัสใน stats.js แล้วใส่ที่ ARMOR_STAT');
      scene.toastMsg('⚠ เพิ่มเกราะไม่ได้ (ดู console)');
    }
  }

  // ---------- เอฟเฟกต์สกิล (this = scene) ----------
  Classes.handlers.sstun = function (def, x, y, dmg, fx, fy) {
    slashBox(this, def, dmg, fx, fy, 0xffd45e);
  };

  Classes.handlers.sspin = function (def, x, y, dmg) {
    const p = this.player, col = CLASSES.sword ? CLASSES.sword.color : 0xffffff;
    this.flash(p.x, p.y, def.range, col);
    this.time.delayedCall(110, () => this.flash(p.x, p.y, def.range * 0.6, 0xffffff));
    Classes.enemiesIn(this, p.x, p.y, def.range).forEach(e => this.damage(e, dmg));
    armorBuff(this, def);
  };

  Classes.handlers.sult = function (def, x, y, dmg, fx, fy) {
    slashBox(this, def, dmg, fx, fy, 0xff6b5e);
  };

  // ---------- ตั้งทิศก่อนใช้สกิล (ลากเลือก / หันหามอน / ทิศที่หันอยู่) ----------
  const _useSkill = P.useSkill;
  P.useSkill = function (idx, gp) {
    const sid = this.slots && this.slots[idx];
    const def = sid && SKILL_DEFS[sid];
    if (def && def.type === 'sstun' && !this.panel &&
        this.time.now >= (this.cdEnd['slot' + idx] || 0) && this.stats.mp >= def.mp) {
      const d = aimDir(this, gp);
      this.facing.set(d.x, d.y);
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
    if (type === 'sstun') return _sik('melee');
    if (type === 'sspin' || type === 'sult') return _sik('aoe');
    return _sik(type);
  };
})();
