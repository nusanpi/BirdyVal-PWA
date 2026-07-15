const CACHE_VERSION = 'v3';
const CACHE_STATIC = `birdyval-static-${CACHE_VERSION}`;
const CACHE_PAGES  = `birdyval-pages-${CACHE_VERSION}`;

// Assets estáticos que se cachean en la instalación
const STATIC_ASSETS = [
  '/index.html',
  '/login.html',
  '/registro.html',
  '/comunidad.html',
  '/mapa.html',
  '/buscador.html',
  '/perfil.html',
  '/manifest.json',
  '/css/style.css',
  '/css/base.css',
  '/css/components.css',
  '/img/logo.png',
  '/img/logo_sintexto.png',
  '/img/icono.png',
  '/img/icon-192x192.png',
  '/img/icon-512x512.png',
  '/img/user_default.png',
  '/img/audio_placeholder.png',
  '/img/apple-touch-icon.png',
  '/i18n/es.json',
  '/i18n/ca.json',
];

// Página de fallback offline
const OFFLINE_PAGE = '/index.html';

// ── Instalación: precachear assets estáticos ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activación: limpiar caches de versiones anteriores ───────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_STATIC && key !== CACHE_PAGES)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: estrategia según tipo de recurso ───────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones no GET y peticiones a otros dominios (Firebase, Render, eBird, Gemini)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Assets estáticos (CSS, JS, imágenes, fuentes, i18n) → Cache-first
  if (
    url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|ico|woff2?|json)$/) &&
    !url.pathname.includes('firebase') &&
    !url.pathname.includes('gstatic')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_STATIC).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Páginas HTML → Network-first con fallback a caché y luego a offline
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_PAGES).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_PAGE))
        )
    );
    return;
  }
});
