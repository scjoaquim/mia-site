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

// ─── Fonte única dos depósitos ──────────────────────────────────────
// Um só lugar define mínimo e recomendado de cada produto. Todo elemento
// [data-deposit="produto.campo"] recebe o valor formatado no idioma atual.
// O número já escrito no HTML é fallback — aparece igual mesmo sem JS.
(function () {
  var D = { essential: { min: 2000, rec: 2000 }, pro: { min: 4000, rec: 4000 } };
  var en = document.body.classList.contains('lang-en');
  function money(n) { return 'US$ ' + n.toLocaleString(en ? 'en-US' : 'pt-BR'); }
  document.querySelectorAll('[data-deposit]').forEach(function (el) {
    var p = el.getAttribute('data-deposit').split('.');
    var v = D[p[0]] && D[p[0]][p[1]];
    if (v != null) el.textContent = money(v);
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

// ─── Efeitos "terminal ao vivo" (typewriter, decode ao rolar, status) ──────
// Todos são progressivos: se o JS não rodar ou o visitante pedir "reduzir
// movimento", o conteúdo continua legível/estático. Nada aqui inventa dado —
// o decode só embaralha até o MESMO texto que já está no HTML, e a linha de
// status usa o horário real do data.json.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CIPHER = '0123456789$US%,.~−+ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // 1. DIGITAÇÃO — elementos com [data-typewriter] são "digitados" ao carregar
  function typewriter(el) {
    var full = el.textContent;
    if (reduce || !full) { return; }
    el.textContent = '';
    var cursor = document.createElement('span');
    cursor.className = 'tw-cursor';
    cursor.textContent = '█';
    el.appendChild(cursor);
    var i = 0;
    var timer = setInterval(function () {
      i++;
      cursor.insertAdjacentText('beforebegin', full[i - 1]);
      if (i >= full.length) {
        clearInterval(timer);
        setTimeout(function () { if (cursor.parentNode) cursor.remove(); }, 900);
      }
    }, 40);
  }
  document.querySelectorAll('[data-typewriter]').forEach(typewriter);

  // 2. DECODE ao rolar — .js-decode embaralha até o próprio texto quando entra
  //    na tela (uma vez). Mesmo efeito dos tiles de Resultados.
  function decode(el, dur) {
    var target = el.getAttribute('data-final');
    if (target == null) { target = el.textContent; el.setAttribute('data-final', target); }
    if (reduce) { el.textContent = target; return; }
    dur = dur || 700;
    var len = target.length, startT = performance.now();
    function frame(now) {
      var t = Math.min(1, (now - startT) / dur);
      var locked = Math.floor(t * len), out = '';
      for (var j = 0; j < len; j++) {
        if (j < locked || target[j] === ' ') out += target[j];
        else out += CIPHER[(Math.random() * CIPHER.length) | 0];
      }
      el.textContent = out;
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = target;
    }
    requestAnimationFrame(frame);
  }
  var decodeEls = document.querySelectorAll('.js-decode');
  if (decodeEls.length && !reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var el = e.target;
          io.unobserve(el);
          setTimeout(function () { decode(el); }, (+el.getAttribute('data-decode-delay') || 0));
        }
      });
    }, { threshold: 0.6 });
    decodeEls.forEach(function (el) { io.observe(el); });
  }

  // 3. LINHA DE STATUS — "SISTEMA ATIVO · atualizado há X" com horário real do
  //    data.json. Fica escondida por padrão; só aparece se o fetch der certo.
  function relTime(iso, en) {
    var then = new Date(iso).getTime();
    if (isNaN(then)) return null;
    var min = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (min < 1) return en ? 'moments ago' : 'agora mesmo';
    if (min < 60) return en ? min + ' min ago' : 'há ' + min + ' min';
    var h = Math.round(min / 60);
    if (h < 24) return en ? h + 'h ago' : 'há ' + h + ' h';
    var d = Math.round(h / 24);
    return en ? d + 'd ago' : 'há ' + d + ' d';
  }
  var statusEls = document.querySelectorAll('[data-live-status]');
  if (statusEls.length) {
    var fillStatus = function () {
      fetch('data.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (res) { if (!res.ok) throw 0; return res.json(); })
        .then(function (data) {
          if (!data.generated_at) throw 0;
          statusEls.forEach(function (s) {
            s.querySelectorAll('[data-live-ago]').forEach(function (b) {
              var en = !!b.closest('.lang-en');
              var txt = relTime(data.generated_at, en);
              if (txt) b.textContent = txt;
            });
            s.classList.add('on');
          });
        })
        .catch(function () { /* sem data.json → linha fica escondida, sem erro visível */ });
    };
    fillStatus();
    setInterval(function () { if (!document.hidden) fillStatus(); }, 60000);
  }
})();

