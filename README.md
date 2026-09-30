# My MMORPG

เกม 2D MMORPG บนเว็บ (Phaser 3) — ตัวละคร 3 อาชีพ, สกิล, อัลติ, มอนสเตอร์ 9 ด่าน, กระเป๋า/อุปกรณ์ 8 ช่อง, ระบบรวมดาว, บอทออโต้, ออนไลน์ผ่าน Socket.IO

## ควบคุม
- คอม: WASD/ลูกศร = เดิน, Space = โจมตี, 1-4 = สกิล, U = อัลติ, B = บอทออโต้
- มือถือ: แตะลากครึ่งจอซ้าย = เดิน, ปุ่มขวาล่าง = โจมตี/สกิล

## โครงสร้างไฟล์
```
index.html
js/
  config.js            ค่าคงที่ทั้งหมด (ขนาดจอ, เซิร์ฟเวอร์, CLASSES)
  main.js              จุดเริ่มเกม
  data/
    zones.js           ข้อมูลด่าน
    skills.js          สกิล / โจมตีปกติ / อัลติ
    items.js           ฟังก์ชันและค่าของไอเทม/อุปกรณ์
    textures.js        รูปพื้นฐานที่สร้างด้วยโค้ด (เปลี่ยนเป็นสไปรต์จริงที่นี่)
  scenes/
    Main.js            ฉากหลัก create() / update()
  systems/
    player.js          สเตตัส, เลเวล, EXP
    monsters.js        มอนสเตอร์, AI, ดรอป, เป้าหมาย
    inventory.js       กระเป๋า, เก็บของ, รวมดาว
    equipment.js       สวมใส่/ถอดอุปกรณ์
    skills.js          สกิล, โจมตี, อัลติ
    input.js           คีย์บอร์ด, จอยสติ๊ก, บอทออโต้
    ui.js              ปุ่ม, HUD, มินิแมป
    panels.js          สเตตัส, เลือกด่าน, สมุดสกิล
    inventoryPanel.js  หน้าจอกระเป๋า/อุปกรณ์/รายละเอียดไอเทม
    network.js         ออนไลน์
```

## เพิ่มของใหม่ทำที่ไหน
- มอนสเตอร์ใหม่/ปรับ AI → `systems/monsters.js`
- ไอเทม/ค่าพลังอุปกรณ์ → `data/items.js`
- สกิลใหม่ → `data/skills.js`
- ด่านใหม่ → `data/zones.js`

## รันในเครื่อง
`npx serve` แล้วเปิด http://localhost:3000

## GitHub Pages
Settings > Pages > Deploy from a branch > main / (root) > Save
