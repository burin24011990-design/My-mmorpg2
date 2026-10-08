// ===== เติมรูป / สีประจำอาชีพ / ข้อความเลเวลถัดไป ให้สกิลในหน้าต่างสกิล =====
// ต้องโหลดหลังไฟล์ hook ตัวอื่นทั้งหมด (stats.js, skillLevelPatch.js, priest.js ฯลฯ) และก่อน main.js
// รูปอยู่ที่ assets/skills/<รหัสสกิล>.png  เช่น assets/skills/sw_slash.png  (อัลติ = ulti_sword.png ฯลฯ)
// สกิลไหนไม่มีรูป จะใช้ไอคอนเดิมแทนอัตโนมัติ
(function () {
  var IMG_DIR = 'assets/skills/';
  var IMG_VER = '1';   // ถ้าเปลี่ยนรูปแล้วมือถือยังโชว์รูปเก่า ให้เพิ่มเลขนี้

  // รหัสสกิลที่ "ยังไม่มีรูป" ในรีโป -> ไม่พยายามโหลด ใช้ไอคอนเดิม
  // พออัปโหลดรูปแล้ว ให้ลบชื่อนั้นออกจากรายการนี้
  var NO_IMG = {
    basic_sword: 1, basic_rogue: 1, basic_mage: 1, basic_archer: 1, basic_priest: 1,
    dash: 1
  };

  var CLS = {
    sword:  { label: 'ดาบ',  color: '#ffb347' },
    mage:   { label: 'คทา',  color: '#5db0ff' },
    archer: { label: 'ธนู',  color: '#7dff9a' },
    priest: { label: 'พระ',  color: '#f5d76e' },
    rogue:  { label: 'โจร',  color: '#b98cff' }
  };

  function sidOf(s) {
    var sid = s.sid;
    if (!sid && s.id && String(s.id).indexOf('ulti_') === 0) sid = String(s.id);
    if (sid && String(sid).indexOf('off_') === 0) sid = String(sid).slice(4);
    if (!sid && typeof ULTI_DEFS !== 'undefined') {
      Object.keys(ULTI_DEFS).forEach(function (c) { if (ULTI_DEFS[c] && ULTI_DEFS[c].name === s.name) sid = 'ulti_' + c; });
    }
    return sid || null;
  }

  function defOf(sid) {
    if (!sid) return null;
    if (typeof SKILL_DEFS !== 'undefined' && SKILL_DEFS[sid]) return SKILL_DEFS[sid];
    var m = /^ulti_(\w+)$/.exec(sid);
    if (m && typeof ULTI_DEFS !== 'undefined' && ULTI_DEFS[m[1]]) return Object.assign({ class: m[1] }, ULTI_DEFS[m[1]]);
    return null;
  }

  function hasNoImg(sid) {
    sid = String(sid);
    return !!NO_IMG[sid] || sid.indexOf('basic_') === 0;
  }

  function decorate(s) {
    var sid = sidOf(s);
    if (!sid) return s;
    var def = defOf(sid);
    var cls = def && def.class && CLS[def.class];
    var out = Object.assign({}, s);
    if (!hasNoImg(sid)) out.img = IMG_DIR + sid + '.png?v=' + IMG_VER;
    if (cls) { out.accent = cls.color; out.clsLabel = cls.label; }

    if (def && def.dmg > 0 && !s.maxed && typeof s.lv === 'number' && s.maxLv && typeof skillLvMul === 'function') {
      var now = Math.round(def.dmg * skillLvMul(s.lv));
      var nxt = Math.round(def.dmg * skillLvMul(s.lv + 1));
      out.next = 'เลเวลถัดไป: ดาเมจฐาน ' + now + ' → ' + nxt;
    }
    return out;
  }

  function install() {
    if (!window.PixelPanels || !PixelPanels.addDataHook) return false;
    PixelPanels.addDataHook(function (d) {
      return Object.assign({}, d, {
        skills: (d.skills || []).map(decorate),
        specialSkills: (d.specialSkills || []).map(decorate)
      });
    });
    return true;
  }
  if (!install()) {
    var t = setInterval(function () { if (install()) clearInterval(t); }, 200);
  }
})();
