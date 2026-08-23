#!/usr/bin/env python3
"""Validator otomatis untuk website portofolio Deni Hidayat.

Pakai: python scripts/check_site.py path/ke/index.html

Situs ini bukan lagi satu file: `index.html` memuat aset lokal di
`assets/` (CSS hasil build Tailwind, font, anime.js, app.js). Validator
menelusuri semua aset lokal yang direferensikan, lalu memeriksa aturan
yang dibakukan di SKILL.md terhadap gabungan isinya.

Exit code 0 = semua lulus, 1 = ada yang gagal.
Jalankan SELALU setelah membangun/merevisi website, sebelum deploy.
"""

import re
import sys
from pathlib import Path

MAX_HTML_KB = 60       # index.html saja
MAX_CODE_KB = 120      # html + css + js (tanpa font & gambar)
MAX_PAYLOAD_KB = 320   # yang benar-benar diunduh pengunjung modern
MAX_PREVIEW_KB = 400   # og:image — hanya diambil scraper, bukan pengunjung


def collect_assets(html: str, base: Path) -> tuple[list[Path], list[str]]:
    """Kumpulkan aset yang DIMUAT halaman (bukan tautan <a href>).

    Yang dihitung: <link>, <script src>, <img src>, <source src|srcset>,
    <video poster>, dan url(...) di dalam CSS. Tautan keluar di <a href>
    sengaja diabaikan — itu navigasi, bukan aset.
    """
    tags = re.findall(
        r'<(?:link|script|img|source|video|audio|embed)\b[^>]*>', html, flags=re.I
    )
    # rel yang bukan pemuatan aset — jangan dianggap dependency.
    NON_ASSET_REL = ("canonical", "alternate", "me", "author", "license", "next", "prev")

    refs: list[str] = []
    for tag in tags:
        rel = re.search(r'rel\s*=\s*["\']([^"\']+)["\']', tag, flags=re.I)
        if rel and rel.group(1).strip().lower() in NON_ASSET_REL:
            continue
        for attr in ("href", "src", "poster"):
            m = re.search(attr + r'\s*=\s*["\']([^"\']+)["\']', tag, flags=re.I)
            if m:
                refs.append(m.group(1))
        m = re.search(r'srcset\s*=\s*["\']([^"\']+)["\']', tag, flags=re.I)
        if m:
            refs += [c.strip().split(" ")[0] for c in m.group(1).split(",") if c.strip()]

    # og:image / twitter:image boleh absolut ke domain sendiri, tapi
    # file-nya tetap harus ada di repo.
    for m in re.finditer(r'<meta[^>]+(?:og:image|twitter:image)["\'][^>]*content=["\']([^"\']+)["\']', html, flags=re.I):
        url = m.group(1)
        if url.startswith("https://denihida1216.github.io/"):
            refs.append(url[len("https://denihida1216.github.io/"):])
        else:
            refs.append(url)

    local: list[Path] = []
    external: list[str] = []
    seen: set[Path] = set()

    def add(ref: str, origin: Path) -> None:
        ref = ref.split("?")[0].split("#")[0]
        if not ref or ref.startswith(("#", "data:", "mailto:", "tel:")):
            return
        if ref.startswith(("http://", "https://", "//")):
            external.append(ref)
            return
        # Path absolut ("/sitemap.xml") relatif terhadap root situs,
        # bukan terhadap folder berkas yang merujuknya.
        if ref.startswith("/"):
            p = (base.parent / ref.lstrip("/")).resolve()
        else:
            p = (origin.parent / ref).resolve()
        if p in seen:
            return
        seen.add(p)
        local.append(p)
        if p.exists() and p.suffix == ".css":
            css = p.read_text(encoding="utf-8", errors="ignore")
            for u in re.findall(r'url\(\s*["\']?([^"\')]+)["\']?\s*\)', css):
                add(u, p)

    for ref in refs:
        add(ref, base)
    return local, external


