'use strict';

const STOCK = {
  '있음': { cls: 'in', label: '재고 있음' },
  '조금': { cls: 'low', label: '조금 남음' },
  '품절': { cls: 'out', label: '품절' },
};

const SEOUL = [37.5665, 126.978];
const DARK = window.matchMedia('(prefers-color-scheme: dark)').matches;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function createMap() {
  const map = L.map('map', { zoomControl: false }).setView(SEOUL, 12);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/${DARK ? 'dark_all' : 'voyager'}/{z}/{x}/{y}{r}.png`, {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
  return map;
}

async function loadStores() {
  try {
    const res = await fetch('data/stores.json', { cache: 'no-cache' });
    const list = res.ok ? await res.json() : [];
    return Array.isArray(list)
      ? list.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && s.stock in STOCK)
      : [];
  } catch {
    return [];
  }
}

function addStore(map, store) {
  const { cls, label } = STOCK[store.stock];

  const icon = L.divIcon({
    className: '',
    html: `<div class="pin ${cls}"><img src="raccoon.svg" alt="">${escapeHtml(store.stock)}</div>`,
    iconSize: [0, 0],
    popupAnchor: [0, -46],
  });

  const popup = `
    <div class="store ${cls}">
      <h2>${escapeHtml(store.name)}</h2>
      <span class="badge">${label}</span>
      ${store.updated ? `<time>${escapeHtml(store.updated)} 기준</time>` : ''}
    </div>`;

  return L.marker([store.lat, store.lng], {
    icon,
    title: store.name,
    zIndexOffset: cls === 'out' ? 0 : 1000,
  }).bindPopup(popup).addTo(map);
}

function renderList(map, stores, markers) {
  const details = document.getElementById('stores');
  const list = document.getElementById('list');
  if (!stores.length) {
    details.hidden = true;
    return;
  }
  list.innerHTML = stores.map((s) => {
    const { cls, label } = STOCK[s.stock];
    return `<li tabindex="0"><span class="name">${escapeHtml(s.name)}</span><span class="tag ${cls}">${label}</span></li>`;
  }).join('');
  [...list.children].forEach((li, i) => {
    const go = () => {
      map.flyTo(markers[i].getLatLng(), Math.max(map.getZoom(), 16), { duration: 0.6 });
      map.once('moveend', () => markers[i].openPopup());
      if (window.innerWidth < 600) details.open = false;
    };
    li.addEventListener('click', go);
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}

function renderSummary(stores) {
  const summary = document.getElementById('summary');
  if (!stores.length) {
    summary.innerHTML = '<li class="out">준비 중</li>';
    document.getElementById('empty').hidden = false;
    return;
  }
  summary.innerHTML = Object.entries(STOCK)
    .map(([key, { cls }]) => [key, cls, stores.filter((s) => s.stock === key).length])
    .filter(([, , n]) => n > 0)
    .map(([key, cls, n]) => `<li class="${cls}">${key} <b>${n}</b></li>`)
    .join('');
}

(async () => {
  const map = createMap();
  const stores = await loadStores();

  const markers = stores.map((store) => addStore(map, store));
  renderSummary(stores);
  renderList(map, stores, markers);

  if (stores.length) {
    map.fitBounds(stores.map((s) => [s.lat, s.lng]), { padding: [90, 90], maxZoom: 16 });
  }
})();
