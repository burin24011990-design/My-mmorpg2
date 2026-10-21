// ===== ข้อความกลางจอด้านบน: เป้าหมาย (+ บัพ + ข้อความแจ้งเตือน ถ้าไม่มีกล่องแชต) =====
// ไฟล์: js/systems/hudText.js  (โหลดหลังไฟล์ระบบทั้งหมด ก่อน js/main.js)
// (ลดแลค) สแกนหาข้อความบัพทุก 12 เฟรม (เดิมทุก 4 เฟรม วนทุกวัตถุในฉาก) | resolution ข้อความ 2 -> 1
// v5: ข้อความแจ้งเตือน (toastMsg) ย้ายเข้ากล่องแชตเป็น "[ระบบ] ..." (ซ่อนได้ที่ปุ่ม "ระบบ" ในกล่องแชต) กลางจอเหลือแค่ข้อความเป้าหมาย
//     บรรทัดบัพนับถอยหลัง "(6s)" ถูกซ่อน และส่งเข้าแชตครั้งเดียวตอนบัพเริ่ม
//     ถ้ายังไม่มีกล่องแชต (ออฟไลน์/ยังไม่เชื่อมต่อ) จะแสดงกลางจอแบบเดิมให้อัตโนมัติ | ต้องใช้คู่กับ chat.js v5

