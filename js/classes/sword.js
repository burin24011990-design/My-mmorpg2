// ===== อาชีพดาบ (sword) — แก้ความสามารถสกิลของดาบที่ไฟล์นี้ =====
// dmg = ค่าฐาน | range = ระยะ/รัศมี | cd = คูลดาวน์ (มิลลิวินาที) | mp = มานา
// scale = ตัวคูณสเตตัส: ดาเมจ = dmg x เลเวลสกิล + ตัวคูณ x สเตตัส (ชื่อสเตตัสดูที่ STAT_DEFS ใน stats.js เช่น patk, ap)

Classes.basic('sword', { name: 'โจมตี', dmg: 10, range: 60, cd: 650, type: 'melee', class: 'sword' });

Classes.skill('sw_slash', { name: 'ฟันตรง', class: 'sword', dmg: 12, range: 60, cd: 650, mp: 8, type: 'melee' }, { scale: { patk: 1 } });
Classes.skill('sw_spin', { name: 'ฟันหมุน', class: 'sword', dmg: 18, range: 100, cd: 2800, mp: 16, type: 'aoe' }, { scale: { patk: 1 } });
Classes.skill('sw_dash', { name: 'พุ่งทะยาน', class: 'sword', dmg: 16, range: 150, cd: 3600, mp: 14, type: 'dash' }, { scale: { patk: 1 } });
Classes.skill('sw_cross', { name: 'ฟันไขว้', class: 'sword', dmg: 22, range: 70, cd: 2400, mp: 12, type: 'melee' }, { scale: { patk: 1 } });

Classes.ulti('sword', { name: 'ดาบสังหาร', dmg: 70, range: 130, cd: ULTI_CD, mp: 50, type: 'aoe' }, { scale: { patk: 1 } });
Classes.testUnlock(['sw_slash', 'sw_spin', 'sw_dash', 'sw_cross']);
