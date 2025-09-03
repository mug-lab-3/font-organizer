// ===== 設定（リリースごとに CACHE_VERSION を上げるだけ！）=====
const CACHE_VERSION  = 'v1.0.5';                // ← 例: v1.0.1 に上げる
const PRECACHE_NAME  = `precache-${CACHE_VERSION}`;
const PRECACHE_URLS  = [
  '../index.html',
  '../manifest.webmanifest',
  './favicon_32.png',
  './favicon_64.png',
  './favicon_128.png',
  './favicon_256.png',
  './favicon_512.png'
];
// ===============================================================

// install: 事前キャッシュ（skipWaitingは呼ばない＝次回リロードで反映）
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PRECACHE_NAME).then(c => c.addAll(PRECACHE_URLS)));
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
    // 今開いてるタブは旧SWのまま。リロードで新SWに切替したいので clients.claim() もしない
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
        caches.open(PRECACHE_NAME).then(c => c.put('../index.html', copy));
        return res;
      }).catch(() => caches.match('../index.html') /* オフライン時フォールバック */)
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
