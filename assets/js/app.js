/* ------------------------------------------------------------------ *
 * Portofolio Deni Hidayat — denihida1216.github.io
 * Tema gelap/terang, navbar, parallax, reveal-on-scroll, tombol ke atas.
 * Bahasa TIDAK diurus di sini: tiap bahasa punya halamannya sendiri
 * (/ dan /id/), jadi markup-nya sudah statis dalam bahasa masing-masing.
 * Tanpa dependency selain anime.js lokal; halaman tetap terbaca penuh
 * kalau JS gagal dimuat.
 * ------------------------------------------------------------------ */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------- penyimpanan aman (bisa throw di private mode) --- */
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {
      return null;
    }
  }

  /* =================================================================
   * 1. Tema gelap / terang
   * ================================================================= */
  var themeToggle = document.getElementById('theme-toggle');
  var iconSun = document.getElementById('icon-sun');
  var iconMoon = document.getElementById('icon-moon');

  function syncThemeLabel() {
    var dark = root.getAttribute('data-theme') === 'dark';
    if (iconSun) iconSun.classList.toggle('hidden', !dark);
    if (iconMoon) iconMoon.classList.toggle('hidden', dark);
    if (themeToggle) {
      // Label dua bahasa disimpan di markup; JS hanya memilih yang sesuai.
      var label = themeToggle.getAttribute(dark ? 'data-label-dark' : 'data-label-light');
      if (label) themeToggle.setAttribute('aria-label', label);
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store('dh-theme', next);
      syncThemeLabel();
    });
  }

  /* =================================================================
   * 2. Navbar: latar saat scroll, menu mobile, penanda section aktif
   * ================================================================= */
  var navShell = document.getElementById('nav-shell');
  var menuToggle = document.getElementById('menu-toggle');
  var mobileMenu = document.getElementById('mobile-menu');

  function syncMenuLabel() {
    if (!menuToggle) return;
    var open = menuToggle.getAttribute('aria-expanded') === 'true';
    var label = menuToggle.getAttribute(open ? 'data-label-close' : 'data-label-open');
    if (label) menuToggle.setAttribute('aria-label', label);
  }

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', function () {
      var open = menuToggle.getAttribute('aria-expanded') !== 'true';
      menuToggle.setAttribute('aria-expanded', String(open));
      mobileMenu.classList.toggle('hidden', !open);
      syncMenuLabel();
    });

    mobileMenu.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        menuToggle.setAttribute('aria-expanded', 'false');
        mobileMenu.classList.add('hidden');
        syncMenuLabel();
      }
    });
  }

  /* Hapus anchor dari URL tanpa memindahkan scroll. Dipakai saat pembaca
     kembali ke hero: berada di puncak halaman tapi URL masih menunjuk
     section lain itu membingungkan, dan refresh berikutnya akan melompat
     balik ke sana. */
  function clearHash() {
    if (!location.hash) return;
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch (e) { /* biarkan hash apa adanya */ }
  }

  /* Tombol kembali ke atas — muncul setelah hero terlewat. */
  var toTop = document.getElementById('to-top');

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduced.matches ? 'auto' : 'smooth' });
      clearHash();
    });
  }

  function onScrollToTop() {
    if (!toTop) return;
    toTop.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.6);
  }

  /* -------------------------------------------------------------------
   * Buka halaman dengan anchor (mis. .../#how-i-work).
   *
   * Saat refresh, browser memulihkan posisi scroll sebelumnya dan itu
   * MENGALAHKAN anchor di URL — halaman berhenti di tempat lama meski
   * URL-nya #how-i-work. Jadi kalau anchor-nya valid, ambil alih:
   * matikan pemulihan otomatis lalu lompat sendiri ke target.
   * ------------------------------------------------------------------- */
  var userScrolled = false;
  ['wheel', 'touchstart', 'keydown'].forEach(function (evt) {
    window.addEventListener(evt, function () { userScrolled = true; }, { passive: true, once: true });
  });

  function jumpToHash() {
    if (userScrolled) return;
    var id = location.hash.slice(1);
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;

    try { history.scrollRestoration = 'manual'; } catch (e) { /* Safari lama */ }

    // Lompat langsung: ini posisi awal halaman, bukan navigasi bertahap.
    var prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    el.scrollIntoView();
    root.style.scrollBehavior = prev;
  }

  var NAV_SOLID = ['border-line', 'bg-surface/80', 'backdrop-blur-xl', 'shadow-lg', 'shadow-black/5'];

  function onScrollNav() {
    if (!navShell) return;
    var solid = window.scrollY > 24;
    NAV_SOLID.forEach(function (c) { navShell.classList.toggle(c, solid); });
    navShell.classList.toggle('border-transparent', !solid);
  }

  // Diturunkan dari navbar, bukan daftar id yang ditulis tangan: anchor
  // berbeda antara halaman Inggris (#about) dan Indonesia (#tentang).
  var sections = Array.prototype.slice.call(document.querySelectorAll('#nav-links a'))
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);

  // Menu ponsel ikut ditandai: kalau tidak, membuka menu sambil berada
  // di suatu section tidak menunjukkan sedang di mana.
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll('#nav-links a, #mobile-menu a'));
  var hashTimer = 0;
  var currentActive = '';

  function onScrollSpy() {
    var pos = window.scrollY + window.innerHeight * 0.35;
    var active = '';
    sections.forEach(function (s) {
      if (s.offsetTop <= pos) active = s.id;
    });
    navLinks.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + active;
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });

    /* active kosong berarti pembaca sudah kembali ke hero — lepas
       anchor-nya. Ditunda sebentar: klik anchor memicu smooth scroll
       yang BERANGKAT dari hero, jadi kalau langsung dihapus, hash yang
       barusan diset ikut terhapus di tengah jalan. */
    if (active) {
      clearTimeout(hashTimer);
      hashTimer = 0;
    } else if (!hashTimer && location.hash) {
      hashTimer = setTimeout(function () {
        hashTimer = 0;
        if (!currentActive) clearHash();
      }, 500);
    }
    currentActive = active;
  }

  /* =================================================================
   * 3. Parallax — scroll & kursor, digabung dalam satu loop rAF.
   *
   * Pergeseran dihitung dari posisi elemen terhadap tengah layar, bukan
   * dari scrollY absolut: offset = 0 tepat saat elemen berada di tengah
   * viewport, lalu tumbuh ke dua arah. Efeknya simetris saat scroll
   * turun maupun naik, dan rumus yang sama tetap benar untuk elemen di
   * bagian mana pun halaman.
   * ================================================================= */
  var scrollLayers = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  var mouseLayers = Array.prototype.slice.call(document.querySelectorAll('[data-parallax-mouse]'));
  var mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
  var ticking = false;

  /* Titik tengah elemen dalam koordinat dokumen, diukur tanpa transform
     yang sedang berjalan supaya hasilnya tidak makan hasilnya sendiri. */
  function measureLayers() {
    var y = window.scrollY;
    scrollLayers.forEach(function (el) {
      var prev = el.style.transform;
      el.style.transform = 'none';
      var rect = el.getBoundingClientRect();
      el.dataset.center = rect.top + y + rect.height / 2;
      el.style.transform = prev;
    });
  }

  function renderParallax() {
    ticking = false;
    var mid = window.scrollY + window.innerHeight / 2;

    mouseX += (targetX - mouseX) * 0.08;
    mouseY += (targetY - mouseY) * 0.08;

    scrollLayers.forEach(function (el) {
      var speed = parseFloat(el.getAttribute('data-parallax')) || 0;
      var center = parseFloat(el.dataset.center);
      if (isNaN(center)) return;

      var ty = (mid - center) * speed;
      var mx = 0;
      var strength = parseFloat(el.getAttribute('data-parallax-mouse'));
      if (strength) { mx = mouseX * strength; ty += mouseY * strength; }
      el.style.transform = 'translate3d(' + mx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0)';
    });

    mouseLayers.forEach(function (el) {
      if (el.hasAttribute('data-parallax')) return; // sudah ditangani di atas
      var strength = parseFloat(el.getAttribute('data-parallax-mouse')) || 0;
      el.style.transform =
        'translate3d(' + (mouseX * strength).toFixed(2) + 'px,' + (mouseY * strength).toFixed(2) + 'px,0)';
    });

    if (Math.abs(targetX - mouseX) > 0.001 || Math.abs(targetY - mouseY) > 0.001) request();
  }

  function request() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(renderParallax);
    }
  }

  function onScroll() {
    onScrollNav();
    onScrollSpy();
    onScrollToTop();
    if (!reduced.matches) request();
  }

  function onResize() {
    measureLayers();
    onScroll();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });

  // Font yang selesai dimuat menggeser layout, jadi ukur ulang.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(onResize);
  }

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', function (e) {
      if (reduced.matches) return;
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
      request();
    }, { passive: true });
  }

  /* =================================================================
   * 4. Gambar: cegah klik kanan "Open image" dan seret ke tab lain.
   *
   * Ini penghalang, bukan pengaman — berkasnya tetap bisa diambil lewat
   * DevTools atau URL langsung. Tujuannya sekadar menghindari orang
   * tidak sengaja menyeret/menyimpan foto profil.
   * ================================================================= */
  document.addEventListener('contextmenu', function (e) {
    if (e.target && e.target.tagName === 'IMG') e.preventDefault();
  });

  document.querySelectorAll('img').forEach(function (img) {
    img.setAttribute('draggable', 'false');
  });

  /* =================================================================
   * 5. Animasi masuk & reveal-on-scroll (anime.js)
   *
   * Elemen tidak "sekali tampil lalu selesai": begitu keluar viewport ia
   * di-reset ke posisi awal sesuai arah keluarnya, jadi animasinya main
   * lagi saat pengguna scroll balik ke atas maupun turun lagi.
   * ================================================================= */
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var OFFSET = 22;

  function showNow(els) {
    els.forEach(function (el) {
      if (window.anime) window.anime.remove(el);
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

  /* dir = 1 kalau elemen berada di bawah viewport, -1 kalau di atasnya. */
  function resetEl(el, dir) {
    if (window.anime) window.anime.remove(el);
    el.style.opacity = '0';
    el.style.transform = 'translateY(' + OFFSET * dir + 'px)';
  }

  function animateIn(els, delayStep) {
    if (!window.anime) { showNow(els); return; }
    window.anime.remove(els);
    // Nilai awal sudah ditulis sebagai inline style oleh resetEl(), jadi
    // anime.js tinggal menganimasikan dari posisi itu ke posisi akhir.
    window.anime({
      targets: els,
      opacity: 1,
      translateY: 0,
      duration: 720,
      delay: window.anime.stagger(delayStep || 70),
      easing: 'cubicBezier(.22,.61,.36,1)'
    });
  }

  function initMotion() {
    if (reduced.matches || !('IntersectionObserver' in window)) {
      showNow(reveals);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      var enter = [];
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          enter.push(entry.target);
        } else {
          // Keluar viewport: siapkan lagi supaya bisa main ulang.
          resetEl(entry.target, entry.boundingClientRect.top > 0 ? 1 : -1);
        }
      });
      if (!enter.length) return;
      // Urutkan sesuai posisi di halaman supaya stagger-nya mengalir rapi.
      enter.sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
      animateIn(enter, 70);
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

    // Tulis posisi awal sebagai inline style dulu supaya anime.js punya
    // titik mulai yang pasti (bukan hasil parsing matrix dari CSS).
    reveals.forEach(function (el) { resetEl(el, 1); io.observe(el); });
  }

  reduced.addEventListener('change', function () {
    if (reduced.matches) showNow(reveals);
  });

  /* =================================================================
   * 6. Service worker — halaman tetap bisa dibuka saat offline.
   *
   * Didaftarkan setelah `load` supaya tidak berebut bandwidth dengan
   * render pertama. Gagal mendaftar bukan masalah: situsnya tetap jalan
   * normal tanpa service worker.
   * ================================================================= */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {
        /* offline, http, atau browser menolak — abaikan */
      });
    });
  }

  /* =================================================================
   * 7. Jalankan
   * ================================================================= */
  syncThemeLabel();
  syncMenuLabel();
  measureLayers();
  jumpToHash();
  onScroll();

  // Font dan gambar yang baru selesai dimuat menggeser layout, jadi
  // pastikan sekali lagi anchor-nya benar-benar kena.
  window.addEventListener('load', function () {
    jumpToHash();
    measureLayers();
    onScroll();
  });

  if (document.readyState === 'complete') initMotion();
  else window.addEventListener('load', initMotion);
})();
