// ===== แก้บั๊ก: ตายแล้วต้องกลับเมืองจริง =====
// ทับ hurtPlayer เดิมใน monsters.js: เมื่อ HP หมด -> เรียก townGoToTown (town.js) ให้ตายจริง
// การหัก EXP 1% / ฟื้น HP-MP / ล้างมอนที่ไล่ / เซฟเกม ทำอยู่ใน townRevive() ของ town.js
// อมตะ 3 วินาทีหลังโดนตี/หลังออกจากเมือง (invulnUntil)
const RESPAWN_INVULN_MS = 3000;

Object.assign(Main.prototype, {
  hurtPlayer(raw) {
    const p = this.player, now = this.time.now;
    if (now < (this.invulnUntil || 0)) return;
    if (window._townBusy) return;   // อยู่ในเมืองแล้ว ไม่ต้องรับดาเมจ

    const dmg = Math.max(1, raw - this.equipDefBonus);
    this.stats.hp -= dmg;
    if (window.showDamage) showDamage(this, p.x, p.y - 30, dmg, 'player');   // ตัวเลขดาเมจที่ผู้เล่นโดน
    p.setTint(0xff6666); this.time.delayedCall(150, () => p.clearTint());

    if (this.stats.hp <= 0) {
      this.stats.hp = 0;
      this.tweens.killTweensOf(p);
      p.setAlpha(1);
      townGoToTown(this, TOWN_DEAD_MSG, true);   // ตายจริง: กลับเมือง (หัก EXP ใน townRevive)
    }
  },
});
