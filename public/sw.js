// Service worker for the installed app. Deliberately minimal: it only shows a
// friendly "no connection" page when a page cannot be loaded. It never stores
// pages, API responses or employee data, so nothing sensitive is kept on the
// device and every screen always comes live from the server.
const CACHE = "sapa-offline-v2";
const OFFLINE_URL = "/offline.html";
const ICON_URL = "/pwa/icon-192.png";
const OFFLINE_ASSETS = [OFFLINE_URL, ICON_URL];

// Tapping the app icon, an email link or a notification wakes the phone's network up at the same moment, and the
// very first request often fails for a second even though the internet is fine. So a page is asked for up to three
// times (right away, then after 0.7 s and 1.8 s) before the "no connection" page is shown.
const RETRY_DELAYS_MS = [0, 700, 1800];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      // Lets the browser start loading the page while this worker is still waking up (faster taps, fewer failures).
      .then(() => (self.registration.navigationPreload ? self.registration.navigationPreload.enable() : undefined))
      .then(() => self.clients.claim())
      // A new version of the app arrived: windows nobody is looking at (a forgotten tab, an installed app in the
      // background) refresh themselves so they do not keep running the old version. A window someone is using is
      // left alone; the page itself offers a "Muat ulang" notice (components/app-update-watcher.tsx).
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((windows) => Promise.all(windows.filter((w) => w.visibilityState === "hidden").map((w) => w.navigate(w.url).catch(() => {}))))
  );
});

async function loadPage(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
  } catch {
    // the browser's own early request failed: ask again below
  }
  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await wait(delay);
    try {
      return await fetch(event.request);
    } catch {
      // try again
    }
  }
  return (await caches.match(OFFLINE_URL)) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") {
    event.respondWith(loadPage(event));
    return;
  }
  // The offline page's own icon; everything else goes straight to the network.
  const { pathname } = new URL(request.url);
  if (pathname === ICON_URL) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});

// Keeps the number on the app icon right even while the app is closed. The
// browser runs this now and then (installed apps only); the count itself is
// asked from the server, so nothing about the approvals is stored here.
async function refreshBadge() {
  try {
    const res = await fetch("/api/pending-count", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return self.navigator.clearAppBadge && (await self.navigator.clearAppBadge());
    const { count, prefs } = await res.json();
    // Respect the person's own switch for the number on the icon.
    if (prefs && prefs.icon === false) return self.navigator.clearAppBadge && (await self.navigator.clearAppBadge());
    if (count > 0 && self.navigator.setAppBadge) await self.navigator.setAppBadge(count);
    else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
  } catch {
    // Offline: leave the number as it was.
  }
}

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "hc-pending-approvals") event.waitUntil(refreshBadge());
});
