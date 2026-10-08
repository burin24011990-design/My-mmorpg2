// ===== เพลง + เสียงเอฟเฟกต์สังเคราะห์สด แนวจีนกำลังภายใน (v2: แก้กระตุก/ซ่า) =====
// ไฟล์: js/systems/music.js  | วาง "หลัง" town.js และ "ก่อน" main.js (หลัง Phaser)
//   <script src="js/systems/music.js?v=2"></script>
// ใช้ร่วมกับ GameAudio เดิมไม่ได้: ให้ลบ audio.js / GameAudio ออก

window.XhMusic = (function () {
  var ctx, master, bus, noiseBuf, mode = null, want = null, timer = null;
  var nextT = 0, step = 0, pos = 6, muted = false, vol = 0.5, sfxVol = 0.8;
  try {
    var s = JSON.parse(localStorage.getItem('xh_music'));
    if (s) { vol = (typeof s.vol === 'number') ? s.vol : vol; muted = !!s.muted; }
  } catch (e) {}

  var MODES = {
    town:  { beat: 0.95, root: 50, scale: [62, 64, 66, 69, 71], pluck: 0.5, flute: 0.7, drum: false },
    field: { beat: 0.75, root: 45, scale: [57, 60, 62, 64, 67], pluck: 0.6, flute: 0.5, drum: true }
  };

  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function save() { try { localStorage.setItem('xh_music', JSON.stringify({ vol: vol, muted: muted })); } catch (e) {} }
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
  var lastSfx = {}, active = 0;
  function noiseBurst(t, dur, f0, f1, v, q) {
    var n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = noiseBuf; bp.type = 'bandpass'; bp.Q.value = q || 1;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp); bp.connect(g); g.connect(bus);
    n.start(t); n.stop(t + dur + 0.05);
  }
  function tone(type, f0, f1, t, dur, v) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  var SFX = {
    hit:      function (t, v) { noiseBurst(t, 0.09, 2600, 700, 0.35 * v, 0.8); tone('sine', 170, 60, t, 0.12, 0.4 * v); },
    hitSkill: function (t, v) { noiseBurst(t, 0.12, 1800, 500, 0.3 * v, 0.8); tone('sine', 220, 80, t, 0.16, 0.35 * v); tone('triangle', 660, 440, t, 0.1, 0.1 * v); },
    crit:     function (t, v) {
      noiseBurst(t, 0.15, 3000, 800, 0.4 * v, 0.8); tone('sine', 120, 45, t, 0.25, 0.5 * v); tone('sine', 900, 1400, t, 0.15, 0.2 * v);
    },
    hurt:     function (t, v) { tone('sine', 130, 50, t, 0.18, 0.4 * v); noiseBurst(t, 0.08, 600, 200, 0.25 * v, 0.8); },
    heal:     function (t, v) { tone('sine', 660, 660, t, 0.25, 0.15 * v); tone('sine', 880, 880, t + 0.08, 0.3, 0.15 * v); tone('sine', 1175, 1175, t + 0.16, 0.4, 0.12 * v); },
    // โจมตีปกติแต่ละอาชีพ
    swing_sword:  function (t, v) { noiseBurst(t, 0.18, 1200, 4200, 0.3 * v, 1.2); tone('triangle', 520, 300, t, 0.1, 0.15 * v); },
    swing_mage:   function (t, v) { tone('sine', 700, 1400, t, 0.18, 0.18 * v); noiseBurst(t, 0.1, 2000, 5000, 0.1 * v, 1); },
    swing_archer: function (t, v) { tone('triangle', 220, 110, t, 0.12, 0.25 * v); noiseBurst(t + 0.02, 0.12, 3000, 1500, 0.15 * v, 1); },
    swing_priest: function (t, v) { tone('sine', 880, 880, t, 0.4, 0.15 * v); tone('sine', 1320, 1320, t + 0.05, 0.5, 0.1 * v); },
    swing_rogue:  function (t, v) { noiseBurst(t, 0.1, 2500, 6000, 0.28 * v, 1.2); tone('triangle', 700, 350, t, 0.07, 0.12 * v); },
    // สกิลแต่ละอาชีพ
    sk_sword:  function (t, v) { noiseBurst(t, 0.3, 800, 5000, 0.35 * v, 1); tone('triangle', 400, 200, t, 0.25, 0.2 * v); },
    sk_mage:   function (t, v) { tone('sine', 300, 900, t, 0.4, 0.2 * v); tone('triangle', 1200, 1200, t + 0.1, 0.4, 0.1 * v); noiseBurst(t, 0.3, 600, 3500, 0.15 * v, 1.2); },
    sk_archer: function (t, v) { tone('triangle', 260, 90, t, 0.2, 0.25 * v); noiseBurst(t, 0.3, 1000, 4000, 0.2 * v, 1); },
    sk_rogue:  function (t, v) { noiseBurst(t, 0.2, 1500, 5500, 0.3 * v, 1.2); tone('sine', 300, 150, t, 0.15, 0.15 * v); },
    sk_holy:   function (t, v) { [523, 659, 784].forEach(function (f, i) { tone('sine', f, f, t + i * 0.08, 0.6, 0.16 * v); }); },
    ult:       function (t, v) {
      tone('sine', 80, 40, t, 0.8, 0.5 * v); noiseBurst(t, 0.7, 300, 4000, 0.35 * v, 0.8);
      tone('triangle', 220, 880, t, 0.6, 0.2 * v); tone('sine', 1320, 1320, t + 0.3, 0.8, 0.15 * v);
    },
    dash:  function (t, v) { noiseBurst(t, 0.22, 600, 3000, 0.25 * v, 1); },
    coin:  function (t, v) { tone('sine', 1318, 1318, t, 0.12, 0.2 * v); tone('sine', 1760, 1760, t + 0.07, 0.3, 0.2 * v); },
    levelup: function (t, v) {
      [392, 494, 587, 784, 988].forEach(function (f, i) { tone('triangle', f, f, t + i * 0.11, 0.7, 0.22 * v); });
    }
  };
  function sfx(name, v) {
    if (muted || !ctx || ctx.state !== 'running' || !SFX[name]) return;
    var now = ctx.currentTime, gap = (name === 'hit' || name === 'hitSkill') ? 0.06 : 0.1;
    if (lastSfx[name] && now - lastSfx[name] < gap) return;
    if (active >= 10) return;
    lastSfx[name] = now; active++;
    setTimeout(function () { active = Math.max(0, active - 1); }, 300);
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

  function setMuted(b) { muted = !!b; save(); if (master) master.gain.value = level(); refreshBtn(); }

  // ---------- ปุ่มเปิด/ปิดเสียง ----------
  var btn = null;
  function refreshBtn() { if (!btn) return; var i = btn.querySelector('.hb-i'); if (i) i.textContent = muted ? '🔇' : '🔊'; }
  function layoutBtn() {
    var cv = document.querySelector('canvas');
    if (!cv || !btn) return;
    var r = cv.getBoundingClientRect();
    if (r.width < 50 || typeof W === 'undefined') return;
    var k = r.width / W;
    btn.style.cssText =
      'position:fixed;z-index:9000;box-sizing:border-box;padding:0;margin:0;cursor:pointer;touch-action:manipulation;' +
      '-webkit-tap-highlight-color:transparent;font-family:Mitr,sans-serif;color:#fff;overflow:hidden;' +
      'left:' + (r.left + 360 * k) + 'px;top:' + (r.top + 8 * k) + 'px;width:' + (50 * k) + 'px;height:' + (46 * k) + 'px;' +
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
    wrap.appendChild(i); wrap.appendChild(t); btn.appendChild(wrap);
    btn.addEventListener('click', function () { setMuted(!muted); if (!muted && want) begin(want); });
    document.body.appendChild(btn);
    refreshBtn(); layoutBtn();
  }
  window.addEventListener('resize', layoutBtn);
  window.addEventListener('orientationchange', function () { setTimeout(layoutBtn, 300); });
  document.addEventListener('fullscreenchange', function () { setTimeout(layoutBtn, 300); });
  setInterval(function () { makeBtn(); layoutBtn(); }, 500);

  var api = {
    play: function (name) { want = name; if (ctx && ctx.state === 'running') begin(name); },
    sfx: sfx,
    setVolume: function (v) { vol = Math.max(0, Math.min(1, v)); save(); if (master) master.gain.value = level(); },
    setSfxVolume: function (v) { sfxVol = Math.max(0, Math.min(1, v)); },
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
      // โจมตีปกติ: ดังเฉพาะตอนตีออกจริง (ดูจากคูลดาวน์ที่ถูกตั้งใหม่)
      if (typeof M.useBasicAttack === 'function') {
        var oBa = M.useBasicAttack;
        M.useBasicAttack = function () {
          var before = (this.cdEnd && this.cdEnd.basic) || 0;
          var r = oBa.apply(this, arguments);
          try {
            var after = (this.cdEnd && this.cdEnd.basic) || 0;
            if (after > before) {
              var cls = (typeof this.currentClass === 'function') ? this.currentClass() : 'sword';
              sfx('swing_' + cls, 0.9);
            }
          } catch (e) {}
          return r;
        };
      }
    }
    // เลขดาเมจ -> เสียงโดนตี (ใช้ showDamage ของ damageFx.js)
    if (typeof window.showDamage === 'function') {
      var oDmg = window.showDamage;
      window.showDamage = function (scene, x, y, amount, kind, opts) {
        try {
          kind = kind || 'normal';
          if (kind === 'player') sfx('hurt', 0.9);
          else if (kind === 'heal' || kind === 'regen') { if (kind === 'heal') sfx('heal', 0.8); }
          else if (kind === 'crit' || (opts && opts.crit)) sfx('crit', 1);
          else if (kind === 'skill' || (opts && opts.skill)) sfx('hitSkill', 0.9);
          else sfx('hit', 0.8);
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

  return api;
})();
