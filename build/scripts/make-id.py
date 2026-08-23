#!/usr/bin/env python3
"""Bangun halaman versi Indonesia (id/index.html) dari index.html.

    python3 scripts/make-id.py

Kenapa perlu halaman terpisah, bukan sekadar toggle JavaScript:
crawler (WhatsApp, Facebook, LinkedIn, X, Google) membaca meta OG dari
HTML statis dan TIDAK menjalankan JavaScript. Satu URL karena itu hanya
bisa punya satu judul, deskripsi, dan gambar preview. Supaya link yang
dibagikan mengikuti bahasa, bahasanya harus ada di URL-nya.

Halaman ini digenerate, bukan disunting tangan — sumbernya tetap satu
(index.html + build/src/i18n.json), jadi keduanya tidak bisa melenceng.

Penerjemahannya berbasis **kunci `data-i18n`**, bukan cari-ganti teks.
Itu penting: "How I work" dipakai dua kunci berbeda (`work.eyebrow` dan
`work.title`) dengan terjemahan Indonesia yang berbeda pula, jadi
cari-ganti literal akan menyeragamkan keduanya secara keliru.
"""
import json
import re
from html import escape
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
SITUS = "https://denihida1216.github.io"


def terjemahkan_elemen(html: str, kamus: dict[str, str]) -> str:
    """Ganti isi/atribut tiap elemen ber-`data-i18n` sesuai kuncinya."""
    hasil, kursor = [], 0
    for m in re.finditer(r'data-i18n="([^"]+)"', html):
        kunci = m.group(1)
        teks = kamus.get(kunci)
        if teks is None:
            raise SystemExit(f"kunci tidak ada di i18n.json: {kunci}")

        awal_tag = html.rindex("<", 0, m.start())
        akhir_tag = html.index(">", m.end())
        tag = html[awal_tag:akhir_tag + 1]

        attr = re.search(r'data-i18n-attr="([^"]+)"', tag)
        if attr:
            # Isi elemen tidak disentuh — yang diterjemahkan atributnya.
            tag_baru = tag
            for a in (x.strip() for x in attr.group(1).split(",")):
                tag_baru = re.sub(
                    rf'\b{re.escape(a)}="[^"]*"',
                    f'{a}="{escape(teks, quote=True)}"',
                    tag_baru,
                    count=1,
                )
            hasil.append(html[kursor:awal_tag] + tag_baru)
            kursor = akhir_tag + 1
        else:
            akhir_isi = html.index("<", akhir_tag)
            hasil.append(html[kursor:akhir_tag + 1] + escape(teks, quote=False))
            kursor = akhir_isi
    hasil.append(html[kursor:])
    return "".join(hasil)


