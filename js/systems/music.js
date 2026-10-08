// ===== เพลง + เสียงเอฟเฟกต์สังเคราะห์สด แนวจีนกำลังภายใน (v2: แก้กระตุก/ซ่า) =====
// ไฟล์: js/systems/music.js  | วาง "หลัง" town.js และ "ก่อน" main.js (หลัง Phaser)
//   <script src="js/systems/music.js?v=2"></script>
// ใช้ร่วมกับ GameAudio เดิมไม่ได้: ให้ลบ audio.js / GameAudio ออก

window.XhMusic = (function () {
  var ctx, master, bus, sfxBus, noiseBuf, mode = null, want = null, timer = null;
  var nextT = 0, step = 0, pos = 6, muted = false, vol = 0.5, sfxVol = 0.8;
  try {
    var s = JSON.parse(localStorage.getItem('xh_music'));
    if (s) { vol = (typeof s.vol === 'number') ? s.vol : vol; muted = !!s.muted; if (typeof s.sfx === 'number') sfxVol = s.sfx; }
  } catch (e) {}

  var MODES = {
    town:  { beat: 0.95, root: 50, scale: [62, 64, 66, 69, 71], pluck: 0.5, flute: 0.7, drum: false },
    field: { beat: 0.75, root: 45, scale: [57, 60, 62, 64, 67], pluck: 0.6, flute: 0.5, drum: true }
  };

  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function save() { try { localStorage.setItem('xh_music', JSON.stringify({ vol: vol, muted: muted, sfx: sfxVol })); } catch (e) {} }
  function level() { return muted ? 0 : vol * 0.6; }

  function init() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { ctx = new AC(); }
    master = ctx.createGain();
    master.gain.value = level();
    // คอมเพรสเซอร์กันเสียงแตก/ซ่าตอนหลายเสียงซ้อนกัน
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 6;
    comp.attack.value = 0.005; comp.release.value = 0.25;
    comp.connect(master); master.connect(ctx.destination);

    // บัสรวม + กรองความถี่สูงให้นุ่ม (ตัดเสียงซ่า)
    // บัสเอฟเฟกต์แยก: ต่อตรงเข้าคอมเพรสเซอร์ ไม่ผ่านเสียงสะท้อน (ไม่เอคโค่)
    sfxBus = ctx.createGain();
    sfxBus.connect(comp);

    bus = ctx.createGain();
    var tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 4200; tone.Q.value = 0.3;
    bus.connect(tone); tone.connect(comp);

    // เสียงสะท้อนแบบดีเลย์ป้อนกลับ (เบากว่า convolver มาก และไม่มีเสียงซ่า)
    var dl = ctx.createDelay(1.0), fb = ctx.createGain(), wet = ctx.createGain(), dlp = ctx.createBiquadFilter();
    dl.delayTime.value = 0.34; fb.gain.value = 0.38; wet.gain.value = 0.28;
    dlp.type = 'lowpass'; dlp.frequency.value = 1800;
    tone.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(wet); wet.connect(comp);

    // บัฟเฟอร์นอยส์สำหรับเสียงเอฟเฟกต์
    var len = Math.floor(ctx.sampleRate * 0.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  // ---------- เครื่องดนตรี (เบา: ใช้ oscillator น้อยที่สุด) ----------
  function pluck(f, t, v) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.02, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 1.7);
  }
  function flute(f, t, dur, v) {
    var o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    lfo.frequency.value = 4.8; lg.gain.value = f * 0.006;
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.4);
    g.gain.setValueAtTime(v, t + dur - 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }
  function drone(f, t, dur) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045, t + 2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.1);
  }
  function drum(t) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.45);
  }
  function note(m, i) {
    var n = m.scale.length;
    i = Math.max(0, Math.min(n * 2 + 2, i));
    return m.scale[i % n] + 12 * Math.floor(i / n) - 12;
  }

  // ตั้งเวลาทีละ "จังหวะย่อย" (กระจายงานเล็กๆ ไม่สร้างโหนดทีเดียวเยอะ จึงไม่กระตุก)
  function playStep(t) {
    var m = MODES[mode], B = m.beat, k = step % 8;
    if (k === 0) {
      var bar = Math.floor(step / 8);
      if (bar % 4 === 0) drone(hz(m.root), t, B * 16);
      if (m.drum) { drum(t); if (bar % 2) drum(t + B * 2); }
      if (bar % 2 === 0 && Math.random() < m.flute) {
        flute(hz(note(m, 6 + Math.floor(Math.random() * 5))), t + B * 0.5, B * 3.4, 0.06);
      }
    }
    if (k === 3 && Math.random() < 0.2) {            // รูดนิ้วสั้นๆ 4 โน้ต
      var s0 = 2 + Math.floor(Math.random() * 3);
      for (var j = 0; j < 4; j++) pluck(hz(note(m, s0 + j)), t + j * 0.09, 0.07);
    }
    if (Math.random() < m.pluck) {
      pos += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
      pos = Math.max(3, Math.min(11, pos));
      pluck(hz(note(m, pos)), t, 0.1 + Math.random() * 0.04);
    }
    step++;
  }
  function loop() {
    if (!ctx || !mode || ctx.state !== 'running') return;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.1;
    while (nextT < ctx.currentTime + 1.0) {
      playStep(nextT);
      nextT += MODES[mode].beat * 0.5;
    }
  }
  function begin(name) {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (mode !== name) { mode = name; step = 0; pos = 6; nextT = ctx.currentTime + 0.3; }
    if (!timer) timer = setInterval(loop, 250);
    loop();
  }

  // ---------- เสียงเอฟเฟกต์ ----------
  var lastSfx = {}, active = 0, tcap = 0.28;   // tcap = เพดานความยาวโน้ตเอฟเฟกต์ (วินาที)
  function noiseBurst(t, dur, f0, f1, v, q) {
    var n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = noiseBuf; bp.type = 'bandpass'; bp.Q.value = q || 1;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp); bp.connect(g); g.connect(sfxBus);
    n.start(t); n.stop(t + dur + 0.05);
  }
  function tone(type, f0, f1, t, dur, v) {
    dur = Math.min(dur, tcap);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  // เสียงกระทบ "จังหวะเดียว" สไตล์ Ragnarok: เสียงแหลมสั้น (นอยส์) + เสียงตุบสั้น ไม่มีโน้ตค้าง ไม่มีก้อง
  var SFX = {
    hit_sword:  function (t, v) { noiseBurst(t, 0.07, 3500, 1200, 0.45 * v, 0.7); tone('sine', 200, 90, t, 0.06, 0.35 * v); },
    hit_priest: function (t, v) { noiseBurst(t, 0.06, 1500, 500, 0.3 * v, 0.7);  tone('sine', 150, 60, t, 0.09, 0.55 * v); },
    hit_mage:   function (t, v) { tone('sine', 900, 300, t, 0.07, 0.28 * v); noiseBurst(t, 0.05, 4000, 1500, 0.2 * v, 0.8); },
    hit_archer: function (t, v) { noiseBurst(t, 0.05, 2500, 900, 0.3 * v, 0.8); tone('sine', 260, 110, t, 0.05, 0.38 * v); },
    hit_rogue:  function (t, v) { noiseBurst(t, 0.05, 5000, 2500, 0.38 * v, 0.9); tone('sine', 320, 160, t, 0.04, 0.22 * v); },
    crit:       function (t, v) { noiseBurst(t, 0.1, 4000, 800, 0.55 * v, 0.7); tone('sine', 140, 50, t, 0.12, 0.65 * v); },
    hurt:       function (t, v) { tone('sine', 130, 55, t, 0.1, 0.45 * v); noiseBurst(t, 0.06, 700, 250, 0.2 * v, 0.8); },
    heal:       function (t, v) { tone('sine', 660, 660, t, 0.18, 0.13 * v); tone('sine', 990, 990, t + 0.07, 0.22, 0.12 * v); },
    // ตอนร่ายสกิล: เสียงลมสั้นๆ ครั้งเดียว
    sk_sword:  function (t, v) { noiseBurst(t, 0.12, 1500, 4500, 0.22 * v, 1); },
    sk_mage:   function (t, v) { tone('sine', 400, 900, t, 0.12, 0.16 * v); },
    sk_archer: function (t, v) { noiseBurst(t, 0.1, 1200, 3500, 0.18 * v, 1); },
    sk_rogue:  function (t, v) { noiseBurst(t, 0.1, 2000, 5500, 0.22 * v, 1.2); },
    sk_holy:   function (t, v) { tone('sine', 700, 900, t, 0.12, 0.14 * v); },
    ult:       function (t, v) { tone('sine', 90, 40, t, 0.35, 0.5 * v); noiseBurst(t, 0.3, 400, 3000, 0.3 * v, 0.8); },
    dash:      function (t, v) { noiseBurst(t, 0.15, 800, 3000, 0.22 * v, 1); },
    coin:      function (t, v) { tone('sine', 1318, 1318, t, 0.1, 0.18 * v); tone('sine', 1760, 1760, t + 0.06, 0.16, 0.18 * v); },
    levelup:   function (t, v) {
      [392, 494, 587, 784, 988].forEach(function (f, i) { tone('triangle', f, f, t + i * 0.11, 0.7, 0.22 * v); });
    }
  };
  function sfx(name, v) {
    if (muted || !ctx || ctx.state !== 'running' || !SFX[name]) return;
    var now = ctx.currentTime, gap = (name.indexOf('hit_') === 0 || name === 'crit') ? 0.09 : 0.1;
    if (lastSfx[name] && now - lastSfx[name] < gap) return;
    if (active >= 10) return;
    lastSfx[name] = now; active++;
    setTimeout(function () { active = Math.max(0, active - 1); }, 300);
    tcap = (name === 'levelup' || name === 'heal' || name === 'coin') ? 1 : (name === 'ult' ? 0.4 : 0.12);
    try { SFX[name](now, (v === undefined ? 1 : v) * sfxVol); } catch (e) {}
  }

  // ---------- ปลดล็อกเสียงมือถือ ----------
  var EVS = ['pointerdown', 'touchend', 'click'];
  function unlock() {
    if (want) begin(want); else init();
    if (ctx && ctx.state === 'running') {
      EVS.forEach(function (e) { document.removeEventListener(e, unlock, true); });
    }
  }
  EVS.forEach(function (e) { document.addEventListener(e, unlock, true); });
  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  var listeners = [];
  function notify() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
  function setMuted(b) { muted = !!b; save(); if (master) master.gain.value = level(); notify(); }


  var api = {
    play: function (name) { want = name; if (ctx && ctx.state === 'running') begin(name); },
    sfx: sfx,
    setVolume: function (v) { vol = Math.max(0, Math.min(1, v)); save(); if (master) master.gain.value = level(); notify(); },
    setSfxVolume: function (v) { sfxVol = Math.max(0, Math.min(1, v)); save(); },
    getVolume: function () { return vol; },
    getSfxVolume: function () { return sfxVol; },
    onChange: function (f) { listeners.push(f); },
    mute: setMuted,
    isMuted: function () { return muted; }
  };

  // ---------- ครอบ loadStage: เมือง = town | ด่านอื่น = field ----------
  (function () {
    var target = (typeof Main === 'function') ? Main.prototype : (typeof Main !== 'undefined' ? Main : null);
    if (!target || typeof target.loadStage !== 'function') { console.warn('XhMusic: ไม่พบ Main.loadStage'); return; }
    var orig = target.loadStage;
    target.loadStage = function () {
      var r = orig.apply(this, arguments);
      try { var z = (typeof ZONES !== 'undefined') && ZONES[this.stageIdx]; api.play(z && z.town ? 'town' : 'field'); } catch (e) {}
      return r;
    };
  })();

  // ---------- ผูกเสียงกับฟังก์ชันจริงของเกม (ไม่ต้องแก้ไฟล์เกม) ----------
  var ULTI_NAMES = { 'ดาบสังหาร': 1, 'ระเบิดมหาเวท': 1, 'ธนูทลวงฟ้า': 1, 'พายุใบมีด': 1 };
  function skillSoundName(def) {
    if (!def) return null;
    if (def.name && ULTI_NAMES[def.name]) return 'ult';
    var id = String(def.id || '');
    if (id.indexOf('sw_') === 0) return 'sk_sword';
    if (id.indexOf('mg_') === 0) return 'sk_mage';
    if (id.indexOf('ar_') === 0) return 'sk_archer';
    if (id.indexOf('rg_') === 0) return 'sk_rogue';
    if (id.indexOf('pr_') === 0 || def.type === 'holy' || def.type === 'heal1' || def.type === 'healaoe') return 'sk_holy';
    if (def.type === 'pulti') return 'ult';
    return 'sk_sword';
  }
  (function () {
    var M = (typeof Main === 'function') ? Main.prototype : null;
    if (M) {
      // สกิล: ดังตอนร่ายจริง (applySkillEffect ถูกเรียกเมื่อร่ายสำเร็จ)
      if (typeof M.applySkillEffect === 'function') {
        var oSk = M.applySkillEffect;
        M.applySkillEffect = function (def) {
          try { var n = skillSoundName(def); if (n) sfx(n, 1); } catch (e) {}
          return oSk.apply(this, arguments);
        };
      }
    }
    // เลขดาเมจ -> เสียงโดนตี (ใช้ showDamage ของ damageFx.js)
    if (typeof window.showDamage === 'function') {
      var oDmg = window.showDamage;
      window.showDamage = function (scene, x, y, amount, kind, opts) {
        try {
          kind = kind || 'normal';
          var cls = 'sword';
          try { if (scene && typeof scene.currentClass === 'function') cls = scene.currentClass() || 'sword'; } catch (e2) {}
          if (kind === 'player') sfx('hurt', 0.9);
          else if (kind === 'heal') sfx('heal', 0.8);
          else if (kind === 'regen') { /* เงียบ */ }
          else if (kind === 'crit' || (opts && opts.crit)) sfx('crit', 1);
          else sfx(SFX['hit_' + cls] ? 'hit_' + cls : 'hit_sword', 0.9);
        } catch (e) {}
        return oDmg.apply(this, arguments);
      };
    }
    // เงาพุ่งของโจร -> เสียงพุ่ง
    if (window.SkillFx && typeof window.SkillFx.dashTrail === 'function') {
      var oDash = window.SkillFx.dashTrail;
      window.SkillFx.dashTrail = function () { try { sfx('dash', 1); } catch (e) {} return oDash.apply(this, arguments); };
    }
    // ข้อความเลเวลอัป
    if (typeof Phaser !== 'undefined' && Phaser.GameObjects && Phaser.GameObjects.GameObjectFactory) {
      var P = Phaser.GameObjects.GameObjectFactory.prototype, oText = P.text;
      P.text = function (x, y, t) {
        var r = oText.apply(this, arguments);
        try {
          var str = String(Array.isArray(t) ? t.join('') : t);
          if (/level\s*up|เลเวลอัพ|เลเวลอัป/i.test(str)) sfx('levelup', 1);
        } catch (e) {}
        return r;
      };
    }
  })();

  // ---------- ปุ่มเสียงในแถบเมนูของเกม + หน้าต่างปรับเสียง ----------
  var SOUND_BTN_SHIFT_X = 0;   // เลื่อนปุ่มซ้าย(-)/ขวา(+) ถ้าทับปุ่มอื่น (เช่น ปุ่มสังคม)
  function openSoundPanel(m) {
    var card = (typeof m.domCard === 'function') ? m.domCard('🔊 ตั้งค่าเสียง') : null;
    if (!card) return;
    function row(label, get, set, test) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'margin:12px 4px;text-align:left';
      var lab = document.createElement('div');
      lab.style.cssText = 'font-size:15px;margin-bottom:4px;display:flex;justify-content:space-between';
      var name = document.createElement('span'); name.textContent = label;
      var pct = document.createElement('span'); pct.style.color = '#ffe28a';
      lab.appendChild(name); lab.appendChild(pct);
      var inp = document.createElement('input');
      inp.type = 'range'; inp.min = 0; inp.max = 100; inp.step = 1; inp.value = Math.round(get() * 100);
      inp.style.cssText = 'width:100%;height:34px;accent-color:#ffd45c;touch-action:pan-x';
      pct.textContent = inp.value + '%';
      inp.addEventListener('input', function () { pct.textContent = inp.value + '%'; set(inp.value / 100); });
      if (test) inp.addEventListener('change', test);
      wrap.appendChild(lab); wrap.appendChild(inp);
      card.appendChild(wrap);
    }
    row('🎵 เสียงเพลง', function () { return vol; }, function (v) { api.setVolume(v); });
    row('⚔️ เสียงเอฟเฟกต์', function () { return sfxVol; }, function (v) { api.setSfxVolume(v); }, function () { sfx('hitSkill', 1); });

    var mb = document.createElement('button');
    function paint() { mb.textContent = muted ? '🔇 ปิดเสียงอยู่ (แตะเพื่อเปิด)' : '🔊 แตะเพื่อปิดเสียงทั้งหมด'; }
    mb.style.cssText = 'font-family:inherit;font-size:15px;padding:9px 16px;border-radius:10px;cursor:pointer;margin-top:6px;' +
      'border:2px solid #ffd45c;color:#26090f;background:#ffd45c;width:100%';
    mb.addEventListener('click', function () { setMuted(!muted); if (!muted && want) begin(want); paint(); });
    paint();
    card.appendChild(mb);
    if (typeof m.domCloseBtn === 'function') m.domCloseBtn(card);
  }

  // ปุ่มเสียง (DOM) วางใต้ปุ่ม "สังคม" | หน่วยเป็นพิกัดเกม (กว้าง W) ปรับเลขตรงนี้ถ้าอยากย้าย
  var SOUND_BTN = { x: 252, y: 112, w: 47, h: 43 };
  var sBtn = null;
  function sIcon() { var i = sBtn && sBtn.querySelector('.hb-i'); if (i) i.textContent = muted ? '🔇' : '🔊'; }
  function sLayout() {
    var cv = document.querySelector('canvas');
    if (!cv || !sBtn || typeof W === 'undefined') return;
    var r = cv.getBoundingClientRect();
    if (r.width < 50) return;
    var k = r.width / W, B = SOUND_BTN;
    sBtn.style.cssText =
      'position:fixed;z-index:9000;box-sizing:border-box;padding:0;margin:0;cursor:pointer;touch-action:manipulation;' +
      '-webkit-tap-highlight-color:transparent;font-family:Mitr,sans-serif;color:#fff;overflow:hidden;' +
      'left:' + (r.left + B.x * k) + 'px;top:' + (r.top + B.y * k) + 'px;width:' + (B.w * k) + 'px;height:' + (B.h * k) + 'px;' +
      'border:' + Math.max(1, 2 * k) + 'px solid #8a6a32;border-radius:' + (8 * k) + 'px;' +
      'background:linear-gradient(180deg,rgba(255,255,255,.16) 0,rgba(255,255,255,0) 45%),#3a2a4a;' +
      'box-shadow:0 ' + (2 * k) + 'px ' + (4 * k) + 'px rgba(0,0,0,.45);';
    var ic = sBtn.querySelector('.hb-i'), tx = sBtn.querySelector('.hb-t');
    if (ic) ic.style.cssText = 'font-size:' + (20 * k) + 'px;margin-top:' + (-2 * k) + 'px';
    if (tx) tx.style.cssText = 'font-size:' + (9 * k) + 'px;margin-top:' + (1 * k) + 'px;' +
      'text-shadow:-1px 0 #000,1px 0 #000,0 -1px #000,0 1px #000;white-space:nowrap';
  }
  function sMake() {
    if (sBtn || !document.body) return;
    sBtn = document.createElement('button');
    sBtn.id = 'btn-sound';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;line-height:1.1';
    var i = document.createElement('div'); i.className = 'hb-i';
    var t = document.createElement('div'); t.className = 'hb-t'; t.textContent = 'เสียง';
    wrap.appendChild(i); wrap.appendChild(t); sBtn.appendChild(wrap);
    sBtn.addEventListener('click', function () {
      var m = window.__mainScene || window._townMain;
      if (m && !m.townModal) openSoundPanel(m);
    });
    document.body.appendChild(sBtn);
    sIcon(); sLayout();
  }
  api.onChange(sIcon);
  window.addEventListener('resize', sLayout);
  window.addEventListener('orientationchange', function () { setTimeout(sLayout, 300); });
  document.addEventListener('fullscreenchange', function () { setTimeout(sLayout, 300); });
  setInterval(function () { sMake(); sLayout(); }, 500);

  return api;
})();
