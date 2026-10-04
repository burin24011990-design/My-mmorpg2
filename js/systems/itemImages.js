// ===== โหลดรูปไอเทมจาก assets/items/ =====
// ไฟล์นี้ต่อท้าย Main.preload เดิม โดยไม่ต้องแก้ Main.js
// ต้องโหลดหลัง js/scenes/Main.js และ js/data/items.js
(function () {
  const IMG_VER = 1;   // เปลี่ยนรูปแล้วมือถือยังเห็นรูปเก่า -> เพิ่มเลขนี้
  const IMG_KEYS = [
    'weapon_sword', 'weapon_mage', 'weapon_archer', 'weapon_priest', 'weapon_rogue',
    'helmet', 'armor', 'gloves', 'shoes', 'ring', 'necklace',
    'helmet_light', 'armor_light', 'gloves_light', 'shoes_light',
    'box', 'stone', 'cleanstone',
    'opt_red', 'opt_green', 'opt_purple', 'opt_yellow'
  ];

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
})();
