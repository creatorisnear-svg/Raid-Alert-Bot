// Service worker for TCK Raid Alerts PWA.
// Handles incoming push notifications from our Express backend and turns
// them into system notifications + relays them to any open app tabs.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'Raid Alert!', body: 'Check Discord.', playSiren: true };
  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const title = data.title || 'Raid Alert!';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [300, 100, 300, 100, 300],
    tag: 'raid-alert',        // replaces previous if still visible
    renotify: true,           // still vibrate/sound even if replacing
    requireInteraction: true, // keep notification on screen until dismissed
    data: data,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Relay to all open app tabs so they can play the siren + update UI
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'RAID_ALERT', title, body: data.body || '' });
        }
      }),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab if one is open
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      // Otherwise open a new tab
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
