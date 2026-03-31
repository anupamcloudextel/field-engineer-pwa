self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'New Case', body: event.data ? event.data.text() : 'A new case was added.' };
  }

  var title = data.title || 'New Case';
  var options = {
    body: data.body || 'A new case was added.',
    icon: '/company-logo.svg',
    badge: '/company-logo.svg',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = event.notification && event.notification.data ? event.notification.data.url : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (allClients) {
      var existing = allClients.find(function (c) {
        return c.url.indexOf(self.location.origin) !== -1;
      });
      if (existing) {
        existing.focus();
        existing.navigate(url);
        return;
      }
      return clients.openWindow(url);
    })
  );
});

