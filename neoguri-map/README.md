# 🦝 볶음너구리 파는 곳

볶음너구리 파는 매장과 재고만 지도에 보여 주는 페이지예요.

## 매장·재고 고치기

`data/stores.json` 하나만 고치면 돼요.

```json
[
  { "name": "GS25 OO점", "lat": 37.5665, "lng": 126.9780, "stock": "있음", "updated": "2026-11-03" }
]
```

- `stock`: `"있음"` · `"조금"` · `"품절"`
- `updated`: 선택. 팝업에 "○○ 기준"으로 표시되고 sitemap 갱신일로도 쓰여요.

## 1. 무료 주소 만들기 (DuckDNS, 처음 한 번)

1. https://www.duckdns.org 에 구글/깃허브 계정으로 로그인
2. sub domain에 `bokkeumneoguri` 입력 → **add domain**
   (이미 누가 쓰고 있으면 다른 이름으로 만들고, 아래 `DOMAIN=`에 그 주소를 넣어요)
3. current ip를 `168.107.20.114`로 바꾸고 **update ip**

서버 IP가 고정이라 갱신 스크립트는 필요 없어요.

## 2. 서버에 올리기

SSH 키(`oracle-hermes`)가 있는 PC에서 (Node.js 18 이상 필요):

```bash
./neoguri-map/deploy.sh
# 다른 주소를 만들었다면
DOMAIN=내이름.duckdns.org ./neoguri-map/deploy.sh
```

빌드(`build.mjs`)가 `dist/`를 만들고 서버에 올린 뒤 Caddy에 주소를 연결해요. HTTPS 인증서는 Caddy가 자동으로 받아요.
재고를 바꾼 뒤에도 같은 명령을 다시 실행하면 돼요.

## 3. 검색에 뜨게 하기

빌드할 때 자동으로 들어가는 것:
- 제목·설명·canonical·공유 미리보기(og.png)
- 매장 목록을 HTML 글자로 (자바스크립트 없이도 검색엔진이 읽음)
- 구조화 데이터(schema.org WebSite + 매장 ItemList)
- `robots.txt`, `sitemap.xml`

직접 해야 하는 것 (각 5분):

1. **네이버 서치어드바이저** — https://searchadvisor.naver.com → 사이트 등록 → `https://bokkeumneoguri.duckdns.org`
   → 소유확인에서 **HTML 태그** 선택 → `content="…"` 값 복사
2. **구글 서치 콘솔** — https://search.google.com/search-console → **URL 접두어**로 등록
   → 소유권 확인에서 **HTML 태그** 선택 → `content="…"` 값 복사
3. 복사한 값을 넣고 다시 배포:
   ```bash
   NAVER_VERIFY=네이버값 GOOGLE_VERIFY=구글값 ./neoguri-map/deploy.sh
   ```
4. 두 사이트에서 **소유확인** 누르고, **사이트맵 제출**에 `sitemap.xml` 입력

한국 검색은 네이버 비중이 커서 1번이 특히 중요해요. 노출까지는 보통 며칠~몇 주 걸려요.
