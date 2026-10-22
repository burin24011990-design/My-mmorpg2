// ===== ปรับสมดุลมอนสเตอร์/บอส: เลือดลด ดาเมจเพิ่ม + ปิด Epic + เพิ่มจำนวนมอน =====
// โหลดหลัง monsters.js / rebirth.js (ต้องหลัง rebirth.js เพราะมันคูณ hpMul/dmgMul ของด่านจุติ) และก่อน main.js
// วิธีทำงาน: ครอบฟังก์ชันเกิดของมอน แล้วคูณ "เลือด" และ "ดาเมจ" ที่คำนวณเสร็จแล้วอีกชั้น ไม่ต้องแก้ monsters.js / zones.js
// ใช้กับมอนในเครื่อง (โหมดปกติ) เท่านั้น -- มอนโหมดห้องออนไลน์ (roomMonsters.js) คุมโดย server.js ต้องแก้ฝั่งนั้นแยก
// ดาเมจนี้เป็นค่าก่อนหักเกราะของผู้เล่น (เกราะจาก VIT/STR/เลเวล จะลดลงอีกชั้นตอนโดนตี)
(function () {
  const P = Main.prototype;

  // ===== ปรับตรงนี้ =====
  // hp  = ตัวคูณเลือด  (1 = เท่าเดิม, 0.5 = เหลือครึ่งเดียว)
  // dmg = ตัวคูณดาเมจ  (1 = เท่าเดิม, 2.5 = แรงขึ้น 2.5 เท่า) -- มีผลกับทั้งชนตัว กระสุน และสกิลของบอส/Epic
  const TUNE = {
    normal: { hp: 0.5, dmg: 2.5 },   // มอนธรรมดา
    ranged: { hp: 0.5, dmg: 2.5 },   // มอนยิงไกล
    epic:   { hp: 0.5, dmg: 2.5 },   // Epic
    boss:   { hp: 0.5, dmg: 3.0 },   // มินิบอส
  };

  // ===== จำนวนมอน / Epic =====
  const COUNT_MUL = 2;          // จำนวนมอนธรรมดาและยิงไกลต่อแผนที่ x เท่านี้ (1 = เท่าเดิม) | ถ้าเครื่องเริ่มแลคให้ลดเหลือ 1.5
  const EPIC_ENABLED = false;   // false = ไม่มีมอน Epic เลย (true = กลับมาเกิดตามเดิม)

  // คูณจำนวนมอนของทุกด่าน (ทำครั้งเดียวตอนโหลดไฟล์ | เมืองไม่มีมอนจึงข้าม)
  if (typeof ZONES !== 'undefined') {
    ZONES.forEach(function (z) {
      if (!z || z.town || z._countTuned) return;
      z._countTuned = true;
      z.count = Math.round((z.count || 0) * COUNT_MUL);
      z.rangedCount = Math.round((z.rangedCount || 0) * COUNT_MUL);
    });
  }

  function tune(e) {
    if (!e || e._tuned) return e;
    e._tuned = true;
    const t = TUNE[e.kind] || TUNE.normal;
    e.hp = Math.max(1, Math.round(e.hp * t.hp));
    e.maxHp = e.hp;
    e.dmg = Math.max(1, Math.round((e.dmg || 1) * t.dmg));
    return e;
  }

  // ===== ตัวตรวจสอบ (เปิดไว้ก่อน แล้วปิดเป็น false ทีหลัง) =====
  // เข้าด่านแล้วจะขึ้นข้อความบอกว่าไฟล์นี้ทำงานไหม / เป็นมอนในเครื่องหรือโหมดห้องออนไลน์ / มีมอนกี่ตัว / มี Epic กี่ตัว
  const DEBUG = true;
  if (DEBUG) {
    const _ls = P.loadStage;
    P.loadStage = function () {
      const r = _ls.apply(this, arguments);
      setTimeout(() => {
        try {
          const list = this.enemies ? this.enemies.getChildren() : [];
          const epics = list.filter(e => e.isEpic).length;
          this.toastMsg('[tune] ' + (this.rmActive ? 'โหมดห้องออนไลน์ (มอนมาจากเซิร์ฟเวอร์)' : 'มอนในเครื่อง') + ' | มอน ' + list.length + ' | Epic ' + epics);
        } catch (e) {}
      }, 2500);
      return r;
    };
  }

  ['spawnEnemyInZone', 'spawnBoss', 'spawnEpic'].forEach(function (name) {
    const orig = P[name];
    if (typeof orig !== 'function') return;
    P[name] = function () {
      if (name === 'spawnEpic' && !EPIC_ENABLED) return null;   // ปิด Epic: ไม่เสกเลย (ทั้งตอนเข้าด่านและตอนเกิดใหม่)
      return tune(orig.apply(this, arguments));
    };
  });
})();
