// เซิร์ฟเวอร์เกม: ผู้เล่นหลายคนเห็นกันและกัน + ระบบแชนเนล/ห้อง + มอนสเตอร์แยกตามห้อง
// - แต่ละด่านมี 10 แชนเนล x 10 ห้อง = 100 ห้อง  ห้องละไม่เกิน 20 คน  -> ชื่อห้อง s{ด่าน}-c{แชนเนล}-r{ห้อง}
// - สลับแชนเนล/ห้องเองได้ทุก 5 นาที (เปลี่ยนด่านไม่ติดดีเลย์ และพยายามคงแชนเนล/ห้องเดิม)
// - ผู้เล่นเห็น/ได้รับสกิลเฉพาะคนในห้องเดียวกัน
// - v2: มอนสเตอร์ถูกสร้างและคุมโดยเซิร์ฟเวอร์ "แยกตามห้อง" คนในห้องเดียวกันเห็น/ตีมอนชุดเดียวกัน
//       ห้องที่ไม่มีคนจะไม่มีมอน (สร้างใหม่ทั้งชุดเมื่อมีคนเข้า)
// - v3: เพิ่มระบบเพื่อน + ปาร์ตี้ (social.js) และส่งเลเวลผู้เล่น
// - v4: เพิ่มระบบ PvP 1v1 / 3v3 / 5v5 + เพดานจุติต่อห้อง (pvpServer.js)
// - v5: สถานะสกิลบนมอน (อีเวนต์ 'mfx' จากผู้เล่น): สตั้น/แช่แข็ง = ขยับ+โจมตีไม่ได้ | ล็อกขา = เดินไม่ได้
//       เดินช้าลง (slow) | ตีเบาลง (weak) -> ดาเมจที่มอนทำกับผู้เล่นลดลง
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
const roomMons = {};    // ชื่อห้อง -> { mons: Map(id -> มอน), nextId }
const cooldowns = {};   // clientId -> เวลาที่สลับห้องล่าสุด

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
// รหัสสกิลที่ยอมให้ส่งต่อ: รูปแบบ basic_xxx / ulti_xxx / รหัสสกิล 2-3 ตัวอักษร_ชื่อ (เช่น sw_slash, rg_dash)
// ใช้รูปแบบแทนรายการตายตัว -> เพิ่มสกิล/อาชีพใหม่ (นักบวช โจร ฯลฯ) ได้โดยไม่ต้องแก้เซิร์ฟเวอร์
// เป็นแค่เอฟเฟกต์ที่ฝั่งผู้เล่นอื่นดูเฉยๆ ฝั่งเกมจะค้นหาในตารางสกิลเอง ชื่อที่ไม่รู้จักจะถูกข้าม
const SKILL_NAME_RE = /^(basic|ulti)_[a-z]{3,10}$|^[a-z]{2,3}_[a-z0-9]{2,16}$/;
const validSkillName = n => typeof n === 'string' && n.length <= 24 && SKILL_NAME_RE.test(n);

