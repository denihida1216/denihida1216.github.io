/* ------------------------------------------------------------------ *
 * Asap di latar hero — kepulan lahir mengikuti gerakan kursor, naik,
 * berputar, mengembang, lalu buyar.
 *
 * Supaya terlihat seperti asap sungguhan dan bukan bola gradien:
 *  - tekstur kepulan dibuat dari fractal noise (beberapa oktaf grid acak
 *    yang di-upscale halus), jadi tepinya compang-camping seperti kabut;
 *  - tiap kepulan bergoyang mengikuti sinus dengan fase acak, meniru
 *    pusaran udara, bukan naik lurus;
 *  - kepulan mengembang sambil melambat (drag), memudar cepat di awal
 *    dan lama di akhir;
 *  - yang lebih baru digambar di atas yang lama supaya terlihat menumpuk.
 *
 * Yang menjaganya tetap murah:
 *  - tekstur dirender SEKALI ke kanvas offscreen lalu dipakai ulang;
 *  - gerak berbasis waktu (ms), jadi tidak boros saat frame rate tinggi
 *    dan tidak melambat saat rendah;
 *  - hanya di perangkat berkursor, mati saat prefers-reduced-motion;
 *  - loop rAF berhenti sendiri begitu kepulan terakhir habis.
 * ------------------------------------------------------------------ */
(function () {
  'use strict';

  var canvas = document.getElementById('smoke');
  var hero = document.getElementById('beranda');
  if (!canvas || !hero || !canvas.getContext) return;

  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine.matches) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var ctx = canvas.getContext('2d');
  var root = document.documentElement;

  var MAX = 80;            // batas kepulan hidup
  var SPAWN_DIST = 9;      // jarak gerak kursor sebelum kepulan baru lahir
  var SPAWN_MS = 22;       // jeda minimum antar kepulan
  var TEX = 192;           // sisi tekstur kepulan
  var VARIANTS = 3;        // ragam bentuk supaya tidak kembar
  var DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  var puffs = [];
  var sprites = null;
  var running = false;
  var lastTime = 0;
  var lastX = 0, lastY = 0, lastSpawn = 0, pointerVx = 0, pointerVy = 0;
  var width = 0, height = 0;

  /* ---------------------------------------------------------------- *
   * Tekstur: fractal noise (alpha acak yang di-upscale halus, beberapa
   * oktaf) lalu dipotong falloff radial dan diwarnai.
   * ---------------------------------------------------------------- */
  function noiseOctave(g, cells, alpha) {
    var s = document.createElement('canvas');
    s.width = s.height = cells;
    var sg = s.getContext('2d');
    var img = sg.createImageData(cells, cells);
    for (var i = 0; i < cells * cells; i++) {
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = Math.random() * 255;
    }
    sg.putImageData(img, 0, 0);
    g.globalAlpha = alpha;
    g.drawImage(s, 0, 0, TEX, TEX); // upscale = interpolasi halus
  }

  function makeTexture(color) {
    var c = document.createElement('canvas');
    c.width = c.height = TEX;
    var g = c.getContext('2d');

    // gumpalan dasar + detail yang makin halus
    noiseOctave(g, 3, 1);
    noiseOctave(g, 5, 0.8);
    noiseOctave(g, 9, 0.5);
    noiseOctave(g, 18, 0.28);
    noiseOctave(g, 32, 0.15);
    g.globalAlpha = 1;

    // potong jadi gumpalan bundar dengan tepi lembut
    var mask = g.createRadialGradient(TEX / 2, TEX / 2, 0, TEX / 2, TEX / 2, TEX / 2);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.45, 'rgba(0,0,0,0.85)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = mask;
    g.fillRect(0, 0, TEX, TEX);

    // warnai tanpa mengubah alpha
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, TEX, TEX);

    g.globalCompositeOperation = 'source-over';
    return c;
  }

  function isDark() {
    return root.getAttribute('data-theme') === 'dark';
  }

  function buildSprites() {
    // Asap terang di tema gelap, asap kelabu di tema terang.
    var palette = isDark()
      ? ['rgb(186,230,253)', 'rgb(199,210,254)', 'rgb(226,232,240)']
      : ['rgb(100,116,139)', 'rgb(129,140,248)', 'rgb(148,163,184)'];
    sprites = [];
    for (var v = 0; v < VARIANTS; v++) sprites.push(makeTexture(palette[v % palette.length]));
  }

  /* ---------------------------------------------------------------- */
  function resize() {
    var rect = hero.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * DPR);
    canvas.height = Math.round(height * DPR);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function spawn(x, y) {
    if (puffs.length >= MAX) puffs.shift();
    puffs.push({
      x: x + (Math.random() - 0.5) * 22,
      y: y + (Math.random() - 0.5) * 22,
      vx: pointerVx * 6 + (Math.random() - 0.5) * 26,   // px/detik
      vy: -26 - Math.random() * 30 + pointerVy * 2,
      size: 90 + Math.random() * 70,
      grow: 46 + Math.random() * 40,                    // px/detik
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.5,                // rad/detik
      swayAmp: 10 + Math.random() * 22,                 // px/detik
      swayFreq: 0.8 + Math.random() * 1.1,              // rad/detik
      phase: Math.random() * Math.PI * 2,
      age: 0,
      span: 2800 + Math.random() * 1600,                // ms
      tex: (Math.random() * VARIANTS) | 0
    });
  }

  function frame(now) {
    // Tekstur bisa dibatalkan di tengah animasi saat tema berganti —
    // bangun ulang di sini, jangan sampai loop melempar dan mati diam.
    if (!sprites) buildSprites();

    var dt = Math.min((now - lastTime) / 1000, 0.05); // detik, dibatasi saat tab kembali aktif
    lastTime = now;

    ctx.clearRect(0, 0, width, height);

    var dark = isDark();
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    var peak = dark ? 0.62 : 0.22;

    for (var i = 0; i < puffs.length; i++) {
      var p = puffs[i];
      p.age += dt * 1000;
      if (p.age >= p.span) { puffs.splice(i--, 1); continue; }

      var t = p.age / p.span;

      // naik, melambat karena hambatan udara, sambil bergoyang
      p.vx *= 1 - 0.55 * dt;
      p.vy *= 1 - 0.35 * dt;
      p.x += (p.vx + Math.sin(p.age / 1000 * p.swayFreq + p.phase) * p.swayAmp) * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
      p.rot += p.spin * dt;

      // muncul cepat, buyar perlahan
      var a = t < 0.14 ? t / 0.14 : Math.pow(1 - (t - 0.14) / 0.86, 1.7);
      ctx.globalAlpha = a * peak;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.drawImage(sprites[p.tex], -p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    if (puffs.length) window.requestAnimationFrame(frame);
    else running = false;
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    window.requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- */
  function onPointerMove(e) {
    if (reduced.matches) return;
    if (!sprites) buildSprites();

    var rect = hero.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;

    pointerVx = x - lastX;
    pointerVy = y - lastY;

    var moved = Math.hypot(x - lastX, y - lastY);
    if (moved > SPAWN_DIST && e.timeStamp - lastSpawn > SPAWN_MS) {
      spawn(x, y);
      lastSpawn = e.timeStamp;
      lastX = x;
      lastY = y;
      start();
    }
  }

  function clear() {
    puffs.length = 0;
    ctx.clearRect(0, 0, width, height);
  }

  resize();
  hero.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('resize', resize, { passive: true });

  new MutationObserver(function () { sprites = null; })
    .observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  reduced.addEventListener('change', function () {
    if (reduced.matches) clear();
  });
})();
