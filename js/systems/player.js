// ===== สเตตัสผู้เล่น: ATK/HP/MP, เลเวล, EXP =====
Object.assign(Main.prototype, {
  initPlayerState() {
    this.stats = { level: 1, exp: 0, expNext: levelExpNeeded(1), hp: 100, maxHp: 100, mp: 50, maxMp: 50, baseAtk: 10, gold: 0 };
    this.equipHpBonus = 0; this.equipMpBonus = 0; this.equipDefBonus = 0;
    this.learnedSkills = new Set(['sw_slash']);
    this.slots = ['sw_slash', null, null, null];
    this.ultiClass = null;
    this.cdEnd = {};
    this.kills = 0;
    this.hitCd = 0;
    this.autoMode = false;
    this.target = null; this.manualTarget = null;
  },

  computeAtk() {
    let atkBonus = 0, hpBonus = 0, mpBonus = 0, defBonus = 0;
    EQUIP_SLOT_KEYS.forEach(k => {
      const it = this.equipment[k];
      if (it) { const s = computeItemStats(it); atkBonus += s.atk || 0; hpBonus += s.hp || 0; mpBonus += s.mp || 0; defBonus += s.def || 0; }
    });
    this.atk = this.stats.baseAtk + atkBonus;
    this.equipHpBonus = hpBonus; this.equipMpBonus = mpBonus; this.equipDefBonus = defBonus;
    this.stats.hp = Math.min(this.stats.hp, this.maxHp());
    this.stats.mp = Math.min(this.stats.mp, this.maxMp());
  },

  maxHp() { return this.stats.maxHp + this.equipHpBonus; },
  maxMp() { return this.stats.maxMp + this.equipMpBonus; },

  currentClass() {
    const w = this.equipment.weapon;
    return w ? w.class : 'sword';
  },

  gainExp(n) {
    if (this.stats.level >= LEVEL_CAP) return;
    this.stats.exp += n;
    while (this.stats.level < LEVEL_CAP && this.stats.exp >= this.stats.expNext) {
      this.stats.exp -= this.stats.expNext;
      this.stats.level++;
      this.stats.expNext = levelExpNeeded(this.stats.level);
      this.stats.maxHp += 15; this.stats.maxMp += 8; this.stats.baseAtk += 3;
      this.computeAtk();
      this.stats.hp = this.maxHp(); this.stats.mp = this.maxMp();
      this.toastMsg('เลเวลอัพ! ตอนนี้เลเวล ' + this.stats.level);
    }
    if (this.stats.level >= LEVEL_CAP) this.stats.exp = 0;
  },
});
