// ===== PvP ฝั่งเซิร์ฟเวอร์ (1v1 / 3v3 / 5v5 + เพดานจุติต่อห้อง) =====
// วิธีเชื่อม: ใน server.js เพิ่ม 2 บรรทัดนี้ก่อน server.listen(...)
//   const attachPvp = require('./pvpServer');
//   attachPvp(io, players, { leaveRoom });
// กติกาใหม่: ตายแล้วเกิดใหม่ (สุ่มจุดในวงปลอดภัย) | ทีมที่ฆ่าได้มากกว่าเมื่อหมดเวลาชนะ | วงปลอดภัยบีบเข้าเรื่อยๆ
// เซิร์ฟเวอร์คุม: คิว/จับทีม/นับถอยหลัง/นับฆ่า/เกิดใหม่/ตัดสินผล/เวลา | เครื่องผู้เล่นคุม: ดาเมจที่ตัวเองโดน
module.exports = function attachPvp(io, players, helpers) {
  const SIZES = [1, 3, 5];                                  // ผู้เล่นต่อทีม
  const CAPS = [0, 3, 6, 8, 11, 15, 19, 24];                // เพดานจุติของแต่ละห้อง
  const DURATION = { 1: 150000, 3: 210000, 5: 270000 };     // เวลาแมตช์ (ms)
  const COUNTDOWN_MS = 5000;
  const RESPAWN_MS = 3000;                                  // รอเกิดใหม่หลังตาย
  const PROTECT_MS = 2500;                                  // อมตะหลังเกิดใหม่
  const HIT_MAX_DIST = 1600;                                // ตีไกลเกินนี้ไม่นับ (กันโกงเบื้องต้น)
  const WORLD_W = 3600, WORLD_H = 2250, LEVEL_CAP = 90, MAX_REBIRTH = 24;
  const SPAWN_X = [1250, 2350], SPAWN_Y = 1125;
  // วงปลอดภัย: เริ่มบีบเมื่อผ่านไป 25% ของเวลา และเล็กสุดที่ 85% (ปรับเลขได้)
  const ZONE = { x: 1800, y: 1125, r0: 1100, r1: 160, from: 0.25, to: 0.85 };
  const SKILL_NAME_RE = /^(basic|ulti)_[a-z]{3,10}$|^[a-z]{2,3}_[a-z0-9]{2,16}$/;

  const socks = {};        // socket.id -> socket
  const st = {};           // socket.id -> { q: คีย์คิว | null, match: id | null, info }
  const queues = {};       // 'ขนาด-ห้อง' -> [socket.id]
  const matches = {};      // id -> match
  let nextId = 1;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const qkey = (size, bi) => size + '-' + bi;
  SIZES.forEach(s => CAPS.forEach((c, bi) => { queues[qkey(s, bi)] = []; }));

  const emitMatch = (m, ev, data) => {
    m.ids.forEach(id => { const p = m.pl[id]; if (p && !p.left && socks[id]) socks[id].emit(ev, data); });
  };

  function removeFromQueue(id) {
    for (const k in queues) {
      const i = queues[k].indexOf(id);
      if (i >= 0) { queues[k].splice(i, 1); announce(k); }
    }
    if (st[id]) st[id].q = null;
  }

  function announce(key) {
    const need = parseInt(key, 10) * 2, n = queues[key].length;
    queues[key].forEach(id => { if (socks[id]) socks[id].emit('pvpWait', { key, waiting: n, need }); });
  }

  function tryForm(key) {
    const size = parseInt(key, 10), bi = parseInt(key.split('-')[1], 10), need = size * 2, q = queues[key];
    while (q.length >= need) {
      const ids = q.splice(0, need);
      const ok = ids.filter(id => socks[id] && players[id] && st[id]);
      if (ok.length < need) { q.unshift.apply(q, ok); break; }   // มีคนหลุด: คืนคนที่เหลือเข้าคิว
      createMatch(ids, size, bi);
    }
    announce(key);
  }

  // รัศมีวงปลอดภัย ณ เวลานั้น (สูตรเดียวกับฝั่งเกม)
  function zoneRadius(m, now) {
    const k = (now - m.liveAt) / DURATION[m.size];
    const t = clamp((k - ZONE.from) / (ZONE.to - ZONE.from), 0, 1);
    return ZONE.r0 + (ZONE.r1 - ZONE.r0) * t;
  }

  // สุ่มจุดเกิดใหม่ "ในวงปลอดภัย" และพยายามไม่ใกล้ศัตรู
  function pickSpawn(m, me) {
    const R = zoneRadius(m, Date.now()) * 0.8;
    const foes = m.ids.map(i => m.pl[i]).filter(q => q.alive && !q.left && q.team !== me.team);
    let best = null, bestD = -1;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R;
      const x = ZONE.x + Math.cos(a) * r, y = ZONE.y + Math.sin(a) * r;
      const d = foes.reduce((mn, q) => Math.min(mn, Math.hypot(q.x - x, q.y - y)), 1e9);
      if (d >= 450) return { x, y };
      if (d > bestD) { bestD = d; best = { x, y }; }
    }
    return best;
  }

  function createMatch(ids, size, bi) {
    const power = id => st[id].info.rebirth * 100 + st[id].info.level;
    ids.sort((a, b) => power(b) - power(a));
    const order = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1];           // แจกทีมแบบงู ให้สมดุลตามกำลัง
    const m = { id: nextId++, size, bi, ids: ids.slice(), teams: [[], []], pl: {}, state: 'countdown', endAt: 0, liveAt: 0 };
    ids.forEach((id, i) => {
      const team = order[i], idx = m.teams[team].length, info = st[id].info;
      m.teams[team].push(id);
      m.pl[id] = {
        id, team, name: info.name, level: info.level, rebirth: info.rebirth, cls: info.cls,
        hp: info.maxHp, maxHp: info.maxHp, alive: true, left: false,
        x: SPAWN_X[team], y: SPAWN_Y + (idx - (size - 1) / 2) * 110,
        kills: 0, deaths: 0, dmg: 0, lastBy: null, lastAt: 0, hitWin: 0, hitN: 0,
        protUntil: 0, noMoveUntil: 0, rt: null,
      };
      st[id].q = null; st[id].match = m.id;
      try { helpers.leaveRoom(socks[id]); } catch (e) { /* ignore */ }   // ออกจากห้องล่ามอนก่อน
    });
    matches[m.id] = m;
    const pack = t => m.teams[t].map(id => { const p = m.pl[id]; return { id, name: p.name, level: p.level, rebirth: p.rebirth, maxHp: p.maxHp, cls: p.cls }; });
    const teams = [pack(0), pack(1)];
    ids.forEach(id => socks[id].emit('pvpFound', { id: m.id, size, bi, cap: CAPS[bi], team: m.pl[id].team, teams, countdown: COUNTDOWN_MS, duration: DURATION[size] }));
    m.timer = setTimeout(() => {
      if (m.state !== 'countdown') return;
      m.state = 'live'; m.liveAt = Date.now(); m.endAt = m.liveAt + DURATION[size];
      emitMatch(m, 'pvpGo', { ms: DURATION[size], zone: ZONE, respawn: RESPAWN_MS });
    }, COUNTDOWN_MS);
  }

  function scheduleRespawn(m, id) {
    const p = m.pl[id];
    clearTimeout(p.rt);
    p.rt = setTimeout(() => {
      if (m.state !== 'live' || p.left || p.alive) return;
      const pt = pickSpawn(m, p), now = Date.now();
      p.alive = true; p.hp = p.maxHp; p.x = pt.x; p.y = pt.y;
      p.protUntil = now + PROTECT_MS; p.noMoveUntil = now + 400;
      p.lastBy = null;
      emitMatch(m, 'pvpRespawn', { id, x: Math.round(pt.x), y: Math.round(pt.y), prot: PROTECT_MS });
    }, RESPAWN_MS);
  }

  // ตายไม่ได้ตกรอบแล้ว: นับฆ่า/ตาย แล้วรอเกิดใหม่
  function kill(m, id) {
    const p = m.pl[id];
    if (!p || !p.alive || m.state !== 'live') return;
    p.alive = false; p.hp = 0; p.deaths++;
    const killer = (p.lastBy && Date.now() - p.lastAt < 8000 && m.pl[p.lastBy] && m.pl[p.lastBy].team !== p.team) ? p.lastBy : null;
    if (killer) m.pl[killer].kills++;
    emitMatch(m, 'pvpDead', { id, by: killer });
    scheduleRespawn(m, id);
  }

  function finish(m, winner, reason) {
    if (m.state === 'over') return;
    m.state = 'over';
    clearTimeout(m.timer);
    m.ids.forEach(id => clearTimeout(m.pl[id].rt));
    const rows = m.ids.map(id => { const p = m.pl[id]; return { id, name: p.name, team: p.team, kills: p.kills, deaths: p.deaths, dmg: Math.round(p.dmg), alive: p.alive, left: p.left }; });
    emitMatch(m, 'pvpEnd', { winner, reason, rows });
    m.ids.forEach(id => { if (st[id] && st[id].match === m.id) st[id].match = null; });
    setTimeout(() => { delete matches[m.id]; }, 1000);
  }

  // หมดเวลา: ทีมที่ฆ่ารวมมากกว่าชนะ | ถ้าเท่ากันดูดาเมจรวม | ถ้ายังเท่ากันเสมอ
  function timeUp(m) {
    const sum = (t, f) => m.teams[t].reduce((s, id) => s + m.pl[id][f], 0);
    const k0 = sum(0, 'kills'), k1 = sum(1, 'kills');
    if (k0 !== k1) return finish(m, k0 > k1 ? 0 : 1, 'time');
    const d0 = sum(0, 'dmg'), d1 = sum(1, 'dmg');
    if (Math.abs(d0 - d1) < 1) return finish(m, -1, 'draw');
    finish(m, d0 > d1 ? 0 : 1, 'timeDmg');
  }

  // ทีมใดทีมหนึ่งออกหมด -> อีกทีมชนะ
  function checkForfeit(m) {
    if (m.state === 'over') return;
    const gone = t => m.teams[t].every(id => m.pl[id].left);
    const g0 = gone(0), g1 = gone(1);
    if (g0 && g1) finish(m, -1, 'forfeit');
    else if (g0) finish(m, 1, 'forfeit');
    else if (g1) finish(m, 0, 'forfeit');
  }

  setInterval(() => {
    const now = Date.now();
    for (const id in matches) {
      const m = matches[id];
      if (m.state === 'live' && now > m.endAt) { timeUp(m); continue; }
      if (m.state === 'live' || m.state === 'countdown') {
        emitMatch(m, 'pvpState', m.ids.map(pid => { const p = m.pl[pid]; return [pid, Math.round(p.x), Math.round(p.y), Math.round(p.hp), p.maxHp, p.alive ? 1 : 0, p.kills]; }));
      }
    }
  }, 50);

  io.on('connection', socket => {
    socks[socket.id] = socket;
    st[socket.id] = { q: null, match: null, info: null };

    // ขอจำนวนคนที่รอในแต่ละห้อง
    socket.on('pvpInfo', cb => {
      if (typeof cb !== 'function') return;
      const queuesCount = {};
      for (const k in queues) queuesCount[k] = queues[k].length;
      cb({ queues: queuesCount, caps: CAPS });
    });

    // เข้าคิว: d = { size, bi, level, rebirth, maxHp, cls }
    socket.on('pvpQueue', (d, cb) => {
      cb = typeof cb === 'function' ? cb : () => {};
      const p = players[socket.id], me = st[socket.id];
      if (!p || !me) return cb({ ok: false, reason: 'notjoined' });
      if (me.match) return cb({ ok: false, reason: 'inmatch' });
      d = d || {};
      const size = d.size, bi = d.bi;
      if (SIZES.indexOf(size) < 0 || !Number.isInteger(bi) || bi < 0 || bi >= CAPS.length) return cb({ ok: false, reason: 'bad' });
      const rebirth = clamp(Math.floor(num(d.rebirth)), 0, MAX_REBIRTH);
      if (rebirth > CAPS[bi]) return cb({ ok: false, reason: 'rebirth' });   // จุติเกินเพดานห้อง
      removeFromQueue(socket.id);
      me.info = {
        name: p.name, rebirth,
        level: clamp(Math.floor(num(d.level)) || 1, 1, LEVEL_CAP),
        maxHp: clamp(Math.floor(num(d.maxHp)) || 100, 1, 1e9),
        cls: (typeof d.cls === 'string' && /^[a-z]{3,10}$/.test(d.cls)) ? d.cls : 'sword',
      };
      me.q = qkey(size, bi);
      queues[me.q].push(socket.id);
      cb({ ok: true, waiting: queues[me.q].length, need: size * 2 });
      announce(me.q);
      tryForm(me.q);
    });

    socket.on('pvpCancel', () => removeFromQueue(socket.id));

    // ตำแหน่ง + เลือดของตัวเอง
    socket.on('pvpMove', d => {
      const me = st[socket.id], m = me && matches[me.match];
      if (!m || m.state === 'over' || !d) return;
      const p = m.pl[socket.id];
      if (!p || p.left || !p.alive) return;                 // ตายอยู่ไม่ต้องอัปเดต
      if (Date.now() < p.noMoveUntil) return;               // เพิ่งเกิดใหม่: กันข้อมูลเก่าตีกลับ
      p.x = clamp(num(d.x), 0, WORLD_W); p.y = clamp(num(d.y), 0, WORLD_H);
      p.maxHp = clamp(Math.floor(num(d.maxHp)) || p.maxHp, 1, 1e9); p.hp = clamp(num(d.hp), 0, p.maxHp);
    });

    // ตีคู่ต่อสู้: list = [[id เป้าหมาย, ดาเมจ], ...]
    socket.on('pvpHit', list => {
      const me = st[socket.id], m = me && matches[me.match];
      if (!m || m.state !== 'live' || !Array.isArray(list)) return;
      const s = m.pl[socket.id];
      if (!s || !s.alive || s.left) return;
      const now = Date.now();
      if (now - s.hitWin > 1000) { s.hitWin = now; s.hitN = 0; }
      const sum = {};
      for (const h of list.slice(0, 60)) {
        if (++s.hitN > 400) break;
        if (!Array.isArray(h)) continue;
        const t = m.pl[h[0]];
        if (!t || !t.alive || t.left || t.team === s.team) continue;
        if (now < t.protUntil) continue;                    // เป้าหมายยังอมตะหลังเกิดใหม่
        const dmg = clamp(Math.floor(num(h[1])), 0, 1e9);
        if (!dmg) continue;
        if (Math.hypot(s.x - t.x, s.y - t.y) > HIT_MAX_DIST) continue;
        sum[h[0]] = (sum[h[0]] || 0) + dmg;
        t.lastBy = socket.id; t.lastAt = now; s.dmg += dmg;
      }
      Object.keys(sum).forEach(id => { if (socks[id]) socks[id].emit('pvpHurt', { dmg: sum[id], by: socket.id }); });
    });

    // เอฟเฟกต์สกิล (ให้คนในแมตช์เห็น)
    socket.on('pvpSkill', d => {
      const me = st[socket.id], m = me && matches[me.match];
      if (!m || m.state !== 'live' || !d || typeof d.name !== 'string' || d.name.length > 24 || !SKILL_NAME_RE.test(d.name)) return;
      const p = m.pl[socket.id];
      if (!p || !p.alive || p.left) return;
      const out = { id: socket.id, name: d.name, x: num(d.x), y: num(d.y), fx: num(d.fx), fy: num(d.fy), stage: d.stage };
      m.ids.forEach(id => { if (id !== socket.id && m.pl[id] && !m.pl[id].left && socks[id]) socks[id].emit('skill', out); });
    });

    // ผู้เล่นรายงานว่าเลือดหมด
    socket.on('pvpDead', () => {
      const me = st[socket.id], m = me && matches[me.match];
      if (m) kill(m, socket.id);
    });

    // ออกจากแมตช์/คิวเอง (ยอมแพ้ = ออกจากแมตช์ ถ้าทีมออกหมดอีกฝั่งชนะ)
    function leave() {
      removeFromQueue(socket.id);
      const me = st[socket.id], m = me && matches[me.match];
      if (m && m.pl[socket.id]) {
        const p = m.pl[socket.id];
        if (!p.left) {
          p.left = true; p.alive = false; clearTimeout(p.rt);
          emitMatch(m, 'pvpDead', { id: socket.id, by: null, left: true });
          checkForfeit(m);
        }
        me.match = null;
      }
    }
    socket.on('pvpLeave', leave);
    socket.on('disconnect', () => { leave(); delete socks[socket.id]; delete st[socket.id]; });
  });
};
