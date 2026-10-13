// wuxiaIcons.js -- เปลี่ยนไอคอนปุ่มทั้งหมดเป็นรูปแนวกำลังภายใน
// หลักการ: หาปุ่มจาก "ข้อความป้ายชื่อ" ภาษาไทย แล้วใส่รูปเป็นพื้นหลังปุ่ม (ไม่ต้องแก้ไฟล์ UI เดิม)
// รูปอยู่ที่ img/ui/<ชื่อ>.png
(function () {
  'use strict';

  var IMG_DIR = 'img/ui/';
  var VER = '1';

  // ป้ายชื่อ -> ไฟล์รูป (ตรงตัวเท่านั้น ยกเว้นบอทที่ขึ้นต้นด้วย "บอท")
  var MAP = {
    'กระเป๋า': 'bag',
    'สกิล': 'skill',
    'ตั้งค่าบอท': 'settings',
    'ตั้งค่า': 'settings',
    'อุปกรณ์': 'equip',
    'สเตตัส': 'status',
    'ร้านค้า': 'shop',
    'ร้านแคช': 'cashshop',
    'ออฟไลน์': 'offline',
    'สังคม': 'social',
    'เสียง': 'sound',
    'จุติ': 'rebirth',
    'เลือกด่าน': 'stage',
    'โจมตี': 'attack',
    'แดช': 'dash'
  };

  // ปุ่มที่ไม่มีป้ายชื่อ: ใส่ selector เองได้ เช่น window.WX_ICON_EXTRA = { '#btn-box': 'box' }
  var EXTRA = window.WX_ICON_EXTRA || {};

  var MIN = 24, MAX = 130;   // ขนาดปุ่ม (px) ที่ยอมรับ กันไปจับหัวข้อหน้าต่างอื่นที่ใช้คำเดียวกัน

  function clean(t) {
    return String(t || '').replace(/[\u200b\s]+/g, '').replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '');
  }

  function keyFor(text) {
    var t = clean(text);
    if (!t) return null;
    if (t.indexOf('บอท') === 0 && t.indexOf('ตั้งค่า') !== 0) return 'bot';
    return MAP[t] || null;
  }

  function sizeOk(el) {
    var w = el.offsetWidth, h = el.offsetHeight;
    return w >= MIN && h >= MIN && w <= MAX && h <= MAX;
  }

  // หาตัวปุ่มจากป้ายชื่อ: ไต่ขึ้นไปหาตัวที่ขนาดเหมาะสมและไม่ใช่แถบยาว
  function findButton(label) {
    var el = label.parentElement, hops = 0;
    while (el && el !== document.body && hops < 4) {
      if (el.id === 'ui-layer') return null;
      if (sizeOk(el)) {
        var r = el.offsetWidth / el.offsetHeight;
        if (r > 0.5 && r < 2) return el;
      }
      el = el.parentElement; hops++;
    }
    return null;
  }

  function markHidden(btn, label) {
    var kids = btn.querySelectorAll('*');
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k === label || k.contains(label) || label.contains(k)) continue;
      k.classList.add('wx-hide');
    }
  }

  function apply(btn, label, key) {
    btn.classList.add('wx-btn');
    btn.setAttribute('data-wx', key);
    btn.style.setProperty('--wx-img', 'url("' + IMG_DIR + key + '.png?v=' + VER + '")');
    if (label) {
      label.classList.add('wx-label');
      markHidden(btn, label);
    } else {
      // ปุ่มไม่มีป้าย: ซ่อนลูกทั้งหมด
      var kids = btn.querySelectorAll('*');
      for (var i = 0; i < kids.length; i++) kids[i].classList.add('wx-hide');
      btn.childNodes.forEach(function (n) {
        if (n.nodeType === 3 && n.textContent.trim()) { var s = document.createElement('span'); s.className = 'wx-hide'; n.parentNode.replaceChild(s, n); s.appendChild(n); }
      });
    }
  }

  function scan() {
    // 1) ปุ่มที่ระบุ selector เอง
    Object.keys(EXTRA).forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el && !el.classList.contains('wx-btn')) apply(el, null, EXTRA[sel]);
    });

    // 2) จับจากป้ายชื่อ
    var all = document.body.querySelectorAll('div,span,button,a,p,label,b');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.children.length) continue;                    // เอาเฉพาะตัวที่มีแต่ข้อความ
      if (el.closest('#login-screen, #err-box, #start-overlay, #cloud-toast')) continue;
      var txt = el.textContent;
      if (!txt || txt.length > 14) continue;
      var key = keyFor(txt);
      if (!key) continue;
      if (el.classList.contains('wx-label')) continue;     // ทำไปแล้ว
      var btn = findButton(el);
      if (btn && !btn.classList.contains('wx-btn')) apply(btn, el, key);
      else if (btn && btn.getAttribute('data-wx') === key) { el.classList.add('wx-label'); markHidden(btn, el); }
    }
  }

  var timer = null;
  function later() { if (timer) return; timer = setTimeout(function () { timer = null; try { scan(); } catch (e) { console.warn('[wuxiaIcons]', e); } }, 250); }

  function start() {
    scan();
    try { new MutationObserver(later).observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (e) {}
    setInterval(later, 2000);   // กันเหนียว เผื่อเกมสร้างปุ่มใหม่ทีหลัง
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // พรีโหลดรูป
  Object.keys(MAP).forEach(function (k) { var i = new Image(); i.src = IMG_DIR + MAP[k] + '.png?v=' + VER; });

  window.WuxiaIcons = { rescan: scan };
})();
