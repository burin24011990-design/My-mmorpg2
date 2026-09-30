// ===== แก้บั๊ก: ตายวนซ้ำหลังฟื้น =====
// ทับ hurtPlayer เดิมใน monsters.js: อมตะ 3 วินาทีหลังฟื้น + สั่งมอนที่กำลังไล่ให้เลิกไล่ + ล้างกระสุนมอน
const RESPAWN_INVULN_MS = 3000;

Object.assign(Main.prototype, {
  hurtPlayer(raw) {
    const p = this.player, now = this.time.now;
    if (now < (this.invulnUntil || 0)) return;

    const dmg = Math.max(1, raw - this.equipDefBonus);
    this.stats.hp -= dmg;
    p.setTint(0xff6666); this.time.delayedCall(150, () => p.clearTint());

    if (this.stats.hp <= 0) {
      this.stats.hp = this.maxHp();
      const cz = ZONES[this.stageIdx];
      p.setPosition(cz.x, cz.y);
      p.setVelocity(0, 0);
      this.invulnUntil = now + RESPAWN_INVULN_MS;

      this.enemies.getChildren().forEach(e => { if (e.state === 'chase') e.state = 'return'; });
      this.enemyShots.getChildren().slice().forEach(sh => sh.destroy());

      this.tweens.killTweensOf(p);
      p.setAlpha(1);
      this.tweens.add({ targets: p, alpha: 0.35, yoyo: true, repeat: 5, duration: 250, onComplete: () => p.setAlpha(1) });
      this.toastMsg('คุณสลบ! ฟื้นกลางด่าน (อมตะ 3 วินาที)');
    }
  },
});
