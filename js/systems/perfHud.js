/* perfHud.js — แผงวัดความลื่น + ปุ่มปิดทีละส่วนเพื่อหาตัวการแลค (โชว์เฉพาะตอนเปิดเกมด้วย ?perf=1)
 * ติดตั้ง: วางที่ js/systems/perfHud.js แล้วใส่ใน index.html ก่อน js/main.js
 *   <script src="js/systems/perfHud.js?v=3"></script>
 * ถ้าไม่ต่อท้าย ?perf=1 ไฟล์นี้ไม่ทำอะไรเลย (ไม่กินเครื่อง)
 *
 * บรรทัดบนสุด:  WebGL หรือ Canvas  + ขนาดเกม  -> ถ้าขึ้น Canvas แปลว่าเกมไม่ได้ใช้การ์ดจอ จะแลคหนักมาก
 * FPS / avg / max / spike : ความลื่น (max สูง = สะดุดเป็นช่วงๆ)
 * obj / text / enemy / tween / body : จำนวนวัตถุในฉาก
 *
 * ปุ่ม (กดเพื่อ "ซ่อน/ปิด" ส่วนนั้นชั่วคราว แล้วดูว่า FPS ดีขึ้นไหม กดซ้ำเพื่อเปิดกลับ):
 *   UI = ปุ่ม/แถบเมนู HTML ทั้งหมด (ตัวควบคุมจะหายด้วย ให้ยืนนิ่งๆ ดูเลข)
 *   ข้อความ = ชื่อมอน/ตัวเลขดาเมจ/ข้อความทุกชนิดในฉาก
 *   ตกแต่ง = ต้นไม้ หิน หญ้า ของตกแต่งพื้น
 *   เอฟเฟกต์ = ภาพเอฟเฟกต์สกิล
 *   มอน = ตัวมอนสเตอร์ (ยังคำนวณอยู่ แค่ไม่วาด)
 *   ฟิสิกส์ = หยุดระบบฟิสิกส์ (มอน/ตัวละครจะนิ่ง)
 */
