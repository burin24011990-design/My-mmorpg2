// ===== ช่างตีเหล็ก (NPC ในเมือง): ตีบวก / ฝังหินออฟ / ลบออฟ ทำได้ที่นี่เท่านั้น =====
// ไฟล์: js/systems/forge.js | โหลด "หลัง" town.js, bagWindow.js, enhance.js, lootOptions.js และก่อน js/main.js
// - เพิ่ม NPC "ช่างตีเหล็ก" ในเมือง (ผ่าน TOWN_NPCS ไม่ต้องแก้ town.js)
// - คุยกับช่าง = เปิดกระเป๋าแบบ "โหมดช่าง" (scene.forgeMode = true) ที่ bagWindow.js จะโชว์ปุ่ม ตีบวก / ฝังออฟ / ลบออฟ
//   เปิดกระเป๋าจากปุ่มปกติ = ไม่มีปุ่มเหล่านี้
// - กันซ้ำที่ตัวฟังก์ชัน: enhanceItem / embedOptStone / cleanOpts ใช้ไม่ได้ถ้าไม่ได้อยู่ในโหมดช่าง

(function () {
  const P = Main.prototype;

  // ---------- NPC ----------
  // ตำแหน่ง x,y = จุดเท้า (พิกัดผังเมือง 2400x1900) อยู่ข้างโรงตีเหล็กมุมซ้ายล่าง | ถ้าซ้อนกับสิ่งก่อสร้าง ปรับเลขตรงนี้
  TOWN_NPCS.push({ id: 'forge', name: 'ช่างตีเหล็ก', title: 'ตีบวก / ฝังออฟ', x: 860, y: 1690, sprite: 'npc_forge', color: 0xd0602a, icon: '🔨' });
  TOWN_TEXT.forge = 'ตีบวกอุปกรณ์ ฝังหินสุ่มออฟ และลบออฟ ทำได้ที่ช่างตีเหล็กเท่านั้น';
  window.TownHooks = window.TownHooks || {};
  window.TownHooks.forge = function (m) {
    m._forgeOpening = true;
    m.forgeMode = true;
    try { m.openInventory('bag'); } finally { m._forgeOpening = false; }
  };

  // ---------- โหมดช่าง: เปิดกระเป๋าปกติ / ปิดกระเป๋า = ออกจากโหมดช่าง ----------
  const oOpen = P.openInventory;
  if (typeof oOpen === 'function') {
    P.openInventory = function () {
      if (!this._forgeOpening) this.forgeMode = false;
      return oOpen.apply(this, arguments);
    };
  }
  const oClose = P.closePanel;
  if (typeof oClose === 'function') {
    P.closePanel = function () {
      this.forgeMode = false;
      return oClose.apply(this, arguments);
    };
  }

  // ---------- กันใช้นอกโหมดช่าง (ติดตั้งหลังโหลดทุกสคริปต์ครบ เผื่อฟังก์ชันถูกประกาศในไฟล์ที่โหลดทีหลัง) ----------
  function installGuard() {
    ['enhanceItem', 'embedOptStone', 'cleanOpts'].forEach(function (name) {
      const o = P[name];
      if (typeof o !== 'function' || o._forgeGuard) return;
      const g = function () {
        if (!this.forgeMode) {
          if (this.toastMsg) this.toastMsg('🔨 ต้องไปที่ช่างตีเหล็กในเมืองเท่านั้น');
          return false;
        }
        return o.apply(this, arguments);
      };
      g._forgeGuard = true;
      P[name] = g;
    });
  }
  if (document.readyState === 'complete') installGuard();
  else window.addEventListener('load', installGuard);
})();

