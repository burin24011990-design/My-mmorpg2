(function () {
  'use strict';
  const P = Main.prototype;
  function install() {
    if (typeof P.recalcStats !== 'function' || P.recalcStats.__cardStats) return false;
    const base = P.recalcStats;
    const wrapped = function () {
      const out = base.apply(this, arguments);
      try {
        if (!out || typeof out !== 'object' || !window.CardSys) return out;
        const eq = this.equipment || {};
        const defs = window.STAT_DEFS || {};
        EQUIP_SLOT_KEYS.forEach(function (k) {
          const b = window.CardSys.cardBonusOf(eq[k]);
          Object.keys(b).forEach(function (s) { out[s] = (out[s] || 0) + b[s]; });
        });
        Object.keys(out).forEach(function (k) {
          const d = defs[k];
          if (d && d.cap != null && out[k] > d.cap) out[k] = d.cap;
        });
        const st = this.stats || {};
        if (typeof out.hp === 'number') this.equipHpBonus = out.hp - (st.maxHp || 0);
        if (typeof out.mp === 'number') this.equipMpBonus = out.mp - (st.maxMp || 0);
      } catch (e) { console.warn('cardStats', e); }
      return out;
    };
    wrapped.__cardStats = true;
    P.recalcStats = wrapped;
    return true;
  }
  install();
  let n = 0;
  const t = setInterval(function () { install(); if (++n > 20) clearInterval(t); }, 500);

  // ตรวจสถานะ แล้วแจ้งผลในกล่องแดง (ลบส่วนนี้ได้เมื่อใช้งานได้แล้ว)
  setTimeout(function () {
    if (!window.CardSys) throw new Error('DIAG: ไม่มี window.CardSys (cards.js ยังไม่โหลดสมบูรณ์)');
    if (!P.recalcStats.__cardStats) throw new Error('DIAG: ครอบ recalcStats ไม่สำเร็จ');
    throw new Error('DIAG: cardStats พร้อมทำงาน');
  }, 4000);

  // ตอนใส่/ถอดการ์ด ให้คำนวณสเตตัสใหม่ทันที
  setInterval(function () {
    const s = window.__mainScene;
    if (!s || !s.equipment || !window.CardSys) return;
    const sig = JSON.stringify(Object.keys(s.equipment).map(function (k) {
      const it = s.equipment[k]; return it ? [it.sockets, it.cplus] : null;
    }));
    if (sig !== window.__cardSig) { window.__cardSig = sig; s._statDirty = true; }
  }, 700);
})();
