const CACHE_NAME = 'task-manager-pwa-v9';

// BASE é o diretório onde o SW está instalado — detectado em runtime.
// Localmente: '/'   |   GitHub Pages: '/task-manager-pwa/'
const BASE = new URL('./', self.location.href).pathname;

const ARQUIVOS = [
  BASE,
  BASE + 'index.html',
  BASE + 'styles.css',
  BASE + 'manifest.webmanifest',
  BASE + 'js/app.js',
  BASE + 'js/config.js',
  BASE + 'js/googleAuth.js',
  BASE + 'js/driveSync.js',
  BASE + 'js/db.js',
  BASE + 'js/storage.js',
  BASE + 'js/dateUtils.js',
  BASE + 'js/sortUtils.js',
  BASE + 'js/ics.js',
  BASE + 'js/views/dayView.js',
  BASE + 'js/views/weekView.js',
  BASE + 'js/views/monthView.js',
  BASE + 'js/views/kanbanView.js',
  BASE + 'js/views/searchView.js',
  BASE + 'js/components/card.js',
  BASE + 'js/components/modal.js',
  BASE + 'js/components/detailModal.js',
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
        ARQUIVOS.map(url =>
          cache.add(new Request(url, { cache: 'no-cache' })).catch(() => {})
        )
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

// Fetch: Stale-While-Revalidate — responde do cache na hora e atualiza o
// cache pela rede em background. Assim, novas versões publicadas no GitHub
// Pages aparecem no recarregamento seguinte, sem precisar limpar o cache.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);

      // cache: 'no-cache' força revalidar no servidor (senão o cache HTTP do
      // navegador pode responder com arquivo velho por heurística e a
      // atualização nunca chega). No GitHub Pages vira 304 quando não mudou.
      const rede = fetch(new Request(event.request.url, { cache: 'no-cache' }))
        .then(response => {
          if (response && response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        rede.catch(() => {}); // revalida em background
        return cached;
      }

      const response = await rede;
      if (response) return response;
      if (event.request.mode === 'navigate') {
        return cache.match(BASE + 'index.html');
      }
      return Response.error();
    })
  );
});
