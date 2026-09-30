// ===== สร้างรูปพื้นฐานด้วยโค้ด (แทนที่ด้วยสไปรต์จริงทีหลังได้) =====
function generateTextures(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x4aa3ff).fillCircle(16, 16, 16).generateTexture('player', 32, 32);
  g.clear().fillStyle(0x6bd66b).fillCircle(14, 14, 14).generateTexture('slime', 28, 28);
  g.clear().fillStyle(0xffffff).fillCircle(8, 8, 8).generateTexture('proj', 16, 16);
  g.clear().fillStyle(0xffd23d).fillCircle(9, 9, 9).lineStyle(2, 0x8a6d00).strokeCircle(9, 9, 9).generateTexture('gold', 18, 18);
  g.clear().fillStyle(0xd9d9d9).fillRect(13, 2, 4, 20).fillStyle(0x8a5a2a).fillRect(9, 20, 12, 5).generateTexture('icon_sword', 30, 30);
  g.clear().fillStyle(0x8a5a2a).fillRect(13, 6, 4, 22).fillStyle(0x7ad1ff).fillCircle(15, 6, 6).generateTexture('icon_staff', 30, 30);
  g.clear().lineStyle(3, 0x8a5a2a).strokeCircle(15, 15, 12).fillStyle(0xe8e8e8).fillRect(14, 3, 2, 24).generateTexture('icon_bow', 30, 30);
  g.clear().fillStyle(0xb35ae0).fillRect(0, 0, 16, 16).generateTexture('scroll', 16, 16);
  g.clear().fillStyle(0xd9a13d).fillRect(2, 2, 26, 26).lineStyle(2, 0x7a5a10).strokeRect(2, 2, 26, 26).generateTexture('box', 30, 30);
  g.clear().fillStyle(0xd9d9d9).fillRect(6, 12, 18, 10).fillStyle(0x9a9a9a).fillRect(5, 4, 20, 10).generateTexture('icon_helmet', 30, 30);
  g.clear().fillStyle(0x8a8a8a).fillRect(6, 4, 18, 22).fillStyle(0x5a5a5a).fillRect(6, 4, 18, 6).generateTexture('icon_armor', 30, 30);
  g.clear().fillStyle(0xc98a4a).fillRect(4, 10, 10, 14).fillRect(16, 10, 10, 14).generateTexture('icon_gloves', 30, 30);
  g.clear().fillStyle(0x6a4a2a).fillRect(4, 18, 22, 8).fillRect(4, 8, 10, 12).generateTexture('icon_shoes', 30, 30);
  g.clear().lineStyle(4, 0xffd23d, 1).strokeCircle(15, 15, 9).generateTexture('icon_ring', 30, 30);
  g.clear().lineStyle(2, 0xffd23d, 1).strokeCircle(15, 9, 6).fillStyle(0x5ad1ff).fillCircle(15, 19, 4).generateTexture('icon_necklace', 30, 30);
  g.clear().fillStyle(0xffffff).fillRect(3, 10, 18, 4).fillRect(10, 3, 4, 18).generateTexture('ic_melee', 24, 24);
  g.clear().lineStyle(3, 0xffffff, 1).strokeCircle(12, 12, 9).fillStyle(0xffffff).fillCircle(12, 12, 3).generateTexture('ic_aoe', 24, 24);
  g.clear().fillStyle(0xffffff).fillCircle(12, 12, 7).generateTexture('ic_proj', 24, 24);
  g.clear().fillStyle(0xffffff).fillTriangle(4, 4, 4, 20, 21, 12).generateTexture('ic_dash', 24, 24);
  g.clear().fillStyle(0xe0883a).fillCircle(14, 14, 14).fillStyle(0x5a2a0a).fillCircle(14, 14, 5).generateTexture('shooter', 28, 28);
  g.clear().fillStyle(0xff5050).fillCircle(6, 6, 6).generateTexture('eshot', 12, 12);
  g.clear().fillStyle(0x9a3ae0).fillCircle(28, 30, 26).lineStyle(4, 0xffd23d, 1).strokeCircle(28, 30, 26)
    .fillStyle(0xffd23d).fillTriangle(12, 12, 18, 2, 24, 12).fillTriangle(24, 12, 28, 0, 32, 12).fillTriangle(32, 12, 38, 2, 44, 12)
    .fillStyle(0x2a0a3a).fillCircle(20, 30, 4).fillCircle(36, 30, 4).generateTexture('boss', 56, 58);
  g.destroy();
}
