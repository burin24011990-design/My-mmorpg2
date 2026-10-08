// ===== เพลงสังเคราะห์สด แนวจีนกำลังภายในโบราณ (ไม่ต้องใช้ไฟล์เสียง) =====
// ไฟล์: js/systems/music.js
// วางใน index.html "หลัง" town.js และ "ก่อน" main.js:
//   <script src="js/systems/music.js?v=1"></script>
// ไฟล์นี้ครอบ loadStage เอง (เมือง = เพลงเมือง / ด่านอื่น = เพลงนอกเมือง) และสร้างปุ่มเปิด-ปิดเสียงให้เอง
// ไม่ต้องแก้ไฟล์อื่นเลย

window.XhMusic = (function () {
  var ctx, master, bus, mode = null, want = null, timer = null;
  var nextT = 0, bar = 0, pos = 6, muted = false, vol = 0.5;
  try {
    var s = JSON.parse(localStorage.getItem('xh_music'));
    if (s) { vol = (typeof s.vol === 'number') ? s.vol : vol; muted = !!s.muted; }
  } catch (e) {}

  // ตั้งค่าอารมณ์เพลง: beat ยิ่งมากยิ่งช้า | pluck = ความถี่การดีดเจิง (0-1) | flute = โอกาสมีขลุ่ย
  var MODES = {
    town:  { beat: 0.95, root: 50, scale: [62, 64, 66, 69, 71], pluck: 0.55, flute: 0.7, drum: false },
    field: { beat: 0.75, root: 45, scale: [57, 60, 62, 64, 67], pluck: 0.7,  flute: 0.5, drum: true }
  };

  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function save() { try { localStorage.setItem('xh_music', JSON.stringify({ vol: vol, muted: muted })); } catch (e) {} }
  function level() { return muted ? 0 : vol * 0.6; }

  function init() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = level();
    master.connect(ctx.destination);

    // เสียงก้องแบบห้องโถง
    var len = Math.floor(ctx.sampleRate * 2.6);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    var cv = ctx.createConvolver(); cv.buffer = buf;
    var vg = ctx.createGain(); vg.gain.value = 0.45;
    cv.connect(vg); vg.connect(master);

    bus = ctx.createGain();
    bus.connect(master);
    bus.connect(cv);
    return true;
  }

  // กู่เจิง: ดีดแล้วเสียงตกเร็ว
  function pluck(f, t, v) {
    var o = ctx.createOscillator(), o2 = ctx.createOscillator();
    var g = ctx.createGain(), g2 = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'sine'; g2.gain.value = 0.3;
    o.frequency.setValueAtTime(f * 1.025, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    o2.frequency.value = f * 2;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3600, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + 1.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(bus);
    o.start(t); o2.start(t); o.stop(t + 2.5); o2.stop(t + 2.5);
  }

  // ขลุ่ย/เซียว: โน้ตยาว เสียงสั่นเบา
  function flute(f, t, dur, v) {
    var o = ctx.createOscillator(), h = ctx.createOscillator(), hg = ctx.createGain();
    var lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
    o.type = 'sine'; h.type = 'sine';
    o.frequency.value = f; h.frequency.value = f * 2; hg.gain.value = 0.12;
    lfo.frequency.value = 4.8; lg.gain.value = f * 0.007;
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.35);
    g.gain.setValueAtTime(v, t + dur - 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); h.connect(hg); hg.connect(g); g.connect(bus);
    o.start(t); h.start(t); lfo.start(t);
    o.stop(t + dur + 0.1); h.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }

  // เสียงทุ้มรองพื้น
  function drone(f, t, dur) {
    [f, f * 1.5].forEach(function (fr, i) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = fr;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(i ? 0.025 : 0.05, t + 2);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.1);
    });
  }

  // กลองเบาๆ
  function drum(t) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.55);
  }

  // โน้ตจากสเกลเพนทาโทนิก 3 ช่วงเสียง
  function note(m, i) {
    var n = m.scale.length;
    i = Math.max(0, Math.min(n * 2 + 2, i));
    return m.scale[i % n] + 12 * Math.floor(i / n) - 12;
  }

  function playBar(t) {
    var m = MODES[mode], B = m.beat;
    if (bar % 4 === 0) drone(hz(m.root), t, B * 16);
    if (m.drum) { drum(t); if (bar % 2) drum(t + B * 2); }

    for (var k = 0; k < 8; k++) {
      if (Math.random() < m.pluck) {
        pos += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
        pos = Math.max(3, Math.min(11, pos));
        pluck(hz(note(m, pos)), t + k * B * 0.5, 0.16 + Math.random() * 0.08);
      }
    }
    if (Math.random() < 0.22) {                          // รูดนิ้วไล่เสียง
      var st = t + B * (1 + Math.floor(Math.random() * 2));
      var s0 = 2 + Math.floor(Math.random() * 3);
      for (var j = 0; j < 6; j++) pluck(hz(note(m, s0 + j)), st + j * 0.085, 0.1);
    }
    if (bar % 2 === 0 && Math.random() < m.flute) {      // ขลุ่ยโน้ตยาว
      var fp = 6 + Math.floor(Math.random() * 5);
      flute(hz(note(m, fp)), t + B * 0.5, B * 3.4, 0.07);
    }
    bar++;
  }

  function loop() {
    if (!ctx || !mode || ctx.state !== 'running') return;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.1;
    while (nextT < ctx.currentTime + 0.6) {
      playBar(nextT);
      nextT += MODES[mode].beat * 4;
    }
  }

  function begin(name) {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (mode !== name) {
      mode = name; bar = 0; pos = 6;
      nextT = ctx.currentTime + 0.3;
    }
    if (!timer) timer = setInterval(loop, 150);
    loop();
  }

  // มือถือต้องแตะจอก่อนถึงจะมีเสียง
  var EVS = ['pointerdown', 'touchend', 'click'];
  function unlock() {
    if (want) begin(want);
    if (ctx && ctx.state === 'running') {
      EVS.forEach(function (e) { document.removeEventListener(e, unlock, true); });
    }
  }
  EVS.forEach(function (e) { document.addEventListener(e, unlock, true); });

  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  function setMuted(b) {
    muted = !!b; save();
    if (master) master.gain.value = level();
    refreshBtn();
  }

  // ---------- ปุ่มเปิด/ปิดเสียง (วางต่อจากปุ่มเมือง/แชนเนล) ----------
  var btn = null;
  function refreshBtn() {
    if (!btn) return;
    var i = btn.querySelector('.hb-i');
    if (i) i.textContent = muted ? '🔇' : '🔊';
  }
  function layoutBtn() {
    var cv = document.querySelector('canvas');
    if (!cv || !btn) return;
    var r = cv.getBoundingClientRect();
    if (r.width < 50 || typeof W === 'undefined') return;
    var k = r.width / W;
    btn.style.cssText =
      'position:fixed;z-index:9000;box-sizing:border-box;padding:0;margin:0;cursor:pointer;touch-action:manipulation;' +
      '-webkit-tap-highlight-color:transparent;font-family:Mitr,sans-serif;color:#fff;overflow:hidden;' +
      'left:' + (r.left + 360 * k) + 'px;top:' + (r.top + 8 * k) + 'px;' +
      'width:' + (50 * k) + 'px;height:' + (46 * k) + 'px;' +
      'border:' + Math.max(1, 2 * k) + 'px solid #8a6a32;border-radius:' + (8 * k) + 'px;' +
      'background:linear-gradient(180deg,rgba(255,255,255,.16) 0,rgba(255,255,255,0) 45%),#3a2a4a;' +
      'box-shadow:0 ' + (2 * k) + 'px ' + (4 * k) + 'px rgba(0,0,0,.45);';
    var ic = btn.querySelector('.hb-i'), tx = btn.querySelector('.hb-t');
    if (ic) ic.style.cssText = 'font-size:' + (22 * k) + 'px;margin-top:' + (-2 * k) + 'px';
    if (tx) tx.style.cssText = 'font-size:' + (9 * k) + 'px;margin-top:' + (1 * k) + 'px;' +
      'text-shadow:-1px 0 #000,1px 0 #000,0 -1px #000,0 1px #000;white-space:nowrap';
  }
  function makeBtn() {
    if (btn || !document.body) return;
    btn = document.createElement('button');
    btn.id = 'btn-music';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;line-height:1.1';
    var i = document.createElement('div'); i.className = 'hb-i';
    var t = document.createElement('div'); t.className = 'hb-t'; t.textContent = 'เสียง';
    wrap.appendChild(i); wrap.appendChild(t);
    btn.appendChild(wrap);
    btn.addEventListener('click', function () {
      setMuted(!muted);
      if (!muted && want) begin(want);
    });
    document.body.appendChild(btn);
    refreshBtn();
    layoutBtn();
  }
  window.addEventListener('resize', layoutBtn);
  window.addEventListener('orientationchange', function () { setTimeout(layoutBtn, 300); });
  document.addEventListener('fullscreenchange', function () { setTimeout(layoutBtn, 300); });
  setInterval(function () { makeBtn(); layoutBtn(); }, 500);

  // ---------- ครอบ loadStage ของ Main: เมือง = town | ด่านอื่น = field ----------
  (function patch() {
    var target = (typeof Main === 'function') ? Main.prototype : (typeof Main !== 'undefined' ? Main : null);
    if (!target || typeof target.loadStage !== 'function') {
      console.warn('XhMusic: ไม่พบ Main.loadStage (ตรวจว่าโหลด music.js หลัง town.js)');
      return;
    }
    var orig = target.loadStage;
    target.loadStage = function () {
      var r = orig.apply(this, arguments);
      try {
        var z = (typeof ZONES !== 'undefined') && ZONES[this.stageIdx];
        api.play(z && z.town ? 'town' : 'field');
      } catch (e) {}
      return r;
    };
  })();

  var api = {
    play: function (name) {
      want = name;
      if (ctx && ctx.state === 'running') begin(name);
    },
    setVolume: function (v) { vol = Math.max(0, Math.min(1, v)); save(); if (master) master.gain.value = level(); },
    mute: setMuted,
    isMuted: function () { return muted; }
  };
  return api;
})();
