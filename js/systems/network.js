// ===== ระบบออนไลน์ (Socket.IO) =====
Object.assign(Main.prototype, {
  initNetwork() {
    this.others = {}; this.online = false; this.lastSend = 0;
    if (typeof io === 'undefined' || SERVER_URL.includes('YOUR-SERVER')) return;
    const name = (window.prompt('ตั้งชื่อตัวละคร (ไม่เกิน 12 ตัวอักษร)', '') || 'Player').slice(0, 12);
    this.myLabel = this.add.text(0, 0, name, { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5).setDepth(50);
    this.statusText = this.add.text(W - 10, H - 10, 'กำลังเชื่อมต่อ...', { fontSize: '11px', color: '#ffe9a0' })
      .setOrigin(1, 1).setScrollFactor(0).setDepth(100);
    this.socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    this.socket.on('connect', () => { this.online = true; this.statusText.setText('ออนไลน์'); this.socket.emit('join', name); });
    this.socket.on('disconnect', () => { this.online = false; this.statusText.setText('หลุดการเชื่อมต่อ'); Object.keys(this.others).forEach(id => this.removeOther(id)); });
    this.socket.on('init', d => Object.values(d.players).forEach(p => { if (p.id !== d.id) this.addOther(p); }));
    this.socket.on('joined', p => this.addOther(p));
    this.socket.on('left', id => this.removeOther(id));
    this.socket.on('state', list => {
      list.forEach(([id, x, y, st]) => { const o = this.others[id]; if (o) { o.tx = x; o.ty = y; o.stage = st; } });
      this.statusText.setText('ออนไลน์: ' + list.length + ' คน');
    });
    this.socket.on('skill', d => this.showRemoteSkill(d));
  },

  showRemoteSkill(d) {
    if (d.stage !== undefined && d.stage !== this.stageIdx) return; // อยู่คนละด่าน ไม่ต้องแสดง
    if (String(d.name).startsWith('ulti_')) {
      const cls = d.name.replace('ulti_', ''); const def = ULTI_DEFS[cls];
      if (def) this.flash(d.x, d.y, def.range, CLASSES[cls].color);
      return;
    }
    if (String(d.name).startsWith('basic_')) {
      const cls = d.name.replace('basic_', ''); const def = BASIC_ATTACKS[cls];
      if (!def) return;
      if (def.type === 'proj') this.remoteProjectile(d, CLASSES[cls].color);
      else this.flash(d.x + d.fx * 40, d.y + d.fy * 40, 45, 0xffffff);
      return;
    }
    const def = SKILL_DEFS[d.name]; if (!def) return;
    if (def.type === 'proj') this.remoteProjectile(d, CLASSES[def.class].color);
    else this.flash(d.x, d.y, def.range || 60, CLASSES[def.class] ? CLASSES[def.class].color : 0xffffff);
  },

  remoteProjectile(d, color) {
    const f = this.add.sprite(d.x, d.y, 'proj').setTint(color);
    this.tweens.add({ targets: f, x: d.x + d.fx * 462, y: d.y + d.fy * 462, duration: 1100, onComplete: () => f.destroy() });
  },

  // ส่งข้อมูลไปเซิร์ฟเวอร์พร้อมบอกด่านที่อยู่
  sendNet(ev, data) {
    if (!this.online) return;
    this.socket.emit(ev, Object.assign({ stage: this.stageIdx }, data));
  },

  addOther(p) {
    if (this.others[p.id]) return;
    const s = this.add.sprite(p.x, p.y, 'player').setTint(0xffaa44);
    const t = this.add.text(p.x, p.y - 26, p.name, { fontSize: '12px', color: '#ffd9a0' }).setOrigin(0.5).setDepth(50);
    this.others[p.id] = { s, t, tx: p.x, ty: p.y };
  },

  removeOther(id) { const o = this.others[id]; if (!o) return; o.s.destroy(); o.t.destroy(); delete this.others[id]; },

  updateNetwork(time) {
    const p = this.player;
    if (this.myLabel) this.myLabel.setPosition(p.x, p.y - 26);
    Object.values(this.others || {}).forEach(o => {
      o.s.x += (o.tx - o.s.x) * 0.25; o.s.y += (o.ty - o.s.y) * 0.25;
      o.t.setPosition(o.s.x, o.s.y - 26);
      const vis = o.stage === undefined || o.stage === this.stageIdx; // เห็นเฉพาะคนในด่านเดียวกัน
      o.s.setVisible(vis); o.t.setVisible(vis);
    });
    if (this.online && time - this.lastSend > 66) { this.lastSend = time; this.sendNet('move', { x: Math.round(p.x), y: Math.round(p.y) }); }
  },
});
