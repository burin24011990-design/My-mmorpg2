// ===== ค่าโจมตีพื้นฐานสำรองของอาวุธใหม่: กริช/มีด (rogue) และ สมุด (priest) =====
// โหลดหลังไฟล์ sword.js, mage.js, archer.js, priest.js, rogue.js (ก่อน stats.js)
// ทำงานเฉพาะคลาสที่ "ยังไม่มี" BASIC_ATTACKS ของตัวเอง (ถ้า rogue.js / priest.js ลงทะเบียนไว้แล้ว ไฟล์นี้จะไม่แตะ)
// ค่าต่างๆ คำนวณจากของดาบ/คทาที่มีอยู่ จึงสมดุลกับเกมโดยไม่ต้องเดาตัวเลข | ปรับตัวคูณได้ด้านล่าง
(function () {
  try {
    const has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };   // ไม่ใช้ BASIC_ATTACKS[k] ตรงๆ เพราะตาข่าย safety จะตอบค่าของดาบ
    const make = function (id, baseId, tweak, label, color) {
      if (has(BASIC_ATTACKS, id)) return;
      const base = BASIC_ATTACKS[baseId];
      if (!has(BASIC_ATTACKS, baseId) || !base) return;
      BASIC_ATTACKS[id] = Object.assign({}, base, tweak(base));
      if (window.Classes && Classes.defineClass) Classes.defineClass(id, { label: label, color: color });
    };

    // กริช/มีด: ตีระยะใกล้ เร็วกว่าดาบ ระยะสั้นกว่านิดหน่อย
    make('rogue', 'sword', function (b) {
      return { type: 'melee', cd: Math.round(b.cd * 0.7), range: Math.round((b.range || 60) * 0.85), dmg: b.dmg };
    }, 'โจร', 0x9b6bd6);

    // สมุด: ยิงเวทระยะไกล ช้ากว่าคทาเล็กน้อย แรงกว่านิดหน่อย
    make('priest', 'mage', function (b) {
      return { type: 'proj', cd: Math.round(b.cd * 1.1), dmg: Math.round(b.dmg * 1.1) };
    }, 'นักบวช', 0xf2e6a0);
  } catch (e) { console.error('weapons_fallback.js', e); }
})();
