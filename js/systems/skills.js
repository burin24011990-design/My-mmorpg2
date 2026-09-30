// ===== สกิล / โจมตี / อัลติ / เอฟเฟกต์ =====
Object.assign(Main.prototype, {
  // ---------- ระบบเลเวลสกิล (หนังสือเป็นไอเทมในกระเป๋า) ----------
  initSkillData() {
    this.skillLv = this.skillLv || {};
    if (!this.learnedSkills) this.learnedSkills = new Set(['sw_slash']);
    this.learnedSkills.forEach(sid => { if (!this.skillLv[sid]) this.skillLv[sid] = 1; });
    this.computeCombo();
  },

  // กดใช้หนังสือสกิลในช่องกระเป๋า idx
  // - ยังไม่เคยเรียน: เรียนรู้สกิล Lv.1 (ใช้ 1 เล่ม)
  // - เรียนแล้ว: อัปเลเวล ใช้ booksNeeded(lv) เล่ม (นับรวมทุกกองในกระเป๋า)
  useSkillBook(idx) {
    const it = this.bag[idx];
    if (!it || it.kind !== 'skillbook') return false;
    const sid = it.sid, d = SKILL_DEFS[sid];
    if (!d) return false;

    if (!this.learnedSkills.has(sid)) {
      this.consumeSkillBooks(sid, 1, idx);
      this.learnedSkills.add(sid);
      this.skillLv[sid] = 1;
      this.toastMsg('📕 เรียนรู้สกิล ' + d.name + '!');
      if (this.saveGame) this.saveGame();
      return true;
    }

    const lv = this.skillLv[sid] || 1;
    if (lv >= SKILL_MAX_LV) { this.toastMsg(d.name + ' เลเวลสูงสุดแล้ว'); return false; }
    const need = booksNeeded(lv), have = this.countSkillBooks(sid);
    if (have < need) { this.toastMsg('หนังสือไม่พอ ' + have + '/' + need + ' เล่ม'); return false; }
    this.consumeSkillBooks(sid, need, idx);
    this.skillLv[sid] = lv + 1;
    this.toastMsg(d.name + ' เลเวล ' + (lv + 1) + '!');
    this.computeCombo();          // อัปเดตเลเวลอัลติ
    if (this.saveGame) this.saveGame();
    return true;
  },

  // ---------- คอมโบ / อัลติ ----------
  computeCombo() {
    const count = {};
    this.slots.forEach(sid => { if (sid) { const c = SKILL_DEFS[sid].class; count[c] = (count[c] || 0) + 1; } });
    let found = null;
    Object.keys(count).forEach(c => { if (count[c] >= 3) found = c; });
    this.ultiClass = found;
    // เลเวลอัลติ = เลเวลต่ำสุดของสกิลในสลอตที่เป็นคลาสเดียวกับอัลติ
    this.ultiLv = 1;
    if (found) {
      const lvs = this.slots
        .filter(s => s && SKILL_DEFS[s].class === found)
        .map(s => (this.skillLv && this.skillLv[s]) || 1);
      this.ultiLv = Math.min.apply(null, lvs);
    }
    this.ultiBtn.c.setVisible(!!found); this.ultiBtn.t.setVisible(!!found);
    if (found) this.ultiBtn.t.setText(ULTI_DEFS[found].name + ' Lv.' + this.ultiLv);
  },

  flash(x, y, r, color) {
    const c = this.add.circle(x, y, r, color, 0.35);
    this.tweens.add({ targets: c, alpha: 0, duration: 220, onComplete: () => c.destroy() });
  },

  applySkillEffect(def, x, y, fx, fy, dmg, kind) {
    const color = CLASSES[kind] ? CLASSES[kind].color : 0xffffff;
    const tgt = this.target && this.target.active ? this.target : null;
    if (def.type === 'melee') {
      if (tgt && Phaser.Math.Distance.Between(x, y, tgt.x, tgt.y) <= def.range + 12) {
        this.flash(tgt.x, tgt.y, 40, 0xffffff);
        this.damage(tgt, dmg);
      } else {
        const ex = x + fx * 40, ey = y + fy * 40;
        this.flash(ex, ey, 45, 0xffffff);
        this.enemies.getChildren().slice().forEach(e => { if (Phaser.Math.Distance.Between(ex, ey, e.x, e.y) < 55) this.damage(e, dmg); });
      }
    } else if (def.type === 'aoe') {
      this.flash(x, y, def.range, color);
      this.enemies.getChildren().slice().forEach(e => { if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < def.range) this.damage(e, dmg); });
    } else if (def.type === 'dash') {
      const p = this.player;
      const nx = Phaser.Math.Clamp(p.x + fx * def.range, 20, WORLD_W - 20);
      const ny = Phaser.Math.Clamp(p.y + fy * def.range, 20, WORLD_H - 20);
      this.tweens.add({ targets: p, x: nx, y: ny, duration: 150 });
      this.flash(x, y, 60, 0xffffff);
      this.enemies.getChildren().slice().forEach(e => {
        if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < 90 || Phaser.Math.Distance.Between(nx, ny, e.x, e.y) < 70) this.damage(e, dmg);
      });
    } else if (def.type === 'proj') {
      const pr = this.projectiles.create(x, y, 'proj');
      pr.setData('dmg', dmg); pr.setTint(color);
      let vx = fx, vy = fy;
      if (tgt) { const d = new Phaser.Math.Vector2(tgt.x - x, tgt.y - y); if (d.length() > 1) { d.normalize(); vx = d.x; vy = d.y; } }
      pr.setVelocity(vx * 420, vy * 420);
      this.time.delayedCall(1100, () => pr.active && pr.destroy());
    }
  },

  useBasicAttack() {
    if (this.panel) return;
    const cls = this.currentClass(); const def = BASIC_ATTACKS[cls];
    const now = this.time.now;
    if (now < (this.cdEnd.basic || 0)) return;
    this.cdEnd.basic = now + def.cd;
    const p = this.player, fx = this.facing.x, fy = this.facing.y, dmg = def.dmg + this.atk;
    this.time.delayedCall(BASIC_DELAY, () => this.applySkillEffect(def, p.x, p.y, fx, fy, dmg, cls));
    if (this.online) this.sendNet('skill', { name: 'basic_' + cls, x: p.x, y: p.y, fx, fy });
  },

  useSkill(idx) {
    if (this.panel) return;
    const sid = this.slots[idx]; if (!sid) return;
    const def = SKILL_DEFS[sid];
    const now = this.time.now, key = 'slot' + idx;
    if (now < (this.cdEnd[key] || 0)) return;
    if (this.stats.mp < def.mp) { this.toastMsg('มานาไม่พอ'); return; }
    this.cdEnd[key] = now + def.cd;
    this.stats.mp -= def.mp;
    const p = this.player, fx = this.facing.x, fy = this.facing.y;
    const dmg = Math.round(def.dmg * skillLvMul(this.skillLv && this.skillLv[sid]) + this.atk);
    this.time.delayedCall(CAST_DELAY[def.type] || 150, () => this.applySkillEffect(def, p.x, p.y, fx, fy, dmg, def.class));
    if (this.online) this.sendNet('skill', { name: sid, x: p.x, y: p.y, fx, fy });
  },

  useUlti() {
    if (this.panel || !this.ultiClass) return;
    const def = ULTI_DEFS[this.ultiClass];
    const now = this.time.now;
    if (now < (this.cdEnd.ulti || 0)) return;
    if (this.stats.mp < def.mp) { this.toastMsg('มานาไม่พอสำหรับอัลติ'); return; }
    this.cdEnd.ulti = now + def.cd;
    this.stats.mp -= def.mp;
    const p = this.player, fx = this.facing.x, fy = this.facing.y, cls = this.ultiClass;
    const dmg = Math.round(def.dmg * skillLvMul(this.ultiLv || 1) + this.atk);
    this.toastMsg(def.name + '!');
    this.time.delayedCall(CAST_DELAY.ulti, () => this.applySkillEffect(def, p.x, p.y, fx, fy, dmg, cls));
    if (this.online) this.sendNet('skill', { name: 'ulti_' + this.ultiClass, x: p.x, y: p.y, fx, fy });
  },
});
