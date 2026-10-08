// ===== PvP ฝั่งเกม: ล็อบบี้ในเมือง (NPC ผู้ดูแลสนามประลอง) + สนามประลอง 1v1 / 3v3 / 5v5 =====
// ห้อง: ไม่จุติ / จุติไม่เกิน 3, 6, 8, 11, 15, 19, 24 (ต้องตรงกับ server/pvpServer.js)
// กติกา: ตายแล้วเกิดใหม่ในวงปลอดภัย | ฆ่าได้มากกว่าชนะ | วงปลอดภัยบีบเข้าเมื่อเวลาผ่านไป (ใครอยู่นอกวงเสียเลือด)
// วิธีทำงาน: ฝั่งตรงข้ามถูกสร้างเป็น "เป้าหมายแบบมอน" ในกลุ่ม enemies เพื่อให้สกิล/กระสุนเดิมตีโดนทุกแบบ
//            ดาเมจที่ตีส่งให้เซิร์ฟเวอร์ -> เซิร์ฟเวอร์ส่งไปให้คนที่โดน -> คนที่โดนหักเลือดตัวเอง (คิดเกราะ/หลบ/บล็อกของตัวเอง)
// v2: สถานะสกิลใน PvP: สตั้น/แช่แข็ง/ล็อกขา/เดินช้า/ตีเบาลง
//     - คนใช้สกิล: ส่ง 'pvpFx' ขึ้นเซิร์ฟเวอร์ (ดักที่ Classes.status) | คนโดน: รับ 'pvpFx' แล้วล็อกตัวเอง (ดู ccOn/ccStunned)
//     - ไฟช็อต (ดาเมจต่อเนื่อง) ทำงานผ่านตัวอัปเดตสถานะของ classes/* ซึ่งโหมดสนามเรียกต่อให้แล้ว
//       (ต้องมีบรรทัด "if (this.rmActive || (window._pvp && window._pvp.active)) return;" ที่หัว updateEnemies ใน monsters.js)
// v3: ขยายวงปลอดภัย (ZONE_START_MUL / ZONE_END_MUL / ZONE_END_MIN) + ซุ่มพุ่มไม้ (ศัตรูในพุ่มมองไม่เห็น)
//     แผนที่ย่อไม่แสดงฝั่งตรงข้าม (แก้ที่ ui.js บรรทัด "if (e.isPvp) return;")
// v4: แอนิเมชันคู่ต่อสู้: ตัวที่เห็นเป็นสไปรต์แยก (disp) ไม่ถูกระบบมอนยุ่ง + ท่าเดิน/ยืนไม่กระพริบ
// v5: คู่ต่อสู้/เพื่อนร่วมทีมใช้สกินตามอาชีพ (heroSkin) เหมือนตัวเรา
//     ตายใน PvP ไม่เข้าระบบ "ตายแล้วกลับเมือง/เสีย EXP" ของเกมเดิมอีก (ล็อกไม่ให้ HP ต่ำกว่า 1 ระหว่างแมตช์
//     แล้วจับสัญญาณตายเอง) + ยังเก็บ EXP/เลเวลตอนเริ่มแมตช์ไว้คืนเป็นชั้นสำรอง
// โหลดหลังไฟล์อื่นทั้งหมด (หลัง town.js, roomMonsters.js, rockGuard.js, heroPatch.js ฯลฯ) และก่อน main.js
(function () {
  const P = Main.prototype;
  const FORMATS = [{ size: 1, label: '1 ปะทะ 1' }, { size: 3, label: '3 ปะทะ 3' }, { size: 5, label: '5 ปะทะ 5' }];
  const CAPS = [0, 3, 6, 8, 11, 15, 19, 24];
  const capLabel = c => (c === 0 ? 'ไม่จุติ' : 'จุติไม่เกิน ' + c);
  const ARENA_STAGE = 0;                       // ใช้แผนที่ด่าน 1 เป็นสนาม (หินเหมือนกันทุกเครื่อง)
  const SPAWN_X = [1250, 2350], SPAWN_Y = 1125;
  // สีทีม (ตายตัวทุกเครื่อง): ทีม 0 = แดง, ทีม 1 = น้ำเงิน
  const TINT = [0xff6655, 0x66aaff];                         // ใช้กับวงกลมสำรอง (ถ้าไม่มี hero.png)
  const TINT_HERO = [0xffb0a0, 0xb4d2ff];                    // ใช้กับตัวละครจริง (อ่อนกว่า จะได้เห็นหน้าตา)
  const LABEL_COL = ['#ff9a8a', '#a8d0ff'];
  const BAR_COL = [0xff4a4a, 0x5aa8ff];
  const HERO_SCALE = 0.75;                     // ต้องตรงกับ heroPatch.js
  const ATTACK_MS = 420;
  const ATTACK_BY_CLASS = { sword: 'sword', rogue: 'sword', mage: 'staff', priest: 'staff', archer: 'bow' };

  // ----- ขยายวงปลอดภัย (ปรับเลขได้) -----
  const ZONE_START_MUL = 1.5;   // วงเริ่มต้น ใหญ่ขึ้นกี่เท่า
  const ZONE_END_MUL = 2.2;     // วงสุดท้าย ใหญ่ขึ้นกี่เท่า
  const ZONE_END_MIN = 450;     // รัศมีวงสุดท้ายขั้นต่ำ
  function scaleZone(z) {
    if (!z) return null;
    const r0 = z.r0 * ZONE_START_MUL;
    const r1 = Math.min(r0, Math.max(z.r1 * ZONE_END_MUL, ZONE_END_MIN));
    return Object.assign({}, z, { r0: r0, r1: r1 });
  }

  // ----- พุ่มไม้ซุ่ม: ศัตรูที่อยู่ในพุ่มจะมองไม่เห็น (เห็นเมื่อเข้าใกล้ หรือเพิ่งโจมตี) -----
  const BUSH_SEE = 140;             // เข้าใกล้เท่านี้จะเห็นศัตรูในพุ่ม
  const BUSH_REVEAL_MS = 1500;      // ศัตรูโจมตีแล้วโผล่กี่ ms

  const fmtTime = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const pvOn = () => !!(window._pvp && window._pvp.active);
  const heroOn = m => !!(window.HeroAnims && m.textures && m.textures.exists('hero'));
  const dirFromVec = (x, y) => (Math.abs(x) >= Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down'));
  // จุดนี้อยู่ในพุ่มไม้ไหม (พุ่มของเกมเป็นรูปไข่ x,y,rx,ry)
  const inBush = (m, x, y) => (m.bushes || []).some(b => {
    const dx = (x - b.x) / b.rx, dy = (y - b.y) / b.ry;
    return dx * dx + dy * dy <= 1;
  });
  // สกินตัวละครตามอาชีพ (hero_sword / hero_priest ฯลฯ) ใช้ตัวเดียวกับที่ heroAnims.js ให้ตัวเราใช้
  const skinOfCls = (m, cls) => {
    let sk = 'hero';
    try { sk = HeroAnims.skinOf(cls) || 'hero'; } catch (e) { /* ignore */ }
    return (m.textures && m.textures.exists(sk)) ? sk : 'hero';
  };
  let lobbyRef = null;

  // ----- EXP/เลเวลไม่ลดจากการแพ้หรือตายใน PvP (ชั้นสำรอง) -----
  const snapExp = m => ({ level: m.stats.level, exp: m.stats.exp, expNext: m.stats.expNext });
  function restoreExp(m, sn) {
    const st = m && m.stats;
    if (!st || !sn) return;
    if (st.level < sn.level || (st.level === sn.level && st.exp < sn.exp)) {
      st.level = sn.level; st.exp = sn.exp; st.expNext = sn.expNext;
    }
  }

  // ----- ล็อก HP ไม่ให้ต่ำกว่า 1 ระหว่างแมตช์ -----
  // ระบบตายเดิมของเกม (ตายแล้วกลับเมือง/หัก EXP) ทำงานเมื่อ HP <= 0 | ล็อกไว้แล้วจับสัญญาณตายเอง (pv.hpZero)
  function guardHp(m, pv) {
    const st = m.stats;
    if (!st || pv._hpGuard) return;
    const d = Object.getOwnPropertyDescriptor(st, 'hp');
    if (d && !d.configurable) return;
    let hp = Number(st.hp) || 1;
    try {
      Object.defineProperty(st, 'hp', {
        configurable: true, enumerable: true,
        get: () => hp,
        set: v => {
          v = Number(v);
          if (isNaN(v)) return;
          if (v > 0) hp = v;
          else { hp = 1; if (!pv.dead && !pv.over) pv.hpZero = true; }
        },
      });
      pv._hpGuard = true;
    } catch (e) { /* ignore */ }
  }
  function unguardHp(m, pv) {
    const st = m.stats;
    if (!st || !pv._hpGuard) return;
    pv._hpGuard = false;
    const v = st.hp;
    try { delete st.hp; } catch (e) { /* ignore */ }
    st.hp = v;
  }
  function checkDeath(m, pv) {
    if (pv.dead || pv.over) { pv.hpZero = false; return; }
    if (pv.hpZero || m.stats.hp <= 0) { pv.hpZero = false; onMyDeath(m, pv); }
  }

  // ทำลายยูนิต (ตัวจริง + สไปรต์แสดงผล + ชื่อ)
  function killUnit(u) {
    try { if (u.disp) u.disp.destroy(); } catch (e) { /* ignore */ }
    try { u.sprite.destroy(); } catch (e) { /* ignore */ }
    try { u.label.destroy(); } catch (e) { /* ignore */ }
  }

  // ในสนาม PvP ไม่ให้เกราะของคนที่ถูกตีลดดาเมจฝั่งคนตี (ไปคิดฝั่งคนโดนแทน กันหักซ้ำ)
  const _edm = window.enemyDefMul;
  window.enemyDefMul = function (e) {
    if (e && e.isPvp) return 0;
    return _edm ? _edm.apply(this, arguments) : 1;
  };

  // ---------- สถานะควบคุม (CC) ที่ตัวเราโดนจากคู่ต่อสู้ ----------
  // pv.cc = { stun: {until}, freeze: {until}, root: {until}, slow: {until, mul}, weak: {until, pct} }  (until = เวลา Date.now())
  const CC_COLOR = { stun: 0xfff27a, freeze: 0x9fe8ff, root: 0x7dff9a, slow: 0xc58bff, weak: 0xc58bff };
  const CC_TEXT = { stun: '💫 สตั้น!', freeze: '❄ แช่แข็ง!', root: '🌿 โดนล็อกขา!', slow: '🐌 เดินช้าลง', weak: '⬇ ตีเบาลง' };
  const ccOn = (pv, t, now) => {
    const f = pv && pv.cc && pv.cc[t];
    return f && (now || Date.now()) < f.until ? f : null;
  };
  const ccStunned = (pv, now) => !!(ccOn(pv, 'stun', now) || ccOn(pv, 'freeze', now));   // กดสกิล/โจมตี/เดินไม่ได้
  const ccRooted = (pv, now) => ccStunned(pv, now) || !!ccOn(pv, 'root', now);           // เดินไม่ได้ (ยังโจมตีได้)
  function ccColor(pv, now) {
    const order = ['stun', 'freeze', 'root', 'slow', 'weak'];
    for (let i = 0; i < order.length; i++) if (ccOn(pv, order[i], now)) return CC_COLOR[order[i]];
    return 0;
  }

  // ส่งสถานะที่เราใส่ให้ "คู่ต่อสู้" ขึ้นเซิร์ฟเวอร์ (ดักที่ Classes.status ซึ่งสกิลทุกตัวเรียกใช้)
  (function hookStatus() {
    const C = window.Classes;
    if (!C || typeof C.status !== 'function' || C.status._pvWrapped) return;
    const orig = C.status;
    const wrapped = function (scene, e, type, params, ms) {
      const r = orig.apply(this, arguments);
      try {
        const pv = window._pvp;
        if (pv && pv.active && !pv.over && e && e.isPvp && scene && scene.socket) {
          scene.socket.emit('pvpFx', [e.pid, type, Math.round(ms || 0), params || {}]);
        }
      } catch (err) { /* ไม่ให้พังการใช้สกิล */ }
      return r;
    };
    wrapped._pvWrapped = true;
    C.status = wrapped;
  })();

  // =====================================================================
  // ล็อบบี้ (เปิดจาก NPC "ผู้ดูแลสนามประลอง" ในเมือง)
  // =====================================================================
  window.TownHooks = window.TownHooks || {};
  window.TownHooks.pvp = function (town) {
    const m = townMain(town);
    if (!m || !m.online || !m.socket) {
      town.dialog('⚔️ ห้อง PvP', 'ต้องเชื่อมต่อเซิร์ฟเวอร์ก่อน (ตอนนี้ออฟไลน์)', [{ label: 'ตกลง', primary: true }]);
      return;
    }
    openLobby(town, m);
  };

  const TEAM_NAME = ['🔴 ทีมแดง', '🔵 ทีมน้ำเงิน'];
  const TEAM_COL = ['#ff7a6a', '#6aa8ff'];
  const fmtLabel = n => (FORMATS.find(f => f.size === n) || FORMATS[0]).label;
  const JOIN_ERR = { full: 'ห้องเต็มแล้ว', rebirth: 'ขั้นจุติของคุณเกินเพดานห้องนี้', gone: 'ห้องนี้ปิดไปแล้ว', inmatch: 'คุณอยู่ในแมตช์อยู่' };

  function openLobby(town, m) {
    const s = m.socket, rebirth = Math.floor(m.stats.rebirth || 0);
    const L = { size: 1, bi: null, rooms: [], room: null, sig: '' };
    const card = town.domCard('⚔️ ห้อง PvP');
    const box = town.modal;
    let poll = null;

    const mk = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e; };
    const btn = (label, css, fn, disabled) => {
      const b = mk('button', 'font-family:inherit;border-radius:10px;cursor:' + (disabled ? 'default' : 'pointer') + ';' + css, label);
      b.disabled = !!disabled;
      if (!disabled) b.onclick = fn;
      return b;
    };
    const myInfo = () => {
      let cls = 'sword';
      try { if (typeof m.currentClass === 'function') cls = m.currentClass() || 'sword'; } catch (e) { /* ignore */ }
      return { level: m.stats.level, rebirth, maxHp: m.maxHp(), cls };
    };

    // รูปตัวละครในช่อง (ตัดจาก hero.png เฟรมยืนหันหน้า ถ้าไม่มีรูปใช้อีโมจิแทน)
    function avatar(color) {
      const wrap = mk('div', 'position:relative;width:68px;height:68px;margin:0 auto;overflow:hidden;border-radius:10px;background:#1a0a0e;border:2px solid ' + color);
      const fb = mk('div', 'position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:32px', '🧑');
      const spr = mk('div', 'position:absolute;left:0;top:0;width:96px;height:96px;transform:scale(.7);transform-origin:top left;background-position:0 -288px;background-repeat:no-repeat;image-rendering:pixelated');
      const img = new Image();
      img.onload = () => { spr.style.backgroundImage = 'url(assets/hero.png)'; fb.style.display = 'none'; };
      img.src = 'assets/hero.png';
      wrap.appendChild(fb); wrap.appendChild(spr);
      return wrap;
    }

    // ---------- หน้ารายการห้อง + สร้างห้อง ----------
    function renderBrowse() {
      const wrap = mk('div', 'max-height:78vh;overflow:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch');
      wrap.appendChild(mk('div', 'font-size:18px;color:#ffe28a;margin-bottom:2px', '⚔️ ห้อง PvP'));
      wrap.appendChild(mk('div', 'font-size:12px;color:#c9b27a;margin-bottom:6px',
        'ขั้นจุติของคุณ: ' + rebirth + ' • เข้าได้เฉพาะห้องที่เพดานจุติ ≥ ขั้นของคุณ'));

      wrap.appendChild(mk('div', 'font-size:13px;color:#ffe28a;margin:4px 0', 'สร้างห้องใหม่'));
      const row = mk('div', 'display:flex;gap:6px;justify-content:center;margin-bottom:6px');
      FORMATS.forEach(f => {
        const on = L.size === f.size;
        row.appendChild(btn(f.label, 'font-size:14px;padding:6px 12px;border:2px solid ' + (on ? '#ffe28a' : '#7a5f2c') +
          ';color:' + (on ? '#26090f' : '#ffe28a') + ';background:' + (on ? '#ffd45c' : '#26090f'), () => { L.size = f.size; render(); }));
      });
      wrap.appendChild(row);

      const grid = mk('div', 'display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:6px');
      CAPS.forEach((cap, bi) => {
        const locked = rebirth > cap, sel = L.bi === bi;
        grid.appendChild(btn(capLabel(cap), 'font-size:12px;padding:6px 2px;color:' + (locked ? '#8a7a7a' : '#fff') +
          ';border:2px solid ' + (sel ? '#ffe28a' : (locked ? '#5a3a3a' : '#4f9a5a')) +
          ';background:' + (sel ? '#3a5a2a' : (locked ? '#2a2424' : '#24402a')), () => { L.bi = bi; render(); }, locked));
      });
      wrap.appendChild(grid);

      wrap.appendChild(btn('➕ สร้างห้อง' + (L.bi === null ? '' : ' (' + fmtLabel(L.size) + ' • ' + capLabel(CAPS[L.bi]) + ')'),
        'font-size:15px;padding:7px 18px;border:2px solid #ffd45c;color:#26090f;background:' + (L.bi === null ? '#555' : '#ffd45c'),
        () => {
          s.emit('pvpCreate', Object.assign({ size: L.size, bi: L.bi }, myInfo()), res => {
            res = res || {};
            if (res.ok) { L.room = res.room; render(); }
            else m.toastMsg(JOIN_ERR[res.reason] || 'สร้างห้องไม่สำเร็จ (' + (res.reason || '?') + ')');
          });
        }, L.bi === null));

      wrap.appendChild(mk('div', 'font-size:13px;color:#ffe28a;margin:10px 0 4px', 'ห้องที่เปิดอยู่ (' + L.rooms.length + ')'));
      if (!L.rooms.length) wrap.appendChild(mk('div', 'font-size:12px;color:#aaa;padding:6px', 'ยังไม่มีห้อง — สร้างห้องแล้วรอเพื่อนมาเข้าได้เลย'));
      L.rooms.forEach(r => {
        const total = r.size * 2, locked = rebirth > r.cap, full = r.n >= total;
        const line = mk('div', 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 8px;margin-bottom:4px;border-radius:8px;background:#3a1620;font-size:13px;text-align:left');
        line.appendChild(mk('span', '', '#' + r.id + ' • ' + fmtLabel(r.size) + ' • ' + capLabel(r.cap) + ' • 👑 ' + r.host + ' • ' + r.n + '/' + total));
        line.appendChild(btn(full ? 'เต็ม' : (locked ? 'จุติเกิน' : 'เข้าร่วม'), 'font-size:13px;padding:4px 12px;border:2px solid #ffd45c;color:#26090f;background:' + (full || locked ? '#777' : '#ffd45c'),
          () => {
            s.emit('pvpJoin', Object.assign({ roomId: r.id }, myInfo()), res => {
              res = res || {};
              if (res.ok) { L.room = res.room; render(); }
              else { m.toastMsg(JOIN_ERR[res.reason] || 'เข้าห้องไม่สำเร็จ (' + (res.reason || '?') + ')'); L.sig = ''; fetchInfo(); }
            });
          }, full || locked));
        wrap.appendChild(line);
      });

      wrap.appendChild(btn('ปิด', 'font-size:14px;padding:7px 18px;margin-top:8px;border:2px solid #ffd45c;color:#ffe28a;background:#26090f', () => town.closeDialog()));
      return wrap;
    }

    // ---------- หน้าในห้องรอ: ฝั่งแดง / ฝั่งน้ำเงิน ----------
    function renderRoom() {
      const r = L.room, isHost = r.host === s.id;
      const myTeam = r.teams[0].some(u => u.id === s.id) ? 0 : 1;
      const wrap = mk('div', 'max-height:78vh;overflow:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch');
      wrap.appendChild(mk('div', 'font-size:17px;color:#ffe28a;margin-bottom:2px', '⚔️ ห้อง #' + r.id + ' • ' + fmtLabel(r.size) + ' • ' + capLabel(r.cap)));
      wrap.appendChild(mk('div', 'font-size:12px;color:#c9b27a;margin-bottom:6px', 'กดช่องว่างฝั่งที่ต้องการเพื่อย้าย • เจ้าห้อง (👑) เป็นคนกดเริ่ม'));

      const cols = mk('div', 'display:grid;grid-template-columns:1fr 1fr;gap:8px');
      [0, 1].forEach(t => {
        const col = mk('div', 'border:2px solid ' + TEAM_COL[t] + ';border-radius:12px;padding:6px;background:#1a0a0e');
        col.appendChild(mk('div', 'font-size:14px;color:' + TEAM_COL[t] + ';margin-bottom:4px', TEAM_NAME[t] + ' (' + r.teams[t].length + '/' + r.size + ')'));
        const slots = mk('div', 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center');
        for (let i = 0; i < r.size; i++) {
          const u = r.teams[t][i];
          const slot = mk('div', 'width:' + (r.size > 3 ? '78px' : '96px') + ';text-align:center;font-size:11px;line-height:1.25');
          if (u) {
            slot.appendChild(avatar(u.id === s.id ? '#ffe28a' : TEAM_COL[t]));
            slot.appendChild(mk('div', 'color:#fff;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', (u.id === r.host ? '👑 ' : '') + u.name + (u.id === s.id ? ' (คุณ)' : '')));
            slot.appendChild(mk('div', 'color:#c9b27a', 'Lv.' + u.level + (u.rebirth ? ' จุติ ' + u.rebirth : '')));
          } else if (t !== myTeam) {
            const b = btn('ย้ายมา\nตรงนี้', 'width:68px;height:68px;font-size:11px;white-space:pre-line;border:2px dashed ' + TEAM_COL[t] + ';color:' + TEAM_COL[t] + ';background:#26090f',
              () => s.emit('pvpSwitch', { team: t }, res => { if (res && !res.ok) m.toastMsg(JOIN_ERR[res.reason] || 'ย้ายไม่สำเร็จ'); }));
            slot.appendChild(b);
          } else {
            slot.appendChild(mk('div', 'width:68px;height:68px;margin:0 auto;display:flex;align-items:center;justify-content:center;border:2px dashed #555;border-radius:10px;color:#777', 'ว่าง'));
          }
          slots.appendChild(slot);
        }
        col.appendChild(slots);
        cols.appendChild(col);
      });
      wrap.appendChild(cols);

      const ready = r.teams[0].length > 0 && r.teams[1].length > 0;
      wrap.appendChild(mk('div', 'margin:8px 0 6px;font-size:13px;color:' + (ready ? '#9be39b' : '#ccc'),
        ready ? (isHost ? 'พร้อมแล้ว กดเริ่มได้เลย' : 'รอเจ้าห้องกดเริ่ม...') : 'ต้องมีผู้เล่นอย่างน้อยฝั่งละ 1 คน'));
      if (isHost) {
        wrap.appendChild(btn('▶ เริ่มแมตช์', 'font-size:16px;padding:8px 22px;border:2px solid #ffd45c;color:#26090f;background:' + (ready ? '#ffd45c' : '#555'),
          () => s.emit('pvpStart', res => {
            if (res && !res.ok) m.toastMsg(res.reason === 'needboth' ? 'ต้องมีผู้เล่นฝั่งละ 1 คนขึ้นไป' : 'เริ่มไม่สำเร็จ (' + (res.reason || '?') + ')');
          }), !ready));
      }
      wrap.appendChild(btn('ออกจากห้อง', 'font-size:14px;padding:7px 18px;margin-left:' + (isHost ? '8px' : '0') + ';border:2px solid #ffd45c;color:#ffe28a;background:#26090f',
        () => { s.emit('pvpLeaveRoom'); L.room = null; L.sig = ''; render(); fetchInfo(); }));
      return wrap;
    }

    function render() {
      const old = card.firstChild, top = old ? old.scrollTop : 0;
      card.textContent = '';
      const v = L.room ? renderRoom() : renderBrowse();
      card.appendChild(v);
      v.scrollTop = top;
    }

    const ref = lobbyRef = {
      onRoom: d => { L.room = d || null; render(); },
      close: () => { L.room = null; stop(); town.closeDialog(); },
    };
    function stop() { if (poll) { clearInterval(poll); poll = null; } if (lobbyRef === ref) lobbyRef = null; }
    function fetchInfo() {
      if (town.modal !== box) {                         // ปิดหน้าต่างแล้ว: ออกจากห้องและเลิกอัปเดต
        if (L.room) s.emit('pvpLeaveRoom');
        L.room = null; stop(); return;
      }
      if (L.room) return;
      s.emit('pvpRooms', res => {
        if (!res || !res.rooms || town.modal !== box || L.room) return;
        const sig = JSON.stringify(res.rooms);
        if (sig === L.sig) return;                      // ไม่เปลี่ยน ไม่ต้องวาดใหม่ (กันเลื่อนหน้าจอเด้ง)
        L.sig = sig; L.rooms = res.rooms; render();
      });
    }
    poll = setInterval(fetchInfo, 2000);
    fetchInfo();
    render();
  }

  // =====================================================================
  // สนามประลอง
  // =====================================================================
  // หาจุดที่ไม่ติดหิน และ (ถ้าระบุวง zi) ต้องอยู่ในวงปลอดภัยด้วย
  function freePoint(m, x, y, zi) {
    const inside = (px, py) => !zi || Math.hypot(px - zi.x, py - zi.y) <= zi.r - 30;
    if (!m.pointInRock) return { x, y };
    if (!m.pointInRock(x, y, 50) && inside(x, y)) return { x, y };
    for (let r = 20; r <= 400; r += 20) {
      for (let k = 0; k < 12; k++) {
        const a = k * Math.PI / 6, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (!m.pointInRock(px, py, 50) && inside(px, py)) return { x: px, y: py };
      }
    }
    return { x, y };
  }
  const spawnFor = (m, team, idx, n) => freePoint(m, SPAWN_X[team], SPAWN_Y + (idx - (n - 1) / 2) * 110);

  function resetCooldowns(m) { if (m.cdEnd) Object.keys(m.cdEnd).forEach(k => { m.cdEnd[k] = 0; }); }
  function fullHeal(m) { m.stats.hp = m.maxHp(); m.stats.mp = m.maxMp(); }

  // รัศมีวงปลอดภัยตอนนี้ (สูตรเดียวกับเซิร์ฟเวอร์) | null = ยังไม่เริ่ม
  function zoneInfo(pv) {
    const z = pv.zone;
    if (!z || !pv.liveAt || !pv.total) return null;
    const k = (Date.now() - pv.liveAt) / pv.total;
    const t = Math.min(1, Math.max(0, (k - z.from) / (z.to - z.from)));
    return { x: z.x, y: z.y, r: z.r0 + (z.r1 - z.r0) * t, t, k };
  }

  function startArena(m, d) {
    if (window._pvp) return;
    if (lobbyRef) lobbyRef.close();
    try { if (m.closePanel) m.closePanel(); } catch (e) { /* ignore */ }
    if (m.autoMode) m.toggleAuto();
    const myId = m.socket.id;
    const pv = window._pvp = {
      active: true, id: d.id, team: d.team, size: d.size, cap: d.cap, teams: d.teams, me: myId,
      frozen: true, dead: false, over: false, allowLoad: true, prevStage: m.stageIdx || 0,
      units: {}, st: {}, hits: {}, info: {}, teamOf: {}, cc: {},
      lastSend: 0, lastHit: 0, lastHud: 0, lastZone: 0, endAt: 0, startAt: Date.now() + d.countdown,
      zone: null, liveAt: 0, total: 0, protUntil: 0, respawnMs: 3000,
      expSnap: snapExp(m),                              // เก็บ EXP/เลเวลก่อนแมตช์ไว้คืนถ้าลดลง
      hpZero: false, _hpGuard: false,
    };
    d.teams.forEach((list, t) => list.forEach(u => { pv.info[u.id] = u; pv.teamOf[u.id] = t; }));
    // เลิกเชื่อมห้องล่ามอน (เซิร์ฟเวอร์พาออกแล้ว) กันระบบเครือข่ายพาเข้าห้องซ้ำ
    Object.keys(m.others || {}).forEach(id => m.removeOther(id));
    m.inRoom = false; m._netStage = null;
    if (typeof m.netRefreshChBtn === 'function') m.netRefreshChBtn();

    if (window._townBusy) townLeave(m);               // ออกจากเมือง กลับมาเล่นฉากหลัก
    m.loadStage(ARENA_STAGE);                         // สร้างสนาม (มอนไม่เกิดเพราะ pvp ครอบ spawn ไว้)
    pv.allowLoad = false;
    m.enemies.getChildren().slice().forEach(e => { if (e.levelText) e.levelText.destroy(); e.destroy(); });
    fullHeal(m); resetCooldowns(m);
    guardHp(m, pv);                                   // เริ่มล็อก HP ไม่ให้ระบบตายเดิมทำงาน

    // ตำแหน่งเกิดของเรา + สร้างยูนิตของทุกคน
    d.teams.forEach((list, t) => list.forEach((u, idx) => {
      const sp = spawnFor(m, t, idx, list.length);
      if (u.id === myId) {
        m.player.setPosition(sp.x, sp.y); m.player.setVelocity(0, 0); m.player.setAlpha(1);
        m.cameras.main.centerOn(sp.x, sp.y);
        return;
      }
      makeUnit(m, pv, u, t, sp);
    }));
    ['btn-to-town', 'btn-ch'].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = 'none'; });
    buildHud(m, pv);
    m.toastMsg('⚔️ พบคู่ต่อสู้! เตรียมตัว...');
    m.socket.emit('pvpMove', { x: m.player.x, y: m.player.y, hp: m.stats.hp, maxHp: m.maxHp() });
  }

  // สร้างยูนิตของผู้เล่นคนอื่น
  // ศัตรู: ตัวจริงเป็นเป้าหมายในกลุ่ม enemies (ให้สกิลตีโดน) แต่ถ้ามี hero.png จะซ่อนไว้ (alpha 0)
  //        แล้วแสดงด้วยสไปรต์แยก (disp) ที่เล่นอนิเมชันเอง ไม่ถูกระบบมอนยุ่ง
  // เพื่อนร่วมทีม: สไปรต์ธรรมดา | ไม่มี hero.png: ใช้วงกลมสำรอง
  // ตัวที่แสดงใช้สกินตามอาชีพ (sprite.heroSkin) ให้ HeroAnims.play เลือกท่าถูกชีต
  function makeUnit(m, pv, u, team, sp) {
    const foe = team !== pv.team, hero = heroOn(m);
    const skin = hero ? skinOfCls(m, u.cls) : 'hero';
    let spr, disp = null;
    if (foe) {
      spr = hero ? m.enemies.create(sp.x, sp.y, 'hero', 18) : m.enemies.create(sp.x, sp.y, 'player');
      spr.isPvp = true; spr.pid = u.id; spr.level = u.level; spr.kind = 'pvp';
      spr.isBoss = false; spr.ranged = false; spr.state = 'idle';
      spr.hp = u.maxHp; spr.maxHp = u.maxHp;
      spr.def = { name: u.name, scale: 1, key: 'player', hasSheet: false };
      if (hero) {
        spr.setScale(HERO_SCALE);
        if (spr.body) { spr.body.setSize(28, 24); spr.body.setOffset(34, 64); }
      }
      if (spr.body) spr.body.setImmovable(true);
      const pick = () => { if (!pv.dead && !pv.frozen) m.manualTarget = spr; };
      if (hero) {
        spr.setAlpha(0);                                // ซ่อนตัวเป้าหมาย (ยังตีโดนตามปกติ)
        disp = m.add.sprite(sp.x, sp.y, skin, 0).setScale(HERO_SCALE).setDepth(30);
        disp.heroSkin = skin;
        disp.setTint(TINT_HERO[team]);
        disp.setInteractive();
        disp.on('pointerdown', pick);
        try { HeroAnims.play(disp, 'idle', team === 0 ? 'right' : 'left', skin); } catch (e) { /* ignore */ }
      } else {
        spr.setTint(TINT[team]);
        spr.setInteractive();
        spr.on('pointerdown', pick);
      }
    } else {
      spr = hero ? m.add.sprite(sp.x, sp.y, skin, 0) : m.add.sprite(sp.x, sp.y, 'player');
      if (hero) {
        spr.setScale(HERO_SCALE);
        spr.heroSkin = skin;
        try { HeroAnims.play(spr, 'idle', team === 0 ? 'right' : 'left', skin); } catch (e) { /* ignore */ }
      }
      spr.setTint(hero ? TINT_HERO[team] : TINT[team]);
    }
    spr.setDepth(disp ? 29 : 30);
    const nameY = hero ? 56 : 40;
    const label = m.add.text(sp.x, sp.y - nameY, (foe ? '' : '🛡 ') + u.name + ' Lv.' + u.level + (u.rebirth ? ' (จุติ ' + u.rebirth + ')' : ''), {
      fontFamily: 'Mitr, sans-serif', fontSize: '14px', color: LABEL_COL[team], stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(40);
    pv.units[u.id] = {
      id: u.id, name: u.name, cls: u.cls || 'sword', skin, foe, hero, nameY, team, sprite: spr, disp, label, alive: true,
      tx: sp.x, ty: sp.y, hp: u.maxHp, maxHp: u.maxHp,
      dir: team === 0 ? 'right' : 'left', atkUntil: 0, moveUntil: 0, protUntil: 0, revealUntil: 0,
    };
  }

  // เล่นท่าเดิน/ยืน ตามการเคลื่อนที่ (ค้างสถานะเดินไว้ 220ms กันท่ากระพริบสลับเดิน/ยืนทุกเฟรม)
  function animateUnit(u, dx, dy, now) {
    if (!u.hero || now < u.atkUntil) return;
    const body = u.disp || u.sprite;
    if (Math.hypot(dx, dy) > 3) { u.moveUntil = now + 220; u.dir = dirFromVec(dx, dy); }
    try { HeroAnims.play(body, now < u.moveUntil ? 'walk' : 'idle', u.dir, u.skin); } catch (e) { /* ignore */ }
  }

  // เล่นท่าโจมตี (ตอนได้รับอีเวนต์สกิลจากเซิร์ฟเวอร์)
  function playUnitAttack(m, pv, u) {
    if (!u.hero) return;
    const sp = u.disp || u.sprite;
    let tx = null;
    if (u.foe) tx = m.player.x;
    else {
      let best = 1e9;
      Object.values(pv.units).forEach(o => { if (o.foe && o.alive) { const dd = Math.abs(o.sprite.x - sp.x); if (dd < best) { best = dd; tx = o.sprite.x; } } });
    }
    if (tx !== null) u.dir = tx < sp.x ? 'left' : 'right';
    u.atkUntil = Date.now() + ATTACK_MS;
    try { HeroAnims.play(sp, ATTACK_BY_CLASS[u.cls] || 'sword', u.dir, u.skin); } catch (e) { /* ignore */ }
  }

  // ---------- HUD ด้านบน ----------
  function buildHud(m, pv) {
    removeHud();
    const d = document.createElement('div');
    d.id = 'pvp-hud';
    d.style.cssText = 'position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:9100;display:flex;gap:8px;align-items:center;' +
      'padding:4px 10px;border-radius:10px;border:2px solid #ffd45c;background:#26090fdd;color:#fff;font-family:Mitr,sans-serif;font-size:14px;touch-action:manipulation';
    const txt = document.createElement('span'); txt.id = 'pvp-hud-txt'; d.appendChild(txt);
    const leave = document.createElement('button');
    leave.textContent = '🏳 ออก';
    leave.style.cssText = 'font-family:inherit;font-size:12px;padding:3px 8px;border-radius:8px;border:1px solid #ffd45c;color:#ffe28a;background:#26090f;cursor:pointer';
    leave.onclick = () => {
      if (!window.confirm('ออกจากแมตช์? จะนับว่าแพ้ (ไม่เสียอะไร)')) return;
      m.socket.emit('pvpLeave');
      cleanup(m, true);
    };
    d.appendChild(leave);
    document.body.appendChild(d);
  }
  function removeHud() { const d = document.getElementById('pvp-hud'); if (d) d.remove(); }
  function updateHud(pv) {
    const t = document.getElementById('pvp-hud-txt');
    if (!t) return;
    let ka = 0, kb = 0;
    Object.keys(pv.st).forEach(id => {
      const k = pv.st[id].kills || 0;
      if (pv.teamOf[id] === pv.team) ka += k; else kb += k;
    });
    let time, zone = '';
    if (pv.frozen) time = 'เริ่มใน ' + Math.max(0, Math.ceil((pv.startAt - Date.now()) / 1000));
    else {
      time = fmtTime(pv.endAt - Date.now());
      const zi = zoneInfo(pv);
      if (zi) {
        if (zi.t <= 0) zone = ' • 🌀 บีบใน ' + fmtTime(pv.zone.from * pv.total - (Date.now() - pv.liveAt));
        else if (zi.t < 1) zone = ' • 🌀 วงกำลังบีบ';
        else zone = ' • 🌀 วงเล็กสุด';
      }
    }
    t.textContent = (pv.team === 0 ? '🔴' : '🔵') + ' ⚔ ' + pv.size + 'v' + pv.size + ' • ฆ่า ' + ka + ' : ' + kb + ' • ⏱ ' + time + zone + (pv.dead ? ' • 👻 กำลังเกิดใหม่' : '');
  }

  // ตัวเราตาย (เลือดหมดหรืออยู่นอกวงนานเกิน)
  function onMyDeath(m, pv) {
    if (pv.dead || pv.over) return;
    pv.dead = true;
    pv.hpZero = false;
    pv.cc = {};                                         // ตายแล้วล้างสถานะที่ติดอยู่
    m.stats.hp = 1;
    restoreExp(m, pv.expSnap);                          // กันระบบตายเดิมหัก EXP
    if (m.player) m.player.setAlpha(0.35);
    m.manualTarget = null; m.target = null;
    m.socket.emit('pvpDead');
  }

  // เสียเลือดจากอยู่นอกวง (หักตรง ไม่ผ่านเกราะ/หลบ)
  function zoneHurt(m, pv, dmg) {
    m.stats.hp = Math.max(0, m.stats.hp - dmg);
    try { showDamage(m, m.player.x, m.player.y - 30, dmg, 'normal'); } catch (e) { /* ignore */ }
    if (!pv.warned) {
      pv.warned = true; m.toastMsg('⚠ คุณอยู่นอกวง! รีบเข้าไปในวงสีฟ้า');
      setTimeout(() => { pv.warned = false; }, 3000);
    }
    checkDeath(m, pv);
  }

  // ---------- อัปเดตทุกเฟรมในสนาม ----------
  function pvpUpdate(m, time) {
    const pv = window._pvp, now = Date.now();
    restoreExp(m, pv.expSnap);                          // EXP/เลเวลต้องไม่ต่ำกว่าตอนเริ่มแมตช์
    checkDeath(m, pv);                                  // จับสัญญาณ HP หมดจากการล็อก HP
    if (!m._pvpGfx) m._pvpGfx = m.add.graphics().setDepth(41);
    const g = m._pvpGfx; g.clear();
    Object.values(pv.units).forEach(u => {
      if (!u.alive) return;
      const s = pv.st[u.id];
      if (s) { u.tx = s.x; u.ty = s.y; u.hp = s.hp; u.maxHp = s.maxHp || u.maxHp; }
      const sp = u.sprite;
      const dx = u.tx - sp.x, dy = u.ty - sp.y;
      sp.x += dx * 0.3; sp.y += dy * 0.3;
      if (sp.body) sp.body.setVelocity(0, 0);
      const body = u.disp || sp;                        // ตัวที่ผู้เล่นมองเห็นจริง
      if (u.disp) u.disp.setPosition(sp.x, sp.y);
      if (u.foe) {
        sp.hp = u.hp; sp.maxHp = u.maxHp;
        if (u.disp) {
          sp.setAlpha(0);                               // ตัวเป้าหมายต้องล่องหนเสมอ
          // ถ้าสกิลย้อมสี/แฟลชที่ตัวเป้าหมาย ให้สะท้อนมาที่ตัวที่เห็น ไม่งั้นใช้สีทีม
          if (sp.isTinted) { if (sp.tintFill) u.disp.setTintFill(sp.tintTopLeft); else u.disp.setTint(sp.tintTopLeft); }
          else u.disp.setTint(TINT_HERO[u.team]);
        } else if (!sp.isTinted) sp.setTint(TINT[u.team]);   // คืนสีหลังแฟลชโดนตี/หมดสถานะ
      }
      animateUnit(u, dx, dy, now);
      if (u.protUntil) {                                  // กะพริบตอนอมตะหลังเกิดใหม่
        if (now < u.protUntil) body.setAlpha(Math.floor(now / 150) % 2 ? 0.4 : 1);
        else { u.protUntil = 0; body.setAlpha(1); }
      }
      u.label.setPosition(sp.x, sp.y - u.nameY);

      // ซุ่มพุ่มไม้: ศัตรูที่อยู่ในพุ่ม (และไม่ได้เพิ่งโจมตี / เราไม่ได้อยู่ใกล้) จะมองไม่เห็น
      if (u.foe) {
        const hid = inBush(m, sp.x, sp.y) && now >= (u.revealUntil || 0) &&
          Math.hypot(m.player.x - sp.x, m.player.y - sp.y) > BUSH_SEE;
        body.setVisible(!hid); u.label.setVisible(!hid);
        if (body.input) body.input.enabled = !hid;
        if (hid) {
          if (m.manualTarget === sp) m.manualTarget = null;
          if (m.target === sp) m.target = null;
          return;                                         // ไม่วาดหลอดเลือด
        }
      }

      const w = 54, r = Math.max(0, Math.min(1, u.hp / Math.max(1, u.maxHp))), x = Math.round(sp.x - w / 2), y = Math.round(sp.y - u.nameY + 12);
      g.fillStyle(0x000000, 0.8).fillRect(x - 1, y - 1, w + 2, 9);
      g.fillStyle(0x3a0d0d, 1).fillRect(x, y, w, 7);
      if (r > 0) g.fillStyle(BAR_COL[u.team], 1).fillRect(x, y, Math.round(w * r), 7);
    });

    // ตัวเราตอนอมตะ: กะพริบ
    if (!pv.dead) {
      if (now < pv.protUntil) { m.player.setAlpha(Math.floor(now / 150) % 2 ? 0.4 : 1); pv._wasProt = true; }
      else if (pv._wasProt) { pv._wasProt = false; m.player.setAlpha(1); }
    }

    // ตัวเราติดสถานะ (สตั้น/แช่แข็ง/ล็อกขา/ช้า/ตีเบา): ย้อมสีตามสถานะ แล้วคืนสีเมื่อหมด
    if (!pv.dead) {
      const col = ccColor(pv, now);
      if (col) { m.player.setTint(col); pv._ccTint = true; }
      else if (pv._ccTint) { m.player.clearTint(); pv._ccTint = false; }
    }

    // วงปลอดภัย: วาดวงฟ้า + พื้นที่นอกวงสีแดง และหักเลือดคนที่อยู่นอกวง
    const zi = zoneInfo(pv);
    if (zi) {
      g.lineStyle(1200, 0xff2222, 0.12).strokeCircle(zi.x, zi.y, zi.r + 600);
      g.lineStyle(6, 0x55aaff, 0.95).strokeCircle(zi.x, zi.y, zi.r);
      if (!pv.dead && !pv.over && now >= pv.protUntil && time - pv.lastZone > 500 &&
          Math.hypot(m.player.x - zi.x, m.player.y - zi.y) > zi.r) {
        pv.lastZone = time;
        zoneHurt(m, pv, Math.ceil(m.maxHp() * (0.02 + 0.03 * zi.t)));   // 2% -> 5% ต่อครึ่งวินาที (แรงขึ้นตามวงที่เล็กลง)
      }
    }

    if (!pv.over && time - pv.lastSend > 66) {
      pv.lastSend = time;
      m.socket.emit('pvpMove', { x: Math.round(m.player.x), y: Math.round(m.player.y), hp: pv.dead ? 0 : Math.max(0, Math.round(m.stats.hp)), maxHp: m.maxHp() });
    }
    if (time - pv.lastHit >= 50) {                      // ส่งดาเมจที่ตีรวมกันทุก 50ms
      pv.lastHit = time;
      const ids = Object.keys(pv.hits);
      if (ids.length) {
        m.socket.emit('pvpHit', ids.map(id => [id, pv.hits[id]]));
        pv.hits = {};
      }
    }
    if (time - pv.lastHud > 250) { pv.lastHud = time; updateHud(pv); }
  }

  const _updateEnemies = P.updateEnemies;
  P.updateEnemies = function (time) {
    if (!pvOn()) return _updateEnemies.apply(this, arguments);
    // เรียกตัวอัปเดตสถานะของ classes/* (ไฟช็อต แช่แข็ง ล็อกขา ย้อมสี ฯลฯ บนตัวคู่ต่อสู้)
    // ตัวในสุดคือ monsters.js ซึ่งต้องข้ามการคิด AI มอนเมื่ออยู่ในสนาม (ดูหมายเหตุบนหัวไฟล์)
    try { _updateEnemies.call(this, time); } catch (e) { console.warn('[pvp] status chain', e); }
    try { pvpUpdate(this, time); } catch (e) { console.warn('[pvp] update', e); }
  };

  // ---------- ตีคู่ต่อสู้ ----------
  const _damage = P.damage;
  P.damage = function (e, dmg, opts) {
    if (!e || !e.isPvp) return _damage.apply(this, arguments);
    const pv = window._pvp;
    if (!pv || !pv.active || !e.active || pv.dead || pv.frozen || pv.over) return;
    const h = this.calcHit ? this.calcHit(e, dmg) : { final: Math.max(1, Math.round(Number(dmg))), crit: false, vamp: 0 };
    let final = h.final;
    const wk = ccOn(pv, 'weak');                       // เราโดนตีเบาลง = ดาเมจที่เราตีออกไปลดลง
    if (wk) final = Math.max(1, Math.round(final * (1 - wk.pct)));
    e.hp = Math.max(1, e.hp - final);                  // เดาไว้ก่อน รอเซิร์ฟเวอร์ยืนยันเลือดจริง
    opts = opts || {};
    const ctx = (this._skillCtx && this.time.now < this._skillCtx.until) ? this._skillCtx.def : null;
    const skill = opts.skill || ctx;
    try { showDamage(this, e.x, e.y - 20, final, (opts.crit || h.crit) ? 'crit' : 'normal', skill ? { skill: skill } : undefined); } catch (err) { /* ignore */ }
    try { monsterHitFx(this, e); } catch (err) { /* ignore */ }
    pv.hits[e.pid] = (pv.hits[e.pid] || 0) + final;
    if (h.vamp > 0 && this.vampHeal) this.vampHeal(final * h.vamp / 100);
  };

  // ---------- ตัวเราโดนตี ----------
  const _hurt = P.hurtPlayer;
  P.hurtPlayer = function () {
    const pv = window._pvp;
    if (!pv || !pv.active) return _hurt.apply(this, arguments);
    if (pv.frozen || pv.dead || pv.over) return;          // ช่วงนับถอยหลัง/ตายแล้ว/จบแล้ว = ไม่โดน
    if (Date.now() < pv.protUntil) return;                // อมตะหลังเกิดใหม่
    const r = _hurt.apply(this, arguments);
    restoreExp(this, pv.expSnap);                         // ถ้าระบบเดิมหัก EXP ให้คืน
    checkDeath(this, pv);
    return r;
  };

  // กันระบบ "ตายแล้วกลับเมือง" ของ town.js ทำงานกลางสนาม (ชั้นสำรอง นอกเหนือจากการล็อก HP)
  ['playerDie', 'playerDied', 'onPlayerDeath', 'playerDeath', 'killPlayer', 'respawnPlayer', 'gameOver'].forEach(name => {
    const o = P[name];
    if (typeof o !== 'function') return;
    P[name] = function () {
      const pv = window._pvp;
      if (!pv || !pv.active) return o.apply(this, arguments);
      onMyDeath(this, pv);
    };
  });

  // ---------- ล็อกการกระทำช่วงนับถอยหลัง/ตายแล้ว/ติดสตั้น-แช่แข็ง ----------
  const locked = () => {
    const pv = window._pvp;
    return !!(pv && pv.active && (pv.frozen || pv.dead || pv.over || ccStunned(pv)));
  };
  ['useBasicAttack', 'useSkill', 'useUlti'].forEach(name => {
    const o = P[name];
    if (typeof o !== 'function') return;
    P[name] = function () { if (locked()) return; return o.apply(this, arguments); };
  });
  const _um = P.updateMovement;
  P.updateMovement = function () {
    const pv = window._pvp;
    if (pv && pv.active && pv.frozen) { if (this.player) this.player.setVelocity(0, 0); return; }
    const r = _um.apply(this, arguments);
    if (pv && pv.active && this.player && this.player.body) {
      if (ccRooted(pv)) this.player.setVelocity(0, 0);                       // สตั้น/แช่แข็ง/ล็อกขา = เดินไม่ได้
      else {
        const sl = ccOn(pv, 'slow');                                         // เดินช้าลง
        if (sl && sl.mul < 1) { const v = this.player.body.velocity; this.player.setVelocity(v.x * sl.mul, v.y * sl.mul); }
      }
    }
    return r;
  };

  // ---------- ปิดสิ่งที่ไม่ควรใช้ในสนาม ----------
  const _loadStage = P.loadStage;
  P.loadStage = function () {
    const pv = window._pvp;
    if (pv && pv.active && !pv.allowLoad) { if (this.toastMsg) this.toastMsg('เปลี่ยนด่านกลางแมตช์ PvP ไม่ได้'); return; }
    return _loadStage.apply(this, arguments);
  };
  ['spawnEnemyInZone', 'spawnBoss', 'spawnEpic', 'rmCreate'].forEach(name => {
    const o = P[name];
    if (typeof o !== 'function') return;
    P[name] = function () { if (pvOn()) return null; return o.apply(this, arguments); };
  });
  const _toggleAuto = P.toggleAuto;
  P.toggleAuto = function () {
    if (pvOn()) { this.toastMsg('ใช้บอทในสนาม PvP ไม่ได้'); return; }
    return _toggleAuto.apply(this, arguments);
  };

  // เอฟเฟกต์สกิลของเราส่งให้คนในแมตช์ (แทนการส่งเข้าห้องล่ามอน)
  const _sendNet = P.sendNet;
  P.sendNet = function (ev, data) {
    const pv = window._pvp;
    if (pv && pv.active) {
      if (ev === 'skill' && this.socket && !pv.over && !pv.dead && !pv.frozen) this.socket.emit('pvpSkill', Object.assign({ stage: this.stageIdx }, data));
      return;
    }
    return _sendNet.apply(this, arguments);
  };

  // ---------- จบแมตช์ / ออก ----------
  function cleanup(m, toTown, notice) {
    const pv = window._pvp;
    if (!pv) return;
    const prev = pv.prevStage, sn = pv.expSnap;
    unguardHp(m, pv);                                   // คืนการทำงานปกติของ HP
    Object.values(pv.units).forEach(killUnit);
    if (m._pvpGfx) { m._pvpGfx.destroy(); m._pvpGfx = null; }
    removeHud();
    const ov = document.getElementById('pvp-result'); if (ov) ov.remove();
    window._pvp = null;
    try { m.player.setAlpha(1); m.player.clearTint(); } catch (e) { /* ignore */ }
    m.manualTarget = null; m.target = null;
    ['btn-to-town', 'btn-ch'].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = ''; });
    restoreExp(m, sn);
    if (!toTown) return;
    m.loadStage(prev);                                  // กลับด่านเดิม (มอนกลับมาเกิดตามปกติ)
    fullHeal(m); resetCooldowns(m);
    try { if (m.online) m.netEnter(m.stageIdx, m.channel, m.netRoom, false); } catch (e) { /* ignore */ }
    townGoToTown(m, notice);
    restoreExp(m, sn);
    // กันระบบอื่นหัก EXP หลังกลับเมือง (เช่น บทลงโทษตายที่ทำงานช้ากว่า)
    setTimeout(() => restoreExp(m, sn), 300);
    setTimeout(() => restoreExp(m, sn), 1500);
  }

  function showResult(m, pv, d) {
    const old = document.getElementById('pvp-result'); if (old) old.remove();
    const ov = document.createElement('div');
    ov.id = 'pvp-result';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10003;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);font-family:Mitr,sans-serif;touch-action:manipulation';
    const card = document.createElement('div');
    card.style.cssText = 'width:min(520px,94vw);max-height:92vh;overflow:auto;background:#26090f;border:2px solid #ffd45c;border-radius:14px;padding:14px;color:#fff;text-align:center';
    const win = d.winner === pv.team, draw = d.winner === -1;
    const h = document.createElement('div');
    h.style.cssText = 'font-size:26px;margin-bottom:4px;color:' + (draw ? '#ffe28a' : (win ? '#9be39b' : '#ff9a9a'));
    h.textContent = draw ? '🤝 เสมอ' : (win ? '🏆 ชนะ!' : '💀 แพ้');
    card.appendChild(h);
    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:12px;color:#c9b27a;margin-bottom:8px';
    sub.textContent = ({
      time: 'หมดเวลา ตัดสินจากจำนวนฆ่า',
      timeDmg: 'ฆ่าเท่ากัน ตัดสินจากดาเมจรวม',
      draw: 'ฆ่าและดาเมจเท่ากัน',
      forfeit: 'อีกฝ่ายออกจากแมตช์',
    })[d.reason] || 'จบแมตช์';
    card.appendChild(sub);
    [0, 1].forEach(t => {
      const rows = d.rows.filter(r => r.team === t);
      const total = rows.reduce((s, r) => s + r.kills, 0);
      const tt = document.createElement('div');
      tt.style.cssText = 'text-align:left;font-size:13px;color:' + (t === pv.team ? '#a8d0ff' : '#ff9a8a') + ';margin:6px 0 2px';
      tt.textContent = (t === pv.team ? 'ทีมเรา' : 'ทีมศัตรู') + ' • ฆ่ารวม ' + total;
      card.appendChild(tt);
      rows.forEach(r => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;gap:8px;padding:4px 8px;margin-bottom:3px;border-radius:8px;background:#3a1620;font-size:13px';
        const a = document.createElement('span'); a.textContent = r.name + (r.id === pv.me ? ' (คุณ)' : '') + (r.left ? ' 🏳' : '');
        const b = document.createElement('span'); b.style.color = '#ffe28a'; b.textContent = 'ฆ่า ' + r.kills + ' • ตาย ' + (r.deaths || 0) + ' • ดาเมจ ' + r.dmg.toLocaleString();
        row.append(a, b); card.appendChild(row);
      });
    });
    const btn = document.createElement('button');
    btn.textContent = 'กลับเมือง';
    btn.style.cssText = 'margin-top:10px;font-family:inherit;font-size:16px;padding:8px 24px;border-radius:10px;cursor:pointer;border:2px solid #ffd45c;color:#26090f;background:#ffd45c';
    btn.onclick = () => cleanup(m, true, draw ? 'PvP: เสมอ' : (win ? 'PvP: ชนะ! 🏆' : 'PvP: แพ้ ลองใหม่นะ'));
    card.appendChild(btn);
    ov.appendChild(card);
    document.body.appendChild(ov);
  }

  // =====================================================================
  // เหตุการณ์จากเซิร์ฟเวอร์
  // =====================================================================
  function attach(m) {
    const s = m.socket;
    s.on('pvpRoom', d => { if (lobbyRef) lobbyRef.onRoom(d); });
    s.on('pvpFound', d => startArena(m, d));
    s.on('pvpGo', d => {
      const pv = window._pvp; if (!pv) return;
      pv.frozen = false; pv.total = d.ms; pv.liveAt = Date.now(); pv.endAt = pv.liveAt + d.ms;
      pv.zone = scaleZone(d.zone); pv.respawnMs = d.respawn || 3000;
      m.toastMsg('⚔️ เริ่ม! ใครฆ่าได้มากกว่าชนะ');
    });
    s.on('pvpState', list => {
      const pv = window._pvp; if (!pv) return;
      list.forEach(a => { pv.st[a[0]] = { x: a[1], y: a[2], hp: a[3], maxHp: a[4], alive: !!a[5], kills: a[6] || 0 }; });
    });
    s.on('pvpHurt', d => {
      const pv = window._pvp;
      if (!pv || !pv.active || pv.frozen || pv.dead || pv.over) return;
      m.hurtPlayer(d.dmg);
    });
    // โดนสถานะจากคู่ต่อสู้ (เซิร์ฟเวอร์ตรวจแล้ว): d = { t: ชนิด, ms, mul?, pct?, by }
    s.on('pvpFx', d => {
      const pv = window._pvp;
      if (!pv || !pv.active || pv.frozen || pv.dead || pv.over || !d || !CC_COLOR[d.t]) return;
      const now = Date.now();
      if (now < pv.protUntil) return;                       // อมตะหลังเกิดใหม่
      const ms = Math.max(0, Math.min(3000, Number(d.ms) || 0));
      if (!ms) return;
      pv.cc = pv.cc || {};
      const f = { until: now + ms };
      if (d.t === 'slow') f.mul = Math.max(0.4, Math.min(1, Number(d.mul) || 1));
      if (d.t === 'weak') f.pct = Math.max(0, Math.min(0.5, Number(d.pct) || 0));
      pv.cc[d.t] = f;
      if (m.player && (d.t === 'stun' || d.t === 'freeze' || d.t === 'root')) m.player.setVelocity(0, 0);
      if (m.popText && m.player) m.popText(m.player.x, m.player.y - 50, CC_TEXT[d.t], '#ffe066');
    });
    s.on('pvpDead', d => {
      const pv = window._pvp; if (!pv) return;
      const killer = d.by === pv.me ? 'คุณ' : (pv.units[d.by] ? pv.units[d.by].name : null);
      if (d.id === pv.me) {
        if (!d.left) m.toastMsg('💀 ' + (killer ? 'ถูก ' + killer + ' ' : '') + 'กำจัด • เกิดใหม่ใน ' + Math.round(pv.respawnMs / 1000) + ' วิ');
        return;
      }
      const u = pv.units[d.id]; if (!u) return;
      u.alive = false;
      if (u.foe || d.left) {
        if (m.target === u.sprite) m.target = null;
        if (m.manualTarget === u.sprite) m.manualTarget = null;
        killUnit(u);
      } else { u.sprite.setAlpha(0.3); u.label.setAlpha(0.5); }
      m.toastMsg(d.left ? u.name + ' ออกจากแมตช์' : '☠ ' + u.name + ' ถูกกำจัด' + (killer ? ' โดย ' + killer : ''));
    });
    // เกิดใหม่: ตัวเรา = วาร์ปไปจุดที่เซิร์ฟเวอร์สุ่ม (ในวงปลอดภัย) / คนอื่น = สร้างยูนิตใหม่ที่จุดนั้น
    s.on('pvpRespawn', d => {
      const pv = window._pvp; if (!pv || !pv.active || pv.over) return;
      const zi = zoneInfo(pv);
      if (d.id === pv.me) {
        const p = freePoint(m, d.x, d.y, zi);
        pv.dead = false; pv.hpZero = false; pv.cc = {}; pv.protUntil = Date.now() + (d.prot || 0); pv._wasProt = true;
        m.player.setPosition(p.x, p.y); m.player.setVelocity(0, 0); m.player.setAlpha(1);
        m.cameras.main.centerOn(p.x, p.y);
        fullHeal(m); resetCooldowns(m);
        restoreExp(m, pv.expSnap);
        m.toastMsg('✨ เกิดใหม่!');
        return;
      }
      const info = pv.info[d.id], team = pv.teamOf[d.id];
      if (!info || team === undefined) return;
      const old = pv.units[d.id];
      if (old) killUnit(old);
      delete pv.st[d.id];
      makeUnit(m, pv, info, team, { x: d.x, y: d.y });
      pv.units[d.id].protUntil = Date.now() + (d.prot || 0);
    });
    // ศัตรู/เพื่อนใช้สกิล -> เล่นท่าโจมตี (ศัตรูที่ซุ่มในพุ่มจะโผล่ให้เห็นชั่วคราว)
    s.on('skill', d => {
      const pv = window._pvp; if (!pv || !d) return;
      const u = pv.units[d.id];
      if (u && u.alive) playUnitAttack(m, pv, u);
      if (u && u.foe) u.revealUntil = Date.now() + BUSH_REVEAL_MS;
    });
    s.on('pvpEnd', d => {
      const pv = window._pvp; if (!pv) return;
      pv.over = true; pv.frozen = false; pv.cc = {};
      restoreExp(m, pv.expSnap);
      showResult(m, pv, d);
    });
    s.on('disconnect', () => { if (window._pvp) { try { cleanup(m, true); } catch (e) { /* ignore */ } } });
  }

  const _initNetwork = P.initNetwork;
  P.initNetwork = function () {
    const r = _initNetwork.apply(this, arguments);
    if (this.socket) attach(this);
    return r;
  };
})();
