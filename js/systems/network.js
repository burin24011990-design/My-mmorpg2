// ===== ระบบออนไลน์ (Socket.IO) + แชนเนล/ห้อง =====
// v+: ส่งเลเวลตอน join (ใช้กับ social.js: แสดง Lv. ข้างชื่อ + ปาร์ตี้)
// v++: ส่งคลาส (cls) ไปกับ join/move และให้ผู้เล่นอื่นใช้สกิน+อนิเมชันใหม่ (HeroAnims) เหมือนตัวเรา
// v+++: แก้บั๊ก state (ช่องที่ 5 คือเลเวล ไม่ใช่คลาส -> เดิมทำให้สกินผู้เล่นอื่นถูกรีเซ็ตเป็นชุดเก่าตลอด)
//       คลาสอยู่ช่องที่ 6 | เอฟเฟกต์สกิลผู้เล่นอื่นเรียก RemoteFx (js/systems/remoteFx.js)
// v++++: วงกลมสำรองของสกิลวางพื้น แสดงที่จุดตกจริง (gx, gy) แทนที่ตัวคนใช้

// ชื่อตัวละครเหนือหัว (ปรับตรงนี้)
const NET_NAME_SIZE = '20px';    // ขนาดชื่อ (เดิม 12px)
const NET_NAME_STROKE = 6;       // ความหนาขอบดำ
const NET_NAME_Y = 32;           // ระยะชื่อเหนือตัวละคร (px)

// อนิเมชันผู้เล่นอื่น (ให้ตรงกับ heroPatch.js)
const NET_HERO_SCALE = 0.75;     // ขนาดตัวละคร
const NET_ATK_MS = 430;          // ล็อกท่าโจมตีปกติ
const NET_SKILL_MS = 300;        // ล็อกท่าสกิล

// แชนเนล/ห้อง (ต้องตรงกับ server.js)
const NET_CH_COUNT = 10;                 // แชนเนลต่อด่าน
const NET_RM_COUNT = 10;                 // ห้องต่อแชนเนล
const NET_ROOM_CAP = 20;                 // คนสูงสุดต่อห้อง
const NET_SWITCH_CD_MS = 5 * 60 * 1000;  // ดีเลย์สลับห้อง 5 นาที
const NET_CH_BTN_CSS = 'position:fixed;left:96px;top:8px;z-index:9000;'; // ตำแหน่งปุ่มแชนเนล (แก้ได้ถ้าทับ UI)

function netNameStyle(color) {
  return {
    fontFamily: 'Mitr, sans-serif',
    fontSize: NET_NAME_SIZE,
    fontStyle: '700',
    color: color,
    stroke: '#000000',
    strokeThickness: NET_NAME_STROKE
  };
}
function netNameFx(t) {   // เงา + ความคมชัดบนมือถือ
  t.setShadow(0, 2, '#000000', 3, true, true);
  t.setResolution(2);
  return t;
}

