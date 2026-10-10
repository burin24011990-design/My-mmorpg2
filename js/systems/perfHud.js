/* perfHud.js (v4) — แผงวัดความลื่น (โชว์เฉพาะเมื่อเปิดเกมด้วย ?perf=1)
 * ติดตั้ง: วางที่ js/systems/perfHud.js แล้วเปลี่ยนใน index.html เป็น  perfHud.js?v=4
 *
 * ของใหม่ใน v4:
 *   upd X ms   = เวลาที่โค้ดเกม (Main.update) ใช้ต่อเฟรม  -> สูง = ตรรกะ/AI/เอฟเฟกต์ที่คำนวณหนัก
 *   ren X ms   = เวลาฝั่ง CPU ในการสั่งวาด             -> สูง = วัตถุ/ดรอว์คอลเยอะ
 *   ถ้า upd และ ren ต่ำ แต่เฟรมยังช้า = คอขวดอยู่ที่ GPU (เอฟเฟกต์โปร่งแสงซ้อนกันเยอะ)
 *   types      = ชนิดวัตถุที่มีมากสุดในฉาก,  add = จำนวนที่เป็น additive blend
 *   objMax     = จำนวน obj สูงสุดตั้งแต่เปิด  (หยุดสู้แล้ว obj ไม่ลดกลับ = วัตถุรั่ว)
 *   ปุ่ม "กราฟิก" = ซ่อน Graphics / อนุภาค / รูปทรง (กดซ้ำเพื่อเปิดกลับ)
 */
