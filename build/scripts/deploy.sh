#!/usr/bin/env bash
#
# Deploy situs ke GitHub Pages.
#
#   npm run deploy                    # pesan commit otomatis
#   npm run deploy -- "pesan commit"
#
# Urutannya sengaja: build -> validator -> uji browser -> baru git.
# `set -e` membuat skrip berhenti begitu ada yang gagal, jadi tidak
# mungkin men-deploy situs yang belum lulus uji.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO="denihida1216/denihida1216.github.io"
SITUS="https://denihida1216.github.io"

info() { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
gagal() { printf '\n\033[1;31mGAGAL:\033[0m %s\n' "$1" >&2; exit 1; }

# --- 1. Branch yang benar-benar disajikan Pages ------------------------------
# Repo ini memakai `master`, bukan `main`. Jangan berasumsi: push ke
# branch yang salah tidak mengubah situs live sama sekali.
info "Mencari branch yang dipakai GitHub Pages"
BRANCH="$(gh api "repos/$REPO/pages" --jq '.source.branch' 2>/dev/null || true)"
if [ -z "$BRANCH" ]; then
  BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
  echo "   tidak bisa membaca konfigurasi Pages, memakai branch lokal: $BRANCH"
else
  echo "   Pages menyajikan branch: $BRANCH"
fi

LOKAL="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
[ "$LOKAL" = "$BRANCH" ] || gagal "branch lokal '$LOKAL' bukan branch yang disajikan Pages ('$BRANCH')"

# --- 2. Build & uji ----------------------------------------------------------
info "Build Tailwind"
( cd "$ROOT/build" && npm run --silent build )

info "Validator statis"
( cd "$ROOT/build" && npm run --silent check )

info "Uji perilaku di browser"
( cd "$ROOT/build" && npm run --silent test )

# --- 3. Commit ---------------------------------------------------------------
cd "$ROOT"
git add -A
if git diff --cached --quiet; then
  info "Tidak ada perubahan untuk di-commit — lanjut ke verifikasi live"
else
  PESAN="${1:-Perbarui situs}"
  info "Commit: $PESAN"
  git -c user.name="Deni Hidayat" -c user.email="denihida1216@gmail.com" \
      commit -q -m "$PESAN"
  git --no-pager log -1 --format='   %h %s'

  info "Push ke origin/$BRANCH"
  git push -q origin "$BRANCH"
fi

# --- 4. Verifikasi situs live ------------------------------------------------
# Halaman membalas 200 bukan bukti deploy berhasil — halaman tanpa CSS
# juga 200. Aset kuncinya ikut dicek.
info "Menunggu GitHub Pages membangun ulang"
for i in $(seq 1 20); do
  STATUS="$(gh api "repos/$REPO/pages/builds/latest" --jq '.status' 2>/dev/null || echo '?')"
  SHA="$(gh api "repos/$REPO/pages/builds/latest" --jq '.commit' 2>/dev/null | cut -c1-7 || echo '?')"
  LOKAL_SHA="$(git rev-parse --short=7 HEAD)"
  if [ "$STATUS" = "built" ] && [ "$SHA" = "$LOKAL_SHA" ]; then
    echo "   selesai (commit $SHA)"
    break
  fi
  [ "$STATUS" = "errored" ] && gagal "build Pages error — cek Settings > Pages di GitHub"
  printf '   %s (%s/20)\r' "$STATUS" "$i"
  sleep 10
done

info "Mengecek berkas yang benar-benar tersaji"
RUSAK=0
for f in "" assets/css/site.css assets/js/app.js assets/js/smoke.js \
         assets/fonts/Inter-var.woff2 assets/img/profil.webp \
         assets/img/icons/proxmox.webp sitemap.xml robots.txt; do
  KODE="$(curl -s -o /dev/null -w '%{http_code}' "$SITUS/$f")"
  printf '   %s  /%s\n' "$KODE" "$f"
  [ "$KODE" = "200" ] || RUSAK=1
done
[ "$RUSAK" = "0" ] || gagal "ada berkas yang tidak tersaji — cek apakah .nojekyll masih ada dan berkasnya ikut di-commit"

printf '\n\033[1;32mSelesai.\033[0m %s\n\n' "$SITUS"
