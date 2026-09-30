(function () {
  const P = Main.prototype;

  const _create = P.create;
  P.create = function () {
    window.__mainScene = this;
    return _create.apply(this, arguments);
  };
  const scene = () => window.__mainScene;

  const num = (...v) => {
    for (const x of v) if (typeof x === 'number' && !isNaN(x)) return x;
    return 0;
  };

  // แปลงเท็กซ์เจอร์ Phaser -> data URL (เก็บแคชไว้)
  const cache = {};
  function texUrl(s, key) {
    if (!key) return '';
    if (cache[key]) return cache[key];
    try {
      const src = s.textures.get(key).getSourceImage();
      const c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      c.getContext('2d').drawImage(src, 0, 0);
      return (cache[key] = c.toDataURL());
    } catch (e) { return ''; }
  }

  const SLOT_MAP = {
    weapon: 'weapon', armor: 'armor', helm: 'helmet', gloves: 'gloves',
    boots: 'shoes', amulet: 'necklace', ring: 'ring1', relic: 'ring2'
  };

  function rarityOf(star) {
    return star >= 60 ? 'legend' : star >= 30 ? 'epic' : star >= 10 ? 'rare' : '';
  }

  function mapItem(s, it) {
    if (!it) return null;
    return { icon: texUrl(s, iconKeyForItem(it)), plus: it.star || 0, rarity: rarityOf(it.star || 0) };
  }

  function skillRow(s, id, def) {
    return {
      id: id, name: def.name, lv: '', mp: def.mp || 0,
      info: 'ดาเมจ ' + def.dmg + ' • คูลดาวน์ ' + (def.cd / 1000).toFixed(1) + 'วิ',
      icon: texUrl(s, skillIconKey(def.type))
    };
  }

  PixelPanels.setData(() => {
    const s = scene();
    if (!s || !s.stats) {
      return { name: '-', level: 1, title: '', guild: '-', hp: [0, 0], mp: [0, 0],
               exp: 0, stats: {}, equipment: {}, skills: [], passives: [] };
    }
    const st = s.stats;
    const cls = s.currentClass ? s.currentClass() : 'sword';

    // โบนัสป้องกันจากอุปกรณ์
    let defSum = 0;
    const equipment = {};
    Object.keys(SLOT_MAP).forEach(k => {
      const it = s.equipment && s.equipment[SLOT_MAP[k]];
      equipment[k] = mapItem(s, it);
      if (it) defSum += (computeItemStats(it).def || 0);
    });

    // สกิลทั่วไป: โจมตีปกติ + สกิลที่ใส่ช่อง
    const skills = [];
    if (BASIC_ATTACKS[cls]) skills.push(skillRow(s, 'basic', BASIC_ATTACKS[cls]));
    (s.slots || []).forEach((sid, i) => {
      if (sid && SKILL_DEFS[sid]) skills.push(skillRow(s, String(i), SKILL_DEFS[sid]));
    });

    // สกิลพิเศษ: อัลติ (ต้องมีสกิลคลาสเดียวกัน 3 ช่อง)
    const special = [];
    if (s.ultiClass && ULTI_DEFS[s.ultiClass]) special.push(skillRow(s, 'ulti', ULTI_DEFS[s.ultiClass]));

    const expNeed = num(st.expNext, st.maxExp, st.next, st.expMax);
    return {
      name: st.name || s.playerName || 'Player',
      level: num(st.level, st.lv, s.level, 1),
      title: WEAPON_CLASS_LABEL[cls] || '',
      guild: '-',
      hp: [Math.floor(num(st.hp)), s.maxHp ? s.maxHp() : num(st.maxHp)],
      mp: [Math.floor(num(st.mp)), s.maxMp ? s.maxMp() : num(st.maxMp)],
      exp: expNeed ? +(num(st.exp) / expNeed * 100).toFixed(1) : 0,
      stats: { 'พลังโจมตี': num(s.atk), 'พลังป้องกัน': defSum },
      statPoints: 0,
      equipment: equipment,
      skills: skills,
      specialSkills: special,
      passives: []
    };
  });

  P.openStatusPanel = function () { PixelPanels.toggle('status'); };
  P.openSkillBook   = function () { PixelPanels.toggle('skills'); };

  // ปุ่ม "ใช้งาน"
  window.addEventListener('pp:useSkill', e => {
    const s = scene(); if (!s) return;
    const id = e.detail.id;
    if (id === 'basic') s.useBasicAttack();
    else if (id === 'ulti') s.useUlti();
    else s.useSkill(Number(id));
  });
})();