// =====================================================================
// มอนสเตอร์ (ค่าต้องตรงกับ js/data/zones.js + js/systems/monsters.js ฝั่งเกม)
// =====================================================================
const ZCFG = [   // ต่อด่าน: count = มอนธรรมดา, ranged = มอนยิงไกล, ช่วงเลเวล
  { count: 45, ranged: 15, minLv: 1,  maxLv: 10 },
  { count: 45, ranged: 15, minLv: 11, maxLv: 20 },
  { count: 45, ranged: 15, minLv: 21, maxLv: 30 },
  { count: 45, ranged: 15, minLv: 31, maxLv: 40 },
  { count: 60, ranged: 20, minLv: 41, maxLv: 50 },
  { count: 45, ranged: 15, minLv: 51, maxLv: 60 },
  { count: 45, ranged: 15, minLv: 61, maxLv: 70 },
  { count: 45, ranged: 15, minLv: 71, maxLv: 80 },
  { count: 60, ranged: 20, minLv: 81, maxLv: 90 },
];
const EPIC_COUNT = 30, EPIC_MULT = 8;
const NORMAL_HP_MULT = 2, NORMAL_DMG_MULT = 1.5;
const BOSS_COUNT = 1, BOSS_MULT = 20, BOSS_SPEED = 130;
const BOSS_TELEPORT_MIN_MS = 5 * 60000, BOSS_TELEPORT_MAX_MS = 10 * 60000;
const BOSS_RESPAWN_MIN_MS = 10 * 60000, BOSS_RESPAWN_MAX_MS = 20 * 60000;
const RESPAWN_DELAY = 7000;
const AGGRESSIVE_FROM_STAGE = 5;     // ด่าน 5 ขึ้นไปโจมตีก่อน (ด่าน 1-4 สู้กลับเมื่อโดนตี)
const CONTACT_CD = 600;              // ดีเลย์ชนตัวทำดาเมจ (ms) ต่อผู้เล่น
const MON_TICK_MS = 100;             // รอบคำนวณมอน (10 ครั้ง/วินาที)
const HIT_MAX_DIST = 1200;           // โจมตีมอนที่ไกลจากผู้เล่นเกินนี้ = ไม่นับ (กันโกงเบื้องต้น)

// สถานะสกิลบนมอน (ผู้เล่นส่งมาทางอีเวนต์ 'mfx' = [id มอน, ชนิด, มิลลิวินาที, พารามิเตอร์])
const MFX_TYPES = { stun: 1, freeze: 1, root: 1, slow: 1, weak: 1 };   // ชนิดอื่น (ไฟช็อต/เกราะ ฯลฯ) ฝั่งเกมคิดเองผ่านดาเมจ
const MFX_MAX_MS = 8000;             // เวลาสถานะสูงสุดต่อครั้ง (กันส่งค่าเว่อร์)

// ขนาดตัว (ใช้คำนวณระยะตีของมอน) ตรงกับ monsterDefs.js
const SIZE_NORMAL = [1.0, 1.0, 1.0, 1.0, 1.25, 1.4, 1.55, 1.7, 1.85];
const SIZE_BOSS   = [2.2, 2.2, 2.2, 2.2, 2.6, 2.9, 3.2, 3.5, 3.8];
const MUL_NORMAL  = [1, 1, 1.06, 1.25, 1.34, 1.05, 1.13, 1.4, 1.3];
const MUL_RANGED  = [1, 1, 1.12, 1.24, 1.23, 1.23, 1.22, 1.29, 1.5];
const MUL_BOSS    = [1, 1, 1.22, 1.12, 1.02, 1.02, 1.0, 1.34, 1.0];

function randPoint() { return { x: rnd(100, WORLD_W - 100), y: rnd(100, WORLD_H - 100) }; }