def main() -> None:
    html = (AKAR / "index.html").read_text(encoding="utf-8")
    i18n = json.loads((AKAR / "build/src/i18n.json").read_text(encoding="utf-8"))
    EN, ID = i18n["en"], i18n["id"]

    tahun = re.search(r"©\s*(\d{4})", html)
    ID = dict(ID)
    ID["footer.text"] = ID["footer.text"].replace("{year}", tahun.group(1) if tahun else "")

    html = terjemahkan_elemen(html, ID)

    # --- kepala halaman -----------------------------------------------------
    html = html.replace(f"<title>{escape(EN['ui.metaTitle'], quote=False)}</title>",
                        f"<title>{escape(ID['ui.metaTitle'], quote=False)}</title>")
    html = html.replace(escape(EN["ui.metaDesc"], quote=True),
                        escape(ID["ui.metaDesc"], quote=True))

    # Anchor ikut bahasa: #about di halaman Inggris, #tentang di Indonesia.
    ANCHOR = {
        "home": "beranda",
        "about": "tentang",
        "skills": "keahlian",
        "how-i-work": "cara-kerja",
        "contact": "kontak",
    }
    for en_id, id_id in ANCHOR.items():
        html = html.replace(f'id="{en_id}"', f'id="{id_id}"')
        html = html.replace(f'href="#{en_id}"', f'href="#{id_id}"')
        html = html.replace(f'{SITUS}/#{en_id}', f'{SITUS}/#{id_id}')

    gantian = [
        ('<html lang="en"', '<html lang="id"'),
        ('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="id_ID">'),
        ('<meta property="og:locale:alternate" content="id_ID">',
         '<meta property="og:locale:alternate" content="en_US">'),
        (f'<link rel="canonical" href="{SITUS}/">', f'<link rel="canonical" href="{SITUS}/id/">'),
        (f'content="{SITUS}/"', f'content="{SITUS}/id/"'),
        ('og-cover.webp', 'og-cover-id.webp'),
        ('content="From the first line of code to a secure, stable production server."',
         'content="Dari baris kode pertama sampai server produksi yang aman dan stabil."'),
        # toggle bahasa menunjuk balik ke versi Inggris
        ('<a id="lang-toggle" href="id/" hreflang="id" class="icon-btn w-auto px-3 font-mono text-xs font-medium"\n'
         '           aria-label="Switch language to Indonesian" title="Bahasa Indonesia">ID</a>',
         '<a id="lang-toggle" href="../" hreflang="en" class="icon-btn w-auto px-3 font-mono text-xs font-medium"\n'
         '           aria-label="Ganti bahasa ke Inggris" title="English">EN</a>'),
        # halaman berada satu tingkat lebih dalam
        ('href="assets/', 'href="../assets/'),
        ('src="assets/', 'src="../assets/'),
    ]
    for lama, baru in gantian:
        if lama not in html:
            raise SystemExit(f"pola tidak ditemukan saat membangun id/: {lama[:60]}")
        html = html.replace(lama, baru)

    # Label dua-keadaan pada tombol tema & menu (dibaca JS, bukan lewat
    # data-i18n karena nilainya bergantung keadaan).
    for atribut, kunci in (
        ("data-label-dark", "ui.themeDark"),
        ("data-label-light", "ui.themeLight"),
        ("data-label-open", "ui.menuOpen"),
        ("data-label-close", "ui.menuClose"),
    ):
        html = html.replace(f'{atribut}="{escape(EN[kunci], quote=True)}"',
                            f'{atribut}="{escape(ID[kunci], quote=True)}"')
    # aria-label awal tombol tema/menu ikut bahasa halaman
    html = html.replace(f'aria-label="{escape(EN["ui.themeDark"], quote=True)}"',
                        f'aria-label="{escape(ID["ui.themeDark"], quote=True)}"')
    html = html.replace(f'aria-label="{escape(EN["ui.menuOpen"], quote=True)}"',
                        f'aria-label="{escape(ID["ui.menuOpen"], quote=True)}"')
    html = html.replace('title="Theme"', 'title="Tema"')

    # --- JSON-LD ------------------------------------------------------------
    m = re.search(r'<script type="application/ld\+json">\n(.*?)\n</script>', html, re.S)
    g = json.loads(m.group(1))
    peta = {EN[k]: ID[k] for k in ("nav.about", "nav.skills", "nav.work", "nav.contact")}
    for simpul in g["@graph"]:
        if simpul["@type"] == "ProfilePage":
            simpul["name"] = ID["ui.metaTitle"]
            simpul["url"] = f"{SITUS}/id/"
            for bagian in simpul.get("hasPart", []):
                bagian["name"] = peta.get(bagian["name"], bagian["name"])
                bagian["url"] = bagian["url"].replace(f"{SITUS}/#", f"{SITUS}/id/#")
        if simpul["@type"] == "WebSite":
            simpul["inLanguage"] = ["id-ID", "en-US"]
    blok = ('<script type="application/ld+json">\n'
            + json.dumps(g, indent=2, ensure_ascii=False) + "\n</script>")
    html = html[:m.start()] + blok + html[m.end():]

    (AKAR / "id").mkdir(exist_ok=True)
    (AKAR / "id/index.html").write_text(html, encoding="utf-8")
    print(f"  id/index.html  {len(html) / 1024:.1f}KB")


if __name__ == "__main__":
    main()
