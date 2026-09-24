/* Renders data-only FCM web pushes ({ title, body, url }). No Firebase SDK needed here. */

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  const data = payload.data ?? payload;

  event.waitUntil(
    self.registration.showNotification(data.title || "변경 요청", {
      body: data.body || "",
      icon: "/favicon.ico",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Only ever navigate within our own origin.
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => "focus" in w);
      if (existing) return existing.focus().then((w) => w.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
