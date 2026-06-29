const CACHE_NAME = 'task-manager-pwa-v4';

// BASE é o diretório onde o SW está instalado — detectado em runtime.
// Localmente: '/'   |   GitHub Pages: '/task-manager-pwa/'
const BASE = new URL('./', self.location.href).pathname;

const ARQUIVOS = [
  BASE,
  BASE + 'index.html',
  BASE + 'styles.css',
  BASE + 'manifest.webmanifest',
  BASE + 'js/app.js',
  BASE + 'js/db.js',
  BASE + 'js/storage.js',
  BASE + 'js/dateUtils.js',
  BASE + 'js/views/dayView.js',
  BASE + 'js/views/weekView.js',
  BASE + 'js/views/monthView.js',
  BASE + 'js/views/kanbanView.js',
  BASE + 'js/views/searchView.js',
  BASE + 'js/components/card.js',
  BASE + 'js/components/modal.js',
  BASE + 'assets/icons/icon-192.png',
  BASE + 'assets/icons/icon-512.png',
];

// Instalação: cacheia cada arquivo individualmente para que uma falha
// (ex: ícone ainda não gerado) não impeça o SW de instalar.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        ARQUIVOS.map(url => cache.add(url).catch(() => {}))
      );
      await self.skipWaiting();
    })()
  );
});

// Ativação: remove caches de versões anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: Cache First — serve do cache; atualiza cache em background
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE)) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match(BASE + 'index.html');
          }
        });
    })
  );
});
