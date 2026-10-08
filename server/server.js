// เซิร์ฟเวอร์เกม: ผู้เล่นหลายคนเห็นกันและกัน + ระบบแชนเนล/ห้อง + มอนสเตอร์แยกตามห้อง
// - แต่ละด่านมี 10 แชนเนล x 10 ห้อง ห้องละไม่เกิน 20 คน -> ชื่อห้อง s{ด่าน}-c{แชนเนล}-r{ห้อง}
// - สลับแชนเนล/ห้องเองได้ทุก 5 นาที (เปลี่ยนด่านไม่ติดดีเลย์)
// - v2 มอนแยกตามห้อง | v3 เพื่อน+ปาร์ตี้ | v4 PvP | v5 สถานะสกิลบนมอน (mfx) | v6 แชต
// - v7 เก็บ cls ของผู้เล่น | v8 getMons | v9 เมืองเป็นด่านที่ 10 (ดัชนี 9)
// - v10: เพิ่มอีเวนต์ 'getPlayers' ให้เครื่องผู้เล่นขอรายชื่อคนในห้องซ้ำ (แก้มองไม่เห็นผู้เล่นอื่นในเมือง)
// - v11: ปาร์ตี้แชร์ EXP + โหมดแจกไอเทม (own / random / rotate) -- killMonster ส่ง who + lootTo ใน 'mdead'
// - v12: EXP หารตามจำนวนคนในปาร์ตี้ -- 'mdead' ส่ง exp = { id: สัดส่วน } (เช่น 3 คน = 0.3333 ต่อคน)
//        โบนัสปาร์ตี้ (+10/20/40%) ยังคูณฝั่งเกมใน social.js เหมือนเดิม -> ต้องใช้คู่กับ roomMonsters.js v5
// - v13: ยกเลิกการจำกัดระยะของ EXP และของดรอปในปาร์ตี้ (อยู่ห้องเดียวกันก็ได้ ไม่ว่าอยู่ตรงไหนของแผนที่)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.get('/', (req, res) => res.send('MMORPG server OK'));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const WORLD_W = 3600, WORLD_H = 2250;
const STAGES = 30;                        // 9 ด่านล่ามอน + เมือง (ดัชนี 9 ไม่มีมอน)
const CHANNELS = 10;
const ROOMS = 10;
const ROOM_CAP = 20;
const SWITCH_COOLDOWN_MS = 5 * 60 * 1000;

const players = {};
const rooms = {};       // ชื่อห้อง -> Set ของ socket.id
const roomMons = {};    // ชื่อห้อง -> { mons: Map(id -> มอน), nextId }
const cooldowns = {};   // clientId -> เวลาที่สลับห้องล่าสุด

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const SKILL_NAME_RE = /^(basic|ulti)_[a-z]{3,10}$|^[a-z]{2,3}_[a-z0-9_]{2,20}$/;
const validSkillName = n => typeof n === 'string' && n.length <= 28 && SKILL_NAME_RE.test(n);
const CLS_RE = /^[a-z]{3,10}$/;
const validCls = v => (typeof v === 'string' && CLS_RE.test(v) ? v : null);

// =====================================================================
// มอนสเตอร์ (ค่าต้องตรงกับ js/data/zones.js + js/systems/monsters.js ฝั่งเกม)
// =====================================================================
const ZCFG = [
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
const AGGRESSIVE_FROM_STAGE = 5;
const CONTACT_CD = 600;
const MON_TICK_MS = 100;
const HIT_MAX_DIST = 1200;

// ปาร์ตี้แชร์ EXP/ของ: ไม่จำกัดระยะ -- สมาชิกที่อยู่ "ห้องเดียวกับมอน" (ช่อง/ห้องเดียวกัน) ได้ทุกคน อยู่ตรงไหนของแผนที่ก็ได้

const MFX_TYPES = { stun: 1, freeze: 1, root: 1, slow: 1, weak: 1 };
const MFX_MAX_MS = 8000;

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
    fx: {},
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
  if (!z) return R;                          // เมือง = ห้องว่างไม่มีมอน
  const add = kind => { const m = makeMonster(R, stage, kind); R.mons.set(m.id, m); };
  for (let i = 0; i < z.count; i++) add('normal');
  for (let i = 0; i < z.ranged; i++) add('ranged');
  for (let i = 0; i < EPIC_COUNT; i++) add('epic');
  for (let i = 0; i < BOSS_COUNT; i++) add('boss');
  return R;
}

