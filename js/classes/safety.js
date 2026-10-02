// ===== ตาข่ายนิรภัย: อาวุธ/คลาสใหม่ที่ยังไม่ได้ลงทะเบียน ใช้ค่าของดาบแทน ไม่ให้เกมค้าง =====
// โหลดต่อจาก js/classes/shared.js (ก่อนไฟล์อาชีพ) | เมื่อลงทะเบียนคลาสใหม่ด้วย Classes.basic(...) ครบแล้ว ไฟล์นี้จะไม่ทำงานกับคลาสนั้น
(function () {
  try {
    if (typeof BASIC_ATTACKS === 'undefined' || !BASIC_ATTACKS.sword) return;
    const warned = {};
    Object.setPrototypeOf(BASIC_ATTACKS, new Proxy({}, {
      get: function (_, key) {
        if (typeof key !== 'string') return undefined;
        if (key in Object.prototype) return Object.prototype[key];   // toString, hasOwnProperty ฯลฯ ทำงานปกติ
        if (!warned[key]) {
          warned[key] = true;
          console.warn('[safety] คลาส/อาวุธ "' + key + '" ยังไม่มีใน BASIC_ATTACKS (ใช้ค่าของดาบแทน) ให้เพิ่ม Classes.basic("' + key + '", {...}) ในไฟล์อาชีพนั้น');
        }
        return BASIC_ATTACKS.sword;
      },
    }));
  } catch (e) { console.error('safety.js', e); }
})();
