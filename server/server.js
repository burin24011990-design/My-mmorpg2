// เซิร์ฟเวอร์เกม ขั้นที่ 2: ผู้เล่นหลายคนเห็นกันและกัน
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.get('/', (req, res) => res.send('MMORPG server OK'));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } }); // ภายหลังควรจำกัดเฉพาะเว็บของเรา

const players = {};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SKILLS = new Set(['atk', 's1', 's2']);

io.on('connection', socket => {
  socket.on('join', name => {
    name = String(name || '').trim().slice(0, 12) || 'Player';
    players[socket.id] = { id: socket.id, name, x: 800, y: 450 };
    socket.emit('init', { id: socket.id, players });
    socket.broadcast.emit('joined', players[socket.id]);
  });

  socket.on('move', d => {
    const p = players[socket.id];
    if (!p || !d || typeof d.x !== 'number' || typeof d.y !== 'number') return;
    p.x = clamp(d.x, 0, 1600);
    p.y = clamp(d.y, 0, 900);
  });

  socket.on('skill', d => {
    if (!players[socket.id] || !d || !SKILLS.has(d.name)) return;
    socket.broadcast.emit('skill', {
      id: socket.id, name: d.name,
      x: Number(d.x) || 0, y: Number(d.y) || 0,
      fx: Number(d.fx) || 0, fy: Number(d.fy) || 0,
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
  const list = Object.values(players).map(p => [p.id, p.x, p.y]);
  if (list.length) io.emit('state', list);
}, 50);

server.listen(process.env.PORT || 3000, () => console.log('server running'));
