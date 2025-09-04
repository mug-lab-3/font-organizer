// ===== 設定（リリースごとに CACHE_VERSION を上げるだけ！）=====
const CACHE_VERSION  = 'v1.0.15';                // ← 例: v1.0.1 に上げる
const PRECACHE_NAME  = `precache-${CACHE_VERSION}`;
const BASE_PATH = new URL('./', self.location).pathname.replace(/\/$/, '');
const PRECACHE_URLS  = [
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.webmanifest`,
  `${BASE_PATH}/assets/favicon_32.png`,
  `${BASE_PATH}/assets/favicon_64.png`,
  `${BASE_PATH}/assets/favicon_128.png`,
  `${BASE_PATH}/assets/favicon_192.png`,
  `${BASE_PATH}/assets/favicon_256.png`,
  `${BASE_PATH}/assets/favicon_512.png`
];
// ===============================================================

// install: pre-cache assets and activate new worker immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME)
      .then(c => c.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// activate: 古いプレキャッシュは全削除（無限増殖を防止）
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(n => n.startsWith('precache-') && n !== PRECACHE_NAME)
        .map(n => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

// fetch:
// - HTML(navigate): ネット優先→成功時だけ最新をキャッシュ置換、失敗時はキャッシュ
// - その他: プレキャッシュ対象のみキャッシュ優先（ランタイム保存しない）
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 同一オリジンのみ対象（外部は完全スルー）
  if (url.origin !== self.location.origin) return;

  // HTML
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(PRECACHE_NAME).then(c => c.put(`${BASE_PATH}/index.html`, copy));
        return res;
      }).catch(() => caches.match(`${BASE_PATH}/index.html`) /* オフライン時フォールバック */)
    );
    return;
  }

  // プレキャッシュ対象だけキャッシュ優先
  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req))
    );
  }
  // それ以外は素通り（保存しない）
});
