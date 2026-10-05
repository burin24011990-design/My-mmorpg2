// ===== ฉากเมืองเริ่มต้น (Town) v2 =====
// ไฟล์: js/systems/town.js  (โหลดก่อน js/main.js)
// - เริ่มเกมที่เมือง -> ประตูเมือง/ผู้นำทางบอส พาเข้าฉาก Main
// - ในฉากล่ามอนมีปุ่ม "🏠 เมือง" กดแล้ว "พัก" Main ไว้ (ข้อมูลตัวละคร/กระเป๋าไม่หาย) แล้วเข้าเมือง
// - ไม่ต้องแก้ scenes/Main.js

const TOWN = { w: 1600, h: 1000, spawnX: 800, spawnY: 620, speed: 260 };

// ปุ่มกลับเมืองในฉากล่ามอน: ถ้าไปทับ UI อื่น ให้แก้ตำแหน่งตรงนี้
const TOWN_BTN_CSS = 'position:fixed;left:8px;top:8px;z-index:9000;';

const TOWN_NPCS = [
  { id: 'pvp',    name: 'ผู้ดูแลสนามประลอง', title: 'ห้อง PvP',          x: 420,  y: 330, color: 0xe05555, icon: '⚔️' },
  { id: 'market', name: 'พ่อค้าตลาดกลาง',   title: 'ตลาดกลาง',          x: 1180, y: 330, color: 0xf0c040, icon: '🏪' },
  { id: 'trade',  name: 'นายหน้าแลกเปลี่ยน', title: 'แลกเปลี่ยนไอเทม',   x: 420,  y: 720, color: 0x55b0e0, icon: '🔄' },
  { id: 'boss',   name: 'ผู้นำทางบอสโลก',   title: 'บอสโลก (เร็วๆ นี้)',        x: 1180, y: 720, color: 0xa060e0, icon: '👹' },
  { id: 'gate',   name: 'ประตูเมือง',       title: 'ออกไปล่ามอนสเตอร์', x: 800,  y: 930, color: 0x6fcf6f, icon: '🚪' },
];

const TOWN_TEXT = {
  pvp:    'ยินดีต้อนรับสู่สนามประลอง! ระบบ PvP กำลังเตรียมเปิด',
  market: 'ตลาดกลางสำหรับซื้อขายไอเทมระหว่างผู้เล่น กำลังเตรียมเปิด',
  trade:  'แลกเปลี่ยนไอเทมกับผู้เล่นคนอื่นได้ที่นี่ กำลังเตรียมเปิด',
  boss:   'บอสโลกกำลังจะมาเร็วๆ นี้! ต้องใช้กุญแจเปิดประตู และรวมปาร์ตี้ 10 คนขึ้นไป โปรดรอการอัปเดต',
  gate:   'พร้อมออกไปล่ามอนสเตอร์แล้วหรือยัง?',
};

// ผูกระบบจริงทีหลัง เช่น TownHooks.market = function (scene) { ... };
window.TownHooks = window.TownHooks || {};

// ----- ตัวช่วยอ่านค่าจากฉาก Main (ไม่รู้ชื่อตัวแปรแน่ชัด จึงลองหลายชื่อ) -----
function townMainScene(game) {
  return game.scene.scenes.find(function (s) { return !(s instanceof Town); });
}
function townPlayerLevel(m) {
  if (!m) return null;
  const c = [m.stats && m.stats.level, m.stats && m.stats.lv, m.level, m.lv];
  for (let i = 0; i < c.length; i++) if (typeof c[i] === 'number') return c[i];
  return null;                                   // อ่านไม่ได้ = ไม่ล็อกเลเวล
}
function townStageOk(m, idx) {
  const z = (typeof ZONES !== 'undefined') ? ZONES[idx] : null;
  const lv = townPlayerLevel(m);
  return !(z && lv !== null && lv < z.reqLv);
}
function townEnterStage(m, idx) {
  if (!m || idx == null || typeof m.loadStage !== 'function') return;
  if (!townStageOk(m, idx)) return;
  try { m.loadStage(idx); } catch (e) { console.warn('loadStage failed', e); }
}

