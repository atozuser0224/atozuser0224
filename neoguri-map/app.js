(() => {
  'use strict';

  const LOCAL_KEY = 'neoguri-map:reports';
  const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
  const MIN_LOAD_ZOOM = 14;

  const $ = (id) => document.getElementById(id);
  const statusEl = $('status');
  const setStatus = (msg) => { statusEl.textContent = msg; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  // ---------- 저장소 ----------
  const loadLocal = () => {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; }
  };
  const saveLocal = (list) => {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch { /* 저장 불가 환경 */ }
  };

  const isValidReport = (r) => r && typeof r.storeId === 'string'
    && (r.status === 'yes' || r.status === 'no')
    && Number.isFinite(r.lat) && Number.isFinite(r.lng) && typeof r.at === 'string';

  let sharedReports = [];
  let localReports = loadLocal().filter(isValidReport);
  const allReports = () => sharedReports.concat(localReports);

  // ---------- 매장 ----------
  /** id -> {id, name, brand, lat, lng} */
  const stores = new Map();
  const markers = new Map();

  const reportsFor = (id) => allReports()
    .filter((r) => r.storeId === id)
    .sort((a, b) => b.at.localeCompare(a.at));

  // 가장 최근 제보가 현재 상태
  const statusOf = (id) => reportsFor(id)[0]?.status || 'unknown';

  const upsertStore = (s) => {
    const prev = stores.get(s.id);
    stores.set(s.id, { ...prev, ...s, name: s.name || prev?.name || '이름 없는 매장' });
  };

  const storesFromReports = () => {
    for (const r of allReports()) {
      if (!stores.has(r.storeId)) {
        upsertStore({ id: r.storeId, name: r.name, brand: r.brand, lat: r.lat, lng: r.lng });
      }
    }
  };

  // ---------- 지도 ----------
  const map = L.map('map', { zoomControl: true }).setView([37.5665, 126.978], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  const layer = L.layerGroup().addTo(map);

  const icon = (status) => L.divIcon({
    className: '',
    html: `<div class="pin ${status}"></div>`,
    iconSize: status === 'yes' ? [22, 22] : [18, 18],
  });

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const popupHtml = (s) => {
    const reps = reportsFor(s.id);
    const st = reps[0]?.status;
    const verdict = !st ? '아직 제보가 없어요. 직접 보셨다면 알려 주세요!'
      : st === 'yes' ? `✅ 있어요 (${fmtDate(reps[0].at)} 제보)`
      : `❌ 없어요/품절 (${fmtDate(reps[0].at)} 제보)`;
    const hist = reps.slice(0, 5).map((r) =>
      `<li>${r.status === 'yes' ? '있음' : '없음'} · ${esc(fmtDate(r.at))}</li>`).join('');
    return `<div class="popup">
      <h3>${esc(s.name)}</h3>
      <p class="meta">${esc(s.brand || '')}</p>
      <p class="verdict">${verdict}</p>
      <div class="vote">
        <button class="yes" data-vote="yes" data-id="${esc(s.id)}">있어요</button>
        <button class="no" data-vote="no" data-id="${esc(s.id)}">없어요</button>
      </div>
      ${hist ? `<ul class="hist">${hist}</ul>` : ''}
    </div>`;
  };

  const render = () => {
    const onlyYes = $('only-yes').checked;
    layer.clearLayers();
    markers.clear();
    for (const s of stores.values()) {
      const st = statusOf(s.id);
      if (onlyYes && st !== 'yes') continue;
      const m = L.marker([s.lat, s.lng], { icon: icon(st), zIndexOffset: st === 'yes' ? 1000 : 0, title: s.name })
        .bindPopup(() => popupHtml(s))
        .addTo(layer);
      markers.set(s.id, m);
    }
    renderList();
  };

  const renderList = () => {
    const center = map.getCenter();
    const yes = [...stores.values()]
      .filter((s) => statusOf(s.id) === 'yes')
      .map((s) => ({ s, d: center.distanceTo([s.lat, s.lng]) }))
      .sort((a, b) => a.d - b.d);
    $('yes-count').textContent = yes.length ? `${yes.length}곳` : '';
    const list = $('list');
    list.innerHTML = '';
    if (!yes.length) {
      list.innerHTML = '<li class="empty">아직 없어요. 매장을 눌러 첫 제보를 남겨 주세요.</li>';
      return;
    }
    for (const { s, d } of yes.slice(0, 50)) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      const dist = d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
      b.innerHTML = `${esc(s.name)}<span>지도 중심에서 ${dist} · ${esc(fmtDate(reportsFor(s.id)[0].at))} 확인</span>`;
      b.addEventListener('click', () => {
        map.setView([s.lat, s.lng], Math.max(map.getZoom(), 16));
        markers.get(s.id)?.openPopup();
      });
      li.appendChild(b);
      list.appendChild(li);
    }
  };

  // ---------- 제보 ----------
  const addReport = (id, status) => {
    const s = stores.get(id);
    if (!s) return;
    localReports.push({
      storeId: s.id, name: s.name, brand: s.brand || '', lat: s.lat, lng: s.lng,
      status, at: new Date().toISOString(),
    });
    saveLocal(localReports);
    render();
    markers.get(id)?.openPopup();
    setStatus(`"${s.name}"에 ${status === 'yes' ? '있어요' : '없어요'} 제보를 남겼어요. 고마워요!`);
  };

  map.on('popupopen', (e) => {
    e.popup.getElement().querySelectorAll('button[data-vote]').forEach((btn) => {
      btn.addEventListener('click', () => addReport(btn.dataset.id, btn.dataset.vote));
    });
  });

  // ---------- 주변 매장 불러오기 (OpenStreetMap) ----------
  const brandOf = (tags) => tags.brand || tags['brand:ko']
    || (tags.shop === 'supermarket' ? '마트' : '편의점');

  const loadNearby = async () => {
    if (map.getZoom() < MIN_LOAD_ZOOM) {
      setStatus('범위가 너무 넓어요. 지도를 조금 더 확대한 뒤 다시 눌러 주세요.');
      return;
    }
    const b = map.getBounds();
    const bbox = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map((n) => n.toFixed(5)).join(',');
    const q = `[out:json][timeout:25];(
      node["shop"~"^(convenience|supermarket)$"](${bbox});
      way["shop"~"^(convenience|supermarket)$"](${bbox});
    );out center 400;`;
    const btn = $('btn-load');
    btn.disabled = true;
    setStatus('주변 편의점·마트를 찾는 중…');
    try {
      const res = await fetch(OVERPASS_URL, { method: 'POST', body: new URLSearchParams({ data: q }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      let n = 0;
      for (const el of json.elements || []) {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const tags = el.tags || {};
        upsertStore({
          id: `osm:${el.type}/${el.id}`,
          name: tags['name:ko'] || tags.name || brandOf(tags),
          brand: brandOf(tags), lat, lng,
        });
        n += 1;
      }
      render();
      setStatus(n ? `매장 ${n}곳을 불러왔어요. 매장을 눌러 재고를 제보해 주세요.`
        : '이 지역에서는 등록된 매장을 찾지 못했어요. "지도에 직접 추가"로 넣어 주세요.');
    } catch (err) {
      setStatus(`매장 정보를 불러오지 못했어요 (${err.message}). 잠시 뒤 다시 시도해 주세요.`);
    } finally {
      btn.disabled = false;
    }
  };

  // ---------- 직접 추가 ----------
  let adding = false;
  const setAdding = (on) => {
    adding = on;
    $('btn-add').classList.toggle('active', on);
    $('btn-add').textContent = on ? '✖ 추가 취소' : '➕ 지도에 직접 추가';
    map.getContainer().classList.toggle('adding', on);
    if (on) setStatus('지도에서 매장 위치를 눌러 주세요.');
  };
  map.on('click', (e) => {
    if (!adding) return;
    setAdding(false);
    const name = (window.prompt('매장 이름을 알려 주세요 (예: GS25 역삼점)') || '').trim();
    if (!name) { setStatus('추가를 취소했어요.'); return; }
    const id = `user:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    upsertStore({ id, name: name.slice(0, 60), brand: '직접 추가', lat: e.latlng.lat, lng: e.latlng.lng });
    addReport(id, 'yes');
  });

  // ---------- 버튼 ----------
  $('btn-locate').addEventListener('click', () => {
    if (!navigator.geolocation) { setStatus('이 브라우저는 위치 기능을 지원하지 않아요.'); return; }
    setStatus('위치를 확인하는 중…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        map.setView([p.coords.latitude, p.coords.longitude], 16);
        setStatus('내 위치로 이동했어요. "이 지역 매장 불러오기"를 눌러 보세요.');
      },
      () => setStatus('위치를 가져오지 못했어요. 지도를 직접 움직여 주세요.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
  $('btn-load').addEventListener('click', loadNearby);
  $('btn-add').addEventListener('click', () => setAdding(!adding));
  $('only-yes').addEventListener('change', render);
  map.on('moveend', renderList);

  $('toggle-panel').addEventListener('click', () => {
    const hidden = $('panel').classList.toggle('hidden');
    $('toggle-panel').setAttribute('aria-expanded', String(!hidden));
    setTimeout(() => map.invalidateSize(), 0);
  });

  $('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(localReports, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'neoguri-reports.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const incoming = JSON.parse(await file.text());
      if (!Array.isArray(incoming)) throw new Error('배열이 아님');
      const seen = new Set(localReports.map((r) => `${r.storeId}|${r.at}`));
      const fresh = incoming.filter(isValidReport).filter((r) => !seen.has(`${r.storeId}|${r.at}`));
      localReports = localReports.concat(fresh);
      saveLocal(localReports);
      storesFromReports();
      render();
      setStatus(`제보 ${fresh.length}건을 가져왔어요.`);
    } catch {
      setStatus('파일을 읽지 못했어요. 내보내기로 만든 JSON 파일인지 확인해 주세요.');
    }
    e.target.value = '';
  });
  $('btn-clear').addEventListener('click', () => {
    if (!window.confirm('이 브라우저에 저장된 내 제보를 모두 지울까요?')) return;
    localReports = [];
    saveLocal(localReports);
    for (const id of [...stores.keys()]) {
      if (id.startsWith('user:') && !reportsFor(id).length) stores.delete(id);
    }
    render();
    setStatus('내 제보를 지웠어요.');
  });

  // ---------- 시작 ----------
  const init = async () => {
    try {
      const res = await fetch('data/reports.json', { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) sharedReports = data.filter(isValidReport);
      }
    } catch { /* 공유 데이터 없이도 동작 */ }
    storesFromReports();
    render();
  };
  init();
})();