// ─── Glossário automático: tooltip nos termos técnicos ───────────────────────
// Enfia o mesmo tooltip (.tip) na 1ª vez que cada termo-chave aparece dentro do
// <main> de qualquer página (MQL5, sinal, MetaTrader, Exness, etc). Só a 1ª
// ocorrência por página, pra não poluir. Pula links, títulos, .tip já existentes,
// blocos .no-gloss e o texto do idioma que não está ativo. Não inventa nada — só
// marca palavras que já estão no HTML.
(function () {
  if (/glossario\.html$/.test(location.pathname)) return; // a própria página de termos não precisa
  var main = document.querySelector('main'); if (!main) return;
  var lang = document.body.classList.contains('lang-en') ? 'en' : 'pt';
  var otherLang = lang === 'pt' ? 'lang-en' : 'lang-pt';
  var TERMS = [
    { keys: ['Exness'], pt: 'Corretora onde você abre a sua conta e deposita — o seu dinheiro fica lá e é você quem controla. É a que recomendamos.', en: 'The broker where you open your account and deposit — your money stays there and you control it. The one we recommend.' },
    { keys: ['MetaQuotes'], pt: 'A empresa que criou o MetaTrader e a MQL5.', en: 'The company that created MetaTrader and MQL5.' },
    { keys: ['MetaTrader 5', 'MetaTrader', 'MT5'], pt: 'O programa (gratuito) que executa as ordens de compra e venda na sua conta.', en: 'The free program that executes the buy and sell orders on your account.' },
    { keys: ['MQL5'], pt: 'Serviço oficial de cópia de operações da MetaQuotes (criadora do MetaTrader). É por onde você assina o sinal.', en: "MetaQuotes' official copy-trading service (makers of MetaTrader). It's where you subscribe to the signal." },
    { keys: ['VPS'], pt: 'Um computador na nuvem, ligado 24h, para a cópia não parar quando você desliga o seu PC.', en: "A cloud computer, on 24/7, so copying doesn't stop when your PC is off." },
    { keys: (lang === 'en' ? ['signal'] : ['sinal']), pt: 'As ordens de compra e venda do robô; você assina e elas são copiadas na sua conta.', en: "The robot's buy and sell orders; you subscribe and they get copied to your account." }
  ];
  var SKIP = { A: 1, BUTTON: 1, SCRIPT: 1, STYLE: 1, CODE: 1, H1: 1, H2: 1 };
  function eligible(node) {
    if (!node.nodeValue || !/\S/.test(node.nodeValue)) return false;
    var p = node.parentNode;
    while (p && p !== main.parentNode) {
      if (p.nodeType === 1) {
        if (SKIP[p.tagName]) return false;
        if (p.classList && (p.classList.contains('tip') || p.classList.contains('no-gloss') || p.classList.contains(otherLang))) return false;
      }
      p = p.parentNode;
    }
    return true;
  }
  function textNodes() {
    var out = [], tw = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, null), n;
    while (n = tw.nextNode()) if (eligible(n)) out.push(n);
    return out;
  }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function wrap(term) {
    var re = new RegExp('(^|[^\\wÀ-ÿ])(' + term.keys.map(esc).join('|') + ')(?![\\wÀ-ÿ])', 'i');
    var nodes = textNodes();
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i], m = re.exec(node.nodeValue);
      if (!m) continue;
      var matchStart = m.index + m[1].length, matchText = m[2];
      var tip = document.createElement('span');
      tip.className = 'tip'; tip.tabIndex = 0; tip.setAttribute('role', 'note');
      tip.setAttribute('aria-label', matchText);
      tip.appendChild(document.createTextNode(matchText));
      var box = document.createElement('span'); box.className = 'tip-box'; box.textContent = term[lang];
      tip.appendChild(box);
      var mid = node.splitText(matchStart);
      mid.splitText(matchText.length);
      mid.parentNode.replaceChild(tip, mid);
      return true;
    }
    return false;
  }
  TERMS.forEach(wrap);
})();

// ─── Posicionamento do tooltip: nunca deixa a caixa vazar da tela ────────────
// No hover/foco de qualquer .tip, alinha a caixa e a empurra pra dentro da tela
// se estiver passando da borda (esq/dir). A setinha continua apontando o termo.
(function () {
  function place(tip) {
    var box = tip.querySelector('.tip-box'); if (!box) return;
    box.style.left = '0px';
    var tr = tip.getBoundingClientRect(), br = box.getBoundingClientRect();
    var vw = document.documentElement.clientWidth, pad = 8, left = 0;
    var boxRight = br.left + br.width;
    if (boxRight > vw - pad) left = (vw - pad) - boxRight;
    if (br.left + left < pad) left = pad - br.left;
    box.style.left = left + 'px';
    var arrow = (tr.left + tr.width / 2) - (br.left + left);
    arrow = Math.max(10, Math.min(box.offsetWidth - 16, arrow));
    box.style.setProperty('--arrow', arrow + 'px');
  }
  function handler(e) {
    var t = e.target;
    var tip = t && t.closest ? t.closest('.tip') : null;
    if (tip) place(tip);
  }
  document.addEventListener('mouseover', handler, true);
  document.addEventListener('focusin', handler, true);
})();
