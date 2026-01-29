const CACHE_NAME = 'time-tracker-v2';
const TAILWIND_CDN = 'https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  TAILWIND_CDN
];

// Install service worker and cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Only cache our own files, not external CDN resources
        return cache.addAll(urlsToCache)
          .then(() => {
            console.log('All files cached successfully');
          })
          .catch(err => {
            console.log('Cache addAll error:', err);
            // Try adding them one by one if batch fails
            return Promise.allSettled(
              urlsToCache.map(url => 
                cache.add(url).catch(e => console.log('Failed to cache:', url, e))
              )
            );
          });
      })
  );
  self.skipWaiting();
});

// Activate service worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch strategy: Network first for CDN resources, cache first for local files
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // If request is for the Tailwind CDN, try cache-first then network and cache it
  if (url.href.startsWith('https://cdn.tailwindcss.com')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) return response;
        return fetch(event.request).then((resp) => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return resp;
        }).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // For external CDN resources (other than Tailwind), always try network first
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // For our own files, try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
      .catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});

// Handle background sync (if needed in future)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-activities') {
    event.waitUntil(syncActivities());
  }
});

async function syncActivities() {
  // Placeholder for future server sync functionality
  console.log('Background sync triggered');
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Timer notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'timer-notification',
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification('Time Tracker', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
clients.openWindow('./index.html')  );
});
