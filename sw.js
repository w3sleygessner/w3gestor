const CACHE_NAME = "w3gestor-v1";

const urlsToCache = [
    "/",
    "/index.html",
    "/style.css",
    "/main.js",
    "/icon.png"
];

self.addEventListener('install', () => {
  console.log('PWA instalada');
});

self.addEventListener('fetch', (event) => {});

self.addEventListener("activate", (event) => {

    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );

    self.clients.claim();
});

// self.addEventListener("fetch", (event) => {

//     event.respondWith(
//         caches.match(event.request).then((response) => {
//             return response || fetch(event.request);
//         })
//     );
// });


