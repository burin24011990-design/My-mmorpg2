// ===== อาชีพคทา (mage) — แก้ความสามารถสกิลของคทาที่ไฟล์นี้ =====
// ground = สกิลลากเล็ง: cast = ระยะร่ายสูงสุด (รัศมีวงใช้ค่า range ของสกิล)

Classes.basic('mage', { name: 'โจมตี', dmg: 8, range: 380, cd: 700, type: 'proj', class: 'mage' });

Classes.skill('mg_fire', { name: 'ลูกไฟ', class: 'mage', dmg: 14, range: 420, cd: 1400, mp: 10, type: 'proj' }, { scale: { ap: 1 } });
Classes.skill('mg_ice', { name: 'ธารน้ำแข็ง', class: 'mage', dmg: 12, range: 120, cd: 2400, mp: 16, type: 'aoe' }, { scale: { ap: 1 }, ground: { cast: 320 } });
Classes.skill('mg_bolt', { name: 'สายฟ้า', class: 'mage', dmg: 20, range: 350, cd: 2800, mp: 18, type: 'proj' }, { scale: { ap: 1 } });
Classes.skill('mg_nova', { name: 'คลื่นเวท', class: 'mage', dmg: 16, range: 140, cd: 3200, mp: 16, type: 'aoe' }, { scale: { ap: 1 }, ground: { cast: 300 } });

Classes.ulti('mage', { name: 'อุกกาบาต', dmg: 80, range: 170, cd: ULTI_CD, mp: 50, type: 'aoe' }, { scale: { ap: 1 }, ground: { cast: 360 } });
