# 🦝 볶음너구리 어디 팔아?

볶음너구리를 파는 편의점·마트를 지도에서 찾고, 직접 본 재고를 제보하는 정적 웹사이트입니다.

## 쓰는 법

1. **내 위치**를 누르거나 지도를 움직여 동네를 찾습니다.
2. **이 지역 매장 불러오기**를 누르면 OpenStreetMap에 등록된 편의점·마트가 회색 핀으로 표시됩니다 (확대 레벨 14 이상).
3. 매장 핀을 눌러 **있어요 / 없어요**를 제보합니다. 가장 최근 제보가 핀 색이 됩니다 (초록 = 있음, 빨강 = 없음).
4. 지도에 없는 매장은 **지도에 직접 추가**로 넣을 수 있습니다.

## 데이터

- 내 제보는 브라우저 `localStorage`에 저장됩니다.
- 모두에게 공유할 제보는 `data/reports.json`에 들어갑니다. 사이트의 **내 제보 데이터 → 내보내기**로 받은 파일 내용을 이 파일에 합쳐 PR을 올려 주세요.
- 형식: `{ storeId, name, brand, lat, lng, status: "yes" | "no", at: ISO 날짜 }`

## 로컬 실행

빌드 과정이 없는 순수 HTML/JS입니다.

```bash
cd neoguri-map
python3 -m http.server 8000
# http://localhost:8000
```

GitHub Pages로 배포하면 `https://<사용자>.github.io/<저장소>/neoguri-map/`에서 열립니다.

지도: [Leaflet](https://leafletjs.com) · 매장 위치: © OpenStreetMap 기여자 (Overpass API)
