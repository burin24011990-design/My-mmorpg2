// ===== ข้อความกลางจอด้านบน: ชื่อ/เลือดมอนเป้าหมาย + ข้อความแจ้งเตือน (ไอเทมที่ได้รับ ฯลฯ) =====
// ไฟล์: js/systems/hudText.js  (โหลด "หลัง" ไฟล์ระบบทั้งหมด ก่อน js/main.js)
// - ตัวหนังสือใหญ่ขึ้น หนาขึ้น ขอบดำหนา + พื้นหลังดำโปร่งแสง อ่านชัดบนพื้นหญ้า
// - ข้อความแจ้งเตือน (toastMsg) ซ้อนเป็นแถวได้สูงสุด TOAST_MAX บรรทัด ค่อยๆ จางหายเอง
// ปรับขนาด/ตำแหน่งได้ที่ค่าคงที่ด้านล่าง

(function () {
  const P = Main.prototype;
  const FONT = 'Mitr, sans-serif';

  // ---- ปรับตรงนี้ ----
  const TARGET_SIZE = '22px';     // ขนาดข้อความ "เป้าหมาย: ชื่อมอน Lv. HP"
  const TARGET_Y = 78;            // ตำแหน่งแนวตั้ง (ใต้ข้อความสถานะบอท)
  const TOAST_SIZE = '24px';      // ขนาดข้อความแจ้งเตือน (ได้รับไอเทม ฯลฯ)
  const TOAST_Y = 124;            // ตำแหน่งแนวตั้งของบรรทัดแรก
  const TOAST_GAP = 6;            // ระยะห่างระหว่างบรรทัด
  const TOAST_MAX = 4;            // แสดงพร้อมกันได้สูงสุดกี่บรรทัด
  const TOAST_MS = 2600;          // เวลาที่ค้างบนจอ (มิลลิวินาที) ก่อนเริ่มจาง
  const BG = 'rgba(0,0,0,0.5)';   // พื้นหลังหลังตัวหนังสือ

  // ---------- ข้อความเป้าหมาย ----------
  function styleTarget(sc) {
    const t = sc.targetNameText;
    if (!t || typeof t.setFontSize !== 'function') return;
    if (!t._htStyled) {
      t._htStyled = true;
      t.setFontFamily(FONT).setFontSize(TARGET_SIZE).setFontStyle('bold')
        .setColor('#ffffff').setStroke('#000000', 6)
        .setShadow(0, 2, '#000000', 4, true, true)
        .setPadding(12, 4, 12, 4).setBackgroundColor(BG)
        .setOrigin(0.5, 0).setAlpha(1).setDepth(150);
      if (t.setResolution) t.setResolution(2);
      if (t.setScrollFactor) t.setScrollFactor(0);
    }
    t.setPosition(W / 2, TARGET_Y);
    t.setVisible(!!t.text);            // ไม่มีเป้าหมาย = ซ่อน (กันกรอบดำว่างๆ โผล่)
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
      o.setY(y);
      y += o.height + TOAST_GAP;
    });
  }

  function htToast(msg, ms) {
    const sc = this;
    if (!sc || !sc.add || msg === undefined || msg === null) return;
    const text = String(msg);
    const list = sc._htToasts || (sc._htToasts = []);

    // เก็บกวาดอันที่หายไปแล้ว + ข้อความซ้ำที่ยังโชว์อยู่ให้ย้ายลงมาล่างสุดแทนการซ้อน
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].scene) list.splice(i, 1);
      else if (list[i].text === text) { killToast(list[i]); list.splice(i, 1); }
    }

    const txt = sc.add.text(W / 2, TOAST_Y, text, {
      fontFamily: FONT, fontSize: TOAST_SIZE, fontStyle: 'bold',
      color: '#fff3b0', stroke: '#000000', strokeThickness: 6, align: 'center',
      wordWrap: { width: Math.min(W - 80, 640) },
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

  // ทุกเฟรม: จัดสไตล์ข้อความเป้าหมาย (และกันกรณีเกมสร้าง toastMsg ทับเป็นของตัวเองในฉาก)
  const oUT = P.updateTargeting;
  P.updateTargeting = function () {
    const r = typeof oUT === 'function' ? oUT.apply(this, arguments) : undefined;
    styleTarget(this);
    if (Object.prototype.hasOwnProperty.call(this, 'toastMsg') && this.toastMsg !== htToast) this.toastMsg = htToast;
    return r;
  };
})();
