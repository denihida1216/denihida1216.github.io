/* Uji perilaku website portofolio di browser sungguhan (Playwright).
 *
 *   node scripts/test_site.mjs /path/ke/folder-situs
 *
 * Skrip menyalakan server statis sendiri di port acak — penting, karena
 * membuka lewat file:// membuat font lokal diblokir CORS dan hasilnya
 * false alarm. Butuh paket `playwright` terpasang (mis. di folder build/).
 * Exit code 0 = semua lulus.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

/* Skrip ini hidup di dalam folder skill, sementara `playwright` biasanya
   terpasang di build/ milik proyek. Cari modulnya dari cwd dulu, baru
   jatuh ke resolusi normal. */
function loadPlaywright(root) {
  const candidates = [
    path.join(process.cwd(), 'noop.js'),
    path.join(root, 'build', 'noop.js'),
    path.join(root, 'noop.js'),
    import.meta.filename,
  ];
  for (const from of candidates) {
    try {
      return createRequire(from)('playwright');
    } catch { /* coba lokasi berikutnya */ }
  }
  throw new Error('playwright tidak ditemukan — jalankan `npm install` di folder build/');
}

const ROOT = path.resolve(process.argv[2] || '.');
const { chromium } = loadPlaywright(ROOT);
const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

let fails = 0;
const ok = (name, cond, extra = '') => {
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${cond ? '' : ' -> ' + extra}`);
  if (!cond) fails++;
};

const b = await chromium.launch();
const errs = [];
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(900);

ok('tidak ada error console/page', errs.length === 0, errs.join(' | '));
ok('pustaka animasi termuat', await p.evaluate(() => typeof window.anime === 'function'));

// --- bahasa -----------------------------------------------------------------
ok('hero default Bahasa Indonesia', /Halo, saya/.test(await p.locator('h1').innerText()));
ok('lang=id', (await p.evaluate(() => document.documentElement.lang)) === 'id');

await p.click('#lang-toggle'); await p.waitForTimeout(250);
ok('toggle EN mengubah hero', /Hi, I'm/.test(await p.locator('h1').innerText()));
ok('lang=en', (await p.evaluate(() => document.documentElement.lang)) === 'en');
ok('navbar ikut EN', (await p.locator('#nav-links a').first().innerText()) === 'About');
ok('pilihan bahasa tersimpan', (await p.evaluate(() => localStorage.getItem('dh-lang'))) === 'en');
await p.click('#lang-toggle'); await p.waitForTimeout(200);
ok('toggle balik ke ID', /Halo, saya/.test(await p.locator('h1').innerText()));

// --- tema -------------------------------------------------------------------
const th1 = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
const bg1 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
await p.click('#theme-toggle'); await p.waitForTimeout(300);
const th2 = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
const bg2 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
ok('toggle tema mengubah latar', bg1 !== bg2, `${bg1} -> ${bg2}`);
ok('data-theme terbalik', th1 !== th2 && ['light', 'dark'].includes(th2), `${th1} -> ${th2}`);
ok('pilihan tema tersimpan', (await p.evaluate(() => localStorage.getItem('dh-theme'))) === th2);
await p.click('#theme-toggle'); await p.waitForTimeout(200);

// --- motion & parallax ------------------------------------------------------
await p.evaluate(() => document.getElementById('keahlian').scrollIntoView());
await p.waitForTimeout(2000);
const op = await p.evaluate(() =>
  [...document.querySelectorAll('#keahlian .reveal')].map((e) => parseFloat(getComputedStyle(e).opacity)));
ok('elemen reveal tampil setelah scroll', op.length > 0 && op.every((o) => o > 0.95), JSON.stringify(op));

// reveal main lagi saat scroll balik ke atas
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(900);
const resetOp = await p.evaluate(() =>
  [...document.querySelectorAll('#keahlian .reveal')].map((e) => parseFloat(getComputedStyle(e).opacity)));
ok('elemen di-reset saat keluar viewport', resetOp.every((o) => o < 0.1), JSON.stringify(resetOp));

await p.evaluate(() => document.getElementById('keahlian').scrollIntoView());
await p.waitForTimeout(1200);
const againOp = await p.evaluate(() =>
  [...document.querySelectorAll('#keahlian .reveal')].map((e) => parseFloat(getComputedStyle(e).opacity)));
ok('reveal main lagi saat scroll balik ke atas', againOp.every((o) => o > 0.95), JSON.stringify(againOp));

const t0 = await p.evaluate(() => { window.scrollTo(0, 0); return document.querySelector('#beranda [data-parallax]').style.transform; });
await p.evaluate(() => window.scrollTo(0, 600)); await p.waitForTimeout(400);
const t1 = await p.evaluate(() => document.querySelector('#beranda [data-parallax]').style.transform);
ok('parallax bergerak saat scroll', t0 !== t1, `${t0} -> ${t1}`);

ok('navbar jadi solid saat scroll', await p.evaluate(() => document.getElementById('nav-shell').classList.contains('backdrop-blur-xl')));
ok('scrollspy menandai section aktif', await p.evaluate(() => !!document.querySelector('#nav-links a[aria-current="true"]')));

// --- gambar -----------------------------------------------------------------
const photo = await p.evaluate(() => {
  const img = document.querySelector('#beranda img');
  if (!img) return null;
  return { w: img.naturalWidth, src: img.currentSrc, alt: img.alt };
});
ok('foto profil termuat di hero', !!photo && photo.w > 0, JSON.stringify(photo));
ok('foto profil disajikan sebagai webp', !!photo && /\.webp$/.test(photo.src), photo && photo.src);
ok('foto profil punya alt', !!photo && photo.alt.length > 0);

// foto profil ikut parallax saat scroll turun DAN naik
const shot = (y) => p.evaluate(async (yy) => {
  window.scrollTo(0, yy);
  await new Promise((r) => setTimeout(r, 350));
  const el = document.querySelector('#beranda [data-parallax]');
  const m = /translate3d\([^,]+,\s*(-?[\d.]+)px/.exec(el.style.transform || '');
  return m ? parseFloat(m[1]) : null;
}, y);
const pTop = await shot(0), pMid = await shot(400), pBack = await shot(0);
ok('foto profil bergeser saat scroll turun', pTop !== null && pMid !== null && Math.abs(pMid - pTop) > 20,
  `${pTop} -> ${pMid}`);
// Toleransinya longgar: komponen parallax kursor ikut menyumbang beberapa
// piksel dan nilainya masih ter-easing saat diukur.
ok('pergeseran kembali saat scroll naik',
  pBack !== null && Math.abs(pBack - pTop) < Math.abs(pMid - pTop) / 3,
  `turun ke ${pMid}, kembali ke ${pBack} (awal ${pTop})`);

// elemen .reveal tidak boleh memikul parallax: transform-nya milik anime.js
ok('parallax tidak menempel di elemen .reveal',
  await p.evaluate(() => !document.querySelector('.reveal[data-parallax], .reveal[data-parallax-mouse]')),
  'pindahkan data-parallax ke elemen di dalam .reveal');
await p.click('#lang-toggle'); await p.waitForTimeout(250);
ok('alt foto ikut ganti bahasa', await p.evaluate(() => /Photo of/.test(document.querySelector('#beranda img').alt)));
await p.click('#lang-toggle'); await p.waitForTimeout(250);

const fav = await p.evaluate(() => {
  const l = document.querySelector('link[rel="icon"]');
  return l ? l.getAttribute('href') : null;
});
ok('favicon memakai berkas gambar webp (foto profil)', !!fav && /favicon-\d+\.webp$/.test(fav), String(fav));

const nonWebp = await p.evaluate(() =>
  performance.getEntriesByType('resource')
    .filter((r) => r.initiatorType === 'img' || /\.(png|jpe?g|gif)$/.test(r.name))
    .map((r) => r.name)
    .filter((n) => !/\.webp$/.test(n)));
ok('tidak ada gambar non-webp yang diunduh', nonWebp.length === 0, nonWebp.join(' | '));

// --- efek asap di hero ------------------------------------------------------
const smokePixels = async (page) => page.evaluate(() => {
  const c = document.getElementById('smoke');
  if (!c) return -1;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 4) n++;
  return n;
});
const sweepHero = async (page) => {
  const pts = [[300, 700], [480, 640], [660, 580], [840, 520], [1000, 470], [1120, 430]];
  for (const [x, y] of pts) { await page.mouse.move(x, y); await page.waitForTimeout(40); }
  for (const [x, y] of pts.reverse()) { await page.mouse.move(x - 40, y - 90); await page.waitForTimeout(40); }
};

ok('kanvas asap ada di hero', await p.evaluate(() => !!document.querySelector('#beranda #smoke')));
ok('kanvas asap disembunyikan dari screen reader',
  await p.evaluate(() => !!document.getElementById('smoke').closest('[aria-hidden="true"]')));
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
ok('kanvas asap kosong sebelum kursor bergerak', (await smokePixels(p)) === 0);
await sweepHero(p);
await p.waitForTimeout(250);
const smoked = await smokePixels(p);
ok('asap muncul saat kursor bergerak di hero', smoked > 500, `piksel: ${smoked}`);
// Loop rAF harus berhenti sendiri: semua kepulan habis, kanvas bersih lagi.
await p.waitForTimeout(6000);
const settled = await smokePixels(p);
ok('asap habis sendiri dan loop berhenti', settled === 0, `sisa piksel: ${settled}`);

// Regresi: dulu mengganti tema saat kepulan masih hidup membuat frame()
// melempar (tekstur di-null-kan) sehingga asap mati permanen.
await sweepHero(p);
await p.waitForTimeout(300);
await p.click('#theme-toggle');
await p.waitForTimeout(400);
await sweepHero(p);
await p.waitForTimeout(250);
const afterToggle = await smokePixels(p);
ok('asap tetap hidup setelah tema diganti', afterToggle > 500, `piksel: ${afterToggle}`);
await p.click('#theme-toggle');
await p.waitForTimeout(300);

ok('asap tidak menghalangi tombol hero', await p.evaluate(() => {
  const cta = document.querySelector('#beranda a[href="#kontak"]');
  const r = cta.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return cta.contains(top) || top === cta;
}));

// --- daftar teknologi -------------------------------------------------------
await p.evaluate(() => document.getElementById('keahlian').scrollIntoView());
await p.waitForTimeout(1500);

const tech = await p.evaluate(() => {
  const items = [...document.querySelectorAll('.badge')];
  return {
    jumlah: items.length,
    terlihat: items.filter((li) => li.getBoundingClientRect().width > 0).length,
    gagal: items.filter((li) => !li.querySelector('img').naturalWidth).length,
    nonWebp: items.filter((li) => !/\.webp$/.test(li.querySelector('img').getAttribute('src'))).length,
    labelMenyimpang: items.filter((li) => {
      const label = li.querySelector('.badge-label');
      return !label || label.textContent.trim() !== li.querySelector('img').alt;
    }).length,
    terpotong: items.filter((li) => {
      const label = li.querySelector('.badge-label');
      return label.scrollWidth > label.clientWidth + 1;
    }).length,
    ikonPx: Math.round(items[0].querySelector('img').getBoundingClientRect().width),
    duplikat: new Set(items.map((li) => li.querySelector('img').alt)).size !== items.length,
  };
});
ok('semua teknologi tampil sekaligus', tech.jumlah >= 15 && tech.terlihat === tech.jumlah,
  JSON.stringify({ jumlah: tech.jumlah, terlihat: tech.terlihat }));
ok('tidak ada teknologi yang tampil dobel', !tech.duplikat);
ok('semua ikon teknologi termuat', tech.gagal === 0, `gagal: ${tech.gagal}`);
ok('semua ikon teknologi webp', tech.nonWebp === 0);
ok('label terlihat dan sama dengan alt gambar', tech.labelMenyimpang === 0, `menyimpang: ${tech.labelMenyimpang}`);
ok('tidak ada label yang terpotong', tech.terpotong === 0, `terpotong: ${tech.terpotong}`);
ok('ikon berukuran 40px', tech.ikonPx === 40, String(tech.ikonPx));
ok('desktop: nama teknologi terlihat',
  await p.evaluate(() => getComputedStyle(document.querySelector('.badge-label')).display !== 'none'));
ok('desktop: tombol tidak dipaksa selebar layar', await p.evaluate(() =>
  [...document.querySelectorAll('#beranda .btn, #kontak .btn')].every((a) =>
    a.getBoundingClientRect().width < a.parentElement.getBoundingClientRect().width * 0.6)));
ok('daftar teknologi tidak beranimasi jalan',
  await p.evaluate(() => !document.querySelector('.marquee, .marquee-track')));
ok('section keahlian hanya berisi judul + daftar, tanpa kartu pilar',
  await p.evaluate(() => document.querySelectorAll('#keahlian article').length === 0));

// Kartu cara kerja sengaja tanpa nomor urut — pastikan tidak ada sisa
// elemen kosong dari versi bernomor.
ok('kartu cara kerja mulai langsung dari judulnya', await p.evaluate(() => {
  const cards = [...document.querySelectorAll('#cara-kerja .card')];
  return cards.length === 4 && cards.every((c) => c.firstElementChild.tagName === 'H3');
}));

// Kartu harus benar-benar terlihat terhadap latarnya di KEDUA tema.
ok('kartu terpisah jelas dari latar di kedua tema', await p.evaluate(() => {
  const lum = (c) => {
    const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number)
      .map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = () => {
    const a = lum(getComputedStyle(document.querySelector('.badge')).backgroundColor);
    const b = lum(getComputedStyle(document.body).backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const root = document.documentElement;
  const asal = root.getAttribute('data-theme');
  root.setAttribute('data-theme', 'dark');
  const gelap = ratio();
  root.setAttribute('data-theme', 'light');
  const terang = ratio();
  root.setAttribute('data-theme', asal);
  return gelap > 1.2 && terang > 1.03;
}));
ok('tile teknologi ikut tema', await p.evaluate(() => {
  const bg = () => getComputedStyle(document.querySelector('.badge')).backgroundColor;
  const before = bg();
  const flip = () => document.documentElement.setAttribute('data-theme',
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  flip();
  const after = bg();
  flip();
  return before !== after;
}));

// --- gambar tidak bisa diseret / dibuka lewat klik kanan --------------------
ok('semua gambar draggable=false',
  await p.evaluate(() => [...document.querySelectorAll('img')].every((i) => i.getAttribute('draggable') === 'false')));
ok('klik kanan di gambar dicegah', await p.evaluate(() => {
  const img = document.querySelector('.badge img');
  const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  img.dispatchEvent(ev);
  return ev.defaultPrevented;
}));
ok('klik kanan di luar gambar tetap normal', await p.evaluate(() => {
  const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  document.querySelector('h1').dispatchEvent(ev);
  return !ev.defaultPrevented;
}));

// --- responsif --------------------------------------------------------------
for (const w of [360, 414, 768, 1024, 1440]) {
  const m = await b.newPage({ viewport: { width: w, height: 800 } });
  await m.goto(url, { waitUntil: 'networkidle' }); await m.waitForTimeout(600);
  const over = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`tidak scroll horizontal @${w}px`, over <= 0, `overflow ${over}px`);
  if (w === 360) {
    await m.evaluate(() => document.getElementById('keahlian').scrollIntoView());
    await m.waitForTimeout(1500);
    const mob = await m.evaluate(() => {
      const li = [...document.querySelectorAll('.badge')];
      const rows = {};
      li.forEach((x) => { const t = Math.round(x.getBoundingClientRect().top); rows[t] = (rows[t] || 0) + 1; });
      return {
        perBaris: [...new Set(Object.values(rows))],
        labelTampil: getComputedStyle(document.querySelector('.badge-label')).display !== 'none',
        ikonPx: Math.round(li[0].querySelector('img').getBoundingClientRect().width),
      };
    });
    ok('ponsel: 4 kartu teknologi per baris',
      mob.perBaris.length === 1 && mob.perBaris[0] === 4, JSON.stringify(mob.perBaris));
    ok('ponsel: kartu teknologi hanya logo, nama disembunyikan', mob.labelTampil === false);
    ok('ponsel: logo tetap 40px', mob.ikonPx === 40, String(mob.ikonPx));

    const tombol = await m.evaluate(() => {
      const penuh = (sel) => {
        const btns = [...document.querySelectorAll(sel)];
        return btns.length > 0 && btns.every((a) =>
          Math.abs(a.getBoundingClientRect().width - a.parentElement.getBoundingClientRect().width) < 2);
      };
      const kontak = [...document.querySelectorAll('#kontak .btn')];
      const baris = {};
      kontak.forEach((a) => { const t = Math.round(a.getBoundingClientRect().top); baris[t] = (baris[t] || 0) + 1; });
      const lebar = kontak.map((a) => Math.round(a.getBoundingClientRect().width));
      return {
        hero: penuh('#beranda .btn'),
        kontakPerBaris: [...new Set(Object.values(baris))],
        jumlahKontak: kontak.length,
        kontakSamaLebar: new Set(lebar).size === 1,
        kontakTerpotong: kontak.filter((a) => a.scrollWidth > a.clientWidth + 1).length,
      };
    });
    ok('ponsel: tombol CTA hero selebar layar', tombol.hero);
    ok('ponsel: tombol kontak dua per baris',
      tombol.jumlahKontak === 4 && tombol.kontakPerBaris.length === 1 && tombol.kontakPerBaris[0] === 2,
      JSON.stringify(tombol.kontakPerBaris));
    ok('ponsel: keempat tombol kontak sama lebar dan tidak terpotong',
      tombol.kontakSamaLebar && tombol.kontakTerpotong === 0, JSON.stringify(tombol));

    await m.evaluate(() => window.scrollTo(0, 0));
    await m.waitForTimeout(400);
    await m.click('#menu-toggle'); await m.waitForTimeout(250);
    ok('menu mobile terbuka @360px', await m.locator('#mobile-menu').isVisible());
    await m.click('#mobile-menu a[href="#keahlian"]'); await m.waitForTimeout(400);
    ok('menu mobile tertutup setelah klik', !(await m.locator('#mobile-menu').isVisible()));
  }
  await m.close();
}

// --- degradasi yang anggun --------------------------------------------------
const rp = await b.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
await rp.goto(url, { waitUntil: 'networkidle' }); await rp.waitForTimeout(500);
ok('reduced-motion: semua konten langsung tampil',
  await rp.evaluate(() => [...document.querySelectorAll('.reveal')].every((e) => parseFloat(getComputedStyle(e).opacity) > 0.95)));
await sweepHero(rp);
await rp.waitForTimeout(250);
ok('reduced-motion: asap tidak digambar sama sekali', (await smokePixels(rp)) === 0);
await rp.evaluate(() => document.getElementById('keahlian').scrollIntoView());
await rp.waitForTimeout(500);
ok('reduced-motion: semua teknologi tetap tampil', await rp.evaluate(() =>
  [...document.querySelectorAll('.badge')].every((li) => li.getBoundingClientRect().width > 0)));
await rp.close();

const nj = await b.newPage({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
await nj.goto(url, { waitUntil: 'load' }); await nj.waitForTimeout(300);
ok('tanpa JS konten tetap tampil',
  await nj.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#keahlian .reveal')).opacity) > 0.95));
await nj.close();

// --- anchor saat halaman dimuat & tombol kembali ke atas ---------------------
const hp = await b.newPage({ viewport: { width: 1440, height: 900 } });
await hp.goto(url, { waitUntil: 'networkidle' });
await hp.waitForTimeout(700);
await hp.click('#nav-links a[href="#cara-kerja"]');
await hp.waitForTimeout(1300);
await hp.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await hp.waitForTimeout(400);

// Regresi: browser memulihkan posisi scroll saat refresh dan itu
// mengalahkan anchor di URL — halaman harus tetap mendarat di section.
await hp.reload({ waitUntil: 'networkidle' });
await hp.waitForTimeout(1400);
const landed = await hp.evaluate(() => {
  const el = document.getElementById('cara-kerja');
  return { y: Math.round(window.scrollY), top: Math.round(el.getBoundingClientRect().top + window.scrollY) };
});
ok('refresh dengan #anchor tetap mendarat di section-nya',
  Math.abs(landed.top - landed.y) < 120 && landed.y > 200, JSON.stringify(landed));

const atTop = await hp.evaluate(() => {
  window.scrollTo({ top: 0, behavior: 'instant' });
  return new Promise((r) => setTimeout(() => r(document.getElementById('to-top').classList.contains('is-visible')), 300));
});
ok('tombol kembali ke atas tersembunyi di puncak', atTop === false);

await hp.evaluate(() => window.scrollTo({ top: 1400, behavior: 'instant' }));
await hp.waitForTimeout(400);
const shown = await hp.evaluate(() => {
  const t = document.getElementById('to-top');
  return { kelas: t.classList.contains('is-visible'), pointer: getComputedStyle(t).pointerEvents };
});
ok('tombol kembali ke atas muncul setelah scroll', shown.kelas && shown.pointer === 'auto', JSON.stringify(shown));

await hp.click('#to-top');
await hp.waitForTimeout(1200);
ok('klik tombol membawa ke puncak', (await hp.evaluate(() => Math.round(window.scrollY))) === 0);
ok('hash lama dibersihkan setelah ke puncak',
  (await hp.evaluate(() => location.hash)) === '',
  await hp.evaluate(() => location.hash));

// Anchor bertahan selama berada di section, dan dilepas begitu pembaca
// kembali ke hero — termasuk lewat scroll biasa, bukan hanya tombol.
await hp.click('#nav-links a[href="#kontak"]');
await hp.waitForTimeout(1600);
ok('anchor bertahan saat berada di section', (await hp.evaluate(() => location.hash)) === '#kontak',
  await hp.evaluate(() => location.hash));
await hp.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await hp.waitForTimeout(900);
ok('anchor dilepas saat scroll kembali ke hero', (await hp.evaluate(() => location.hash)) === '',
  await hp.evaluate(() => location.hash));

await hp.click('#lang-toggle');
await hp.waitForTimeout(250);
ok('label tombol ke atas ikut ganti bahasa', await hp.evaluate(() => {
  const t = document.getElementById('to-top');
  return /Back to top/.test(t.getAttribute('aria-label')) && t.getAttribute('title') === t.getAttribute('aria-label');
}));
await hp.close();

// buka langsung dengan anchor, tanpa riwayat sebelumnya
const dp = await b.newPage({ viewport: { width: 1440, height: 900 } });
await dp.goto(url + '#keahlian', { waitUntil: 'networkidle' });
await dp.waitForTimeout(1300);
const direct = await dp.evaluate(() => {
  const el = document.getElementById('keahlian');
  return { y: Math.round(window.scrollY), top: Math.round(el.getBoundingClientRect().top + window.scrollY) };
});
ok('buka langsung dengan #anchor mendarat di section-nya',
  Math.abs(direct.top - direct.y) < 120 && direct.y > 200, JSON.stringify(direct));
await dp.close();

// --- aset lokal -------------------------------------------------------------
const p2 = await b.newPage();
const origin = new URL(url).origin;
const external = [], failedReq = [];
p2.on('request', (r) => { if (!r.url().startsWith(origin)) external.push(r.url()); });
p2.on('requestfailed', (r) => failedReq.push(r.url()));
await p2.goto(url, { waitUntil: 'networkidle' }); await p2.waitForTimeout(500);
ok('tidak ada request ke domain luar', external.length === 0, external.join(' | '));
ok('semua aset lokal termuat', failedReq.length === 0, failedReq.join(' | '));
await p2.close();

await b.close();
server.close();
console.log(`\n${fails === 0 ? 'SEMUA LULUS' : fails + ' GAGAL'}`);
process.exit(fails ? 1 : 0);
