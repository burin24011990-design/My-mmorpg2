// ===== เติมรูป / สีประจำอาชีพ / ข้อความเลเวลถัดไป ให้สกิลในหน้าต่างสกิล =====
// ต้องโหลดหลังไฟล์ hook ตัวอื่นทั้งหมด (stats.js, skillLevelPatch.js, priest.js ฯลฯ) และก่อน main.js
// รูปไอคอนใช้ชุดเดียวกับเอฟเฟกต์สกิล: img/skillimg/<ชื่อไฟล์>_i.png
// ระบบจะ "ลองโหลดรูปเงียบๆ ก่อน" ถ้าไม่มีไฟล์ = ใช้ไอคอนอีโมจิเดิม และไม่ขึ้นกล่องแดง
(function () {
  var IMG_DIR = 'img/skillimg/';
  var IMG_VER = '1';   // ถ้าเปลี่ยนรูปแล้วมือถือยังโชว์รูปเก่า ให้เพิ่มเลขนี้

  // รหัสสกิล -> ชื่อไฟล์ (ไม่ต้องใส่ _i.png) | ใช้เมื่อชื่อไฟล์ไม่ตรงกับรหัสสกิล
  var FILE = {
    // อัลติ
    ulti_sword:  'sw_ult',
    ulti_mage:   'mg_ult',
    ulti_archer: 'ar_ult',
    ulti_priest: 'pr_ulti',
    ulti_rogue:  'rg_ult',
    // พระ
    pr_mass_heal: 'pr_mass',
    pr_mass:      'pr_mass',
    pr_smite:     'pr_smite',
    pr_haste:     'pr_haste',
    pr_beam:      'pr_beam'
  };

  // รหัสสกิลที่ "ไม่มีรูป" -> ใช้ไอคอนเดิมเลย (เช่น pr_heal ฮีลเดี่ยว ยังไม่มีไฟล์ภาพ)
  var NO_IMG = {
    basic_sword: 1, basic_rogue: 1, basic_mage: 1, basic_archer: 1, basic_priest: 1,
    dash: 1, pr_heal: 1
  };

  var CLS = {
    sword:  { label: 'ดาบ',  color: '#ffb347' },
    mage:   { label: 'คทา',  color: '#5db0ff' },
    archer: { label: 'ธนู',  color: '#7dff9a' },
    priest: { label: 'พระ',  color: '#f5d76e' },
    rogue:  { label: 'โจร',  color: '#b98cff' }
  };

  // ---- ตรวจว่าไฟล์รูปมีจริงไหม (เงียบ ไม่ขึ้นกล่องแดง) ----
  var probe = {};   // url -> 'ok' | 'bad' | 'wait'
  function imgOk(url) {
    var st = probe[url];
    if (st === 'ok') return true;
    if (st) return false;          // 'bad' หรือ 'wait'
    probe[url] = 'wait';
    var im = new Image();
    im.onload = function () { probe[url] = 'ok'; };
    im.onerror = function () { probe[url] = 'bad'; };
    im.src = url;
    return false;                  // รอบแรกยังไม่รู้ -> ใช้ไอคอนเดิมก่อน รอบรีเฟรชถัดไปจะได้รูป
  }

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
    if (!hasNoImg(sid)) {
      var url = IMG_DIR + (FILE[sid] || sid) + '_i.png?v=' + IMG_VER;
      if (imgOk(url)) out.img = url;
    }
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
