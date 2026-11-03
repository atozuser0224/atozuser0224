#!/usr/bin/env bash
# 볶음너구리 지도를 람다 서버(Oracle, 168.107.20.114)에 올려요.
# SSH 키가 있는 PC에서 실행: ./deploy.sh
#
# 하는 일
#   1. 사이트 파일을 서버 ~/neoguri-map/site 로 복사
#   2. nginx 컨테이너(neoguri-map)를 Caddy와 같은 네트워크에 띄움
#   3. Caddyfile에 neoguri 주소가 없으면 추가하고(백업 후) 검증 → 리로드
#
# 다시 실행해도 안전해요. 재고만 바꿀 때도 data/stores.json 고치고 이 스크립트를 다시 돌리면 돼요.
set -euo pipefail

HOST="${HOST:-oracle-hermes}"
CADDY="${CADDY:-deploy-caddy-1}"
DOMAIN="${DOMAIN:-neoguri.168-107-20-114.sslip.io}"
REMOTE_DIR="neoguri-map/site"

cd "$(dirname "$0")"

echo "▶ 파일 복사 → $HOST:~/$REMOTE_DIR"
ssh "$HOST" "mkdir -p ~/$REMOTE_DIR"
tar czf - index.html style.css app.js raccoon.svg data vendor | ssh "$HOST" "rm -rf ~/$REMOTE_DIR/* && tar xzf - -C ~/$REMOTE_DIR"

echo "▶ 서버 설정"
ssh "$HOST" CADDY="$CADDY" DOMAIN="$DOMAIN" REMOTE_DIR="$REMOTE_DIR" 'bash -s' <<'REMOTE'
set -euo pipefail
SITE="$HOME/$REMOTE_DIR"
chmod -R a+rX "$SITE"

NET=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$CADDY" | awk '{print $1}')
[ -n "$NET" ] || { echo "✖ $CADDY 컨테이너의 네트워크를 찾지 못했어요"; exit 1; }

if ! docker ps -a --format '{{.Names}}' | grep -qx neoguri-map; then
  docker run -d --name neoguri-map --restart unless-stopped --network "$NET" \
    -v "$SITE":/usr/share/nginx/html:ro nginx:alpine >/dev/null
  echo "  nginx 컨테이너 생성 (네트워크: $NET)"
else
  docker start neoguri-map >/dev/null
  echo "  nginx 컨테이너 이미 있음 — 파일만 교체됨"
fi

# Caddyfile 위치 찾기 (파일 마운트 또는 /etc/caddy 폴더 마운트)
SRC=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}' "$CADDY")
if [ -z "$SRC" ]; then
  DIR=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/caddy"}}{{.Source}}{{end}}{{end}}' "$CADDY")
  [ -n "$DIR" ] && SRC="$DIR/Caddyfile"
fi

BLOCK="$DOMAIN {
	encode gzip
	reverse_proxy neoguri-map:80
}"

if [ -z "$SRC" ] || ! sudo test -f "$SRC"; then
  echo "⚠ Caddyfile을 찾지 못했어요. 아래 내용을 Caddyfile에 직접 넣고 Caddy를 리로드해 주세요:"
  echo "$BLOCK"
  exit 0
fi

if sudo grep -q "^$DOMAIN" "$SRC"; then
  echo "  Caddyfile에 이미 $DOMAIN 있음"
else
  BAK="$SRC.bak.$(date +%Y%m%d%H%M%S)"
  sudo cp "$SRC" "$BAK"
  printf '\n%s\n' "$BLOCK" | sudo tee -a "$SRC" >/dev/null
  if ! docker exec "$CADDY" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
    sudo cp "$BAK" "$SRC"
    echo "✖ 설정 검증 실패 — Caddyfile을 원래대로 되돌렸어요 ($BAK)"; exit 1
  fi
  echo "  Caddyfile에 $DOMAIN 추가 (백업: $BAK)"
fi
docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
REMOTE

echo "✔ 완료: https://$DOMAIN"