(function () {
  if (!/[?&]perf=1/.test(location.search)) return;
  if (typeof Main === 'undefined' || !Main.prototype) return;

  var F = { ui: 0, text: 0, deco: 0, fx: 0, gfx: 0, enemy: 0, phys: 0 };
  var LABEL = { ui: 'UI', text: 'ข้อความ', deco: 'ตกแต่ง', fx: 'เอฟเฟกต์', gfx: 'กราฟิก', enemy: 'มอน', phys: 'ฟิสิกส์' };
  var GFX_TYPES = ['Graphics', 'ParticleEmitter', 'Arc', 'Ellipse', 'Rectangle', 'Star', 'Triangle', 'Polygon', 'Line'];
  var scene = null, hiddenDom = [], hiddenGfx = [], hooked = false;

  var box = document.createElement('div');
  box.id = 'perf-box';
  box.style.cssText = 'position:fixed;right:6px;top:6px;z-index:99998;background:rgba(0,0,0,.8);color:#8f8;' +
    'font:11px/1.35 monospace;padding:4px 6px;border-radius:6px;max-width:260px';
  var stat = document.createElement('div');
  stat.style.cssText = 'white-space:pre;pointer-events:none';
  stat.textContent = 'perf: รอเฟรมแรก...';
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin-top:4px';
  box.appendChild(stat); box.appendChild(row);
  function mount() { document.body.appendChild(box); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  function setDom(off) {
    if (off) {
      Array.prototype.slice.call(document.body.children).forEach(function (el) {
        var t = el.tagName;
        if (el === box || t === 'CANVAS' || t === 'SCRIPT' || t === 'STYLE' || t === 'LINK') return;
        if (el.querySelector && el.querySelector('canvas')) return;
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
      if (!F[k] && scene) {
        if (k === 'text') each(scene.children.list, function (o) { if (o.type === 'Text') o.setVisible(true); });
        if (k === 'deco') each(scene.obstacleObjs || [], function (o) { o.setVisible(true); });
        if (k === 'enemy' && scene.enemies) each(scene.enemies.getChildren(), function (o) { o.setVisible(true); });
        if (k === 'gfx') { hiddenGfx.forEach(function (o) { if (o && o.setVisible) o.setVisible(true); }); hiddenGfx = []; }
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

  function applyHides(sc) {
    if (F.text) each(sc.children.list, function (o) { if (o.type === 'Text' && o.visible) o.setVisible(false); });
    if (F.deco) each(sc.obstacleObjs || [], function (o) { if (o.visible) o.setVisible(false); });
    if (F.enemy && sc.enemies) each(sc.enemies.getChildren(), function (o) { if (o.visible) o.setVisible(false); });
    if (F.fx) each(sc.children.list, function (o) {
      if (o !== sc.player && (o.type === 'Sprite' || o.type === 'Image') && o.depth >= 60 && o.depth <= 75 && o.visible) o.setVisible(false);
    });
    if (F.gfx) each(sc.children.list, function (o) {
      if (GFX_TYPES.indexOf(o.type) >= 0 && o.visible) { o.setVisible(false); hiddenGfx.push(o); }
    });
    if (hiddenGfx.length > 3000) hiddenGfx = hiddenGfx.slice(-1500);   // กันลิสต์โตไม่หยุด
  }

  // ---------- วัดเฟรม ----------
  var last = 0, lastShow = 0, n = 0, sum = 0, max = 0, spikes = 0;
  var tUpd = 0, tRen = 0, rStart = 0, objMax = 0;

  function show(sc) {
    var fps = n, avg = n ? sum / n : 0, mx = max, sp = spikes;
    var upd = n ? tUpd / n : 0, ren = n ? tRen / n : 0;
    n = 0; sum = 0; max = 0; spikes = 0; tUpd = 0; tRen = 0;
    var head = '', info = '';
    try {
      var rt = sc.game && sc.game.renderer ? sc.game.renderer.type : 0;
      head = (rt === 2 ? 'WebGL' : (rt === 1 ? 'Canvas (ช้า!)' : '?')) + '  ' + sc.scale.width + 'x' + sc.scale.height +
             '  dpr' + (window.devicePixelRatio || 1) + '\n';
      var list = sc.children && sc.children.list ? sc.children.list : [], texts = 0, add = 0, types = {};
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        if (!o) continue;
        types[o.type] = (types[o.type] || 0) + 1;
        if (o.type === 'Text') texts++;
        if (o.blendMode === 1 && o.visible) add++;
      }
      if (list.length > objMax) objMax = list.length;
      var top = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).slice(0, 4)
        .map(function (t) { return t + ' ' + types[t]; }).join(', ');
      var enemies = sc.enemies && sc.enemies.getLength ? sc.enemies.getLength() : 0;
      var tw = sc.tweens && sc.tweens.getTweens ? sc.tweens.getTweens().length : 0;
      var bodies = sc.physics && sc.physics.world && sc.physics.world.bodies ? sc.physics.world.bodies.size : 0;
      info = '\nupd ' + upd.toFixed(1) + 'ms  ren ' + ren.toFixed(1) + 'ms' +
             '\nobj ' + list.length + ' (max ' + objMax + ')  text ' + texts + '  enemy ' + enemies +
             '\ntween ' + tw + '  body ' + bodies + '  add ' + add +
             '\n' + top;
    } catch (e) { /* ไม่ให้แผงวัดทำเกมพัง */ }
    stat.style.color = fps >= 50 ? '#8f8' : (fps >= 30 ? '#ff8' : '#f88');
    stat.textContent = head + 'FPS ' + fps + '\navg ' + avg.toFixed(1) + 'ms  max ' + mx.toFixed(0) + 'ms  spike ' + sp + info;
  }

  var orig = Main.prototype.update;
  Main.prototype.update = function () {
    var now = performance.now();
    try {
      scene = this;
      if (!hooked && this.game && this.game.events) {
        hooked = true;
        this.game.events.on('prerender', function () { rStart = performance.now(); });
        this.game.events.on('postrender', function () { tRen += performance.now() - rStart; });
      }
      if (last) {
        var d = now - last;
        n++; sum += d;
        if (d > max) max = d;
        if (d > 50) spikes++;
      }
      last = now;
      if (now - lastShow >= 1000) { lastShow = now; show(this); }
    } catch (e) { /* ไม่ให้แผงวัดทำเกมพัง */ }
    var t0 = performance.now();
    var r = orig ? orig.apply(this, arguments) : undefined;
    tUpd += performance.now() - t0;
    try { applyHides(this); } catch (e) { /* ignore */ }
    return r;
  };
})();
