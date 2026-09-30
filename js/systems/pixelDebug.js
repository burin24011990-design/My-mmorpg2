(function () {
  function dump() {
    const s = window.__mainScene;
    if (!s) return 'ยังไม่มี scene';
    const safe = (o) => {
      try {
        return JSON.stringify(o, (k, v) => {
          if (typeof v === 'function') return '[fn]';
          if (v && v.scene) return '[obj]';
          return v;
        }, 1);
      } catch (e) { return 'err ' + e.message; }
    };
    const keys = Object.keys(s).filter(k => /skill|cast|cool|slot/i.test(k));
    const protoKeys = Object.getOwnPropertyNames(Main.prototype).filter(k => /skill|cast/i.test(k));
    return [
      '== stats ==', safe(s.stats),
      '== equipment ==', safe(s.equipment),
      '== bag[0..1] ==', safe((s.bag || []).filter(Boolean).slice(0, 2)),
      '== keys (skill) ==', keys.join(', '),
      '== methods (skill) ==', protoKeys.join(', '),
      '== SKILLS ==', typeof SKILLS !== 'undefined' ? safe(SKILLS) : 'no SKILLS',
      '== ITEMS ==', typeof ITEMS !== 'undefined' ? safe(ITEMS).slice(0, 800) : 'no ITEMS'
    ].join('\n');
  }

  const b = document.createElement('button');
  b.textContent = '🐞';
  b.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:99998;width:44px;height:44px;font-size:20px';
  const box = document.createElement('pre');
  box.style.cssText = 'display:none;position:fixed;inset:10px;z-index:99999;background:#000c;color:#0f0;font:11px monospace;overflow:auto;padding:8px;white-space:pre-wrap';
  box.onclick = () => { box.style.display = 'none'; };
  b.onclick = () => { box.textContent = dump(); box.style.display = 'block'; };
  document.addEventListener('DOMContentLoaded', () => { document.body.append(b, box); });
})();
