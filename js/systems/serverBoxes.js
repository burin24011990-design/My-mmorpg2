// js/systems/serverBoxes.js — ฝั่งไคลเอนต์ของกล่องเงิน + กระเป๋าทองเซิร์ฟเวอร์
//   ServerBoxes.kill(zoneId, kind) | .open(color, sets) | .boxes | .need
//   ServerBoxes.spend(amount, reason) -> หักทองที่เซิร์ฟเวอร์ (ใช้เมื่อ SERVER_GOLD = true)
// SERVER_GOLD = false : ทำงานเหมือนเดิม (ทองอยู่ในเครื่อง)
// SERVER_GOLD = true  : ย้ายทองขึ้นเซิร์ฟเวอร์ แล้วใช้ยอดเซิร์ฟเวอร์เป็นหลัก
//                       *** อย่าเปิด จนกว่าจะเปลี่ยนทุกจุดที่บวก/หักทองให้ผ่านเซิร์ฟเวอร์ ***
(function () {
  const SERVER_GOLD = false;
  const REGION = 'asia-southeast1';
  const FLUSH_MS = 45000;
  const MAX_SEND = 150;
  const KINDS = ['normal', 'ranged', 'boss'];
  const NAMES = { blue: 'ฟ้า', red: 'แดง', gold: 'ทอง' };
  const pend = {};
  let fns = null, busy = false, nextOk = 0;

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
  function total(z) { return z.normal + z.ranged + z.boss; }
  function setGold(v) {
    const s = sc();
    if (s && s.stats) { s.stats.gold = v; if (s.saveSoon) s.saveSoon(); }
  }

  const SB = window.ServerBoxes = { boxes: { blue: 0, red: 0, gold: 0 }, need: { blue: 20, red: 20, gold: 5 }, serverGold: false };

  SB.kill = function (zoneId, kind) {
    if (!user()) return;
    const z = pend[zoneId] || (pend[zoneId] = { normal: 0, ranged: 0, boss: 0 });
    z[KINDS.indexOf(kind) >= 0 ? kind : 'normal']++;
  };

  function take(z) {
    let left = MAX_SEND;
    const o = { normal: 0, ranged: 0, boss: 0 };
    KINDS.forEach(function (k) { const t = Math.min(z[k], left); o[k] = t; left -= t; });
    return o;
  }

  SB.flush = function () {
    if (busy || Date.now() < nextOk || !user()) return;
    const zid = Object.keys(pend).find(function (k) { return total(pend[k]) > 0; });
    if (!zid) return;
    const sent = take(pend[zid]);
    busy = true;
    callRetry('reportKills', { zone: Number(zid), kills: sent }, 2).then(function (r) {
      if (!r.ok) { nextOk = Date.now() + (r.retryIn || 10000); return; }
      KINDS.forEach(function (k) { pend[zid][k] -= sent[k]; });
      SB.boxes = r.boxes;
      const parts = Object.keys(r.got).filter(function (c) { return r.got[c] > 0; })
        .map(function (c) { return NAMES[c] + ' x' + r.got[c]; });
      if (parts.length) toast('ได้กล่อง ' + parts.join(' '));
    }).catch(function () { nextOk = Date.now() + 15000; })
      .then(function () { busy = false; });
  };

  SB.refresh = function () {
    if (!user()) return Promise.resolve();
    return call('getBoxes').then(function (r) { SB.boxes = r.boxes; SB.need = r.need; SB.range = r.range; });
  };

  // ซิงก์กระเป๋าทอง: ถ้ายังไม่เคยย้าย -> ย้ายทองในเครื่องขึ้นเซิร์ฟเวอร์ครั้งเดียว แล้วใช้ยอดเซิร์ฟเวอร์
  SB.syncGold = function () {
    if (!SERVER_GOLD || !user()) return Promise.resolve();
    return call('getWallet').then(function (w) {
      if (w.imported) return w;
      const s = sc();
      const local = Math.max(0, Math.floor((s && s.stats && s.stats.gold) || 0));
      return call('importGold', { amount: local });
    }).then(function (w) {
      SB.serverGold = true;
      setGold(w.gold);
    }).catch(function () {});
  };

  SB.spend = function (amount, reason) {
    if (!SB.serverGold) return Promise.resolve({ local: true });
    return callRetry('spendGold', { amount: Math.floor(amount), reason: reason || '', reqId: rid() }, 2).then(function (r) {
      setGold(r.balance);
      return r;
    });
  };

  SB.open = function (color, sets) {
    if (!user()) { toast('ต้องล็อกอินด้วย Google ก่อน'); return Promise.resolve(); }
    return callRetry('openBoxes', { color: color, sets: sets || 1, reqId: rid() }, 2).then(function (r) {
      const s = sc();
      if (r.server) setGold(r.balance);                       // ทองอยู่ที่เซิร์ฟเวอร์แล้ว
      else if (s && s.stats) { s.stats.gold += r.gold; if (s.saveSoon) s.saveSoon(); }
      SB.boxes[color] = r.left;
      toast('เปิดกล่อง' + NAMES[color] + ' ' + r.opened + ' ใบ ได้ทอง ' + r.gold.toLocaleString());
      return r;
    }).catch(function (e) {
      toast((e && e.message) ? e.message : 'เปิดกล่องไม่สำเร็จ');
    });
  };

  setInterval(SB.flush, FLUSH_MS);
  document.addEventListener('visibilitychange', function () { if (document.hidden) SB.flush(); });
  window.addEventListener('load', function () { setTimeout(function () { SB.refresh(); SB.syncGold(); }, 3000); });
})();
