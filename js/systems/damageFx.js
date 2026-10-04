// ===== ตัวเลขดาเมจสวย ๆ (v3) =====
// showDamage(scene, x, y, จำนวน, ชนิด, opts)
// ชนิด: 'normal' | 'crit' | 'player' (ผู้เล่นโดนตี) | 'heal' | 'regen' | 'skill'
// opts (ไม่ใส่ก็ได้):
//   { skill: def หรือ id สกิล }  -> ตัวเลขเป็นสีของสกิลนั้น
//   { color: '#ff8800' }        -> กำหนดสีเอง
//   { crit: true }              -> ดาเมจสกิลที่คริติคอล
// ทดสอบดูหน้าตาตัวเลขทุกแบบ: เปิดเกมด้วยลิงก์ที่ต่อท้าย ?fxtest=1 แล้วเริ่มเล่น
//   (จะมีตัวเลขตัวอย่างเด้งขึ้นรอบตัวละครทุก 3 วินาที)
(function () {
  var SCALE = 1.0;   // ตัวคูณขนาดทั้งหมด (ยังเล็กไป -> 1.3 / 1.5)

  var STYLE = {
    normal: { size: 40, fill: '#ffffff', stroke: '#5a0e0e', rise: 64 },
    crit:   { size: 68, fill: '#fff4a8', stroke: '#8a0a0a', rise: 44 },
    skill:  { size: 48, fill: '#ffffff', stroke: '#222222', rise: 74 },
    player: { size: 38, fill: '#ff5a5a', stroke: '#2a0000', rise: 58 },
    heal:   { size: 54, fill: '#7dff9a', stroke: '#06401a', rise: 76 },
    regen:  { size: 42, fill: '#9dffb0', stroke: '#06401a', rise: 60 }
  };

  // สีตามกรอบปุ่มสกิล (แก้ได้ตามใจ) — ค้นหาจาก id สกิล ก่อน แล้วค่อยดูตัวนำหน้า
  var SKILL_COLORS = {
    // เมจ
    mg_fire: '#ff5a2a', mg_ice: '#5ad4ff', mg_nova: '#b57cff', mg_bolt: '#ffe94a',
    'ระเบิดมหาเวท': '#ff7bd5',
    // นักดาบ
    sw_slash: '#ffa43a', sw_dash: '#ffd45c', sw_cross: '#ff7a3a', sw_spin: '#ff5a5a',
    'ดาบสังหาร': '#ff3a3a',
    // นักธนู
    ar_rain: '#9be15d', ar_shot: '#7dff6a', ar_multi: '#4dffb0', ar_pierce: '#d6ff5a',
    'ธนูทลวงฟ้า': '#3affd0',
    // โจร
    rg_slow: '#c07bff', rg_drain: '#ff4a6a', rg_vanish: '#8a6bff', rg_dash: '#d66bff',
    'พายุใบมีด': '#ff2a9a'
  };
  var PREFIX_COLORS = { sw_: '#ffa43a', mg_: '#4fc3ff', ar_: '#7dff6a', rg_: '#d66bff', pr_: '#ffe27a' };
  var TYPE_COLORS = { holy: '#ffe27a', pulti: '#fff2a8', healaoe: '#7dff9a', heal1: '#7dff9a' };   // สกิลสายพระ (ดูจาก def.type)
  var DEFAULT_SKILL = '#4fc3ff';

  function toHex(c) {
    if (typeof c === 'number') return '#' + ('000000' + c.toString(16)).slice(-6);
    return c;
  }
  function skillColor(sk) {
    if (!sk) return null;
    var id = sk;
    if (typeof sk === 'object') {
      if (sk.color) return toHex(sk.color);
      id = sk.id || sk.name;
      if (!SKILL_COLORS[id] && sk.type && TYPE_COLORS[sk.type]) return TYPE_COLORS[sk.type];
    }
    if (SKILL_COLORS[id]) return SKILL_COLORS[id];
    for (var p in PREFIX_COLORS) if (String(id).indexOf(p) === 0) return PREFIX_COLORS[p];
    return DEFAULT_SKILL;
  }
  function shade(hex, f) {   // f < 1 = เข้มขึ้น
    var n = parseInt(hex.replace('#', ''), 16);
    var r = Math.min(255, ((n >> 16) & 255) * f), g = Math.min(255, ((n >> 8) & 255) * f), b = Math.min(255, (n & 255) * f);
    return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
  }
  function toInt(hex) { return parseInt(hex.replace('#', ''), 16); }

  // ดาวระเบิดหลังตัวเลขคริติคอล (สไตล์ Ragnarok): กรอบนอกสีแดง + ดาวในสีส้ม/สีสกิล
  function drawCritStar(scene, R, innerHex) {
    var g = scene.add.graphics();
    function star(radius, spikes, innerRatio, jitter) {
      var pts = [];
      for (var i = 0; i < spikes * 2; i++) {
        var a = (Math.PI * i) / spikes - Math.PI / 2;
        var r = (i % 2 === 0) ? radius * (1 - jitter + Math.random() * jitter * 2) : radius * innerRatio;
        pts.push(new Phaser.Math.Vector2(Math.cos(a) * r * 1.2, Math.sin(a) * r * 0.85));
      }
      return pts;
    }
    // กรอบนอก (แดงเข้ม ขอบดำ)
    var outer = star(R, 12, 0.52, 0.12);
    g.fillStyle(0xd80d0d, 0.95); g.lineStyle(5, 0x4a0000, 1);
    g.fillPoints(outer, true); g.strokePoints(outer, true);
    // ดาวใน (ส้ม/สีสกิล)
    var inner = star(R * 0.74, 12, 0.55, 0.06);
    g.fillStyle(toInt(innerHex), 0.95); g.lineStyle(3, 0xa01010, 1);
    g.fillPoints(inner, true); g.strokePoints(inner, true);
    return g;
  }

  window.showDamage = function (scene, x, y, amount, kind, opts) {
    if (!scene || !scene.add) return null;
    opts = opts || {};
    kind = kind || 'normal';

    var color = opts.color || skillColor(opts.skill);
    var isCrit = (kind === 'crit') || !!opts.crit;
    if (kind === 'normal' && color) kind = 'skill';            // มี skill แนบมา = ดาเมจสกิล
    var s = STYLE[isCrit ? 'crit' : kind] || STYLE.normal;
    var fill = s.fill, stroke = s.stroke, glow = '#000000';

    if (color && !isCrit) { fill = color; stroke = shade(color, 0.28); glow = color; }   // ดาเมจสกิล: สีสกิล
    if (isCrit && color) { glow = color; }

    var size = Math.round(s.size * SCALE);
    var txt = (kind === 'heal' || kind === 'regen' ? '+' : '') + Math.round(amount);
    if (isCrit) txt = txt + '!';

    var cont = scene.add.container(x + Phaser.Math.Between(-14, 14), y).setDepth(99999);

    var star = null;
    if (isCrit) {
      star = drawCritStar(scene, size * 1.05, color || '#ff9a1a');
      cont.add(star);
    }

    var t = scene.add.text(0, 0, txt, {
      _fxOwn: true,
      fontFamily: 'Mitr, sans-serif',
      fontSize: size + 'px',
      fontStyle: '700',
      color: fill,
      stroke: stroke,
      strokeThickness: Math.max(5, Math.round(size / 4.2))
    }).setOrigin(0.5);
    t.setShadow(0, 3, glow, color ? 10 : 4, true, true);
    t.setResolution(2);   // คมชัดบนจอมือถือ
    cont.add(t);

    cont.setScale(0.25);

    if (isCrit) {
      // คริ: ระเบิดใหญ่ -> ค้างนิดหนึ่ง -> ดาวจางและขยาย -> ตัวเลขลอยขึ้น
      try { scene.cameras.main.shake(70, 0.0025); } catch (e) {}
      star.setRotation(Phaser.Math.FloatBetween(-0.15, 0.15));
      scene.tweens.add({
        targets: cont, scale: 1.55, duration: 110, ease: 'Back.easeOut',
        onComplete: function () { if (cont.active) scene.tweens.add({ targets: cont, scale: 1.25, duration: 120 }); }
      });
      scene.tweens.add({ targets: star, alpha: 0, scale: 1.35, delay: 450, duration: 350 });
      scene.tweens.add({ targets: cont, y: cont.y - s.rise, duration: 1200, ease: 'Cubic.easeOut' });
      scene.tweens.add({ targets: cont, alpha: 0, delay: 850, duration: 400, onComplete: function () { cont.destroy(); } });
    } else {
      scene.tweens.add({
        targets: cont, scale: 1.15, duration: 140, ease: 'Back.easeOut',
        onComplete: function () { if (cont.active) scene.tweens.add({ targets: cont, scale: 1, duration: 100 }); }
      });
      scene.tweens.add({
        targets: cont, y: cont.y - s.rise, x: cont.x + Phaser.Math.Between(-10, 10),
        duration: 900, ease: 'Cubic.easeOut'
      });
      scene.tweens.add({ targets: cont, alpha: 0, delay: 550, duration: 400, onComplete: function () { cont.destroy(); } });
    }
    return cont;
  };

  // ===== ดักตัวเลขฮีล/รีเจนที่ไฟล์อื่นสร้างเอง (ข้อความรูปแบบ "+25") แล้วปรับให้ใหญ่ชัด =====
  // ถ้าไม่ต้องการ ตั้ง RESTYLE_PLUS_TEXT = false
  var RESTYLE_PLUS_TEXT = true;
  var HEAL_SIZE = 40, HEAL_COLOR = '#8dffa5', HEAL_STROKE = '#06401a';
  try {
    var GOF = Phaser.GameObjects.GameObjectFactory;
    if (RESTYLE_PLUS_TEXT && GOF && !GOF.prototype._plusPatched) {
      var origText = GOF.prototype.text;
      GOF.prototype.text = function (x, y, text, style) {
        var t = origText.apply(this, arguments);
        try {
          if (!(style && style._fxOwn) && /^\+\s?\d[\d,]*$/.test(String(text))) {
            t.setFontFamily('Mitr, sans-serif');
            t.setFontSize(HEAL_SIZE);
            t.setFontStyle('700');
            t.setColor(HEAL_COLOR);
            t.setStroke(HEAL_STROKE, 7);
            t.setShadow(0, 3, '#000000', 4, true, true);
            t.setResolution(2);
          }
        } catch (e) {}
        return t;
      };
      GOF.prototype._plusPatched = true;
    }
  } catch (e) { console.warn('damageFx: patch +N text failed', e); }

  // ===== โหมดทดสอบ: เปิดเกมด้วย ?fxtest=1 =====
  if (/[?&]fxtest=1/.test(location.search)) {
    setInterval(function () {
      try {
        var g = Phaser.GAMES && Phaser.GAMES[0];
        var sc = g && g.scene.getScenes(true)[0];
        if (!sc || !sc.player) return;
        var x = sc.player.x, y = sc.player.y - 70;
        showDamage(sc, x - 160, y, 405, 'normal');
        showDamage(sc, x - 70, y, 1280, 'skill', { skill: 'mg_fire' });
        showDamage(sc, x + 60, y, 2150, 'crit');
        showDamage(sc, x + 170, y, 990, 'crit', { skill: 'mg_ice' });
        showDamage(sc, x - 90, y + 70, 320, 'heal');
        showDamage(sc, x + 100, y + 70, 25, 'regen');
      } catch (e) {}
    }, 3000);
  }

  window.DamageFx = { SKILL_COLORS: SKILL_COLORS, PREFIX_COLORS: PREFIX_COLORS, skillColor: skillColor };
})();
