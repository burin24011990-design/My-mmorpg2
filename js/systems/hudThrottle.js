// hudThrottle.js — ลดความถี่การวาด HUD/มินิแมปของ ui.js (updateHud) จากทุกเฟรม เหลือทุก ~120ms
// วางที่ js/systems/hudThrottle.js และใส่ใน index.html "ต่อจาก ui.js" (ก่อน topbar.js)
//   <script src="js/systems/hudThrottle.js?v=1"></script>
(function () {
  const orig = Main.prototype.updateHud;
  Main.prototype.updateHud = function () {
    const now = this.time.now;
    if (now < (this._hudNext || 0)) return;
    this._hudNext = now + 120;
    return orig.apply(this, arguments);
  };
})();
