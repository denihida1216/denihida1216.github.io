/* Render gambar preview (og:image) untuk tiap bahasa.
 *
 *   node scripts/make-og.mjs
 *
 * Menghasilkan assets/img/og-cover.webp (EN) dan og-cover-id.webp (ID).
 * Teks ter-bake di dalam gambar, jadi tidak bisa diterjemahkan runtime —
 * satu berkas per bahasa, dan tiap halaman menunjuk berkasnya sendiri.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/x.js')('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const FONT = `file://${ROOT}/assets/fonts`;
const FOTO = 'data:image/jpeg;base64,' +
  fs.readFileSync(path.join(ROOT, 'build/src/img/profil.jpg')).toString('base64');
const IKON = 'data:image/webp;base64,' +
  fs.readFileSync(path.join(ROOT, 'assets/img/favicon-180.webp')).toString('base64');

const TEKS = {
  en: {
    berkas: 'og-cover.webp',
    eyebrow: 'Fullstack &amp; Infrastructure',
    judul: 'Deni Hidayat',
    gradien: 'from code to production.',
    ringkas: 'Web &amp; mobile apps, servers and Docker, down to application security — handled as one whole job.',
  },
  id: {
    berkas: 'og-cover-id.webp',
    eyebrow: 'Fullstack &amp; Infrastructure',
    judul: 'Deni Hidayat',
    gradien: 'dari kode sampai produksi.',
    ringkas: 'Aplikasi web &amp; mobile, server dan Docker, sampai keamanan aplikasi — dikerjakan sebagai satu pekerjaan yang utuh.',
  },
};

const halaman = (t) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Space Grotesk';src:url('${FONT}/SpaceGrotesk-var.woff2') format('woff2');font-weight:300 700}
@font-face{font-family:'Inter';src:url('${FONT}/Inter-var.woff2') format('woff2');font-weight:100 900}
@font-face{font-family:'JetBrains Mono';src:url('${FONT}/JetBrainsMono-var.woff2') format('woff2');font-weight:100 800}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0b1220;color:#e2e8f0;font-family:Inter,sans-serif;position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(226,232,240,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(226,232,240,.09) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:radial-gradient(ellipse 75% 70% at 28% 45%,#000 30%,transparent 100%)}
.glow{position:absolute;border-radius:50%;filter:blur(90px)}
.g1{width:600px;height:600px;left:-180px;top:-160px;background:radial-gradient(circle,rgba(56,189,248,.26),transparent 68%)}
.g2{width:700px;height:700px;right:-200px;bottom:-260px;background:radial-gradient(circle,rgba(129,140,248,.30),transparent 68%)}
.wrap{position:relative;height:100%;display:grid;grid-template-columns:1fr auto;align-items:center;gap:64px;padding:72px 84px}
.badge{display:inline-flex;align-items:center;gap:14px;margin-bottom:32px}
.ikon{width:56px;height:56px;border-radius:50%;padding:2px;background:linear-gradient(135deg,#38bdf8,#818cf8);flex:none}
.ikon img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;border:2px solid #0b1220}
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:16px;letter-spacing:.24em;text-transform:uppercase;color:#38bdf8}
h1{font-family:'Space Grotesk',sans-serif;font-size:76px;font-weight:700;line-height:1.05;letter-spacing:-.03em}
.grad{background:linear-gradient(120deg,#38bdf8,#818cf8);-webkit-background-clip:text;color:transparent}
p{margin-top:24px;font-size:23px;line-height:1.55;color:#94a3b8;max-width:580px}
.foot{margin-top:34px;padding-top:22px;border-top:1px solid rgba(226,232,240,.12);display:flex;gap:28px;white-space:nowrap;font-family:'JetBrains Mono',monospace;font-size:16px;color:#64748b}
.ring{width:340px;height:340px;border-radius:50%;padding:6px;background:linear-gradient(135deg,#38bdf8,#818cf8);box-shadow:0 30px 80px -30px rgba(56,189,248,.55)}
.ring img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;border:6px solid #0b1220}
.bar{position:absolute;left:0;right:0;bottom:0;height:8px;background:linear-gradient(90deg,#38bdf8,#818cf8)}
</style>
<div class="grid"></div><div class="glow g1"></div><div class="glow g2"></div>
<div class="wrap">
  <div>
    <div class="badge"><div class="ikon"><img src="${IKON}" alt=""></div><div class="eyebrow">${t.eyebrow}</div></div>
    <h1>${t.judul}<br><span class="grad">${t.gradien}</span></h1>
    <p>${t.ringkas}</p>
    <div class="foot"><span>denihida1216.github.io</span><span>TypeScript · Go · Python · Docker</span></div>
  </div>
  <div class="ring"><img src="${FOTO}" alt=""></div>
</div>
<div class="bar"></div>`;

const b = await chromium.launch();
for (const [lang, t] of Object.entries(TEKS)) {
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(halaman(t));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  const fotoOk = await p.evaluate(() => {
    return [...document.images].every((i) => i.naturalWidth > 0);
  });
  if (!fotoOk) throw new Error('ada gambar yang tidak termuat di cover — render dibatalkan');
  const tujuan = path.join(ROOT, 'assets/img', t.berkas);
  await p.screenshot({ path: '/tmp/og-tmp.png' });
  await p.close();
  // Chromium tidak menulis webp lewat screenshot, jadi konversi terpisah.
  fs.copyFileSync('/tmp/og-tmp.png', `/tmp/og-${lang}.png`);
  console.log(`  ${lang}: /tmp/og-${lang}.png -> ${path.relative(ROOT, tujuan)}`);
}
await b.close();
