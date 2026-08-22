/* ------------------------------------------------------------------ *
 * Portofolio Deni Hidayat — denihida1216.github.io
 * Bilingual (id/en), tema gelap/terang, parallax, reveal-on-scroll.
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
   * 1. Bahasa — teks default di HTML adalah Bahasa Inggris.
   * ================================================================= */
  var YEAR = new Date().getFullYear();

  var DICT = {
    id: {
      'a11y.skip': 'Lewati ke konten',
      'nav.about': 'Tentang',
      'nav.skills': 'Keahlian',
      'nav.work': 'Cara kerja',
      'nav.contact': 'Kontak',

      'hero.eyebrow': 'Fullstack Developer & Infrastructure Engineer',
      'hero.greet': 'Halo, saya',
      'hero.hook': 'Saya membangun aplikasi web dan mobile dari baris kode pertama sampai berjalan aman dan stabil di server produksi.',
      'hero.cta1': 'Hubungi saya',
      'hero.cta2': 'Lihat apa yang saya kerjakan',
      'hero.photoAlt': 'Foto Deni Hidayat',
      'hero.tag1': 'Web & Mobile',
      'hero.tag2': 'Server & Docker',
      'hero.tag3': 'Keamanan aplikasi',

      'about.eyebrow': 'Tentang',
      'about.title': 'Satu pekerjaan yang utuh',
      'about.p1': 'Saya seorang developer yang senang menyelesaikan masalah dari ujung ke ujung. Menulis backend dan frontend, merancang database, lalu memastikan semuanya ter-deploy dengan rapi, aman, dan tetap hidup saat trafik datang — bagi saya itu satu pekerjaan yang utuh, bukan tiga pekerjaan berbeda.',
      'about.p2': 'Saya terbiasa bekerja dengan tenang di bawah tekanan: menangani insiden produksi, mengejar deadline ketat, dan mengambil keputusan teknis yang jelas saat waktu terbatas. Yang saya jaga selalu sama — komunikasi yang jujur dan hasil yang bisa diandalkan.',
      'about.p3': 'Kalau Anda mencari orang yang bisa dipercaya memegang aplikasi dari kode sampai server, kemungkinan besar kita cocok.',

      'skills.eyebrow': 'Keahlian',
      'skills.title': 'Tiga hal yang saya kerjakan',
      'skills.sub': 'Fullstack development, server & infrastructure, dan keamanan aplikasi — kombinasi ketiganya yang membuat saya bisa memegang sebuah aplikasi dari repositori kosong sampai berjalan di produksi.',
      'skills.techAria': 'Teknologi yang saya pakai',

      'work.eyebrow': 'Cara kerja',
      'work.title': 'Cara saya bekerja',
      'work.sub': 'Empat hal yang bisa Anda harapkan dari saya, di proyek apa pun.',
      'work.i1.title': 'Komunikasi yang jelas',
      'work.i1.desc': 'Kabar baik maupun buruk saya sampaikan lebih awal, bukan di menit terakhir.',
      'work.i2.title': 'Tenang di bawah tekanan',
      'work.i2.desc': 'Insiden produksi dan deadline ketat saya hadapi dengan langkah yang terukur, bukan panik.',
      'work.i3.title': 'Tuntas dari ujung ke ujung',
      'work.i3.desc': 'Selesai bagi saya berarti berjalan di produksi — aman, terpantau, dan terdokumentasi.',
      'work.i4.title': 'Aman sejak awal',
      'work.i4.desc': 'Keamanan saya pikirkan sejak desain, bukan setelah ada masalah.',

      'contact.eyebrow': 'Kontak',
      'contact.title': 'Mari bekerja sama',
      'contact.text': 'Punya proyek atau posisi yang membutuhkan orang yang bisa diandalkan? Ceritakan kebutuhan Anda — saya balas secepat yang saya bisa.',
      'contact.note': 'Biasanya saya balas dalam 24 jam.',

      'footer.text': '© ' + YEAR + ' Deni Hidayat',

      'ui.langAria': 'Ganti bahasa ke Inggris',
      'ui.themeDark': 'Ganti ke tema terang',
      'ui.themeLight': 'Ganti ke tema gelap',
      'ui.toTop': 'Kembali ke atas',
      'ui.menuOpen': 'Buka menu',
      'ui.menuClose': 'Tutup menu',
      'ui.metaTitle': 'Deni Hidayat — Fullstack Developer & Infrastructure Engineer',
      'ui.metaDesc': 'Portofolio Deni Hidayat — fullstack developer (web & mobile) yang juga menangani server, Docker, dan keamanan aplikasi. Dari kode sampai produksi.'
    },

    en: {
      'a11y.skip': 'Skip to content',
      'nav.about': 'About',
      'nav.skills': 'Skills',
      'nav.work': 'How I work',
      'nav.contact': 'Contact',

      'hero.eyebrow': 'Fullstack Developer & Infrastructure Engineer',
      'hero.greet': "Hi, I'm",
      'hero.hook': 'I build web and mobile applications — from the first line of code to a secure, stable production server.',
      'hero.cta1': 'Contact me',
      'hero.cta2': 'See what I do',
      'hero.photoAlt': 'Photo of Deni Hidayat',
      'hero.tag1': 'Web & Mobile',
      'hero.tag2': 'Servers & Docker',
      'hero.tag3': 'Application security',

      'about.eyebrow': 'About',
      'about.title': 'One whole job',
      'about.p1': "I'm a developer who enjoys solving problems end to end. Writing the backend and frontend, designing the database, then making sure everything is deployed cleanly, securely, and stays up when traffic arrives — to me that's one whole job, not three separate ones.",
      'about.p2': "I'm used to working calmly under pressure: handling production incidents, meeting tight deadlines, and making clear technical decisions when time is short. What I keep constant is honest communication and dependable results.",
      'about.p3': "If you're looking for someone you can trust with an application from code to server, there's a good chance we'll work well together.",

      'skills.eyebrow': 'Skills',
      'skills.title': 'Three things I do',
      'skills.sub': 'Fullstack development, servers & infrastructure, and application security — the combination of all three is what lets me carry an application from an empty repository to running in production.',
      'skills.techAria': 'Technologies I work with',

      'work.eyebrow': 'How I work',
      'work.title': 'How I work',
      'work.sub': 'Four things you can expect from me, on any project.',
      'work.i1.title': 'Clear communication',
      'work.i1.desc': 'Good news or bad, you hear it from me early — not at the last minute.',
      'work.i2.title': 'Calm under pressure',
      'work.i2.desc': 'I meet production incidents and tight deadlines with measured steps, not panic.',
      'work.i3.title': 'Ownership, end to end',
      'work.i3.desc': 'Done means running in production — secure, monitored, and documented.',
      'work.i4.title': 'Secure by default',
      'work.i4.desc': 'I think about security at design time, not after something breaks.',

      'contact.eyebrow': 'Contact',
      'contact.title': "Let's work together",
      'contact.text': "Have a project or a role that needs someone dependable? Tell me what you need — I'll reply as fast as I can.",
      'contact.note': 'I usually reply within 24 hours.',

      'footer.text': '© ' + YEAR + ' Deni Hidayat',

      'ui.langAria': 'Switch language to Indonesian',
      'ui.themeDark': 'Switch to light theme',
      'ui.themeLight': 'Switch to dark theme',
      'ui.toTop': 'Back to top',
      'ui.menuOpen': 'Open menu',
      'ui.menuClose': 'Close menu',
      'ui.metaTitle': 'Deni Hidayat — Fullstack Developer & Infrastructure Engineer',
      'ui.metaDesc': 'Portfolio of Deni Hidayat — a fullstack developer (web & mobile) who also handles servers, Docker, and application security. From code to production.'
    }
  };

  var langToggle = document.getElementById('lang-toggle');
  var langLabel = document.getElementById('lang-label');
  var themeToggle = document.getElementById('theme-toggle');
  var metaDesc = document.querySelector('meta[name="description"]');

  function currentLang() {
    return root.getAttribute('lang') === 'id' ? 'id' : 'en';
  }

  function applyLang(lang) {
    var dict = DICT[lang] || DICT.id;
    root.setAttribute('lang', lang);

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var text = dict[el.getAttribute('data-i18n')];
      if (typeof text !== 'string') return;
      // data-i18n-attr="alt" (atau "aria-label,title") mengisi atribut,
      // bukan isi elemen — penting untuk tombol yang isinya ikon SVG.
      var attr = el.getAttribute('data-i18n-attr');
      if (attr) attr.split(',').forEach(function (a) { el.setAttribute(a.trim(), text); });
      else el.textContent = text;
    });

    document.title = dict['ui.metaTitle'];
    if (metaDesc) metaDesc.setAttribute('content', dict['ui.metaDesc']);
    if (langLabel) langLabel.textContent = lang === 'en' ? 'ID' : 'EN';
    if (langToggle) langToggle.setAttribute('aria-label', dict['ui.langAria']);
    syncThemeLabel();
    syncMenuLabel();
  }

  if (langToggle) {
    langToggle.addEventListener('click', function () {
      var next = currentLang() === 'en' ? 'id' : 'en';
      store('dh-lang', next);
      applyLang(next);
    });
  }

  /* =================================================================
   * 2. Tema gelap / terang
   * ================================================================= */
  var iconSun = document.getElementById('icon-sun');
  var iconMoon = document.getElementById('icon-moon');

  function syncThemeLabel() {
    var dark = root.getAttribute('data-theme') === 'dark';
    var dict = DICT[currentLang()];
    if (iconSun) iconSun.classList.toggle('hidden', !dark);
    if (iconMoon) iconMoon.classList.toggle('hidden', dark);
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', dark ? dict['ui.themeDark'] : dict['ui.themeLight']);
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
   * 3. Navbar: latar saat scroll, menu mobile, penanda section aktif
   * ================================================================= */
  var navShell = document.getElementById('nav-shell');
  var menuToggle = document.getElementById('menu-toggle');
  var mobileMenu = document.getElementById('mobile-menu');

  function syncMenuLabel() {
    if (!menuToggle) return;
    var open = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-label', DICT[currentLang()][open ? 'ui.menuClose' : 'ui.menuOpen']);
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
   * Buka halaman dengan anchor (mis. .../#cara-kerja).
   *
   * Saat refresh, browser memulihkan posisi scroll sebelumnya dan itu
   * MENGALAHKAN anchor di URL — halaman berhenti di tempat lama meski
   * URL-nya #cara-kerja. Jadi kalau anchor-nya valid, ambil alih:
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

  var sections = ['tentang', 'keahlian', 'cara-kerja', 'kontak'].map(function (id) {
    return document.getElementById(id);
  }).filter(Boolean);

  var navLinks = Array.prototype.slice.call(document.querySelectorAll('#nav-links a'));
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
   * 4. Parallax — scroll & kursor, digabung dalam satu loop rAF.
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
   * 5. Gambar: cegah klik kanan "Open image" dan seret ke tab lain.
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
   * 6. Animasi masuk & reveal-on-scroll (anime.js)
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
   * 7. Jalankan
   * ================================================================= */
  applyLang(store('dh-lang') === 'id' ? 'id' : 'en');
  syncThemeLabel();
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
