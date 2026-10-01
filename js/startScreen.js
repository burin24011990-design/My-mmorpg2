// ===== หน้าเริ่มเกม + ล็อกอิน Google + เซฟคลาวด์ (Firebase) =====
// ทำงานก่อนเกมโหลด: ล็อกอิน -> ดึงเซฟจากคลาวด์ลง localStorage -> ค่อยโหลดสคริปต์เกม
// หลังเริ่มเกมจะอัปโหลดเซฟขึ้นคลาวด์อัตโนมัติ (ทุก 60 วิ / ตอนซ่อนแอป)
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LS = window.localStorage;
  var SKIP = /^(mmo_cloud_|firebase)/;     // คีย์ที่ไม่นับเป็นเซฟเกม

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
  var cloudName = '', nameEdited = false;
  var auth = null, db = null, user = null, canPush = false, mode = 'login', syncing = false;
  if (fbOK) {
    try { firebase.initializeApp(cfg); auth = firebase.auth(); db = firebase.firestore(); }
    catch (e) { fbOK = false; }
  }
  if (!fbOK) {
    $('btn-google').classList.add('off');
    $('login-note').textContent = 'ล็อกอิน Google ยังไม่พร้อม (ยังไม่ได้ใส่ค่า Firebase ใน js/firebaseConfig.js) เล่นแบบผู้เยี่ยมไปก่อนได้';
  }

  function pushNow(force) {
    if (!db || !user || !canPush) return Promise.resolve();
    var s = snapshot(), h = hash(s);
    if (!force && h === LS.getItem('mmo_cloud_hash')) return Promise.resolve();
    if (s.length > 900000) { toast('ข้อมูลเซฟใหญ่เกินไปสำหรับคลาวด์'); return Promise.resolve(); }
    return db.collection('saves').doc(user.uid).set({
      data: s, savedAtMs: Date.now(), name: user.displayName || '', email: user.email || '', charName: LS.getItem('mmo_cloud_lastname') || ''
    }).then(function () {
      LS.setItem('mmo_cloud_hash', h); LS.setItem('mmo_cloud_uid', user.uid);
      toast('☁ บันทึกขึ้นคลาวด์แล้ว');
    }).catch(function () { toast('⚠ บันทึกคลาวด์ไม่สำเร็จ'); });
  }

  // ดึงเซฟจากคลาวด์ + จัดการกรณีข้อมูลชนกัน
  function syncDown(u) {
    return db.collection('saves').doc(u.uid).get().then(function (snap) {
      var local = snapshot(), localEmpty = (local === '{}');
      var lastUid = LS.getItem('mmo_cloud_uid'), lastHash = LS.getItem('mmo_cloud_hash');
      function done() {
        LS.setItem('mmo_cloud_uid', u.uid); LS.setItem('mmo_cloud_hash', hash(snapshot())); canPush = true;
      }
      if (!snap.exists) {                          // ยังไม่มีเซฟบนคลาวด์
        if (localEmpty) { done(); return; }
        if (lastUid && lastUid !== u.uid) { backupLocal(); clearGame(); done(); return; }  // ข้อมูลเครื่องเป็นของบัญชีอื่น
        canPush = true; return pushNow(true).then(done);                                  // ย้ายข้อมูลเครื่อง/ผู้เยี่ยมขึ้นคลาวด์
      }
      var d = snap.data(), cloud = d.data || '{}';
      if (d.charName) { cloudName = d.charName; if (!LS.getItem('mmo_cloud_lastname')) LS.setItem('mmo_cloud_lastname', d.charName); }
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
  function cleanName(s) { return String(s || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 12); }
  function showReady(m, u) {
    mode = m;
    $('u-card').hidden = !u;
    if (u) {
      $('u-name').textContent = u.displayName || 'ผู้เล่น';
      $('u-mail').textContent = u.email || '';
      $('u-photo').src = u.photoURL || '';
      $('u-photo').style.visibility = u.photoURL ? 'visible' : 'hidden';
    }
    var def = LS.getItem('mmo_cloud_lastname') || (u && u.displayName ? cleanName(u.displayName.split(' ')[0]) : '');
    if (!$('in-name').value) $('in-name').value = def;
    $('lnk-out').textContent = u ? 'สลับบัญชี / ออกจากระบบ' : '← กลับไปเลือกวิธีเข้าเล่น';
    var cs = $('cloud-state');
    if (u) { cs.className = 'ls-cloud'; cs.textContent = 'กำลังซิงก์ข้อมูลกับคลาวด์...'; }
    else { cs.className = 'ls-cloud warn'; cs.textContent = 'โหมดผู้เยี่ยม: เซฟอยู่ในเครื่องนี้เท่านั้น ล้างข้อมูลเบราว์เซอร์แล้วจะหาย'; }
    setView('ready');
  }
  function runSync(u) {
    var btn = $('btn-start'), cs = $('cloud-state');
    btn.disabled = true; syncing = true; canPush = false;
    syncDown(u).then(function () {
      if (cloudName && !nameEdited) $('in-name').value = cloudName;     // ใช้ชื่อตัวละครที่เคยตั้งไว้ในบัญชี
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
  $('in-name').addEventListener('input', function () { nameEdited = true; });
  $('btn-guest').onclick = function () { showReady('guest', null); };
  $('lnk-out').onclick = function () {
    if (user && auth) { canPush = false; auth.signOut(); }   // onAuthStateChanged จะพากลับหน้าล็อกอิน
    else { mode = 'login'; setView('login'); }
  };

  if (fbOK) {
    setView('loading');
    var guard = setTimeout(function () { if (!$('v-loading').hidden) setView('login'); }, 7000);
    auth.onAuthStateChanged(function (u) {
      clearTimeout(guard); user = u;
      if (u) { showReady('user', u); runSync(u); }
      else if (mode !== 'guest') setView('login');
    });
    auth.getRedirectResult().catch(function () {});
  } else {
    setView('login');
  }

  // ---------- เริ่มเกม ----------
  function startAutosave() {
    if (!user) return;
    setInterval(function () { pushNow(false); }, 60000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) pushNow(false); });
    window.addEventListener('pagehide', function () { pushNow(false); });
  }

  $('btn-start').onclick = function () {
    if (syncing) return;
    var name = cleanName($('in-name').value) || 'ผู้เล่น';
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
  };
})();
