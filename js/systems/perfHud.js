/* perfHud.js — แผงวัดความลื่น (โชว์เฉพาะตอนเปิดเกมด้วยลิงก์ที่ต่อท้าย ?perf=1)
 * ติดตั้ง: วางที่ js/systems/perfHud.js แล้วใส่ใน index.html ก่อน js/main.js
 *   <script src="js/systems/perfHud.js?v=2"></script>
 * ถ้าไม่ต่อท้าย ?perf=1 ไฟล์นี้ไม่ทำอะไรเลย (ไม่กินเครื่อง)
 *
 * v2: เปลี่ยนวิธีจับเฟรม (v1 หา Phaser.GAMES ไม่เจอ แผงเลยค้างที่คำว่า perf...) ตอนนี้ครอบ Main.update แทน
 *
 * อ่านค่า (อัปเดตทุก 1 วินาที มุมขวาบน):
 *   FPS      = จำนวนเฟรมต่อวินาทีจริง (จอ 60Hz ควรได้ ~60 | จอ 90/120Hz ควรได้ 90/120)
 *   avg/max  = เวลาห่างระหว่างเฟรมเฉลี่ย / นานสุด (ms) | max สูงมาก (>100) = มีจังหวะสะดุดเป็นช่วงๆ
 *   spike    = จำนวนเฟรมที่ห่างกันเกิน 50ms ในวินาทีนั้น
 *   obj      = จำนวนวัตถุทั้งหมดในฉาก | text = จำนวนข้อความ | enemy = มอน | tween = แอนิเมชันที่กำลังเล่น | body = วัตถุฟิสิกส์
 */
(function () {
  if (!/[?&]perf=1/.test(location.search)) return;
  if (typeof Main === 'undefined' || !Main.prototype) return;

  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:6px;top:6px;z-index:99998;background:rgba(0,0,0,.72);color:#8f8;' +
    'font:11px/1.35 monospace;padding:4px 7px;white-space:pre;pointer-events:none;border-radius:6px';
  box.textContent = 'perf: รอเฟรมแรก...';
  function mount() { document.body.appendChild(box); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  var last = 0, lastShow = 0, n = 0, sum = 0, max = 0, spikes = 0;

  function show(sc) {
    var fps = n, avg = n ? sum / n : 0, mx = max, sp = spikes;
    n = 0; sum = 0; max = 0; spikes = 0;
    var info = '';
    try {
      var list = sc.children && sc.children.list ? sc.children.list : [], texts = 0;
      for (var i = 0; i < list.length; i++) if (list[i] && list[i].type === 'Text') texts++;
      var enemies = sc.enemies && sc.enemies.getLength ? sc.enemies.getLength() : 0;
      var tw = sc.tweens && sc.tweens.getTweens ? sc.tweens.getTweens().length : 0;
      var bodies = sc.physics && sc.physics.world && sc.physics.world.bodies ? sc.physics.world.bodies.size : 0;
      info = '\nobj ' + list.length + '  text ' + texts + '  enemy ' + enemies +
             '\ntween ' + tw + '  body ' + bodies;
    } catch (e) { /* ไม่ให้แผงวัดทำเกมพัง */ }
    box.style.color = fps >= 50 ? '#8f8' : (fps >= 30 ? '#ff8' : '#f88');
    box.textContent = 'FPS ' + fps + '\navg ' + avg.toFixed(1) + 'ms  max ' + mx.toFixed(0) + 'ms\nspike ' + sp + info;
  }

  var orig = Main.prototype.update;
  Main.prototype.update = function () {
    try {
      var now = performance.now();
      if (last) {
        var d = now - last;
        n++; sum += d;
        if (d > max) max = d;
        if (d > 50) spikes++;
      }
      last = now;
      if (now - lastShow >= 1000) { lastShow = now; show(this); }
    } catch (e) { /* ไม่ให้แผงวัดทำเกมพัง */ }
    return orig ? orig.apply(this, arguments) : undefined;
  };
})();