(function () {
  if (!/[?&]perf=1/.test(location.search)) return;
  if (typeof Main === 'undefined' || !Main.prototype) return;

  var F = { ui: 0, text: 0, deco: 0, fx: 0, enemy: 0, phys: 0 };
  var LABEL = { ui: 'UI', text: 'ข้อความ', deco: 'ตกแต่ง', fx: 'เอฟเฟกต์', enemy: 'มอน', phys: 'ฟิสิกส์' };
  var scene = null, hiddenDom = [];

  var box = document.createElement('div');
  box.id = 'perf-box';
  box.style.cssText = 'position:fixed;right:6px;top:6px;z-index:99998;background:rgba(0,0,0,.8);color:#8f8;' +
    'font:11px/1.35 monospace;padding:4px 6px;border-radius:6px;max-width:240px';
  var stat = document.createElement('div');
  stat.style.cssText = 'white-space:pre;pointer-events:none';
  stat.textContent = 'perf: รอเฟรมแรก...';
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin-top:4px';
  box.appendChild(stat); box.appendChild(row);
  function mount() { document.body.appendChild(box); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  // ---------- เปิด/ปิดแต่ละส่วน ----------
  function setDom(off) {
    if (off) {
      Array.prototype.slice.call(document.body.children).forEach(function (el) {
        var t = el.tagName;
        if (el === box || t === 'CANVAS' || t === 'SCRIPT' || t === 'STYLE' || t === 'LINK') return;
        if (el.querySelector && el.querySelector('canvas')) return;     // ตัวห่อ canvas ของเกม ห้ามซ่อน
        hiddenDom.push([el, el.style.display]);
        el.style.display = 'none';
      });
    } else {
      hiddenDom.forEach(function (p) { p[0].style.display = p[1]; });
      hiddenDom = [];
    }
  }
  function each(list, fn) { for (var i = 0; i < list.length; i++) if (list[i]) fn(list[i]); }

  function onToggle(k, btn) {
    F[k] = F[k] ? 0 : 1;
    btn.style.background = F[k] ? '#a22' : '#333';
    btn.textContent = (F[k] ? '✖ ' : '') + LABEL[k];
    try {
      if (k === 'ui') setDom(!!F.ui);
      if (!F[k] && scene) {                               // เปิดกลับ
        if (k === 'text') each(scene.children.list, function (o) { if (o.type === 'Text') o.setVisible(true); });
        if (k === 'deco') each(scene.obstacleObjs || [], function (o) { o.setVisible(true); });
        if (k === 'enemy' && scene.enemies) each(scene.enemies.getChildren(), function (o) { o.setVisible(true); });
        if (k === 'phys' && scene.physics) scene.physics.world.resume();
      }
      if (F[k] && k === 'phys' && scene && scene.physics) scene.physics.world.pause();
    } catch (e) { /* ไม่ให้แผงวัดทำเกมพัง */ }
  }
  Object.keys(F).forEach(function (k) {
    var b = document.createElement('button');
    b.textContent = LABEL[k];
    b.style.cssText = 'font:11px monospace;color:#fff;background:#333;border:1px solid #777;border-radius:5px;padding:3px 6px';
    b.addEventListener('click', function () { onToggle(k, b); });
    row.appendChild(b);
  });

  // ทำซ้ำหลังจบ update ทุกเฟรม (กันโค้ดเกมสั่งโชว์กลับ)
  function applyHides(sc) {
    if (F.text) each(sc.children.list, function (o) { if (o.type === 'Text' && o.visible) o.setVisible(false); });
    if (F.deco) each(sc.obstacleObjs || [], function (o) { if (o.visible) o.setVisible(false); });
    if (F.enemy && sc.enemies) each(sc.enemies.getChildren(), function (o) { if (o.visible) o.setVisible(false); });
    if (F.fx) each(sc.children.list, function (o) {
      if (o !== sc.player && (o.type === 'Sprite' || o.type === 'Image') && o.depth >= 60 && o.depth <= 75 && o.visible) o.setVisible(false);
    });
  }

  // ---------- วัดเฟรม ----------
  var last = 0, lastShow = 0, n = 0, sum = 0, max = 0, spikes = 0;

  function show(sc) {
    var fps = n, avg = n ? sum / n : 0, mx = max, sp = spikes;
    n = 0; sum = 0; max = 0; spikes = 0;
    var head = '', info = '';
    try {
      var rt = sc.game && sc.game.renderer ? sc.game.renderer.type : 0;
      head = (rt === 2 ? 'WebGL' : (rt === 1 ? 'Canvas (ช้า!)' : '?')) + '  ' + sc.scale.width + 'x' + sc.scale.height +
             '  dpr' + (window.devicePixelRatio || 1) + '\n';
      var list = sc.children && sc.children.list ? sc.children.list : [], texts = 0;
      for (var i = 0; i < list.length; i++) if (list[i] && list[i].type === 'Text') texts++;
      var enemies = sc.enemies && sc.enemies.getLength ? sc.enemies.getLength() : 0;
      var tw = sc.tweens && sc.tweens.getTweens ? sc.tweens.getTweens().length : 0;
      var bodies = sc.physics && sc.physics.world && sc.physics.world.bodies ? sc.physics.world.bodies.size : 0;
      info = '\nobj ' + list.length + '  text ' + texts + '  enemy ' + enemies +
             '\ntween ' + tw + '  body ' + bodies;
    } catch (e) { /* ไม่ให้แผงวัดทำเกมพัง */ }
    stat.style.color = fps >= 50 ? '#8f8' : (fps >= 30 ? '#ff8' : '#f88');
    stat.textContent = head + 'FPS ' + fps + '\navg ' + avg.toFixed(1) + 'ms  max ' + mx.toFixed(0) + 'ms\nspike ' + sp + info;
  }

  var orig = Main.prototype.update;
  Main.prototype.update = function () {
    var now = performance.now();
    try {
      scene = this;
      if (last) {
        var d = now - last;
        n++; sum += d;
        if (d > max) max = d;
        if (d > 50) spikes++;
      }
      last = now;
      if (now - lastShow >= 1000) { lastShow = now; show(this); }
    } catch (e) { /* ไม่ให้แผงวัดทำเกมพัง */ }
    var r = orig ? orig.apply(this, arguments) : undefined;
    try { applyHides(this); } catch (e) { /* ignore */ }
    return r;
  };
})();