// ----- ครอบ Main.create: ไปด่านที่เลือกจากเมือง + ใส่ปุ่มกลับเมือง -----
(function patchMainForTown() {
  const target = (typeof Main === 'function') ? Main.prototype : Main;
  const origCreate = target.create;
  target.create = function () {
    if (origCreate) origCreate.apply(this, arguments);
    try {
      const want = window.TOWN_NEXT_STAGE;
      window.TOWN_NEXT_STAGE = null;
      if (want > 0) townEnterStage(this, want);

      if (!document.getElementById('btn-to-town')) {
        const b = document.createElement('button');
        b.id = 'btn-to-town';
        b.textContent = '🏠 เมือง';
        b.style.cssText = TOWN_BTN_CSS + 'font-family:Mitr,sans-serif;font-size:14px;padding:6px 12px;' +
          'border-radius:10px;border:2px solid #ffd45c;background:#26090fcc;color:#ffe28a;cursor:pointer;touch-action:manipulation';
        const scene = this;
        b.addEventListener('click', function () {
          const ui = document.getElementById('ui-layer');
          if (ui) ui.style.display = 'none';
          b.style.display = 'none';
          scene.scene.pause();                   // พัก Main (state คงเดิม)
          scene.scene.launch('Town');
        });
        document.body.appendChild(b);
      }
    } catch (e) { console.warn('town patch failed', e); }
  };
})();

class Town extends Phaser.Scene {
  constructor() { super('Town'); }

  create() {
    const T = TOWN;
    this.modal = null;
    this.target = null;
    this.pending = null;

    const cam = this.cameras.main;
    cam.setBounds(0, 0, T.w, T.h);
    cam.setBackgroundColor('#1b241b');

    // ----- พื้น / ถนน / ลานกลางเมือง -----
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x3b5a35, 1).fillRect(0, 0, T.w, T.h);
    g.lineStyle(1, 0x30492c, 0.7);
    for (let x = 0; x <= T.w; x += 80) g.lineBetween(x, 0, x, T.h);
    for (let y = 0; y <= T.h; y += 80) g.lineBetween(0, y, T.w, y);
    g.fillStyle(0x7a6e55, 1);
    g.fillRect(T.w / 2 - 40, 0, 80, T.h);
    g.fillRect(0, 460, T.w, 80);
    g.fillStyle(0x8f826a, 1).fillCircle(T.w / 2, 500, 210);
    g.lineStyle(6, 0x5e5340, 1).strokeCircle(T.w / 2, 500, 210);
    g.fillStyle(0x4aa3d8, 1).fillCircle(T.w / 2, 500, 55);
    g.lineStyle(5, 0xcfe9f7, 1).strokeCircle(T.w / 2, 500, 55);

