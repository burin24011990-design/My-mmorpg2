// ===== ร้านค้าแคช (เงินจริง): ซื้อตั๋วลงขายตลาดกลางด้วยพร้อมเพย์ QR + ส่งสลิป =====
// โหลดหลัง firebase-functions-compat.js (วางก่อน main.js ได้เลย)
// เรียกใช้: CashShop.open(onPaid)  | onPaid = ฟังก์ชันที่จะเรียกเมื่อตั๋วเข้าบัญชีแล้ว (ไม่จำเป็นต้องใส่)
// ขั้นตอน: เลือกสินค้า -> เซิร์ฟเวอร์สร้างออเดอร์ (ยอดมีเศษสตางค์) -> แสดง QR -> ผู้เล่นโอน -> ส่งรูปสลิป
// ตั๋วจะถูกเพิ่มโดยเซิร์ฟเวอร์เมื่อ SlipOK ตรวจสลิปผ่านเท่านั้น (ฝั่งเกมตัดสินเองไม่ได้)
(function () {
  var REGION = 'asia-southeast1';   // ต้องตรงกับ functions/cashshop_slip.js
  var QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  var fns = null, ov = null, tick = null;

  function call(name, data) {
    if (!fns) fns = firebase.app().functions(REGION);
    return fns.httpsCallable(name)(data || {}).then(function (r) { return r.data; });
  }
  function errMsg(e) { return (e && e.message) ? e.message : 'เกิดข้อผิดพลาด'; }
  function toast(t) { var s = window.__mainScene; if (s && s.toastMsg) s.toastMsg(t); }
  function mk(tag, css, txt) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
  function close() {
    stopTick();
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    ov = null;
  }

  var BTN = 'font-family:inherit;font-size:14px;padding:9px 14px;border-radius:8px;border:2px solid #c9a45c;background:#c9a45c;color:#26090f;font-weight:600;cursor:pointer;width:100%;margin-top:6px';
  var BTN_GHOST = 'font-family:inherit;font-size:13px;padding:8px 12px;border-radius:8px;border:2px solid #6b5330;background:transparent;color:#eee4d2;cursor:pointer;width:100%;margin-top:6px';
  function setOn(b, on) { b.disabled = !on; b.style.opacity = on ? '1' : '.5'; }

  // ----- QR: โหลดไลบรารีตัวเล็กจาก cdnjs แล้ววาดลง canvas เอง -----
  function loadQR(cb) {
    if (window.qrcode) { cb(true); return; }
    var s = document.createElement('script');
    s.src = QR_LIB;
    s.onload = function () { cb(!!window.qrcode); };
    s.onerror = function () { cb(false); };
    document.head.appendChild(s);
  }
  function drawQR(canvas, text) {
    var q = window.qrcode(0, 'M');
    q.addData(text); q.make();
    var n = q.getModuleCount(), m = 4;
    var s = Math.max(3, Math.floor(300 / (n + m * 2)));
    var size = (n + m * 2) * s;
    canvas.width = size; canvas.height = size;
    canvas.style.width = '240px'; canvas.style.height = '240px';
    canvas.style.imageRendering = 'pixelated';
    var g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#000';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + m) * s, (r + m) * s, s, s);
  }

  // ----- ย่อรูปสลิปเป็น JPEG ก่อนส่ง (แก้ใหม่: รองรับไฟล์จากแกลเลอรี่/คลาวด์ได้ดีขึ้น) -----
  function toJpegB64(file, ok, fail) {
    // รูป JPEG/PNG ไม่ใหญ่เกิน 4MB ส่งไฟล์ต้นฉบับตรงๆ ไม่ผ่านการแปลง (QR บนสลิปคมชัดที่สุด)
    if (file.size <= 4 * 1024 * 1024 && /^image\/(jpeg|png)$/.test(file.type)) {
      var fr0 = new FileReader();
      fr0.onload = function () { ok(String(fr0.result).split(',')[1]); };
      fr0.onerror = function () { fail(new Error('อ่านไฟล์รูปไม่ได้ ลองแคปหน้าจอสลิปแล้วส่งรูปแคปแทน')); };
      fr0.readAsDataURL(file);
      return;
    }
    function draw(src, w, h) {
      try {
        var s = Math.min(1, 2600 / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
        var g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(src, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.92).split(',')[1]);
      } catch (e) {
        fail(new Error('แปลงรูปไม่สำเร็จ ลองแคปหน้าจอสลิปแล้วส่งรูปแคปแทน'));
      }
    }
    function viaReader() {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () { draw(img, img.naturalWidth || img.width, img.naturalHeight || img.height); };
        img.onerror = function () { fail(new Error('อ่านไฟล์รูปไม่ได้ ลองแคปหน้าจอสลิปแล้วส่งรูปแคปแทน')); };
        img.src = fr.result;
      };
      fr.onerror = function () { fail(new Error('อ่านไฟล์รูปไม่ได้ ลองแคปหน้าจอสลิปแล้วส่งรูปแคปแทน')); };
      fr.readAsDataURL(file);
    }
    if (window.createImageBitmap) {
      createImageBitmap(file).then(function (b) { draw(b, b.width, b.height); }).catch(viaReader);
    } else viaReader();
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

    var main = mk('div');
    var note = mk('div', 'margin-top:10px;font-size:11px;color:#8a7d82;line-height:1.5',
      'ชำระด้วยพร้อมเพย์: สแกน QR โอนตามยอดเป๊ะ แล้วส่งรูปสลิป ตั๋วเข้าบัญชีอัตโนมัติเมื่อสลิปผ่านการตรวจ ' +
      'หากมีปัญหาแจ้งผู้ดูแลพร้อมรหัสผู้เล่น: ' + firebase.auth().currentUser.uid);
    note.style.wordBreak = 'break-all';
    pn.append(main, note);

    // ---------- หน้ารายการสินค้า ----------
    function showList() {
      stopTick(); main.textContent = '';
      var bal = mk('div', 'color:#f2d48a;margin-bottom:2px', 'กำลังโหลด...');
      var left = mk('div', 'color:#a3949a;font-size:12px;margin-bottom:8px');
      var list = mk('div');
      var status = mk('div', 'margin-top:8px;min-height:18px;font-size:12px;color:#ff9a9a;line-height:1.6');
      main.append(bal, left, list, status);
      var buttons = [];

      function buy(p) {
        buttons.forEach(function (b) { setOn(b, false); });
        status.style.color = '#bbb';
        status.textContent = 'กำลังสร้างออเดอร์...';
        call('createPromptPayOrder', { productId: p.id }).then(function (r) {
          showOrder(r.order);
        }).catch(function (e) {
          buttons.forEach(function (b) { setOn(b, true); });
          status.style.color = '#ff9a9a';
          status.textContent = errMsg(e);
        });
      }

      Promise.all([call('getCashProducts'), call('getWallet')]).then(function (res) {
        var d = res[0], t = (res[1] && res[1].tickets) || {};
        bal.textContent = '🎫 ตั๋วที่มี: ระดับ 1 ×' + (t[1] || 0) + ' | ระดับ 2 ×' + (t[2] || 0) + ' | ระดับ 3 ×' + (t[3] || 0);
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
    }

    // ---------- หน้าออเดอร์: QR + ส่งสลิป ----------
    function showOrder(o) {
      stopTick(); main.textContent = '';
      main.appendChild(mk('div', 'color:#fff;margin-bottom:6px;line-height:1.4', o.name));
      main.appendChild(mk('div', 'font-size:28px;font-weight:700;color:#f2d48a;text-align:center;margin:4px 0', '฿' + Number(o.amount).toFixed(2)));
      main.appendChild(mk('div', 'text-align:center;color:#e0a05a;font-size:12px;margin-bottom:8px', 'โอนให้ตรงยอดนี้เป๊ะ (รวมเศษสตางค์) ไม่เช่นนั้นระบบไม่รับสลิป'));

      var qrWrap = mk('div', 'text-align:center;margin-bottom:6px');
      main.appendChild(qrWrap);
      if (o.qrPayload) {
        var cv = mk('canvas', 'background:#fff;border-radius:6px;max-width:100%');
        qrWrap.appendChild(cv);
        loadQR(function (ok) {
          if (!ok) { qrWrap.textContent = 'โหลดตัวสร้าง QR ไม่สำเร็จ ลองเปิดร้านใหม่'; return; }
          try { drawQR(cv, o.qrPayload); } catch (e) { qrWrap.textContent = 'สร้าง QR ไม่สำเร็จ'; }
        });
        var save = mk('button', BTN_GHOST, '💾 บันทึกรูป QR (ใช้สแกนจากรูปในแอปธนาคาร)');
        save.addEventListener('click', function () {
          try {
            cv.toBlob(function (blob) {
              if (!blob) return;
              var a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'promptpay-' + Number(o.amount).toFixed(2) + '.png';
              document.body.appendChild(a); a.click();
              setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
            });
          } catch (e) { toast('บันทึกรูปไม่ได้ ลองแคปหน้าจอแทน'); }
        });
        main.appendChild(save);
      } else {
        qrWrap.appendChild(mk('div', 'color:#e0a05a;padding:10px', 'ออเดอร์หมดเวลาแล้ว ถ้าโอนไปแล้วส่งสลิปได้ด้านล่าง ถ้ายังไม่ได้โอนให้ยกเลิกแล้วสร้างใหม่'));
      }

      var cd = mk('div', 'text-align:center;font-size:12px;color:#bbb;margin:6px 0');
      main.appendChild(cd);
      function upd() {
        var s = Math.max(0, Math.round((o.expiresAt - Date.now()) / 1000));
        cd.textContent = s > 0 ? ('เหลือเวลาโอน ' + Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2) + ' นาที') : 'หมดเวลาโอนแล้ว';
      }
      upd(); tick = setInterval(upd, 1000);

      var file = null;
      var inp = mk('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none';
      var pick = mk('button', BTN_GHOST, '📷 เลือกรูปสลิป (ภาพเต็มใบ ไม่ครอป)');
      var fname = mk('div', 'font-size:12px;color:#a3949a;margin:4px 0;word-break:break-all');
      var send = mk('button', BTN, 'ส่งสลิป'); setOn(send, false);
      var status = mk('div', 'margin-top:8px;min-height:18px;font-size:12px;color:#bbb;line-height:1.6');
      var cancel = mk('button', BTN_GHOST, 'ยกเลิกออเดอร์ (ถ้าโอนไปแล้ว อย่ายกเลิก ให้ส่งสลิปแทน)');
      main.append(inp, pick, fname, send, status, cancel);

      function busy(b) { setOn(pick, !b); setOn(send, !b && !!file); setOn(cancel, !b); }

      pick.addEventListener('click', function () { inp.click(); });
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0] ? inp.files[0] : null;
        file = null;
        setOn(send, false);
        status.style.color = '#bbb';
        status.textContent = '';
        if (!f) { fname.textContent = ''; return; }
        fname.textContent = f.name + ' (กำลังอ่านไฟล์...)';
        // คัดลอกข้อมูลไฟล์เข้าหน่วยความจำทันที (กันไฟล์จากแกลเลอรี่/คลาวด์ที่ยังไม่โหลดจนอ่านไม่ได้ทีหลัง)
        var done = function (blob) {
          if (inp.files[0] !== f) return;
          file = blob;
          fname.textContent = f.name;
          setOn(send, true);
        };
        if (f.arrayBuffer) {
          f.arrayBuffer().then(function (buf) {
            done(new Blob([buf], { type: f.type || 'image/jpeg' }));
          }).catch(function () {
            fname.textContent = f.name;
            status.style.color = '#ff9a9a';
            status.textContent = 'อ่านไฟล์ไม่ได้ ลองเปิดรูปในแกลเลอรี่ให้โหลดเต็มก่อน หรือแคปหน้าจอสลิปแล้วเลือกรูปแคปแทน';
          });
        } else done(f);
      });
      send.addEventListener('click', function () {
        if (!file || send.disabled) return;
        if (file.size > 20 * 1024 * 1024) { status.style.color = '#ff9a9a'; status.textContent = 'รูปใหญ่เกินไป'; return; }
        busy(true);
        status.style.color = '#bbb';
        status.textContent = 'กำลังตรวจสลิป...';
        toJpegB64(file, function (b64) {
          call('submitSlip', { orderId: o.orderId, image: b64 }).then(function () {
            stopTick();
            status.style.color = '#7be07b';
            status.textContent = '✓ ได้รับตั๋วแล้ว';
            toast('ได้รับตั๋วแล้ว');
            if (typeof onPaid === 'function') { try { onPaid(); } catch (e) {} }
            setTimeout(function () { if (ov) showList(); }, 1500);
          }).catch(function (e) {
            busy(false);
            status.style.color = '#ff9a9a';
            status.textContent = errMsg(e);
          });
        }, function (e) {
          busy(false);
          status.style.color = '#ff9a9a';
          status.textContent = errMsg(e);
        });
      });
      cancel.addEventListener('click', function () {
        if (cancel.disabled) return;
        if (!window.confirm('ยกเลิกออเดอร์นี้? ถ้าโอนเงินไปแล้ว อย่ายกเลิก ให้ส่งสลิปแทน')) return;
        busy(true);
        status.style.color = '#bbb';
        status.textContent = 'กำลังยกเลิก...';
        call('cancelPayOrder', { orderId: o.orderId }).then(function () {
          if (ov) showList();
        }).catch(function (e) {
          busy(false);
          status.style.color = '#ff9a9a';
          status.textContent = errMsg(e);
        });
      });
    }

    // เปิดร้านแล้วเช็กก่อนว่ามีออเดอร์ค้างอยู่ไหม (ถ้ามีไปหน้าส่งสลิปต่อเลย)
    main.appendChild(mk('div', 'color:#f2d48a', 'กำลังโหลด...'));
    call('getMyPayOrder').then(function (r) {
      if (!ov) return;
      if (r && r.order) showOrder(r.order); else showList();
    }).catch(function () { if (ov) showList(); });

    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.body.appendChild(ov);
  }

  window.CashShop = { open: open, close: close };
})();