function makeMonster(R, stage, kind) {
  const z = ZCFG[stage];
  const boss = kind === 'boss', ranged = kind === 'ranged', epic = kind === 'epic';
  const lv = boss ? z.maxLv : rnd(z.minLv, z.maxLv);
  const pt = randPoint();
  const baseHp = 30 + lv * 8, baseDmg = 5 + Math.floor(lv * 1.5);
  const m = {
    id: R.nextId++, kind, stage, lv,
    x: pt.x, y: pt.y, homeX: pt.x, homeY: pt.y, wx: pt.x, wy: pt.y, nextWander: 0,
    state: 'idle', provoked: false, tgt: null,
    aggressive: (stage + 1) >= AGGRESSIVE_FROM_STAGE,
    nextShot: 0, nextSkill: 0, nextTeleport: 0,
    contrib: new Set(),
    fx: {},                          // สถานะที่ติดอยู่ { stun: {until}, slow: {until, mul}, ... }
  };
  let scale;
  if (boss) {
    scale = SIZE_BOSS[stage] * MUL_BOSS[stage];
    m.hp = baseHp * BOSS_MULT; m.dmg = baseDmg * BOSS_MULT;
    m.aggro = 220; m.lose = 520; m.leash = 700; m.speed = BOSS_SPEED;
    m.nextTeleport = Date.now() + rnd(BOSS_TELEPORT_MIN_MS, BOSS_TELEPORT_MAX_MS);
  } else if (epic) {
    scale = SIZE_NORMAL[stage] * MUL_NORMAL[stage] * 1.3;
    m.hp = baseHp * EPIC_MULT; m.dmg = baseDmg * EPIC_MULT;
    m.aggro = 200; m.lose = 420; m.leash = 500; m.speed = 75;
  } else {
    scale = SIZE_NORMAL[stage] * (ranged ? MUL_RANGED[stage] : MUL_NORMAL[stage]);
    m.hp = baseHp * NORMAL_HP_MULT; m.dmg = Math.round(baseDmg * NORMAL_DMG_MULT);
    m.aggro = ranged ? 350 : 130; m.lose = ranged ? 480 : 320; m.leash = 450; m.speed = 70;
  }
  m.maxHp = m.hp;
  m.hitRange = (boss ? 40 : 26) * scale;
  return m;
}

function spawnRoomMonsters(stage) {
  const R = { mons: new Map(), nextId: 1 };
  const z = ZCFG[stage];
  const add = kind => { const m = makeMonster(R, stage, kind); R.mons.set(m.id, m); };
  for (let i = 0; i < z.count; i++) add('normal');
  for (let i = 0; i < z.ranged; i++) add('ranged');
  for (let i = 0; i < EPIC_COUNT; i++) add('epic');
  for (let i = 0; i < BOSS_COUNT; i++) add('boss');
  return R;
}

// รูปแบบส่งให้ผู้เล่น: [id, kind, ด่าน, เลเวล, x, y, hp, maxHp, dmg]
const packMon = m => [m.id, m.kind, m.stage, m.lv, Math.round(m.x), Math.round(m.y), Math.ceil(m.hp), m.maxHp, m.dmg];

function moveToward(m, tx, ty, speed, dt) {
  const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
  if (d < 1) return;
  const st = Math.min(speed * dt, d);
  m.x += dx / d * st; m.y += dy / d * st;
}

// สถานะที่ยังไม่หมดอายุ (คืน null ถ้าไม่มี/หมดแล้ว)
function fxOn(m, type, now) {
  const f = m.fx && m.fx[type];
  return f && now < f.until ? f : null;
}

