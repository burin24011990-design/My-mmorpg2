// chat.js (ฝั่งเกม) -- แชตโลก / ปาร์ตี้ / ส่วนตัว
// เริ่มต้นอยู่ล่างกลาง-ซ้าย (พ้นปุ่มขวดยา) | กดค้างที่ปุ่ม 💬 แล้วลากเพื่อย้ายได้ (จำตำแหน่งไว้)
// แนวตั้ง: วางชิดซ้ายล่างและแคบลง เพื่อไม่ให้ทับปุ่มสกิล/แดช (แนวนอนเหมือนเดิมทุกอย่าง)
// โหลดหลัง social.js ก่อน main.js | ต้องใช้คู่กับ server/chat.js
(function () {
  const P = Main.prototype;
  const el = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css || ''; if (text != null) e.textContent = text; return e; };
  const COL = { world: '#ffe28a', party: '#7dff9a', whisper: '#ff9ad5', sys: '#bbbbbb' };
  const LBL = { world: 'โลก', party: 'ปาร์ตี้', whisper: 'ส่วนตัว' };
  const MAX_LOG = 60;        // เก็บข้อความย้อนหลัง
  const FADE_MS = 10000;     // ตอนปิดแชต ข้อความจะแสดงกี่ ms
  const SHADOW = 'text-shadow:-1px 0 #000,1px 0 #000,0 -1px #000,0 1px #000;';

  // ---------- แนวจอ ----------
  const isPortrait = () =>
    (typeof PORTRAIT !== 'undefined' && !!PORTRAIT) ||
    (typeof W !== 'undefined' && typeof H !== 'undefined' && W < H);

  // ---------- ตำแหน่งแชต ----------
  const DEF_X = 0.30;                 // ตำแหน่งเริ่มต้นแนวนอน: ห่างจากขอบซ้ายจอเกม 30% (ขยับเลขนี้ได้ ถ้ายังทับ)
  const DEF_X_P = 0.02;               // ตำแหน่งเริ่มต้นแนวตั้ง: ชิดซ้าย (ปุ่มสกิลอยู่ฝั่งขวา)
  const W_CLOSED = 0.30, W_OPEN = 0.36;       // ความกว้างแนวนอน (สัดส่วนของจอเกม)
  const W_CLOSED_P = 0.38, W_OPEN_P = 0.38;   // ความกว้างแนวตั้ง (เกิน 0.40 จะเริ่มทับปุ่มสกิล)
  // เก็บตำแหน่งที่ลากไว้แยกตามแนวจอ (x = สัดส่วนซ้าย, b = สัดส่วนจากขอบล่าง) กันตำแหน่งแนวนอนไปทับแนวตั้ง
  const posKey = () => isPortrait() ? 'chatPos2p' : 'chatPos2';
  const LONG_MS = 400;                // กดค้างกี่ ms ถึงเริ่มลาก
  const loadPos = () => {
    try {
      const p = JSON.parse(localStorage.getItem(posKey()));
      if (p && isFinite(p.x) && isFinite(p.b)) return p;
    } catch (e) {}
    return null;
  };

  // ---------- เริ่มระบบ (หลังต่อเซิร์ฟเวอร์) ----------
  const _init = P.initNetwork;
  P.initNetwork = function () {
    _init.apply(this, arguments);
    if (this.socket) this.chatInit();
  };

  P.chatInit = function () {
    if (this.chatSt) return;
    const self = this;
    this.chatSt = { tab: 'world', open: false, log: [], unread: 0, target: '', lastFrom: '', pos: loadPos() };
    this.socket.on('chatMsg', m => self.chatPush(m));
    this.chatBuild();
    this.chatSys('พิมพ์ /w ชื่อ ข้อความ = กระซิบ | /p = ปาร์ตี้ | /r = ตอบกลับ | กดค้างปุ่ม 💬 เพื่อย้ายแชต');
  };

  P.chatSys = function (text) { if (text) this.chatPush({ ch: 'sys', text: text }); };

  P.chatPush = function (m) {
    const st = this.chatSt; if (!st) return;
    m.at = Date.now();
    const mine = m.fromId && this.socket && m.fromId === this.socket.id;
    if (m.ch === 'whisper' && !mine) st.lastFrom = m.from;
    st.log.push(m);
    if (st.log.length > MAX_LOG) st.log.shift();
    if (!st.open && !mine && m.ch !== 'world') st.unread++;   // แจ้งเตือนเฉพาะปาร์ตี้/ส่วนตัว/ระบบ
    this.chatRender();
  };

  // ---------- สร้าง UI ----------
  P.chatBuild = function () {
    if (document.getElementById('chat-box')) return;
    const self = this, st = this.chatSt;
    const root = el('div', 'position:fixed;z-index:9000;pointer-events:none;font-family:Mitr,sans-serif;display:flex;flex-direction:column;justify-content:flex-end');
    root.id = 'chat-box';

    const log = el('div', 'overflow-y:auto;overflow-x:hidden;word-break:break-word;border-radius:6px;box-sizing:border-box;-webkit-overflow-scrolling:touch;touch-action:pan-y');
    log.id = 'chat-log';

    const inRow = el('div', 'display:none;gap:4px;margin-top:3px;align-items:center;pointer-events:auto');
    const toIn = el('input', 'display:none;box-sizing:border-box;border:2px solid #ff9ad5;border-radius:8px;background:#26090f;color:#fff;font-family:inherit;outline:none;padding:3px 6px;min-width:0');
    toIn.type = 'text'; toIn.maxLength = 12; toIn.placeholder = 'ชื่อผู้รับ'; toIn.autocomplete = 'off';
    toIn.addEventListener('input', () => { st.target = toIn.value.trim(); });
    const msgIn = el('input', 'flex:1;box-sizing:border-box;border:2px solid #ffd45c;border-radius:8px;background:#26090f;color:#fff;font-family:inherit;outline:none;padding:3px 6px;min-width:0');
    msgIn.type = 'text'; msgIn.maxLength = 100; msgIn.placeholder = 'พิมพ์ข้อความ...'; msgIn.autocomplete = 'off';
    const sendBtn = el('button', 'cursor:pointer;border:2px solid #ffd45c;border-radius:8px;background:#ffd45c;color:#26090f;font-family:inherit;padding:0 10px;touch-action:manipulation', 'ส่ง');
    // กันเกมแย่งปุ่มคีย์บอร์ด (เช่น WASD) ตอนพิมพ์
    [toIn, msgIn].forEach(i => ['keydown', 'keyup', 'keypress'].forEach(ev => i.addEventListener(ev, e => e.stopPropagation())));
    msgIn.addEventListener('keydown', e => { if (e.key === 'Enter') self.chatSend(); });
    // กันเกม (Phaser/ระบบคุมจอยสติ๊ก) แย่งการแตะ จนช่องพิมพ์โฟกัสไม่ได้
    [toIn, msgIn, sendBtn].forEach(i => ['pointerdown', 'touchstart', 'mousedown', 'click'].forEach(ev => i.addEventListener(ev, e => e.stopPropagation(), { passive: true })));
    sendBtn.onclick = () => self.chatSend();
    inRow.append(toIn, msgIn, sendBtn);

    const bar = el('div', 'display:flex;gap:4px;margin-top:3px;align-items:center');
    // touch-action:none = ให้ลากบนมือถือได้โดยหน้าไม่เลื่อน
    const tog = el('button', 'position:relative;cursor:pointer;border:2px solid #8a6a32;border-radius:8px;background:#3a2a5a;color:#fff;font-family:inherit;padding:0 8px;pointer-events:auto;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none', '💬');
    const badge = el('span', 'display:none;position:absolute;right:-5px;top:-5px;min-width:14px;height:14px;line-height:14px;border-radius:7px;background:#e0413a;color:#fff;font-size:10px;text-align:center;padding:0 2px');
    tog.appendChild(badge);

    // ----- กดค้างแล้วลากเพื่อย้ายแชต -----
    let drag = null, moved = false, timer = null, down = null;
    const canvasRect = () => { const cv = document.querySelector('canvas'); return cv ? cv.getBoundingClientRect() : null; };
    tog.addEventListener('pointerdown', e => {
      const r = canvasRect(); if (!r || r.width < 50) return;
      moved = false;
      down = { x: e.clientX, y: e.clientY };
      clearTimeout(timer);
      timer = setTimeout(() => {
        const rr = root.getBoundingClientRect();
        drag = {
          sx: down.x, sy: down.y,
          x0: (rr.left - r.left) / r.width,              // ตำแหน่งซ้ายตอนเริ่ม (สัดส่วน)
          b0: (r.bottom - rr.bottom) / r.height          // ตำแหน่งล่างตอนเริ่ม (สัดส่วน)
        };
        tog.style.outline = '3px solid #ffd45c';
        if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e2) {} }
      }, LONG_MS);
    });
    window.addEventListener('pointermove', e => {
      if (!down) return;
      if (!drag) {                                       // ขยับนิ้วก่อนครบเวลา = ไม่ใช่การกดค้าง
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { clearTimeout(timer); down = null; }
        return;
      }
      const r = canvasRect(); if (!r) return;
      moved = true;
      const w = root.offsetWidth / r.width;
      st.pos = {
        x: Math.max(0, Math.min(1 - w, drag.x0 + (e.clientX - drag.sx) / r.width)),
        b: Math.max(0, Math.min(0.55, drag.b0 - (e.clientY - drag.sy) / r.height))
      };
      self.chatLayout();
      e.preventDefault();
    }, { passive: false });
    const endDrag = () => {
      clearTimeout(timer);
      if (drag) {
        try { localStorage.setItem(posKey(), JSON.stringify(st.pos)); } catch (e) {}
        drag = null; tog.style.outline = '';
      }
      down = null;
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    tog.addEventListener('contextmenu', e => e.preventDefault());   // กันเมนูกดค้างของเบราว์เซอร์

    tog.onclick = () => {
      if (moved) { moved = false; return; }               // เพิ่งลากเสร็จ = ไม่สลับเปิด/ปิด
      st.open = !st.open; if (st.open) st.unread = 0;
      self.chatRender(); self.chatLayout();
      if (st.open) setTimeout(() => { log.scrollTop = log.scrollHeight; }, 0);
    };

    const tabs = el('div', 'display:none;gap:4px');
    const tabBtns = {};
    ['world', 'party', 'whisper'].forEach(t => {
      const b = el('button', 'cursor:pointer;border-radius:8px;font-family:inherit;padding:0 8px;touch-action:manipulation;pointer-events:auto', LBL[t]);
      b.onclick = () => { st.tab = t; self.chatRender(); self.chatLayout(); };
      tabs.appendChild(b); tabBtns[t] = b;
    });
    bar.append(tog, tabs);
    root.append(log, inRow, bar);
    document.body.appendChild(root);
    this._chat = { root, log, inRow, toIn, msgIn, sendBtn, tog, badge, tabs, tabBtns };

    window.addEventListener('resize', () => self.chatLayout());
    setInterval(() => { self.chatLayout(); if (!st.open) self.chatRender(); }, 1000);
    this.chatLayout();
    this.chatRender();
  };

  // จัดตำแหน่งตามสเกลจอ
  P.chatLayout = function () {
    const c = this._chat; if (!c) return;
    const cv = document.querySelector('canvas'); if (!cv) return;
    const r = cv.getBoundingClientRect();
    if (r.width < 50) { c.root.style.display = 'none'; return; }
    c.root.style.display = 'flex';
    const st = this.chatSt, por = isPortrait();
    const k = r.width / (typeof W !== 'undefined' ? W : 960), open = st.open;
    const fs = Math.max(11, 12 * k);
    const wFrac = por ? (open ? W_OPEN_P : W_CLOSED_P) : (open ? W_OPEN : W_CLOSED);
    const w = r.width * wFrac;

    // ตำแหน่ง: ใช้ที่ลากไว้ ถ้าไม่มีใช้ค่าเริ่มต้น (แนวนอน: พ้นปุ่มขวดยา | แนวตั้ง: ชิดซ้าย พ้นปุ่มสกิล)
    let x, bottomPx;
    if (st.pos) {
      x = st.pos.x;
      bottomPx = st.pos.b * r.height;
    } else {
      x = por ? DEF_X_P : DEF_X;
      bottomPx = 4 * k;
    }
    x = Math.max(0, Math.min(1 - wFrac, x));          // กันล้นขอบขวา
    c.root.style.left = (r.left + x * r.width) + 'px';
    c.root.style.bottom = Math.max(0, window.innerHeight - r.bottom + bottomPx) + 'px';
    c.root.style.width = w + 'px';

    c.log.style.fontSize = fs + 'px';
    c.log.style.lineHeight = '1.3';
    c.log.style.maxHeight = (fs * 1.3 * (open ? 8 : 4) + 6) + 'px';
    c.log.style.height = open ? c.log.style.maxHeight : 'auto';
    [c.toIn, c.msgIn].forEach(i => { i.style.fontSize = Math.max(14, fs) + 'px'; i.style.height = Math.max(28, 26 * k) + 'px'; });
    c.toIn.style.width = '30%';
    c.sendBtn.style.fontSize = fs + 'px'; c.sendBtn.style.height = Math.max(28, 26 * k) + 'px';
    c.tog.style.fontSize = Math.max(14, 16 * k) + 'px'; c.tog.style.height = Math.max(28, 26 * k) + 'px';
    Object.values(c.tabBtns).forEach(b => { b.style.fontSize = fs + 'px'; b.style.height = Math.max(28, 26 * k) + 'px'; });
  };

  // ---------- แสดงข้อความ ----------
  P.chatRender = function () {
    const c = this._chat, st = this.chatSt; if (!c) return;
    const open = st.open, me = this.socket && this.socket.id, now = Date.now();
    // ปุ่ม/ช่องกรอก
    c.inRow.style.display = open ? 'flex' : 'none';
    c.tabs.style.display = open ? 'flex' : 'none';
    c.toIn.style.display = (open && st.tab === 'whisper') ? 'block' : 'none';
    if (document.activeElement !== c.toIn) c.toIn.value = st.target;
    c.msgIn.style.borderColor = COL[st.tab];
    c.sendBtn.style.background = COL[st.tab];
    Object.keys(c.tabBtns).forEach(t => {
      const on = t === st.tab, b = c.tabBtns[t];
      b.style.background = on ? COL[t] : '#26090f';
      b.style.color = on ? '#26090f' : COL[t];
      b.style.border = '2px solid ' + COL[t];
    });
    c.badge.style.display = st.unread ? 'block' : 'none';
    c.badge.textContent = st.unread > 9 ? '9+' : String(st.unread);
    // กล่องข้อความ
    c.log.style.pointerEvents = open ? 'auto' : 'none';
    c.log.style.background = open ? 'rgba(20,6,10,.82)' : 'transparent';
    c.log.style.border = open ? '2px solid #8a6a32' : '0';
    c.log.style.padding = open ? '3px 6px' : '0';
    const atBottom = c.log.scrollTop + c.log.clientHeight >= c.log.scrollHeight - 8;
    c.log.textContent = '';
    let list = st.log;
    if (!open) list = list.filter(m => now - m.at < FADE_MS).slice(-4);
    list.forEach(m => c.log.appendChild(this.chatLine(m, me, open)));
    if (open && atBottom) c.log.scrollTop = c.log.scrollHeight;
  };

  P.chatLine = function (m, me, canTap) {
    const self = this, line = el('div', SHADOW + 'color:#fff;margin-bottom:1px');
    if (m.ch === 'sys') { line.style.color = COL.sys; line.textContent = '• ' + m.text; return line; }
    const mine = m.fromId === me;
    const tag = m.ch === 'whisper'
      ? (mine ? '[กระซิบ→' + m.to + '] ' : '[' + m.from + '→คุณ] ')
      : '[' + LBL[m.ch] + '] ';
    line.appendChild(el('span', 'color:' + COL[m.ch], tag));
    if (m.ch !== 'whisper') {
      const nm = el('span', 'color:' + COL[m.ch] + ';cursor:pointer', (m.lv ? 'Lv.' + m.lv + ' ' : '') + m.from + ': ');
      if (canTap && !mine) nm.onclick = () => self.chatWhisperTo(m.from);   // แตะชื่อเพื่อกระซิบ
      line.appendChild(nm);
    }
    line.appendChild(el('span', m.ch === 'whisper' ? 'color:#ffd0ea' : '', m.text));
    return line;
  };

  // ---------- ส่งข้อความ ----------
  P.chatWhisperTo = function (name) {
    const st = this.chatSt; if (!st) return;
    st.tab = 'whisper'; st.target = name; st.open = true; st.unread = 0;
    this.chatRender(); this.chatLayout();
    const c = this._chat; setTimeout(() => { try { c.msgIn.focus(); } catch (e) {} }, 50);
  };

  P.chatSend = function () {
    const self = this, st = this.chatSt, c = this._chat; if (!st || !c) return;
    let text = c.msgIn.value.trim(); if (!text) return;
    let ch = st.tab, to = st.target, m;
    // คำสั่งลัด
    if ((m = text.match(/^\/(?:w|t|ท)\s+(\S+)\s+([\s\S]+)/i))) { ch = 'whisper'; to = m[1]; text = m[2]; }
    else if ((m = text.match(/^\/r\s+([\s\S]+)/i))) {
      if (!st.lastFrom) return this.chatSys('ยังไม่มีคนกระซิบหาคุณ');
      ch = 'whisper'; to = st.lastFrom; text = m[1];
    }
    else if ((m = text.match(/^\/p\s+([\s\S]+)/i))) { ch = 'party'; text = m[1]; }
    else if ((m = text.match(/^\/(?:world|all|s)\s+([\s\S]+)/i))) { ch = 'world'; text = m[1]; }
    else if (/^\/resetchat\s*$/i.test(text)) {            // รีเซ็ตตำแหน่งแชตกลับค่าเริ่มต้น (เฉพาะแนวจอที่เล่นอยู่)
      st.pos = null;
      try { localStorage.removeItem(posKey()); } catch (e) {}
      c.msgIn.value = '';
      this.chatLayout();
      return this.chatSys('รีเซ็ตตำแหน่งแชตแล้ว');
    }
    if (ch === 'party' && !this.party) return this.chatSys('คุณยังไม่ได้อยู่ในปาร์ตี้');
    if (ch === 'whisper' && !to) return this.chatSys('ใส่ชื่อผู้รับ หรือแตะชื่อในแชต');
    const members = this.party ? this.party.members.map(x => x.id) : [];
    this.socket.emit('chat', { ch: ch, text: text, to: to, members: members }, r => {
      if (r && r.ok) { c.msgIn.value = ''; if (ch === 'whisper') st.target = to; self.chatRender(); }
      else if (r && r.msg) self.chatSys(r.msg);
    });
  };

  // ---------- ปุ่ม "กระซิบ" ในเมนูแตะผู้เล่นอื่น ----------
  const _sm = P.socialMenu;
  if (typeof _sm === 'function') {
    P.socialMenu = function (id) {
      _sm.apply(this, arguments);
      const o = this.others[id], box = this._socBox;
      if (!o || !box || !box.firstChild) return;
      const self = this, card = box.firstChild;
      const b = el('button', 'font-family:Mitr,sans-serif;font-size:14px;padding:7px 12px;border-radius:10px;cursor:pointer;border:2px solid #ff9ad5;color:#ffb8e0;background:#26090f;margin:3px;touch-action:manipulation', '💬 กระซิบ');
      b.onclick = () => { box.remove(); self._socBox = null; self.chatWhisperTo(o.name); };
      card.insertBefore(b, card.lastChild);   // แทรกก่อนปุ่ม "ปิด"
    };
  }
})();