// [id, kind, ด่าน, เลเวล, x, y, hp, maxHp, dmg]
const packMon = m => [m.id, m.kind, m.stage, m.lv, Math.round(m.x), Math.round(m.y), Math.ceil(m.hp), m.maxHp, m.dmg];

function moveToward(m, tx, ty, speed, dt) {
  const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
  if (d < 1) return;
  const st = Math.min(speed * dt, d);
  m.x += dx / d * st; m.y += dy / d * st;
}

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
    if (m.kind === 'boss' && now > m.nextTeleport) {
      if (m.state === 'chase') m.nextTeleport = now + 15000;
      else {
        const pt = randPoint();
        m.x = pt.x; m.y = pt.y; m.homeX = pt.x; m.homeY = pt.y; m.wx = pt.x; m.wy = pt.y;
        m.state = 'idle';
        m.nextTeleport = now + rnd(BOSS_TELEPORT_MIN_MS, BOSS_TELEPORT_MAX_MS);
      }
    }

    const stunned = !!(fxOn(m, 'stun', now) || fxOn(m, 'freeze', now));
    const rooted = stunned || !!fxOn(m, 'root', now);
    const slowF = fxOn(m, 'slow', now), weakF = fxOn(m, 'weak', now);
    const spdMul = slowF ? slowF.mul : 1;
    const dmgMul = weakF ? Math.max(0, 1 - weakF.pct) : 1;

    let near = null, nd = Infinity;
    for (let i = 0; i < pl.length; i++) {
      const d = Math.hypot(pl[i].x - m.x, pl[i].y - m.y);
      if (d < nd) { nd = d; near = pl[i]; }
    }
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
        if (!stunned && td < m.hitRange && now > (tp.hitCd || 0)) {
          tp.hitCd = now + CONTACT_CD;
          io.to(tp.id).emit('mhurt', { id: m.id, dmg: Math.max(1, Math.round(m.dmg * dmgMul)) });
          io.to(key).emit('matk', m.id);
        }
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

