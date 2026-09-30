// Service worker แบบเบาที่สุด: ไม่แคชไฟล์เกม (โหลดใหม่จากเน็ตเสมอ) มีไว้ให้ติดตั้งลงหน้าจอโฮมได้
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () { /* ปล่อยให้เบราว์เซอร์ดึงจากเน็ตตามปกติ */ });
