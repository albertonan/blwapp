/* Service Worker: precache de app shell + JSONs modulares de alimentos */

const CACHE_NAME = "blwcare-v3.0";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // 1) Precargar shell
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll([
        "./",
        "./index.html",
        "./manifest.json",
        "./css/styles.css",
        "./js/data.js",
        "./js/router.js",
        "./js/storage.js",
        "./js/app.js"
      ]);

      // 2) Cargar índice maestro y precachear JSONs de alimentos
      try {
        importScripts("./js/data.js");
        const index = Array.isArray(self.FOOD_INDEX) ? self.FOOD_INDEX : [];
        const jsonPaths = index.map((f) => f.path).filter(Boolean);
        // Precachear en lotes para evitar errores de red
        for (let i = 0; i < jsonPaths.length; i += 10) {
          const batch = jsonPaths.slice(i, i + 10);
          try {
            await cache.addAll(batch.map((p) => `./${p}`));
          } catch {
            // Continuar con el siguiente lote si falla
          }
        }
      } catch (e) {
        console.warn("SW: No se pudo cargar índice de alimentos", e);
      }

      // 3) Recetas (índice + JSONs)
      try {
        const resp = await fetch("./data/recipes/index.json", { cache: "no-cache" });
        if (resp && resp.ok) {
          const recipeIndex = await resp.json();
          const recipes = Array.isArray(recipeIndex.recipes) ? recipeIndex.recipes : [];
          const paths = recipes.map((r) => r.path).filter(Boolean);
          await cache.addAll(["./data/recipes/index.json"]);
          // Precachear recetas en lotes
          for (let i = 0; i < paths.length; i += 5) {
            const batch = paths.slice(i, i + 5);
            try {
              await cache.addAll(batch.map((p) => `./${p}`));
            } catch {
              // Continuar con el siguiente lote
            }
          }
        }
      } catch {
        console.warn("SW: No se pudo cargar índice de recetas");
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        const url = new URL(request.url);
        // Cachea solo same-origin
        if (url.origin === self.location.origin && response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        // Sin fallback extra: si está offline y no está en cache, fallará.
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })()
  );
});
