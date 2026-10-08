// Service worker for the installed app. Deliberately minimal: it only shows a
// friendly "no connection" page when a page cannot be loaded. It never stores
// pages, API responses or employee data, so nothing sensitive is kept on the
// device and every screen always comes live from the server.
const CACHE = "hc-offline-v1";
const OFFLINE_URL = "/offline.html";
const OFFLINE_ASSETS = [OFFLINE_URL, "/logo-cbp.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  // The offline page's own logo; everything else goes straight to the network.
  const { pathname } = new URL(request.url);
  if (pathname === "/logo-cbp.png") {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
