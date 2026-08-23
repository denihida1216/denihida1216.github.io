#!/usr/bin/env python3
"""Bangun service worker dengan nama cache yang ikut berubah tiap rilis.

    python3 scripts/make-sw.py

Nama cache diturunkan dari hash isi berkas inti. Kalau ada yang berubah,
nama cache ikut berubah, cache lama dihapus saat activate, dan pengunjung
tidak pernah tersangkut versi basi — masalah paling sering pada PWA
statis.
"""
import hashlib
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]

# Yang di-precache: cukup untuk halaman tampil utuh saat offline.
INTI = [
    "/",
    "/id/",
    "/assets/css/site.css",
    "/assets/js/app.js",
    "/assets/js/smoke.js",
    "/assets/js/anime.min.js",
    "/assets/fonts/Inter-var.woff2",
    "/assets/fonts/SpaceGrotesk-var.woff2",
    "/assets/fonts/JetBrainsMono-var.woff2",
    "/assets/img/profil.webp",
    "/assets/img/avatar-96.webp",
    "/manifest.webmanifest",
]

SUMBER_HASH = [
    "index.html", "id/index.html", "assets/css/site.css",
    "assets/js/app.js", "assets/js/smoke.js", "manifest.webmanifest",
]

TEMPLATE = """/* Service worker — digenerate oleh build/scripts/make-sw.py.
 * JANGAN disunting tangan: nama cache di bawah diturunkan dari hash isi
 * berkas inti, dan akan ditimpa pada build berikutnya.
 */
const CACHE = 'dh-{versi}';
const INTI = {inti};

self.addEventListener('install', (e) => {{
  // Precache yang gagal sebagian tidak boleh menggagalkan seluruh install.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(INTI.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
}});

self.addEventListener('activate', (e) => {{
  e.waitUntil(
    caches.keys()
      .then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
}});

self.addEventListener('fetch', (e) => {{
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Halaman: jaringan dulu supaya perubahan konten langsung terlihat,
  // cache hanya sebagai jaring pengaman saat offline.
  if (req.mode === 'navigate') {{
    e.respondWith(
      fetch(req)
        .then((res) => {{
          const salinan = res.clone();
          caches.open(CACHE).then((c) => c.put(req, salinan));
          return res;
        }})
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }}

  // Aset: cache dulu. Aman karena nama cache berganti tiap rilis, jadi
  // aset lama ikut terbuang saat activate.
  e.respondWith(
    caches.match(req).then((r) => r || fetch(req).then((res) => {{
      if (res.ok) {{
        const salinan = res.clone();
        caches.open(CACHE).then((c) => c.put(req, salinan));
      }}
      return res;
    }}))
  );
}});
"""


def main() -> None:
    h = hashlib.sha256()
    for nama in SUMBER_HASH:
        berkas = AKAR / nama
        if not berkas.exists():
            raise SystemExit(f"berkas inti tidak ada: {nama}")
        h.update(berkas.read_bytes())
    versi = h.hexdigest()[:10]

    inti = "[\n  " + ",\n  ".join(f"'{u}'" for u in INTI) + ",\n]"
    (AKAR / "sw.js").write_text(TEMPLATE.format(versi=versi, inti=inti), encoding="utf-8")
    print(f"  sw.js  cache dh-{versi}  ({len(INTI)} berkas di-precache)")


if __name__ == "__main__":
    main()
