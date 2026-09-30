// เซิร์ฟเวอร์เกม: ผู้เล่นหลายคนเห็นกันและกัน (รองรับโลก 2400x1800 และสกิลเวอร์ชันใหม่)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.get('/', (req, res) => res.send('MMORPG server OK'));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } }); // ภายหลังควรจำกัดเฉพาะเว็บของเรา

const WORLD_W = 3600, WORLD_H = 2250;
const players = {};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SKILLS = new Set([
  'basic_sword', 'basic_mage', 'basic_archer',
  'ulti_sword', 'ulti_mage', 'ulti_archer',
  'sw_slash', 'sw_spin', 'sw_dash', 'sw_cross',
  'mg_fire', 'mg_ice', 'mg_bolt', 'mg_nova',
  'ar_shot', 'ar_rain', 'ar_pierce', 'ar_multi',
]);

io.on('connection', socket => {
  socket.on('join', name => {
    name = String(name || '').trim().slice(0, 12) || 'Player';
    players[socket.id] = { id: socket.id, name, x: 1800, y: 1125, stage: 0 };
    socket.emit('init', { id: socket.id, players });
    socket.broadcast.emit('joined', players[socket.id]);
  });

  socket.on('move', d => {
    const p = players[socket.id];
    if (!p || !d || typeof d.x !== 'number' || typeof d.y !== 'number') return;
    p.x = clamp(d.x, 0, WORLD_W);
    p.y = clamp(d.y, 0, WORLD_H);
    p.stage = Number.isInteger(d.stage) ? d.stage : 0;
  });

  socket.on('skill', d => {
    if (!players[socket.id] || !d || !SKILLS.has(d.name)) return;
    socket.broadcast.emit('skill', {
      id: socket.id, name: d.name,
      x: Number(d.x) || 0, y: Number(d.y) || 0,
      fx: Number(d.fx) || 0, fy: Number(d.fy) || 0,
      stage: Number.isInteger(d.stage) ? d.stage : 0,
    });
  });

  socket.on('disconnect', () => {
    if (players[socket.id]) {
      delete players[socket.id];
      io.emit('left', socket.id);
    }
  });
});

// ส่งตำแหน่งทุกคน 20 ครั้ง/วินาที
setInterval(() => {
  const list = Object.values(players).map(p => [p.id, p.x, p.y, p.stage]);
  if (list.length) io.emit('state', list);
}, 50);

server.listen(process.env.PORT || 3000, () => console.log('server running'));
