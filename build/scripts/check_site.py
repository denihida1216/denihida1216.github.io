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
    for anchor in ("tentang", "keahlian", "cara-kerja", "kontak"):
        check(
            f"Section anchor #{anchor} ada",
            f'id="{anchor}"' in html,
            "id section harus konsisten dengan navbar",
        )
    nav_hrefs = set(re.findall(r'href="#([a-z-]+)"', html))
    check(
        "Semua anchor navbar punya target",
        all(f'id="{h}"' in html for h in nav_hrefs),
        f"anchor tanpa target: {sorted(h for h in nav_hrefs if f'id=\"{h}\"' not in html)}",
    )

    # --- Bilingual ----------------------------------------------------------
    keys = sorted(set(re.findall(r'data-i18n="([^"]+)"', html)))
    check("Mekanisme i18n (data-i18n) dipakai", bool(keys))
    check(
        "Kamus dua bahasa ada (kunci id & en)",
        bool(re.search(r"\bid\s*:\s*\{", bundle) and re.search(r"\ben\s*:\s*\{", bundle)),
        "kamus DICT harus punya blok id dan en",
    )
    untranslated = [k for k in keys if len(re.findall(r"['\"]" + re.escape(k) + r"['\"]\s*:", bundle)) < 2]
    check(
        "Setiap kunci data-i18n punya teks ID dan EN",
        not untranslated,
        f"kunci kurang terjemahan: {untranslated[:8]}" if untranslated else "",
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
