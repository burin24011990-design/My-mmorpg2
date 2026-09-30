// ===== เชื่อมหน้าต่างสกิล (pixelPanels) กับระบบเลเวลสกิล/หนังสือ =====
// - เติมเลเวล ดาเมจตามเลเวล จำนวนหนังสือ ลงในรายการสกิล
// - กดปุ่ม "อัปเลเวล" ในหน้าต่างสกิล = ใช้หนังสือจากกระเป๋าเพื่ออัปสกิล
// โหลดหลัง pixelPanels.js และ pixelBridge.js ก่อน main.js
(function () {
  var scene = null;

  // จับ scene ของเกมตอนเริ่มระบบสกิล (เรียกตอนโหลดเซฟ/เริ่มด่านแรก)
  var _init = Main.prototype.initSkillData;
  Main.prototype.initSkillData = function () {
    scene = this;
    return _init.apply(this, arguments);
  };

  function augmentList(list) {
    return (list || []).map(function (s) {
      var def = SKILL_DEFS[s.id];
      if (!def || !scene || !scene.learnedSkills || !scene.learnedSkills.has(s.id)) return s;
      var lv = (scene.skillLv && scene.skillLv[s.id]) || 1;
      var maxed = lv >= SKILL_MAX_LV;
      var dmg = Math.round(def.dmg * skillLvMul(lv));
      return Object.assign({}, s, {
        lv: lv,
        maxLv: SKILL_MAX_LV,
        maxed: maxed,
        books: scene.countSkillBooks(s.id),
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
    if (!scene) return;
    var sid = e.detail && e.detail.id;
    var idx = scene.bag.findIndex(function (it) { return it && it.kind === 'skillbook' && it.sid === sid; });
    if (idx < 0) { scene.toastMsg('ไม่มีหนังสือสกิลนี้ในกระเป๋า'); return; }
    scene.useSkillBook(idx);
    if (window.PixelPanels) PixelPanels.refresh();
  });
})();
