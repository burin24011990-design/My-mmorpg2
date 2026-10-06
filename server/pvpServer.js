// ===== PvP ฝั่งเซิร์ฟเวอร์ (1v1 / 3v3 / 5v5 + เพดานจุติต่อห้อง) =====
// วิธีเชื่อม: ใน server.js เพิ่ม 2 บรรทัดนี้ก่อน server.listen(...)
//   const attachPvp = require('./pvpServer');
//   attachPvp(io, players, { leaveRoom });
// กติกา: ตายแล้วเกิดใหม่ (สุ่มจุดในวงปลอดภัย) | ทีมที่ฆ่าได้มากกว่าเมื่อหมดเวลาชนะ | วงปลอดภัยบีบเข้าเรื่อยๆ
// ล็อบบี้แบบห้องรอ: เจ้าห้องสร้างห้อง (เลือก 1v1/3v3/5v5 + เพดานจุติ) | คนอื่นกดเข้าร่วม เลือก/ย้ายฝั่งแดง-น้ำเงินได้ | เจ้าห้องกดเริ่ม
// เซิร์ฟเวอร์คุม: ห้องรอ/นับถอยหลัง/นับฆ่า/เกิดใหม่/ตัดสินผล/เวลา | เครื่องผู้เล่นคุม: ดาเมจที่ตัวเองโดน
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
  // วงปลอดภัย: r0 = รัศมีเริ่มต้น, r1 = รัศมีเล็กสุด (ยิ่งมากยิ่งมีที่หลบ/ใช้สกิล) | เริ่มบีบที่ 30% ของเวลา ถึงเล็กสุดที่ 90%
  const ZONE = { x: 1800, y: 1125, r0: 1100, r1: 560, from: 0.30, to: 0.90 };
  const SKILL_NAME_RE = /^(basic|ulti)_[a-z]{3,10}$|^[a-z]{2,3}_[a-z0-9]{2,16}$/;

  const socks = {};        // socket.id -> socket
  const st = {};           // socket.id -> { room: id ห้องรอ | null, match: id | null }
  const rooms = {};        // id -> ห้องรอ { id, size, bi, host, teams: [[id],[id]], info: { id: ข้อมูลผู้เล่น } }
  const matches = {};      // id -> match
  let nextId = 1, nextRoom = 1;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const emitMatch = (m, ev, data) => {
    m.ids.forEach(id => { const p = m.pl[id]; if (p && !p.left && socks[id]) socks[id].emit(ev, data); });
  };

  // ---------- ห้องรอ ----------
  const readInfo = (p, d) => ({
    name: p.name,
    rebirth: clamp(Math.floor(num(d.rebirth)), 0, MAX_REBIRTH),
    level: clamp(Math.floor(num(d.level)) || 1, 1, LEVEL_CAP),
    maxHp: clamp(Math.floor(num(d.maxHp)) || 100, 1, 1e9),
    cls: (typeof d.cls === 'string' && /^[a-z]{3,10}$/.test(d.cls)) ? d.cls : 'sword',
  });
  const roomCount = r => r.teams[0].length + r.teams[1].length;
  const roomPack = r => ({
    id: r.id, size: r.size, bi: r.bi, cap: CAPS[r.bi], host: r.host,
    teams: r.teams.map(list => list.map(id => { const i = r.info[id]; return { id, name: i.name, level: i.level, rebirth: i.rebirth, cls: i.cls }; })),
  });
  function pushRoom(r) {                                   // ส่งสถานะห้องให้ทุกคนในห้อง
    const d = roomPack(r);
    r.teams.forEach(list => list.forEach(id => { if (socks[id]) socks[id].emit('pvpRoom', d); }));
  }
  function leavePvpRoom(id) {
    const me = st[id];
    if (!me || !me.room) return;
    const r = rooms[me.room];
    me.room = null;
    if (!r) return;
    r.teams = r.teams.map(l => l.filter(x => x !== id));
    delete r.info[id];
    if (roomCount(r) === 0) { delete rooms[r.id]; return; }
    if (r.host === id) r.host = r.teams[0][0] || r.teams[1][0];   // ย้ายเจ้าห้องให้คนถัดไป
    pushRoom(r);
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

  // เริ่มแมตช์จากห้องรอ (ทีมตามที่ผู้เล่นเลือกฝั่งเอง ไม่จัดทีมใหม่)
  function createMatch(r) {
    const size = r.size, bi = r.bi;
    const ids = r.teams[0].concat(r.teams[1]);
    const m = { id: nextId++, size, bi, ids: ids.slice(), teams: [r.teams[0].slice(), r.teams[1].slice()], pl: {}, state: 'countdown', endAt: 0, liveAt: 0 };
    m.teams.forEach((list, team) => list.forEach((id, idx) => {
      const info = r.info[id];
      m.pl[id] = {
        id, team, name: info.name, level: info.level, rebirth: info.rebirth, cls: info.cls,
        hp: info.maxHp, maxHp: info.maxHp, alive: true, left: false,
        x: SPAWN_X[team], y: SPAWN_Y + (idx - (list.length - 1) / 2) * 110,
        kills: 0, deaths: 0, dmg: 0, lastBy: null, lastAt: 0, hitWin: 0, hitN: 0,
        protUntil: 0, noMoveUntil: 0, rt: null,
      };
      st[id].room = null; st[id].match = m.id;
      try { helpers.leaveRoom(socks[id]); } catch (e) { /* ignore */ }   // ออกจากห้องล่ามอนก่อน
    }));
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
    st[socket.id] = { room: null, match: null };

    // รายชื่อห้องรอที่เปิดอยู่
    socket.on('pvpRooms', cb => {
      if (typeof cb !== 'function') return;
      cb({ rooms: Object.values(rooms).map(r => ({ id: r.id, size: r.size, bi: r.bi, cap: CAPS[r.bi], n: roomCount(r), host: r.info[r.host] ? r.info[r.host].name : '?' })) });
    });

    // สร้างห้อง: d = { size, bi, level, rebirth, maxHp, cls }
    socket.on('pvpCreate', (d, cb) => {
      cb = typeof cb === 'function' ? cb : () => {};
      const p = players[socket.id], me = st[socket.id];
      if (!p || !me) return cb({ ok: false, reason: 'notjoined' });
      if (me.match) return cb({ ok: false, reason: 'inmatch' });
      d = d || {};
      const size = d.size, bi = d.bi;
      if (SIZES.indexOf(size) < 0 || !Number.isInteger(bi) || bi < 0 || bi >= CAPS.length) return cb({ ok: false, reason: 'bad' });
      const info = readInfo(p, d);
      if (info.rebirth > CAPS[bi]) return cb({ ok: false, reason: 'rebirth' });   // จุติเกินเพดานห้อง
      leavePvpRoom(socket.id);
      const r = { id: nextRoom++, size, bi, host: socket.id, teams: [[socket.id], []], info: {} };
      r.info[socket.id] = info;
      rooms[r.id] = r; me.room = r.id;
      cb({ ok: true, room: roomPack(r) });
    });

    // เข้าร่วมห้อง: d = { roomId, team (ฝั่งที่อยากอยู่ 0=แดง 1=น้ำเงิน), level, rebirth, maxHp, cls }
    socket.on('pvpJoin', (d, cb) => {
      cb = typeof cb === 'function' ? cb : () => {};
      const p = players[socket.id], me = st[socket.id];
      if (!p || !me) return cb({ ok: false, reason: 'notjoined' });
      if (me.match) return cb({ ok: false, reason: 'inmatch' });
      d = d || {};
      const r = rooms[d.roomId];
      if (!r) return cb({ ok: false, reason: 'gone' });
      if (me.room === r.id) return cb({ ok: true, room: roomPack(r) });
      const info = readInfo(p, d);
      if (info.rebirth > CAPS[r.bi]) return cb({ ok: false, reason: 'rebirth' });
      const pref = d.team === 1 ? 1 : 0;
      const t = r.teams[pref].length < r.size ? pref : (r.teams[1 - pref].length < r.size ? 1 - pref : -1);
      if (t < 0) return cb({ ok: false, reason: 'full' });
      leavePvpRoom(socket.id);
      r.teams[t].push(socket.id); r.info[socket.id] = info; me.room = r.id;
      cb({ ok: true, room: roomPack(r) });
      pushRoom(r);
    });

    // ย้ายฝั่งในห้อง: d = { team }
    socket.on('pvpSwitch', (d, cb) => {
      cb = typeof cb === 'function' ? cb : () => {};
      const me = st[socket.id], r = me && rooms[me.room];
      if (!r) return cb({ ok: false, reason: 'noroom' });
      const t = d && d.team === 1 ? 1 : 0, cur = r.teams[0].indexOf(socket.id) >= 0 ? 0 : 1;
      if (t === cur) return cb({ ok: true });
      if (r.teams[t].length >= r.size) return cb({ ok: false, reason: 'full' });
      r.teams[cur] = r.teams[cur].filter(x => x !== socket.id);
      r.teams[t].push(socket.id);
      cb({ ok: true });
      pushRoom(r);
    });

    socket.on('pvpLeaveRoom', () => leavePvpRoom(socket.id));

    // เจ้าห้องกดเริ่ม (ต้องมีคนอย่างน้อยฝั่งละ 1)
    socket.on('pvpStart', cb => {
      cb = typeof cb === 'function' ? cb : () => {};
      const me = st[socket.id], r = me && rooms[me.room];
      if (!r) return cb({ ok: false, reason: 'noroom' });
      if (r.host !== socket.id) return cb({ ok: false, reason: 'nothost' });
      if (!r.teams[0].length || !r.teams[1].length) return cb({ ok: false, reason: 'needboth' });
      if (r.teams.some(l => l.some(id => !socks[id] || !players[id] || !st[id]))) return cb({ ok: false, reason: 'gone' });
      delete rooms[r.id];
      cb({ ok: true });
      createMatch(r);
    });

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
      leavePvpRoom(socket.id);
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
