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
  var D = { rush: { min: 1000, rec: 2500 }, pro: { min: 1000, rec: 2500 } };
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
// status usa o horário real do resultados.json.
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
  //    resultados.json. Fica escondida por padrão; só aparece se o fetch der certo.
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
      fetch('resultados.json?t=' + Date.now(), { cache: 'no-store' })
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
        .catch(function () { /* sem resultados.json → linha fica escondida, sem erro visível */ });
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
    { keys: ['MQL5'], pt: 'Serviço oficial da MetaQuotes (criadora do MetaTrader). É onde a MIA publica o histórico ao vivo da conta — não é onde a licença é vendida.', en: "MetaQuotes' official service (makers of MetaTrader). Where MIA publishes the account's live track record — not where the licence is sold." },
    { keys: ['VPS'], pt: 'Um computador na nuvem, ligado 24h, para o robô não parar quando você desliga o seu PC.', en: "A cloud computer, on 24/7, so the robot doesn't stop when your PC is off." },
    { keys: (lang === 'en' ? ['licence', 'license'] : ['licença']), pt: 'O direito de usar o robô por um período. Você paga o período e recebe uma chave; enquanto ela vale, o robô opera.', en: 'The right to use the robot for a period. You pay for the period and get a key; while it is valid, the robot trades.' },
    { keys: (lang === 'en' ? ['Expert Advisor', 'EA'] : ['Expert Advisor', 'EA']), pt: 'O nome técnico de um robô que roda dentro do MetaTrader. É um arquivo que você arrasta para o gráfico.', en: 'The technical name for a robot that runs inside MetaTrader. A file you drag onto a chart.' },
    { keys: (lang === 'en' ? ['minimum lot'] : ['lote mínimo']), pt: 'A menor posição que a corretora aceita. É por causa dele que uma conta pequena acaba arriscando mais do que o alvo.', en: 'The smallest position the broker accepts. It is why a small account ends up risking more than the target.' },
    { keys: (lang === 'en' ? ['signal'] : ['sinal']), pt: 'As ordens de compra e venda que o robô gera. A conta onde ele opera é publicada como sinal na MQL5, para o histórico ser verificável.', en: "The buy and sell orders the robot generates. The account it trades is published as a signal on MQL5 so the record is verifiable." }
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

