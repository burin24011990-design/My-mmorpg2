// ===== ช่องอันติแบบยืดหยุ่น (สำหรับสายผสม) =====
// ใส่สกิลสายเดียวกันครบ 3 ช่อง = ปุ่มนี้เป็น ULTI เหมือนเดิม
// ไม่ครบ = ปุ่มนี้กลายเป็น "ช่องสกิลพิเศษ" ใส่สกิลสายไหนก็ได้ (ใช้งานได้เหมือนช่องสกิลปกติ ทั้งคูลดาวน์/มานา/ลากเล็ง/บอท)
//   - ช่องว่าง: แตะเพื่อเลือกสกิลใส่ | ช่องที่ใส่แล้ว: แตะ = ใช้สกิล, แตะปุ่ม ✎ มุมขวาบน = เปลี่ยน/ถอดสกิล
//   - พอใส่สายเดียวกันครบ 3 ช่องอีกครั้ง ปุ่มกลับเป็นอันติ และสกิลที่ใส่ไว้ในช่องพิเศษจะถูกเก็บไว้ ไม่หาย
// สกิลช่องพิเศษถูกเซฟไปกับเซฟเกม (save.js) และขึ้นหน้าต่างสกิลได้ (skillLevelPatch.js)
// โหลดต่อจากไฟล์สกิล/เอฟเฟกต์ทั้งหมด และ "ก่อน" main.js (ต้องอยู่หลังสุดเพื่อให้กติกาของแต่ละอาชีพทำงานกับสกิลช่องนี้ด้วย)
(function () {
  const P = Main.prototype;
  const IDX = 4;                           // ช่องพิเศษใช้ดัชนี 4 (cdEnd.slot4) แต่ไม่ได้อยู่ใน this.slots จึงไม่กระทบการนับคอมโบ
  const SELF_TYPES = ['heal1', 'healaoe', 'haste'];   // สกิลใช้กับตัวเอง บอทใช้ได้โดยไม่ต้องมีเป้า

  const hex = c => '#' + ('000000' + (c || 0).toString(16)).slice(-6);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const inMain = (scene, sid) => { const s = scene.slots || []; for (let i = 0; i < 4; i++) if (s[i] === sid) return true; return false; };
  // เซฟสกิลช่องพิเศษทันที (ไปกับระบบเซฟ/คลาวด์ใน save.js)
  const persist = scene => { try { if (scene.saveSoon) scene.saveSoon(); } catch (e) { /* ignore */ } };

  // ใส่สกิลช่องพิเศษลง this.slots[4] ชั่วคราวระหว่างเรียกฟังก์ชัน (ให้โค้ดเดิมที่อ่าน this.slots[idx] ทำงานได้) แล้วคืนค่า
  function withFlex(scene, fn) {
    const s = scene.slots, had = s.length;
    s[IDX] = scene.flexSid;
    try { return fn(); } finally { s.length = Math.min(had, IDX); }
  }

  // ---------- ใช้สกิลช่องพิเศษ ----------
  const _useSkill = P.useSkill;
  P.useSkill = function (idx, gp) {
    if (idx !== IDX) return _useSkill.call(this, idx, gp);
    if (this.ultiClass || !this.flexSid) return;            // ตอนเป็นอันติอยู่ ช่องพิเศษใช้ไม่ได้
    return withFlex(this, () => _useSkill.call(this, idx, gp));
  };

  // ---------- สร้างปุ่ม (วางทับตำแหน่งปุ่มอันติ) ----------
  function buildBtn(scene) {
    const ub = scene.ultiBtn;
    if (!ub) return;
    const x = ub.c.x, y = ub.c.y, r = Math.round((ub.c.radius || 38) * 0.95);
    const c = scene.add.circle(x, y, r, 0x3a3a3a, 0.55).setScrollFactor(0).setDepth(100).setInteractive();
    c.setStrokeStyle(3, 0xd4af37, 0.95);
    const icon = scene.add.image(x, y - 4, 'ic_melee').setDisplaySize(22, 22).setScrollFactor(0).setDepth(101).setVisible(false);
    const t = scene.add.text(x, y + Math.round(r * 0.55), '', { fontSize: '9px', color: '#fff', align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    const cdText = scene.add.text(x, y, '+', { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
    const edit = scene.add.circle(x + r * 0.72, y - r * 0.72, 13, 0x1d1d1d, 0.95).setScrollFactor(0).setDepth(103).setInteractive();
    edit.setStrokeStyle(2, 0xd4af37, 1);
    const editT = scene.add.text(edit.x, edit.y, '✎', { fontSize: '14px', color: '#ffe28a' }).setOrigin(0.5).setScrollFactor(0).setDepth(104);
    const b = scene.flexBtn = { c: c, icon: icon, t: t, cdText: cdText, edit: edit, editT: editT, r: r };

    let mode = '';
    c.on('pointerdown', pointer => {
      if (scene.panel || scene.ultiClass) return;
      const sid = scene.flexSid;
      if (!sid) { openPicker(scene); return; }
      if ((window.GROUND_CFG && window.GROUND_CFG[sid]) || (window.DIR_CFG && window.DIR_CFG[sid])) {
        mode = 'aim';   // สกิลลากเล็ง: ใช้ระบบเดียวกับช่องสกิลปกติ (aimDash.js)
        withFlex(scene, () => scene.beginAim('slot', IDX, b, pointer));
        return;
      }
      mode = 'press';
    });
    c.on('pointerup', () => {
      if (mode !== 'press') return;
      mode = '';
      if (scene.flexSid && !scene.ultiClass) scene.useSkill(IDX);
    });
    c.on('pointerupoutside', () => { mode = ''; });
    edit.on('pointerdown', () => { if (!scene.panel && !scene.ultiClass) openPicker(scene); });
    drawBtn(scene, scene.time.now);
  }

  // วาดปุ่มทุกเฟรม: ตามตำแหน่งปุ่มอันติ + แสดงเฉพาะตอนไม่มีอันติ
  function drawBtn(scene, time) {
    const b = scene.flexBtn, ub = scene.ultiBtn;
    if (!b || !ub) return;
    const flex = !scene.ultiClass;
    const x = ub.c.x, y = ub.c.y, r = b.r;
    b.c.setPosition(x, y);
    b.icon.setPosition(x, y - 4);
    b.t.setPosition(x, y + Math.round(r * 0.55));
    b.cdText.setPosition(x, y);
    b.edit.setPosition(x + r * 0.72, y - r * 0.72);
    b.editT.setPosition(b.edit.x, b.edit.y);

    const sid = scene.flexSid, def = sid && SKILL_DEFS[sid];
    if (!def) {
      b.c.setFillStyle(0x3a3a3a, 0.55);
      b.t.setText('ช่องพิเศษ');
      b.cdText.setText('+');
    } else {
      const left = Math.max(0, (scene.cdEnd['slot' + IDX] || 0) - time);
      const noMana = scene.stats.mp < def.mp;
      b.c.setFillStyle(CLASSES[def.class] ? CLASSES[def.class].color : 0x888888, (left > 0 || noMana) ? 0.3 : 0.85);
      b.icon.setTexture(skillIconKey(def.type)).setTint(0xffffff);
      b.t.setText(def.name);
      b.cdText.setText(left > 0 ? (left / 1000).toFixed(1) : '');
    }
    b.c.setVisible(flex); b.t.setVisible(flex); b.cdText.setVisible(flex);
    b.icon.setVisible(flex && !!def);
    b.edit.setVisible(flex && !!def); b.editT.setVisible(flex && !!def);
    if (b.c.input) b.c.input.enabled = flex;
    if (b.edit.input) b.edit.input.enabled = flex && !!def;
  }

  const _setupButtons = P.setupButtons;
  P.setupButtons = function () {
    _setupButtons.call(this);
    buildBtn(this);
  };

  const _usb = P.updateSkillButtons;
  P.updateSkillButtons = function (time) {
    _usb.call(this, time);
    // ใส่สกิลเดียวกันลงช่องหลักแล้ว = ถอดออกจากช่องพิเศษ (กันใช้ซ้ำสองช่อง)
    if (this.flexSid && inMain(this, this.flexSid)) {
      this.flexSid = null; persist(this);
      this.toastMsg('ถอดสกิลช่องพิเศษ (ซ้ำกับช่องหลัก)');
    }
    drawBtn(this, time);
  };

  // ---------- บอท: ใช้สกิลช่องพิเศษเมื่อพร้อม ----------
  const _updateAuto = P.updateAuto;
  P.updateAuto = function () {
    if (this.autoMode && !this.panel) autoCast(this);
    return _updateAuto ? _updateAuto.apply(this, arguments) : undefined;
  };
  function autoCast(scene) {
    const sid = scene.flexSid;
    if (!sid || scene.ultiClass) return;
    const def = SKILL_DEFS[sid], now = scene.time.now;
    if (!def || now < (scene._flexAutoAt || 0)) return;
    scene._flexAutoAt = now + 350;
    if (now < (scene.cdEnd['slot' + IDX] || 0) || scene.stats.mp < def.mp) return;
    const t = scene.target && scene.target.active ? scene.target : null;
    const cfg = window.GROUND_CFG && window.GROUND_CFG[sid];
    if (SELF_TYPES.indexOf(def.type) < 0) {
      if (!t) return;
      const reach = cfg ? cfg.cast : Math.max(def.range || 0, 60) + 30;
      if (Phaser.Math.Distance.Between(scene.player.x, scene.player.y, t.x, t.y) > reach) return;
    }
    scene.useSkill(IDX, cfg && !cfg.self && t ? { x: t.x, y: t.y } : undefined);
  }

  // ---------- หน้าต่างเลือกสกิลใส่ช่องพิเศษ ----------
  const CSS =
    '#flex-root[hidden]{display:none!important}' +
    '#flex-root{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font-family:"Mitr",sans-serif}' +
    '#flex-root .fx-box{width:min(92vw,460px);max-height:92vh;display:flex;flex-direction:column;background:#26090f;border:2px solid #ffd45c;border-radius:12px;color:#fff;overflow:hidden}' +
    '#flex-root .fx-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#3a0f18;color:#ffe28a;font-size:16px}' +
    '#flex-root .fx-head button{background:none;border:0;color:#fff;font-size:20px;padding:2px 8px}' +
    '#flex-root .fx-note{padding:6px 12px;font-size:12px;color:#c9b27a}' +
    '#flex-root .fx-list{flex:1;overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:4px 8px}' +
    '#flex-root .fx-row{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;text-align:left;margin:4px 0;padding:8px 10px;background:#33141c;border:1px solid #6b3a2a;border-radius:8px;color:#fff;font-family:inherit;touch-action:manipulation}' +
    '#flex-root .fx-row.cur{border-color:#ffd45c;background:#4a1d24}' +
    '#flex-root .fx-row i{flex:none;width:12px;height:36px;border-radius:6px}' +
    '#flex-root .fx-row .n{display:block;font-size:14px}#flex-root .fx-row .n em{font-style:normal;color:#ffe28a;font-size:11px;margin-left:6px}' +
    '#flex-root .fx-row .m{display:block;font-size:11px;color:#c9b27a}' +
    '#flex-root .fx-empty{padding:18px;text-align:center;color:#c9b27a;font-size:13px}' +
    '#flex-root .fx-foot{padding:8px 12px}' +
    '#flex-root .fx-foot button{width:100%;padding:8px;background:#5a1f1f;border:1px solid #c0392b;border-radius:8px;color:#fff;font-family:inherit;font-size:13px}';
  let root = null, curScene = null;

  function render() {
    const scene = curScene, list = root.querySelector('.fx-list'), foot = root.querySelector('.fx-foot');
    const learned = Array.from(scene.learnedSkills || []).filter(id => SKILL_DEFS[id] && !inMain(scene, id));
    learned.sort((a, b) => String(SKILL_DEFS[a].class).localeCompare(String(SKILL_DEFS[b].class)) || String(SKILL_DEFS[a].name).localeCompare(String(SKILL_DEFS[b].name)));
    list.innerHTML = learned.length ? learned.map(id => {
      const d = SKILL_DEFS[id], c = CLASSES[d.class] || {}, lv = (scene.skillLv && scene.skillLv[id]) || 1;
      return '<button class="fx-row' + (id === scene.flexSid ? ' cur' : '') + '" data-sid="' + esc(id) + '">' +
        '<i style="background:' + hex(c.color) + '"></i><span><span class="n">' + esc(d.name) + '<em>Lv.' + lv + '</em></span>' +
        '<span class="m">' + esc(c.label || c.name || d.class) + ' • MP ' + (d.mp || 0) + ' • คูลดาวน์ ' + ((d.cd || 0) / 1000).toFixed(1) + 's</span></span></button>';
    }).join('') : '<div class="fx-empty">ไม่มีสกิลที่ใส่ได้ (สกิลที่ใส่ในช่องหลักอยู่แล้วจะไม่แสดง)</div>';
    foot.innerHTML = scene.flexSid ? '<button data-act="clear">ถอดสกิลออกจากช่องพิเศษ</button>' : '';
  }

  function closePicker() { if (root) root.hidden = true; }

  function openPicker(scene) {
    curScene = scene;
    if (!root) {
      const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      root = document.createElement('div'); root.id = 'flex-root'; root.hidden = true;
      root.innerHTML = '<div class="fx-box"><div class="fx-head"><b>⭐ ช่องสกิลพิเศษ</b><button data-act="close">✕</button></div>' +
        '<div class="fx-note">ใส่สกิลสายไหนก็ได้ ใช้ได้ตอนที่ยังไม่มีสกิลสายเดียวกันครบ 3 ช่อง (ครบแล้วปุ่มนี้จะเป็นอันติ)</div>' +
        '<div class="fx-list"></div><div class="fx-foot"></div></div>';
      document.body.appendChild(root);
      root.addEventListener('click', ev => {
        const t = ev.target.closest('[data-sid],[data-act]');
        if (!t) { if (ev.target === root) closePicker(); return; }
        const sc = curScene;
        if (t.dataset.act === 'close') { closePicker(); return; }
        if (t.dataset.act === 'clear') {
          sc.flexSid = null; persist(sc); sc.toastMsg('ถอดสกิลช่องพิเศษแล้ว'); closePicker(); return;
        }
        const sid = t.dataset.sid;
        if (!SKILL_DEFS[sid]) return;
        sc.flexSid = sid; persist(sc);
        sc.toastMsg('ใส่ ' + SKILL_DEFS[sid].name + ' ที่ช่องพิเศษ');
        closePicker();
      });
      ['pointerdown', 'touchstart', 'mousedown'].forEach(evn => root.addEventListener(evn, e => e.stopPropagation(), { passive: true }));
    }
    render();
    root.hidden = false;
  }
})();
