/* KaamSetu service worker — intentionally minimal and privacy-safe.
   • Never caches /api responses (they contain personal data).
   • Caches only the static app shell assets so the app opens quickly on weak networks.
   • Navigations are network-first and fall back to /offline when there is no connection. */
const CACHE = "kisansetu-shell-v1";
const SHELL = ["/offline", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/offline")));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })));
  }
});

/* Push notifications: the server-side provider (Web Push / FCM) is a pluggable adapter — see README.
   This handler displays a payload when one arrives. */
self.addEventListener("push", (e) => {
  let data = { title: "KaamSetu", body: "You have a new update.", url: "/notifications" };
  try { data = { ...data, ...e.data.json() }; } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icon.svg", data: { url: data.url } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || "/notifications"));
});
