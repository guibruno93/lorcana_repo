/* Inkwell Labs — service worker mínimo para PWA (sem cache agressivo de API).
 * Encaminha pedidos à rede para não interferir com a API. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});
