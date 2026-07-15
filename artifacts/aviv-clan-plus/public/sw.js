// Service worker for AVIV Clan+.
// Turns incoming web push events into system notifications and relays them
// to any open app tabs so they can flash the UI and play the alarm siren.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'Raid Alert!', body: 'Check the clan dashboard.' };
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
    tag: 'raid-alert',
    renotify: true,
    requireInteraction: true,
    data,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Relay to all open app tabs so they can play the siren + update UI
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'RAID_ALERT', title, body: data.body || '', clanId: data.clanId ?? null });
        }
      }),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clanId = event.notification.data?.clanId ?? null;
  // Navigate to the clan page (or dashboard) with ?siren=1 so the app knows
  // to auto-play the alarm even if it was fully closed when the push arrived.
  const targetUrl = clanId ? `/clans/${clanId}?siren=1` : '/dashboard?siren=1';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If there's already an open window, navigate it to the clan page.
      for (const client of clients) {
        if ('navigate' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