// ----- ตัวช่วยแชนเนล -----
function netClientId() {   // ใช้ระบุผู้เล่นข้ามการรีเฟรช (เป็นคำใบ้ให้เซิร์ฟเวอร์เท่านั้น)
  try {
    const u = window.firebase && firebase.auth && firebase.auth().currentUser;
    if (u && u.uid) return u.uid;
  } catch (e) {}
  try {
    let id = localStorage.getItem('mmo_cid');
    if (!id) { id = 'c' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('mmo_cid', id); }
    return id;
  } catch (e) { return ''; }
}
function netSavedNum(key, max) {
  try { const v = parseInt(localStorage.getItem(key), 10); if (v >= 1 && v <= max) return v; } catch (e) {}
  return 1;
}
function netCdLeft() {      // เวลาดีเลย์ที่เหลือ (ms) ตามที่จำไว้ในเครื่อง
  try { const ts = parseInt(localStorage.getItem('mmo_ch_ts'), 10) || 0; return Math.max(0, ts + NET_SWITCH_CD_MS - Date.now()); }
  catch (e) { return 0; }
}
function netSetCdLeft(left) {   // บันทึกดีเลย์ที่เหลือ
  try { localStorage.setItem('mmo_ch_ts', left > 0 ? String(Date.now() - (NET_SWITCH_CD_MS - left)) : '0'); } catch (e) {}
}
function netFmtTime(ms) {
  const s = Math.ceil(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// ----- ตัวช่วยสกิน/อนิเมชันของผู้เล่นอื่น -----
function netMyClass(scene) {   // คลาสของตัวเราตอนนี้ (ตามอาวุธที่สวม)
  try { if (typeof scene.currentClass === 'function') return scene.currentClass() || 'sword'; } catch (e) {}
  return 'sword';
}
function netDirFromVec(x, y) {
  if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}
function netApplyClass(o, cls) {   // ตั้งสกินให้ผู้เล่นอื่นตามคลาสที่ได้รับ
  if (!o || typeof cls !== 'string' || !cls || !window.HeroAnims) return;
  o.cls = cls;
  if (o.s) o.s.heroSkin = HeroAnims.skinOf(cls);
}
function netInitHeroSprite(scene, o) {   // ทำให้สไปรต์ผู้เล่นอื่นเป็นชุด hero (ทำครั้งเดียว ไม่ว่า addOther จะมาจากไฟล์ไหน)
  if (!o || o._heroInit || !o.s || !scene.textures.exists('hero')) return;
  o._heroInit = true;
  try {
    if (o.s.texture && o.s.texture.key === 'player') o.s.setTexture('hero', 18);
    if (o.s.clearTint) o.s.clearTint();
    o.s.setScale(window.HeroAnims ? HeroAnims.SCALE : NET_HERO_SCALE);
    if (o.cls) netApplyClass(o, o.cls);
  } catch (e) {}
}

Object.assign(Main.prototype, {
  initNetwork() {
    this.others = {}; this.online = false; this.lastSend = 0;
    this.inRoom = false; this._netStage = null;
    this.channel = netSavedNum('mmo_ch', NET_CH_COUNT);
    this.netRoom = netSavedNum('mmo_rm', NET_RM_COUNT);
    this._enterPending = false; this._enterNext = 0;
    if (typeof io === 'undefined' || SERVER_URL.includes('YOUR-SERVER')) return;
    const name = (window.prompt('ตั้งชื่อตัวละคร (ไม่เกิน 12 ตัวอักษร)', '') || 'Player').slice(0, 12);
    this.myLabel = netNameFx(this.add.text(0, 0, name, netNameStyle('#ffffff')).setOrigin(0.5).setDepth(50));
    this.statusText = this.add.text(W - 10, H - 10, 'กำลังเชื่อมต่อ...', { fontSize: '11px', color: '#ffe9a0' })
      .setOrigin(1, 1).setScrollFactor(0).setDepth(100);
    this.socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    this.netBuildChBtn();

    this.socket.on('connect', () => {
      this.online = true; this.statusText.setText('ออนไลน์');
      this.socket.emit('join', {
        name, stage: this.stageIdx || 0, ch: this.channel, rm: this.netRoom, cid: netClientId(),
        lv: (this.stats && this.stats.level) || 1,
        cls: netMyClass(this)
      });
    });
    this.socket.on('disconnect', () => {
      this.online = false; this.inRoom = false; this._netStage = null; this._enterPending = false;
      this.statusText.setText('หลุดการเชื่อมต่อ');
      Object.keys(this.others).forEach(id => this.removeOther(id));
      this.netRefreshChBtn();
    });
    // เข้าห้องใหม่ (ตอนเข้าเกม / เปลี่ยนด่าน / สลับห้อง)
    this.socket.on('init', d => {
      Object.keys(this.others).forEach(id => this.removeOther(id));
      this.inRoom = true; this.channel = d.ch; this.netRoom = d.rm; this._netStage = d.stage;
      try { localStorage.setItem('mmo_ch', String(d.ch)); localStorage.setItem('mmo_rm', String(d.rm)); } catch (e) {}
      Object.values(d.players).forEach(p => { if (p.id !== d.id) this.addOther(p); });
      this.netRefreshChBtn();
    });
    this.socket.on('roomFull', () => {
      this.inRoom = false;
      this.toastMsg('ด่านนี้เต็มทุกห้อง ลองใหม่ภายหลัง');
      this.netRefreshChBtn();
    });
    this.socket.on('joined', p => this.addOther(p));
    this.socket.on('left', id => this.removeOther(id));
    // state: [id, x, y, ด่าน, เลเวล, คลาส]  (ช่องที่ 5 = เลเวล ใช้กับ social.js | ช่องที่ 6 = คลาส)
    this.socket.on('state', list => {
      list.forEach(row => {
        const id = row[0], x = row[1], y = row[2], st = row[3], cls = row[5];
        const o = this.others[id];
        if (!o) return;
        o.tx = x; o.ty = y; o.stage = st;
        if (typeof cls === 'string' && cls && cls !== o.cls) netApplyClass(o, cls);
      });
      this.statusText.setText('ออนไลน์ CH' + this.channel + '-' + this.netRoom + ': ' + list.length + '/' + NET_ROOM_CAP + ' คน');
    });
    // เซิร์ฟเวอร์แจ้งว่าผู้เล่นคนนั้นเปลี่ยนคลาส/อาวุธ (ถ้ารองรับ)
    this.socket.on('cls', d => { if (d && this.others[d.id]) netApplyClass(this.others[d.id], d.cls); });
    this.socket.on('skill', d => this.showRemoteSkill(d));
  },

  // ----- เปลี่ยนด่าน / สลับห้อง -----
  netEnter(stage, ch, rm, manual) {
    if (!this.online || this._enterPending) return;
    if (manual) {
      const left = netCdLeft();
      if (left > 0) { this.toastMsg('สลับห้องได้อีก ' + netFmtTime(left)); return; }
    }
    this._enterPending = true;
    this.socket.emit('enter', { stage, ch, rm }, res => {
      this._enterPending = false;
      this._enterNext = Date.now() + 1200;       // กันยิงซ้ำถี่เกิน
      res = res || {};
      if (res.ok) {
        this.inRoom = true; this._netStage = res.stage; this.channel = res.ch; this.netRoom = res.rm;
        try { localStorage.setItem('mmo_ch', String(res.ch)); localStorage.setItem('mmo_rm', String(res.rm)); } catch (e) {}
        if (manual) netSetCdLeft(NET_SWITCH_CD_MS);
        if (res.moved) this.toastMsg('ห้อง CH' + ch + '-' + rm + ' เต็ม ย้ายไป CH' + res.ch + '-' + res.rm);
        else if (manual) this.toastMsg('เข้าห้อง CH' + res.ch + '-' + res.rm + ' แล้ว');
      } else if (res.reason === 'cooldown') {
        netSetCdLeft(res.left || 0);
        this.toastMsg('สลับห้องได้อีก ' + netFmtTime(res.left || 0));
      } else if (res.reason === 'full') {
        if (manual) this.toastMsg('ห้อง CH' + ch + '-' + rm + ' เต็ม (' + NET_ROOM_CAP + '/' + NET_ROOM_CAP + ')');
        else {                                    // เปลี่ยนด่านแต่ทุกห้องเต็ม
          this.inRoom = false; this._netStage = stage;
          Object.keys(this.others).forEach(id => this.removeOther(id));
          this.toastMsg('ด่านนี้เต็มทุกห้อง ผู้เล่นอื่นจะมองไม่เห็นคุณ');
        }
      }
      this.netRefreshChBtn();
    });
  },

  // ----- UI แชนเนล/ห้อง -----
  netBuildChBtn() {
    let b = document.getElementById('btn-ch');
    if (!b) {
      b = document.createElement('button');
      b.id = 'btn-ch';
      b.style.cssText = NET_CH_BTN_CSS + 'font-family:Mitr,sans-serif;font-size:14px;padding:6px 12px;' +
        'border-radius:10px;border:2px solid #ffd45c;background:#26090fcc;color:#ffe28a;cursor:pointer;touch-action:manipulation';
      document.body.appendChild(b);
    }
    b.onclick = () => this.netTogglePanel();
    this.netRefreshChBtn();
  },

  netRefreshChBtn() {
    const b = document.getElementById('btn-ch');
    if (b) b.textContent = this.inRoom ? '📡 CH' + this.channel + '-' + this.netRoom : '📡 ออฟไลน์';
  },

  netTogglePanel() {
    if (this._chPanel) { this.netClosePanel(); return; }
    if (!this.online) { this.toastMsg('ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์'); return; }
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,.55);font-family:Mitr,sans-serif;touch-action:manipulation';
    const card = document.createElement('div');
    card.style.cssText = 'width:min(600px,94vw);max-height:92vh;overflow:auto;background:#26090f;border:2px solid #ffd45c;' +
      'border-radius:14px;padding:12px;color:#fff;text-align:center;box-shadow:0 8px 30px #000a';
    box.appendChild(card);
    box.addEventListener('click', e => { if (e.target === box) this.netClosePanel(); });
    document.body.appendChild(box);
    this._chPanel = { box, card, res: null, viewCh: this.inRoom ? this.channel : 1 };

    const fetchNow = () => {
      if (!this._chPanel) return;
      this.socket.emit('getChannels', this.stageIdx, res => {
        if (!res || !this._chPanel) return;
        netSetCdLeft(res.left || 0);
        this._chPanel.res = res;
        this.netRenderPanel();
      });
    };
    fetchNow();
    this._chPoll = setInterval(fetchNow, 3000);
    this._chTick = setInterval(() => this.netRenderPanel(), 1000);
    this.netRenderPanel();
  },

  netClosePanel() {
    if (!this._chPanel) return;
    clearInterval(this._chPoll); clearInterval(this._chTick);
    this._chPanel.box.remove();
    this._chPanel = null;
  },

  netRenderPanel() {
    const P = this._chPanel; if (!P) return;
    const res = P.res, card = P.card, view = P.viewCh;
    card.textContent = '';
    const mk = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e; };
    // สี: เขียว = ว่าง, ส้ม = เริ่มแน่น (>=75%), แดง = เต็ม
    const tone = (n, cap) => {
      if (n === null) return { bg: '#1d3b24', border: '#4caf50', color: '#fff', num: '#fff' };
      if (n >= cap) return { bg: '#6b1111', border: '#ff3b3b', color: '#ffd0d0', num: '#ff6b6b' };
      if (n >= cap * 0.75) return { bg: '#4a3a12', border: '#ffb300', color: '#fff', num: '#fff' };
      return { bg: '#1d3b24', border: '#4caf50', color: '#fff', num: '#fff' };
    };

    const stageName = (typeof ZONES !== 'undefined' && ZONES[this.stageIdx]) ? ZONES[this.stageIdx].name : 'ด่าน ' + ((this.stageIdx || 0) + 1);
    card.appendChild(mk('div', 'font-size:19px;color:#ffe28a;margin-bottom:2px', '📡 เลือกแชนเนล/ห้อง — ' + stageName));

    const left = netCdLeft();
    card.appendChild(mk('div', 'font-size:12px;margin-bottom:8px;color:' + (left > 0 ? '#ff9a9a' : '#9be39b'),
      left > 0 ? 'สลับห้องได้อีก ' + netFmtTime(left) : 'สลับห้องได้ (หลังสลับต้องรอ 5 นาที)'));

    const counts = res ? res.counts : null;
    const curCh = res ? res.curCh : 0, curRm = res ? res.curRm : 0;

    // แถวแชนเนล (แสดงผลรวมคนทั้งแชนเนล)
    card.appendChild(mk('div', 'font-size:12px;color:#ffe28a;margin-bottom:4px', 'แชนเนล'));
    const chRow = mk('div', 'display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-bottom:10px');
    for (let c = 1; c <= NET_CH_COUNT; c++) {
      const total = counts ? counts[c - 1].reduce((a, b) => a + b, 0) : null;
      const t = tone(total, NET_RM_COUNT * NET_ROOM_CAP);
      const sel = c === view;
      const b = mk('button', 'font-family:inherit;padding:5px 0;border-radius:8px;cursor:pointer;line-height:1.2;' +
        'background:' + t.bg + ';color:' + t.color + ';border:' + (sel ? '3px solid #ffe28a' : '2px solid ' + t.border));
      b.appendChild(mk('div', 'font-size:14px', String(c) + (c === curCh ? ' ●' : '')));
      b.appendChild(mk('div', 'font-size:10px;color:' + t.num, total === null ? '…' : String(total)));
      b.onclick = () => { P.viewCh = c; this.netRenderPanel(); };
      chRow.appendChild(b);
    }
    card.appendChild(chRow);

    // กริดห้องของแชนเนลที่เลือก
    card.appendChild(mk('div', 'font-size:12px;color:#ffe28a;margin-bottom:4px', 'แชนเนล ' + view + ' — เลือกห้อง (คนในห้อง/' + NET_ROOM_CAP + ')'));
    const grid = mk('div', 'display:grid;grid-template-columns:repeat(5,1fr);gap:8px');
    for (let r = 1; r <= NET_RM_COUNT; r++) {
      const n = counts ? counts[view - 1][r - 1] : null;
      const full = n !== null && n >= NET_ROOM_CAP;
      const isCur = view === curCh && r === curRm;
      const t = tone(n, NET_ROOM_CAP);
      const btn = mk('button', 'font-family:inherit;padding:7px 2px;border-radius:10px;cursor:' + (full || isCur ? 'default' : 'pointer') + ';' +
        'background:' + t.bg + ';color:' + t.color + ';border:' + (isCur ? '3px solid #ffe28a' : '2px solid ' + t.border) + ';line-height:1.3');
      btn.appendChild(mk('div', 'font-size:14px', 'ห้อง ' + r));
      btn.appendChild(mk('div', 'font-size:15px;font-weight:600;color:' + t.num, n === null ? '…' : n + '/' + NET_ROOM_CAP));
      btn.appendChild(mk('div', 'font-size:11px;opacity:.9;min-height:14px', full ? 'เต็ม' : (isCur ? '● อยู่ที่นี่' : '')));
      btn.onclick = () => {
        if (full || isCur) return;
        this.netEnter(this.stageIdx, view, r, true);
        this.netClosePanel();
      };
      grid.appendChild(btn);
    }
    card.appendChild(grid);

    const close = mk('button', 'margin-top:10px;font-family:inherit;font-size:15px;padding:6px 22px;border-radius:10px;' +
      'cursor:pointer;border:2px solid #ffd45c;color:#ffe28a;background:#26090f', 'ปิด');
    close.onclick = () => this.netClosePanel();
    card.appendChild(close);
  },

  // ----- เหตุการณ์จากผู้เล่นอื่น -----

  // หาผู้เล่นอื่นที่เป็นเจ้าของสกิล (ใช้ id ถ้าเซิร์ฟเวอร์ส่งมา ไม่งั้นเลือกคนที่อยู่ใกล้จุดปล่อยที่สุด)
  netFindCaster(d) {
    if (d.id && this.others[d.id]) return this.others[d.id];
    let best = null, bd = 90 * 90;
    Object.values(this.others || {}).forEach(o => {
      if (!o.s) return;
      const dx = o.s.x - d.x, dy = o.s.y - d.y, dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = o; }
    });
    return best;
  },

  // เล่นท่าโจมตีให้ผู้เล่นอื่น + อัปเดตสกินจากชื่อสกิล (กรณีเซิร์ฟเวอร์ไม่ได้ส่ง cls มา)
  netRemoteAttack(d) {
    try {
      if (!window.HeroAnims) return;
      const name = String(d.name || '');
      let cls = null, isSkill = true;
      if (name.startsWith('ulti_')) cls = name.slice(5);
      else if (name.startsWith('basic_')) { cls = name.slice(6); isSkill = false; }
      else if (typeof SKILL_DEFS !== 'undefined' && SKILL_DEFS[name]) cls = SKILL_DEFS[name].class;
      const o = this.netFindCaster(d);
      if (!o || !o.s) return;
      if (cls && cls !== o.cls) netApplyClass(o, cls);
      netInitHeroSprite(this, o);
      const c = o.cls || cls || 'sword';
      let dir = o._dir || 'right';
      if (typeof d.fx === 'number' && typeof d.fy === 'number' && (d.fx || d.fy)) dir = netDirFromVec(d.fx, d.fy);
      else if (typeof d.gx === 'number' && typeof d.gy === 'number' && (d.gx !== d.x || d.gy !== d.y)) dir = netDirFromVec(d.gx - d.x, d.gy - d.y);
      o._dir = dir;
      const act = HeroAnims.attackOf(c, isSkill);
      o._atkUntil = this.time.now + (act === 'skill' ? NET_SKILL_MS : NET_ATK_MS);
      o.s.anims.timeScale = 1;
      HeroAnims.play(o.s, act, dir);
    } catch (e) {}
  },

  showRemoteSkill(d) {
    if (!d) return;
    if (d.stage !== undefined && d.stage !== this.stageIdx) return; // อยู่คนละด่าน ไม่ต้องแสดง
    this.netRemoteAttack(d);

    // เอฟเฟกต์สกิลจริง (สไปรต์) ที่ตัวผู้เล่นอื่น/จุดตก -- ถ้าเล่นได้จะไม่ใช้วงกลมสำรองด้านล่าง
    try {
      if (window.RemoteFx && RemoteFx.play(this, d, this.netFindCaster(d))) return;
    } catch (e) { console.error('RemoteFx', e); }

    // ----- สำรอง: วงกลม/กระสุนสีเรียบๆ (กรณีไม่มี remoteFx.js หรือสกิลนั้นไม่มีภาพ) -----
    try {
      // จุดตกของสกิลลากเล็ง (ถ้าไม่มี ใช้ตำแหน่งคนใช้)
      const gx = (typeof d.gx === 'number') ? d.gx : d.x;
      const gy = (typeof d.gy === 'number') ? d.gy : d.y;
      const nm = String(d.name || '');
      if (nm.startsWith('ulti_')) {
        const cls = nm.replace('ulti_', ''); const def = ULTI_DEFS[cls];
        if (def) this.flash(gx, gy, def.range, CLASSES[cls] ? CLASSES[cls].color : 0xffffff);
        return;
      }
      if (nm.startsWith('basic_')) {
        const cls = nm.replace('basic_', ''); const def = BASIC_ATTACKS[cls];
        if (!def) return;
        const col = CLASSES[cls] ? CLASSES[cls].color : 0xffffff;
        if (def.type === 'proj') this.remoteProjectile(d, col);
        else this.flash(d.x + d.fx * 40, d.y + d.fy * 40, 45, 0xffffff);
        return;
      }
      const def = SKILL_DEFS[nm]; if (!def) return;
      const col = CLASSES[def.class] ? CLASSES[def.class].color : 0xffffff;
      if (def.type === 'proj') this.remoteProjectile(d, col);
      else this.flash(gx, gy, def.range || 60, col);
    } catch (e) { console.error('showRemoteSkill', e); }
  },

  remoteProjectile(d, color) {
    const f = this.add.sprite(d.x, d.y, 'proj').setTint(color);
    this.tweens.add({ targets: f, x: d.x + d.fx * 462, y: d.y + d.fy * 462, duration: 1100, onComplete: () => f.destroy() });
  },

  // ส่งข้อมูลไปเซิร์ฟเวอร์พร้อมบอกด่านที่อยู่ (ส่งเฉพาะตอนอยู่ในห้อง)
  sendNet(ev, data) {
    if (!this.online || !this.inRoom) return;
    this.socket.emit(ev, Object.assign({ stage: this.stageIdx }, data));
  },

  // (social.js จะทับฟังก์ชันนี้ให้เป็นตัวละครจริง ถ้าไม่โหลด social.js จะใช้แบบนี้)
  addOther(p) {
    if (this.others[p.id]) return;
    const useHero = !!(window.HeroAnims && this.textures.exists('hero'));
    const s = this.add.sprite(p.x, p.y, useHero ? 'hero' : 'player', useHero ? 18 : undefined);
    if (useHero) s.setScale(HeroAnims.SCALE); else s.setTint(0xffaa44);
    const t = netNameFx(this.add.text(p.x, p.y - NET_NAME_Y, p.name, netNameStyle('#ffd9a0')).setOrigin(0.5).setDepth(50));
    const o = { s, t, tx: p.x, ty: p.y, stage: p.stage, _heroInit: useHero };
    this.others[p.id] = o;
    if (p.cls) netApplyClass(o, p.cls);
  },

  removeOther(id) { const o = this.others[id]; if (!o) return; o.s.destroy(); o.t.destroy(); delete this.others[id]; },

  updateNetwork(time) {
    const p = this.player;
    if (this.myLabel) this.myLabel.setPosition(p.x, p.y - NET_NAME_Y);

    // เปลี่ยนด่านแล้ว -> แจ้งเซิร์ฟเวอร์ให้ย้ายห้อง (คงแชนเนล/ห้องเดิม)
    if (this.online && this._netStage !== null && this.stageIdx !== this._netStage &&
        !this._enterPending && Date.now() >= this._enterNext) {
      this.netEnter(this.stageIdx, this.channel, this.netRoom, false);
    }

    const now = this.time.now;
    Object.values(this.others || {}).forEach(o => {
      o.s.x += (o.tx - o.s.x) * 0.25; o.s.y += (o.ty - o.s.y) * 0.25;
      o.t.setPosition(o.s.x, o.s.y - NET_NAME_Y);
      const vis = o.stage === undefined || o.stage === this.stageIdx; // เห็นเฉพาะคนในด่านเดียวกัน
      o.s.setVisible(vis); o.t.setVisible(vis);

      // ----- อนิเมชันเดิน/ยืนของผู้เล่นอื่น (ใช้ชุดใหม่ตามคลาส) -----
      if (!vis || !window.HeroAnims || !o.s.anims) return;
      netInitHeroSprite(this, o);
      if (now < (o._atkUntil || 0)) return;               // กำลังเล่นท่าโจมตีอยู่
      const dx = o.tx - o.s.x, dy = o.ty - o.s.y;
      if (Math.hypot(dx, dy) > 2.5) { o._movingTill = now + 140; o._dir = netDirFromVec(dx, dy); }
      const moving = now < (o._movingTill || 0);
      HeroAnims.play(o.s, moving ? 'walk' : 'idle', o._dir || 'down');
      o.s.anims.timeScale = 1;
    });

    if (this.online && this.inRoom && time - this.lastSend > 66) {
      this.lastSend = time;
      this.sendNet('move', { x: Math.round(p.x), y: Math.round(p.y), cls: netMyClass(this) });
    }
  },
});