    let seed = 7;
    const rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 70; i++) {
      const x = 40 + rnd() * (T.w - 80), y = 40 + rnd() * (T.h - 80);
      const onRoad = Math.abs(x - T.w / 2) < 70 || (y > 440 && y < 560);
      const inPlaza = Math.hypot(x - T.w / 2, y - 500) < 240;
      const nearNpc = TOWN_NPCS.some(function (n) { return Math.hypot(x - n.x, y - n.y) < 110; });
      if (onRoad || inPlaza || nearNpc) continue;
      const r = 16 + rnd() * 14;
      g.fillStyle(0x5b3a1e, 1).fillRect(x - 4, y, 8, r);
      g.fillStyle(0x2f7a38, 1).fillCircle(x, y - 4, r);
      g.fillStyle(0x3d9647, 0.8).fillCircle(x - r * 0.3, y - r * 0.4, r * 0.55);
    }

    this.add.text(T.w / 2, 60, '🏰 เมืองเริ่มต้น', {
      fontFamily: 'Mitr, sans-serif', fontSize: '34px', color: '#ffe28a', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(5);

    this.npcs = TOWN_NPCS.map(function (n) { return this.makeNpc(n); }, this);

    // ----- ผู้เล่น: ใช้ texture 'player' ของเกมถ้ามี ไม่งั้นใช้วงกลม -----
    this.player = this.add.container(T.spawnX, T.spawnY).setDepth(T.spawnY);
    if (!this.textures.exists('player') && typeof generateTextures === 'function') {
      try { generateTextures(this); } catch (e) {}
    }
    const parts = [];
    const sh = this.add.graphics();
    sh.fillStyle(0x000000, 0.35).fillEllipse(0, 22, 34, 12);
    parts.push(sh);
    if (this.textures.exists('player')) {
      parts.push(this.add.image(0, 0, 'player'));
    } else {
      const b = this.add.graphics();
      b.fillStyle(0x3b6fe0, 1).fillCircle(0, 0, 18);
      b.lineStyle(3, 0xffffff, 1).strokeCircle(0, 0, 18);
      b.fillStyle(0xffffff, 1).fillCircle(-6, -4, 3).fillCircle(6, -4, 3);
      parts.push(b);
    }
    parts.push(this.add.text(0, -34, 'คุณ', {
      fontFamily: 'Mitr, sans-serif', fontSize: '15px', color: '#fff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));
    this.player.add(parts);
    cam.startFollow(this.player, true, 0.12, 0.12);

    this.add.text(12, 10, 'แตะพื้นเพื่อเดิน • แตะ NPC เพื่อคุย', {
      fontFamily: 'Mitr, sans-serif', fontSize: '16px', color: '#fff', backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100000);

    this.input.on('pointerdown', function (p, over) {
      if (this.modal) return;
      if (over && over.length) return;
      this.pending = null;
      this.target = { x: Phaser.Math.Clamp(p.worldX, 20, T.w - 20), y: Phaser.Math.Clamp(p.worldY, 20, T.h - 20) };
    }, this);

    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.wasd = kb.addKeys('W,A,S,D');
    }

    this.events.once('shutdown', this.cleanup, this);
  }

  makeNpc(n) {
    const c = this.add.container(n.x, n.y).setDepth(n.y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillEllipse(0, 30, 54, 16);
    g.fillStyle(n.color, 1).fillRoundedRect(-28, -28, 56, 56, 14);
    g.lineStyle(4, 0xffffff, 1).strokeRoundedRect(-28, -28, 56, 56, 14);
    const icon = this.add.text(0, 0, n.icon, { fontSize: '32px' }).setOrigin(0.5);
    const name = this.add.text(0, -52, n.name, {
      fontFamily: 'Mitr, sans-serif', fontSize: '16px', color: '#ffe28a', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);
    const title = this.add.text(0, 46, n.title, {
      fontFamily: 'Mitr, sans-serif', fontSize: '13px', color: '#fff', backgroundColor: '#000000aa',
      padding: { x: 6, y: 2 },
    }).setOrigin(0.5);
    c.add([g, icon, name, title]);
    c.setSize(110, 130);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', function () {
      if (this.modal) return;
      this.pending = n;
      this.target = { x: n.x, y: n.y + 70 };
    }, this);
    return c;
  }

  update(time, delta) {
    if (this.modal) return;
    const T = TOWN, dt = delta / 1000, p = this.player;
    let vx = 0, vy = 0;

    if (this.cursors) {
      if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
      if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
      if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
      if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;
    }
    if (vx || vy) {
      this.target = null; this.pending = null;
      const l = Math.hypot(vx, vy); vx /= l; vy /= l;
    } else if (this.target) {
      const dx = this.target.x - p.x, dy = this.target.y - p.y, d = Math.hypot(dx, dy);
      if (d < 6) { this.target = null; }
      else { vx = dx / d; vy = dy / d; }
    }

    if (vx || vy) {
      p.x = Phaser.Math.Clamp(p.x + vx * T.speed * dt, 20, T.w - 20);
      p.y = Phaser.Math.Clamp(p.y + vy * T.speed * dt, 20, T.h - 20);
      p.setDepth(p.y);
    }

    if (this.pending) {
      const n = this.pending;
      if (Math.hypot(n.x - p.x, n.y - p.y) < 110) {
        this.pending = null; this.target = null;
        this.talk(n);
      }
    }
  }

  talk(n) {
    const hook = window.TownHooks[n.id];
    if (typeof hook === 'function') { hook(this, n); return; }
    const title = n.icon + ' ' + n.name;

    if (n.id === 'gate') {
      this.dialog(title, TOWN_TEXT.gate, [
        { label: '🗡️ ออกไปล่ามอน', primary: true, fn: this.goHunt.bind(this, null) },
        { label: 'อยู่ต่อ' },
      ]);
      return;
    }
    this.dialog(title, TOWN_TEXT[n.id] || '...', [{ label: 'ตกลง', primary: true }]);
  }

  dialog(title, text, buttons) {
    this.closeDialog();
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,.55);font-family:Mitr,sans-serif;-webkit-tap-highlight-color:transparent;touch-action:manipulation';
    const card = document.createElement('div');
    card.style.cssText = 'min-width:260px;max-width:86vw;max-height:86vh;overflow:auto;background:#26090f;border:2px solid #ffd45c;' +
      'border-radius:14px;padding:16px 18px;color:#fff;text-align:center;box-shadow:0 8px 30px #000a';
    const h = document.createElement('div');
    h.style.cssText = 'font-size:20px;color:#ffe28a;margin-bottom:8px';
    h.textContent = title;
    const t = document.createElement('div');
    t.style.cssText = 'font-size:15px;line-height:1.5;margin-bottom:14px';
    t.textContent = text;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
    const self = this;
    buttons.forEach(function (b) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.disabled = !!b.disabled;
      btn.style.cssText = 'font-family:inherit;font-size:15px;padding:8px 14px;border-radius:10px;' +
        'cursor:' + (b.disabled ? 'default' : 'pointer') + ';opacity:' + (b.disabled ? '.45' : '1') + ';' +
        'border:2px solid #ffd45c;color:' + (b.primary ? '#26090f' : '#ffe28a') + ';background:' + (b.primary ? '#ffd45c' : '#26090f');
      btn.addEventListener('click', function () {
        self.closeDialog();
        if (b.fn) b.fn();
      });
      row.appendChild(btn);
    });
    card.append(h, t, row);
    box.appendChild(card);
    document.body.appendChild(box);
    this.modal = box;
  }

  closeDialog() {
    if (this.modal) { this.modal.remove(); this.modal = null; }
  }

  // stageIdx = null -> ไปต่อที่เดิม (หรือด่าน 1 ถ้าเพิ่งเริ่มเกม)
  goHunt(stageIdx) {
    const m = townMainScene(this.game);
    const key = m ? m.sys.settings.key : 'Main';
    const paused = m && this.scene.isPaused(key);

    const ui = document.getElementById('ui-layer');
    if (ui) ui.style.display = '';
    const tb = document.getElementById('btn-to-town');
    if (tb) tb.style.display = '';

    if (paused) {
      this.scene.resume(key);                    // กลับมาเล่นต่อ state เดิม
      if (stageIdx != null) townEnterStage(m, stageIdx);
      this.scene.stop();                         // ปิดฉาก Town
    } else {
      window.TOWN_NEXT_STAGE = stageIdx;         // เริ่ม Main ครั้งแรก
      this.scene.start(key);
    }
  }

  cleanup() {
    this.closeDialog();
    this.input.off('pointerdown');
  }
}
