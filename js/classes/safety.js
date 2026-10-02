// ===== ตาข่ายนิรภัย: อาวุธ/คลาสใหม่ที่ยังไม่ได้ลงทะเบียน ใช้ค่าของดาบแทน ไม่ให้เกมค้าง =====
// โหลดต่อจาก js/classes/shared.js (ก่อนไฟล์อาชีพ)
// ถ้าเจอคลาสที่ไม่รู้จัก จะแสดงชื่อคลาสในกล่องแดงบนหน้าจอ 1 ครั้ง (แตะเพื่อปิด) เพื่อให้รู้ว่าต้องลงทะเบียนชื่ออะไร
(function () {
  try {
    if (typeof BASIC_ATTACKS === 'undefined') return;
    const warned = {};
    const FALLBACK = { type: 'melee', range: 70, cd: 600, dmg: 10 };
    Object.setPrototypeOf(BASIC_ATTACKS, new Proxy({}, {
      get: function (_, key) {
        if (typeof key !== 'string') return undefined;
        if (key in Object.prototype) return Object.prototype[key];   // toString, hasOwnProperty ฯลฯ ทำงานปกติ
        if (!warned[key]) {
          warned[key] = true;
          const msg = '[safety] คลาส/อาวุธ "' + key + '" ยังไม่มีใน BASIC_ATTACKS (ใช้ค่าของดาบแทน) ต้องลงทะเบียน Classes.basic("' + key + '", {...})';
          console.warn(msg);
          try { window.dispatchEvent(new ErrorEvent('error', { message: msg })); } catch (e) {}
        }
        return BASIC_ATTACKS.sword || FALLBACK;
      },
    }));
  } catch (e) { console.error('safety.js', e); }
})();
