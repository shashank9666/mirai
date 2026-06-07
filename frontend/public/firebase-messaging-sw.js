// Dummy Service Worker to prevent 404 errors during local development
// This resolves issues with leftover service worker registrations on localhost:3000

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
