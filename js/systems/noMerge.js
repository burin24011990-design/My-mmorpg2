// ===== ยกเลิกระบบรวมดาว =====
// ใส่ไฟล์นี้ "ท้ายสุด" ก่อน main.js (หลัง mergePlus.js / bagWindow.js / magicRoll.js)
// - itemsMatch ตอบ "ไม่ตรงกัน" เสมอ -> ไม่รวมดาวอัตโนมัติตอนเก็บของ และนับคู่ที่รวมได้ = 0
// - ฟังก์ชันรวมดาวทุกตัวถูกปิด + ซ่อนปุ่มรวมดาวในหน้าต่างกระเป๋า
// ของที่มีดาวอยู่แล้วยังคงดาวและค่าสเตตัสเดิม | ย้อนกลับได้โดยลบไฟล์นี้ออกจาก index.html
(function () {
  const P = Main.prototype;
  const MSG = 'ระบบรวมดาวถูกยกเลิกแล้ว';

  try { itemsMatch = function () { return false; }; } catch (e) { /* ไม่มีตัวแปรนี้ก็ข้าม */ }
  window.itemsMatch = function () { return false; };

  P.mergeSingleItem = function () { if (this.toastMsg) this.toastMsg(MSG); return false; };
  P.mergeAllInBag = function () { return 0; };
  P.mergeSelectedCount = function () { if (this.toastMsg) this.toastMsg(MSG); return 0; };
  P.mergeIndices = function (list, dryRun) {
    if (!dryRun && this.toastMsg) this.toastMsg(MSG);
    return 0;
  };
  P.countMatches = function () { return 0; };

  // ซ่อนปุ่มรวมดาว / เลือกหลายชิ้น ในหน้าต่างกระเป๋า (bagWindow.js)
  const css = document.createElement('style');
  css.textContent = '#bag-win [data-act="merge"],#bag-win [data-act="merge-all"],#bag-win [data-act="merge-sel"],' +
    '#bag-win [data-act="multi"],#bag-win [data-act="tick-clear"]{display:none!important}';
  document.head.appendChild(css);

  // ซ่อนแถว "อัพดาว / รวมของเหมือนกัน 2 ชิ้น" ในรายละเอียดอุปกรณ์ (หน้าต่างถูกวาดใหม่ทุกครั้งที่แตะ จึงคอยดู)
  let queued = false;
  function hideRows() {
    queued = false;
    document.querySelectorAll('#bag-win .d-row').forEach(function (r) {
      const t = r.firstElementChild;
      if (t && t.textContent.trim() === 'อัพดาว') r.style.display = 'none';
    });
  }
  function watch() {
    const layer = document.getElementById('ui-layer');
    if (!layer) return setTimeout(watch, 500);
    new MutationObserver(function () {
      if (!queued) { queued = true; requestAnimationFrame(hideRows); }
    }).observe(layer, { childList: true, subtree: true });
  }
  watch();
})();
