const CACHE = "trip-v11";
const ASSETS = ["./", "./index.html", "./styles.css",
  "./sample-trip.js", "./store.js", "./schema.js", "./money.js", "./remote.js", "./views.js", "./editor.js", "./app.js",
  "./manifest.json", "./icon.svg", "./icon-180.png", "./icon-512.png"];
self.addEventListener("install", function (e) {
  // {cache:"reload"}: 브라우저 HTTP 캐시를 건너뛰고 서버에서 새로 받는다.
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: "reload" }); }));
  }));
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});
// 네트워크 우선 + 캐시 폴백: 온라인이면 항상 최신 일정, 오프라인이면 캐시.
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      const copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (r) {
        return r || caches.match("./index.html");
      });
    })
  );
});
