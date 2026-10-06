// ===== PvP ฝั่งเกม: ล็อบบี้ในเมือง (NPC ผู้ดูแลสนามประลอง) + สนามประลอง 1v1 / 3v3 / 5v5 =====
// ห้อง: ไม่จุติ / จุติไม่เกิน 3, 6, 8, 11, 15, 19, 24 (ต้องตรงกับ server/pvpServer.js)
// วิธีทำงาน: ฝั่งตรงข้ามถูกสร้างเป็น "เป้าหมายแบบมอน" ในกลุ่ม enemies เพื่อให้สกิล/กระสุนเดิมตีโดนทุกแบบ
//            ดาเมจที่ตีส่งให้เซิร์ฟเวอร์ -> เซิร์ฟเวอร์ส่งไปให้คนที่โดน -> คนที่โดนหักเลือดตัวเอง (คิดเกราะ/หลบ/บล็อกของตัวเอง)
// โหลดหลังไฟล์อื่นทั้งหมด (หลัง town.js, roomMonsters.js, rockGuard.js ฯลฯ) และก่อน main.js
(function () {
  const P = Main.prototype;
  const FORMATS = [{ size: 1, label: '1 ปะทะ 1' }, { size: 3, label: '3 ปะทะ 3' }, { size: 5, label: '5 ปะทะ 5' }];
  const CAPS = [0, 3, 6, 8, 11, 15, 19, 24];
  const capLabel = c => (c === 0 ? 'ไม่จุติ' : 'จุติไม่เกิน ' + c);
  const ARENA_STAGE = 0;                       // ใช้แผนที่ด่าน 1 เป็นสนาม (หินเหมือนกันทุกเครื่อง)
  const SPAWN_X = [1250, 2350], SPAWN_Y = 1125;
  const ALLY_TINT = 0x66aaff, FOE_TINT = 0xff6655, NAME_Y = 40;
  const fmtTime = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const pvOn = () => !!(window._pvp && window._pvp.active);
  const sty = (e, css) => { e.style.cssText = css; return e; };
  let lobbyRef = null;

  // ในสนาม PvP ไม่ให้เกราะของคนที่ถูกตีลดดาเมจฝั่งคนตี (ไปคิดฝั่งคนโดนแทน กันหักซ้ำ)
  const _edm = window.enemyDefMul;
  window.enemyDefMul = function (e) {
    if (e && e.isPvp) return 0;
    return _edm ? _edm.apply(this, arguments) : 1;
  };

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

  function openLobby(town, m) {
    const s = m.socket, rebirth = Math.floor(m.stats.rebirth || 0);
    const L = { size: 1, bi: null, queued: false, counts: {}, waiting: 0, need: 0 };
    const card = town.domCard('⚔️ ห้อง PvP');
    const box = town.modal;
    let poll = null;

    const mk = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e; };

    function render() {
      card.textContent = '';
      card.appendChild(mk('div', 'font-size:18px;color:#ffe28a;margin-bottom:4px', '⚔️ ห้อง PvP'));
      card.appendChild(mk('div', 'font-size:12px;color:#c9b27a;margin-bottom:8px',
        'ขั้นจุติของคุณ: ' + rebirth + ' • เข้าได้เฉพาะห้องที่เพดานจุติ ≥ ขั้นของคุณ'));

      const row = mk('div', 'display:flex;gap:6px;justify-content:center;margin-bottom:8px');
      FORMATS.forEach(f => {
        const on = L.size === f.size;
        const b = mk('button', 'font-family:inherit;font-size:14px;padding:7px 12px;border-radius:10px;cursor:pointer;border:2px solid ' +
          (on ? '#ffe28a' : '#7a5f2c') + ';color:' + (on ? '#26090f' : '#ffe28a') + ';background:' + (on ? '#ffd45c' : '#26090f'), f.label);
        b.disabled = L.queued;
        b.onclick = () => { L.size = f.size; render(); };
        row.appendChild(b);
      });
      card.appendChild(row);

      const grid = mk('div', 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px');
      CAPS.forEach((cap, bi) => {
        const locked = rebirth > cap, sel = L.bi === bi;
        const n = L.counts[L.size + '-' + bi] || 0;
        const b = mk('button', 'font-family:inherit;padding:7px 2px;border-radius:10px;line-height:1.3;cursor:' + (locked || L.queued ? 'default' : 'pointer') +
          ';border:2px solid ' + (sel ? '#ffe28a' : (locked ? '#5a3a3a' : '#4f9a5a')) + ';color:' + (locked ? '#8a7a7a' : '#fff') +
          ';background:' + (sel ? '#3a5a2a' : (locked ? '#2a2424' : '#24402a')));
        b.appendChild(mk('div', 'font-size:12px', capLabel(cap)));
        b.appendChild(mk('div', 'font-size:11px;opacity:.85', locked ? 'จุติเกิน' : 'รอ ' + n + '/' + (L.size * 2)));
        b.disabled = locked || L.queued;
        b.onclick = () => { L.bi = bi; render(); };
        grid.appendChild(b);
      });
      card.appendChild(grid);

      const msg = L.queued
        ? '🔎 กำลังหาคู่... ' + L.waiting + '/' + L.need + ' คน (' + FORMATS.find(f => f.size === L.size).label + ' • ' + capLabel(CAPS[L.bi]) + ')'
        : (L.bi === null ? 'เลือกรูปแบบและห้องก่อน' : 'พร้อมเข้าคิว: ' + FORMATS.find(f => f.size === L.size).label + ' • ' + capLabel(CAPS[L.bi]));
      card.appendChild(mk('div', 'margin:10px 0 6px;font-size:13px;color:' + (L.queued ? '#9be39b' : '#ccc'), msg));

      const act = mk('button', 'font-family:inherit;font-size:16px;padding:8px 22px;border-radius:10px;cursor:pointer;border:2px solid #ffd45c;' +
        'color:#26090f;background:' + (L.queued ? '#e08a8a' : (L.bi === null ? '#555' : '#ffd45c')), L.queued ? 'ยกเลิกคิว' : '⚔️ เข้าคิว');
      act.disabled = !L.queued && L.bi === null;
      act.onclick = () => {
        if (L.queued) { s.emit('pvpCancel'); L.queued = false; render(); return; }
        s.emit('pvpQueue', { size: L.size, bi: L.bi, level: m.stats.level, rebirth, maxHp: m.maxHp() }, res => {
          res = res || {};
          if (res.ok) { L.queued = true; L.waiting = res.waiting; L.need = res.need; }
          else m.toastMsg(res.reason === 'rebirth' ? 'ขั้นจุติของคุณเกินเพดานห้องนี้' : 'เข้าคิวไม่สำเร็จ (' + (res.reason || '?') + ')');
          render();
        });
      };
      card.appendChild(act);

      const close = mk('button', 'font-family:inherit;font-size:14px;padding:7px 18px;border-radius:10px;cursor:pointer;margin:6px 0 0 8px;' +
        'border:2px solid #ffd45c;color:#ffe28a;background:#26090f', 'ปิด');
      close.onclick = () => town.closeDialog();
      card.appendChild(close);
    }

    const ref = lobbyRef = {
      onWait: d => { if (d && d.key === L.size + '-' + L.bi) { L.waiting = d.waiting; L.need = d.need; render(); } },
      close: () => { L.queued = false; stop(); town.closeDialog(); },
    };
    function stop() { if (poll) { clearInterval(poll); poll = null; } if (lobbyRef === ref) lobbyRef = null; }
    function fetchInfo() {
      if (town.modal !== box) {                         // ปิดหน้าต่างแล้ว: ยกเลิกคิวและเลิกอัปเดต
        if (L.queued) s.emit('pvpCancel');
        stop(); return;
      }
      s.emit('pvpInfo', res => { if (res && res.queues && town.modal === box) { L.counts = res.queues; render(); } });
    }
    poll = setInterval(fetchInfo, 2000);
    fetchInfo();
    render();
  }

  // =====================================================================
  // สนามประลอง
  // =====================================================================
  function freePoint(m, x, y) {
    if (!m.pointInRock) return { x, y };
    for (let r = 0; r <= 400; r += 20) {
      for (let k = 0; k < 12; k++) {
        const a = k * Math.PI / 6, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (!m.pointInRock(px, py, 50)) return { x: px, y: py };
      }
    }
    return { x, y };
  }
  const spawnFor = (m, team, idx, n) => freePoint(m, SPAWN_X[team], SPAWN_Y + (idx - (n - 1) / 2) * 110);

  function resetCooldowns(m) { if (m.cdEnd) Object.keys(m.cdEnd).forEach(k => { m.cdEnd[k] = 0; }); }
  function fullHeal(m) { m.stats.hp = m.maxHp(); m.stats.mp = m.maxMp(); }

  function startArena(m, d) {
    if (window._pvp) return;
    if (lobbyRef) lobbyRef.close();
    try { if (m.closePanel) m.closePanel(); } catch (e) { /* ignore */ }
    if (m.autoMode) m.toggleAuto();
    const myId = m.socket.id;
    const pv = window._pvp = {
      active: true, id: d.id, team: d.team, size: d.size, cap: d.cap, teams: d.teams, me: myId,
      frozen: true, dead: false, over: false, allowLoad: true, prevStage: m.stageIdx || 0,
      units: {}, st: {}, hits: {}, lastSend: 0, lastHit: 0, lastHud: 0, endAt: 0, startAt: Date.now() + d.countdown,
    };
    // เลิกเชื่อมห้องล่ามอน (เซิร์ฟเวอร์พาออกแล้ว) กันระบบเครือข่ายพาเข้าห้องซ้ำ
    Object.keys(m.others || {}).forEach(id => m.removeOther(id));
    m.inRoom = false; m._netStage = null;
    if (typeof m.netRefreshChBtn === 'function') m.netRefreshChBtn();

    if (window._townBusy) townLeave(m);               // ออกจากเมือง กลับมาเล่นฉากหลัก
    m.loadStage(ARENA_STAGE);                         // สร้างสนาม (มอนไม่เกิดเพราะ pvp ครอบ spawn ไว้)
    pv.allowLoad = false;
    m.enemies.getChildren().slice().forEach(e => { if (e.levelText) e.levelText.destroy(); e.destroy(); });
    fullHeal(m); resetCooldowns(m);

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

  function makeUnit(m, pv, u, team, sp) {
    const foe = team !== pv.team;
    let spr;
    if (foe) {
      spr = m.enemies.create(sp.x, sp.y, 'player').setTint(FOE_TINT);
      spr.isPvp = true; spr.pid = u.id; spr.level = u.level; spr.kind = 'pvp';
      spr.isBoss = false; spr.ranged = false; spr.state = 'idle';
      spr.hp = u.maxHp; spr.maxHp = u.maxHp;
      spr.def = { name: u.name, scale: 1, key: 'player', hasSheet: false };
      if (spr.body) spr.body.setImmovable(true);
      spr.setInteractive();
      spr.on('pointerdown', () => { if (!pv.dead && !pv.frozen) m.manualTarget = spr; });
    } else {
      spr = m.add.sprite(sp.x, sp.y, 'player').setTint(ALLY_TINT);
    }
    spr.setDepth(30);
    const label = m.add.text(sp.x, sp.y - NAME_Y, (foe ? '' : '🛡 ') + u.name + ' Lv.' + u.level + (u.rebirth ? ' (จุติ ' + u.rebirth + ')' : ''), {
      fontFamily: 'Mitr, sans-serif', fontSize: '14px', color: foe ? '#ff9a8a' : '#a8d0ff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(40);
    pv.units[u.id] = { id: u.id, name: u.name, foe, sprite: spr, label, alive: true, tx: sp.x, ty: sp.y, hp: u.maxHp, maxHp: u.maxHp };
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
    const units = Object.values(pv.units);
    const foe = units.filter(u => u.foe && u.alive).length;
    const ally = units.filter(u => !u.foe && u.alive).length + (pv.dead ? 0 : 1);
    let time;
    if (pv.frozen) time = 'เริ่มใน ' + Math.max(0, Math.ceil((pv.startAt - Date.now()) / 1000));
    else time = fmtTime(pv.endAt - Date.now());
    t.textContent = '⚔ ' + pv.size + 'v' + pv.size + ' • ทีมเรา ' + ally + ' vs ศัตรู ' + foe + ' • ⏱ ' + time + (pv.dead ? ' • 👻 ดูต่อ' : '');
  }

  // ---------- อัปเดตทุกเฟรมในสนาม ----------
  function pvpUpdate(m, time) {
    const pv = window._pvp;
    if (!m._pvpGfx) m._pvpGfx = m.add.graphics().setDepth(41);
    const g = m._pvpGfx; g.clear();
    Object.values(pv.units).forEach(u => {
      if (!u.alive) return;
      const s = pv.st[u.id];
      if (s) { u.tx = s.x; u.ty = s.y; u.hp = s.hp; u.maxHp = s.maxHp || u.maxHp; }
      const sp = u.sprite;
      sp.x += (u.tx - sp.x) * 0.3; sp.y += (u.ty - sp.y) * 0.3;
      if (sp.body) sp.body.setVelocity(0, 0);
      if (u.foe) { sp.hp = u.hp; sp.maxHp = u.maxHp; }
      u.label.setPosition(sp.x, sp.y - NAME_Y);
      const w = 54, r = Math.max(0, Math.min(1, u.hp / Math.max(1, u.maxHp))), x = Math.round(sp.x - w / 2), y = Math.round(sp.y - NAME_Y + 12);
      g.fillStyle(0x000000, 0.8).fillRect(x - 1, y - 1, w + 2, 9);
      g.fillStyle(0x3a0d0d, 1).fillRect(x, y, w, 7);
      if (r > 0) g.fillStyle(u.foe ? 0xff4a4a : 0x5aa8ff, 1).fillRect(x, y, Math.round(w * r), 7);
    });

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
    try { pvpUpdate(this, time); } catch (e) { console.warn('[pvp] update', e); }
  };

  // ---------- ตีคู่ต่อสู้ ----------
  const _damage = P.damage;
  P.damage = function (e, dmg, opts) {
    if (!e || !e.isPvp) return _damage.apply(this, arguments);
    const pv = window._pvp;
    if (!pv || !pv.active || !e.active || pv.dead || pv.frozen || pv.over) return;
    const h = this.calcHit ? this.calcHit(e, dmg) : { final: Math.max(1, Math.round(Number(dmg))), crit: false, vamp: 0 };
    const final = h.final;
    e.hp = Math.max(1, e.hp - final);                  // เดาไว้ก่อน รอเซิร์ฟเวอร์ยืนยันเลือดจริง
    opts = opts || {};
    const ctx = (this._skillCtx && this.time.now < this._skillCtx.until) ? this._skillCtx.def : null;
    const skill = opts.skill || ctx;
    try { showDamage(this, e.x, e.y - 20, final, (opts.crit || h.crit) ? 'crit' : 'normal', skill ? { skill: skill } : undefined); } catch (err) { /* ignore */ }
    try { monsterHitFx(this, e); } catch (err) { /* ignore */ }
    pv.hits[e.pid] = (pv.hits[e.pid] || 0) + final;
    if (h.vamp > 0 && this.vampHeal) this.vampHeal(final * h.vamp / 100);
  };

  // ---------- ตัวเราโดนตี / ตาย ----------
  function onMyDeath(m, pv) {
    if (pv.dead || pv.over) return;
    pv.dead = true;
    m.stats.hp = 1;
    if (m.player) m.player.setAlpha(0.35);
    m.manualTarget = null; m.target = null;
    m.socket.emit('pvpDead');
    m.toastMsg('💀 คุณพ่ายแพ้ ดูเพื่อนร่วมทีมต่อจนจบแมตช์');
  }

  const _hurt = P.hurtPlayer;
  P.hurtPlayer = function () {
    const pv = window._pvp;
    if (!pv || !pv.active) return _hurt.apply(this, arguments);
    if (pv.frozen || pv.dead || pv.over) return;          // ช่วงนับถอยหลัง/ตายแล้ว/จบแล้ว = ไม่โดน
    const r = _hurt.apply(this, arguments);
    if (this.stats.hp <= 0) onMyDeath(this, pv);
    return r;
  };

  // กันระบบ "ตายแล้วกลับเมือง" ของ town.js ทำงานกลางสนาม
  ['playerDie', 'playerDied', 'onPlayerDeath', 'playerDeath', 'killPlayer', 'respawnPlayer', 'gameOver'].forEach(name => {
    const o = P[name];
    if (typeof o !== 'function') return;
    P[name] = function () {
      const pv = window._pvp;
      if (!pv || !pv.active) return o.apply(this, arguments);
      onMyDeath(this, pv);
    };
  });

  // ---------- ล็อกการกระทำช่วงนับถอยหลัง/ตายแล้ว ----------
  const locked = () => { const pv = window._pvp; return !!(pv && pv.active && (pv.frozen || pv.dead || pv.over)); };
  ['useBasicAttack', 'useSkill', 'useUlti'].forEach(name => {
    const o = P[name];
    if (typeof o !== 'function') return;
    P[name] = function () { if (locked()) return; return o.apply(this, arguments); };
  });
  const _um = P.updateMovement;
  P.updateMovement = function () {
    const pv = window._pvp;
    if (pv && pv.active && pv.frozen) { if (this.player) this.player.setVelocity(0, 0); return; }
    return _um.apply(this, arguments);
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
    const prev = pv.prevStage;
    Object.values(pv.units).forEach(u => { try { u.sprite.destroy(); u.label.destroy(); } catch (e) { /* ignore */ } });
    if (m._pvpGfx) { m._pvpGfx.destroy(); m._pvpGfx = null; }
    removeHud();
    const ov = document.getElementById('pvp-result'); if (ov) ov.remove();
    window._pvp = null;
    try { m.player.setAlpha(1); } catch (e) { /* ignore */ }
    m.manualTarget = null; m.target = null;
    ['btn-to-town', 'btn-ch'].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = ''; });
    if (!toTown) return;
    m.loadStage(prev);                                  // กลับด่านเดิม (มอนกลับมาเกิดตามปกติ)
    fullHeal(m); resetCooldowns(m);
    try { if (m.online) m.netEnter(m.stageIdx, m.channel, m.netRoom, false); } catch (e) { /* ignore */ }
    townGoToTown(m, notice);
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
    sub.textContent = d.reason === 'time' ? 'หมดเวลา ตัดสินจากเลือดที่เหลือ' : (d.reason === 'draw' ? 'ตายพร้อมกัน' : 'อีกฝ่ายถูกกำจัดหมด');
    card.appendChild(sub);
    [0, 1].forEach(t => {
      const tt = document.createElement('div');
      tt.style.cssText = 'text-align:left;font-size:12px;color:' + (t === pv.team ? '#a8d0ff' : '#ff9a8a') + ';margin:6px 0 2px';
      tt.textContent = t === pv.team ? 'ทีมเรา' : 'ทีมศัตรู';
      card.appendChild(tt);
      d.rows.filter(r => r.team === t).forEach(r => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;padding:4px 8px;margin-bottom:3px;border-radius:8px;background:#3a1620;font-size:13px';
        const a = document.createElement('span'); a.textContent = r.name + (r.id === pv.me ? ' (คุณ)' : '') + (r.alive ? '' : ' 💀');
        const b = document.createElement('span'); b.style.color = '#ffe28a'; b.textContent = 'ฆ่า ' + r.kills + ' • ดาเมจ ' + r.dmg.toLocaleString();
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
    s.on('pvpWait', d => { if (lobbyRef) lobbyRef.onWait(d); });
    s.on('pvpFound', d => startArena(m, d));
    s.on('pvpGo', d => {
      const pv = window._pvp; if (!pv) return;
      pv.frozen = false; pv.endAt = Date.now() + d.ms;
      m.toastMsg('⚔️ เริ่ม!');
    });
    s.on('pvpState', list => {
      const pv = window._pvp; if (!pv) return;
      list.forEach(a => { pv.st[a[0]] = { x: a[1], y: a[2], hp: a[3], maxHp: a[4], alive: !!a[5] }; });
    });
    s.on('pvpHurt', d => {
      const pv = window._pvp;
      if (!pv || !pv.active || pv.frozen || pv.dead || pv.over) return;
      m.hurtPlayer(d.dmg);
    });
    s.on('pvpDead', d => {
      const pv = window._pvp; if (!pv || d.id === pv.me) return;
      const u = pv.units[d.id]; if (!u) return;
      u.alive = false;
      if (u.foe) {
        if (m.target === u.sprite) m.target = null;
        if (m.manualTarget === u.sprite) m.manualTarget = null;
        try { u.sprite.destroy(); u.label.destroy(); } catch (e) { /* ignore */ }
      } else { u.sprite.setAlpha(0.3); u.label.setAlpha(0.5); }
      const killer = d.by === pv.me ? 'คุณ' : (pv.units[d.by] ? pv.units[d.by].name : null);
      m.toastMsg('☠ ' + u.name + ' ถูกกำจัด' + (killer ? ' โดย ' + killer : ''));
    });
    s.on('pvpEnd', d => {
      const pv = window._pvp; if (!pv) return;
      pv.over = true; pv.frozen = false;
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