function tickRoom(key, R, now, dt) {
  const set = rooms[key];
  if (!set || !set.size) return;
  const pl = [];
  set.forEach(id => { const p = players[id]; if (p) pl.push(p); });
  if (!pl.length) return;
  const changed = [];

  R.mons.forEach(m => {
    // บอสวาปย้ายที่ (ถ้ากำลังสู้อยู่เลื่อนไป 15 วิ)
    if (m.kind === 'boss' && now > m.nextTeleport) {
      if (m.state === 'chase') m.nextTeleport = now + 15000;
      else {
        const pt = randPoint();
        m.x = pt.x; m.y = pt.y; m.homeX = pt.x; m.homeY = pt.y; m.wx = pt.x; m.wy = pt.y;
        m.state = 'idle';
        m.nextTeleport = now + rnd(BOSS_TELEPORT_MIN_MS, BOSS_TELEPORT_MAX_MS);
      }
    }

    // สถานะสกิลที่ติดอยู่
    const stunned = !!(fxOn(m, 'stun', now) || fxOn(m, 'freeze', now));   // ขยับ/โจมตี/ใช้สกิลไม่ได้
    const rooted = stunned || !!fxOn(m, 'root', now);                     // เดินไม่ได้ (ล็อกขายังตีได้ถ้าอยู่ในระยะ)
    const slowF = fxOn(m, 'slow', now), weakF = fxOn(m, 'weak', now);
    const spdMul = slowF ? slowF.mul : 1;                                  // เดินช้าลง
    const dmgMul = weakF ? Math.max(0, 1 - weakF.pct) : 1;                 // ตีเบาลง

    // ผู้เล่นที่ใกล้ที่สุด
    let near = null, nd = Infinity;
    for (let i = 0; i < pl.length; i++) {
      const d = Math.hypot(pl[i].x - m.x, pl[i].y - m.y);
      if (d < nd) { nd = d; near = pl[i]; }
    }
    // ถ้าถูกตี ให้ไล่คนที่ตี (ถ้ายังอยู่ในห้อง)
    let tp = near, td = nd;
    if (m.tgt && players[m.tgt] && players[m.tgt].room === key) {
      tp = players[m.tgt]; td = Math.hypot(tp.x - m.x, tp.y - m.y);
    }

    if (!(m.state === 'idle' && nd > 900)) {
      const dh = Math.hypot(m.x - m.homeX, m.y - m.homeY);
      const hostile = m.aggressive || m.provoked;
      if (m.state !== 'return' && hostile && td < m.aggro) m.state = 'chase';
      if (m.state === 'chase' && dh > m.leash) { m.state = 'return'; m.provoked = false; m.tgt = null; }
      if (m.state === 'chase' && td > m.lose) { m.state = 'idle'; m.provoked = false; m.tgt = null; }
      if (m.state === 'return' && dh < 60) { m.state = 'idle'; m.provoked = false; m.tgt = null; }

      if (m.state === 'idle') {
        if (now > m.nextWander) {
          const ang = Math.random() * Math.PI * 2, rad = Math.random() * 100;
          m.wx = m.homeX + Math.cos(ang) * rad; m.wy = m.homeY + Math.sin(ang) * rad;
          m.nextWander = now + rnd(2000, 4000);
        }
        if (!rooted) moveToward(m, m.wx, m.wy, 28 * spdMul, dt);
      } else if (m.state === 'chase' && tp) {
        if (m.kind === 'ranged') {
          if (!rooted) {
            if (td > 260) moveToward(m, tp.x, tp.y, m.speed * spdMul, dt);
            else if (td < 160) {
              const dx = m.x - tp.x, dy = m.y - tp.y, d = Math.hypot(dx, dy) || 1;
              m.x += dx / d * 60 * spdMul * dt; m.y += dy / d * 60 * spdMul * dt;
            }
          }
          if (!stunned && td < 340 && now > m.nextShot) {
            io.to(key).emit('mshot', { id: m.id, a: Math.atan2(tp.y - m.y, tp.x - m.x), sp: 240, sc: 2.2, dm: dmgMul });
            m.nextShot = now + rnd(1600, 2200);
          }
        } else if (!rooted) {
          moveToward(m, tp.x, tp.y, m.speed * spdMul, dt);
        }
        // ชนตัวทำดาเมจ (สตั้น/แช่แข็งทำไม่ได้)
        if (!stunned && td < m.hitRange && now > (tp.hitCd || 0)) {
          tp.hitCd = now + CONTACT_CD;
          io.to(tp.id).emit('mhurt', { id: m.id, dmg: Math.max(1, Math.round(m.dmg * dmgMul)) });
          io.to(key).emit('matk', m.id);
        }
        // สกิลของ epic / บอส (สตั้น/แช่แข็งใช้ไม่ได้)
        if (!stunned && (m.kind === 'epic' || m.kind === 'boss') && td < 380 && now > m.nextSkill) {
          const a = Math.atan2(tp.y - m.y, tp.x - m.x);
          if (m.kind === 'epic') {
            m.nextSkill = now + rnd(4000, 6000);
            io.to(key).emit('mskill', { id: m.id, t: 'epic', a });
          } else {
            m.nextSkill = now + rnd(2500, 4000);
            io.to(key).emit('mskill', { id: m.id, t: 'boss', r: rnd(0, 3), a });
          }
        }
      } else if (m.state === 'return') {
        if (!rooted) moveToward(m, m.homeX, m.homeY, 60 * spdMul, dt);
      }
      m.x = clamp(m.x, 20, WORLD_W - 20); m.y = clamp(m.y, 20, WORLD_H - 20);
    }

    const rx = Math.round(m.x), ry = Math.round(m.y), hp = Math.max(0, Math.ceil(m.hp));
    if (rx !== m.sx || ry !== m.sy || hp !== m.shp) {
      m.sx = rx; m.sy = ry; m.shp = hp;
      changed.push([m.id, rx, ry, hp]);
    }
  });

  if (changed.length) io.to(key).emit('mstate', changed);
}

