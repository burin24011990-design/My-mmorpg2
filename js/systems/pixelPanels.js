/* Pixel RPG panels: สถานะ / อุปกรณ์ / สกิล
 *   PixelPanels.setData(() => ({ ...ข้อมูลจริงของเกม... }));
 *   PixelPanels.addDataHook(d => d2);   // ดักแก้ข้อมูลก่อนวาด (ใช้ใน skillLevelPatch.js)
 *   PixelPanels.toggle('status' | 'equip' | 'skills');
 *   PixelPanels.closeAll();
 * events: window 'pp:useSkill' {id} | 'pp:upgradeSkill' {id} | 'pp:slot' {slot} | 'pp:reset'
 * ฟิลด์เสริมของสกิล (ถ้ามี จะแสดงเลเวลและปุ่มอัป): lv, maxLv, books, need, maxed
 */
(function () {
  var layer = document.getElementById('ui-layer') || document.body;

  var demo = function () {
    return {
      name: 'Kurokitsune', level: 48, title: 'Nine-Tailed Shadow', guild: 'DarkMoon',
      portrait: '', character: '',
      hp: [4820, 4820], mp: [1360, 1360], exp: 32.7,
      stats: { 'พลังโจมตี': 1245, 'พลังป้องกัน': 742, 'พลังเวท': 683,
               'ความเร็วโจมตี': 1.32, 'คริติคอล': '18.5%', 'หลบหลีก': '7.2%' },
      statPoints: 0,
      equipment: {
        weapon:{icon:'🗡️',plus:9,rarity:'epic'}, armor:{icon:'🥋',plus:9,rarity:'epic'},
        legs:{icon:'👖',plus:9,rarity:'epic'},  boots:{icon:'👢',plus:9,rarity:'epic'},
        helm:{icon:'🐺',plus:9,rarity:'epic'},  gloves:{icon:'🧤',plus:9,rarity:'epic'},
        cape:{icon:'🧣',plus:9,rarity:'rare'},  amulet:{icon:'📿',plus:7,rarity:'legend'},
        bag:{icon:'🎒',rarity:'legend'}, relic:null, ring:{icon:'💍',rarity:'legend'}
      },
      skills: [
        { id:'s1', name:'จันทร์พิฆาต', lv:5, mp:120, icon:'🌙' },
        { id:'s2', name:'เงาจันทรา',   lv:4, mp:90,  icon:'👤' },
        { id:'s3', name:'กระชั้นหางเก้าชั้น', lv:3, mp:150, icon:'🦊' },
        { id:'s4', name:'ความมืดครอบงำ', lv:2, mp:200, icon:'🌑' }
      ],
      specialSkills: [],
      passives: [ { name:'วิญญาณจิ้งจอก', desc:'เพิ่มพลังโจมตีและอัตราคริติคอล', icon:'🔥' } ]
    };
  };
  var getter = demo;
  var hooks = [];

  // ข้อมูลที่ใช้วาดจริง = ข้อมูลจากเกม ผ่าน hook ทุกตัว (hook พังก็ข้าม ไม่ให้หน้าต่างล่ม)
  function getData() {
    var d = getter();
    hooks.forEach(function (h) {
      try { var r = h(d); if (r) d = r; } catch (e) { console.error('PixelPanels hook error', e); }
    });
    return d;
  }

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function fmt(n){ return typeof n === 'number' ? n.toLocaleString('en-US') : esc(n); }
  function icon(v){ return /^(https?:|\/|\.|data:)/.test(v || '') ? '<img src="' + esc(v) + '">' : esc(v || ''); }
  function slot(key, it){
    var cls = 'pp-slot' + (it ? (it.rarity ? ' r-' + it.rarity : '') : ' empty');
    return '<div class="' + cls + '" data-slot="' + key + '">' + (it ? icon(it.icon) + (it.plus ? '<em>+' + it.plus + '</em>' : '') : '＋') + '</div>';
  }

  var state = { statusTab: 'basic', skillTab: 'general' };

  function skillRow(s) {
    var hasLv = s.maxLv != null;
    var sub = s.info ? esc(s.info) : 'Lv. ' + s.lv;
    var lvBadge = hasLv ? ' <span style="color:#ffe066;font-size:.8em">Lv.' + s.lv + '/' + s.maxLv + '</span>' : '';
    var bookLine = hasLv
      ? '<br><span style="color:#9fd0ff">📕 หนังสือ ' + s.books + (s.maxed ? '' : '/' + s.need) + ' เล่ม</span>'
      : '';
    var useBtn = s.off
      ? '<button class="pp-btn" disabled>ยังไม่ได้ใส่</button>'
      : '<button class="pp-btn" data-skill="' + esc(s.id) + '">ใช้งาน</button>';
    var upBtn = '';
    if (hasLv) {
      upBtn = s.maxed
        ? '<button class="pp-btn" disabled>MAX</button>'
        : '<button class="pp-btn" data-upg="' + esc(s.id) + '"' + (s.books >= s.need ? '' : ' disabled') + '>อัปเลเวล</button>';
    }
    var btns = hasLv
      ? '<div style="display:flex;flex-direction:column;gap:6px">' + useBtn + upBtn + '</div>'
      : useBtn;
    return '<div class="pp-skill"><div class="pp-slot">' + icon(s.icon) + '</div>' +
      '<div><h4>' + esc(s.name) + lvBadge + '</h4><small>' + sub + '<br><span class="mp">ใช้ MP ' + s.mp + '</span>' + bookLine + '</small></div>' +
      btns + '</div>';
  }
  var views = {
    status: function (d) {
      var menu = [['basic','ข้อมูลพื้นฐาน'],['stat','สเตตัส'],['equip','อุปกรณ์'],['skill','สกิล']];
      var rows = '<div class="pp-row"><span>❤️ HP</span><b>' + fmt(d.hp[0]) + ' / ' + fmt(d.hp[1]) + '</b></div>' +
                 '<div class="pp-row"><span>💧 MP</span><b>' + fmt(d.mp[0]) + ' / ' + fmt(d.mp[1]) + '</b></div>';
      Object.keys(d.stats || {}).forEach(function (k) { rows += '<div class="pp-row"><span>' + esc(k) + '</span><b>' + fmt(d.stats[k]) + '</b></div>'; });
      return '<div class="pp-status"><div class="pp-left">' +
        '<div class="pp-portrait">' + (d.portrait ? icon(d.portrait) : '🦊') + '</div>' +
        '<div class="pp-menu">' + menu.map(function (m) { return '<button data-go="' + m[0] + '" class="' + (state.statusTab === m[0] ? 'on' : '') + '">' + m[1] + '</button>'; }).join('') + '</div>' +
        '</div><div>' +
        '<div class="pp-name">' + esc(d.name) + '</div><div>Lv. ' + d.level + '</div>' +
        '<div class="pp-title">' + esc(d.title) + '</div>' +
        '<div class="pp-sub2">กิลด์ : ' + esc(d.guild) + '</div>' +
        '<div class="pp-bar xp"><i style="width:' + Math.max(0, Math.min(100, d.exp)) + '%"></i><b>EXP ' + d.exp + '%</b></div>' +
        '<div class="pp-stats">' + rows + '</div>' +
        '<div class="pp-pts"><span>แต้มสกิลที่เหลือ : ' + (d.statPoints || 0) + '</span><button class="pp-btn" data-act="reset">รีเซ็ต</button></div>' +
        '</div></div>';
    },

    equip: function (d) {
      var e = d.equipment || {};
      return '<div class="pp-tabs"><button data-tab="stat">ค่าสถานะ</button><button class="on">อุปกรณ์</button></div>' +
        '<div class="pp-equip">' +
          '<div class="pp-col">' + ['weapon','armor','legs','boots'].map(function (k) { return slot(k, e[k]); }).join('') + '</div>' +
          '<div class="pp-char">' + (d.character ? icon(d.character) : '🦊') + '</div>' +
          '<div class="pp-col">' + ['helm','gloves','cape','amulet'].map(function (k) { return slot(k, e[k]); }).join('') + '</div>' +
        '</div>' +
        '<div class="pp-bottom">' + ['bag','relic','ring'].map(function (k) { return slot(k, e[k]); }).join('') + '</div>';
    },

    skills: function (d) {
      var g = state.skillTab === 'general';
      var out = '<div class="pp-tabs"><button data-stab="general" class="' + (g ? 'on' : '') + '">สกิลทั่วไป</button>' +
                '<button data-stab="special" class="' + (g ? '' : 'on') + '">สกิลพิเศษ</button></div>';
      var list = (g ? d.skills : d.specialSkills) || [];
      if (!list.length) out += '<div class="pp-empty">ยังไม่มีสกิล</div>';
      list.forEach(function (s) { out += skillRow(s); });
      if (g && (d.passives || []).length) {
        out += '<div class="pp-sub">สกิลติดตัว</div>';
        d.passives.forEach(function (s) {
          out += '<div class="pp-skill pp-passive"><div class="pp-slot r-epic">' + icon(s.icon) + '</div>' +
            '<div><h4>' + esc(s.name) + '</h4><small>' + esc(s.desc) + '</small></div>' +
            '<button class="pp-btn green" disabled>ติดตัว</button></div>';
        });
      }
      return out;
    }
  };

  var meta = {
    status: { title: 'ตัวละคร', ico: '🦊' },
    equip:  { title: 'อุปกรณ์', ico: '🎒' },
    skills: { title: 'สกิล',   ico: '✨' }
  };

  var wins = {};
  function ensure(name) {
    if (wins[name]) return wins[name];
    var w = document.createElement('div');
    w.className = 'pp-win';
    w.innerHTML = '<div class="pp-head"><span class="pp-ico">' + meta[name].ico + '</span><h2>' + meta[name].title +
                  '</h2><button class="pp-x" aria-label="ปิด">✕</button></div><div class="pp-body"></div>';
    layer.appendChild(w);
    w.querySelector('.pp-x').addEventListener('click', function () { api.close(name); });

    w.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-skill],[data-upg],[data-slot],[data-go],[data-tab],[data-stab],[data-act]');
      if (!t) return;
      if (t.dataset.skill) window.dispatchEvent(new CustomEvent('pp:useSkill', { detail: { id: t.dataset.skill } }));
      else if (t.dataset.upg) window.dispatchEvent(new CustomEvent('pp:upgradeSkill', { detail: { id: t.dataset.upg } }));
      else if (t.dataset.slot) window.dispatchEvent(new CustomEvent('pp:slot', { detail: { slot: t.dataset.slot } }));
      else if (t.dataset.act === 'reset') window.dispatchEvent(new CustomEvent('pp:reset'));
      else if (t.dataset.stab) { state.skillTab = t.dataset.stab; render('skills'); }
      else if (t.dataset.go) {
        var go = t.dataset.go; state.statusTab = go;
        if (go === 'equip') { api.close('status'); api.open('equip'); }
        else if (go === 'skill') { api.close('status'); api.open('skills'); }
        else render('status');
      }
      else if (t.dataset.tab === 'stat') { api.close('equip'); api.open('status'); }
    });
    ['pointerdown','touchstart','touchmove','mousedown'].forEach(function (evn) {
      w.addEventListener(evn, function (e) { e.stopPropagation(); }, { passive: true });
    });
    return (wins[name] = w);
  }

  function render(name) {
    var w = ensure(name), body = w.querySelector('.pp-body'), top = body.scrollTop;
    body.innerHTML = views[name](getData());
    body.scrollTop = top;
  }

  // รีเฟรชอัตโนมัติทุก 1 วิ ขณะเปิด (HP/MP/EXP อัปเดตสด)
  setInterval(function () { api.refresh(); }, 1000);

  var api = {
    setData: function (fn) { getter = typeof fn === 'function' ? fn : function () { return fn; }; },
    addDataHook: function (fn) { if (typeof fn === 'function') hooks.push(fn); },
    open: function (name) {
      api.closeAll();                       // เปิดทีละหน้าต่าง ไม่ซ้อนกัน
      render(name); wins[name].classList.add('open');
    },
    close: function (name) { if (wins[name]) wins[name].classList.remove('open'); },
    closeAll: function () { Object.keys(wins).forEach(api.close); },
    isOpen: function () { return Object.keys(wins).some(function (n) { return wins[n].classList.contains('open'); }); },
    toggle: function (name) { (wins[name] && wins[name].classList.contains('open')) ? api.close(name) : api.open(name); },
    refresh: function () { Object.keys(wins).forEach(function (n) { if (wins[n].classList.contains('open')) render(n); }); }
  };
  window.PixelPanels = api;
})();
