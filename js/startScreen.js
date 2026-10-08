// ===== หน้าเริ่มเกม + ล็อกอิน Google + เซฟคลาวด์ (Firebase) =====
// ล็อกอิน Google (เซฟคลาวด์) หรือเล่นแบบ "ผู้เยี่ยมชม" (ทดสอบ: เซฟในเครื่องเท่านั้น ชื่อมี G- นำหน้า)
// ทำงานก่อนเกมโหลด: ล็อกอิน -> ดึงเซฟจากคลาวด์ลง localStorage -> ค่อยโหลดสคริปต์เกม
// หลังเริ่มเกมจะอัปโหลดเซฟขึ้นคลาวด์อัตโนมัติ (ทุก 15 วิ / ตอนซ่อนแอป / เมื่อเกมเรียก CloudSave.soon())
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LS = window.localStorage;
  var SKIP = /^(mmo_cloud_|firebase)/;     // คีย์ที่ไม่นับเป็นเซฟเกม
  var GUEST_NAME_MAX = 9;                  // ชื่อผู้เยี่ยมชมยาวสุด (รวม "G-" แล้วไม่เกิน 12 ตามที่เซิร์ฟเวอร์ตัด)
  var guestMode = false;

  // ---------- หน่วงการสร้างเกม: main.js เรียก new Phaser.Game ตอนโหลด แต่เราจะสร้างจริงหลังกดเริ่มเล่น ----------
  var RealGame = window.Phaser && Phaser.Game, pendingCfg = null;
  if (RealGame) {
    Phaser.Game = function (config) { pendingCfg = config; };
    Phaser.Game.prototype = RealGame.prototype;
  }

  // ---------- ฝุ่นไฟลอย ----------
  (function embers() {
    var box = $('embers'); if (!box) return;
    for (var i = 0; i < 26; i++) {
      var s = document.createElement('i'), z = 2 + Math.random() * 4;
      s.style.cssText = 'left:' + (Math.random() * 100) + '%;width:' + z + 'px;height:' + z + 'px;' +
        'animation-duration:' + (6 + Math.random() * 8) + 's;animation-delay:' + (-Math.random() * 12) + 's;' +
        '--dx:' + (Math.random() * 80 - 40) + 'px';
      box.appendChild(s);
    }
  })();

  // ---------- เครื่องมือเล็ก ๆ ----------
  var toastTimer;
  function toast(msg) {
    var t = $('cloud-toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h) + ':' + s.length; }
  function setView(name) {
    ['login', 'ready', 'loading'].forEach(function (v) { $('v-' + v).hidden = (v !== name); });
  }
  function ask(msg, okText, noText) {
    return new Promise(function (resolve) {
      var m = document.createElement('div'); m.className = 'ls-modal';
      m.innerHTML = '<div class="box"><div></div><button class="btn btn-gold"></button><button class="btn btn-ghost"></button></div>';
      var b = m.querySelectorAll('button');
      m.querySelector('.box > div').textContent = msg;
      b[0].textContent = okText; b[1].textContent = noText;
      b[0].onclick = function () { m.remove(); resolve(true); };
      b[1].onclick = function () { m.remove(); resolve(false); };
      $('login-screen').appendChild(m);
    });
  }

  // ---------- เซฟเกม = ทุกคีย์ใน localStorage (เรียงลำดับคงที่) ----------
  function snapshot() {
    var keys = [], o = {}, i;
    for (i = 0; i < LS.length; i++) { var k = LS.key(i); if (!SKIP.test(k)) keys.push(k); }
    keys.sort();
    keys.forEach(function (k) { o[k] = LS.getItem(k); });
    return JSON.stringify(o);
  }
  function clearGame() {
    var keys = [], i;
    for (i = 0; i < LS.length; i++) { var k = LS.key(i); if (!SKIP.test(k)) keys.push(k); }
    keys.forEach(function (k) { LS.removeItem(k); });
  }
  function restore(str) {
    var o = {}; try { o = JSON.parse(str) || {}; } catch (e) {}
    clearGame();
    Object.keys(o).forEach(function (k) { try { LS.setItem(k, o[k]); } catch (e) {} });
  }
  var SAVE_KEY = 'my_mmorpg_save_v1';
  function describe(str) {       // อ่านเลเวล/เวลาเซฟจากข้อมูลเซฟของเกม เพื่อแสดงในกล่องถาม
    try {
      var d = JSON.parse(JSON.parse(str)[SAVE_KEY]);
      var lv = d && d.stats && d.stats.level, t = d && d.savedAt;
      return (lv ? 'Lv.' + lv : 'ไม่ทราบเลเวล') + (t ? ' · ' + new Date(t).toLocaleString('th-TH') : '');
    } catch (e) { return 'ไม่มีข้อมูล'; }
  }
  function backupLocal() { try { LS.setItem('mmo_cloud_backup', snapshot()); } catch (e) {} }

  // ---------- Firebase ----------
  var cfg = window.FIREBASE_CONFIG || {};
  var fbOK = !!(window.firebase && cfg.apiKey && cfg.projectId);
  var cloudName = '';
  var auth = null, db = null, fns = null, user = null, canPush = false, syncing = false;
  if (fbOK) {
    try {
      firebase.initializeApp(cfg); auth = firebase.auth(); db = firebase.firestore();
      // ถ้า functions deploy ไว้นอก us-central1 ให้เปลี่ยนเป็น firebase.app().functions('ชื่อ-region')
      fns = (firebase.functions ? firebase.app().functions('asia-southeast1') : null);
    }
    catch (e) { fbOK = false; }
  }
  if (!fbOK) {
    $('btn-google').classList.add('off');
    $('login-note').className = 'ls-note err';
    $('login-note').textContent = 'ระบบล็อกอินยังไม่พร้อม (ยังไม่ได้ใส่ค่า Firebase ใน js/firebaseConfig.js) ตอนนี้เล่นได้เฉพาะแบบผู้เยี่ยมชม';
  }

  // ---------- อัปโหลดเซฟขึ้นคลาวด์ ----------
  var pushing = false;      // กำลังเขียนอยู่ (กันเขียนซ้อนกัน)
  var pushAgain = false;    // มีคำขอเข้ามาระหว่างเขียน -> เขียนอีกรอบหลังเสร็จ
  var lastPush = 0;         // เวลาที่เริ่มเขียนรอบล่าสุด
  var soonTimer = null;
  var failShown = false;    // แจ้งเตือนเขียนไม่สำเร็จแค่ครั้งเดียวต่อช่วงที่ล้มเหลว

  // เหตุการณ์สำคัญ: อัปโหลดเร็วขึ้น แต่ห่างกันอย่างน้อย ~8 วิ (กันเกินโควตา Firestore)
  function pushSoon() {
    if (soonTimer) return;
    var wait = Math.max(1500, 8000 - (Date.now() - lastPush));
    soonTimer = setTimeout(function () { soonTimer = null; pushNow(false, true); }, wait);
  }

  function pushNow(force, quiet) {
    try { if (window.GameSaveNow) window.GameSaveNow(); } catch (e) {}   // เซฟลงเครื่องก่อนเสมอ (ผู้เยี่ยมชมได้แค่ขั้นตอนนี้)
    if (!db || !user || !canPush) return Promise.resolve();
    if (pushing) { pushAgain = true; return Promise.resolve(); }
    var s = snapshot(), h = hash(s);
    if (!force && h === LS.getItem('mmo_cloud_hash')) return Promise.resolve();
    if (s.length > 900000) { toast('ข้อมูลเซฟใหญ่เกินไปสำหรับคลาวด์'); return Promise.resolve(); }
    pushing = true; lastPush = Date.now();
    return db.collection('saves').doc(user.uid).set({
      data: s, savedAtMs: Date.now(), name: user.displayName || '', email: user.email || '', charName: LS.getItem('mmo_cloud_lastname') || ''
    }).then(function () {
      LS.setItem('mmo_cloud_hash', h); LS.setItem('mmo_cloud_uid', user.uid);
      failShown = false;
      if (!quiet) toast('☁ บันทึกขึ้นคลาวด์แล้ว');
    }).catch(function () {
      if (!quiet || !failShown) toast('⚠ บันทึกคลาวด์ไม่สำเร็จ');
      failShown = true;
    }).then(function () {
      pushing = false;
      if (pushAgain) { pushAgain = false; pushSoon(); }
    });
  }

  // ดึงเซฟจากคลาวด์ + จัดการกรณีข้อมูลชนกัน
  function syncDown(u) {
    return db.collection('saves').doc(u.uid).get().then(function (snap) {
      var local = snapshot(), localEmpty = (local === '{}');
      var lastUid = LS.getItem('mmo_cloud_uid'), lastHash = LS.getItem('mmo_cloud_hash');
      // ข้อมูลในเครื่องเป็นของผู้เยี่ยมชม -> ไม่ย้ายขึ้นบัญชีจริง: เก็บสำรองไว้แล้วเริ่มจากคลาวด์ของบัญชีนี้
      if (lastUid === 'guest') {
        backupLocal(); clearGame(); LS.removeItem('mmo_cloud_hash');
        local = snapshot(); localEmpty = true; lastUid = null; lastHash = null;
      }
      // ชื่อที่จำไว้เป็นของบัญชีอื่น -> ทิ้ง (กันชื่อข้ามบัญชี)
      if (lastUid && lastUid !== u.uid) LS.removeItem('mmo_cloud_lastname');
      if (localEmpty) LS.removeItem('mmo_cloud_lastname');
      function done() {
        LS.setItem('mmo_cloud_uid', u.uid); LS.setItem('mmo_cloud_hash', hash(snapshot())); canPush = true;
      }
      if (!snap.exists) {                          // ยังไม่มีเซฟบนคลาวด์
        if (localEmpty) { done(); return; }
        if (lastUid && lastUid !== u.uid) { backupLocal(); clearGame(); done(); return; }  // ข้อมูลเครื่องเป็นของบัญชีอื่น
        canPush = true; return pushNow(true).then(done);                                  // ย้ายข้อมูลเครื่อง (เช่นจากเวอร์ชันผู้เยี่ยมเดิม) ขึ้นคลาวด์
      }
      var d = snap.data(), cloud = d.data || '{}';
      if (d.charName) { cloudName = d.charName; LS.setItem('mmo_cloud_lastname', d.charName); }
      if (cloud === local) { done(); return; }
      if (localEmpty || (lastUid === u.uid && lastHash === hash(local))) {                // เครื่องไม่ได้แก้ -> ใช้คลาวด์
        if (!localEmpty) backupLocal();
        restore(cloud); done(); return;
      }
      return ask('พบข้อมูลเซฟที่ไม่ตรงกัน\n☁ คลาวด์: ' + describe(cloud) + '\n📱 เครื่องนี้: ' + describe(local) + '\nจะใช้ข้อมูลไหน?',
        'ใช้ข้อมูลบนคลาวด์', 'ใช้ข้อมูลเครื่องนี้ (ทับคลาวด์)').then(function (useCloud) {
        if (useCloud) { backupLocal(); restore(cloud); done(); }
        else { canPush = true; return pushNow(true).then(done); }
      });
    });
  }

  // ---------- หน้าจอ ----------
  // ชื่อตัวละครยาวสุด 15 ตัวอักษร (นับแบบ code point)
  function cleanName(s) {
    var t = String(s || '').replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
    return Array.from(t).slice(0, 15).join('');
  }

  // ล็อกช่องชื่อ: ตั้งชื่อแล้วเปลี่ยนไม่ได้
  function lockName(n) {
    var i = $('in-name');
    i.value = n; i.readOnly = true; i.disabled = true; i.placeholder = '';
    var lb = document.querySelector('label[for="in-name"]');
    if (lb) lb.textContent = 'ชื่อตัวละคร (ตั้งแล้ว เปลี่ยนไม่ได้)';
  }
  function unlockName() {
    var i = $('in-name');
    i.readOnly = false; i.disabled = false; i.placeholder = 'ไม่เกิน 15 ตัวอักษร'; i.maxLength = 15;
    var lb = document.querySelector('label[for="in-name"]');
    if (lb) lb.textContent = 'ชื่อตัวละคร (ตั้งได้ครั้งเดียว เปลี่ยนไม่ได้)';
  }

  function showReady(u) {
    guestMode = false;
    $('u-name').textContent = u.displayName || 'ผู้เล่น';
    $('u-mail').textContent = u.email || '';
    $('u-photo').src = u.photoURL || '';
    $('u-photo').style.visibility = u.photoURL ? 'visible' : 'hidden';
    unlockName();
    $('in-name').value = '';
    // ชื่อตั้งต้น: ใช้ชื่อที่จำไว้เฉพาะเมื่อเป็นของบัญชีนี้ ไม่งั้นใช้ชื่อแรกจากบัญชี Google
    var mine = LS.getItem('mmo_cloud_uid') === u.uid ? LS.getItem('mmo_cloud_lastname') : '';
    $('in-name').value = mine || (u.displayName ? cleanName(u.displayName.split(' ')[0]) : '');
    $('lnk-out').textContent = 'สลับบัญชี / ออกจากระบบ';
    var cs = $('cloud-state');
    cs.className = 'ls-cloud'; cs.textContent = 'กำลังซิงก์ข้อมูลกับคลาวด์...';
    setView('ready');
  }

  // หน้าเตรียมเริ่มเล่นแบบผู้เยี่ยมชม (ใช้หน้าจอเดียวกับ v-ready)
  function showGuest() {
    guestMode = true; user = null; canPush = false;
    $('u-name').textContent = 'ผู้เยี่ยมชม (ทดสอบ)';
    $('u-mail').textContent = 'เซฟในเครื่องนี้เท่านั้น';
    $('u-photo').removeAttribute('src');
    $('u-photo').style.visibility = 'hidden';
    unlockName();
    var i = $('in-name');
    i.maxLength = GUEST_NAME_MAX;
    i.placeholder = 'ไม่เกิน ' + GUEST_NAME_MAX + ' ตัวอักษร';
    var prev = LS.getItem('mmo_cloud_uid') === 'guest' ? (LS.getItem('mmo_cloud_lastname') || '') : '';
    i.value = Array.from(prev.replace(/^G-/, '')).slice(0, GUEST_NAME_MAX).join('');
    var lb = document.querySelector('label[for="in-name"]');
    if (lb) lb.textContent = 'ชื่อตัวละคร (ผู้เยี่ยมชมจะมี G- นำหน้า)';
    $('lnk-out').textContent = '← กลับไปเข้าสู่ระบบด้วย Google';
    var cs = $('cloud-state');
    cs.className = 'ls-cloud warn';
    cs.textContent = 'โหมดผู้เยี่ยมชม: เซฟในเครื่องนี้เท่านั้น ล้างเบราว์เซอร์แล้วหาย และไม่ได้กล่อง/ทองฝั่งเซิร์ฟเวอร์';
    cs.onclick = null;
    $('btn-start').disabled = false;
    setView('ready');
  }

  // เตรียมข้อมูลในเครื่องก่อนเริ่มเล่นแบบผู้เยี่ยมชม
  function prepGuestLocal() {
    var lastUid = LS.getItem('mmo_cloud_uid');
    if (lastUid && lastUid !== 'guest') { backupLocal(); clearGame(); }   // เครื่องนี้เคยเล่นด้วยบัญชีจริง -> เก็บสำรองแล้วเริ่มสะอาด (บัญชีจริงยังมีเซฟบนคลาวด์)
    LS.setItem('mmo_cloud_uid', 'guest');
    LS.removeItem('mmo_cloud_hash');
  }

  function runSync(u) {
    var btn = $('btn-start'), cs = $('cloud-state');
    btn.disabled = true; syncing = true; canPush = false;
    syncDown(u).then(function () {
      if (cloudName) lockName(cloudName);       // เคยตั้งชื่อในบัญชีนี้แล้ว -> ล็อกถาวร
      cs.className = 'ls-cloud'; cs.textContent = '☁ ซิงก์กับคลาวด์เรียบร้อย';
    }).catch(function () {
      cs.className = 'ls-cloud warn';
      cs.textContent = '⚠ เชื่อมต่อคลาวด์ไม่ได้ เล่นต่อได้ แต่จะยังไม่อัปโหลดเซฟ (แตะที่นี่เพื่อลองใหม่)';
      cs.onclick = function () { cs.onclick = null; runSync(u); };
    }).then(function () { btn.disabled = false; syncing = false; });
  }

  function authError(e) {
    var c = e && e.code || '';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
    if (c === 'auth/unauthorized-domain') return 'โดเมนนี้ยังไม่ได้อนุญาตใน Firebase (Authentication > Settings > Authorized domains)';
    if (c === 'auth/network-request-failed') return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้';
    return 'เข้าสู่ระบบไม่สำเร็จ (' + (c || (e && e.message) || 'unknown') + ')';
  }

  $('btn-google').onclick = function () {
    var note = $('login-note');
    if (!fbOK) { note.className = 'ls-note err'; note.textContent = 'ยังไม่ได้ตั้งค่า Firebase ใน js/firebaseConfig.js'; return; }
    note.className = 'ls-note'; setView('loading');
    var p = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(p).catch(function (e) {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
        return auth.signInWithRedirect(p);
      }
      setView('login');
      var m = authError(e); if (m) { note.className = 'ls-note err'; note.textContent = m; }
    });
  };

  var guestBtn = $('btn-guest');
  if (guestBtn) guestBtn.onclick = function () { showGuest(); };

  $('lnk-out').onclick = function () {
    if (user && auth) { canPush = false; cloudName = ''; auth.signOut(); }   // onAuthStateChanged จะพากลับหน้าล็อกอิน
    else { guestMode = false; setView('login'); }
  };

  if (fbOK) {
    setView('loading');
    var guard = setTimeout(function () { if (!$('v-loading').hidden) setView('login'); }, 7000);
    auth.onAuthStateChanged(function (u) {
      clearTimeout(guard); user = u;
      if (u) { guestMode = false; showReady(u); runSync(u); }
      else if (!guestMode) setView('login');
    });
    auth.getRedirectResult().catch(function () {});
  } else {
    setView('login');
  }

  // ---------- เริ่มเกม ----------
  var autosaveOn = false;
  function startAutosave() {
    if (autosaveOn) return;
    autosaveOn = true;
    // ผู้เยี่ยมชม: pushNow เซฟลงเครื่องอย่างเดียว (ไม่อัปโหลดคลาวด์เพราะไม่มี user)
    setInterval(function () { pushNow(false, true); }, 15000);                                   // ทุก 15 วิ (ถ้าข้อมูลเปลี่ยน)
    document.addEventListener('visibilitychange', function () { if (document.hidden) pushNow(false, true); });
    window.addEventListener('pagehide', function () { pushNow(false, true); });
    // ให้เกมเรียกใช้: CloudSave.soon() = อัปโหลดเร็วขึ้น (ไม่เกินทุก ~8 วิ) | CloudSave.now() = อัปโหลดทันที
    window.CloudSave = { now: function () { return pushNow(false, true); }, soon: pushSoon };
  }

  var checking = false;

  // เริ่มเกมจริง (เรียกหลังชื่อผ่านการตรวจแล้ว)
  function begin(name) {
    try { LS.setItem('mmo_cloud_lastname', name); } catch (e) {}

    // เกมถามชื่อตัวละครด้วย prompt() -> ตอบด้วยชื่อที่กรอกไว้ (ครั้งเดียว)
    var origPrompt = window.prompt;
    window.prompt = function (msg) {
      if (/ตั้งชื่อตัวละคร/.test(String(msg || ''))) { window.prompt = origPrompt; return name; }
      return origPrompt.apply(window, arguments);
    };

    if (window.GameFS) { GameFS.enter(); GameFS.setStarted(); }   // ต้องเรียกตอนแตะ เพื่อเข้าเต็มจอ
    $('login-screen').classList.add('out');
    setTimeout(function () { $('login-screen').style.display = 'none'; }, 450);
    if (RealGame) { Phaser.Game = RealGame; if (pendingCfg) new RealGame(pendingCfg); }
    startAutosave();
  }

  $('btn-start').onclick = function () {
    if (syncing || checking) return;
    var cs = $('cloud-state'), btn = $('btn-start');

    // ----- ผู้เยี่ยมชม: ไม่ต้องล็อกอิน/ไม่ตรวจชื่อผ่านเซิร์ฟเวอร์ -----
    if (guestMode) {
      var gn = Array.from(cleanName($('in-name').value)).slice(0, GUEST_NAME_MAX).join('').trim();
      if (Array.from(gn).length < 2) { toast('ชื่อต้องยาวอย่างน้อย 2 ตัวอักษร'); return; }
      prepGuestLocal();
      begin('G-' + gn);
      return;
    }

    if (!user) { toast('กรุณาเข้าสู่ระบบก่อน'); setView('login'); return; }
    if (!fns) {                                  // ต้องตรวจชื่อผ่านเซิร์ฟเวอร์เสมอ
      cs.className = 'ls-cloud warn'; cs.textContent = '⚠ ระบบตรวจชื่อยังไม่พร้อม ลองใหม่อีกครั้ง';
      return;
    }
    var name = cleanName($('in-name').value);
    if (!name) { toast('กรุณาตั้งชื่อตัวละคร'); return; }

    // ให้เซิร์ฟเวอร์ตรวจ: ความยาว 2-15 / คำหยาบ / ชื่อซ้ำ แล้วจองชื่อและล็อกถาวร
    checking = true; btn.disabled = true;
    fns.httpsCallable('claimName')({ name: name }).then(function (r) {
      var finalName = (r.data && r.data.name) || name;
      if (r.data && r.data.locked) lockName(finalName);   // เซิร์ฟเวอร์บอกว่าเคยตั้งชื่อแล้ว -> ใช้ชื่อเดิม
      begin(finalName);
    }).catch(function (e) {
      var c = (e && e.code) || '', msg;
      if (c === 'functions/already-exists' || c === 'functions/invalid-argument') msg = e.message;
      else if (c === 'functions/unauthenticated') msg = 'กรุณาเข้าสู่ระบบก่อน';
      else msg = 'ตรวจสอบชื่อไม่ได้ ลองใหม่อีกครั้ง';
      cs.className = 'ls-cloud warn'; cs.textContent = '⚠ ' + msg; toast(msg);
    }).then(function () { checking = false; btn.disabled = false; });
  };
})();
