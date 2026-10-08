// ===== ระบบเสียงแบบใช้ไฟล์ mp3 (v9) =====
// ไฟล์: js/systems/music.js | วาง "หลัง" town.js และ "ก่อน" main.js
//   <script src="js/systems/music.js?v=9"></script>
//
// วางไฟล์เสียงที่โฟลเดอร์ assets/audio/ ตามนี้ (ไฟล์ไหนไม่มี เกมจะเงียบเฉพาะเสียงนั้น ไม่พัง):
//   assets/audio/bgm/town.mp3          เพลงในเมือง
//   assets/audio/bgm/field.mp3         เพลงนอกเมือง
//   assets/audio/sfx/hit_sword.mp3  hit_priest.mp3  hit_mage.mp3  hit_archer.mp3  hit_rogue.mp3   (ตีโดน แยกอาชีพ)
//   assets/audio/sfx/crit.mp3  hurt.mp3  heal.mp3  dash.mp3  coin.mp3  levelup.mp3  ult.mp3
//   assets/audio/sfx/sk_sword.mp3  sk_mage.mp3  sk_archer.mp3  sk_rogue.mp3  sk_holy.mp3        (ตอนร่ายสกิล)
// พรอมต์สำหรับเจนเสียงด้วย AI อยู่ในไฟล์ audio_prompts.md
// ถ้าเปลี่ยนไฟล์เสียงแล้วมือถือยังได้ของเก่า ให้เพิ่มเลข AUDIO_VER ด้านล่าง

