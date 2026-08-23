#!/usr/bin/env python3
"""Bangun ulang semua turunan gambar dari foto asli.

    python3 scripts/make-images.py

Sumbernya satu: build/src/img/profil.jpg. Semua yang tampil di situs
diturunkan dari situ, jadi tidak ada berkas yang dibuat manual lalu
lupa diperbarui. Keluarannya webp semua — assets/img/ memang hanya
boleh berisi .webp.
"""
from pathlib import Path

from PIL import Image, ImageDraw

AKAR = Path(__file__).resolve().parents[2]
SUMBER = AKAR / "build/src/img/profil.jpg"
TUJUAN = AKAR / "assets/img"

# Wajah ada di bagian atas-tengah foto. Turunan kecil di-crop ke sini
# supaya masih terbaca di 32px; kalau tidak, yang terlihat hanya jaket.
WAJAH = (105, 10, 365, 270)


def main() -> None:
    if not SUMBER.exists():
        raise SystemExit(f"foto asli tidak ada: {SUMBER}")

    asli = Image.open(SUMBER).convert("RGB")
    wajah = asli.crop(WAJAH)

    keluaran = [
        ("profil.webp", asli, None, 86),          # hero, dipakai penuh
        ("avatar-96.webp", wajah, 96, 88),        # navbar
        ("favicon-180.webp", wajah, 180, 90),     # tab & layar utama
        ("favicon-32.webp", wajah, 32, 90),       # favicon
    ]

    for nama, gambar, sisi, mutu in keluaran:
        im = gambar if sisi is None else gambar.resize((sisi, sisi), Image.LANCZOS)
        jalur = TUJUAN / nama
        im.save(jalur, "WEBP", quality=mutu, method=6)
        print(f"  {jalur.stat().st_size / 1024:6.1f}KB  {im.size[0]}x{im.size[1]}  {nama}")

    for sisi in (192, 512):
        ikon = ikon_aplikasi(wajah, sisi)
        jalur = TUJUAN / f"app-icon-{sisi}.webp"
        ikon.save(jalur, "WEBP", quality=90, method=6)
        print(f"  {jalur.stat().st_size / 1024:6.1f}KB  {sisi}x{sisi}  {jalur.name}")


def ikon_aplikasi(wajah: Image.Image, sisi: int) -> Image.Image:
    """Ikon PWA: foto bulat di atas latar merek.

    Fotonya sengaja hanya mengisi ~68% bidang. Android memotong ikon jadi
    berbagai bentuk (maskable), dan area aman itu lingkaran 80% — kalau
    foto dibuat penuh, tepinya terpotong di sebagian peluncur.
    """
    SKALA = 4  # gambar besar lalu dikecilkan supaya tepinya halus
    besar = sisi * SKALA
    kanvas = Image.new("RGB", (besar, besar), (11, 18, 32))

    diameter = int(besar * 0.68)
    tepi = (besar - diameter) // 2

    cincin = Image.new("RGBA", (besar, besar), (0, 0, 0, 0))
    d = ImageDraw.Draw(cincin)
    tebal = max(2, int(besar * 0.012))
    d.ellipse(
        [tepi - tebal, tepi - tebal, tepi + diameter + tebal, tepi + diameter + tebal],
        fill=(56, 189, 248, 255),
    )
    kanvas.paste(cincin, (0, 0), cincin)

    foto = wajah.resize((diameter, diameter), Image.LANCZOS)
    topeng = Image.new("L", (diameter, diameter), 0)
    ImageDraw.Draw(topeng).ellipse([0, 0, diameter - 1, diameter - 1], fill=255)
    kanvas.paste(foto, (tepi, tepi), topeng)

    return kanvas.resize((sisi, sisi), Image.LANCZOS)


if __name__ == "__main__":
    main()
