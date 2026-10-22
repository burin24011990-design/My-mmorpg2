// ===== ชื่อตัวละครของเรา: ซ่อนจากเหนือหัว แล้วย้ายไปแสดงเล็กๆ ที่กรอบ HP/เลเวลด้านบนซ้าย =====
// ไฟล์: js/systems/nameTag.js (โหลดหลัง network.js และ hudText.js ก่อน main.js)
// ซ่อนเฉพาะชื่อตัวเอง (myLabel) | ชื่อผู้เล่นคนอื่นเหนือหัวยังอยู่ตามเดิม
(function () {
  if (typeof Main === 'undefined' || !Main.prototype) {
    console.error('nameTag: ไม่พบ Main');
    return;
  }
  const P = Main.prototype;

  // ---- ปรับตรงนี้ (หน่วยพิกัดเกม ไม่ใช่พิกเซลมือถือ) ----
  const NAME_X = 42;            // ตำแหน่งแนวนอน (ซ้ายสุดของตัวหนังสือ) เพิ่ม = ขยับขวา
  const NAME_Y = 8;             // ตำแหน่งแนวตั้ง (กึ่งกลางบรรทัด) เพิ่ม = ขยับลง
  const NAME_SIZE = '10px';     // ขนาดตัวหนังสือ เล็กลง = ลดเลข
  const NAME_COLOR = '#ffe28a'; // สีชื่อ
  const NAME_STROKE = 3;        // ความหนาขอบ
  const NAME_DEPTH = 200;       // ให้อยู่เหนือกรอบ HP (ถ้าถูกกรอบบัง ให้เพิ่มเลข)

  function sync(sc) {
    const lab = sc.myLabel;
    if (lab && lab.scene) {
      if (lab.text) sc._ntName = lab.text;                 // จำชื่อไว้ก่อนซ่อน
      if (lab.visible) lab.setVisible(false);              // ซ่อนชื่อเหนือหัว
    }
    const name = sc._ntName;
    if (!name) return;

    if (!sc._ntText || !sc._ntText.scene) {
      sc._ntText = sc.add.text(NAME_X, NAME_Y, name, {
        fontFamily: 'Mitr, sans-serif', fontSize: NAME_SIZE, fontStyle: '600',
        color: NAME_COLOR, stroke: '#2a1204', strokeThickness: NAME_STROKE
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(NAME_DEPTH);
      sc._ntText.setShadow(0, 1, '#000000', 0, true, true);
      if (sc._ntText.setResolution) sc._ntText.setResolution(2);
    }
    const t = sc._ntText;
    if (t.text !== name) t.setText(name);
    if (t.x !== NAME_X || t.y !== NAME_Y) t.setPosition(NAME_X, NAME_Y);
    if (!t.visible) t.setVisible(true);
  }

  const oUN = P.updateNetwork;
  P.updateNetwork = function () {
    const r = typeof oUN === 'function' ? oUN.apply(this, arguments) : undefined;
    try { sync(this); } catch (e) { console.error('nameTag:', e); }
    return r;
  };
})();
