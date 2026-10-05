// เซิร์ฟเวอร์เกม: ผู้เล่นหลายคนเห็นกันและกัน + ระบบแชนเนล/ห้อง
// - แต่ละด่านมี 10 แชนเนล x 10 ห้อง = 100 ห้อง  ห้องละไม่เกิน 20 คน  -> ชื่อห้อง s{ด่าน}-c{แชนเนล}-r{ห้อง}
// - สลับแชนเนล/ห้องเองได้ทุก 5 นาที (เปลี่ยนด่านไม่ติดดีเลย์ และพยายามคงแชนเนล/ห้องเดิม)
// - ผู้เล่นเห็น/ได้รับสกิลเฉพาะคนในห้องเดียวกัน
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.get('/', (req, res) => res.send('MMORPG server OK'));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } }); // ภายหลังควรจำกัดเฉพาะเว็บของเรา

const WORLD_W = 3600, WORLD_H = 2250;
const STAGES = 9;                         // จำนวนด่าน (ตรงกับ ZONES)
const CHANNELS = 10;                      // แชนเนลต่อด่าน
const ROOMS = 10;                         // ห้องต่อแชนเนล
const ROOM_CAP = 20;                      // คนสูงสุดต่อห้อง
const SWITCH_COOLDOWN_MS = 5 * 60 * 1000; // ดีเลย์สลับแชนเนล/ห้อง 5 นาที

const players = {};
const rooms = {};       // ชื่อห้อง -> Set ของ socket.id
const cooldowns = {};   // clientId -> เวลาที่สลับห้องล่าสุด

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// รหัสสกิลที่ยอมให้ส่งต่อ: รูปแบบ basic_xxx / ulti_xxx / รหัสสกิล 2-3 ตัวอักษร_ชื่อ (เช่น sw_slash, rg_dash)
// ใช้รูปแบบแทนรายการตายตัว -> เพิ่มสกิล/อาชีพใหม่ (นักบวช โจร ฯลฯ) ได้โดยไม่ต้องแก้เซิร์ฟเวอร์
// เป็นแค่เอฟเฟกต์ที่ฝั่งผู้เล่นอื่นดูเฉยๆ ฝั่งเกมจะค้นหาในตารางสกิลเอง ชื่อที่ไม่รู้จักจะถูกข้าม
const SKILL_NAME_RE = /^(basic|ulti)_[a-z]{3,10}$|^[a-z]{2,3}_[a-z0-9]{2,16}$/;
const validSkillName = n => typeof n === 'string' && n.length <= 24 && SKILL_NAME_RE.test(n);

// ---------- ตัวช่วยเรื่องห้อง ----------
const roomKey = (stage, ch, rm) => 's' + stage + '-c' + ch + '-r' + rm;
const roomCount = (stage, ch, rm) => { const s = rooms[roomKey(stage, ch, rm)]; return s ? s.size : 0; };
const validStage = v => Number.isInteger(v) && v >= 0 && v < STAGES;
const validCh = v => Number.isInteger(v) && v >= 1 && v <= CHANNELS;
const validRm = v => Number.isInteger(v) && v >= 1 && v <= ROOMS;
const cdKey = (p, socket) => p.cid || socket.id;
const cdLeft = (p, socket, now) => Math.max(0, (cooldowns[cdKey(p, socket)] || 0) + SWITCH_COOLDOWN_MS - now);

// ตารางจำนวนคน counts[แชนเนล-1][ห้อง-1]
function countMatrix(stage) {
  const m = [];
  for (let c = 1; c <= CHANNELS; c++) {
    const row = [];
    for (let r = 1; r <= ROOMS; r++) row.push(roomCount(stage, c, r));
    m.push(row);
  }
  return m;
}

// เลือกห้องที่ไม่เต็ม: 1) ห้องที่ต้องการ 2) ห้องว่างในแชนเนลเดียวกัน 3) ห้องว่างที่ไหนก็ได้ | คืน null ถ้าเต็มหมด
function pickFree(stage, ch, rm) {
  if (validCh(ch) && validRm(rm) && roomCount(stage, ch, rm) < ROOM_CAP) return { ch, rm };
  if (validCh(ch)) {
    for (let r = 1; r <= ROOMS; r++) if (roomCount(stage, ch, r) < ROOM_CAP) return { ch, rm: r };
  }
  for (let c = 1; c <= CHANNELS; c++) {
    for (let r = 1; r <= ROOMS; r++) if (roomCount(stage, c, r) < ROOM_CAP) return { ch: c, rm: r };
  }
  return null;
}

const pub = p => ({ id: p.id, name: p.name, x: p.x, y: p.y, stage: p.stage });

function playersInRoom(key) {
  const out = {};
  const set = rooms[key];
  if (set) set.forEach(id => { if (players[id]) out[id] = pub(players[id]); });
  return out;
}

function leaveRoom(socket) {
  const p = players[socket.id];
  if (!p || !p.room) return;
  const set = rooms[p.room];
  if (set) { set.delete(socket.id); if (!set.size) delete rooms[p.room]; }
  socket.leave(p.room);
  io.to(p.room).emit('left', socket.id);
  p.room = null;
}

