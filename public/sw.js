// Service worker mínimo de Akira Astrum (Fase 3, D; ADR 0022).
// Solo hace una cosa: si no hay conexión al abrir una página pública, muestra /offline.
// No guarda nunca una página ni una respuesta de la red; la caché contiene únicamente los archivos de PRECACHE.
const CACHE = "akira-astrum-offline-v1";
const OFFLINE = "/offline";
const PRECACHE = [OFFLINE, "/offline.css", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"];

// Intranet y acceso: ni se guardan ni pasan por este service worker. Se compara ya decodificada y en minúsculas.
const PRIVATE_PATH = /^\/(admin|login)(\/|$)/;
const SKIPPED_PATH = /^\/(api|_next)(\/|$)/;
// Server Actions, datos RSC, precargas del enrutador y peticiones autenticadas.
const SKIPPED_HEADERS = ["next-action", "rsc", "next-router-prefetch", "next-router-state-tree", "authorization"];

function normalized(pathname) {
  let path = pathname;
  try {
    for (let i = 0; i < 3 && /%/.test(path); i += 1) path = decodeURIComponent(path);
  } catch {
    return null;
  }
  return path.toLowerCase().replace(/\/{2,}/g, "/");
}

function shouldHandle(request) {
  if (request.method !== "GET" || request.mode !== "navigate") return false;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  if (url.origin !== self.location.origin) return false;
  const path = normalized(url.pathname);
  if (path === null || PRIVATE_PATH.test(path) || SKIPPED_PATH.test(path)) return false;
  if (url.searchParams.has("_rsc")) return false;
  return !SKIPPED_HEADERS.some((name) => request.headers.get(name) !== null);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith("akira-astrum-") && name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (!shouldHandle(event.request)) return;
  // Con red, la respuesta pasa tal cual (también los errores del servidor). Solo si la red falla se sirve /offline.
  event.respondWith(
    fetch(event.request).catch((error) =>
      caches
        .open(CACHE)
        .then((cache) => cache.match(OFFLINE))
        .then((page) => page || Promise.reject(error)),
    ),
  );
});
