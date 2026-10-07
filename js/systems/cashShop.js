// ===== ร้านค้าแคช (เงินจริง): ซื้อตั๋วลงขายตลาดกลางผ่าน Stripe =====
// โหลดหลัง firebase-functions-compat.js (วางก่อน main.js ได้เลย)
// เรียกใช้: CashShop.open(onPaid)  | onPaid = ฟังก์ชันที่จะเรียกเมื่อตั๋วเข้าบัญชีแล้ว (ไม่จำเป็นต้องใส่)
// หน้านี้แค่สร้างลิงก์จ่ายเงิน ตั๋วจะถูกเพิ่มโดยเซิร์ฟเวอร์เมื่อ Stripe แจ้งว่าจ่ายสำเร็จเท่านั้น
(function () {
  var REGION = 'asia-southeast1';   // ต้องตรงกับ functions/cashshop.js
  var POLL_MS = 4000, POLL_MAX = 45; // ตรวจยอดตั๋วทุก 4 วิ นานสุด ~3 นาทีหลังกดซื้อ
  var fns = null, ov = null, poll = null, onVis = null;

  function call(name, data) {
    if (!fns) fns = firebase.app().functions(REGION);
    return fns.httpsCallable(name)(data || {}).then(function (r) { return r.data; });
  }
  function errMsg(e) { return (e && e.message) ? e.message : 'เกิดข้อผิดพลาด'; }
  function toast(t) { var s = window.__mainScene; if (s && s.toastMsg) s.toastMsg(t); }
  function total(w) { var t = (w && w.tickets) || {}; return (t[1] || 0) + (t[2] || 0) + (t[3] || 0); }
  function mk(tag, css, txt) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function stopPoll() {
    if (poll) { clearInterval(poll); poll = null; }
    if (onVis) { document.removeEventListener('visibilitychange', onVis); onVis = null; }
  }
  function close() {
    stopPoll();
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    ov = null;
  }

  function open(onPaid) {
    if (!window.firebase || !firebase.functions) { toast('ยังไม่ได้โหลด firebase-functions'); return; }
    if (!firebase.auth().currentUser) { toast('ต้องล็อกอินด้วย Google ก่อน'); return; }
    close();

    ov = mk('div', 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:8px;box-sizing:border-box;touch-action:pan-y');
    var pn = mk('div', 'width:min(94vw,520px);max-height:94vh;overflow:auto;box-sizing:border-box;background:linear-gradient(#2a1018,#160a0e);border:2px solid #c9a45c;border-radius:14px;padding:12px 14px;color:#eee4d2;font-family:Kanit,Mitr,sans-serif;font-size:13px;text-align:left;box-shadow:0 0 0 2px #000,0 8px 30px rgba(0,0,0,.7)');
    ov.appendChild(pn);
    ['pointerdown', 'touchstart', 'touchmove', 'mousedown'].forEach(function (evn) {
      ov.addEventListener(evn, function (e) { e.stopPropagation(); }, { passive: true });
    });

    var head = mk('div', 'display:flex;align-items:center;gap:8px;margin-bottom:8px');
    head.appendChild(mk('div', 'flex:1;font-size:17px;font-weight:600;color:#f2d48a', '💎 ร้านค้าแคช'));
    var x = mk('button', 'width:34px;height:34px;background:#2a1214;color:#fff;border:2px solid #6b5330;font:inherit;cursor:pointer', '✕');
    x.addEventListener('click', close);
    head.appendChild(x);
    pn.appendChild(head);

    var bal = mk('div', 'color:#f2d48a;margin-bottom:2px', 'กำลังโหลด...');
    var left = mk('div', 'color:#a3949a;font-size:12px;margin-bottom:8px');
    var list = mk('div');
    var status = mk('div', 'margin-top:8px;min-height:18px;font-size:12px;color:#bbb;line-height:1.6');
    var note = mk('div', 'margin-top:8px;font-size:11px;color:#8a7d82;line-height:1.5',
      'ชำระผ่านบัตรหรือพร้อมเพย์บนหน้าของ Stripe ตั๋วเข้าบัญชีอัตโนมัติหลังจ่ายสำเร็จ ' +
      'หากจ่ายแล้วตั๋วไม่เข้า แจ้งผู้ดูแลพร้อมรหัสผู้เล่น: ' + firebase.auth().currentUser.uid);
    note.style.wordBreak = 'break-all';
    pn.append(bal, left, list, status, note);

    var buttons = [];
    function setBusy(b) { buttons.forEach(function (e) { e.disabled = b; e.style.opacity = b ? '.5' : '1'; }); }

    function refresh() {
      return call('getWallet').then(function (w) {
        var t = w.tickets || {};
        bal.textContent = '🎫 ตั๋วที่มี: ระดับ 1 ×' + (t[1] || 0) + ' | ระดับ 2 ×' + (t[2] || 0) + ' | ระดับ 3 ×' + (t[3] || 0);
        return w;
      });
    }

    // รอให้ตั๋วเข้า: เทียบยอดรวมก่อน/หลังกดซื้อ
    function watch(baseline) {
      stopPoll();
      var n = 0;
      function check() {
        refresh().then(function (w) {
          if (total(w) > baseline) {
            stopPoll(); setBusy(false);
            status.style.color = '#7be07b';
            status.textContent = '✓ ได้รับตั๋วแล้ว';
            toast('ได้รับตั๋วแล้ว');
            if (typeof onPaid === 'function') { try { onPaid(); } catch (e) {} }
          }
        }).catch(function () {});
      }
      poll = setInterval(function () {
        n++;
        if (n > POLL_MAX) {
          stopPoll(); setBusy(false);
          status.style.color = '#e0a05a';
          status.textContent = 'ยังไม่พบรายการชำระเงิน ถ้าจ่ายแล้วให้รอสักครู่แล้วเปิดร้านใหม่ หรือแจ้งผู้ดูแล';
          return;
        }
        check();
      }, POLL_MS);
      onVis = function () { if (!document.hidden) check(); };   // กลับมาจากหน้าจ่ายเงินแล้วเช็กทันที
      document.addEventListener('visibilitychange', onVis);
    }

    function buy(p) {
      setBusy(true);
      status.style.color = '#bbb';
      status.textContent = 'กำลังสร้างหน้าชำระเงิน...';
      refresh().then(function (w0) {
        var baseline = total(w0);
        return call('createCheckout', { productId: p.id }).then(function (r) {
          status.textContent = '';
          var a = mk('a', 'display:inline-block;padding:10px 16px;border-radius:8px;border:2px solid #c9a45c;background:#c9a45c;color:#26090f;font-weight:600;text-decoration:none;font-size:14px', 'แตะเพื่อไปชำระเงิน ฿' + p.baht.toLocaleString());
          a.href = r.url; a.target = '_blank'; a.rel = 'noopener';
          status.append(a, mk('div', 'margin-top:6px', 'จ่ายเสร็จแล้วกลับมาที่เกม ระบบจะตรวจตั๋วให้อัตโนมัติ (หน้าชำระเงินหมดอายุใน 30 นาที)'));
          watch(baseline);
        });
      }).catch(function (e) {
        setBusy(false);
        status.style.color = '#ff9a9a';
        status.textContent = errMsg(e);
      });
    }

    Promise.all([call('getCashProducts'), refresh()]).then(function (res) {
      var d = res[0];
      left.textContent = 'ซื้อตั๋วได้อีก ' + d.dailyLeft + ' ใบใน 24 ชม.';
      d.products.forEach(function (p) {
        var r = mk('div', 'display:flex;align-items:center;gap:8px;padding:7px 9px;margin-bottom:5px;border-radius:8px;background:#3a1620;border:1px solid #4a2530');
        r.appendChild(mk('div', 'font-size:24px;flex:none', '🎫'));
        var info = mk('div', 'flex:1;min-width:0');
        info.appendChild(mk('div', 'color:#fff;line-height:1.3', p.name));
        r.appendChild(info);
        var b = mk('button', 'flex:none;font-family:inherit;font-size:14px;padding:8px 12px;border-radius:8px;border:2px solid #c9a45c;background:#c9a45c;color:#26090f;font-weight:600;cursor:pointer', '฿' + p.baht.toLocaleString());
        if (d.dailyLeft < p.n) { b.disabled = true; b.style.opacity = '.4'; b.title = 'เกินเพดานต่อวัน'; }
        else buttons.push(b);
        b.addEventListener('click', function () { if (!b.disabled) buy(p); });
        r.appendChild(b);
        list.appendChild(r);
      });
    }).catch(function (e) {
      bal.textContent = 'โหลดไม่สำเร็จ: ' + errMsg(e);
    });

    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.body.appendChild(ov);
  }

  window.CashShop = { open: open, close: close };
})();
