// js/systems/goldSync.js — ซิงก์ทองกับเซิร์ฟเวอร์ (ไม่ต้องแก้ไฟล์อื่นที่แตะ stats.gold)
// โหลดหลัง serverBoxes.js | ผู้เล่นแบบผู้เยี่ยมไม่ซิงก์ (ทองอยู่ในเครื่องเหมือนเดิม)
// หลักการ: stats.gold = ยอดที่ซิงก์แล้ว + ส่วนที่เปลี่ยนในเครื่องและยังไม่ส่ง
(function () {
  const SB = window.ServerBoxes;
  if (!SB) return;
  const REGION = 'asia-southeast1';
  const SYNC_MS = 10000;
  const NAMES = { blue: 'ฟ้า', red: 'แดง', gold: 'ทอง' };
  let fns = null, ready = false, initing = false, synced = 0, fl = null, queued = false;
  let queue = Promise.resolve();

  function sc() { return window.__mainScene; }
  function toast(t) { const s = sc(); if (s && s.toastMsg) s.toastMsg(t); }
  function user() {
    try { const u = firebase.auth().currentUser; return (u && !u.isAnonymous) ? u : null; } catch (e) { return null; }
  }
  function call(name, data) {
    if (!fns) fns = firebase.app().functions(REGION);
    return fns.httpsCallable(name)(data || {}).then(function (r) { return r.data; });
  }
  function uncertain(e) { return /unavailable|deadline|internal|unknown/.test(String((e && e.code) || '')); }
  function callRetry(name, data, n) {
    return call(name, data).catch(function (e) {
      if (n > 0 && uncertain(e)) return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return callRetry(name, data, n - 1); });
      throw e;
    });
  }
  function rid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function cur() { const s = sc(); return (s && s.stats) ? Math.max(0, Math.floor(Number(s.stats.gold) || 0)) : 0; }
  function addGold(n) { const s = sc(); if (s && s.stats && n) s.stats.gold += n; }
  function saveNow() { const s = sc(); if (s && s.saveSoon) s.saveSoon(); }

  // ทุกคำสั่งที่คุยกับเซิร์ฟเวอร์เรื่องทองเข้าคิวเดียว ทำทีละอัน (กันยอดเพี้ยนตอนซิงก์ชนกับเปิดกล่อง)
  function enqueue(fn) {
    const p = queue.then(fn);
    queue = p.catch(function () {});
    return p;
  }

  // ทองที่เซิร์ฟเวอร์บวกให้เองแล้ว (เปิดกล่อง): ปรับทั้งยอดในเกมและยอดที่ซิงก์ ไม่ให้นับเป็นส่วนต่างซ้ำ
  function credit(g) {
    addGold(g); synced += g;
    if (fl) fl.credited = (fl.credited || 0) + g;
  }

  // เริ่มครั้งแรกหลังโหลดเซฟเสร็จ: ย้ายทองขึ้นเซิร์ฟเวอร์ (ครั้งเดียว) แล้วใช้ยอดเซิร์ฟเวอร์เป็นหลักทุกครั้งที่เปิดเกม
  function init() {
    const s = sc();
    if (ready || initing || !s || !s.stats || !s._saveLoaded || !user()) return;
    initing = true;
    const base = cur();
    enqueue(function () {
      return call('getGoldWallet').then(function (w) {
        return w.imported ? w : call('importGold', { amount: base });
      });
    }).then(function (w) {
      addGold(w.gold - base);
      synced = w.gold; ready = true;
      if (w.gold !== base) saveNow();
      if (w.first && w.gold < base) toast('ย้ายทองขึ้นเซิร์ฟเวอร์ได้สูงสุด ' + w.gold.toLocaleString());
    }).catch(function (e) {
      if (!window.__gsErr) { window.__gsErr = 1; toast('ย้ายทองไม่สำเร็จ: ' + ((e && (e.code || e.message)) || e)); }
    }).then(function () { initing = false; });
  }

  function sync() {
    if (!ready || queued) return;
    queued = true;
    enqueue(function () {
      if (!fl) {
        const c = cur(), d = c - synced;
        if (d === 0) return;
        fl = { delta: d, reqId: rid(), sent: c, credited: 0 };
      }
      const f = fl;                      // ส่งไม่แน่ใจว่าถึงไหม -> ใช้ reqId เดิมซ้ำ ไม่นับซ้ำ
      return call('syncGold', { delta: f.delta, reqId: f.reqId }).then(function (r) {
        fl = null;
        addGold(r.balance - f.sent);     // ปรับให้ตรงเซิร์ฟเวอร์ (ส่วนที่เปลี่ยนระหว่างรอยังอยู่)
        synced = r.balance + (f.credited || 0);
        if (f.delta > 0 && r.granted < f.delta) toast('ทองส่วนเกินถูกปรับตามเซิร์ฟเวอร์');
        if (r.balance !== f.sent) saveNow();
      }).catch(function (e) { if (!uncertain(e)) fl = null; });
    }).then(function () { queued = false; });
  }

  // เปิดกล่อง (แทนของเดิมใน serverBoxes.js) ทองที่ได้เข้ากระเป๋าเซิร์ฟเวอร์
  const origOpen = SB.open;
  SB.open = function (color, sets) {
    if (!user()) { toast('ต้องล็อกอินด้วย Google ก่อน'); return Promise.resolve(); }
    if (!ready) return origOpen.call(SB, color, sets);   // ยังเชื่อมทองไม่สำเร็จ: เปิดแบบเดิมไปก่อน
    return enqueue(function () {
      return callRetry('openBoxes', { color: color, sets: sets || 1, reqId: rid() }, 2).then(function (r) {
        if (r.server) credit(r.gold); else addGold(r.gold);
        SB.boxes[color] = r.left;
        saveNow();
        toast('เปิดกล่อง' + NAMES[color] + ' ' + r.opened + ' ใบ ได้ทอง ' + r.gold.toLocaleString());
        return r;
      });
    }).catch(function (e) {
      toast((e && e.message) ? e.message : 'เปิดกล่องไม่สำเร็จ');
    });
  };

  setInterval(init, 1000);
  setInterval(sync, SYNC_MS);
  document.addEventListener('visibilitychange', function () { if (document.hidden) sync(); });
  window.addEventListener('pagehide', sync);
  window.GoldSync = { sync: sync, isReady: function () { return ready; }, synced: function () { return synced; } };
})();
