/* Imported by the generated service worker. No timer or background simulation. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cityId = event.notification.data?.cityId;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find((client) =>
        client.url.startsWith(self.registration.scope),
      );
      if (existing) {
        existing.postMessage({ type: "OPEN_CITY", cityId });
        await existing.focus();
      } else {
        const url = new URL(self.registration.scope);
        if (typeof cityId === "string") url.searchParams.set("city", cityId);
        await self.clients.openWindow(url.href);
      }
    })(),
  );
});
