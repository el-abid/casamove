const CACHE = "casamove-public-2026-11-26.1";
const LOCALES = ["fr", "ar", "en"];
const SHELLS = LOCALES.flatMap((locale) => [
  `/${locale}`,
  `/${locale}/journey`,
  `/${locale}/network`,
]);
const NETWORK = "/api/mobility/network";
const OFFLINE = "/offline.html";
const STATIC = [
  OFFLINE,
  "/manifest.webmanifest",
  "/casamove-192.png",
  "/casamove-512.png",
  "/casamove-maskable.png",
  "/casamove-boulevard.webp",
];

async function saveShell(cache, path) {
  const response = await fetch(path, { credentials: "omit", cache: "reload" });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("text/html")
  )
    return;
  await cache.put(path, response.clone());
  const html = await response.text();
  const assets = new Set(
    html.match(/\/_next\/static\/[a-zA-Z0-9_./~-]+\.(?:css|js|woff2)/g) ?? []
  );
  return Promise.allSettled(
    [...assets].map((asset) =>
      cache.add(new Request(asset, { credentials: "omit" }))
    )
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.add(OFFLINE);
      await Promise.allSettled([
        ...SHELLS.map((path) => saveShell(cache, path)),
        ...[...STATIC.filter((path) => path !== OFFLINE), NETWORK].map((path) =>
          cache.add(new Request(path, { credentials: "omit" }))
        ),
      ]);
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("casamove-public-") && key !== CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (SHELLS.includes(url.pathname) &&
              (await cache.match(url.pathname))) ||
            (await cache.match(OFFLINE)) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }
  if (url.pathname === NETWORK) {
    event.respondWith(
      fetch(request).catch(
        async () => (await caches.match(NETWORK)) || Response.error()
      )
    );
    return;
  }
  if (request.headers.has("RSC")) return;
  if (
    !url.pathname.startsWith("/_next/static/") &&
    !STATIC.includes(url.pathname)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })()
  );
});
