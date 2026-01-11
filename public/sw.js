// Service Worker for AniList Tools
// Simple cache for API responses and static assets

const CACHE_NAME = 'anilist-tools-v1';
const API_CACHE_NAME = 'anilist-api-v1';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/anilist/home',
        '/anilist/search',
        '/anilist/compare'
      ]);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Cache API responses with TTL
  if (url.pathname.startsWith('/api/anilist/')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            // Check if cache is still valid (5 minutes TTL for API)
            const cachedDate = cachedResponse.headers.get('sw-cached-date');
            if (cachedDate) {
              const cacheAge = Date.now() - parseInt(cachedDate, 10);
              if (cacheAge < 5 * 60 * 1000) { // 5 minutes
                return cachedResponse;
              }
            }
          }
          
          // Fetch from network
          return fetch(event.request).then((response) => {
            // Clone response to add cache header
            const responseToCache = response.clone();
            const newHeaders = new Headers(responseToCache.headers);
            newHeaders.set('sw-cached-date', Date.now().toString());
            
            const modifiedResponse = new Response(responseToCache.body, {
              status: responseToCache.status,
              statusText: responseToCache.statusText,
              headers: newHeaders
            });
            
            // Cache the response
            cache.put(event.request, modifiedResponse.clone());
            return response;
          }).catch(() => {
            // If network fails and we have cached data, return it even if expired
            if (cachedResponse) {
              return cachedResponse;
            }
            throw new Error('Network error and no cache available');
          });
        });
      })
    );
    return;
  }
  
  // For static assets, use cache-first strategy
  if (url.pathname.startsWith('/_next/static/') || 
      url.pathname.startsWith('/images/') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.jpeg') ||
      url.pathname.endsWith('.svg')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request).then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }
  
  // For other requests, use network-first strategy
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