function killMonster(key, R, m, byId) {
  R.mons.delete(m.id);
  const who = [];
  m.contrib.forEach(id => { if (players[id] && players[id].room === key) who.push(id); });
  io.to(key).emit('mdead', { id: m.id, by: byId, who });
  const delay = m.kind === 'boss' ? rnd(BOSS_RESPAWN_MIN_MS, BOSS_RESPAWN_MAX_MS) : RESPAWN_DELAY;
  setTimeout(() => {
    if (roomMons[key] !== R) return;        // ห้องว่างไปแล้ว (ถูกรีเซ็ต)
    const n = makeMonster(R, m.stage, m.kind);
    R.mons.set(n.id, n);
    io.to(key).emit('mspawn', packMon(n));
  }, delay);
}

let lastMonTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.3, (now - lastMonTick) / 1000);
  lastMonTick = now;
  for (const key in roomMons) tickRoom(key, roomMons[key], now, dt);
}, MON_TICK_MS);

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

const pub = p => ({ id: p.id, name: p.name, x: p.x, y: p.y, stage: p.stage, lv: p.lv });

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
  if (set) {
    set.delete(socket.id);
    if (!set.size) { delete rooms[p.room]; delete roomMons[p.room]; }   // ห้องว่าง = ล้างมอน
  }
  socket.leave(p.room);
  io.to(p.room).emit('left', socket.id);
  p.room = null;
}

function enterRoom(socket, stage, ch, rm) {
  const p = players[socket.id];
  leaveRoom(socket);
  const key = roomKey(stage, ch, rm);
  (rooms[key] = rooms[key] || new Set()).add(socket.id);
  if (!roomMons[key]) roomMons[key] = spawnRoomMonsters(stage);
  socket.join(key);
  p.room = key; p.stage = stage; p.ch = ch; p.rm = rm;
  socket.emit('init', { id: socket.id, stage, ch, rm, cap: ROOM_CAP, players: playersInRoom(key) });
  socket.emit('mons', { stage, list: Array.from(roomMons[key].mons.values()).map(packMon) });
  socket.to(key).emit('joined', pub(p));
}

// ระบบเพื่อน + ปาร์ตี้ (ไฟล์ social.js อยู่โฟลเดอร์เดียวกับไฟล์นี้)
require('./social')(io, players);

// ระบบ PvP 1v1 / 3v3 / 5v5 (ไฟล์ pvpServer.js อยู่โฟลเดอร์เดียวกับไฟล์นี้)
require('./pvpServer')(io, players, { leaveRoom });