function enterRoom(socket, stage, ch, rm) {
  const p = players[socket.id];
  leaveRoom(socket);
  const key = roomKey(stage, ch, rm);
  (rooms[key] = rooms[key] || new Set()).add(socket.id);
  socket.join(key);
  p.room = key; p.stage = stage; p.ch = ch; p.rm = rm;
  socket.emit('init', { id: socket.id, stage, ch, rm, cap: ROOM_CAP, players: playersInRoom(key) });
  socket.to(key).emit('joined', pub(p));
}

// ---------- การเชื่อมต่อ ----------
io.on('connection', socket => {
  // เข้าเกม: d = { name, stage, ch, rm, cid }
  socket.on('join', d => {
    if (players[socket.id]) return;
    if (typeof d === 'string') d = { name: d };
    d = d || {};
    const name = String(d.name || '').trim().slice(0, 12) || 'Player';
    const stage = validStage(d.stage) ? d.stage : 0;
    players[socket.id] = {
      id: socket.id, name, x: 1800, y: 1125, stage, ch: 0, rm: 0, room: null,
      cid: String(d.cid || '').slice(0, 64), lastEnter: 0, lastList: 0,
    };
    const f = pickFree(stage, d.ch, d.rm);
    if (!f) { socket.emit('roomFull', { stage }); return; }
    enterRoom(socket, stage, f.ch, f.rm);
  });

  // ขอตารางจำนวนคนทุกห้องของด่าน + ดีเลย์ที่เหลือ
  socket.on('getChannels', (stage, cb) => {
    const p = players[socket.id];
    if (typeof cb !== 'function' || !p) return;
    const now = Date.now();
    if (now - p.lastList < 500) return;
    p.lastList = now;
    if (!validStage(stage)) stage = p.stage;
    const here = p.room && p.stage === stage;
    cb({
      stage, counts: countMatrix(stage), cap: ROOM_CAP,
      curCh: here ? p.ch : 0, curRm: here ? p.rm : 0,
      left: cdLeft(p, socket, now),
    });
  });

  // เปลี่ยนด่าน (ห้องเดิม) หรือสลับห้อง: d = { stage, ch, rm }
  socket.on('enter', (d, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    const p = players[socket.id];
    if (!p || !d) return cb({ ok: false, reason: 'bad' });
    const now = Date.now();
    if (now - p.lastEnter < 1000) return cb({ ok: false, reason: 'fast' });
    p.lastEnter = now;

    const stage = d.stage, ch = d.ch, rm = d.rm;
    if (!validStage(stage) || !validCh(ch) || !validRm(rm)) return cb({ ok: false, reason: 'bad' });
    if (p.room === roomKey(stage, ch, rm)) return cb({ ok: true, stage, ch, rm });

    // เปลี่ยนด่านโดยคงแชนเนล/ห้องเดิม: ไม่ติดดีเลย์ ถ้าเต็มจะย้ายไปห้องที่ว่างให้
    if (p.ch === 0 || (ch === p.ch && rm === p.rm)) {
      const f = pickFree(stage, ch, rm);
      if (!f) { leaveRoom(socket); return cb({ ok: false, reason: 'full', stage }); }
      enterRoom(socket, stage, f.ch, f.rm);
      return cb({ ok: true, stage, ch: f.ch, rm: f.rm, moved: f.ch !== ch || f.rm !== rm });
    }

    // สลับแชนเนล/ห้องเอง: ติดดีเลย์ 5 นาที
    const left = cdLeft(p, socket, now);
    if (left > 0) return cb({ ok: false, reason: 'cooldown', left });
    if (roomCount(stage, ch, rm) >= ROOM_CAP) return cb({ ok: false, reason: 'full', stage, ch, rm });
    enterRoom(socket, stage, ch, rm);
    cooldowns[cdKey(p, socket)] = now;
    cb({ ok: true, stage, ch, rm });
  });

  socket.on('move', d => {
    const p = players[socket.id];
    if (!p || !p.room || !d || typeof d.x !== 'number' || typeof d.y !== 'number') return;
    p.x = clamp(d.x, 0, WORLD_W);
    p.y = clamp(d.y, 0, WORLD_H);
  });

  socket.on('skill', d => {
    const p = players[socket.id];
    if (!p || !p.room || !d || !validSkillName(d.name)) return;
    socket.to(p.room).emit('skill', {
      id: socket.id, name: d.name,
      x: Number(d.x) || 0, y: Number(d.y) || 0,
      fx: Number(d.fx) || 0, fy: Number(d.fy) || 0,
      stage: p.stage,
    });
  });

  socket.on('disconnect', () => {
    leaveRoom(socket);
    delete players[socket.id];
  });
});

// ส่งตำแหน่งให้คนในแต่ละห้อง 20 ครั้ง/วินาที (เฉพาะห้องที่มีคน)
setInterval(() => {
  for (const key in rooms) {
    const list = [];
    rooms[key].forEach(id => { const p = players[id]; if (p) list.push([p.id, p.x, p.y, p.stage]); });
    if (list.length) io.to(key).emit('state', list);
  }
}, 50);

// ล้างบันทึกดีเลย์ที่หมดอายุแล้ว (กันหน่วยความจำโต)
setInterval(() => {
  const now = Date.now();
  for (const k in cooldowns) if (now - cooldowns[k] > SWITCH_COOLDOWN_MS) delete cooldowns[k];
}, 60000);

server.listen(process.env.PORT || 3000, () => console.log('server running'));
