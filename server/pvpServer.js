// ===== PvP ฝั่งเซิร์ฟเวอร์ (1v1 / 3v3 / 5v5 + เพดานจุติต่อห้อง) =====
// วิธีเชื่อม: ใน server.js เพิ่ม 2 บรรทัดนี้ก่อน server.listen(...)
//   const attachPvp = require('./pvpServer');
//   attachPvp(io, players, { leaveRoom });
// เซิร์ฟเวอร์คุม: คิว/จับทีม/นับถอยหลัง/ตัดสินผลแพ้ชนะ/เวลา | เครื่องผู้เล่นคุม: ดาเมจที่ตัวเองโดน (เหมือนโหมดมอน)
module.exports = function attachPvp(io, players, helpers) {
  const SIZES = [1, 3, 5];                                  // ผู้เล่นต่อทีม
  const CAPS = [0, 3, 6, 8, 11, 15, 19, 24];                // เพดานจุติของแต่ละห้อง
  const DURATION = { 1: 150000, 3: 210000, 5: 270000 };     // เวลาแมตช์ (ms)
  const COUNTDOWN_MS = 5000;
  const HIT_MAX_DIST = 1600;                                // ตีไกลเกินนี้ไม่นับ (กันโกงเบื้องต้น)
  const WORLD_W = 3600, WORLD_H = 2250, LEVEL_CAP = 90, MAX_REBIRTH = 24;
  const SPAWN_X = [1250, 2350], SPAWN_Y = 1125;
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

  function createMatch(ids, size, bi) {
    const power = id => st[id].info.rebirth * 100 + st[id].info.level;
    ids.sort((a, b) => power(b) - power(a));
    const order = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1];           // แจกทีมแบบงู ให้สมดุลตามกำลัง
    const m = { id: nextId++, size, bi, ids: ids.slice(), teams: [[], []], pl: {}, state: 'countdown', endAt: 0 };
    ids.forEach((id, i) => {
      const team = order[i], idx = m.teams[team].length, info = st[id].info;
      m.teams[team].push(id);
      m.pl[id] = {
        id, team, name: info.name, level: info.level, rebirth: info.rebirth,
        hp: info.maxHp, maxHp: info.maxHp, alive: true, left: false,
        x: SPAWN_X[team], y: SPAWN_Y + (idx - (size - 1) / 2) * 110,
        kills: 0, dmg: 0, lastBy: null, lastAt: 0, hitWin: 0, hitN: 0,
      };
      st[id].q = null; st[id].match = m.id;
      try { helpers.leaveRoom(socks[id]); } catch (e) { /* ignore */ }   // ออกจากห้องล่ามอนก่อน
    });
    matches[m.id] = m;
    const pack = t => m.teams[t].map(id => { const p = m.pl[id]; return { id, name: p.name, level: p.level, rebirth: p.rebirth, maxHp: p.maxHp }; });
    const teams = [pack(0), pack(1)];
    ids.forEach(id => socks[id].emit('pvpFound', { id: m.id, size, bi, cap: CAPS[bi], team: m.pl[id].team, teams, countdown: COUNTDOWN_MS, duration: DURATION[size] }));
    m.timer = setTimeout(() => {
      if (m.state !== 'countdown') return;
      m.state = 'live'; m.endAt = Date.now() + DURATION[size];
      emitMatch(m, 'pvpGo', { ms: DURATION[size] });
    }, COUNTDOWN_MS);
  }

  function aliveCount(m, t) { return m.teams[t].filter(id => m.pl[id].alive).length; }

  function kill(m, id) {
    const p = m.pl[id];
    if (!p || !p.alive) return;
    p.alive = false; p.hp = 0;
    const killer = (p.lastBy && Date.now() - p.lastAt < 8000 && m.pl[p.lastBy]) ? p.lastBy : null;
    if (killer) m.pl[killer].kills++;
    emitMatch(m, 'pvpDead', { id, by: killer });
    if (m.state === 'live' || m.state === 'countdown') {
      const a0 = aliveCount(m, 0), a1 = aliveCount(m, 1);
      if (a0 === 0 && a1 === 0) finish(m, -1, 'draw');
      else if (a0 === 0) finish(m, 1, 'elim');
      else if (a1 === 0) finish(m, 0, 'elim');
    }
  }

  function finish(m, winner, reason) {
    if (m.state === 'over') return;
    m.state = 'over';
    clearTimeout(m.timer);
    const rows = m.ids.map(id => { const p = m.pl[id]; return { id, name: p.name, team: p.team, kills: p.kills, dmg: Math.round(p.dmg), alive: p.alive, left: p.left }; });
    emitMatch(m, 'pvpEnd', { winner, reason, rows });
    m.ids.forEach(id => { if (st[id] && st[id].match === m.id) st[id].match = null; });
    setTimeout(() => { delete matches[m.id]; }, 1000);
  }

  // หมดเวลา: ทีมที่ผลรวม % เลือดของคนที่ยังรอดมากกว่าชนะ
  function timeUp(m) {
    const score = t => m.teams[t].reduce((s, id) => { const p = m.pl[id]; return s + (p.alive ? clamp(p.hp / Math.max(1, p.maxHp), 0, 1) : 0); }, 0);
    const a = score(0), b = score(1);
    finish(m, Math.abs(a - b) < 0.001 ? -1 : (a > b ? 0 : 1), 'time');
  }

  setInterval(() => {
    const now = Date.now();
    for (const id in matches) {
      const m = matches[id];
      if (m.state === 'live' && now > m.endAt) { timeUp(m); continue; }
      if (m.state === 'live' || m.state === 'countdown') {
        emitMatch(m, 'pvpState', m.ids.map(pid => { const p = m.pl[pid]; return [pid, Math.round(p.x), Math.round(p.y), Math.round(p.hp), p.maxHp, p.alive ? 1 : 0]; }));
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

    // เข้าคิว: d = { size, bi, level, rebirth, maxHp }
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
      if (!p || p.left) return;
      p.x = clamp(num(d.x), 0, WORLD_W); p.y = clamp(num(d.y), 0, WORLD_H);
      if (p.alive) { p.maxHp = clamp(Math.floor(num(d.maxHp)) || p.maxHp, 1, 1e9); p.hp = clamp(num(d.hp), 0, p.maxHp); }
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

    // ออกจากแมตช์/คิวเอง (ยอมแพ้ = นับว่าตาย)
    function leave() {
      removeFromQueue(socket.id);
      const me = st[socket.id], m = me && matches[me.match];
      if (m && m.pl[socket.id]) {
        kill(m, socket.id);
        if (m.pl[socket.id]) m.pl[socket.id].left = true;
        me.match = null;
      }
    }
    socket.on('pvpLeave', leave);
    socket.on('disconnect', () => { leave(); delete socks[socket.id]; delete st[socket.id]; });
  });
};
