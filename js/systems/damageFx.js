// ===== ตัวเลขดาเมจสวย ๆ (v2) =====
// showDamage(scene, x, y, จำนวน, ชนิด, opts)
// ชนิด: 'normal' | 'crit' | 'player' (ผู้เล่นโดนตี) | 'heal' | 'regen' | 'skill'
// opts (ไม่ใส่ก็ได้):
//   { skill: def หรือ id สกิล }  -> ตัวเลขเป็นสีของสกิลนั้น (ใช้กับ 'skill' หรือ 'crit' ก็ได้)
//   { color: '#ff8800' }        -> กำหนดสีเอง
//   { crit: true }              -> ดาเมจสกิลที่คริติคอล (ดาวระเบิดสีของสกิล)
// ตัวอย่าง:
//   showDamage(scene, e.x, e.y, 405, 'skill', { skill: def });
//   showDamage(scene, e.x, e.y, 810, 'crit');
//   showDamage(scene, e.x, e.y, 810, 'crit', { skill: def });
(function () {
  var SCALE = 1.0;   // ตัวคูณขนาดทั้งหมด (ยังเล็กไป -> 1.3 / 1.5)

  var STYLE = {
    normal: { size: 34, fill: '#ffffff', stroke: '#5a0e0e', rise: 60 },
    crit:   { size: 56, fill: '#fff4a8', stroke: '#c03000', rise: 40 },
    skill:  { size: 42, fill: '#ffffff', stroke: '#222222', rise: 70 },
    player: { size: 32, fill: '#ff5a5a', stroke: '#2a0000', rise: 55 },
    heal:   { size: 44, fill: '#6dff8a', stroke: '#0a4a1a', rise: 70 },
    regen:  { size: 34, fill: '#9dffb0', stroke: '#0a4a1a', rise: 55 }
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

  // ดาวระเบิดหลังตัวเลขคริติคอล (สไตล์ Ragnarok)
  function drawStar(scene, R, colorHex) {
    var g = scene.add.graphics();
    var pts = [], spikes = 12;
    for (var i = 0; i < spikes * 2; i++) {
      var a = (Math.PI * i) / spikes - Math.PI / 2;
      var r = (i % 2 === 0) ? R * (0.95 + Math.random() * 0.25) : R * 0.55;
      pts.push(new Phaser.Math.Vector2(Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.85));
    }
    g.fillStyle(toInt(colorHex), 0.92);
    g.lineStyle(4, toInt(shade(colorHex, 0.55)), 1);
    g.fillPoints(pts, true);
    g.strokePoints(pts, true);
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

    if (color) {   // ดาเมจสกิล: ตัวเลขสีสกิล ขอบเข้ม เรืองแสง
      if (isCrit) { fill = '#ffffff'; stroke = shade(color, 0.45); }
      else { fill = color; stroke = shade(color, 0.28); }
      glow = color;
    }

    var size = Math.round(s.size * SCALE);
    var txt = (kind === 'heal' || kind === 'regen' ? '+' : '') + Math.round(amount);
    if (isCrit) txt = txt + '!';

    var cont = scene.add.container(x + Phaser.Math.Between(-14, 14), y).setDepth(99999);

    var star = null;
    if (isCrit) {
      star = drawStar(scene, size * 1.15, color ? shade(color, 1.0) : '#ffd23c');
      cont.add(star);
    }

    var t = scene.add.text(0, 0, txt, {
      fontFamily: 'Mitr, sans-serif',
      fontSize: size + 'px',
      fontStyle: '700',
      color: fill,
      stroke: stroke,
      strokeThickness: Math.max(4, Math.round(size / 4.5))
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
        targets: cont, scale: 1.6, duration: 110, ease: 'Back.easeOut',
        onComplete: function () { if (cont.active) scene.tweens.add({ targets: cont, scale: 1.25, duration: 120 }); }
      });
      scene.tweens.add({ targets: star, alpha: 0, scale: 1.35, delay: 300, duration: 350 });
      scene.tweens.add({ targets: cont, y: cont.y - s.rise, duration: 1100, ease: 'Cubic.easeOut' });
      scene.tweens.add({ targets: cont, alpha: 0, delay: 750, duration: 400, onComplete: function () { cont.destroy(); } });
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

  window.DamageFx = { SKILL_COLORS: SKILL_COLORS, PREFIX_COLORS: PREFIX_COLORS, skillColor: skillColor };
})();
