// ===== ระบบเซฟ/โหลด (localStorage ในเบราว์เซอร์ของผู้เล่น) =====
// เซฟทุก 3 วินาที (เขียนเฉพาะตอนข้อมูลเปลี่ยน) + ตอนปิด/ซ่อนหน้าเว็บ | โหลดอัตโนมัติตอนเริ่มเกม
// เหตุการณ์สำคัญ (เลเวลอัป/เปลี่ยนอุปกรณ์/เรียนสกิล/ตีบวก/รวมดาว ฯลฯ) จะสั่งอัปโหลดขึ้นคลาวด์เร็วขึ้นผ่าน CloudSave.soon()
// ล้างเซฟ: เปิด Console แล้วพิมพ์ localStorage.removeItem('my_mmorpg_save_v1')
// เซฟสกิลช่องพิเศษ (flex) ด้วย: ช่องอันติที่ใส่สกิลอะไรก็ได้เมื่อไม่มีคอมโบ (ดู flexSlot.js)
// เซฟข้อมูลบ้าน (house) และวัตถุดิบ (kind:'material') ด้วย (ดู house.js / houseData.js)
// v2: แก้ไอเทมหายหลังออกเกม -- เดิมตัวตรวจไอเทมตอนโหลดไม่รู้จัก การ์ด (card) / กุญแจถอดการ์ด (cardkey) / หินพลังวิเศษ (magicstone)
//     จึงทิ้งทั้งหมด + ตรวจหินออฟ/หินลบออฟเข้มเกิน | ตอนนี้: รู้จักทุกชนิด, ตรวจแบบหลวมขึ้น (ซ่อมจำนวนให้เป็นจำนวนเต็ม),
//     ชนิดที่ไม่รู้จักแต่หน้าตาเป็นไอเทมซ้อนได้ (มี kind + count) จะ "เก็บไว้" ไม่ทิ้ง, และถ้ามีของถูกข้ามจะแจ้งเตือนพร้อมชื่อชนิด

const SAVE_KEY = 'my_mmorpg_save_v1';

// โหลดเซฟก่อนโหลดด่านครั้งแรก (ไม่ต้องแก้ Main.js)
(function () {
  const _loadStage = Main.prototype.loadStage;
  Main.prototype.loadStage = function (idx) {
    if (!this._saveLoaded) {
      this._saveLoaded = true;
      const savedStage = this.loadGame();
      if (savedStage !== null) idx = savedStage;
      if (this.initSkillData) this.initSkillData();   // เตรียมเลเวลสกิล (เซฟเก่าที่ไม่มีข้อมูลสกิลก็ใช้ได้)
      this.startAutoSave();
    }
    return _loadStage.call(this, idx);
  };
})();

