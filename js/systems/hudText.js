// ===== ข้อความกลางจอด้านบน: ชื่อ/เลือดมอนเป้าหมาย + ข้อความแจ้งเตือน =====
// ไฟล์: js/systems/hudText.js  (โหลดหลังไฟล์ระบบทั้งหมด ก่อน js/main.js)

(function () {
  if (typeof Main === 'undefined' || !Main.prototype) {
    console.error('hudText: ไม่พบ Main');
    return;
  }
  const P = Main.prototype;
  const FONT = 'Mitr, sans-serif';

  // ---- ปรับตรงนี้ ----
  const TARGET_SIZE = '22px';     // ขนาดข้อความเป้าหมาย
  const TARGET_Y = 78;            // ตำแหน่งแนวตั้ง
  const TOAST_SIZE = '24px';      // ขนาดข้อความแจ้งเตือน
  const TOAST_Y = 124;            // ตำแหน่งบรรทัดแรก
  const TOAST_GAP = 6;            // ระยะห่างระหว่างบรรทัด
  const TOAST_MAX = 4;            // แสดงพร้อมกันสูงสุด
  const TOAST_MS = 2600;          // เวลาค้างก่อนจาง (ms)
  const BG = 'rgba(0,0,0,0.5)';   // พื้นหลังตัวหนังสือ

  // ความกว้างจอ: ใช้ W ถ้ามี ไม่งั้นอ่านจากฉากโดยตรง
  function getW(sc) {
    if (typeof W !== 'undefined' && W) return W;
    return (sc.scale && sc.scale.width) || 800;
  }

  // ---------- ข้อความเป้าหมาย ----------
  function styleTarget(sc) {
    const t = sc.targetNameText;
    if (!t || typeof t.setFontSize !== 'function') return;

    // ตั้งสไตล์ครั้งแรก หรือตั้งใหม่ถ้าไฟล์อื่นเปลี่ยนขนาดฟอนต์ทับ
    if (!t._htStyled || t.style.fontSize !== TARGET_SIZE) {
      t._htStyled = true;
      t.setFontFamily(FONT).setFontSize(TARGET_SIZE).setFontStyle('bold')
        .setColor('#ffffff').setStroke('#000000', 6)
        .setShadow(0, 2, '#000000', 4, true, true)
        .setPadding(12, 4, 12, 4).setBackgroundColor(BG)
        .setOrigin(0.5, 0).setAlpha(1).setDepth(150);
      if (t.setResolution) t.setResolution(2);
      if (t.setScrollFactor) t.setScrollFactor(0);
    }
    t.setPosition(getW(sc) / 2, TARGET_Y);
    t.setVisible(!!t.text);   // ไม่มีเป้าหมาย = ซ่อนกรอบดำ
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
    const list = sc._htToasts || (sc._htToasts = []);

    // เก็บกวาดอันที่หายแล้ว + ลบข้อความซ้ำเพื่อย้ายลงล่างสุด
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].scene) list.splice(i, 1);
      else if (list[i].text === text) { killToast(list[i]); list.splice(i, 1); }
    }

    const w = getW(sc);
    const txt = sc.add.text(w / 2, TOAST_Y, text, {
      fontFamily: FONT, fontSize: TOAST_SIZE, fontStyle: 'bold',
      color: '#fff3b0', stroke: '#000000', strokeThickness: 6, align: 'center',
      wordWrap: { width: Math.min(w - 80, 640) },
      padding: { x: 12, y: 4 }, backgroundColor: BG,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(300);
    txt.setShadow(0, 2, '#000000', 4, true, true);
    if (txt.setResolution) txt.setResolution(2);

    list.push(txt);
    while (list.length > TOAST_MAX) killToast(list.shift());
    layout(list);

    txt._htTw = sc.tweens.add({
      targets: txt, alpha: 0,
      delay: typeof ms === 'number' && ms > 0 ? ms : TOAST_MS, duration: 500,
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

  // ทุกเฟรม: จัดสไตล์ข้อความเป้าหมาย และกัน toastMsg ถูกทับ
  const oUT = P.updateTargeting;
  P.updateTargeting = function () {
    const r = typeof oUT === 'function' ? oUT.apply(this, arguments) : undefined;
    try { styleTarget(this); } catch (e) { console.error('hudText:', e); }
    if (Object.prototype.hasOwnProperty.call(this, 'toastMsg') && this.toastMsg !== htToast) {
      this.toastMsg = htToast;
    }
    return r;
  };
})();
