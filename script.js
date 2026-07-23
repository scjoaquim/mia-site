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
