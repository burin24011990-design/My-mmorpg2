(function () {
  const P = Main.prototype;
  const scene = () => Phaser.GAMES[0] && Phaser.GAMES[0].scene.scenes[0];
  const num = (...v) => { for (const x of v) if (typeof x === 'number' && !isNaN(x)) return x; return 0; };

  // ชื่อช่องในหน้าต่างใหม่ -> ชื่อช่องในเกมคุณ
  const SLOT_MAP = {
    weapon: 'weapon', armor: 'armor', helm: 'helmet', gloves: 'gloves',
    boots: 'shoes', amulet: 'necklace', ring: 'ring1', relic: 'ring2'
  };

  function mapItem(it) {
    if (!it) return null;
    return {
      icon: it.icon || it.emoji || '🗡️',
      plus: it.plus || it.enhance || it.lv || 0,
      rarity: it.rarity === 'legendary' ? 'legend' : (it.rarity || '')
    };
  }

  PixelPanels.setData(() => {
    const s = scene();
    if (!s || !s.stats) return { name:'-', level:1, title:'', guild:'-', hp:[0,0], mp:[0,0], exp:0, stats:{}, equipment:{}, skills:[], passives:[] };
    const st = s.stats;
    const maxHp = s.maxHp ? s.maxHp() : num(st.maxHp);
    const maxMp = s.maxMp ? s.maxMp() : num(st.maxMp);
    const expNeed = num(st.expNext, st.maxExp, st.next);

    const equipment = {};
    Object.keys(SLOT_MAP).forEach(k => { equipment[k] = mapItem(s.equipment && s.equipment[SLOT_MAP[k]]); });

    return {
      name: st.name || s.playerName || 'Player',
      level: num(st.level, st.lv, 1),
      title: st.title || '',
      guild: st.guild || '-',
      hp: [Math.floor(num(st.hp)), maxHp],
      mp: [Math.floor(num(st.mp)), maxMp],
      exp: expNeed ? +(num(st.exp) / expNeed * 100).toFixed(1) : 0,
      stats: { 'พลังโจมตี': num(s.atk, st.atk), 'พลังป้องกัน': num(st.def) },
      statPoints: num(st.points, st.statPoints),
      equipment: equipment,
      skills: [], passives: []
    };
  });

  P.openStatusPanel = function () { PixelPanels.toggle('status'); };
  P.openSkillBook   = function () { PixelPanels.toggle('skills'); };

  window.addEventListener('pp:useSkill', e => {
    const s = scene();
    if (s && s.castSkill) s.castSkill(e.detail.id);
  });
})();