(function () {
  if (typeof Main === 'undefined' || !Main.prototype) {
    console.error('hudText: ไม่พบ Main');
    return;
  }
  const P = Main.prototype;
  const FONT = 'Mitr, sans-serif';

  // ---- ปรับตรงนี้ ----
  const TOAST_TO_CHAT = true;     // true = ข้อความแจ้งเตือนไปอยู่ในกล่องแชต | false = กลับไปขึ้นกลางจอแบบเดิม
  const HIDE_BUFF_LINES = true;   // true = ซ่อนบรรทัดบัพนับถอยหลังกลางจอ | false = โชว์เหมือนเดิม
  const BUFF_TO_CHAT = true;      // true = ส่งบัพเข้าแชตครั้งเดียวตอนเริ่ม (ใช้เมื่อ HIDE_BUFF_LINES = true)
  const BUFF_LOG_DELAY = 700;     // รอกี่ ms ก่อนลงแชต (ไว้เช็กว่ามีข้อความแจ้งเตือนเรื่องเดียวกันแล้วหรือยัง จะได้ไม่ซ้ำ)
  const TOAST_DEDUP_MS = 1500;    // ถ้ามีข้อความแจ้งเตือนภายในเวลานี้ จะไม่ลงบัพซ้ำ
  const TEXT_RES = 1;             // ความคมของข้อความ (1 = เร็วสุด, 1.5 = คมขึ้น, 2 = เดิม)
  const BUFF_SCAN_EVERY = 12;     // สแกนหาบัพทุกกี่เฟรม (เลขมาก = เบาขึ้น แต่บัพใหม่โผล่ช้าลง)
  const TARGET_SIZE = '15px';     // ข้อความเป้าหมาย
  const TARGET_Y = 56;
  const BUFF_SIZE = '13px';       // ข้อความบัพที่มีอยู่ (ใช้เมื่อไม่ซ่อน)
  const BUFF_Y = 80;              // บรรทัดแรกของบัพ
  const BUFF_GAP = 2;
  const TOAST_SIZE = '16px';      // ข้อความแจ้งเตือนกลางจอ (ใช้เมื่อไม่มีกล่องแชต)
  const TOAST_Y = 112;            // เริ่มใต้บัพ
  const TOAST_GAP = 3;
  const TOAST_MAX = 3;            // แสดงพร้อมกันสูงสุด
  const TOAST_MS = 2000;          // เวลาค้างก่อนจาง (ms)
  const TOAST_WRAP = 420;         // ความกว้างสูงสุดก่อนขึ้นบรรทัดใหม่
  const BG = 'rgba(0,0,0,0.45)';

  function getW(sc) {
    if (typeof W !== 'undefined' && W) return W;
    return (sc.scale && sc.scale.width) || 800;
  }

  // มีกล่องแชตให้ส่งข้อความเข้าไหม (chat.js สร้างหลังต่อเซิร์ฟเวอร์สำเร็จ)
  function chatReady(sc) {
    return !!(sc && sc._chat && sc.chatSt && typeof sc.chatSys === 'function');
  }

  // ---------- ข้อความเป้าหมาย ----------
  function styleTarget(sc) {
    const t = sc.targetNameText;
    if (!t || typeof t.setFontSize !== 'function') return;
    if (!t._htStyled || t.style.fontSize !== TARGET_SIZE) {
      t._htStyled = true;
      t.setFontFamily(FONT).setFontSize(TARGET_SIZE).setFontStyle('bold')
        .setColor('#ffffff').setStroke('#000000', 3)
        .setShadow(0, 1, '#000000', 0, true, true)
        .setPadding(8, 2, 8, 2).setBackgroundColor(BG)
        .setOrigin(0.5, 0).setAlpha(1).setDepth(150);
      if (t.setResolution) t.setResolution(TEXT_RES);
      if (t.setScrollFactor) t.setScrollFactor(0);
    }
    const cx = getW(sc) / 2;
    if (t.x !== cx || t.y !== TARGET_Y) t.setPosition(cx, TARGET_Y);
    const vis = !!t.text;
    if (t.visible !== vis) t.setVisible(vis);
  }

  // ---------- ข้อความบัพ (หาจากรูปแบบ "(9s)") ----------
  const BUFF_RE = /\(\d+(\.\d+)?\s*s\)/i;
  const SEG_RE = /([^()]*?)\s*\((\d+(?:\.\d+)?)\s*s\)/gi;   // แยกเป็นท่อน "ชื่อบัพ (Ns)"

  // ติดตามว่าบัพท่อนไหนเพิ่งเริ่ม (ชื่อท่อนใหม่ที่ยังไม่เคยอยู่ในรอบสแกนก่อนหน้า) แล้วคิวไว้ลงแชต
  let activeSegs = {};
  let pending = [];

  function trackBuffs(buffs) {
    const now = Date.now(), cur = {}, fresh = [];
    buffs.forEach(function (o) {
      const t = String(o.text);
      let m;
      SEG_RE.lastIndex = 0;
      while ((m = SEG_RE.exec(t))) {
        const label = m[1].trim();
        if (!label) continue;
        cur[label] = true;
        if (!activeSegs[label]) fresh.push(label + ' นาน ' + Math.round(Number(m[2])) + ' วิ');
      }
    });
    activeSegs = cur;
    if (fresh.length) pending.push({ at: now, text: fresh.join(' • ') });
  }

  function flushPending(sc) {
    if (!pending.length) return;
    const now = Date.now();
    pending = pending.filter(function (p) {
      if (now - p.at < BUFF_LOG_DELAY) return true;              // ยังไม่ครบเวลารอ
      const t = sc._htLastToast || 0;
      const dup = t && Math.abs(t - p.at) < TOAST_DEDUP_MS;      // มีข้อความแจ้งเตือนเรื่องบัพนี้แล้ว = ไม่ลงซ้ำ
      if (!dup && chatReady(sc)) sc.chatSys('บัพ: ' + p.text, true);
      return false;
    });
  }

  function styleBuffs(sc) {
    const list = sc.children && sc.children.list;
    if (!list) return;
    const buffs = [];
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o && o.type === 'Text' && o.scene && o.text && BUFF_RE.test(o.text) &&
          o !== sc.targetNameText && !(sc._htToasts && sc._htToasts.indexOf(o) >= 0)) {
        buffs.push(o);
      }
    }

    // ซ่อนบรรทัดบัพนับถอยหลัง (ต้องมีกล่องแชตรองรับ ไม่งั้นบัพจะหายไปเฉยๆ)
    if (HIDE_BUFF_LINES && chatReady(sc)) {
      buffs.forEach(function (o) {
        if (o.visible || o.alpha !== 0) o.setVisible(false).setAlpha(0);
      });
      if (BUFF_TO_CHAT) trackBuffs(buffs);
      flushPending(sc);
      return;
    }

    let y = BUFF_Y;
    const w = getW(sc);
    buffs.forEach(function (o) {
      if (!o._htBuff) {
        o._htBuff = true;
        o.setFontFamily(FONT).setFontSize(BUFF_SIZE).setFontStyle('bold')
          .setColor('#ffe9a0').setStroke('#000000', 3)
          .setPadding(6, 1, 6, 1).setBackgroundColor(BG)
          .setOrigin(0.5, 0).setAlpha(1).setDepth(149);
        if (o.setResolution) o.setResolution(TEXT_RES);
        if (o.setScrollFactor) o.setScrollFactor(0);
      }
      o.setPosition(w / 2, y);
      y += o.height + BUFF_GAP;
    });
  }

  // ---------- ข้อความแจ้งเตือน ----------
  function killToast(o) {
    if (!o) return;
    if (o._htTw) { o._htTw.remove(); o._htTw = null; }
    if (o.scene) o.destroy();
  }

  function layout(list) {
    let y = TOAST_Y;
    list.forEach(function (o) {
      if (!o.scene) return;
      o.setY(y);
      y += o.height + TOAST_GAP;
    });
  }

  function htToast(msg, ms) {
    const sc = this;
    if (!sc || !sc.add || msg === undefined || msg === null) return;
    const text = String(msg);

    // มีกล่องแชต = ส่งเข้าแชตเป็น "[ระบบ] ..." แทนการขึ้นกลางจอ
    if (TOAST_TO_CHAT && chatReady(sc)) {
      sc._htLastToast = Date.now();
      sc.chatSys(text, true);
      return;
    }

    // ไม่มีกล่องแชต (ออฟไลน์ ฯลฯ) = ขึ้นกลางจอแบบเดิม
    const list = sc._htToasts || (sc._htToasts = []);

    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].scene) list.splice(i, 1);
      else if (list[i].text === text) { killToast(list[i]); list.splice(i, 1); }
    }

    const w = getW(sc);
    const txt = sc.add.text(w / 2, TOAST_Y, text, {
      fontFamily: FONT, fontSize: TOAST_SIZE, fontStyle: 'bold',
      color: '#fff3b0', stroke: '#000000', strokeThickness: 3, align: 'center',
      wordWrap: { width: Math.min(w - 80, TOAST_WRAP) },
      padding: { x: 8, y: 2 }, backgroundColor: BG,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(300);
    txt.setShadow(0, 1, '#000000', 0, true, true);
    if (txt.setResolution) txt.setResolution(TEXT_RES);

    list.push(txt);
    while (list.length > TOAST_MAX) killToast(list.shift());
    layout(list);

    txt._htTw = sc.tweens.add({
      targets: txt, alpha: 0,
      delay: typeof ms === 'number' && ms > 0 ? ms : TOAST_MS, duration: 400,
      onComplete: function () {
        txt._htTw = null;
        const i = list.indexOf(txt);
        if (i >= 0) list.splice(i, 1);
        if (txt.scene) txt.destroy();
        layout(list);
      },
    });
  }

  P.toastMsg = htToast;

  let frame = 0;
  const oUT = P.updateTargeting;
  P.updateTargeting = function () {
    const r = typeof oUT === 'function' ? oUT.apply(this, arguments) : undefined;
    try {
      styleTarget(this);
      if ((frame++ % BUFF_SCAN_EVERY) === 0) styleBuffs(this);
    } catch (e) { console.error('hudText:', e); }
    if (Object.prototype.hasOwnProperty.call(this, 'toastMsg') && this.toastMsg !== htToast) {
      this.toastMsg = htToast;
    }
    return r;
  };
})();
