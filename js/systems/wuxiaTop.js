// wuxiaTop.js v2 - wuxia icons for Phaser canvas buttons (top bar, shop, cash shop, attack, dash)
// Load AFTER hudLayout.js / aimDash.js / shop.js and before main.js. Single file, ASCII only.
(function () {
  'use strict';
  var DATA = window.WX_PD || {};   // image data comes from wxd1..wxd4.js (loaded before this file)
  var KEYMAP = {"tb_bag":"bag","tb_scroll":"skill","tb_bot":"bot","tb_gear":"settings","tb_shield":"equip","tb_map":"stage","tb_chart":"status","tb_cash":"cashshop","tb_shop":"shop"};   // topbar texture key -> image
  var EXTRA = {"wx_attack":"attack","wx_dash":"dash"};    // extra texture key -> image (attack / dash buttons)

  var IMGS = {};
  Object.keys(DATA).forEach(function (k) { var i = new Image(); i.src = DATA[k]; IMGS[k] = i; });
  function ready(n) { var im = IMGS[n]; return !!(im && im.complete && im.naturalWidth > 0); }
  function allReady() {
    return Object.keys(KEYMAP).every(function (t) { return ready(KEYMAP[t]); }) &&
           Object.keys(EXTRA).every(function (t) { return ready(EXTRA[t]); });
  }

  function combat(sc, time) {
    if (!sc.textures.exists('wx_attack')) return;
    var ab = sc.attackBtn, ai = sc.attackIcon, i, o;
    if (ab && ab.c && ai) {
      if (!ab.__wx) {
        ab.__wx = 1;
        ab.c.setFillStyle(0xcf3d3d, 0.001);
        ab.c.setStrokeStyle();
        var list = sc.children.list.slice();
        for (i = 0; i < list.length; i++) {          // hide the thin inner ring
          o = list[i];
          if (o !== ab.c && o.type === 'Arc' && o.x === ab.c.x && o.y === ab.c.y && o.radius < ab.c.radius && o.radius > ab.c.radius * 0.7) o.setVisible(false);
        }
      }
      var s = Math.round(ab.c.radius * 2 * 1.18);
      var cl = ((sc.cdEnd && sc.cdEnd.basic) || 0) - time;
      ai.setTexture('wx_attack').setDisplaySize(s, s).setPosition(ab.c.x, ab.c.y).setAlpha(cl > 0 ? 0.55 : 1).setDepth(100.6);
      if (ab.t) ab.t.setColor('#ffe9a8').setDepth(101);
    }
    var db = sc.dashBtn;
    if (db && db.c && db.icon) {
      if (!db.__wx) { db.__wx = 1; db.c.setFillStyle(0x3a7bd5, 0.001); db.c.setStrokeStyle(); }
      var ds = Math.round(db.c.radius * 2 * 1.25);
      var dl = ((sc.cdEnd && sc.cdEnd.dash) || 0) - time;
      db.icon.setTexture('wx_dash').setDisplaySize(ds, ds).setPosition(db.c.x, db.c.y).setAlpha(dl > 0 ? 0.5 : 1).setDepth(100.6);
      if (db.t) { db.t.setColor('#ffe9a8').setDepth(101); }
    }
  }

  function install() {
    if (typeof Main === 'undefined' || !Main.prototype || !Main.prototype.makeTopIcons || !Main.prototype.makeTopBtn) return false;
    if (Main.prototype.__wxTop) return true;
    Main.prototype.__wxTop = true;
    var origIcons = Main.prototype.makeTopIcons;
    var origBtn = Main.prototype.makeTopBtn;
    var origUSB = Main.prototype.updateSkillButtons;

    Main.prototype.makeTopIcons = function () {
      if (allReady()) {
        var self = this;
        if (!this.textures.exists('tb_bag')) {
          Object.keys(KEYMAP).forEach(function (tk) { try { self.textures.addImage(tk, IMGS[KEYMAP[tk]]); } catch (e) {} });
        }
        Object.keys(EXTRA).forEach(function (tk) {
          if (!self.textures.exists(tk)) { try { self.textures.addImage(tk, IMGS[EXTRA[tk]]); } catch (e) {} }
        });
      }
      return origIcons.call(this);
    };

    Main.prototype.makeTopBtn = function (x, y, w, h, iconKey, label, color, onClick, big) {
      if (!KEYMAP[iconKey] || !this.textures.exists(iconKey)) return origBtn.apply(this, arguments);
      var cx = x + w / 2, cy = y + h / 2;
      var compact = h < 52;
      var bg = this.add.graphics().setScrollFactor(0).setDepth(98);
      var draw = function (down) {
        bg.clear();
        if (down) { bg.fillStyle(0xffd45c, 0.22); bg.fillRoundedRect(x, y, w, h, 10); }
      };
      draw(false);
      var c = this.add.rectangle(cx, cy, w, h, color, 0.01).setScrollFactor(0).setDepth(99).setInteractive();
      var isz = Math.round(Math.min(w, h) * (big ? 1.0 : (compact ? 0.92 : 0.88)));
      var iy = cy - (compact ? Math.round(h * 0.07) : (big ? 6 : 4));
      var icon = this.add.image(cx, iy, iconKey).setDisplaySize(isz, isz).setScrollFactor(0).setDepth(101);
      var t = this.add.text(cx, y + h - (compact ? 6 : (big ? 9 : 8)), label, {
        fontFamily: 'Mitr, sans-serif', fontSize: compact ? '8px' : (big ? '14px' : '10px'),
        color: '#ffe9a8', stroke: '#2a0a0a', strokeThickness: compact ? 3 : 4
      }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
      c.on('pointerdown', function () { draw(true); icon.setAlpha(0.7); onClick(); });
      c.on('pointerup', function () { draw(false); icon.setAlpha(1); });
      c.on('pointerout', function () { draw(false); icon.setAlpha(1); });
      return { c: c, t: t, bg: bg, icon: icon };
    };

    if (origUSB) {
      Main.prototype.updateSkillButtons = function (time) {
        origUSB.apply(this, arguments);
        try { combat(this, time); } catch (e) {}
      };
    }
    return true;
  }

  if (!install()) {
    var n = 0, iv = setInterval(function () { if (install() || ++n > 100) clearInterval(iv); }, 100);
  }
})();
