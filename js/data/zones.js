// ===== ข้อมูลด่าน (แต่ละด่านเป็นแผนที่แยกกัน) =====
// x,y = จุดเกิดของผู้เล่น (กลางแผนที่) / count = มอนธรรมดา / rangedCount = มอนยิงไกล (สุ่มกระจายทั่วแผนที่)
// มินิบอสตั้งค่าที่ config.js (BOSS_COUNT, BOSS_MULT, BOSS_RESPAWN_*)
// bg,line = สีพื้นและสีเส้นตารางของด่านนั้น
const ZONES = [
  { id: 1, name: 'ด่าน 1', x: 1800, y: 1125, count: 45, rangedCount: 15, reqLv: 1, minLv: 1, maxLv: 10, boxLevel: 1, bg: 0x2b3a2b, line: 0x1f2b1f },
  { id: 2, name: 'ด่าน 2', x: 1800, y: 1125, count: 45, rangedCount: 15, reqLv: 11, minLv: 11, maxLv: 20, boxLevel: 10, bg: 0x2b3a3a, line: 0x1f2b2b },
  { id: 3, name: 'ด่าน 3', x: 1800, y: 1125, count: 45, rangedCount: 15, reqLv: 21, minLv: 21, maxLv: 30, boxLevel: 20, bg: 0x3a3a2b, line: 0x2b2b1f },
  { id: 4, name: 'ด่าน 4', x: 1800, y: 1125, count: 45, rangedCount: 15, reqLv: 31, minLv: 31, maxLv: 40, boxLevel: 30, bg: 0x3a2f2b, line: 0x2b211f },
  { id: 5, name: 'ด่าน 5', x: 1800, y: 1125, count: 60, rangedCount: 20, reqLv: 41, minLv: 41, maxLv: 50, boxLevel: 40, bg: 0x2b2b3a, line: 0x1f1f2b },
  { id: 6, name: 'ด่าน 6', x: 1800, y: 1125, count: 45, rangedCount: 15, reqLv: 51, minLv: 51, maxLv: 60, boxLevel: 50, bg: 0x3a2b3a, line: 0x2b1f2b },
  { id: 7, name: 'ด่าน 7', x: 1800, y: 1125, count: 45, rangedCount: 15, reqLv: 61, minLv: 61, maxLv: 70, boxLevel: 60, bg: 0x3a2b2b, line: 0x2b1f1f },
  { id: 8, name: 'ด่าน 8', x: 1800, y: 1125, count: 45, rangedCount: 15, reqLv: 71, minLv: 71, maxLv: 80, boxLevel: 70, bg: 0x33363b, line: 0x24272b },
  { id: 9, name: 'ด่าน 9', x: 1800, y: 1125, count: 60, rangedCount: 20, reqLv: 81, minLv: 81, maxLv: 90, boxLevel: 80, bg: 0x2b2b2b, line: 0x1a1a1a },
];
