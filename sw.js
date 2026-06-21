// ============================================
// SERVICE WORKER — Cache offline
// ============================================

const CACHE_NAME = 'avaliacao-v2';
const ARQUIVOS_CACHE = [
  '/',
  '/index.html',
  '/laudo.html',
  '/laudos.html',
  '/banco.html',
  '/config.html',
  '/css/estilo.css',
  '/js/db.js',
  '/js/referencia.js',
  '/js/fluxo.js',
  '/js/calculos.js',
  '/js/estatistica.js',
  '/manifest.json'
];

// Instala — faz cache dos arquivos principais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ARQUIVOS_CACHE);
    })
  );
  self.skipWaiting();
});

// Ativa — limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch — strategy: cache first, network fallback
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache apenas recursos do próprio app
        if (event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Fallback offline básico
      if (event.request.destination === 'document') {
        return caches.match('/index.html');
      }
    })
  );
});