// Loaded into the service worker: shows push notifications while Ivy is closed or in the background.

// Same database as src/services/notifyKeyStore.ts
function notifyKv(key) {
  return new Promise((resolve) => {
    const req = indexedDB.open('ivy-notify', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onerror = () => resolve(undefined);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const get = db.transaction('kv', 'readonly').objectStore('kv').get(key);
        get.onsuccess = () => {
          resolve(get.result);
          db.close();
        };
        get.onerror = () => {
          resolve(undefined);
          db.close();
        };
      } catch (e) {
        resolve(undefined);
        db.close();
      }
    };
  });
}

function fromB64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Decrypts an "enc1:<iv>:<ciphertext>" preview, only for whoever is signed in on this phone
async function readPreview(data) {
  if (!data.preview || (await notifyKv('showText')) === false) return null;
  const [key, userId] = await Promise.all([notifyKv('coupleKey'), notifyKv('userId')]);
  if (!key || (data.to && userId !== data.to)) return null;
  try {
    const [iv, ct] = data.preview.slice('enc1:'.length).split(':');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ct));
    return new TextDecoder().decode(plain);
  } catch (e) {
    return null;
  }
}

// Ivy open and on screen: the message already shows up live
async function ivyOnScreen() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return windows.some((c) => c.visibilityState === 'visible' && c.focused);
}

const MAX_LINES = 6;

async function showPush(data) {
  const kind = data.kind || 'message';
  if (kind !== 'call' && (await ivyOnScreen())) return;

  const tag = data.tag || 'ivy';
  let title = data.title || 'Ivy';
  let body = data.body || '💌 Something new for you';
  let lines = [];

  if (kind === 'message') {
    const text = await readPreview(data);
    // Stack messages from the same person into one notification, like WhatsApp
    const previous = (await self.registration.getNotifications({ tag }))[0];
    const count = ((previous && previous.data && previous.data.count) || 0) + 1;
    lines = ((previous && previous.data && previous.data.lines) || []).concat(text || body).slice(-MAX_LINES);
    body = lines.join('\n');
    if (count > 1) title = `${title} (${count} messages)`;
    data.count = count;
  }

  await self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/badge-96x96.png',
    tag,
    renotify: true,
    timestamp: Date.now(),
    requireInteraction: kind === 'call',
    vibrate: kind === 'call' ? [300, 150, 300, 150, 300, 150, 600] : [120, 60, 120],
    data: { url: data.url || '/', kind, lines, count: data.count || 1 },
  });
  if (kind === 'message' && self.navigator.setAppBadge) {
    const open = await self.registration.getNotifications();
    const total = open.reduce((n, x) => n + ((x.data && x.data.count) || 0), 0);
    self.navigator.setAppBadge(total).catch(() => {});
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  event.waitUntil(showPush(data));
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
