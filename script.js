// MIA Trading System — site institucional
// Alterna PT/EN via ?lang= na URL (sem localStorage), e propaga o idioma
// atual para todos os links internos de navegação.
(function () {
  var params = new URLSearchParams(window.location.search);
  var lang = params.get('lang') === 'en' ? 'en' : 'pt';
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  document.body.classList.add('lang-' + lang);

  function fileName(href) {
    // mantém apenas o arquivo (+ hash), descarta query antiga
    var noQuery = href.split('?')[0];
    return noQuery;
  }

  // Links internos de navegação: preservam o idioma atual
  document.querySelectorAll('a[data-nav]').forEach(function (a) {
    var base = fileName(a.getAttribute('href'));
    a.href = lang === 'en' ? base + '?lang=en' : base;
  });

  // Botões de troca de idioma PT|EN
  document.querySelectorAll('[data-lang-switch]').forEach(function (a) {
    var target = a.getAttribute('data-lang-switch');
    var base = fileName(window.location.pathname.split('/').pop() || 'index.html');
    a.href = target === 'en' ? base + '?lang=en' : base;
    if (target === lang) a.classList.add('on');
  });
})();

// ─── Chuva Matrix de fundo (site inteiro) ───────────────────────────
// Textura decorativa, bem sutil (não é dado nenhum, só ambientação — fica
// atrás dos painéis opacos, só aparece nos vãos/margens). Desliga sozinha
// se o visitante pedir "reduzir movimento" no sistema, e pausa quando a
// aba não está visível pra não gastar bateria à toa.
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.createElement('canvas');
  canvas.id = 'matrix-rain';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);

  var ctx = canvas.getContext('2d');
  var FONT_SIZE = 15;
  var SPEED = 0.5;
  var TRAIL = 0.14; // quanto maior, mais rápido o rastro apaga (mais "limpo")
  var OPACITY = 0.045; // bem discreto — textura, não decoração
  var COLOR = '0,224,64'; // var(--amber) em rgb
  var CHARS = '01ｱｲｳｴｵｶｷｸｹｺABCDEFGHIJKLMNZ$%+−.,'.split('');

  var drops = [], w = 0, h = 0, running = false, raf = null;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    var cols = Math.floor(w / FONT_SIZE);
    drops = new Array(cols).fill(0).map(function () { return Math.random() * -50; });
  }

  function draw() {
    ctx.fillStyle = 'rgba(0,0,0,' + TRAIL + ')';
    ctx.fillRect(0, 0, w, h);
    ctx.font = FONT_SIZE + 'px monospace';
    for (var i = 0; i < drops.length; i++) {
      var ch = CHARS[(Math.random() * CHARS.length) | 0];
      var y = drops[i] * FONT_SIZE;
      ctx.fillStyle = 'rgba(' + COLOR + ',' + OPACITY + ')';
      ctx.fillText(ch, i * FONT_SIZE, y);
      if (y > h && Math.random() > 0.975) drops[i] = 0;
      drops[i] += SPEED * 0.3;
    }
  }

  function loop() {
    if (!running) return;
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() { if (running) return; running = true; loop(); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () {
    document.hidden ? stop() : start();
  });

  resize();
  start();
})();
