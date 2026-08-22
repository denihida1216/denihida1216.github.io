# denihida1216.github.io

Website portofolio pribadi **Deni Hidayat** — fullstack developer &
infrastructure engineer. Live di <https://denihida1216.github.io>.

Halaman tunggal, dwibahasa (Indonesia/Inggris), dengan tema gelap &
terang, animasi reveal, dan parallax. Semua aset — CSS, JavaScript, font,
gambar — disimpan lokal di `assets/`, jadi halaman tidak memuat apa pun
dari domain luar.

## Isi repo

```
index.html            halaman (markup + data-i18n, tanpa CSS/JS inline)
assets/css/site.css   hasil build Tailwind + token tema (jangan diedit langsung)
assets/css/fonts.css  @font-face untuk font lokal
assets/js/app.js      i18n, toggle tema, parallax, reveal-on-scroll
assets/js/anime.min.js  anime.js (MIT), disalin lokal
assets/fonts/         Space Grotesk, Inter, JetBrains Mono (woff2, subset latin)
assets/img/           semua gambar, format .webp saja
assets/img/icons/     logo teknologi (webp lossless, 80x80)
build/src/input.css   sumber Tailwind + token tema
build/tailwind.config.js  konfigurasi Tailwind
build/src/img/        foto asli resolusi penuh (sumber turunan webp)
build/scripts/        validator statis + uji browser
```

## Melihat hasilnya di lokal

Jalankan lewat server kecil, jangan klik-ganda `index.html`. Dibuka
sebagai `file://`, Chrome memblokir font lokal karena aturan CORS dan
halaman tampil dengan font sistem — bukan bug situsnya.

```bash
python3 -m http.server 8000
# lalu buka http://localhost:8000
```

## Mengedit

- **Teks** — ubah di `index.html` (versi Indonesia) *dan* di kamus `DICT`
  pada `assets/js/app.js` (kunci `id` dan `en`). Keduanya harus sinkron.
- **Gaya** — jangan sunting `assets/css/site.css`; sunting
  `build/src/input.css` atau `build/tailwind.config.js`, lalu build ulang.

```bash
cd build && npm install
npm run build     # tulis ulang assets/css/site.css
npm run watch     # build otomatis saat mengedit
npm run check     # validator statis (61 pemeriksaan)
npm run test      # uji perilaku di browser (Playwright)
```

Selama hanya mengubah teks atau kelas Tailwind yang sudah dipakai, tidak
perlu build ulang. Kelas Tailwind **baru** butuh `npm run build`.

## Deploy

Push ke branch `main`. GitHub Pages menyajikan langsung dari root; file
`.nojekyll` mematikan pemrosesan Jekyll.

## Catatan

Isi `build/` ikut di-commit karena itulah satu-satunya cara membangun
ulang `assets/css/site.css`. GitHub Pages menyajikan seluruh isi repo,
jadi folder itu tetap terjangkau lewat URL — jangan menaruh apa pun yang
bersifat rahasia di dalamnya.
