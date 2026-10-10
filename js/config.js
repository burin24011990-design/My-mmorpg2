// ===== ค่าคงที่และการตั้งค่าทั้งหมดของเกม =====
// แนวจอ: แนวตั้ง = 540x(900-1200) | แนวนอน = 1280x600 (หมุนจอข้ามแนวแล้วเกมจะเซฟและโหลดใหม่ ดูท้ายไฟล์ main.js)
const PORTRAIT = window.innerHeight > window.innerWidth;
// แนวตั้ง: ความสูงปรับตามสัดส่วนจอจริง (ต่ำสุด 900 สูงสุด 1200) เพื่อไม่ให้เหลือแถบดำบน/ล่าง
const W = PORTRAIT ? 540 : 1280;
const H = PORTRAIT ? Math.max(900, Math.min(1200, Math.round(540 * window.innerHeight / window.innerWidth))) : 600;
// ขนาดแผนที่ของแต่ละด่าน: สัดส่วน 2800:2560 ให้ตรงกับรูปแผนที่ (assets/maps/*.webp) | เมืองอยู่กลางโลกนี้
// ถ้าแก้ตัวเลขนี้ ต้องสร้างรูป/พื้นที่เดินได้ (mapMasks.js) ใหม่ให้สัดส่วนเดียวกัน
const WORLD_W = 2800, WORLD_H = 2560;
const TARGET_RANGE = 600;           // ระยะที่ล็อกเป้ามอนอัตโนมัติ
const BOSS_COUNT = 1;               // จำนวนมินิบอสต่อด่าน
const BOSS_MULT = 20;               // มินิบอสแรงกว่ามอนธรรมดา (HP / ดาเมจ / EXP / ทอง)
const BOSS_RESPAWN_MIN_MINUTES = 10; // มินิบอสเกิดใหม่หลังตาย สุ่ม 10-20 นาที
const BOSS_RESPAWN_MAX_MINUTES = 20;
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
