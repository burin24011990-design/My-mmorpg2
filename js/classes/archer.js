// ===== อาชีพธนู (archer) — แก้ความสามารถสกิลของธนูที่ไฟล์นี้ =====

Classes.basic('archer', { name: 'โจมตี', dmg: 9, range: 360, cd: 650, type: 'proj', class: 'archer' });

Classes.skill('ar_shot', { name: 'ยิงธนู', class: 'archer', dmg: 11, range: 380, cd: 800, mp: 8, type: 'proj' }, { scale: { patk: 1 } });
Classes.skill('ar_rain', { name: 'ฝนลูกศร', class: 'archer', dmg: 10, range: 160, cd: 2600, mp: 16, type: 'aoe' }, { scale: { patk: 1 }, ground: { cast: 340 } });
Classes.skill('ar_pierce', { name: 'ธนูเจาะเกราะ', class: 'archer', dmg: 24, range: 420, cd: 3000, mp: 18, type: 'proj' }, { scale: { patk: 1 } });
Classes.skill('ar_multi', { name: 'ยิงกระจาย', class: 'archer', dmg: 13, range: 300, cd: 2200, mp: 14, type: 'proj' }, { scale: { patk: 1 } });

Classes.ulti('archer', { name: 'สายฝนมรณะ', dmg: 75, range: 200, cd: ULTI_CD, mp: 50, type: 'aoe' }, { scale: { patk: 1 }, ground: { cast: 380 } });
