"use strict";

const CACHE_NAME = "saved-gallery-shell-v1";
const APP_FILES = [
  new URL("./", self.registration.scope).href,
  new URL("./index.html", self.registration.scope).href,
  new URL("./manifest.webmanifest", self.registration.scope).href,
  new URL("./icon.svg", self.registration.scope).href,
  new URL("./icon-192.png", self.registration.scope).href,
  new URL("./icon-512.png", self.registration.scope).href,
  new URL("./apple-touch-icon.png", self.registration.scope).href
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith("saved-gallery-shell-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(async () => {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        await Promise.all(requests.filter(request => {
          const url = new URL(request.url);
          return url.searchParams.has("code")
            || url.searchParams.has("state")
            || url.searchParams.has("error");
        }).map(request => cache.delete(request)));
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin
    || !url.href.startsWith(self.registration.scope)
    || url.searchParams.has("code")
    || url.searchParams.has("state")
    || url.searchParams.has("error")) return;

  event.respondWith(
    fetch(request)
      .then(async response => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const appShell = await caches.match(new URL("./index.html", self.registration.scope).href);
          if (appShell) return appShell;
        }
        return Response.error();
      })
  );
});
