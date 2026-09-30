// ===== แก้บั๊ก: หน้าต่างซ้อนกันและปิดไม่ได้ =====
// โหลดเป็นไฟล์ "ท้ายสุด" (หลัง fixes.js ก่อน main.js) เพื่อห่อฟังก์ชันตัวสุดท้ายที่ถูกทับมาแล้ว
(function () {
  const P = Main.prototype;

  // ลบทุกอย่างที่อยู่ในชั้นหน้าต่าง (depth 200-203 ตาม panelFrame) แม้ไม่ได้ถูกเก็บใน this.panel
  function sweep(scene) {
    if (!scene || !scene.children) return;
    scene.children.list.slice().forEach(o => {
      if (o && o.scrollFactorX === 0 && o.depth >= 200 && o.depth <= 203) o.destroy();
    });
  }
  function hideDomWindows() {
    document.querySelectorAll('#ui-layer .win').forEach(w => { w.style.display = 'none'; });
  }

  // 1) closePanel: ของเดิม + กวาดเศษที่ค้าง
  const origClose = P.closePanel;
  P.closePanel = function () {
    try { origClose && origClose.call(this); } catch (e) { console.warn(e); }
    sweep(this);
    this.panel = null; this.subPanel = null;
  };

  // 2) หน้าต่างแบบ Phaser: ก่อนเปิดอันใหม่ ปิดทุกอย่างก่อน (รวมหน้าต่าง HTML ของกระเป๋า)
  ['openStatusPanel', 'openStageSelect', 'openSkillBook'].forEach(name => {
    const orig = P[name];
    if (!orig) return;
    P[name] = function () {
      hideDomWindows();
      sweep(this);
      this.panel = null; this.subPanel = null;
      return orig.apply(this, arguments);
    };
  });

  // 3) กระเป๋า/อุปกรณ์: ปิดแผง Phaser ที่ค้างก่อนเปิด (ไม่แตะหน้าต่าง HTML เดิม)
  const origInv = P.openInventory;
  if (origInv) {
    P.openInventory = function () {
      sweep(this);
      this.panel = null; this.subPanel = null;
      return origInv.apply(this, arguments);
    };
  }

  // 4) ปุ่ม ✕ กดง่ายขึ้นบนมือถือ (พื้นที่สัมผัส 30px -> 56px)
  const origFrame = P.panelFrame;
  P.panelFrame = function () {
    const items = origFrame.apply(this, arguments);
    const z = items.find(o => o && o.type === 'Zone');
    if (z && z.setSize) z.setSize(56, 56);
    return items;
  };
})();
