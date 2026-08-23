/* Service worker — digenerate oleh build/scripts/make-sw.py.
 * JANGAN disunting tangan: nama cache di bawah diturunkan dari hash isi
 * berkas inti, dan akan ditimpa pada build berikutnya.
 */
const CACHE = 'dh-8c400d4e4e';
const INTI = [
  '/',
  '/id/',
  '/assets/css/site.css',
  '/assets/js/app.js',
  '/assets/js/smoke.js',
  '/assets/js/anime.min.js',
  '/assets/fonts/Inter-var.woff2',
  '/assets/fonts/SpaceGrotesk-var.woff2',
  '/assets/fonts/JetBrainsMono-var.woff2',
  '/assets/img/profil.webp',
  '/assets/img/avatar-96.webp',
  '/manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  // Precache yang gagal sebagian tidak boleh menggagalkan seluruh install.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(INTI.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Halaman: jaringan dulu supaya perubahan konten langsung terlihat,
  // cache hanya sebagai jaring pengaman saat offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const salinan = res.clone();
          caches.open(CACHE).then((c) => c.put(req, salinan));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Aset: cache dulu. Aman karena nama cache berganti tiap rilis, jadi
  // aset lama ikut terbuang saat activate.
  e.respondWith(
    caches.match(req).then((r) => r || fetch(req).then((res) => {
      if (res.ok) {
        const salinan = res.clone();
        caches.open(CACHE).then((c) => c.put(req, salinan));
      }
      return res;
    }))
  );
});
