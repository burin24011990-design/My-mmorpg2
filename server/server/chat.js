// server/chat.js -- แชตโลก / ปาร์ตี้ / ส่วนตัว + ตัวกรองคำหยาบ (กรองฝั่งเซิร์ฟเวอร์ ผู้เล่นโกงไม่ได้)
// วิธีใช้ใน server.js (วางไว้ตรงที่ require('./server/social') หรือหลังสร้าง io):
//   require('./server/chat')(io);
// ถ้ามีฟังก์ชันหาสมาชิกปาร์ตี้ฝั่งเซิร์ฟเวอร์ ให้ส่งเข้าไปได้ เช่น
//   require('./server/chat')(io, { getParty: socket => [socket.id, ...] });

// ===== รายการคำต้องห้าม (เพิ่ม/ลบได้ตามใจ) =====
const BAD_WORDS = [
  // คำหยาบไทย
  'เหี้ย', 'เหีย', 'ควย', 'เย็ด', 'สัส', 'ไอ้สัตว์', 'อีสัตว์', 'ระยำ', 'ชาติหมา',
  'แม่ง', 'ส้นตีน', 'ตอแหล', 'อีดอก', 'เสือก', 'กระหรี่', 'หน้าหี', 'ไอ้หมา',
  'พ่อมึงตาย', 'แม่มึงตาย', 'ไอ้ควาย', 'ไอ้โง่',
  // คำหยาบอังกฤษ
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'nigga', 'nigger', 'bastard', 'asshole', 'slut', 'whore',
  // โฆษณา / ซื้อขายนอกเกม
  'ขายไอดี', 'ซื้อไอดี', 'รับเติมเกม', 'รับฝากเลเวล', 'รับจ้างเลเวล', 'แอดไลน์', 'addline', 'discord.gg', 't.me'
];
// ลิงก์เว็บ
const URL_RE = /(https?:\/\/|www\.)\S+|\b[\w-]+\.(com|net|org|io|me|th|co|xyz|gg|info)\b/gi;

const KEEP = /[\p{L}\p{N}\p{M}]/u;           // ตัวอักษร/ตัวเลข/สระ-วรรณยุกต์ (ตัดช่องว่าง สัญลักษณ์ ที่ใช้หลบคำ)
const norm = s => { let n = ''; for (const c of String(s).toLowerCase()) if (KEEP.test(c)) n += c; return n; };
const BAD = BAD_WORDS.map(norm).filter(Boolean);

function maskBad(text) {
  let n = '', idx = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i].toLowerCase();
    if (KEEP.test(c)) { n += c; idx.push(i); }
  }
  const hide = new Array(text.length).fill(false);
  let hit = false;
  for (const w of BAD) {
    let p = n.indexOf(w);
    while (p !== -1) {
      hit = true;
      for (let j = idx[p]; j <= idx[p + w.length - 1]; j++) hide[j] = true;
      p = n.indexOf(w, p + 1);
    }
  }
  let out = '';
  for (let i = 0; i < text.length; i++) out += (hide[i] && !/\s/.test(text[i])) ? '*' : text[i];
  if (URL_RE.test(out)) hit = true;
  URL_RE.lastIndex = 0;
  out = out.replace(URL_RE, '***');
  return { text: out, hit };
}

// ===== ตั้งค่า =====
const MAX_LEN = 100;               // ความยาวข้อความสูงสุด
const CD = { world: 3000, party: 700, whisper: 700 };   // ดีเลย์ระหว่างข้อความ (ms)
const STRIKE_LIMIT = 3;            // พิมพ์คำหยาบครบกี่ครั้งใน 60 วิ ถึงโดนปิดปาก
const MUTE_MS = 60 * 1000;         // ปิดปากนานเท่าไร

