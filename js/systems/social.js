// social.js (ฝั่งเกม) -- ผู้เล่นอื่นเป็นตัวละครจริง + เพิ่มเพื่อน + ปาร์ตี้
// โหลดหลัง network.js ก่อน main.js | ต้องใช้คู่กับ server/social.js
(function () {
  const P = Main.prototype;
  const FR_KEY = 'mmo_friends';
  const loadFr = () => { try { return JSON.parse(localStorage.getItem(FR_KEY)) || []; } catch (e) { return []; } };
  const saveFr = l => { try { localStorage.setItem(FR_KEY, JSON.stringify(l)); } catch (e) {} };
  const el = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css || ''; if (text != null) e.textContent = text; return e; };
  const BTN = 'font-family:Mitr,sans-serif;font-size:14px;padding:7px 12px;border-radius:10px;cursor:pointer;border:2px solid #ffd45c;color:#ffe28a;background:#26090f;margin:3px;touch-action:manipulation';

  function addFriend(cid, name) {
    if (!cid || cid === netClientId()) return false;
    const l = loadFr();
    if (l.some(f => f.cid === cid)) return false;
    l.push({ cid: cid, name: name });
    saveFr(l);
    return true;
  }
  const isFriendName = cid => loadFr().some(f => f.cid === cid);

  // ---------- กล่องซ้อนทับ (DOM) ----------
  function closeOverlay(s) {
    if (s._socBox) { s._socBox.remove(); s._socBox = null; }
    clearInterval(s._socPoll);
  }
  function overlay(s, title) {
    closeOverlay(s);
    const box = el('div', 'position:fixed;inset:0;z-index:10003;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);font-family:Mitr,sans-serif;touch-action:manipulation');
    const card = el('div', 'width:min(460px,92vw);max-height:90vh;overflow:auto;background:#26090f;border:2px solid #ffd45c;border-radius:14px;padding:12px 14px;color:#fff;text-align:center;box-shadow:0 8px 30px #000a');
    card.appendChild(el('div', 'font-size:18px;color:#ffe28a;margin-bottom:8px', title));
    box.appendChild(card);
    box.addEventListener('click', e => { if (e.target === box) closeOverlay(s); });
    document.body.appendChild(box);
    s._socBox = box;
    return card;
  }

  // กล่องคำขอ (เพื่อน/เชิญปาร์ตี้) หายเองใน 20 วินาที
  function ask(text, onYes) {
    const box = el('div', 'position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:10004;background:#26090f;border:2px solid #ffd45c;border-radius:12px;padding:10px 14px;color:#fff;font-family:Mitr,sans-serif;text-align:center;box-shadow:0 6px 20px #000a');
    box.appendChild(el('div', 'font-size:14px;margin-bottom:6px', text));
    const y = el('button', BTN + ';background:#ffd45c;color:#26090f', 'ตกลง');
    const n = el('button', BTN, 'ปฏิเสธ');
    const kill = () => { clearTimeout(tm); box.remove(); };
    const tm = setTimeout(kill, 20000);
    y.onclick = () => { kill(); onYes(); };
    n.onclick = kill;
    box.append(y, n);
    document.body.appendChild(box);
  }

  // ---------- ผู้เล่นอื่นเป็นตัวละครจริง ----------
  P.addOther = function (p) {
    if (this.others[p.id]) return;
    let s;
    if (this.textures.exists('hero')) {
      s = this.add.sprite(p.x, p.y, 'hero', 18);
      s.setScale(this.player.scaleX || 1, this.player.scaleY || 1);
    } else {
      s = this.add.sprite(p.x, p.y, 'player').setTint(0xffaa44);
    }
    s.setDepth(this.player.depth || 10);
    const label = (p.lv ? 'Lv.' + p.lv + ' ' : '') + p.name;
    const t = netNameFx(this.add.text(p.x, p.y - NET_NAME_Y, label, netNameStyle('#ffd9a0')).setOrigin(0.5).setDepth(50));
    const o = { s: s, t: t, tx: p.x, ty: p.y, stage: p.stage, name: p.name, lv: p.lv, dir: 'down', px: p.x, py: p.y, hero: this.textures.exists('hero') };
    this.others[p.id] = o;
    s.setInteractive({ useHandCursor: true });
    s.on('pointerdown', () => this.socialMenu(p.id));
  };

  const _upd = P.updateNetwork;
  P.updateNetwork = function (time) {
    _upd.apply(this, arguments);
    const pd = this.player.depth || 10;
    Object.keys(this.others || {}).forEach(id => {
      const o = this.others[id];
      if (!o || !o.s || !o.s.scene) return;
      const dx = o.s.x - o.px, dy = o.s.y - o.py;
      const moving = Math.hypot(dx, dy) > 0.4;
      if (moving) o.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      o.px = o.s.x; o.py = o.s.y;
      if (o.hero && window.HeroAnims) { try { HeroAnims.play(o.s, moving ? 'walk' : 'idle', o.dir); } catch (e) {} }
      o.s.setDepth(pd + (o.s.y > this.player.y ? 0.1 : -0.1));
      if (o.s.input) o.s.input.enabled = o.s.visible;
      const inP = !!(this.party && this.party.members.some(m => m.id === id));
      if (o.inP !== inP) { o.inP = inP; o.t.setColor(inP ? '#7dff9a' : '#ffd9a0'); }
    });
    const mine = !!this.party;
    if (this.myLabel && this._myP !== mine) { this._myP = mine; this.myLabel.setColor(mine ? '#7dff9a' : '#ffffff'); }
  };

  // ---------- โบนัส EXP ปาร์ตี้ (3 คน +10% / 4 คน +20% / 5 คน +40%) ----------
  const _gx = P.gainExp;
  if (typeof _gx === 'function') {
    P.gainExp = function (n) {
      const b = this.party && this.party.bonus;
      return _gx.call(this, b ? Math.round(n * (1 + b / 100)) : n);
    };
  }

  // ---------- เริ่มระบบ (หลังต่อเซิร์ฟเวอร์) ----------
  const _init = P.initNetwork;
  P.initNetwork = function () {
    _init.apply(this, arguments);
    if (this.socket) this.socialInit();
  };

  P.socialInit = function () {
    const self = this, s = this.socket;
    this.party = null;
    s.on('friendReq', d => ask(d.name + ' ขอเป็นเพื่อน', () => {
      addFriend(d.cid, d.name);
      s.emit('friendAcc', { to: d.from });
      self.toastMsg('เป็นเพื่อนกับ ' + d.name + ' แล้ว');
    }));
    s.on('friendOk', d => { if (addFriend(d.cid, d.name)) self.toastMsg(d.name + ' ตอบรับเป็นเพื่อนแล้ว'); });
    s.on('pInvited', d => ask(d.name + ' เชิญเข้าปาร์ตี้', () => {
      s.emit('pAccept', { from: d.from }, r => { if (r && !r.ok) self.toastMsg(r.msg); else self.toastMsg('เข้าร่วมปาร์ตี้แล้ว'); });
    }));
    s.on('party', d => {
      const before = (self.party && self.party.bonus) || 0, after = (d && d.bonus) || 0;
      self.party = d;
      self.socialRenderParty();
      if (before !== after) {
        self.toastMsg(after ? 'โบนัส EXP ปาร์ตี้ +' + after + '%' : 'โบนัส EXP ปาร์ตี้หมดไป');
      }
    });
    s.on('pMsg', m => self.toastMsg(m));
    s.on('state', list => list.forEach(a => {
      const o = self.others[a[0]];
      if (o && o.t && o.t.scene && a[4] && o.lv !== a[4]) { o.lv = a[4]; o.t.setText('Lv.' + a[4] + ' ' + o.name); }
    }));
    // ส่ง HP/เลเวลให้เซิร์ฟเวอร์ทุก 1 วินาที (ใช้แสดงในปาร์ตี้)
    setInterval(() => {
      if (!self.online || !self.stats) return;
      try { s.emit('hp', { hp: self.stats.hp, mhp: self.maxHp(), lv: self.stats.level }); } catch (e) {}
    }, 1000);
    this.socialBuildBtn();
  };

  // ---------- ปุ่ม 👥 + กรอบปาร์ตี้ ----------
  P.socialBuildBtn = function () {
    if (document.getElementById('btn-social')) return;
    const self = this;
    const b = el('button', 'position:fixed;z-index:9000;box-sizing:border-box;padding:0;cursor:pointer;touch-action:manipulation;font-family:Mitr,sans-serif;color:#fff;overflow:hidden;border:2px solid #8a6a32;background:#3a2a5a');
    b.id = 'btn-social';
    b.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;line-height:1.1"><div class="hb-i">👥</div><div class="hb-t">สังคม</div></div>';
    b.addEventListener('click', () => self.socialPanel('friends'));
    document.body.appendChild(b);
    const hud = el('div', 'position:fixed;z-index:8999;pointer-events:none;font-family:Mitr,sans-serif');
    hud.id = 'party-hud';
    document.body.appendChild(hud);
    const layout = () => {
      const cv = document.querySelector('canvas'); if (!cv) return;
      const r = cv.getBoundingClientRect(); if (r.width < 50) return;
      const k = r.width / W;
      b.style.left = (r.left + 250 * k) + 'px'; b.style.top = (r.top + 62 * k) + 'px';
      b.style.width = (50 * k) + 'px'; b.style.height = (46 * k) + 'px'; b.style.borderRadius = (8 * k) + 'px';
      b.querySelector('.hb-i').style.fontSize = (22 * k) + 'px';
      b.querySelector('.hb-t').style.cssText = 'font-size:' + (9 * k) + 'px;text-shadow:-1px 0 #000,1px 0 #000,0 -1px #000,0 1px #000';
      hud.style.left = (r.left + 9 * k) + 'px'; hud.style.top = (r.top + 200 * k) + 'px'; hud.style.width = (150 * k) + 'px';
      hud.dataset.k = k;
    };
    window.addEventListener('resize', layout);
    setInterval(layout, 500);
    layout();
  };

  P.socialRenderParty = function () {
    const hud = document.getElementById('party-hud'); if (!hud) return;
    hud.textContent = '';
    const d = this.party; if (!d) return;
    const k = parseFloat(hud.dataset.k) || 1, me = this.socket.id;
    hud.appendChild(el('div', 'font-size:' + (12 * k) + 'px;color:#ffe28a;margin-bottom:' + (3 * k) + 'px;text-shadow:0 1px 2px #000',
      '👥 ปาร์ตี้ ' + d.members.length + '/5' + (d.bonus ? '  ✨ EXP +' + d.bonus + '%' : '')));
    d.members.forEach(m => {
      const row = el('div', 'background:rgba(20,6,10,.75);border:' + Math.max(1, k) + 'px solid #8a6a32;border-radius:' + (6 * k) + 'px;padding:' + (3 * k) + 'px ' + (6 * k) + 'px;margin-bottom:' + (3 * k) + 'px');
      row.appendChild(el('div', 'font-size:' + (13 * k) + 'px;color:' + (m.id === d.leader ? '#ffd45c' : '#fff') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
        (m.id === d.leader ? '👑 ' : '') + 'Lv.' + m.lv + ' ' + m.name + (m.id === me ? ' (คุณ)' : '')));
      const bar = el('div', 'height:' + (5 * k) + 'px;background:#222;border-radius:3px;margin-top:2px');
      bar.appendChild(el('div', 'height:100%;border-radius:3px;background:#e0413a;width:' + Math.max(0, Math.min(100, m.hp / m.mhp * 100)) + '%'));
      row.appendChild(bar);
      hud.appendChild(row);
    });
  };

  // ---------- เมนูเมื่อแตะผู้เล่นอื่น ----------
  P.socialMenu = function (id) {
    const o = this.others[id]; if (!o) return;
    const self = this;
    const card = overlay(this, o.name + (o.lv ? '  Lv.' + o.lv : ''));
    const add = el('button', BTN, '➕ เพิ่มเพื่อน');
    add.onclick = () => { closeOverlay(self); self.socket.emit('friendReq', { to: id }, r => self.toastMsg((r && r.msg) || '...')); };
    const inv = el('button', BTN, '🎉 เชิญปาร์ตี้');
    inv.onclick = () => { closeOverlay(self); self.socialPartyInvite(id); };
    const x = el('button', BTN, 'ปิด');
    x.onclick = () => closeOverlay(self);
    card.append(add, inv, x);
  };

  P.socialPartyInvite = function (sid) {
    this.socket.emit('pInvite', { to: sid }, r => this.toastMsg((r && r.msg) || '...'));
  };

  // ---------- หน้าสังคม: เพื่อน / ปาร์ตี้ ----------
  P.socialPanel = function (tab) {
    const self = this;
    const card = overlay(this, '👥 สังคม');
    const tabs = el('div', 'display:flex;gap:6px;justify-content:center;margin-bottom:8px');
    [['friends', 'เพื่อน'], ['party', 'ปาร์ตี้']].forEach(t => {
      const b = el('button', BTN + (t[0] === tab ? ';background:#ffd45c;color:#26090f' : ''), t[1]);
      b.onclick = () => self.socialPanel(t[0]);
      tabs.appendChild(b);
    });
    const body = el('div');
    const close = el('button', BTN, 'ปิด');
    close.onclick = () => closeOverlay(self);
    card.append(tabs, body, close);
    if (tab === 'friends') this.socialFriendsBody(body); else this.socialPartyBody(body);
  };

  P.socialFriendsBody = function (body) {
    const self = this;
    let list = loadFr(), st = {};
    const draw = () => {
      body.textContent = '';
      if (!list.length) { body.appendChild(el('div', 'color:#bbb;font-size:13px;padding:10px', 'ยังไม่มีเพื่อน แตะผู้เล่นอื่นในเกมแล้วกด "เพิ่มเพื่อน"')); return; }
      list.forEach(f => {
        const s = st[f.cid];
        const row = el('div', 'display:flex;align-items:center;justify-content:space-between;padding:6px 8px;margin-bottom:4px;border-radius:8px;background:#3a1620;text-align:left');
        const info = el('div');
        info.appendChild(el('div', 'font-size:14px', f.name));
        info.appendChild(el('div', 'font-size:11px;color:' + (s ? '#9be39b' : '#999'), s ? 'ออนไลน์ ด่าน ' + (s.stage + 1) + ' CH' + s.ch + '-' + s.rm : 'ออฟไลน์'));
        const acts = el('div');
        if (s && s.sid !== self.socket.id) {
          const inv = el('button', BTN + ';font-size:12px;padding:4px 8px', 'เชิญปาร์ตี้');
          inv.onclick = () => self.socialPartyInvite(s.sid);
          acts.appendChild(inv);
        }
        const del = el('button', BTN + ';font-size:12px;padding:4px 8px;border-color:#a55;color:#faa', 'ลบ');
        del.onclick = () => { saveFr(loadFr().filter(x => x.cid !== f.cid)); list = loadFr(); draw(); };
        acts.appendChild(del);
        row.append(info, acts);
        body.appendChild(row);
      });
    };
    const poll = () => {
      if (!list.length) return;
      self.socket.emit('friendsStatus', list.map(f => f.cid), r => { st = r || {}; draw(); });
    };
    draw(); poll();
    this._socPoll = setInterval(poll, 4000);
  };

  P.socialPartyBody = function (body) {
    const self = this, d = this.party;
    if (!d) { body.appendChild(el('div', 'color:#bbb;font-size:13px;padding:10px', 'ยังไม่มีปาร์ตี้ แตะผู้เล่นอื่นหรือเลือกเพื่อนเพื่อเชิญ (สูงสุด 5 คน)')); return; }
    const me = this.socket.id;
    body.appendChild(el('div', 'font-size:13px;margin-bottom:6px;color:' + (d.bonus ? '#9be39b' : '#bbb'),
      d.bonus ? '✨ โบนัส EXP +' + d.bonus + '%' : 'โบนัส EXP: 3 คน +10% | 4 คน +20% | 5 คน +40%'));
    d.members.forEach(m => {
      const row = el('div', 'display:flex;align-items:center;justify-content:space-between;padding:6px 8px;margin-bottom:4px;border-radius:8px;background:#3a1620;text-align:left');
      const info = el('div', 'flex:1');
      info.appendChild(el('div', 'font-size:14px', (m.id === d.leader ? '👑 ' : '') + 'Lv.' + m.lv + ' ' + m.name + (m.id === me ? ' (คุณ)' : '')));
      const bar = el('div', 'height:6px;background:#222;border-radius:3px;margin-top:3px;width:90%');
      bar.appendChild(el('div', 'height:100%;border-radius:3px;background:#e0413a;width:' + Math.max(0, Math.min(100, m.hp / m.mhp * 100)) + '%'));
      info.appendChild(bar);
      row.appendChild(info);
      if (d.leader === me && m.id !== me) {
        const k = el('button', BTN + ';font-size:12px;padding:4px 8px;border-color:#a55;color:#faa', 'เตะ');
        k.onclick = () => self.socket.emit('pKick', { id: m.id });
        row.appendChild(k);
      }
      body.appendChild(row);
    });
    const lv = el('button', BTN + ';border-color:#a55;color:#faa', 'ออกจากปาร์ตี้');
    lv.onclick = () => { self.socket.emit('pLeave'); closeOverlay(self); };
    body.appendChild(lv);
  };

  window.SocialIsFriend = isFriendName;
})();
