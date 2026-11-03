// 배포용 dist/ 를 만들어요: 매장 목록을 HTML 글자로 넣고, 검색엔진용 파일(구조화 데이터·sitemap·robots)을 생성.
// 사용: SITE_URL=https://bokkeumneoguri.duckdns.org node build.mjs
import { readFile, writeFile, rm, mkdir, cp } from 'node:fs/promises';

const SITE_URL = (process.env.SITE_URL || 'https://bokkeumneoguri.duckdns.org').replace(/\/$/, '');
const GOOGLE = process.env.GOOGLE_VERIFY || '';
const NAVER = process.env.NAVER_VERIFY || '';

const STOCK = { '있음': '재고 있음', '조금': '조금 남음', '품절': '품절' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const raw = JSON.parse(await readFile('data/stores.json', 'utf8'));
const stores = raw.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && s.stock in STOCK);
const today = new Date().toISOString().slice(0, 10);
const lastmod = stores.map((s) => s.updated).filter(Boolean).sort().pop() || today;

const listHtml = stores.map((s, i) =>
  `<li data-i="${i}"><span class="name">${esc(s.name)}</span><span class="tag ${{ '있음': 'in', '조금': 'low', '품절': 'out' }[s.stock]}">${STOCK[s.stock]}</span></li>`,
).join('\n          ');

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: '볶음너구리 파는 곳',
      url: `${SITE_URL}/`,
      inLanguage: 'ko-KR',
      description: '볶음너구리 파는 편의점·마트와 재고를 지도로 한눈에 확인하세요.',
    },
    {
      '@type': 'ItemList',
      name: '볶음너구리 판매처',
      numberOfItems: stores.length,
      itemListElement: stores.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Store',
          name: s.name,
          geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng },
          description: `볶음너구리 ${STOCK[s.stock]}${s.updated ? ` (${s.updated} 기준)` : ''}`,
        },
      })),
    },
  ],
};

const verify = [
  GOOGLE && `<meta name="google-site-verification" content="${esc(GOOGLE)}">`,
  NAVER && `<meta name="naver-site-verification" content="${esc(NAVER)}">`,
].filter(Boolean).join('\n  ');

let html = await readFile('index.html', 'utf8');
html = html
  .replaceAll('%SITE_URL%', SITE_URL)
  .replace('<!--VERIFY-->', verify)
  .replace('<!--STORE_LIST-->', listHtml)
  .replace('<!--JSON_LD-->', `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`);

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const f of ['style.css', 'app.js', 'raccoon.svg', 'og.png', 'data', 'vendor']) {
  await cp(f, `dist/${f}`, { recursive: true });
}
await writeFile('dist/index.html', html);
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq></url>
</urlset>
`);

console.log(`dist/ 생성 완료 · 매장 ${stores.length}곳 · ${SITE_URL}`);
