// Service Worker para Lorcana Meta Tier List
// Versão: 3.4.0

const CACHE_VERSION = 'lorcana-meta-v3.4.0';
const API_CACHE = 'lorcana-api-v3.4.0';
const IMAGE_CACHE = 'lorcana-images-v3.4.0';

// Assets estáticos para cache (Shell da aplicação)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Rotas da API para cache
const API_ROUTES = [
  '/api/meta-analysis/tier-list',
  '/api/meta-analysis/archetype'
];

// ==========================================
// INSTALL - Cachear assets estáticos
// ==========================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting(); // Ativar imediatamente
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// ==========================================
// ACTIVATE - Limpar caches antigos
// ==========================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Deletar caches que não são da versão atual
            if (cacheName !== CACHE_VERSION && 
                cacheName !== API_CACHE && 
                cacheName !== IMAGE_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim(); // Controlar todas as páginas
      })
  );
});

// ==========================================
// FETCH - Estratégias de cache
// ==========================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não-GET e chrome-extension
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Estratégia baseada no tipo de recurso
  if (isAPIRequest(url)) {
    // API: Network First (dados frescos, fallback para cache)
    event.respondWith(networkFirstStrategy(request, API_CACHE));
  } else if (isImageRequest(url)) {
    // Imagens: Cache First (performance, raramente mudam)
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
  } else {
    // Assets estáticos: Cache First com network fallback
    event.respondWith(cacheFirstStrategy(request, CACHE_VERSION));
  }
});

// ==========================================
// ESTRATÉGIA: Network First
// ==========================================
async function networkFirstStrategy(request, cacheName) {
  try {
    // Tentar buscar da network
    const networkResponse = await fetch(request);
    
    // Se bem-sucedido, cachear e retornar
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network falhou, buscar do cache
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Se não há cache, retornar resposta offline
    return offlineResponse(request);
  }
}

// ==========================================
// ESTRATÉGIA: Cache First
// ==========================================
async function cacheFirstStrategy(request, cacheName) {
  // Tentar buscar do cache
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Cache miss, buscar da network
  try {
    const networkResponse = await fetch(request);
    
    // Cachear para próximas requisições
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Fetch failed:', request.url, error);
    return offlineResponse(request);
  }
}

// ==========================================
// HELPERS
// ==========================================
function isAPIRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isImageRequest(url) {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname);
}

function offlineResponse(request) {
  const url = new URL(request.url);
  
  // Resposta offline para API
  if (isAPIRequest(url)) {
    return new Response(
      JSON.stringify({
        offline: true,
        message: 'You are offline. Showing cached data.',
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        })
      }
    );
  }
  
  // Resposta offline para HTML
  if (request.headers.get('accept').includes('text/html')) {
    return caches.match('/offline.html').then((response) => {
      return response || new Response(
        '<html><body><h1>You are offline</h1><p>Please check your connection.</p></body></html>',
        {
          headers: { 'Content-Type': 'text/html' }
        }
      );
    });
  }
  
  // Resposta genérica offline
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable'
  });
}

// ==========================================
// BACKGROUND SYNC (opcional)
// ==========================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  
  if (event.tag === 'sync-tier-list') {
    event.waitUntil(syncTierList());
  }
});

async function syncTierList() {
  try {
    const response = await fetch('/api/meta-analysis/tier-list');
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      await cache.put('/api/meta-analysis/tier-list', response);
      console.log('[SW] Tier list synced in background');
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// ==========================================
// PUSH NOTIFICATIONS (opcional)
// ==========================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Lorcana Meta Update';
  const options = {
    body: data.body || 'New tier list available!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    },
    actions: [
      {
        action: 'view',
        title: 'View Now'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    const urlToOpen = event.notification.data.url;
    event.waitUntil(
      clients.openWindow(urlToOpen)
    );
  }
});

// ==========================================
// MESSAGE HANDLING
// ==========================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

console.log('[SW] Service Worker loaded');