// ─── "Operações ao vivo": dock fixo (site-wide) + quadro em Resultados ───────
// Aditivo. Lê positions.json (gerado no VPS). Some sozinho se não houver dado.
// Mercado aberto: linha/preço/P&L passeiam ANCORADOS no valor real (sync ~2min);
// mercado fechado: congelado. Nada é inventado além da suavização entre syncs.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var en = document.body.classList.contains('lang-en');
  var N = 30, DKW = 180, DKH = 38, BDW = 200, BDH = 40, PADY = 5;
  var LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
  function nf(v, d) { return Number(v).toLocaleString(en ? 'en-US' : 'pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function money(v) { return 'US$ ' + nf(Math.abs(v), 2); }
  function money0(v) { return 'US$ ' + Math.abs(Math.round(v)).toLocaleString(en ? 'en-US' : 'pt-BR'); }
  function signed(v, f) { return (v < 0 ? '−' : '+') + f(Math.abs(v)); }
  function decFor(s) { return /XAU/.test(s) ? 1 : (/TSLA|ORCL/.test(s) ? 2 : 0); }
  function tfLabel(tf) {
    if (!en || !tf) return tf || '';
    return tf.replace('metal', 'metal').replace('índice', 'index').replace('cripto', 'crypto').replace('ação', 'stock');
  }
  var T = {
    ao: en ? 'Live operations' : 'Operações ao vivo',
    lbl: en ? 'open result' : 'resultado em aberto',
    all: en ? 'view all' : 'ver tudo',
    closed: en ? 'Market closed' : 'Mercado fechado',
    live: en ? 'live' : 'ao vivo',
    price: en ? 'price ' : 'preço ',
    last: en ? 'last ' : 'último ',
    foot: en ? 'Real open positions of the PRO account — in profit and in loss, nothing hidden. Past performance does not guarantee future results.'
             : 'Posições reais da conta PRO — em lucro e em prejuízo, sem esconder. Desempenho passado não garante resultados futuros.'
  };
  function cntTxt(n, o) { return en ? (n + ' positions · ' + o + ' open') : (n + ' posições · ' + o + ' abertos'); }
  function mktTxt(o, n) { return en ? (o + ' of ' + n + ' markets open') : (o + ' de ' + n + ' mercados abertos'); }
  var boardLink = 'resultados.html' + (en ? '?lang=en' : '') + '#mia-board';

  // ---- DOM do dock ----
  var dock = document.createElement('div'); dock.id = 'md-dock';
  dock.innerHTML =
    '<div class="md-top"><span class="md-dot"></span><span class="md-ao">' + T.ao + '</span>' +
    '<span class="md-sep">|</span><span class="md-lbl">' + T.lbl + '</span> <span class="md-tot" id="md-tot">—</span>' +
    '<span class="md-sep">|</span><span class="md-cnt" id="md-cnt"></span>' +
    '<a class="md-cta" href="' + boardLink + '">' + T.all + ' →</a></div>' +
    '<div class="md-row" id="md-row"></div>';
  document.body.appendChild(dock);
  var mdRow = document.getElementById('md-row');

  var boardEl = document.getElementById('mia-board');   // só existe em Resultados
  var mbRow = null, mbTot = null, mbMk = null;
  if (boardEl) {
    boardEl.className = 'section';
    boardEl.innerHTML =
      '<div class="section-tag">// ' + (en ? 'Live operations' : 'Operações ao vivo') + '</div>' +
      '<div class="mb-panel">' +
        '<div class="mb-head"><span class="mb-name"><span class="mb-dot"></span>' + T.ao + '</span>' +
          '<span class="mb-mk" id="mb-mk"></span>' +
          '<span class="mb-tot">' + T.lbl + ' <span class="mb-v" id="mb-tot">—</span></span></div>' +
        '<div id="mb-rows"></div>' +
        '<div class="mb-foot">' + T.foot + '</div>' +
      '</div>';
    mbRow = boardEl.querySelector('#mb-rows'); mbTot = boardEl.querySelector('#mb-tot'); mbMk = boardEl.querySelector('#mb-mk');
  }

  var state = {};       // id -> position state (+ bindings)
  var started = false;

  function smooth(pp) {
    if (pp.length < 2) return '';
    var d = 'M' + pp[0].x.toFixed(2) + ' ' + pp[0].y.toFixed(2);
    for (var i = 0; i < pp.length - 1; i++) {
      var p0 = pp[i - 1] || pp[i], p1 = pp[i], p2 = pp[i + 1], p3 = pp[i + 2] || p2;
      var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6, c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += ' C' + c1x.toFixed(2) + ' ' + c1y.toFixed(2) + ' ' + c2x.toFixed(2) + ' ' + c2y.toFixed(2) + ' ' + p2.x.toFixed(2) + ' ' + p2.y.toFixed(2);
    }
    return d;
  }
  function drawBind(p, b) {
    var slot = b.W / N, off = p.open ? p.frac : 0;
    var rmn = Infinity, rmx = -Infinity, i;
    for (i = 0; i < p.pts.length; i++) { if (p.pts[i] < rmn) rmn = p.pts[i]; if (p.pts[i] > rmx) rmx = p.pts[i]; }
    if (p.cur < rmn) rmn = p.cur; if (p.cur > rmx) rmx = p.cur;
    b.mn += (rmn - b.mn) * 0.12; b.mx += (rmx - b.mx) * 0.12;
    var r = (b.mx - b.mn) || 1, lo = b.mn - r * 0.2, hi = b.mx + r * 0.2;
    function Y(v) { return b.H - PADY - (v - lo) / (hi - lo) * (b.H - 2 * PADY); }
    var pp = [];
    for (i = 0; i <= N; i++) pp.push({ x: (i - off) * slot, y: Y(p.pts[i]) });
    pp.push({ x: b.W, y: Y(p.cur) });
    var win = p._disp >= 0, col = p.open ? (win ? '#00ff88' : '#ff3030') : '#2c6a43';
    var line = smooth(pp);
    b.ln.setAttribute('d', line); b.ln.setAttribute('stroke', col);
    b.ar.setAttribute('d', line + ' L' + b.W + ' ' + b.H + ' L0 ' + b.H + ' Z');
    b.ar.setAttribute('fill', p.open ? (win ? 'rgba(0,255,136,.11)' : 'rgba(255,48,48,.11)') : 'rgba(44,106,67,.06)');
    b.dt.setAttribute('cx', b.W); b.dt.setAttribute('cy', Y(p.cur).toFixed(2)); b.dt.setAttribute('fill', p.open ? col : '#204d31');
  }

  function ensureViews(pos) {
    var s = state[pos.id];
    if (s) return s;
    var dec = decFor(pos.symbol);
    s = { id: pos.id, dec: dec, pts: [], cur: pos.price, target: pos.price, frac: 0, band: 1,
          anchorPrice: pos.price, anchorPnl: pos.profit_usd || 0, anchorPct: (pos.pct == null ? 0 : pos.pct),
          dir: (pos.side === 'SELL' ? -1 : 1), _disp: pos.profit_usd || 0, _init: false, binds: [] };
    // seed série
    var seed = (pos.series && pos.series.length) ? pos.series.slice(-(N + 1)) : [pos.price];
    while (seed.length < N + 1) seed.unshift(seed[0]);
    s.pts = seed.slice(); s.cur = seed[seed.length - 1];

    // tile do dock
    var tile = document.createElement('div'); tile.className = 'md-tile';
    tile.innerHTML =
      '<div class="md-head"><span class="md-sym">' + pos.symbol + '</span><span class="md-sidewrap"></span></div>' +
      '<span class="md-frzwrap"></span>' +
      '<svg class="md-spark" viewBox="0 0 ' + DKW + ' ' + DKH + '" preserveAspectRatio="none"><path class="ar"/><path class="ln" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle class="dt" r="2.3"/></svg>' +
      '<div class="md-foot"><span class="md-pnl" data-pnl></span><span class="md-pc" data-pc></span></div>';
    mdRow.appendChild(tile);
    s.tile = tile; s._dkSide = tile.querySelector('.md-sidewrap'); s._dkFrz = tile.querySelector('.md-frzwrap');
    s._dkPnl = tile.querySelector('[data-pnl]'); s._dkPc = tile.querySelector('[data-pc]');
    s.binds.push({ ln: tile.querySelector('.ln'), ar: tile.querySelector('.ar'), dt: tile.querySelector('.dt'), W: DKW, H: DKH, mn: 0, mx: 1 });

    // linha do quadro (só em Resultados)
    if (mbRow) {
      var row = document.createElement('div'); row.className = 'mb-row';
      row.innerHTML =
        '<span class="mb-sym">' + pos.symbol + '<span class="mb-tf">' + tfLabel(pos.tf) + '</span></span>' +
        '<span class="mb-sidecell"></span>' +
        '<span class="mb-sparkwrap"><svg class="mb-spark" viewBox="0 0 ' + BDW + ' ' + BDH + '" preserveAspectRatio="none"><path class="ar"/><path class="ln" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle class="dt" r="2.4"/></svg><span class="mb-frzwrap"></span></span>' +
        '<span class="mb-lvls"></span>' +
        '<span class="mb-pnl"><span class="mb-v" data-bpnl></span><br><span class="mb-pc" data-bpc></span></span>';
      mbRow.appendChild(row);
      s.row = row; s._bdSide = row.querySelector('.mb-sidecell'); s._bdFrz = row.querySelector('.mb-frzwrap');
      s._bdLvls = row.querySelector('.mb-lvls'); s._bdPnl = row.querySelector('[data-bpnl]'); s._bdPc = row.querySelector('[data-bpc]');
      s.binds.push({ ln: row.querySelector('.ln'), ar: row.querySelector('.ar'), dt: row.querySelector('.dt'), W: BDW, H: BDH, mn: 0, mx: 1 });
    }
    s.binds.forEach(function (b) { b.mn = Math.min.apply(null, s.pts); b.mx = Math.max.apply(null, s.pts); });
    state[pos.id] = s;
    return s;
  }

  function applyData(data) {
    // trava de validade: dado velho nao pode ser apresentado como estado atual
    var STALE_MS = 15 * 60 * 1000;
    var _g = data && data.generated_at
      ? Date.parse(String(data.generated_at).replace(' UTC', 'Z').replace(' ', 'T'))
      : NaN;
    if (!isFinite(_g) || (Date.now() - _g) > STALE_MS) {
      dock.classList.remove('md-on');
      if (boardEl) boardEl.setAttribute('hidden', '');
      return;
    }
    var arr = (data && data.positions) || [];
    if (!arr.length) { dock.classList.remove('md-on'); if (boardEl) boardEl.setAttribute('hidden', ''); return; }
    var seen = {};
    arr.forEach(function (pos) {
      seen[pos.id] = 1;
      var s = ensureViews(pos);
      s.open = !!pos.market_open; s._pos = pos; s._disp = pos.profit_usd || 0;
      var buy = pos.side !== 'SELL', sideCls = buy ? 'md-buy' : 'md-sell';
      if (pos.market_open) {
        s.anchorPrice = pos.price; s.anchorPnl = pos.profit_usd || 0; s.anchorPct = (pos.pct == null ? 0 : pos.pct);
        s.dir = buy ? 1 : -1;
        s.band = Math.abs(pos.price) * (/BTC|ETH/.test(pos.symbol) ? 0.0004 : 0.00022);
        if (!s._init) { s._init = true; s.cur = pos.price; s.target = pos.price; }
      } else {
        if (pos.series && pos.series.length) { s.pts = pos.series.slice(-(N + 1)); while (s.pts.length < N + 1) s.pts.unshift(s.pts[0]); }
        s.cur = s.pts[s.pts.length - 1]; s.frac = 0; s._init = true;
      }
      // dock: lado/ao vivo + selo fechado + P&L
      s._dkSide.innerHTML = '<span class="md-side ' + sideCls + '">' + pos.side + '</span>' + (pos.market_open ? '<span class="md-livedot"></span>' : '');
      // no dock, tiles fechados omitem o badge (só o selo); simplifica: mantém badge escondido no fechado
      if (!pos.market_open) s._dkSide.innerHTML = '';
      s._dkFrz.innerHTML = pos.market_open ? '' : '<span class="md-frz">' + LOCK + ' ' + T.closed + '</span>';
      s.tile.classList.toggle('md-closed', !pos.market_open);
      s._dkPnl.textContent = signed(pos.profit_usd, money); s._dkPnl.className = 'md-pnl ' + (pos.profit_usd >= 0 ? 'md-pos' : 'md-neg');
      s._dkPc.textContent = (pos.pct == null ? '' : signed(pos.pct, function (x) { return nf(x, 2); }) + '%');
      // board
      if (mbRow && s.row) {
        s._bdSide.innerHTML = '<span class="mb-side ' + (buy ? 'mb-buy' : 'mb-sell') + '">' + pos.side + '</span>' + (pos.market_open ? '<span class="mb-status"><span class="mb-d"></span>' + T.live + '</span>' : '');
        s._bdFrz.innerHTML = pos.market_open ? '' : '<span class="mb-frz">' + LOCK + ' ' + T.closed + '</span>';
        s.row.classList.toggle('mb-closed', !pos.market_open);
        s._bdLvls.innerHTML = (pos.market_open ? T.price : T.last) + '<b class="mb-cur">' + nf(pos.price, s.dec) + '</b>' + (pos.market_open ? '' : '<br><span class="mb-reopen">' + (pos.reopen || '') + '</span>');
        s._bdCur = s._bdLvls.querySelector('.mb-cur');
        s._bdPnl.textContent = signed(pos.profit_usd, money); s._bdPnl.className = 'mb-v ' + (pos.profit_usd >= 0 ? 'mb-pos' : 'mb-neg');
        s._bdPc.textContent = (pos.pct == null ? '' : signed(pos.pct, function (x) { return nf(x, 2); }) + '%');
      }
    });
    // remove sumidos
    Object.keys(state).forEach(function (id) {
      if (!seen[id]) { var s = state[id]; if (s.tile) s.tile.remove(); if (s.row) s.row.remove(); delete state[id]; }
    });
    var n = arr.length, nOpen = arr.filter(function (p) { return p.market_open; }).length;
    document.getElementById('md-cnt').textContent = cntTxt(n, nOpen);
    if (mbMk) mbMk.textContent = mktTxt(nOpen, n);
    dock.classList.add('md-on');
    if (boardEl) boardEl.removeAttribute('hidden');
    if (!started && !reduce) { started = true; requestAnimationFrame(frame); }
    else if (reduce) { renderStatic(); }
  }

  function renderStatic() {
    Object.keys(state).forEach(function (id) { var s = state[id]; s.binds.forEach(function (b) { drawBind(s, b); }); });
    updateTotals();
  }
  function updateTotals() {
    var tot = 0; Object.keys(state).forEach(function (id) { tot += (state[id]._disp || 0); });
    var te = document.getElementById('md-tot'); te.textContent = signed(tot, money0); te.className = 'md-tot ' + (tot >= 0 ? '' : 'md-neg');
    if (mbTot) { mbTot.textContent = signed(tot, money0); mbTot.className = 'mb-v ' + (tot >= 0 ? '' : 'mb-neg'); }
  }

  function frame(now) {
    var dt = frame._l ? now - frame._l : 16; frame._l = now; if (dt > 60) dt = 60;
    Object.keys(state).forEach(function (id) {
      var s = state[id];
      // NAO sintetizar preco/P&L entre sincronizacoes: mostrar o ultimo valor real.
      // (o passeio aleatorio anterior animava numeros inventados sob o rotulo "posicoes reais")
      s.binds.forEach(function (b) { drawBind(s, b); });
    });
    updateTotals();
    requestAnimationFrame(frame);
  }

  function pull() {
    fetch('positions.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(applyData)
      .catch(function () { dock.classList.remove('md-on'); if (boardEl) boardEl.setAttribute('hidden', ''); });
  }
  pull();
  setInterval(function () { if (!document.hidden) pull(); }, 60000);
})();
