/* hudPolish.js — HUD เลือด/มานา/EXP + ป้ายเลเวล แบบสวย (ต่อเข้ากับ Main.updateHud แล้ว)
 * วางที่ js/systems/hudPolish.js และใส่ใน index.html "ก่อน" js/main.js (หลัง statusPanel.js):
 *   <script src="js/systems/hudPolish.js?v=1"></script>
 * ปรับขนาด/ตำแหน่ง: แก้ HP_HUD_X, HP_HUD_Y, HP_HUD_SCALE ด้านล่าง
 */
(function () {
  var HP_HUD_X = 3, HP_HUD_Y = 4;   // ตำแหน่งในพิกัดเกม (มุมซ้ายบน)
  var HP_HUD_SCALE = 1;              // 1 = ปกติ, 1.2 = ใหญ่ขึ้น

  var css = `
  #hp-hud{position:fixed;left:0;top:0;z-index:40;display:none;align-items:flex-start;transform-origin:0 0;
    font-family:'Mitr',sans-serif;pointer-events:none;--gold:#ffd45c;--gold-d:#b8862b;--lac:#26090f;--lac2:#3b1119}
  #hp-hud .seal{position:relative;z-index:2;width:44px;height:44px;flex:none;border-radius:50%;margin-top:3px;
    background:radial-gradient(circle at 35% 28%,#ffe9a6 0,#e8b440 38%,#8a5a12 100%);
    border:2px solid #4a2a06;box-shadow:0 0 0 2px var(--gold),0 3px 8px rgba(0,0,0,.6),inset 0 2px 3px rgba(255,255,255,.55);
    display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
  #hp-hud .seal::after{content:'';position:absolute;inset:3px;border-radius:50%;border:1px dashed rgba(74,42,6,.55)}
  #hp-hud .seal small{font-size:7.5px;font-weight:600;color:#5a3406;letter-spacing:.5px;margin-bottom:1px}
  #hp-hud .seal b{font-size:19px;font-weight:700;color:#2a1203;text-shadow:0 1px 0 rgba(255,236,170,.9)}
  #hp-hud .seal b.s3{font-size:15px}
  #hp-hud .plate{margin-left:-12px;padding:4px 9px 5px 17px;width:128px;box-sizing:content-box;
    background:linear-gradient(180deg,var(--lac2),var(--lac));border:1.5px solid var(--gold-d);
    border-radius:0 12px 12px 0;box-shadow:0 3px 8px rgba(0,0,0,.55),inset 0 0 0 1px rgba(255,212,92,.18)}
  #hp-hud .nm{font-size:10.5px;font-weight:500;color:#ffe9b0;text-shadow:0 1px 2px #000;white-space:nowrap;
    overflow:hidden;text-overflow:ellipsis;max-width:128px;margin-bottom:1px}
  #hp-hud .nm:empty{display:none}
  #hp-hud .bar{position:relative;height:11px;margin-top:2px;border-radius:7px;background:#12060a;border:1px solid #000;
    box-shadow:inset 0 2px 3px rgba(0,0,0,.8),0 0 0 1px rgba(255,212,92,.25);overflow:hidden}
  #hp-hud .bar.sm{height:7px}
  #hp-hud .fill{position:absolute;left:0;top:0;bottom:0;width:100%;border-radius:7px;transition:width .25s ease-out}
  #hp-hud .fill::after{content:'';position:absolute;left:0;right:0;top:0;height:45%;
    background:linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,0));border-radius:7px 7px 0 0}
  #hp-hud .hp .fill{background:linear-gradient(90deg,#8e0f1c,#e5303f 60%,#ff6a5a)}
  #hp-hud .mp .fill{background:linear-gradient(90deg,#123f9a,#2f86f0 60%,#6fd0ff)}
  #hp-hud .xp .fill{background:linear-gradient(90deg,#5b2aa8,#9a5cf0 60%,#d6a8ff)}
  #hp-hud .hp.low .fill{animation:hpPulse .8s infinite alternate}
  @keyframes hpPulse{to{filter:brightness(1.5)}}
  #hp-hud .txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:8.5px;
    font-weight:500;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000}
  #hp-hud .tag{position:absolute;left:4px;top:0;bottom:0;display:flex;align-items:center;font-size:7.5px;
    font-weight:700;color:rgba(255,255,255,.85);text-shadow:0 1px 2px #000}
  #hp-hud .gold{margin-top:3px;display:flex;justify-content:space-between;gap:6px;font-size:9.5px;
    color:#ffe28a;text-shadow:0 1px 2px #000;white-space:nowrap}
  #hp-hud .gold span+span{color:#e8c9c9}
  `;
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var el = document.createElement('div');
  el.id = 'hp-hud';
  el.innerHTML =
    '<div class="seal"><small>LV</small><b id="hh-lv">1</b></div>' +
    '<div class="plate"><div class="nm" id="hh-nm"></div>' +
    '<div class="bar hp" id="hh-hp"><div class="fill"></div><span class="tag">HP</span><span class="txt"></span></div>' +
    '<div class="bar mp" id="hh-mp"><div class="fill"></div><span class="tag">MP</span><span class="txt"></span></div>' +
    '<div class="bar sm xp" id="hh-xp"><div class="fill"></div><span class="txt"></span></div>' +
    '<div class="gold"><span id="hh-g"></span><span id="hh-k"></span></div></div>';
  function mount() { document.body.appendChild(el); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  function setBar(id, v, max, pct) {
    var b = document.getElementById(id); if (!b) return;
    max = Math.max(1, max || 1); v = Math.max(0, Math.min(v || 0, max));
    var p = v / max * 100;
    b.querySelector('.fill').style.width = p + '%';
    b.querySelector('.txt').textContent = pct ? p.toFixed(1) + '%' : Math.floor(v) + ' / ' + Math.floor(max);
    if (id === 'hh-hp') b.classList.toggle('low', p <= 25);
  }
  function setTxt(id, t) { var n = document.getElementById(id); if (n && n.textContent !== t) n.textContent = t; }

  // วางให้ตรงกับมุมซ้ายบนของ canvas (เกมถูกย่อ/ขยายตามจอ) และย่อตามสเกลของ canvas
  function place(scene) {
    var cv = scene.game && scene.game.canvas; if (!cv) return;
    var r = cv.getBoundingClientRect();
    if (!r.width) { el.style.display = 'none'; return; }
    var k = r.width / scene.scale.width * HP_HUD_SCALE;
    var kb = r.width / scene.scale.width;
    el.style.display = 'flex';
    el.style.left = (r.left + HP_HUD_X * kb) + 'px';
    el.style.top = (r.top + HP_HUD_Y * kb) + 'px';
    el.style.transform = 'scale(' + k + ')';
  }

  var frame = 0;
  var _orig = Main.prototype.updateHud;
  Main.prototype.updateHud = function () {
    if (_orig) _orig.apply(this, arguments);           // มินิแมปและส่วนอื่นยังทำงานเหมือนเดิม
    try {
      // ซ่อน HUD เก่า
      if (this.hud) this.hud.clear();
      if (this.hudNameText) this.hudNameText.setVisible(false);
      if (this.hudText) this.hudText.setVisible(false);

      var s = this.stats; if (!s) return;
      var lv = document.getElementById('hh-lv');
      if (lv.textContent !== String(s.level)) { lv.textContent = s.level; lv.className = String(s.level).length >= 3 ? 's3' : ''; }
      // ขั้นจุติเก็บที่ stats.rebirth (rebirth.js) -- แสดงเฉพาะเมื่อจุติแล้ว
      var rbn = Math.floor(s.rebirth || 0);
      setTxt('hh-nm', rbn > 0 ? '☯ จุติ ' + rbn : '');
      setBar('hh-hp', s.hp, this.maxHp());
      setBar('hh-mp', s.mp, this.maxMp());
      setBar('hh-xp', s.exp, s.expNext, true);
      setTxt('hh-g', 'ทอง ' + s.gold);
      setTxt('hh-k', 'ฆ่า ' + (this.kills || 0));
      if (frame++ % 20 === 0) place(this);
    } catch (e) { /* ไม่ให้ HUD ทำเกมค้าง */ }
  };
  window.addEventListener('resize', function () { frame = 0; });
  document.addEventListener('fullscreenchange', function () { frame = 0; });
})();