module.exports = function (io, opts) {
  opts = opts || {};
  const users = new Map();         // socket.id -> { name, lv, last:{}, lastText, lastTextAt, strikes:[], mutedUntil }

  function findByName(name) {
    const k = String(name || '').trim().toLowerCase();
    if (!k) return null;
    for (const [id, u] of users) if (u.name.toLowerCase() === k) return id;
    return null;
  }

  io.on('connection', socket => {
    // ฟัง join แยกต่างหาก (ไม่กระทบ handler เดิมของ server.js)
    socket.on('join', d => {
      d = d || {};
      users.set(socket.id, {
        name: String(d.name || 'Player').slice(0, 12), lv: d.lv || 1,
        last: {}, lastText: '', lastTextAt: 0, strikes: [], mutedUntil: 0
      });
    });
    socket.on('hp', d => { const u = users.get(socket.id); if (u && d && d.lv) u.lv = d.lv; });
    socket.on('disconnect', () => users.delete(socket.id));

    socket.on('chat', (d, cb) => {
      cb = typeof cb === 'function' ? cb : () => {};
      const me = users.get(socket.id);
      if (!me) return cb({ ok: false, msg: 'ยังไม่ได้เข้าเกม' });
      d = d || {};
      const ch = ['world', 'party', 'whisper'].includes(d.ch) ? d.ch : null;
      if (!ch) return cb({ ok: false, msg: 'ช่องแชตไม่ถูกต้อง' });

      const now = Date.now();
      if (me.mutedUntil > now) return cb({ ok: false, msg: 'คุณถูกปิดปากอีก ' + Math.ceil((me.mutedUntil - now) / 1000) + ' วินาที' });

      let text = String(d.text || '').replace(/[\u0000-\u001f\u200b-\u200f\u2028\u2029]/g, '').trim().slice(0, MAX_LEN);
      if (!text) return cb({ ok: false, msg: '' });

      const wait = (me.last[ch] || 0) + CD[ch] - now;
      if (wait > 0) return cb({ ok: false, msg: ch === 'world' ? 'แชตโลกรออีก ' + Math.ceil(wait / 1000) + ' วินาที' : 'พิมพ์เร็วเกินไป' });
      if (text === me.lastText && now - me.lastTextAt < 10000) return cb({ ok: false, msg: 'ห้ามส่งข้อความซ้ำ' });

      // หาผู้รับก่อน (ถ้าไม่เจอ จะไม่นับดีเลย์)
      let targets, toName = '', toId = '';
      if (ch === 'world') {
        targets = null;
      } else if (ch === 'party') {
        let ids;
        if (typeof opts.getParty === 'function') ids = opts.getParty(socket) || [];
        else ids = (Array.isArray(d.members) ? d.members : []).slice(0, 5).filter(id => users.has(id));
        if (!ids.includes(socket.id)) ids.push(socket.id);
        if (ids.length < 2) return cb({ ok: false, msg: 'คุณยังไม่ได้อยู่ในปาร์ตี้' });
        targets = ids;
      } else {
        toId = findByName(d.to);
        if (!toId) return cb({ ok: false, msg: 'ไม่พบผู้เล่นออนไลน์ชื่อ "' + String(d.to || '').slice(0, 12) + '"' });
        if (toId === socket.id) return cb({ ok: false, msg: 'ส่งหาตัวเองไม่ได้' });
        toName = users.get(toId).name;
        targets = [socket.id, toId];
      }

      // กรองคำหยาบ / คำต้องห้าม / ลิงก์
      const f = maskBad(text);
      if (f.hit) {
        me.strikes = me.strikes.filter(t => now - t < 60000);
        me.strikes.push(now);
        if (me.strikes.length >= STRIKE_LIMIT) {
          me.mutedUntil = now + MUTE_MS; me.strikes = [];
          socket.emit('chatMsg', { ch: 'sys', text: 'คุณพิมพ์คำต้องห้ามบ่อยเกินไป ถูกปิดปาก ' + (MUTE_MS / 1000) + ' วินาที' });
        }
      }
      text = f.text;

      me.last[ch] = now; me.lastText = d.text; me.lastTextAt = now;
      const payload = { ch, fromId: socket.id, from: me.name, lv: me.lv, text, to: toName, toId, t: now };
      if (targets === null) io.emit('chatMsg', payload);
      else targets.forEach(id => io.to(id).emit('chatMsg', payload));
      cb({ ok: true, filtered: f.hit });
    });
  });
};
