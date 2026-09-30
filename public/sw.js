const STATIC_CACHE = "kocluk-static-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Akademik Takip", body: "", url: "/quiz-entry" };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (err) {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Akademik Takip", {
      body: payload.body || "",
      vibrate: [100, 50, 100],
      data: { url: payload.url || "/quiz-entry" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) ||
    "/quiz-entry";
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            try {
              await client.navigate(absoluteUrl);
            } catch (err) {
              // navigate her tarayıcıda resolve olmayabilir; odaklama yine yapılır
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(absoluteUrl);
        }
        return undefined;
      }),
  );
});

function isCacheableStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /^\/(?:icon-|apple-touch-icon)/.test(url.pathname) ||
    /\.(?:png|jpe?g|gif|svg|webp|ico|woff2?)$/i.test(url.pathname)
  );
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === "basic") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return (await network) || cached || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isCacheableStatic(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        return offline || Response.error();
      }),
    );
  }
});
