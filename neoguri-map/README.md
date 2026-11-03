# 🦝 볶음너구리 파는 곳

볶음너구리 파는 매장과 재고만 지도에 보여 주는 정적 페이지예요.

## 매장·재고 고치기

`data/stores.json` 하나만 고치면 돼요.

```json
[
  { "name": "GS25 OO점", "lat": 37.5665, "lng": 126.9780, "stock": "있음", "updated": "2026-11-03" }
]
```

- `stock`: `"있음"`(초록) · `"조금"`(주황) · `"품절"`(회색)
- `updated`: 선택. 팝업에 "○○ 기준"으로 표시
- 좌표는 지도 앱에서 매장을 길게 눌러 복사하면 돼요.

## 서버에 올리기

SSH 키(`oracle-hermes`)가 있는 PC에서:

```bash
./neoguri-map/deploy.sh
```

→ `https://neoguri.168-107-20-114.sslip.io`

nginx 컨테이너(`neoguri-map`)를 Caddy와 같은 도커 네트워크에 띄우고, Caddyfile에 주소를 추가(백업·검증 후)한 뒤 Caddy를 리로드해요. 재고를 바꾼 뒤에도 같은 명령을 다시 실행하면 돼요.
