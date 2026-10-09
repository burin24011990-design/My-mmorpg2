// ===== หมุนจอแล้วเริ่มเกมต่ออัตโนมัติ (ไม่ต้องล็อกอิน/กดเริ่มเล่นใหม่) =====
// main.js ตั้งแฟลก sessionStorage 'xh_resume' ก่อนโหลดหน้าใหม่ (เฉพาะตอนที่เกมเริ่มเล่นแล้ว)
// ไฟล์นี้รอให้หน้าเริ่มเกมพร้อม (Google ล็อกอินค้างอยู่ / หรือโหมดผู้เยี่ยมชม) แล้วกด "เริ่มเล่น" ให้เอง
// ไม่แตะ startScreen.js | ถ้าเจอกล่องถามข้อมูลเซฟชนกัน จะหยุดให้ผู้เล่นเลือกเอง
(function () {
  var raw = null;
  try { raw = sessionStorage.getItem('xh_resume'); sessionStorage.removeItem('xh_resume'); } catch (e) {}
  if (!raw) return;
  var r = null;
  try { r = JSON.parse(raw); } catch (e) {}
  if (!r || Date.now() - r.t > 60000) return;     // แฟลกเก่าเกิน 1 นาที = ไม่ใช่การหมุนจอ

  var $ = function (id) { return document.getElementById(id); };
  var t0 = Date.now(), guestClicked = false;
  var timer = setInterval(function () {
    var ls = $('login-screen');
    if (Date.now() - t0 > 25000 || document.querySelector('.ls-modal') || !ls || ls.style.display === 'none' || ls.classList.contains('out')) {
      clearInterval(timer); return;
    }
    var login = $('v-login'), ready = $('v-ready'), start = $('btn-start'), name = $('in-name');
    // โหมดผู้เยี่ยมชม: กดปุ่มผู้เยี่ยมชมก่อน
    if (r.guest && login && !login.hidden && !guestClicked && $('btn-guest')) { guestClicked = true; $('btn-guest').click(); return; }
    // พร้อมแล้ว (ซิงก์เสร็จ ปุ่มเริ่มเล่นใช้ได้ และมีชื่อตัวละคร) -> เริ่มเล่น
    if (ready && !ready.hidden && start && !start.disabled && name && String(name.value).trim().length >= 2) {
      clearInterval(timer); start.click();
    }
  }, 250);
})();
