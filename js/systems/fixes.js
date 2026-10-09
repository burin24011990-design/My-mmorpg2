// ===== แก้บั๊ก: ตายแล้วต้องกลับเมืองจริง =====
// ทับ hurtPlayer เดิมใน monsters.js: เมื่อ HP หมด -> เรียก townGoToTown (town.js) ให้ตายจริง
// การหัก EXP 1% / ฟื้น HP-MP / ล้างมอนที่ไล่ / เซฟเกม ทำอยู่ใน townRevive() ของ town.js
// อมตะ 3 วินาทีหลังโดนตี/หลังออกจากเมือง (invulnUntil)
// v2: โหมดห้อง (rmActive) ดาเมจมอนมาจากเซิร์ฟเวอร์ ไม่ผ่าน MONSTER_DMG_SCALE ใน monsters.js
//     จึงคูณ MONSTER_DMG_SCALE ที่นี่เฉพาะตอน rmActive (โหมดมอนในเครื่องคูณไปแล้ว ไม่คูณซ้ำ)
// v3: จำกัดให้ผู้เล่นโดนมอนตีได้อย่างมาก 1 ครั้งต่อ MONSTER_HIT_GAP_MS (ทุกแหล่ง: ชนตัว/กระสุน/สกิล ทั้งโหมดห้องและในเครื่อง)
const RESPAWN_INVULN_MS = 3000;
const MONSTER_HIT_GAP_MS = 1000;   // ระยะห่างขั้นต่ำระหว่างการโดนตีแต่ละครั้ง (มิลลิวินาที) 1000 = 1 วินาที

Object.assign(Main.prototype, {
  hurtPlayer(raw) {
    const p = this.player, now = this.time.now;
    if (now < (this.invulnUntil || 0)) return;
    if (window._townBusy) return;   // อยู่ในเมืองแล้ว ไม่ต้องรับดาเมจ
    if (now < (this._lastHurtAt || 0) + MONSTER_HIT_GAP_MS) return;   // ยังไม่ครบ 1 วิจากการโดนครั้งก่อน
    this._lastHurtAt = now;

    // โหมดห้อง: คูณตัวคูณความแรงมอนที่ฝั่งไคลเอนต์ | โหมดในเครื่อง: e.dmg คูณมาแล้ว
    const k = (this.rmActive && typeof MONSTER_DMG_SCALE === 'number') ? MONSTER_DMG_SCALE : 1;
    const dmg = Math.max(1, Math.round(raw * k) - this.equipDefBonus);
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