window.XhMusic = (function () {
  var BASE = 'assets/audio/';
  var AUDIO_VER = '1';
  var BGM = { town: 'bgm/town.mp3', field: 'bgm/field.mp3' };
  var SFX_NAMES = ['hit_sword', 'hit_priest', 'hit_mage', 'hit_archer', 'hit_rogue', 'crit', 'hurt', 'heal',
    'dash', 'coin', 'levelup', 'ult', 'sk_sword', 'sk_mage', 'sk_archer', 'sk_rogue', 'sk_holy'];

  var ctx = null, master = null, bgmGain = null, sfxGain = null;
  var muted = false, vol = 0.5, sfxVol = 0.8;
  var buffers = {}, want = null, cur = null, lastSfx = {}, active = 0, listeners = [];
  try {
    var st = JSON.parse(localStorage.getItem('xh_music'));
    if (st) {
      if (typeof st.vol === 'number') vol = st.vol;
      if (typeof st.sfx === 'number') sfxVol = st.sfx;
      muted = !!st.muted;
    }
  } catch (e) {}

  function save() { try { localStorage.setItem('xh_music', JSON.stringify({ vol: vol, sfx: sfxVol, muted: muted })); } catch (e) {} }
  function notify() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
  function applyGains() {
    if (!ctx) return;
    master.gain.value = muted ? 0 : 1;
    bgmGain.gain.value = vol;
    sfxGain.gain.value = sfxVol;
  }

  function init() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
    master = ctx.createGain(); master.connect(ctx.destination);
    bgmGain = ctx.createGain(); bgmGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    applyGains();
    SFX_NAMES.forEach(loadSfx);
    return true;
  }

  // ---------- เสียงเอฟเฟกต์ ----------
  function loadSfx(name) {
    if (buffers[name] !== undefined) return;
    buffers[name] = null;
    try {
      fetch(BASE + 'sfx/' + name + '.mp3?v=' + AUDIO_VER)
        .then(function (r) { if (!r.ok) throw new Error('no file'); return r.arrayBuffer(); })
        .then(function (ab) {
          return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); });
        })
        .then(function (buf) { buffers[name] = buf; })
        .catch(function () { /* ไม่มีไฟล์ = เงียบ */ });
    } catch (e) {}
  }

  function sfx(name, v) {
    if (muted || !ctx || ctx.state !== 'running') return;
    var buf = buffers[name];
    if (!buf) return;
    var now = ctx.currentTime;
    var gap = (name.indexOf('hit_') === 0 || name === 'crit') ? 0.08 : 0.1;
    if (lastSfx[name] && now - lastSfx[name] < gap) return;
    if (active >= 8) return;
    lastSfx[name] = now; active++;
    var src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf;
    src.playbackRate.value = 0.95 + Math.random() * 0.1;   // เปลี่ยนโทนนิดๆ ไม่ซ้ำซาก
    g.gain.value = (v === undefined ? 1 : v);
    src.connect(g); g.connect(sfxGain);
    src.onended = function () { active = Math.max(0, active - 1); };
    src.start(now);
  }

  // ---------- เพลงประกอบ (ครอสเฟดเมื่อเปลี่ยนฉาก) ----------
  function playBgm(key) {
    if (!init() || !BGM[key]) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (cur && cur.key === key) return;
    var old = cur;
    var el = new Audio(BASE + BGM[key] + '?v=' + AUDIO_VER);
    el.loop = true; el.preload = 'auto';
    var g = ctx.createGain(); g.gain.value = 0;
    try { ctx.createMediaElementSource(el).connect(g); g.connect(bgmGain); } catch (e) { return; }
    var p = el.play(); if (p && p.catch) p.catch(function () {});
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
    cur = { key: key, el: el, g: g };
    if (old) {
      old.g.gain.cancelScheduledValues(ctx.currentTime);
      old.g.gain.setValueAtTime(old.g.gain.value, ctx.currentTime);
      old.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
      setTimeout(function () { try { old.el.pause(); old.el.src = ''; } catch (e) {} }, 1700);
    }
  }

  // ---------- ปลดล็อกเสียงมือถือ (ต้องแตะจอก่อน) ----------
  var EVS = ['pointerdown', 'touchend', 'click'];
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (want && (!cur || cur.key !== want)) playBgm(want);
    if (ctx.state === 'running') EVS.forEach(function (e) { document.removeEventListener(e, unlock, true); });
  }
  EVS.forEach(function (e) { document.addEventListener(e, unlock, true); });
  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  function setMuted(b) { muted = !!b; save(); applyGains(); notify(); }

  var api = {
    play: function (name) { want = name; if (ctx && ctx.state === 'running') playBgm(name); },
    sfx: sfx,
    setVolume: function (v) { vol = Math.max(0, Math.min(1, v)); save(); applyGains(); },
    setSfxVolume: function (v) { sfxVol = Math.max(0, Math.min(1, v)); save(); applyGains(); },
    getVolume: function () { return vol; },
    getSfxVolume: function () { return sfxVol; },
    mute: setMuted,
    isMuted: function () { return muted; },
    onChange: function (f) { listeners.push(f); }
  };

  // ---------- เปลี่ยนเพลงตามฉาก ----------
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

  // ---------- ผูกเสียงกับฟังก์ชันจริงของเกม ----------
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
    if (M && typeof M.applySkillEffect === 'function') {
      var oSk = M.applySkillEffect;
      M.applySkillEffect = function (def) {
        try { var n = skillSoundName(def); if (n) sfx(n, 1); } catch (e) {}
        return oSk.apply(this, arguments);
      };
    }
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
          else sfx('hit_' + cls, 0.9);
        } catch (e) {}
        return oDmg.apply(this, arguments);
      };
    }
    if (window.SkillFx && typeof window.SkillFx.dashTrail === 'function') {
      var oDash = window.SkillFx.dashTrail;
      window.SkillFx.dashTrail = function () { try { sfx('dash', 1); } catch (e) {} return oDash.apply(this, arguments); };
    }
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

  // ---------- หน้าต่างปรับเสียง ----------
  function openSoundPanel(m) {
    var card = (m && typeof m.domCard === 'function') ? m.domCard('🔊 ตั้งค่าเสียง') : null;
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
    row('⚔️ เสียงเอฟเฟกต์', function () { return sfxVol; }, function (v) { api.setSfxVolume(v); }, function () { sfx('hit_sword', 1); });

    var mb = document.createElement('button');
    function paint() { mb.textContent = muted ? '🔇 ปิดเสียงอยู่ (แตะเพื่อเปิด)' : '🔊 แตะเพื่อปิดเสียงทั้งหมด'; }
    mb.style.cssText = 'font-family:inherit;font-size:15px;padding:9px 16px;border-radius:10px;cursor:pointer;margin-top:6px;' +
      'border:2px solid #ffd45c;color:#26090f;background:#ffd45c;width:100%';
    mb.addEventListener('click', function () { setMuted(!muted); paint(); });
    paint();
    card.appendChild(mb);
    if (typeof m.domCloseBtn === 'function') m.domCloseBtn(card);
  }

  // ---------- ปุ่มเสียง (DOM) ใต้ปุ่ม "สังคม" | หน่วยเป็นพิกัดเกม ปรับเลขตรงนี้ถ้าอยากย้าย ----------
  var SOUND_BTN = { x: 252, y: 112, w: 47, h: 43 };
  var sBtn = null;
  function sIcon() { var i = sBtn && sBtn.querySelector('.hb-i'); if (i) i.textContent = muted ? '🔇' : '🔊'; }
  function sLayout() {
    if (!sBtn) return;
    var cv = document.querySelector('canvas');
    var Wv = (typeof W !== 'undefined') ? W : 1280;
    if (!cv) { sBtn.style.display = 'none'; return; }
    var r = cv.getBoundingClientRect();
    if (r.width < 50) return;
    var k = r.width / Wv, B = SOUND_BTN;
    sBtn.style.cssText =
      'display:block;position:fixed;z-index:9500;box-sizing:border-box;padding:0;margin:0;cursor:pointer;touch-action:manipulation;' +
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
