// Loaded into the service worker: shows push notifications while Ivy is closed.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || 'Ivy';
  const options = {
    body: data.body || '💌 Something new for you',
    icon: '/pwa-192x192.png',
    badge: '/badge-96x96.png',
    tag: data.tag || 'ivy',
    renotify: true,
    requireInteraction: data.kind === 'call',
    vibrate: data.kind === 'call' ? [300, 150, 300, 150, 300, 150, 600] : [120, 60, 120],
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
