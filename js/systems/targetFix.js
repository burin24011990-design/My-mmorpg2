/* targetFix.js — แก้ล็อกเป้าหมาย: ถ้าล็อกมือค้างอยู่ที่มอนตัวไกล/ตัวเก่า ให้ปล่อยแล้วกลับไปล็อกตัวที่ใกล้ที่สุด
 * ติดตั้ง: วางที่ js/systems/targetFix.js ใส่ใน index.html ท้ายสุดก่อน js/main.js (หลังไฟล์อื่นทั้งหมด)
 *   <script src="js/systems/targetFix.js?v=1"></script>
 * กติกา:
 *   - ล็อกมือ (แตะที่มอน) ใช้ได้เฉพาะตัวที่อยู่ในระยะ TARGET_RANGE x 1.3
 *   - ล็อกมือค้างเกิน HOLD_MS แล้วมีมอนอื่นใกล้กว่ามาก -> ปล่อย ไปล็อกตัวใกล้สุด
 *   - ไม่มีล็อกมือ -> ล็อกตัวที่ใกล้ที่สุดในระยะ (ของเดิม)
 */
(function () {
  var HOLD_MS = 3000;        // ล็อกมือค้างได้นานเท่านี้ก่อนจะยอมให้ตัวที่ใกล้กว่าแทน
  var CLOSER_BY = 60;        // ตัวใกล้สุดต้องใกล้กว่าตัวที่ล็อกมืออย่างน้อยเท่านี้ (px)
  var RANGE_MUL = 1.3;       // ล็อกมือเกินระยะนี้ (x TARGET_RANGE) = ปล่อย

  var _orig = Main.prototype.updateTargeting;
  Main.prototype.updateTargeting = function () {
    try {
      var m = this.manualTarget, now = this.time.now;
      if (m !== this._mtPrev) { this._mtPrev = m; this._mtSince = now; }   // จับเวลาตอนเริ่มล็อกมือ
      if (m) {
        var p = this.player;
        if (!m.active) {
          this.manualTarget = null;
        } else {
          var dm = Phaser.Math.Distance.Between(p.x, p.y, m.x, m.y);
          var range = (typeof TARGET_RANGE !== 'undefined' ? TARGET_RANGE : 300);
          if (dm > range * RANGE_MUL) {
            this.manualTarget = null;
          } else if (now - (this._mtSince || now) > HOLD_MS) {
            var n = this.nearestEnemy(range);
            if (n && n !== m && Phaser.Math.Distance.Between(p.x, p.y, n.x, n.y) < dm - CLOSER_BY) this.manualTarget = null;
          }
        }
      }
    } catch (e) { /* ปล่อยให้ของเดิมทำงานต่อ */ }
    return _orig.apply(this, arguments);
  };
})();
