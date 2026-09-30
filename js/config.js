// ===== ค่าคงที่และการตั้งค่าทั้งหมดของเกม =====
const W = 1280, H = 600;
const WORLD_W = 2400, WORLD_H = 1800;
const SERVER_URL = 'https://my-mmorpg2-1.onrender.com';
const BAG_SIZE = 500, PAGE_SIZE = 50, PAGES = BAG_SIZE / PAGE_SIZE;
const ULTI_CD = 40000;
const RESPAWN_DELAY = 7000;
const CAST_DELAY = { melee: 150, aoe: 250, proj: 200, dash: 90, ulti: 400 };
const BASIC_DELAY = 130;
const MAX_STAR = 99;
const MAX_BOX_STACK = 999;
const LEVEL_CAP = 90;

const CLASSES = {
  sword: { label: 'นักดาบ', color: 0xe05a5a },
  mage: { label: 'นักเวท', color: 0x5a9cf0 },
  archer: { label: 'นักธนู', color: 0x6bd66b },
};

function levelExpNeeded(level) { return Math.floor(25 * Math.pow(level, 1.8)); }
