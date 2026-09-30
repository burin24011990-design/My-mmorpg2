// ===== เชื่อมหน้าต่างสกิล (pixelPanels) กับระบบเลเวลสกิล/หนังสือ + ใส่สกิลลงช่องต่อสู้ =====
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
      return Object.assign({}, s, {
        lv: lv,
        maxLv: SKILL_MAX_LV,
        maxed: maxed,
        books: sc.countSkillBooks(sid),
        need: maxed ? 0 : booksNeeded(lv),
        equip: String(s.id).indexOf('off_') === 0,   // สกิลที่ยังไม่ได้ใส่ -> แสดงปุ่ม "ใส่สกิล"
        info: 'ดาเมจ ' + dmg + ' • คูลดาวน์ ' + (def.cd / 1000).toFixed(1) + 's'
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

  // ---------- ใส่สกิลลงช่อง ----------
  function afterEquip(sc) {
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
    sc.toastMsg('ใส่ ' + SKILL_DEFS[sid].name + ' ในช่อง ' + (i + 1));
    afterEquip(sc);
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

    function mkBtn(text, fn) {
      var b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = 'display:block;width:100%;margin:6px 0;padding:10px;font-size:15px;color:#fff;background:#8a1f26;border:2px solid #c9a24a;cursor:pointer';
      b.addEventListener('click', function (e) { e.stopPropagation(); document.body.removeChild(ov); if (fn) fn(); });
      box.appendChild(b);
    }
    sc.slots.forEach(function (cur, i) {
      var nm = cur && SKILL_DEFS[cur] ? SKILL_DEFS[cur].name : 'ว่าง';
      mkBtn('ช่อง ' + (i + 1) + ': ' + nm, function () { equipTo(sc, sid, i); });
    });
    mkBtn('ยกเลิก', null);

    ov.appendChild(box);
    ['pointerdown', 'touchstart', 'touchmove', 'mousedown'].forEach(function (evn) {
      ov.addEventListener(evn, function (e) { e.stopPropagation(); }, { passive: true });
    });
    document.body.appendChild(ov);
  }

  // กดปุ่ม "ใส่สกิล" (id ขึ้นต้น off_)
  window.addEventListener('pp:useSkill', function (e) {
    var sc = getScene();
    if (!sc) return;
    var rid = String((e.detail && e.detail.id) || '');
    if (rid.indexOf('off_') !== 0) return;
    var sid = rid.slice(4);
    if (!SKILL_DEFS[sid]) return;
    if (!sc.slots) sc.slots = [];
    var empty = -1;
    for (var i = 0; i < sc.slots.length; i++) { if (!sc.slots[i]) { empty = i; break; } }
    if (empty >= 0) equipTo(sc, sid, empty);
    else if (sc.slots.length) pickSlot(sc, sid);
  });

  // กดอัปเลเวลในหน้าต่างสกิล
  window.addEventListener('pp:upgradeSkill', function (e) {
    var sc = getScene();
    if (!sc) return;
    var rid = String((e.detail && e.detail.id) || '');
    var sid = rid.indexOf('off_') === 0 ? rid.slice(4) : (sc.slots && sc.slots[Number(rid)]);
    if (!sid) return;
    var idx = sc.bag.findIndex(function (it) { return it && it.kind === 'skillbook' && it.sid === sid; });
    if (idx < 0) { sc.toastMsg('ไม่มีหนังสือสกิลนี้ในกระเป๋า'); return; }
    sc.useSkillBook(idx);
    if (window.PixelPanels) PixelPanels.refresh();
  });
})();
