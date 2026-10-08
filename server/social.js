// social.js (เซิร์ฟเวอร์) -- ระบบเพื่อน + ปาร์ตี้ | ใช้ใน server.js: const social = require('./social')(io, players);
// v+: เพิ่มอีเวนต์ 'pfx' = สกิลฮีล/บัพหมู่ ส่งถึงเพื่อนในปาร์ตี้ที่อยู่ห้องเดียวกันและอยู่ในระยะ
// v++: โหมดปาร์ตี้ -- expShare (แชร์ EXP เปิด/ปิด) + lootMode (own = ใครตีตัวสุดท้ายได้ / random = สุ่มแจก / rotate = สลับกันเก็บ)
//      หัวหน้าตั้งค่าผ่านอีเวนต์ 'pSet' | คืนค่า { getParty } ให้ server.js ใช้ตอนมอนตาย
module.exports = function (io, players) {
  const parties = {};
  let nextPid = 1;
  const MAX = 5;
  const BONUS = { 3: 10, 4: 20, 5: 40 };   // โบนัสปาร์ตี้ (%) ตามจำนวนคน | 2 คน = ไม่มีโบนัส
  const INVITE_MS = 30000;
  const LOOT_MODES = { own: 1, random: 1, rotate: 1 };
  const PFX_KINDS = { heal: 1, buff: 1 };  // ชนิดเอฟเฟกต์หมู่ที่ยอมให้ส่ง
  const PFX_MAX_RANGE = 800;               // ระยะสูงสุด (px) ที่เพื่อนจะได้รับผล
  const clean = (v, a, b, d) => { v = Number(v); return isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
  const fn = cb => (typeof cb === 'function' ? cb : () => {});

  function snapshot(P) {
    return {
      id: P.id, leader: P.leader, bonus: BONUS[P.members.length] || 0,
      expShare: P.expShare !== false, lootMode: P.lootMode || 'own',
      members: P.members.map(id => {
        const p = players[id] || {};
        return { id, name: p.name || '?', lv: p.lv || 1, hp: p.hp || 0, mhp: p.mhp || 1, stage: p.stage, ch: p.ch, rm: p.rm };
      }),
    };
  }
  const push = P => P.members.forEach(id => io.to(id).emit('party', snapshot(P)));

  function leave(id, kicked) {
    const p = players[id];
    if (!p || !p.party) return;
    const P = parties[p.party];
    p.party = null;
    io.to(id).emit('party', null);
    if (!P) return;
    if (kicked) io.to(id).emit('pMsg', 'คุณถูกเตะออกจากปาร์ตี้');
    P.members = P.members.filter(m => m !== id);
    if (P.members.length < 2) {
      P.members.forEach(m => {
        if (players[m]) { players[m].party = null; io.to(m).emit('party', null); io.to(m).emit('pMsg', 'ปาร์ตี้ถูกยุบ'); }
      });
      delete parties[P.id];
      return;
    }
    if (P.leader === id) P.leader = P.members[0];
    push(P);
  }

  io.on('connection', socket => {
    const me = () => players[socket.id];
    const throttle = (key, ms) => {
      const p = me(); if (!p) return true;
      const now = Date.now();
      if (now - (p[key] || 0) < ms) return true;
      p[key] = now; return false;
    };

    // ซิงค์ HP/เลเวล (ใช้แสดงในปาร์ตี้)
    socket.on('hp', d => {
      const p = me(); if (!p || !d) return;
      p.hp = clean(d.hp, 0, 1e9, 0);
      p.mhp = clean(d.mhp, 1, 1e9, 1);
      p.lv = clean(d.lv, 1, 999, p.lv || 1);
    });

    // ----- สกิลฮีล/บัพหมู่ -----
    // ผู้ใช้สกิลส่ง: { kind:'heal'|'buff', name, range, amt, pct, ms, stat }
    //   heal: amt = HP ที่ฟื้นให้เพื่อนแต่ละคน (ฝั่งผู้รับเป็นคนบวก HP เอง)
    //   buff: stat = 'atk'|'def'|'spd'|... pct = % ที่เพิ่ม ms = ระยะเวลา
    // เซิร์ฟเวอร์ส่งต่อเฉพาะเพื่อนในปาร์ตี้เดียวกัน + ห้องเดียวกัน + อยู่ในระยะ แล้วส่ง 'pfx' ให้เพื่อนแต่ละคน
    socket.on('pfx', d => {
      const p = me();
      if (!p || !p.party || !p.room || !d || typeof d !== 'object') return;
      if (throttle('_tPfx', 150)) return;
      const kind = String(d.kind || '');
      if (!PFX_KINDS[kind]) return;
      const P = parties[p.party];
      if (!P) return;
      const range = clean(d.range, 0, PFX_MAX_RANGE, 400);
      const out = {
        from: p.id, kind,
        name: String(d.name || '').slice(0, 24),
        stat: String(d.stat || '').replace(/[^a-z]/gi, '').slice(0, 12),
        amt: Math.floor(clean(d.amt, 0, 1e7, 0)),
        pct: clean(d.pct, 0, 300, 0),
        ms: Math.floor(clean(d.ms, 0, 60000, 0)),
        x: p.x, y: p.y,
      };
      P.members.forEach(id => {
        if (id === p.id) return;
        const q = players[id];
        if (!q || q.room !== p.room) return;
        if (Math.hypot(q.x - p.x, q.y - p.y) > range) return;
        io.to(id).emit('pfx', out);
      });
    });

    // ----- เพื่อน -----
    socket.on('friendReq', (d, cb) => {
      cb = fn(cb);
      const p = me(); if (!p || !d) return cb({ ok: false, msg: 'ผิดพลาด' });
      if (throttle('_tFr', 1000)) return cb({ ok: false, msg: 'ช้าลงหน่อย' });
      const t = players[d.to];
      if (!t || t.id === p.id) return cb({ ok: false, msg: 'ไม่พบผู้เล่น' });
      if (!p.cid || !t.cid) return cb({ ok: false, msg: 'ผู้เล่นนี้ยังไม่มีบัญชี' });
      t.reqIn = t.reqIn || {};
      t.reqIn[p.id] = Date.now();
      io.to(t.id).emit('friendReq', { from: p.id, cid: p.cid, name: p.name });
      cb({ ok: true, msg: 'ส่งคำขอเป็นเพื่อนแล้ว' });
    });

    socket.on('friendAcc', d => {
      const p = me(); if (!p || !d) return;
      const t = players[d.to];
      const ts = p.reqIn && p.reqIn[d.to];
      if (!t || !ts || Date.now() - ts > 60000) return;
      delete p.reqIn[d.to];
      io.to(t.id).emit('friendOk', { cid: p.cid, name: p.name });
    });

    // สถานะออนไลน์ของเพื่อน: list = [cid,...] -> { cid: {sid, stage, ch, rm} }
    socket.on('friendsStatus', (list, cb) => {
      cb = fn(cb);
      if (!Array.isArray(list) || throttle('_tFs', 1000)) return;
      const want = new Set(list.slice(0, 100).map(String));
      const out = {};
      for (const id in players) {
        const q = players[id];
        if (q.cid && want.has(q.cid)) out[q.cid] = { sid: q.id, stage: q.stage, ch: q.ch, rm: q.rm };
      }
      cb(out);
    });

    // ----- ปาร์ตี้ -----
    socket.on('pInvite', (d, cb) => {
      cb = fn(cb);
      const p = me(); if (!p || !d) return cb({ ok: false, msg: 'ผิดพลาด' });
      if (throttle('_tPi', 1000)) return cb({ ok: false, msg: 'ช้าลงหน่อย' });
      const t = players[d.to];
      if (!t || t.id === p.id) return cb({ ok: false, msg: 'ไม่พบผู้เล่น' });
      if (t.party) return cb({ ok: false, msg: 'อีกฝ่ายมีปาร์ตี้แล้ว' });
      if (p.party) {
        const P = parties[p.party];
        if (P && P.leader !== p.id) return cb({ ok: false, msg: 'เฉพาะหัวหน้าปาร์ตี้เท่านั้นที่เชิญได้' });
        if (P && P.members.length >= MAX) return cb({ ok: false, msg: 'ปาร์ตี้เต็ม (' + MAX + ' คน)' });
      }
      t.inv = { from: p.id, exp: Date.now() + INVITE_MS };
      io.to(t.id).emit('pInvited', { from: p.id, name: p.name });
      cb({ ok: true, msg: 'ส่งคำเชิญแล้ว' });
    });

    socket.on('pAccept', (d, cb) => {
      cb = fn(cb);
      const p = me(); if (!p || !d || !p.inv || p.inv.from !== d.from || Date.now() > p.inv.exp) return cb({ ok: false, msg: 'คำเชิญหมดอายุ' });
      const inviter = players[d.from];
      p.inv = null;
      if (!inviter) return cb({ ok: false, msg: 'ผู้เชิญออกจากเกมแล้ว' });
      if (p.party) return cb({ ok: false, msg: 'คุณมีปาร์ตี้อยู่แล้ว' });
      let P = inviter.party ? parties[inviter.party] : null;
      if (P) {
        if (P.members.length >= MAX) return cb({ ok: false, msg: 'ปาร์ตี้เต็ม' });
        P.members.push(p.id);
      } else {
        P = { id: nextPid++, leader: inviter.id, members: [inviter.id, p.id], expShare: true, lootMode: 'own' };
        parties[P.id] = P;
        inviter.party = P.id;
      }
      p.party = P.id;
      push(P);
      cb({ ok: true });
    });

    // หัวหน้าปาร์ตี้ตั้งโหมด: { expShare?: boolean, lootMode?: 'own'|'random'|'rotate' }
    socket.on('pSet', d => {
      const p = me(); if (!p || !p.party || !d || typeof d !== 'object') return;
      if (throttle('_tPs', 300)) return;
      const P = parties[p.party];
      if (!P || P.leader !== p.id) return;      // เฉพาะหัวหน้า
      if (typeof d.expShare === 'boolean') P.expShare = d.expShare;
      if (typeof d.lootMode === 'string' && LOOT_MODES[d.lootMode]) P.lootMode = d.lootMode;
      push(P);
    });

    socket.on('pLeave', () => leave(socket.id));

    socket.on('pKick', d => {
      const p = me(); if (!p || !d || !p.party) return;
      const P = parties[p.party];
      if (!P || P.leader !== p.id || d.id === p.id || P.members.indexOf(d.id) === -1) return;
      leave(d.id, true);
    });

    socket.on('disconnect', () => leave(socket.id));
  });

  // อัปเดต HP สมาชิกให้ทุกคนในปาร์ตี้ ทุก 1.5 วินาที (ข้ามห้อง/ด่านได้)
  setInterval(() => { for (const k in parties) push(parties[k]); }, 1500);

  // ให้ server.js ดึงข้อมูลปาร์ตี้ไปใช้ตอนมอนตาย
  return { getParty: pid => parties[pid] || null };
};
