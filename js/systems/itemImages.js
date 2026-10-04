// ===== โหลดรูปไอเทมจาก assets/items/ =====
// ไฟล์นี้ต่อท้าย Main.preload / Main.create เดิม โดยไม่ต้องแก้ Main.js
// ต้องโหลดหลัง js/scenes/Main.js และ js/data/items.js
(function () {
  const IMG_VER = 2;   // เปลี่ยนรูปแล้วมือถือยังเห็นรูปเก่า -> เพิ่มเลขนี้
  const IMG_KEYS = [
    'weapon_sword', 'weapon_mage', 'weapon_archer', 'weapon_priest', 'weapon_rogue',
    'helmet', 'armor', 'gloves', 'shoes', 'ring', 'necklace',
    'helmet_light', 'armor_light', 'gloves_light', 'shoes_light',
    'box', 'stone', 'cleanstone',
    'opt_red', 'opt_green', 'opt_purple', 'opt_yellow',
    'skillbook'
  ];

  // ไอคอนเดิมที่เกมวาดเอง (ใช้กับของที่ดรอปบนพื้น ฯลฯ) -> วาดทับด้วยรูปใหม่
  // รูปแบบ: 'ชื่อ texture เดิม': 'ชื่อไฟล์รูปใหม่ (ไม่มี img_)'
  const OVERRIDE = {
    box: 'box',
    icon_stone: 'stone',
    icon_cleanstone: 'cleanstone',
    icon_opt_red: 'opt_red',
    icon_opt_green: 'opt_green',
    icon_opt_purple: 'opt_purple',
    icon_opt_yellow: 'opt_yellow'
  };
  const painted = {};

  // วาดรูปใหม่ลงบน texture เดิม (ขนาดเท่าเดิม สไปรต์ที่ดรอปจึงไม่เพี้ยนขนาด)
  function paint(scene, oldKey, newKey) {
    try {
      const tm = scene.textures;
      if (!tm.exists(oldKey) || !tm.exists(newKey)) return false;
      const tex = tm.get(oldKey);
      const dst = tex.getSourceImage();
      if (!(dst instanceof HTMLCanvasElement)) return false;
      const src = tm.get(newKey).getSourceImage();
      const w = dst.width, h = dst.height;
      const ctx = dst.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      const r = Math.min(w / src.width, h / src.height);
      const dw = src.width * r, dh = src.height * r;
      ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
      if (tex.refresh) tex.refresh();
      else if (tex.source && tex.source[0] && tex.source[0].update) tex.source[0].update();
      return true;
    } catch (e) { return false; }
  }

  function applyOverrides(scene) {
    Object.keys(OVERRIDE).forEach(oldKey => {
      if (painted[oldKey]) return;
      if (paint(scene, oldKey, 'img_' + OVERRIDE[oldKey])) painted[oldKey] = true;
    });
  }

  const oldPreload = Main.prototype.preload;
  Main.prototype.preload = function () {
    if (oldPreload) oldPreload.apply(this, arguments);

    // จดไว้ว่ารูปไหนโหลดสำเร็จ (iconKeyForItem จะใช้ตรวจ)
    this.load.on('filecomplete', function (key) {
      if (key.indexOf('img_') === 0) ITEM_IMG_OK[key] = true;
    });

    IMG_KEYS.forEach(k => {
      this.load.image('img_' + k, 'assets/items/' + k + '.png?v=' + IMG_VER);
    });
  };

  const oldCreate = Main.prototype.create;
  Main.prototype.create = function () {
    const r = oldCreate ? oldCreate.apply(this, arguments) : undefined;
    applyOverrides(this);
    // เผื่อบางไอคอนถูกวาดทีหลัง ลองอีกครั้ง
    if (this.time && this.time.delayedCall) {
      this.time.delayedCall(300, () => applyOverrides(this));
      this.time.delayedCall(1500, () => applyOverrides(this));
    }
    return r;
  };
})();
