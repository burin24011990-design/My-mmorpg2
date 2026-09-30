// ===== เชื่อมหน้าต่างสกิล (pixelPanels) กับระบบเลเวลสกิล/หนังสือ =====
// - เติมเลเวล ดาเมจตามเลเวล จำนวนหนังสือ ลงในรายการสกิล
// - กดปุ่ม "อัปเลเวล" ในหน้าต่างสกิล = ใช้หนังสือจากกระเป๋าเพื่ออัปสกิล
// โหลดหลัง pixelPanels.js และ pixelBridge.js ก่อน main.js
(function () {
  var scene = null;

  // จับ scene ของเกมตอนเริ่มระบบสกิล
  var _init = Main.prototype.initSkillData;
  Main.prototype.initSkillData = function () {
    scene = this;
    return _init.apply(this, arguments);
  };

  // สำรอง: ถ้า initSkillData ยังไม่ถูกเรียก ใช้ scene จาก pixelBridge
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
