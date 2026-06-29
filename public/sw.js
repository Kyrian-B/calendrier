const CACHE_NAME = "objectifs-v1";

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(["/", "/src/App.jsx", "/manifest.json"])
    )
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});