// ===== ตัวเลขดาเมจสวย ๆ =====
// showDamage(scene, x, y, จำนวน, ชนิด)
// ชนิด: 'normal' | 'crit' | 'player' (ผู้เล่นโดนตี) | 'heal'
(function () {
  var STYLE = {
    normal: { size: 32, fill: '#ffffff', stroke: '#7a1010', rise: 60 },
    crit:   { size: 46, fill: '#ffd23c', stroke: '#b3200a', rise: 80 },
    player: { size: 30, fill: '#ff5a5a', stroke: '#2a0000', rise: 55 },
    heal:   { size: 30, fill: '#6dff8a', stroke: '#0a4a1a', rise: 60 }
  };

  window.showDamage = function (scene, x, y, amount, kind) {
    if (!scene || !scene.add) return null;
    var s = STYLE[kind] || STYLE.normal;
    var txt = (kind === 'heal' ? '+' : '') + Math.round(amount);
    if (kind === 'crit') txt = txt + '!';

    var t = scene.add.text(x + Phaser.Math.Between(-14, 14), y, txt, {
      fontFamily: 'Mitr, sans-serif',
      fontSize: s.size + 'px',
      fontStyle: '700',
      color: s.fill,
      stroke: s.stroke,
      strokeThickness: Math.round(s.size / 5)
    });
    t.setOrigin(0.5).setDepth(99999);
    t.setShadow(0, 3, '#000000', 4, true, true);
    t.setScale(0.3);

    // เด้งขยายขึ้นก่อน
    scene.tweens.add({
      targets: t, scale: kind === 'crit' ? 1.35 : 1.1,
      duration: 140, ease: 'Back.easeOut',
      onComplete: function () {
        if (t.active) scene.tweens.add({ targets: t, scale: 1, duration: 100 });
      }
    });
    // ลอยขึ้น
    scene.tweens.add({
      targets: t, y: t.y - s.rise,
      x: t.x + Phaser.Math.Between(-10, 10),
      duration: 900, ease: 'Cubic.easeOut'
    });
    // จางหาย
    scene.tweens.add({
      targets: t, alpha: 0, delay: 550, duration: 400,
      onComplete: function () { t.destroy(); }
    });
    return t;
  };
})();
