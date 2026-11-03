(() => {
  'use strict';

  // data/stores.json 의 stock 값 → 표시
  const STOCK = {
    '있음': { cls: 'in', label: '재고 있음' },
    '조금': { cls: 'low', label: '조금 남음' },
    '품절': { cls: 'out', label: '품절' },
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const map = L.map('map', { attributionControl: true }).setView([37.5665, 126.978], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);

  fetch('data/stores.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((list) => {
      const stores = (Array.isArray(list) ? list : [])
        .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && STOCK[s.stock]);

      if (!stores.length) {
        document.getElementById('empty').hidden = false;
        return;
      }

      const pts = [];
      for (const s of stores) {
        const st = STOCK[s.stock];
        L.marker([s.lat, s.lng], {
          icon: L.divIcon({ className: '', html: `<div class="pin ${st.cls}">${esc(s.stock)}</div>`, iconSize: null, popupAnchor: [0, -12] }),
          zIndexOffset: st.cls === 'out' ? 0 : 1000,
          title: s.name,
        }).bindPopup(`<div class="store">
            <b>${esc(s.name)}</b>
            <span class="stock ${st.cls}">${st.label}</span>
            ${s.updated ? `<small>${esc(s.updated)} 기준</small>` : ''}
          </div>`).addTo(map);
        pts.push([s.lat, s.lng]);
      }
      map.fitBounds(pts, { padding: [60, 60], maxZoom: 16 });
    });
})();
