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

  // แปลงเท็กซ์เจอร์ Phaser -> data URL (ย้อมสีได้, เก็บแคช)
  const cache = {};
  function texUrl(s, key, tint) {
    if (!key) return '';
    const ck = key + '|' + (tint || '');
    if (cache[ck]) return cache[ck];
    try {
      const src = s.textures.get(key).getSourceImage();
      const c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      const g = c.getContext('2d');
      g.drawImage(src, 0, 0);
      if (tint) {
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = tint;
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(src, 0, 0);
      }
      return (cache[ck] = c.toDataURL());
    } catch (e) { return ''; }
  }

  function classTint(cls) {
    try {
      const col = CLASSES[cls] && CLASSES[cls].color;
      return col != null ? '#' + ('000000' + col.toString(16)).slice(-6) : '';
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

  // id = ค่าที่ส่งไปกับปุ่ม (เลขสลอต / 'off_<sid>' / 'basic' / 'ulti')
  // sid = id สกิลจริงใน SKILL_DEFS (ใช้ในแพตช์เลเวลสกิล)
  function skillRow(s, id, def, sid) {
    return {
      id: id, sid: sid, name: def.name, lv: '', mp: def.mp || 0,
      info: 'ดาเมจ ' + def.dmg + ' • คูลดาวน์ ' + (def.cd / 1000).toFixed(1) + 'วิ',
      icon: texUrl(s, skillIconKey(def.type), classTint(def.class))
    };
  }

  PixelPanels.setData(() => {
    const s = scene();
    if (!s || !s.stats) {
      return { name: '-', level: 1, title: '', guild: '-', hp: [0, 0], mp: [0, 0],
               exp: 0, stats: {}, equipment: {}, skills: [], passives: [] };
    }
    const st = s.stats;
    const cls = s.currentClass();

    // อุปกรณ์
    const equipment = {};
    Object.keys(SLOT_MAP).forEach(k => {
      equipment[k] = mapItem(s, s.equipment && s.equipment[SLOT_MAP[k]]);
    });

    // สกิลทั่วไป: โจมตีปกติ + สกิลที่เรียนแล้วทั้งหมด (ที่ใส่อยู่ขึ้นก่อน)
    const skills = [];
    if (BASIC_ATTACKS[cls]) skills.push(skillRow(s, 'basic', BASIC_ATTACKS[cls]));
    const equipped = s.slots || [];
    const learned = Array.from(s.learnedSkills || []);
    equipped.forEach(id => { if (id && learned.indexOf(id) < 0) learned.push(id); });
    const ids = learned.filter(id => SKILL_DEFS[id]);
    ids.sort((a, b) => (equipped.indexOf(b) >= 0) - (equipped.indexOf(a) >= 0));
    ids.forEach(id => {
      const idx = equipped.indexOf(id);
      const row = skillRow(s, idx >= 0 ? String(idx) : 'off_' + id, SKILL_DEFS[id], id);
      if (idx < 0) row.off = true;
      skills.push(row);
    });

    // สกิลพิเศษ: อัลติ (ต้องใส่สกิลคลาสเดียวกัน 3 ช่อง)
    const special = [];
    if (s.ultiClass && ULTI_DEFS[s.ultiClass]) {
      special.push(skillRow(s, 'ulti', ULTI_DEFS[s.ultiClass]));
    }

    return {
      name: 'Player',
      level: num(st.level, 1),
      title: WEAPON_CLASS_LABEL[cls] || '',
      guild: '-',
      hp: [Math.floor(num(st.hp)), s.maxHp()],
      mp: [Math.floor(num(st.mp)), s.maxMp()],
      exp: st.expNext ? +(num(st.exp) / st.expNext * 100).toFixed(1) : 0,
      stats: {
        'พลังโจมตี': num(s.atk),
        'พลังป้องกัน': num(s.equipDefBonus),
        'ทอง': num(st.gold),
        'ฆ่าแล้ว': num(s.kills)
      },
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
    else if (String(id).indexOf('off_') === 0) return;
    else s.useSkill(Number(id));
  });
})();
