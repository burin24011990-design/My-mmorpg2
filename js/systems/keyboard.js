// ===== ควบคุมบน PC: คีย์บอร์ด + เล็งสกิลด้วยเมาส์ =====
// วางไว้ที่ js/systems/keyboard.js แล้วโหลดหลัง bot.js / aimDash.js และก่อน main.js
//
// ปุ่ม:
//   W A S D / ลูกศร = เดิน (ของเดิม)
//   Space หรือ J    = โจมตีธรรมดา
//   1 2 3 4         = สกิลช่อง 1-4 (สกิลวางพื้น/สกิลพุ่ง เล็งไปที่ตำแหน่งเมาส์)
//   R หรือ U        = อัลติ (เล็งด้วยเมาส์ถ้าเป็นอัลติแบบเล็งได้)
//   E               = แดช (ของเดิมใน aimDash.js)
//   Q               = ดื่มยา HP | F = ดื่มยา MP
//   B               = เปิด/ปิดบอท (ของเดิม)
//   Esc             = ปิดหน้าต่างที่เปิดอยู่
(function () {
  const P = Main.prototype;

  const typing = () => {
    const a = document.activeElement;
    return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
  };

  // ตำแหน่งเมาส์ในโลกเกม + ทิศจากตัวละครไปหาเมาส์
  P.pcAim = function () {
    const ptr = this.input.activePointer, p = this.player;
    if (!ptr || !p) return null;
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const dx = wp.x - p.x, dy = wp.y - p.y, l = Math.hypot(dx, dy);
    if (l < 8) return null;
    return { x: wp.x, y: wp.y, nx: dx / l, ny: dy / l };
  };

  // ให้ระบบล็อกเป้าไม่ดึงจุดตก/ทิศของสกิลที่เราเล็งเอง (เหมือนตอนลากเล็งบนมือถือ)
  P.pcFreeAim = function () {
    this._freeAimUntil = this.time.now + 900;
    this.target = null;
  };

  P.pcBasic = function () {
    if (this.panel || typing()) return;
    const a = this.pcAim();
    if (a && !this.target) this.facing.set(a.nx, a.ny);
    this.useBasicAttack();
  };

  P.pcSkill = function (idx) {
    if (this.panel || typing()) return;
    const sid = this.slots && this.slots[idx];
    if (!sid) return;
    const a = this.pcAim();
    const GC = window.GROUND_CFG || {}, DC = window.DIR_CFG || {};
    if (!a) { this.useSkill(idx); return; }
    this.facing.set(a.nx, a.ny);
    if (GC[sid]) { this.pcFreeAim(); this.useSkill(idx, { x: a.x, y: a.y }); }
    else if (DC[sid]) { this.pcFreeAim(); this.useSkill(idx, { dir: true, x: a.nx, y: a.ny }); }
    else this.useSkill(idx);
  };

  P.pcUlti = function () {
    if (this.panel || typing() || !this.ultiClass) return;
    const a = this.pcAim();
    const cls = this.ultiClass;
    const GU = window.GROUND_ULTI || {}, DU = window.DIR_ULTI || {};
    if (!a) { this.useUlti(); return; }
    this.facing.set(a.nx, a.ny);
    if (GU[cls]) { this.pcFreeAim(); this.useUlti({ x: a.x, y: a.y }); }
    else if (DU[cls]) { this.pcFreeAim(); this.useUlti({ dir: true, x: a.nx, y: a.ny }); }
    else this.useUlti();
  };

  // ดื่มยา: กดปุ่มยาบนจอ (วิธีเดียวกับที่บอทใช้)
  P.pcPotion = function (kind) {
    if (this.panel || typing()) return;
    if (kind === 'hp') { if (this.botDrinkHp) this.botDrinkHp(); return; }
    const labs = document.querySelectorAll('.qs .qs-lab');
    for (let i = 0; i < labs.length; i++) {
      if (/^MP\s*\d+\s*%$/.test((labs[i].textContent || '').trim())) {
        const el = labs[i].closest('.qs');
        if (el && !el.classList.contains('empty') && this.botClickEl) this.botClickEl(el);
        return;
      }
    }
    if (this.toastMsg) this.toastMsg('ไม่พบปุ่มยา MP');
  };

  const _setupInput = P.setupInput;
  P.setupInput = function () {
    _setupInput.call(this);
    const kb = this.input.keyboard;
    if (!kb) return;

    // ลบตัวรับปุ่มเดิม (ที่ใช้ useSkill แบบไม่เล็ง) แล้วใส่ตัวใหม่ที่เล็งด้วยเมาส์
    ['ONE', 'TWO', 'THREE', 'FOUR', 'SPACE', 'U'].forEach(k => kb.removeAllListeners('keydown-' + k));
    kb.on('keydown-ONE', () => this.pcSkill(0));
    kb.on('keydown-TWO', () => this.pcSkill(1));
    kb.on('keydown-THREE', () => this.pcSkill(2));
    kb.on('keydown-FOUR', () => this.pcSkill(3));
    kb.on('keydown-SPACE', () => this.pcBasic());
    kb.on('keydown-J', () => this.pcBasic());
    kb.on('keydown-U', () => this.pcUlti());
    kb.on('keydown-R', () => this.pcUlti());
    kb.on('keydown-Q', () => this.pcPotion('hp'));
    kb.on('keydown-F', () => this.pcPotion('mp'));
    kb.on('keydown-ESC', () => { if (this.panel && this.closePanel) this.closePanel(); });

    // PC: คลิกเมาส์ในครึ่งซ้ายของจอไม่ให้สร้างจอยสติ๊ก (จอยมีไว้สำหรับนิ้วบนมือถือ)
    this.events.off('update', this.pcKillMouseJoy, this);
    this.events.on('update', this.pcKillMouseJoy, this);
  };

  P.pcKillMouseJoy = function () {
    const j = this.joy, m = this.input && this.input.mousePointer;
    if (!j || !m || j.id === null || j.id !== m.id) return;
    j.id = null; j.dx = 0; j.dy = 0;
    if (this.joyBase) this.joyBase.setVisible(false);
    if (this.joyKnob) this.joyKnob.setVisible(false);
  };
})();