def main() -> int:
    if len(sys.argv) < 2:
        print("Pakai: python scripts/check_site.py path/ke/index.html")
        return 1

    path = Path(sys.argv[1]).resolve()
    if not path.exists():
        print(f"GAGAL: file tidak ditemukan: {path}")
        return 1

    html = path.read_text(encoding="utf-8")
    assets, external = collect_assets(html, path)
    missing = [a for a in assets if not a.exists()]

    def resolve(ref: str) -> Path:
        ref = ref.split("?")[0].split("#")[0]
        ref = ref.replace("https://denihida1216.github.io/", "")
        return (path.parent / ref).resolve()

    # Aset yang TIDAK ikut dihitung sebagai payload pengunjung:
    #  - og:image / twitter:image → hanya diambil scraper saat di-share
    #  - apple-touch-icon        → hanya iOS saat "Add to Home Screen"
    preview = {resolve(m.group(1)) for m in re.finditer(
        r'<meta[^>]+(?:og:image|twitter:image)["\'][^>]*content=["\']([^"\']+)["\']', html, re.I)}
    touch = {resolve(m.group(1)) for m in re.finditer(
        r'<link[^>]+rel=["\']apple-touch-icon["\'][^>]*href=["\']([^"\']+)["\']', html, re.I)}
    excluded = preview | touch

    # Gabungan kode: html + seluruh aset teks (css/js) yang dimuat.
    code_files = [a for a in assets if a.exists() and a.suffix in (".css", ".js")]
    bundle = html + "\n" + "\n".join(a.read_text(encoding="utf-8", errors="ignore") for a in code_files)

    def rel(target: Path, root: Path) -> str:
        try:
            return str(target.relative_to(root))
        except ValueError:
            return str(target)

    checks: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, hint: str = "") -> None:
        checks.append((name, ok, hint))

    # --- Aset lokal ---------------------------------------------------------
    check(
        "Semua aset yang direferensikan ada di lokal",
        not missing,
        "hilang: " + ", ".join(rel(m, path.parent) for m in missing) if missing else "",
    )
    check(
        "Tidak ada aset dari domain luar (CDN/Google Fonts)",
        not external,
        f"eksternal: {sorted(set(external))[:5]}" if external else "",
    )
    check(
        "CSS hasil build Tailwind ada",
        any(a.name == "site.css" and a.exists() for a in assets),
        "jalankan build Tailwind ke assets/css/site.css",
    )
    check(
        "Font dimuat dari assets/fonts",
        any(a.suffix == ".woff2" for a in assets),
        "font harus lokal (woff2), bukan dari Google Fonts",
    )
    check(
        "Pustaka animasi lokal (anime.js) dimuat",
        any("anime" in a.name for a in assets),
    )

    # --- Placeholder & data diri -------------------------------------------
    leftovers = re.findall(r"\{\{[A-Z0-9_]+\}\}", bundle)
    check(
        "Tidak ada placeholder {{...}} yang bocor",
        not leftovers,
        f"masih ada: {sorted(set(leftovers))}" if leftovers else "",
    )
    check("Nama 'Deni Hidayat' ada di halaman", "Deni Hidayat" in html)
    check(
        "Link email benar",
        "mailto:denihida1216@gmail.com" in html,
        "harus pakai mailto:denihida1216@gmail.com",
    )
    check("Link GitHub benar", "github.com/denihida1216" in html)
    wa = re.search(r"https://wa\.me/(\d+)", html)
    check(
        "Link WhatsApp format wa.me + nomor 62...",
        bool(wa and wa.group(1).startswith("62")),
        "harus https://wa.me/628xxxxxxxxxx (tanpa +, tanpa 0 di depan)",
    )
    check("Link LinkedIn ada", "linkedin.com/" in html)

    # --- Struktur & aksesibilitas ------------------------------------------
    h1_count = len(re.findall(r"<h1[\s>]", html))
    check("Tepat satu <h1>", h1_count == 1, f"ditemukan {h1_count}")
    check(
        "Atribut lang di <html> = en (bahasa default)",
        bool(re.search(r'<html[^>]*\blang="en"', html)),
        "teks default di markup harus Bahasa Inggris",
    )
    check("Meta viewport ada", 'name="viewport"' in html)
    # Anchor mengikuti bahasa halaman (#about di EN, #tentang di ID), jadi
    # namanya tidak dipatok — yang diperiksa: navbar punya empat tautan dan
    # semuanya menunjuk section yang benar-benar ada.
    nav_anchor = re.findall(r'<a href="#([\w-]+)"[^>]*class="nav-link"', html)
    check(
        f"Navbar punya empat anchor section ({len(nav_anchor)})",
        len(nav_anchor) == 4,
        f"ditemukan: {nav_anchor}",
    )
    for anchor in nav_anchor:
        check(
            f"Section #{anchor} ada",
            f'id="{anchor}"' in html,
            "id section harus konsisten dengan navbar",
        )
    check(
        "Hero punya kait data-hero (dipakai JS lintas bahasa)",
        "data-hero" in html,
        "id hero berbeda per bahasa, jadi JS tidak boleh mengandalkan id",
    )
    nav_hrefs = set(re.findall(r'href="#([a-z-]+)"', html))
    check(
        "Semua anchor navbar punya target",
        all(f'id="{h}"' in html for h in nav_hrefs),
        f"anchor tanpa target: {sorted(h for h in nav_hrefs if f'id=\"{h}\"' not in html)}",
    )

    # --- Bilingual: satu halaman per bahasa ----------------------------------
    # Bahasa ditentukan URL, bukan JavaScript: crawler tidak menjalankan JS,
    # jadi satu URL hanya bisa punya satu judul/deskripsi/gambar preview.
    import json as _json

    keys = sorted(set(re.findall(r'data-i18n="([^"]+)"', html)))
    check("Penanda teks bilingual (data-i18n) dipakai", bool(keys))

    kamus_path = path.parent / "build/src/i18n.json"
    check("Kamus dua bahasa ada (build/src/i18n.json)", kamus_path.is_file())
    if kamus_path.is_file():
        _i18n = _json.loads(kamus_path.read_text(encoding="utf-8"))
        kurang = [k for k in keys if k not in _i18n.get("en", {}) or k not in _i18n.get("id", {})]
        check(
            "Setiap kunci data-i18n punya teks ID dan EN",
            not kurang,
            f"kunci kurang terjemahan: {kurang[:8]}" if kurang else "",
        )

    halaman_id = path.parent / "id/index.html"
    check("Halaman versi Indonesia ada (id/index.html)", halaman_id.is_file())
    if halaman_id.is_file():
        html_id = halaman_id.read_text(encoding="utf-8")
        check('Halaman /id/ memakai lang="id"', bool(re.search(r'<html[^>]*lang="id"', html_id)))
        check(
            "Halaman /id/ punya canonical sendiri",
            'rel="canonical" href="https://denihida1216.github.io/id/"' in html_id,
        )
        check(
            "Halaman /id/ memakai gambar preview Indonesia",
            "og-cover-id.webp" in html_id,
            "link yang dibagikan harus membawa gambar sesuai bahasanya",
        )
        check(
            "Aset di /id/ memakai path relatif satu tingkat",
            'href="../assets/' in html_id and 'src="../assets/' in html_id,
        )
        check(
            "Jumlah teks bilingual sama di kedua halaman",
            len(re.findall(r'data-i18n="', html_id)) == len(re.findall(r'data-i18n="', html)),
            "id/index.html digenerate — jalankan `npm run build` setelah mengubah index.html",
        )
        for berkas, nama in ((html, "index.html"), (html_id, "id/index.html")):
            check(
                f"hreflang lengkap di {nama}",
                all(f'hreflang="{h}"' in berkas for h in ("en", "id", "x-default")),
            )

    # --- Tema & motion ------------------------------------------------------
    check(
        "Dark/light theme via data-theme atau prefers-color-scheme",
        "data-theme" in bundle or "prefers-color-scheme" in bundle,
    )
    check(
        "Kedua tema didefinisikan (token :root dan dark)",
        ":root" in bundle and 'data-theme="dark"' in bundle.replace("'", '"'),
    )
    check(
        "localStorage dibungkus try/catch",
        "localStorage" not in bundle or "try" in bundle,
        "akses localStorage bisa throw di beberapa browser/mode",
    )
    check("prefers-reduced-motion dihormati", "prefers-reduced-motion" in bundle)
    check(
        "Parallax dimatikan saat reduced-motion",
        "prefers-reduced-motion" not in bundle
        or "data-parallax" not in bundle
        or bool(re.search(r"prefers-reduced-motion[\s\S]{0,900}?data-parallax", bundle)),
        "blok @media prefers-reduced-motion harus menetralkan transform parallax",
    )
    check(
        "Konten tetap tampil tanpa JS",
        ".js .reveal" in bundle or "no-js" in bundle,
        "elemen reveal hanya boleh disembunyikan kalau JS aktif",
    )

    # --- SEO ----------------------------------------------------------------
    check("<title> ada", "<title>" in html)
    check("Meta description ada", 'name="description"' in html)
    check("Open Graph ada", 'property="og:' in html)
    check("og:image ada dan lokal", bool(re.search(r'property="og:image"[^>]*content="[^"]+"', html)))
    check("JSON-LD Person ada", '"@type"' in html and '"Person"' in html)
    check("theme-color ada", 'name="theme-color"' in html)
    check("Canonical URL ada", 'rel="canonical"' in html)
    check(
        "Meta verifikasi Search Console ada",
        'name="google-site-verification"' in html,
        "jangan hilang saat menulis ulang <head>",
    )
    check("Tautan sitemap ada", 'rel="sitemap"' in html)
    for f_ in ("sitemap.xml", "robots.txt"):
        check(f"{f_} ada di root situs", (path.parent / f_).is_file())

    # --- PWA -----------------------------------------------------------------
    manifest = path.parent / "manifest.webmanifest"
    check("manifest.webmanifest ada", manifest.is_file())
    check('Manifest ditautkan dari <head>', 'rel="manifest"' in html)
    if manifest.is_file():
        m = _json.loads(manifest.read_text(encoding="utf-8"))
        for kunci in ("name", "short_name", "start_url", "display", "theme_color", "background_color"):
            check(f"Manifest punya {kunci}", bool(m.get(kunci)))
        ukuran = {i.get("sizes") for i in m.get("icons", [])}
        check(
            "Manifest punya ikon 192 dan 512",
            {"192x192", "512x512"} <= ukuran,
            "Chrome butuh keduanya supaya situs bisa dipasang",
        )
        check(
            "Ada ikon maskable",
            any("maskable" in (i.get("purpose") or "") for i in m.get("icons", [])),
            "tanpa ini Android memotong ikonnya sembarangan",
        )
        hilang = [i["src"] for i in m.get("icons", [])
                  if not (path.parent / i["src"].lstrip("/")).is_file()]
        check("Semua ikon manifest ada berkasnya", not hilang, str(hilang))

    sw = path.parent / "sw.js"
    check("Service worker ada", sw.is_file())
    if sw.is_file():
        isi_sw = sw.read_text(encoding="utf-8")
        check("Service worker didaftarkan dari app.js", "serviceWorker" in bundle)
        check("Service worker punya handler fetch", "addEventListener('fetch'" in isi_sw)
        check(
            "Nama cache ikut berubah tiap rilis",
            bool(re.search(r"const CACHE = 'dh-[0-9a-f]{6,}'", isi_sw)),
            "cache statis membuat pengunjung tersangkut versi lama",
        )
        check(
            "Cache lama dihapus saat activate",
            "caches.delete" in isi_sw,
        )

    # --- Konten: 3 pilar & teknologi kunci ---------------------------------
    for kw in ("TypeScript", "Python", "Dart", "PostgreSQL", "Redis",
               "RabbitMQ", "Docker", "Proxmox", "Cloudflare", "Nginx", "WAF",
               "PHP-FPM"):
        check(f"Teknologi disebut: {kw}", kw.lower() in html.lower())
    check("Teknologi disebut: Go/Golang", bool(re.search(r"\bGo(lang)?\b", html)))

    # --- Kesehatan struktur HTML --------------------------------------------
    # Menyunting markup dengan cari-ganti gampang menghasilkan dua atribut
    # yang sama pada satu elemen (mis. dua `class`). Browser diam saja dan
    # memakai yang pertama, jadi kesalahannya tidak kelihatan.
    from html.parser import HTMLParser

    class _Struktur(HTMLParser):
        VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
                "link", "meta", "source", "track", "wbr"}

        def __init__(self) -> None:
            super().__init__()
            self.duplikat: list[str] = []
            self.tumpuk: list[str] = []
            self.salah_tutup: list[str] = []

        def handle_starttag(self, tag, attrs):
            nama = [a for a, _ in attrs]
            for a in sorted(set(nama)):
                if nama.count(a) > 1:
                    self.duplikat.append(f"<{tag} {a}=… x{nama.count(a)}>")
            if tag not in self.VOID:
                self.tumpuk.append(tag)

        def handle_endtag(self, tag):
            if self.tumpuk and self.tumpuk[-1] == tag:
                self.tumpuk.pop()
            elif tag in self.tumpuk:
                while self.tumpuk and self.tumpuk[-1] != tag:
                    self.salah_tutup.append(self.tumpuk.pop())
                self.tumpuk.pop()

    _s = _Struktur()
    _s.feed(html)
    check(
        "Tidak ada elemen dengan atribut kembar",
        not _s.duplikat,
        f"{_s.duplikat[:4]} — browser hanya memakai yang pertama",
    )
    check(
        "Semua tag tertutup dan bersarang benar",
        not _s.salah_tutup and not _s.tumpuk,
        f"tidak tertutup: {(_s.salah_tutup + _s.tumpuk)[:5]}",
    )
    css_links = re.findall(r'<link[^>]+rel="stylesheet"', html)
    check(
        f"Hanya satu stylesheet render-blocking ({len(css_links)})",
        len(css_links) <= 1,
        "gabungkan CSS jadi satu berkas agar tidak menahan render dua kali",
    )
    check(
        "Meta robots mengizinkan pratinjau gambar besar",
        "max-image-preview:large" in html,
        "tanpa ini Google memakai thumbnail kecil di hasil pencarian",
    )

    # --- Gambar -------------------------------------------------------------
    imgs = re.findall(r"<img\b[^>]*>", html, re.I)
    check("Ada gambar di halaman", bool(imgs))
    check(
        "Setiap <img> punya alt",
        all(re.search(r'\balt\s*=', i, re.I) for i in imgs),
        "alt kosong boleh untuk gambar dekoratif, atribut tetap wajib ada",
    )
    check(
        "Setiap <img> punya width & height",
        all(re.search(r'\bwidth\s*=', i, re.I) and re.search(r'\bheight\s*=', i, re.I) for i in imgs),
        "cegah layout shift saat gambar selesai dimuat",
    )
    non_webp = [a.name for a in assets if a.suffix.lower() in (".png", ".jpg", ".jpeg", ".gif")]
    check(
        "Semua gambar yang dimuat berformat webp",
        not non_webp,
        f"masih non-webp: {sorted(set(non_webp))}" if non_webp else "",
    )
    stray = sorted(
        f.name for f in (path.parent / "assets" / "img").glob("*")
        if f.is_file() and f.suffix.lower() != ".webp"
    ) if (path.parent / "assets" / "img").is_dir() else []
    check(
        "assets/img hanya berisi berkas .webp",
        not stray,
        f"berkas lain: {stray}" if stray else "",
    )
    check(
        "Favicon memakai berkas gambar, bukan data URI",
        bool(re.search(r'<link[^>]+rel=["\']icon["\'][^>]*href=["\'](?!data:)[^"\']+["\']', html, re.I)),
    )

    # --- Larangan gaya ------------------------------------------------------
    visible = re.sub(r"<(script|style).*?</\1>", " ", html, flags=re.S)
    visible = re.sub(r"<[^>]+>", " ", visible)
    check(
        "Tidak ada progress-bar persentase skill di teks halaman",
        not re.search(r"\d{1,3}\s*%", visible),
        "persentase skill dilarang oleh sistem desain",
    )
    check(
        "Tidak ada script dari CDN",
        not re.search(r'<script[^>]+src=["\']https?://', html),
        "seluruh JS harus dari assets/ lokal",
    )
    check(
        "Tidak ada stylesheet dari CDN",
        not re.search(r'<link[^>]+href=["\']https?://[^"\']+\.css', html),
    )
    check(
        "Tailwind runtime (Play CDN) tidak dipakai",
        "cdn.tailwindcss.com" not in bundle,
        "Tailwind harus di-build jadi CSS statis",
    )

    # --- Ukuran -------------------------------------------------------------
    html_kb = path.stat().st_size / 1024
    code_kb = html_kb + sum(a.stat().st_size for a in code_files) / 1024
    payload_kb = html_kb + sum(
        a.stat().st_size for a in assets if a.exists() and a not in excluded) / 1024
    preview_kb = sum(a.stat().st_size for a in preview if a.exists()) / 1024
    check(f"index.html wajar ({html_kb:.0f}KB <= {MAX_HTML_KB}KB)", html_kb <= MAX_HTML_KB)
    check(f"HTML+CSS+JS wajar ({code_kb:.0f}KB <= {MAX_CODE_KB}KB)", code_kb <= MAX_CODE_KB)
    check(
        f"Payload pengunjung wajar ({payload_kb:.0f}KB <= {MAX_PAYLOAD_KB}KB)",
        payload_kb <= MAX_PAYLOAD_KB,
        "hitungan ini tidak termasuk og:image, apple-touch-icon, dan fallback <picture>",
    )
    check(f"Gambar preview wajar ({preview_kb:.0f}KB <= {MAX_PREVIEW_KB}KB)", preview_kb <= MAX_PREVIEW_KB)

    # --- Laporan ------------------------------------------------------------
    failed = [c for c in checks if not c[1]]
    for name, ok, hint in checks:
        line = f"[{'PASS' if ok else 'FAIL'}] {name}"
        if hint and not ok:
            line += f"  -> {hint}"
        print(line)
    print(f"\n{len(checks) - len(failed)}/{len(checks)} lulus")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