// ===== ภาพ NPC ช่างตีเหล็ก =====
// วางไฟล์ภาพที่ assets/town/npc_forge.png (หรือ assets/house/npc_forge.png) | พื้นหลังขาว/ลายหมากรุกลบให้เองตอนโหลด
// ไม่มีไฟล์ = ใช้กล่องไอคอน 🔨 เหมือนเดิม (ไม่พัง)
(function () {
  const FORGE_FILES = [
    'assets/town/npc_forge.png', 'assets/house/npc_forge.png',
    'assets/town/npc_forge.jpg', 'assets/house/npc_forge.jpg',
    'assets/town/npc_forge.webp', 'assets/house/npc_forge.webp',
  ];
  const FORGE_H_MUL = 1.6;      // ความสูง NPC เทียบกับตัวผู้เล่น (ช่างมีทั่งตีเหล็กจึงใหญ่กว่า NPC ทั่วไป) | ปรับตรงนี้
  const FORGE_H_MIN = 110, FORGE_H_MAX = 200;
  let cv = null;                // canvas ภาพช่างที่ลบพื้นหลังและตัดขอบแล้ว

  (function load(i) {
    if (i >= FORGE_FILES.length || !window.HouseImg) return;
    const img = new Image();
    img.onload = function () {
      try { cv = window.HouseImg.trim(window.HouseImg.key(img, 'white')); }
      catch (e) { console.warn('forge npc img', e); }
    };
    img.onerror = function () { load(i + 1); };
    img.src = FORGE_FILES[i] + '?v=1';
  })(0);

  function forgeTex(m) {
    if (!cv) return null;
    const key = 'npc_forge_img';
    if (!m.textures.exists(key)) {
      const tw = Math.round(cv.width * Math.min(1, 420 / cv.height));   // ย่อให้สูงไม่เกิน ~420px (ประหยัดแรม)
      m.textures.addCanvas(key, window.HouseImg.scale(cv, tw));
    }
    return key;
  }

  // สร้าง NPC ด้วยภาพจริง (ตรรกะเดียวกับ townMakeNpc ของ town.js ส่วนที่ใช้ภาพจากแอตลาส)
  function makeForgeNpc(m, n, ox, oy, objs, key) {
    const nx = ox + n.x, ny = oy + n.y;
    const ph = (m.player && m.player.displayHeight) ? m.player.displayHeight : 64;
    const npcH = Phaser.Math.Clamp(ph * FORGE_H_MUL, FORGE_H_MIN, FORGE_H_MAX);
    const c = m.add.container(nx, ny).setDepth(townDepth(ny));
    const g = m.add.graphics();
    const textStyle = { fontFamily: 'Mitr, sans-serif', fontSize: '16px', color: '#ffe28a', stroke: '#000', strokeThickness: 4 };
    const titleStyle = { fontFamily: 'Mitr, sans-serif', fontSize: '13px', color: '#fff', backgroundColor: '#000000aa', padding: { x: 6, y: 2 } };

    g.fillStyle(0x000000, 0.35).fillEllipse(0, 2, 96, 20);
    const spr = m.add.image(0, 8, key).setOrigin(0.5, 1);
    const k = npcH / spr.height;
    spr.setScale(k);
    const w = spr.displayWidth, h = spr.displayHeight;
    const tw = m.tweens.add({ targets: spr, scaleY: k * 1.015, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
    objs.push({ destroy: function () { tw.remove(); } });
    const nameY = 8 - h - 14;
    const name = m.add.text(0, nameY, n.name, textStyle).setOrigin(0.5);
    const title = m.add.text(0, 26, n.title, titleStyle).setOrigin(0.5);
    c.add([g, spr, name, title]);
    const box = { cx: 0, cy: 8 - h / 2, w: Math.max(w + 40, 130), h: h + 60 };

    const BW = 112, BH = 42, btnY = nameY - 42;
    const bg = m.add.graphics();
    bg.fillStyle(0x000000, 0.35).fillRoundedRect(-BW / 2 + 2, -BH / 2 + 4, BW, BH, 14);
    bg.fillStyle(0xffd45c, 1).fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 14);
    bg.lineStyle(3, 0x26090f, 1).strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 14);
    const bt = m.add.text(0, 0, '💬 คุย', { fontFamily: 'Mitr, sans-serif', fontSize: '22px', color: '#26090f', fontStyle: 'bold' }).setOrigin(0.5);
    const btn = m.add.container(0, btnY, [bg, bt]);
    c.add(btn);
    const tw2 = m.tweens.add({ targets: btn, y: btnY - 6, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
    objs.push({ destroy: function () { tw2.remove(); } });

    const onTap = function () { townApproach(m, n, nx, ny); };
    const zBody = m.add.zone(nx + box.cx, ny + box.cy, box.w, box.h).setDepth(60).setInteractive({ useHandCursor: true });
    zBody.on('pointerdown', onTap);
    const zBtn = m.add.zone(nx, ny + btnY, BW + 50, BH + 36).setDepth(61).setInteractive({ useHandCursor: true });
    zBtn.on('pointerdown', onTap);
    objs.push(c, zBody, zBtn);
  }

  // ครอบการสร้าง NPC ของ town.js: เฉพาะช่างตีเหล็กที่มีภาพจริง
  if (typeof window.townMakeNpc === 'function') {
    const orig = window.townMakeNpc;
    window.townMakeNpc = function (m, n, ox, oy, atlas, objs) {
      if (n && n.id === 'forge') {
        const key = forgeTex(m);
        if (key) return makeForgeNpc(m, n, ox, oy, objs, key);
      }
      return orig.apply(this, arguments);
    };
  }
})();