Object.assign(Main.prototype, {
  saveGame() {
    if (!this.stats || !this._saveLoaded) return;
    try {
      const data = {
        v: 1,
        stats: this.stats,
        bag: this.bag,                      // หนังสือสกิลเก็บอยู่ในกระเป๋าเป็นไอเทม
        equipment: this.equipment,
        learned: [...this.learnedSkills],
        skillLv: this.skillLv || {},
        slots: this.slots,
        flex: this.flexSid || null,         // สกิลช่องพิเศษ (ช่องอันติเมื่อไม่มีคอมโบ)
        kills: this.kills,
        house: this.house || null,          // ข้อมูลบ้าน (แปลงผัก ฯลฯ) ดู house.js
        stageIdx: this.stageIdx || 0,
        botCfg: this.botCfg || {},
        bossAt: (this.bossState || []).map(zs => zs.map(s => s.at)),
      };
      const str = JSON.stringify(data);
      if (str === this._lastSaveStr) return;          // ไม่มีอะไรเปลี่ยน ไม่ต้องเขียนซ้ำ
      this._lastSaveStr = str;
      data.savedAt = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));

      // เหตุการณ์สำคัญ (เลเวล / อุปกรณ์ที่สวม / จำนวนสกิลที่เรียน เปลี่ยน) -> ขอให้คลาวด์อัปโหลดเร็วขึ้น
      const key = this.stats.level + '|' + JSON.stringify(this.equipment) + '|' + this.learnedSkills.size;
      if (this._lastKey && key !== this._lastKey && window.CloudSave) window.CloudSave.soon();
      this._lastKey = key;
    } catch (e) { /* พื้นที่เต็ม/ถูกบล็อก: ข้าม */ }
  },

  // เซฟเครื่องทันที + ขอให้คลาวด์อัปโหลดเร็วขึ้น (เรียกจากระบบอื่นหลังทำอะไรสำคัญ)
  saveSoon() {
    this.saveGame();
    if (window.CloudSave) window.CloudSave.soon();
  },

  startAutoSave() {
    this._lastSaveStr = '';
    this._lastKey = '';
    this.time.addEvent({ delay: 3000, loop: true, callback: () => this.saveGame() });
    const flush = () => this.saveGame();
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.GameSaveNow = flush;   // ให้ startScreen.js เรียกเซฟเครื่องก่อนอัปโหลดขึ้นคลาวด์เสมอ
  },

  // คืนค่า index ด่านที่จะเริ่ม หรือ null ถ้าไม่มีเซฟ
  loadGame() {
    let d;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      d = JSON.parse(raw);
    } catch (e) { return null; }
    if (!d || d.v !== 1) return null;

    try {
      // ---- ตรวจไอเทมในกระเป๋า ----
      // ชนิดที่ "ซ้อนกองได้และมีแค่ kind + count (+ ข้อมูลประจำชนิด)" ตรวจแบบหลวม แล้วซ่อมจำนวนให้เป็นจำนวนเต็มบวก
      const STACK_KINDS = ['stone', 'cleanstone', 'optstone', 'card', 'cardkey', 'magicstone'];
      const cntOf = it => Math.floor(Number(it.count));
      const dropped = {};     // ชนิดที่ถูกข้าม (ไว้แจ้งเตือน)
      const skip = kind => { dropped[kind] = (dropped[kind] || 0) + 1; return false; };

      const validItem = it => {
        if (!it || typeof it !== 'object') return false;
        const k = it.kind;
        if (k === 'box') return (Number.isFinite(it.level) && Number.isFinite(it.count)) || skip(k);
        if (k === 'skillbook') return (SKILL_DEFS[it.sid] && Number.isFinite(it.count) && it.count > 0) || skip(k);
        if (k === 'potion') return (POTIONS[it.pid] && Number.isFinite(it.count) && it.count > 0) || skip(k);
        // วัตถุดิบระบบบ้าน (ปลา เหยื่อ ผัก ฯลฯ) ดู houseData.js
        if (k === 'material') return (typeof MAT_DEFS !== 'undefined' && MAT_DEFS[it.mid] && Number.isFinite(it.count) && it.count > 0) || skip(k);
        if (k === 'equip') {
          return (STAT_GROWTH[it.baseSlot] && Number.isFinite(it.level) && Number.isFinite(it.star) &&
            (it.baseSlot !== 'weapon' || CLASSES[it.class])) || skip(k);
        }
        // หิน / การ์ด / กุญแจ / หินพลังวิเศษ: ตรวจหลวม (จำนวนเป็นเลขบวกก็พอ)
        if (STACK_KINDS.indexOf(k) >= 0) return cntOf(it) > 0 || skip(k);
        // ชนิดที่ไม่รู้จัก (ไฟล์ระบบใหม่ๆ ที่ยังไม่ได้ใส่ที่นี่): ถ้าหน้าตาเป็นไอเทมซ้อนได้ (kind เป็นตัวอักษร + count เป็นเลขบวก) เก็บไว้ ไม่ทิ้ง
        if (typeof k === 'string' && /^[a-z][a-z0-9_]{1,24}$/.test(k) && cntOf(it) > 0) return true;
        return skip(String(k));
      };

      const s = d.stats || {};
      ['level', 'exp', 'hp', 'mp', 'gold', 'maxHp', 'maxMp', 'baseAtk'].forEach(k => {
        if (typeof s[k] === 'number' && isFinite(s[k])) this.stats[k] = s[k];
      });
      this.stats.level = Phaser.Math.Clamp(Math.floor(this.stats.level), 1, LEVEL_CAP);
      this.stats.expNext = levelExpNeeded(this.stats.level);

      const stackCap = kind => {
        if (kind === 'card' || kind === 'cardkey') return (typeof MAX_CARD_STACK !== 'undefined') ? MAX_CARD_STACK : 999;
        return (typeof MAX_STONE_STACK !== 'undefined') ? MAX_STONE_STACK : 9999;
      };

      const bag = new Array(BAG_SIZE).fill(null);
      (Array.isArray(d.bag) ? d.bag : []).forEach((it, i) => {
        if (i < BAG_SIZE && validItem(it)) {
          if (it.kind === 'skillbook') it = { kind: 'skillbook', sid: it.sid, count: Math.min(MAX_SKILLBOOK_STACK, Math.floor(it.count)) };
          else if (STACK_KINDS.indexOf(it.kind) >= 0) {
            it = { ...it, count: Math.min(stackCap(it.kind), cntOf(it)) };
            if (it.kind === 'optstone' && !it.color) it.color = 'red';    // ซ่อมหินออฟที่ข้อมูลสีหาย
          }
          if (it.kind === 'material' && typeof MAX_MAT_STACK !== 'undefined') {
            it = { kind: 'material', mid: it.mid, count: Math.min(MAX_MAT_STACK, Math.floor(it.count)) };
          }
          bag[i] = it;
        }
      });
      this.bag = bag;

      Object.keys(this.equipment).forEach(k => {
        const it = d.equipment && d.equipment[k];
        this.equipment[k] = it && it.kind === 'equip' && validItem(it) ? it : null;
      });

      this.learnedSkills = new Set(['sw_slash']);
      (Array.isArray(d.learned) ? d.learned : []).forEach(sid => { if (SKILL_DEFS[sid]) this.learnedSkills.add(sid); });

      // เลเวลสกิล (เซฟเก่าที่ไม่มีข้อมูล = Lv.1)
      this.skillLv = {};
      this.learnedSkills.forEach(sid => {
        const lv = d.skillLv ? Number(d.skillLv[sid]) : NaN;
        this.skillLv[sid] = Number.isFinite(lv) ? Phaser.Math.Clamp(Math.floor(lv), 1, SKILL_MAX_LV) : 1;
      });

      // แปลงหนังสือสกิลแบบเก่า (skillBooks ที่เก็บเป็นตัวเลข) ให้เป็นไอเทมในกระเป๋า
      if (d.skillBooks && typeof d.skillBooks === 'object') {
        Object.keys(d.skillBooks).forEach(sid => {
          const n = Math.floor(Number(d.skillBooks[sid]));
          if (SKILL_DEFS[sid] && Number.isFinite(n) && n > 0) this.addSkillBookToBag(sid, n);
        });
      }

      this.slots = [0, 1, 2, 3].map(i => {
        const sid = Array.isArray(d.slots) ? d.slots[i] : null;
        return sid && this.learnedSkills.has(sid) ? sid : null;
      });

      // สกิลช่องพิเศษ: ต้องเป็นสกิลที่เรียนแล้ว และไม่ซ้ำกับช่องหลัก
      const fx = d.flex;
      this.flexSid = (fx && SKILL_DEFS[fx] && this.learnedSkills.has(fx) && this.slots.indexOf(fx) < 0) ? fx : null;

      this.kills = Number.isFinite(d.kills) ? d.kills : 0;
      this.house = (d.house && typeof d.house === 'object') ? d.house : null;   // ข้อมูลบ้าน (house.js ตรวจ/เติมค่าเริ่มต้นเอง)
      this.botCfg = d.botCfg && typeof d.botCfg === 'object' ? d.botCfg : {};
      this.bossState = ZONES.map((_, zi) => Array.from({ length: BOSS_COUNT }, (__, i) => {
        const at = d.bossAt && d.bossAt[zi] ? Number(d.bossAt[zi][i]) : 0;
        return { alive: false, at: Number.isFinite(at) ? at : 0 };
      }));

      this.computeAtk();
      if (!(this.stats.hp > 0)) this.stats.hp = this.maxHp();
      this.computeCombo();

      let si = Number.isInteger(d.stageIdx) ? d.stageIdx : 0;
      if (!ZONES[si] || this.stats.level < ZONES[si].reqLv) si = 0;
      this.toastMsg('โหลดเซฟแล้ว (Lv.' + this.stats.level + ')');

      // แจ้งถ้ามีไอเทมถูกข้ามตอนโหลด (บอกชนิด จะได้รู้ว่าระบบไหนยังเซฟไม่ได้)
      const dk = Object.keys(dropped);
      if (dk.length) {
        console.warn('save.js: ข้ามไอเทมตอนโหลด', dropped);
        const txt = dk.map(k => k + ' x' + dropped[k]).join(', ');
        setTimeout(() => { try { this.toastMsg('⚠ ข้ามไอเทมที่ข้อมูลผิดปกติ: ' + txt); } catch (e) {} }, 1800);
      }
      return si;
    } catch (e) {
      console.error('โหลดเซฟไม่สำเร็จ', e);
      return null;
    }
  },
});