// มอนตาย: คิดว่าใครได้ EXP (exp) และใครได้ของดรอป (lootTo) ที่เซิร์ฟเวอร์ทั้งหมด (กันโกง)
// - EXP: exp = { socketId: สัดส่วน } ฝั่งเกมเอา (EXP มอน x สัดส่วน) ไปบวก แล้วคูณโบนัสปาร์ตี้ตามจำนวนคนต่อ (social.js ฝั่งเกม)
//     * ไม่มีปาร์ตี้ / ปาร์ตี้ปิดแชร์ EXP = สัดส่วน 1 (ได้เต็มเหมือนเล่นเดี่ยว)
//     * ปาร์ตี้เปิดแชร์ EXP = หารเท่ากันทุกคนที่ได้รับ (คนที่ตีมอน + สมาชิกในห้องเดียวกัน ไม่จำกัดระยะ)
//       เช่น 3 คน = 1/3 ต่อคน แล้วคูณโบนัส +10% -> คนละ 0.3667 ของ EXP มอน (รวมทั้งปาร์ตี้ 1.1 เท่า)
// - ของ: own = คนที่ตีตัวสุดท้าย | random = สุ่มในปาร์ตี้ | rotate = สลับกันตามลำดับ (ทุกคนในห้องเดียวกัน ไม่จำกัดระยะ)
function killMonster(key, R, m, byId) {
  R.mons.delete(m.id);
  const here = id => !!(players[id] && players[id].room === key);

  // ----- EXP -----
  const exp = {};                         // id -> สัดส่วน EXP (1 = เต็ม)
  const partyIds = new Set();
  m.contrib.forEach(id => {
    if (!here(id)) return;
    const pid = players[id].party;
    const Pt = pid ? social.getParty(pid) : null;
    if (!Pt || Pt.expShare === false) { exp[id] = 1; return; }   // เดี่ยว หรือปาร์ตี้ปิดแชร์ = ได้เต็ม
    partyIds.add(pid);
  });
  partyIds.forEach(pid => {
    const Pt = social.getParty(pid);
    if (!Pt) return;
    const got = new Set();
    Pt.members.forEach(mid => {
      if (!here(mid)) return;
      got.add(mid);                       // อยู่ห้องเดียวกัน = ได้ ไม่จำกัดระยะ
    });
    if (!got.size) return;
    const share = 1 / got.size;
    got.forEach(mid => { exp[mid] = share; });
  });

  let lootTo = here(byId) ? byId : null;
  const killer = here(byId) ? players[byId] : null;
  const Pt = killer && killer.party ? social.getParty(killer.party) : null;
  if (Pt && Pt.lootMode && Pt.lootMode !== 'own') {
    const el = Pt.members.filter(id => here(id));   // ทุกคนในห้องเดียวกัน ไม่จำกัดระยะ
    if (el.length) {
      if (Pt.lootMode === 'random') {
        lootTo = el[rnd(0, el.length - 1)];
      } else {                                  // rotate: ถัดจากคนที่ได้ล่าสุด
        const n = Pt.members.length, s = Pt.members.indexOf(Pt.lastLoot);
        for (let i = 1; i <= n; i++) {
          const id = Pt.members[(s + i + n) % n];
          if (el.indexOf(id) >= 0) { lootTo = id; break; }
        }
        Pt.lastLoot = lootTo;
      }
    }
  }

  io.to(key).emit('mdead', { id: m.id, by: byId, who: Object.keys(exp), exp, lootTo });
  const delay = m.kind === 'boss' ? rnd(BOSS_RESPAWN_MIN_MS, BOSS_RESPAWN_MAX_MS) : RESPAWN_DELAY;
  setTimeout(() => {
    if (roomMons[key] !== R) return;
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

function countMatrix(stage) {
  const m = [];
  for (let c = 1; c <= CHANNELS; c++) {
    const row = [];
    for (let r = 1; r <= ROOMS; r++) row.push(roomCount(stage, c, r));
    m.push(row);
  }
  return m;
}

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

const pub = p => ({ id: p.id, name: p.name, x: p.x, y: p.y, stage: p.stage, lv: p.lv, cls: p.cls });

function playersInRoom(key) {
  const out = {};
  const set = rooms[key];
  if (set) set.forEach(id => { if (players[id]) out[id] = pub(players[id]); });
  return out;
}

function sendMons(socket, p) {
  if (!p || !p.room) return;
  const R = roomMons[p.room];
  if (!R) return;
  socket.emit('mons', { stage: p.stage, list: Array.from(R.mons.values()).map(packMon) });
}

function leaveRoom(socket) {
  const p = players[socket.id];
  if (!p || !p.room) return;
  const set = rooms[p.room];
  if (set) {
    set.delete(socket.id);
    if (!set.size) { delete rooms[p.room]; delete roomMons[p.room]; }
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
  sendMons(socket, p);
  socket.to(key).emit('joined', pub(p));
}

// social ต้องคืนค่า { getParty } (ดู server/social.js v++) -- ประกาศเป็น const ก่อนที่ killMonster จะถูกเรียกใช้จริง
const social = require('./social')(io, players);
require('./pvpServer')(io, players, { leaveRoom });
require('./chat')(io);

// ---------- การเชื่อมต่อ ----------
io.on('connection', socket => {
  socket.on('join', d => {
    if (players[socket.id]) return;
    if (typeof d === 'string') d = { name: d };
    d = d || {};
    const name = String(d.name || '').trim().slice(0, 12) || 'Player';
    const stage = validStage(d.stage) ? d.stage : 0;
    players[socket.id] = {
      id: socket.id, name, x: 1800, y: 1125, stage, ch: 0, rm: 0, room: null,
      cid: String(d.cid || '').slice(0, 64), lastEnter: 0, lastList: 0, lastMons: 0, lastSync: 0,
      lv: clamp(parseInt(d.lv, 10) || 1, 1, 999),
      cls: validCls(d.cls) || 'sword',
      hitCd: 0, hitWin: 0, hitN: 0, fxWin: 0, fxN: 0, skWin: 0, skN: 0,
    };
    const f = pickFree(stage, d.ch, d.rm);
    if (!f) { socket.emit('roomFull', { stage }); return; }
    enterRoom(socket, stage, f.ch, f.rm);
  });

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

  socket.on('getMons', stage => {
    const p = players[socket.id];
    if (!p || !p.room) return;
    const now = Date.now();
    if (now - p.lastMons < 500) return;
    p.lastMons = now;
    if (Number.isInteger(stage) && stage !== p.stage) return;
    sendMons(socket, p);
  });

  // v10: เครื่องผู้เล่นขอรายชื่อคนในห้องซ้ำ (เจอคนใน 'state' ที่ยังไม่รู้จัก เช่น พลาด init/joined ตอนเข้าเมือง)
  socket.on('getPlayers', () => {
    const p = players[socket.id];
    if (!p || !p.room) return;
    const now = Date.now();
    if (now - (p.lastSync || 0) < 1000) return;
    p.lastSync = now;
    socket.emit('players', playersInRoom(p.room));
  });

  socket.on('enter', (d, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    const p = players[socket.id];
    if (!p || !d) return cb({ ok: false, reason: 'bad' });
    const now = Date.now();
    if (now - p.lastEnter < 1000) return cb({ ok: false, reason: 'fast' });
    p.lastEnter = now;

    const stage = d.stage, ch = d.ch, rm = d.rm;
    if (!validStage(stage) || !validCh(ch) || !validRm(rm)) return cb({ ok: false, reason: 'bad' });
    if (p.room === roomKey(stage, ch, rm)) {
      sendMons(socket, p);
      return cb({ ok: true, stage, ch, rm });
    }

    if (p.ch === 0 || (ch === p.ch && rm === p.rm)) {
      const f = pickFree(stage, ch, rm);
      if (!f) { leaveRoom(socket); return cb({ ok: false, reason: 'full', stage }); }
      enterRoom(socket, stage, f.ch, f.rm);
      return cb({ ok: true, stage, ch: f.ch, rm: f.rm, moved: f.ch !== ch || f.rm !== rm });
    }

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
    const c = validCls(d.cls);
    if (c) p.cls = c;
  });

  socket.on('hits', list => {
    const p = players[socket.id];
    if (!p || !p.room || !Array.isArray(list)) return;
    const key = p.room, R = roomMons[key];
    if (!R) return;
    const now = Date.now();
    if (now - p.hitWin > 1000) { p.hitWin = now; p.hitN = 0; }
    for (const h of list.slice(0, 120)) {
      if (++p.hitN > 600) break;
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

  socket.on('mfx', d => {
    const p = players[socket.id];
    if (!p || !p.room || !Array.isArray(d)) return;
    const R = roomMons[p.room];
    if (!R) return;
    const now = Date.now();
    if (now - p.fxWin > 1000) { p.fxWin = now; p.fxN = 0; }
    if (++p.fxN > 200) return;
    const m = R.mons.get(d[0]);
    const type = d[1];
    if (!m || typeof type !== 'string' || !MFX_TYPES[type]) return;
    if (Math.hypot(p.x - m.x, p.y - m.y) > HIT_MAX_DIST) return;
    const ms = clamp(Math.floor(Number(d[2]) || 0), 0, MFX_MAX_MS);
    if (!ms) return;
    const par = d[3] && typeof d[3] === 'object' ? d[3] : {};
    const f = { until: now + ms };
    if (type === 'slow') f.mul = clamp(Number(par.mul) || 1, 0.1, 1);
    if (type === 'weak') f.pct = clamp(Number(par.pct) || 0, 0, 0.9);
    m.fx = m.fx || {};
    m.fx[type] = f;
    if (type === 'stun' || type === 'freeze') { m.provoked = true; m.tgt = p.id; m.contrib.add(p.id); }
  });

  // ส่งต่อสกิล/ท่าโจมตีให้คนอื่นในห้อง: d = { name, x, y, fx, fy, gx?, gy? }
  socket.on('skill', d => {
    const p = players[socket.id];
    if (!p || !p.room || !d || !validSkillName(d.name)) return;
    const now = Date.now();
    if (now - p.skWin > 1000) { p.skWin = now; p.skN = 0; }
    if (++p.skN > 30) return;
    const out = {
      id: socket.id, name: d.name,
      x: Number(d.x) || 0, y: Number(d.y) || 0,
      fx: Number(d.fx) || 0, fy: Number(d.fy) || 0,
      stage: p.stage, cls: p.cls,
    };
    if (d.gx != null && d.gy != null) {
      const gx = Number(d.gx), gy = Number(d.gy);
      if (Number.isFinite(gx) && Number.isFinite(gy)) { out.gx = clamp(gx, 0, WORLD_W); out.gy = clamp(gy, 0, WORLD_H); }
    }
    socket.to(p.room).emit('skill', out);
  });

  socket.on('disconnect', () => {
    leaveRoom(socket);
    delete players[socket.id];
  });
});

// ส่งตำแหน่ง 20 ครั้ง/วินาที: [id, x, y, ด่าน, เลเวล, คลาส]
setInterval(() => {
  for (const key in rooms) {
    const list = [];
    rooms[key].forEach(id => { const p = players[id]; if (p) list.push([p.id, p.x, p.y, p.stage, p.lv, p.cls]); });
    if (list.length) io.to(key).emit('state', list);
  }
}, 50);

setInterval(() => {
  const now = Date.now();
  for (const k in cooldowns) if (now - cooldowns[k] > SWITCH_COOLDOWN_MS) delete cooldowns[k];
}, 60000);

server.listen(process.env.PORT || 3000, () => console.log('server running'));
