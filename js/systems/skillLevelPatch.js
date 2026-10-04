// ===== เชื่อมหน้าต่างสกิล (pixelPanels) กับระบบเลเวลสกิล/หนังสือ + ใส่/ถอดสกิลลงช่องต่อสู้ =====
// รองรับ "ช่องสกิลพิเศษ" (ช่องอันติที่ใส่สกิลอะไรก็ได้เมื่อไม่มีคอมโบ ดู flexSlot.js): โชว์ในหน้าต่างสกิล ใช้/ถอด/อัปเลเวลได้ และเลือกใส่ได้ตอนช่องหลักเต็ม
// โหลดหลัง pixelPanels.js และ pixelBridge.js ก่อน main.js
(function () {
  var scene = null;

  var _init = Main.prototype.initSkillData;
  Main.prototype.initSkillData = function () {
    scene = this;
    return _init.apply(this, arguments);
  };

  function getScene() { return scene || window.__mainScene || null; }

  function augmentList(list) {
    var sc = getScene();
    return (list || []).map(function (s) {
      var sid = s.sid;
      var def = sid && SKILL_DEFS[sid];
      if (!def || !sc) return s;
      if (!sc.learnedSkills) sc.learnedSkills = new Set();
      if (!sc.skillLv) sc.skillLv = {};
      sc.learnedSkills.add(sid);
      if (!sc.skillLv[sid]) sc.skillLv[sid] = 1;
      var lv = sc.skillLv[sid];
      var maxed = lv >= SKILL_MAX_LV;
      var dmg = Math.round(def.dmg * skillLvMul(lv));
      var notSlotted = String(s.id).indexOf('off_') === 0;
      var isFlex = notSlotted && sc.flexSid === sid;      // สกิลที่ใส่อยู่ในช่องพิเศษ (ไม่อยู่ใน this.slots)
      var info = 'ดาเมจ ' + dmg + ' • คูลดาวน์ ' + (def.cd / 1000).toFixed(1) + 's';
      if (isFlex) info += ' • ช่องพิเศษ' + (sc.ultiClass ? ' (พักไว้ ตอนนี้ปุ่มเป็นอันติ)' : '');
      return Object.assign({}, s, {
        id: isFlex ? 'flex' : s.id,
        name: isFlex ? s.name + ' ⭐' : s.name,
        off: isFlex ? false : s.off,
        lv: lv,
        maxLv: SKILL_MAX_LV,
        maxed: maxed,
        books: sc.countSkillBooks(sid),
        need: maxed ? 0 : booksNeeded(lv),
        equip: notSlotted && !isFlex,   // ยังไม่ได้ใส่ -> ปุ่ม "ใส่สกิล"
        unequip: !notSlotted || isFlex, // ใส่อยู่ -> ปุ่ม "ถอดสกิล"
        info: info
      });
    });
  }

  function install() {
    if (!window.PixelPanels || !PixelPanels.addDataHook) return false;
    PixelPanels.addDataHook(function (d) {
      return Object.assign({}, d, {
        skills: augmentList(d.skills),
        specialSkills: augmentList(d.specialSkills)
      });
    });
    return true;
  }
  if (!install()) {
    var t = setInterval(function () { if (install()) clearInterval(t); }, 200);
  }

  // ---------- ใส่ / ถอดสกิล ----------
  function afterChange(sc) {
    try { if (sc.computeCombo) sc.computeCombo(); } catch (e) {}
    // พยายามรีเฟรชปุ่มสกิลบนหน้าจอ (ชื่อฟังก์ชันต่างกันได้ ลองทุกชื่อที่น่าจะมี)
    ['refreshSlots', 'refreshSlotButtons', 'refreshSkillButtons', 'updateSlotUI',
     'updateSkillButtons', 'buildSkillButtons', 'layoutSkillButtons', 'renderSlots', 'refreshHud']
      .forEach(function (fn) { try { if (typeof sc[fn] === 'function') sc[fn](); } catch (e) {} });
    if (sc.saveGame) { try { sc.saveGame(); } catch (e) {} }
    if (window.PixelPanels) PixelPanels.refresh();
  }

  function equipTo(sc, sid, i) {
    sc.slots[i] = sid;
    if (sc.flexSid === sid) sc.flexSid = null;   // ย้ายจากช่องพิเศษมาช่องหลัก กันซ้ำ
    sc.toastMsg('ใส่ ' + SKILL_DEFS[sid].name + ' ในช่อง ' + (i + 1));
    afterChange(sc);
  }

  function equipFlex(sc, sid) {
    sc.flexSid = sid;
    sc.toastMsg('ใส่ ' + SKILL_DEFS[sid].name + ' ที่ช่องพิเศษ');
    afterChange(sc);
    if (sc.saveSoon) { try { sc.saveSoon(); } catch (e) {} }
  }

  function pickSlot(sc, sid) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;font-family:sans-serif';
    var box = document.createElement('div');
    box.style.cssText = 'background:#1c1014;border:3px solid #c9a24a;padding:14px;min-width:260px;max-width:90%;color:#fff;text-align:center';
    var h = document.createElement('div');
    h.style.cssText = 'font-size:16px;margin-bottom:10px;color:#ffe066';
    h.textContent = 'ช่องเต็ม เลือกช่องที่จะแทนที่ด้วย ' + SKILL_DEFS[sid].name;
    box.appendChild(h);

    function mkBtn(text, fn, gold) {
      var b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = 'display:block;width:100%;margin:6px 0;padding:10px;font-size:15px;color:#fff;background:' + (gold ? '#6b5416' : '#8a1f26') + ';border:2px solid #c9a24a;cursor:pointer';
      b.addEventListener('click', function (e) { e.stopPropagation(); document.body.removeChild(ov); if (fn) fn(); });
      box.appendChild(b);
    }
    sc.slots.forEach(function (cur, i) {
      var nm = cur && SKILL_DEFS[cur] ? SKILL_DEFS[cur].name : 'ว่าง';
      mkBtn('ช่อง ' + (i + 1) + ': ' + nm, function () { equipTo(sc, sid, i); });
    });
    // ช่องพิเศษ (ช่องอันติ ใช้ได้เมื่อไม่มีสกิลสายเดียวกันครบ 3 ช่อง)
    var fnm = sc.flexSid && SKILL_DEFS[sc.flexSid] ? SKILL_DEFS[sc.flexSid].name : 'ว่าง';
    mkBtn('⭐ ช่องพิเศษ (ช่องอันติ): ' + fnm, function () { equipFlex(sc, sid); }, true);
    mkBtn('ยกเลิก', null);

    ov.appendChild(box);
    ['pointerdown', 'touchstart', 'touchmove', 'mousedown'].forEach(function (evn) {
      ov.addEventListener(evn, function (e) { e.stopPropagation(); }, { passive: true });
    });
    document.body.appendChild(ov);
  }

  // กดปุ่ม "ใส่สกิล" (id ขึ้นต้น off_) | กด "ใช้งาน" ของสกิลช่องพิเศษ (id = flex)
  window.addEventListener('pp:useSkill', function (e) {
    var sc = getScene();
    if (!sc) return;
    var rid = String((e.detail && e.detail.id) || '');
    if (rid === 'flex') {
      if (sc.ultiClass) sc.toastMsg('ตอนนี้ปุ่มพิเศษเป็นอันติอยู่ ใช้สกิลนี้ไม่ได้');
      else if (sc.flexSid && sc.useSkill) sc.useSkill(4);
      return;
    }
    if (rid.indexOf('off_') !== 0) return;
    var sid = rid.slice(4);
    if (!SKILL_DEFS[sid]) return;
    if (!sc.slots) sc.slots = [];
    var empty = -1;
    for (var i = 0; i < sc.slots.length; i++) { if (!sc.slots[i]) { empty = i; break; } }
    if (empty >= 0) equipTo(sc, sid, empty);
    else if (sc.slots.length) pickSlot(sc, sid);
  });

  // กดปุ่ม "ถอดสกิล" (id = เลขช่อง หรือ flex)
  window.addEventListener('pp:unequipSkill', function (e) {
    var sc = getScene();
    if (!sc || !sc.slots) return;
    var rid = String((e.detail && e.detail.id) || '');
    if (rid === 'flex') {
      var fsid = sc.flexSid;
      if (!fsid) return;
      sc.flexSid = null;
      sc.toastMsg('ถอด ' + SKILL_DEFS[fsid].name + ' ออกจากช่องพิเศษ');
      afterChange(sc);
      if (sc.saveSoon) { try { sc.saveSoon(); } catch (er) {} }
      return;
    }
    var idx = Number(rid);
    var sid = sc.slots[idx];
    if (!sid) return;
    sc.slots[idx] = null;
    sc.toastMsg('ถอด ' + SKILL_DEFS[sid].name + ' ออกจากช่อง ' + (idx + 1));
    afterChange(sc);
  });

  // กดอัปเลเวลในหน้าต่างสกิล
  window.addEventListener('pp:upgradeSkill', function (e) {
    var sc = getScene();
    if (!sc) return;
    var rid = String((e.detail && e.detail.id) || '');
    var sid = rid === 'flex' ? sc.flexSid
      : (rid.indexOf('off_') === 0 ? rid.slice(4) : (sc.slots && sc.slots[Number(rid)]));
    if (!sid) return;
    var idx = sc.bag.findIndex(function (it) { return it && it.kind === 'skillbook' && it.sid === sid; });
    if (idx < 0) { sc.toastMsg('ไม่มีหนังสือสกิลนี้ในกระเป๋า'); return; }
    sc.useSkillBook(idx);
    if (window.PixelPanels) PixelPanels.refresh();
  });
})();
