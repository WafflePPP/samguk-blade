// 네트워크 우선 캐시: 온라인이면 항상 최신 파일, 오프라인이면 마지막으로 받은 파일
const CACHE = 'samguk-v1', FILES = ['./', 'index.html', 'js/10-core.js', 'js/20-heroes.js', 'js/30-data.js', 'js/40-combat.js', 'js/50-tutorial-info.js', 'js/60-ai-boss.js', 'js/70-modes-pick.js', 'js/80-fighters.js', 'js/90-draw-units.js', 'js/91-render-world.js', 'js/92-hud.js', 'js/93-lobby.js', 'js/95-online.js', 'js/96-online-raid.js', 'js/99-main.js', 'manifest.webmanifest', 'icon-192.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