// ---------- การเชื่อมต่อ ----------
io.on('connection', socket => {
  // เข้าเกม: d = { name, stage, ch, rm, cid, lv }
  socket.on('join', d => {
    if (players[socket.id]) return;
    if (typeof d === 'string') d = { name: d };
    d = d || {};
    const name = String(d.name || '').trim().slice(0, 12) || 'Player';
    const stage = validStage(d.stage) ? d.stage : 0;
    players[socket.id] = {
      id: socket.id, name, x: 1800, y: 1125, stage, ch: 0, rm: 0, room: null,
      cid: String(d.cid || '').slice(0, 64), lastEnter: 0, lastList: 0,
      lv: clamp(parseInt(d.lv, 10) || 1, 1, 999),
      hitCd: 0, hitWin: 0, hitN: 0, fxWin: 0, fxN: 0,
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

  // ผู้เล่นตีมอน: list = [[id มอน, ดาเมจ], ...] (ฝั่งเกมรวมแล้วส่งทุก ~50ms)
  socket.on('hits', list => {
    const p = players[socket.id];
    if (!p || !p.room || !Array.isArray(list)) return;
    const key = p.room, R = roomMons[key];
    if (!R) return;
    const now = Date.now();
    if (now - p.hitWin > 1000) { p.hitWin = now; p.hitN = 0; }
    for (const h of list.slice(0, 120)) {
      if (++p.hitN > 600) break;                       // กันส่งถี่ผิดปกติ
      if (!Array.isArray(h)) continue;
      const m = R.mons.get(h[0]);
      if (!m) continue;
      const dmg = clamp(Math.floor(Number(h[1]) || 0), 0, 10000000);
      if (!dmg) continue;
      if (Math.hypot(p.x - m.x, p.y - m.y) > HIT_MAX_DIST) continue;
      m.hp -= dmg;
      m.provoked = true; m.tgt = p.id; m.contrib.add(p.id);
      if (m.state === 'idle') m.state = 'chase';
      if (m.hp <= 0) killMonster(key, R, m, p.id);
    }
  });

  // ผู้เล่นใส่สถานะให้มอน (สตั้น/แช่แข็ง/ล็อกขา/เดินช้า/ตีเบาลง): d = [id มอน, ชนิด, มิลลิวินาที, { mul | pct }]
  socket.on('mfx', d => {
    const p = players[socket.id];
    if (!p || !p.room || !Array.isArray(d)) return;
    const R = roomMons[p.room];
    if (!R) return;
    const now = Date.now();
    if (now - p.fxWin > 1000) { p.fxWin = now; p.fxN = 0; }
    if (++p.fxN > 200) return;                         // กันส่งถี่ผิดปกติ
    const m = R.mons.get(d[0]);
    const type = d[1];
    if (!m || typeof type !== 'string' || !MFX_TYPES[type]) return;
    if (Math.hypot(p.x - m.x, p.y - m.y) > HIT_MAX_DIST) return;
    const ms = clamp(Math.floor(Number(d[2]) || 0), 0, MFX_MAX_MS);
    if (!ms) return;
    const par = d[3] && typeof d[3] === 'object' ? d[3] : {};
    const f = { until: now + ms };
    if (type === 'slow') f.mul = clamp(Number(par.mul) || 1, 0.1, 1);       // 0.5 = เดินเหลือครึ่งหนึ่ง
    if (type === 'weak') f.pct = clamp(Number(par.pct) || 0, 0, 0.9);       // 0.25 = ตีเบาลง 25%
    m.fx = m.fx || {};
    m.fx[type] = f;
    if (type === 'stun' || type === 'freeze') { m.provoked = true; m.tgt = p.id; m.contrib.add(p.id); }
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
    rooms[key].forEach(id => { const p = players[id]; if (p) list.push([p.id, p.x, p.y, p.stage, p.lv]); });
    if (list.length) io.to(key).emit('state', list);
  }
}, 50);

// ล้างบันทึกดีเลย์ที่หมดอายุแล้ว (กันหน่วยความจำโต)
setInterval(() => {
  const now = Date.now();
  for (const k in cooldowns) if (now - cooldowns[k] > SWITCH_COOLDOWN_MS) delete cooldowns[k];
}, 60000);

server.listen(process.env.PORT || 3000, () => console.log('server running'));
