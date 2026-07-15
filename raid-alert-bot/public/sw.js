// Service worker for TCK Raid Alerts PWA.
// Handles incoming push notifications from our Express backend and turns
// them into system notifications + relays them to any open app tabs.

// Remember the last alert so we can replay it to a page that opens later
// (e.g. user taps the notification after the screen was off).
let lastAlert = null;

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
  const body  = data.body  || '';

  // Store so notificationclick and new clients can replay it.
  lastAlert = { title, body, receivedAt: Date.now() };

  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [300, 100, 300, 100, 300, 100, 500],
    tag: 'raid-alert',        // replaces previous if still visible
    renotify: true,           // still vibrate/sound even if replacing
    requireInteraction: true, // keep notification on screen until dismissed
    data: { title, body },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Relay to all open app tabs so they can play the siren + update UI.
      // If the tab is backgrounded the message still arrives; the page
      // stores it and plays the siren when it comes back to foreground.
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'RAID_ALERT', title, body });
        }
      }),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const alertTitle = event.notification.data?.title || event.notification.title || 'Raid Alert!';
  const alertBody  = event.notification.data?.body  || '';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      let target = null;

      // Focus an existing tab if one is open.
      for (const client of clients) {
        if ('focus' in client) {
          await client.focus();
          target = client;
          break;
        }
      }

      // Otherwise open a new tab.
      if (!target && self.clients.openWindow) {
        target = await self.clients.openWindow('/');
      }

      // Tell the page to play the siren now that it is focused/open.
      // This is the key fix: previously we only sent RAID_ALERT during the
      // push event, so tapping a notification after the screen was off never
      // triggered the siren. Now it always does.
      if (target) {
        target.postMessage({ type: 'RAID_ALERT', title: alertTitle, body: alertBody });
      }
    })
  );
});

// When the page sends us a PING, reply with the last alert (if any) so the
// page can catch up on what it missed while it was suspended / off-screen.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SW_PING' && lastAlert) {
    // Only replay alerts received in the last 5 minutes -- stale ones
    // (e.g. from hours ago when the user was asleep) should not suddenly
    // blare a siren when they open the app the next morning.
    const ageMs = Date.now() - lastAlert.receivedAt;
    if (ageMs < 5 * 60 * 1000) {
      event.source.postMessage({
        type: 'RAID_ALERT',
        title: lastAlert.title,
        body:  lastAlert.body,
        replayed: true,
      });
    }
  }
});
