#!/usr/bin/env node
// Atualiza data.json com os números ao vivo do sinal MQL5 PRO — o único produto.
// Roda via GitHub Actions (scheduled). Sem dependências externas — usa fetch
// nativo do Node 20+ e regex tolerante para não quebrar se a MQL5 mudar
// espaçamento/atributos, mas ainda assim mantém a estrutura de classes atual.
//
// Estratégia (ver memória do projeto "tiles ao vivo"):
//  - Saldo, Crescimento e Operações vêm do WIDGET (mesma fonte que o iframe
//    ao vivo mostra ao lado dos tiles, pra bater com o que o visitante vê).
//  - DD máx, Acerto e Profit Factor não aparecem no widget — vêm da página
//    completa do sinal.
//
// Falha de um campo isolado não derruba os outros: se uma extração falhar,
// mantém o valor anterior (do data.json existente) e loga um aviso.

import { readFile, writeFile } from 'node:fs/promises';

const SIGNALS = {
  pro: { id: '2381728', label: 'PRO' },
};

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const DATA_JSON_PATH = new URL('../data.json', import.meta.url);
const RESULTADOS_PATH = new URL('../resultados.html', import.meta.url);

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ao buscar ${url}`);
  }
  return res.text();
}

// Extrai um número em formato MQL5 ("4 328.19", "1,234.56", "11.25") pra float.
export function parseNum(raw) {
  if (raw == null) return null;
  const cleaned = String(raw)
    .replace(/&nbsp;|&#0*160;/gi, '') // entidade nbsp (milhar no HTML cru da MQL5)
    .replace(/[\s\u00a0\u2009\u202f]/g, '') // espaços/nbsp literais
    .replace(/,/g, ''); // vírgula de milhar (se aparecer)
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function classAttr(name) {
  // aceita a classe em qualquer posição dentro do atributo class="..."
  return `class="[^"]*\\b${name}\\b[^"]*"`;
}

export function extractWidget(html, label) {
  const out = { balance: null, growth: null, trades: null };

  // Saldo: pega o trecho do <h3> até "USD", remove TAGS e ENTIDADES e lê o número.
  // ⚠ No HTML CRU que o servidor recebe, o separador de milhar vem como a ENTIDADE
  // &nbsp; (não um espaço), ex: <span>4&nbsp;437.33</span>&nbsp;USD — uma regex de
  // classe de caracteres parava no "&" e capturava só "437.33" (perdia o milhar).
  // Limpar tags/entidades e deixar o parseNum ler é bem mais robusto.
  function grabBalance(re) {
    const m = html.match(re);
    if (!m) return null;
    const cleaned = m[1].replace(/<[^>]*>/g, '').replace(/&nbsp;|&#0*160;/gi, '');
    const n = parseNum(cleaned);
    return n != null ? n : null;
  }
  const bal = grabBalance(/<h3\b[^>]*>([\s\S]{0,200}?)USD/i) || grabBalance(/>\s*(\d[^<]{0,40}?)\s*USD/i);
  if (bal != null) out.balance = bal;
  else console.warn(`[${label}] widget: não achei o Saldo`);

  const mGrowth = html.match(/Growth:\s*<\/dt>\s*<dd[^>]*>\s*(-?[\d.,]+)\s*%\s*<\/dd>/i);
  if (mGrowth) out.growth = parseNum(mGrowth[1]);
  else console.warn(`[${label}] widget: não achei o Crescimento`);

  const mTrades = html.match(/Trades:\s*<\/dt>\s*<dd[^>]*>\s*([\d.,\s ]+)\s*<\/dd>/i);
  if (mTrades) out.trades = parseNum(mTrades[1]);
  else console.warn(`[${label}] widget: não achei Operações`);

  return out;
}

// Acha o valor de um item "s-data-columns__label">LABEL</div> ... __value">VALOR</div>
export function findDataColumnValue(html, labelText) {
  const escaped = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `${classAttr('s-data-columns__label')}[^>]*>\\s*${escaped}\\s*<\\/div>\\s*<div\\s+${classAttr(
      's-data-columns__value'
    )}[^>]*>([\\s\\S]{0,120}?)<\\/div>`,
    'i'
  );
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

// Igual ao anterior, mas pro bloco de topo "s-list-info__label"/"s-list-info__value"
// (Balance/Growth/Profit/Equity/Initial Deposit — o mesmo bloco que também mostra
// no widget, só que com mais campos na página completa).
export function findListInfoValue(html, labelText) {
  const escaped = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `${classAttr('s-list-info__label')}[^>]*>\\s*${escaped}\\s*<\\/div>\\s*<div\\s+${classAttr(
      's-list-info__value'
    )}[^>]*>([\\s\\S]{0,120}?)<\\/div>`,
    'i'
  );
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

export function extractFullPage(html, label) {
  const out = { dd: null, winRate: null, profitFactor: null, profitUsd: null, balanceFull: null, equity: null, initial: null };

  const profitTradesRaw = findDataColumnValue(html, 'Profit Trades:');
  if (profitTradesRaw) {
    const m = profitTradesRaw.match(/\(([\d.,]+)\s*%\)/);
    if (m) out.winRate = parseNum(m[1]);
  }
  if (out.winRate == null) console.warn(`[${label}] página completa: não achei Acerto (Profit Trades)`);

  const maximalRaw = findDataColumnValue(html, 'Maximal:');
  if (maximalRaw) {
    const m = maximalRaw.match(/\(([\d.,]+)\s*%\)/);
    if (m) out.dd = parseNum(m[1]);
  }
  if (out.dd == null) console.warn(`[${label}] página completa: não achei DD máx (Maximal)`);

  const pfRaw = findDataColumnValue(html, 'Profit Factor:');
  if (pfRaw) {
    const m = pfRaw.match(/(-?[\d.,]+)/);
    if (m) out.profitFactor = parseNum(m[1]);
  }
  if (out.profitFactor == null) console.warn(`[${label}] página completa: não achei Profit Factor`);

  // "Profit:" = lucro/prejuízo líquido em USD no período (ajustado por
  // depósitos/saques) — é o campo que a MQL5 mostra ao lado de Growth/Balance
  // pra contas ainda "jovens". Se sumir (conta mais velha, MQL5 muda o que
  // mostra), o front-end simplesmente não exibe o valor em US$ — não é campo
  // crítico, só um complemento do Crescimento em %.
  const profitRaw = findListInfoValue(html, 'Profit:');
  if (profitRaw) {
    // mesma armadilha do saldo: lucro > US$ 999 traz &nbsp; de milhar no HTML cru.
    // Limpa entidades/tags antes de casar o número.
    const cleaned = profitRaw.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#0*160;/gi, '');
    const m = cleaned.match(/(-?[\d.,\s ]+?)\s*USD/i);
    if (m) out.profitUsd = parseNum(m[1]);
  }
  if (out.profitUsd == null) console.warn(`[${label}] página completa: não achei Profit (US$) — campo não crítico, ok se sumir`);

  // Balance e Equity (mesmo bloco s-list-info do topo). A diferença
  // Equity − Balance é o P&L das operações ABERTAS (flutuante) — alimenta o
  // tile "Em aberto". Campo não crítico: se sumir, o tile mantém o valor anterior.
  function usdFromListInfo(labelText) {
    const raw = findListInfoValue(html, labelText);
    if (!raw) return null;
    const cleaned = raw.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#0*160;/gi, '');
    const m = cleaned.match(/(-?[\d.,\s ]+?)\s*USD/i);
    return m ? parseNum(m[1]) : null;
  }
  out.balanceFull = usdFromListInfo('Balance:');
  out.equity = usdFromListInfo('Equity:');
  out.initial = usdFromListInfo('Initial Deposit:');
  if (out.initial == null) console.warn(`[${label}] página completa: não achei o Depósito inicial (Initial Deposit)`);
  if (out.equity == null || out.balanceFull == null) {
    console.warn(`[${label}] página completa: não achei Balance/Equity — tile "Em aberto" fica no valor anterior`);
  }

  return out;
}

// --- formatação no padrão já usado no site (pt-BR: vírgula decimal, ponto de milhar) ---

export function fmtBalance(n) {
  if (n == null) return null;
  return 'US$ ' + Math.round(n).toLocaleString('pt-BR');
}

export function fmtSignedPct(n, decimals) {
  if (n == null) return null;
  const sign = n < 0 ? '−' : '+'; // U+2212 (minus tipográfico), igual ao já usado no site
  return sign + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + '%';
}

export function fmtPct(n, decimals) {
  if (n == null) return null;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + '%';
}

export function fmtInt(n) {
  if (n == null) return null;
  return String(Math.round(n));
}

export function fmtDecimal(n, decimals) {
  if (n == null) return null;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtSignedUsd(n, decimals) {
  if (n == null) return null;
  const sign = n < 0 ? '−' : '+'; // U+2212, igual ao já usado no site
  return sign + 'US$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// --- gráfico de lucro mês a mês (PRO) ---------------------------------------
// Acumula, por mês, o LUCRO CUMULATIVO da conta (campo "Profit" da MQL5) e o
// SALDO no último run daquele mês. O front-end deriva o lucro DO mês = cumulativo
// do mês − cumulativo do mês anterior. Só PRO (decisão do Joaquim).
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function monthLabel(ym) {
  const parts = String(ym).split('-');
  const mi = parseInt(parts[1], 10) - 1;
  if (!(mi >= 0 && mi <= 11)) return String(ym);
  return MESES[mi] + '/' + parts[0].slice(-2);
}

// upsert do mês corrente: se já existe entrada do mês, atualiza; senão adiciona.
// Mantém ordenado por ym. Guarda números (2 casas) pra o front derivar o delta.
export function upsertMonthly(list, ym, cumUsd, bal) {
  const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);
  const out = Array.isArray(list) ? list.map((e) => ({ ...e })) : [];
  const entry = { ym: ym, label: monthLabel(ym), cum_usd: round2(cumUsd), bal: round2(bal) };
  const idx = out.findIndex((e) => e.ym === ym);
  if (idx >= 0) out[idx] = entry;
  else out.push(entry);
  out.sort((a, b) => (a.ym < b.ym ? -1 : a.ym > b.ym ? 1 : 0));
  return out;
}

// --- fallback estatico do resultados.html -----------------------------------
// A pagina traz os numeros escritos no HTML e o JS sobrescreve com o data.json.
// Sem isto, o valor escrito envelhece: em 29-Jul-2026 ele dizia "+6,64%" (de 23-Jul)
// enquanto a conta estava em "−1,38%" — mostrando LUCRO num periodo de PERDA para
// quem esta sem JS, com o fetch falhado, ou no instante antes dele responder.
// Mesmo desenho do sync_fb_fallback.py (ranking): ancora estrita, idempotente, e
// se QUALQUER ancora nao casar exatamente 1x nao grava nada e avisa.

// Mesmo formato que o resultados.html escreve no navegador, pra o estatico e o
// vivo nao se contradizerem na virgula.
export function fmtUpdatedAt(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const pt = d.toLocaleString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' UTC';
  const en = d.toLocaleString('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC';
  return { pt, en };
}

// Cada regra: [nome, regex com 1 grupo de captura por pedaco, funcao que devolve
// o texto novo]. A regex TEM de casar exatamente uma vez.
function fallbackRules(data) {
  const pro = (data && data.pro) || {};
  const cls = pro.total_positive === false ? 'neg' : 'pos';
  const carimbo = fmtUpdatedAt(data && data.generated_at);
  const rules = [];

  const simples = (id, tag, valor) => ({
    nome: id,
    re: new RegExp('(<' + tag + ' [^>]*id="' + id + '">)([^<]*)(</' + tag + '>)'),
    novo: (m) => m[1] + valor + m[3],
    pular: valor == null,
  });

  rules.push(simples('pro-current', 'div', pro.current));
  rules.push(simples('pro-initial', 'span', pro.initial));

  for (const [id, valor] of [['pro-total-usd', pro.total_usd], ['pro-total-pct', pro.total_pct]]) {
    rules.push({
      nome: id,
      re: new RegExp('(<div class="k-val )(pos|neg)(" id="' + id + '">)([^<]*)(</div>)'),
      novo: (m) => m[1] + cls + m[3] + valor + m[5],
      pular: valor == null,
    });
  }

  rules.push({
    nome: 'pro-snapshot-note',
    re: /(<div class="snapshot-note" id="pro-snapshot-note"><span class="lang-pt">)([^<]*)(<\/span><span class="lang-en">)([^<]*)(<\/span><\/div>)/,
    novo: (m) =>
      m[1] + 'Atualizado automaticamente em ' + carimbo.pt + ' · widget ao vivo abaixo' +
      m[3] + 'Auto-updated at ' + carimbo.en + ' · live widget below' + m[5],
    pular: !carimbo,
  });

  const mensal = Array.isArray(data && data.pro_monthly) ? data.pro_monthly : null;
  rules.push({
    nome: 'MONTHLY_FALLBACK',
    re: /(\s*var MONTHLY_FALLBACK = )(\[[^\]]*\])(;)/,
    novo: (m) =>
      m[1] +
      '[' + mensal.map((e) =>
        "{ ym: '" + e.ym + "', label: '" + e.label + "', cum_usd: " + e.cum_usd + ", bal: " + e.bal + ' }'
      ).join(', ') + ']' +
      m[3],
    pular: !mensal || !mensal.length,
  });

  return rules;
}

// Devolve { html, changed, warnings }. NUNCA lanca: falhar aqui nao pode derrubar
// a rodada, porque o data.json (a fonte de verdade) ja foi gravado antes.
export function patchFallbackTiles(html, data) {
  const warnings = [];
  let out = html;
  for (const r of fallbackRules(data)) {
    if (r.pular) { warnings.push(`${r.nome}: sem valor no data.json — mantido como estava`); continue; }
    const achados = out.match(new RegExp(r.re.source, r.re.flags.replace('g', '') + 'g'));
    if (!achados || achados.length !== 1) {
      warnings.push(`${r.nome}: ancora casou ${achados ? achados.length : 0}x (esperado 1) — NADA foi gravado`);
      return { html, changed: false, warnings };
    }
    out = out.replace(r.re, (...args) => r.novo(args));
  }
  return { html: out, changed: out !== html, warnings };
}

async function syncFallbackTiles(data) {
  let html;
  try {
    html = await readFile(RESULTADOS_PATH, 'utf8');
  } catch (err) {
    console.warn('[fallback] nao consegui ler o resultados.html:', err.message);
    return;
  }
  const { html: novo, changed, warnings } = patchFallbackTiles(html, data);
  warnings.forEach((w) => console.warn('[fallback] ' + w));
  if (!changed) { console.log('[fallback] tiles estaticos ja alinhados — nada a gravar.'); return; }
  await writeFile(RESULTADOS_PATH, novo, 'utf8');
  console.log('[fallback] tiles estaticos do resultados.html realinhados ao data.json.');
}

async function loadExisting() {
  try {
    const txt = await readFile(DATA_JSON_PATH, 'utf8');
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

async function buildSignal(key, { id, label }, previous) {
  const prev = previous?.[key] || {};
  let widget = { balance: null, growth: null, trades: null };
  let full = { dd: null, winRate: null, profitFactor: null, profitUsd: null };

  try {
    const widgetHtml = await fetchText(`https://www.mql5.com/en/signals/widget/${id}?t=dark&fw=html`);
    widget = extractWidget(widgetHtml, label);
  } catch (err) {
    console.warn(`[${label}] falha ao buscar o widget: ${err.message}`);
  }

  try {
    const fullHtml = await fetchText(`https://www.mql5.com/en/signals/${id}`);
    full = extractFullPage(fullHtml, label);
  } catch (err) {
    console.warn(`[${label}] falha ao buscar a página completa: ${err.message}`);
  }

  const liveFields = [widget.balance, widget.growth, widget.trades, full.dd, full.winRate, full.profitFactor, full.profitUsd];
  const liveCount = liveFields.filter((v) => v != null).length;

  // P&L em aberto (flutuante) = Equity − Balance da página completa.
  const openUsd = full.equity != null && full.balanceFull != null ? full.equity - full.balanceFull : null;

  // Saldo ATUAL = valor da conta agora, já incluindo as operações em aberto
  // (Equity da MQL5; se faltar, cai pro Balance do widget). O "Crescimento" é
  // simplesmente saldo atual − depósito inicial → embute fechado + em aberto.
  const current = full.equity != null ? full.equity : widget.balance;
  const initial = full.initial;
  const totalUsd = current != null && initial != null ? current - initial : null;
  const totalPct = totalUsd != null && initial ? (totalUsd / initial) * 100 : null;

  const result = {
    balance: widget.balance != null ? fmtBalance(widget.balance) : prev.balance ?? null,
    growth: widget.growth != null ? fmtSignedPct(widget.growth, 2) : prev.growth ?? null,
    growth_usd: full.profitUsd != null ? fmtSignedUsd(full.profitUsd, 2) : prev.growth_usd ?? null,
    growth_positive: widget.growth != null ? widget.growth >= 0 : prev.growth_positive ?? true,
    dd: full.dd != null ? fmtPct(full.dd, 2) : prev.dd ?? null,
    trades: widget.trades != null ? fmtInt(widget.trades) : prev.trades ?? null,
    win_rate: full.winRate != null ? fmtPct(Math.round(full.winRate), 0) : prev.win_rate ?? null,
    profit_factor: full.profitFactor != null ? fmtDecimal(full.profitFactor, 2) : prev.profit_factor ?? null,
    open_usd: openUsd != null ? fmtSignedUsd(openUsd, 2) : prev.open_usd ?? null,
    open_positive: openUsd != null ? openUsd >= 0 : prev.open_positive ?? true,
    current: current != null ? fmtBalance(current) : prev.current ?? null,
    initial: initial != null ? fmtBalance(initial) : prev.initial ?? null,
    total_usd: totalUsd != null ? fmtSignedUsd(totalUsd, 2) : prev.total_usd ?? null,
    total_pct: totalPct != null ? fmtSignedPct(totalPct, 2) : prev.total_pct ?? null,
    total_positive: totalUsd != null ? totalUsd >= 0 : prev.total_positive ?? true,
  };

  // Falha crítica = nenhum dos 6 campos veio ao vivo nesta rodada (bloqueio
  // total, mudança de layout, etc.) — os tiles ficam com o último valor bom
  // (via prev), mas o run deve aparecer como falho no Actions pra alguém notar.
  const critical = liveCount === 0;
  if (critical) console.error(`[${label}] FALHA CRÍTICA: nenhum campo veio ao vivo nesta rodada.`);

  console.log(`[${label}] ${JSON.stringify(result)}`);
  // raw = números crus (pro gráfico mensal): agora usa o crescimento TOTAL
  // (fechado + em aberto = Equity − depósito inicial) e o Equity, pra o gráfico
  // bater com os quadros de retorno (Saldo atual / Crescimento).
  return { result, critical, raw: { equity: current, totalUsd: totalUsd } };
}

async function main() {
  const previous = await loadExisting();

  const proOut = await buildSignal('pro', SIGNALS.pro, previous);

  // Gráfico de lucro mês a mês: upsert do mês corrente com o crescimento
  // TOTAL cumulativo (fechado + em aberto = Equity − depósito inicial) e o Equity.
  // Assim a barra do mês bate com os quadros de retorno. Mês em UTC (runner GitHub).
  const now = new Date();
  const ym = now.getUTCFullYear() + '-' + String(now.getUTCMonth() + 1).padStart(2, '0');
  let proMonthly = Array.isArray(previous.pro_monthly) ? previous.pro_monthly : [];
  if (proOut.raw.totalUsd != null && proOut.raw.equity != null) {
    proMonthly = upsertMonthly(proMonthly, ym, proOut.raw.totalUsd, proOut.raw.equity);
  } else {
    console.warn('[PRO] sem crescimento/equity ao vivo nesta rodada — pro_monthly mantido como estava.');
  }

  // Só avança o "generated_at" se algum número realmente mudou. Isso evita
  // um commit novo a cada rodada do cron quando nada mudou na MQL5 (ex.:
  // conta parada, ou falha crítica caindo 100% no fallback) — o passo
  // "commitar se houve mudança" do workflow só encontra diff quando há
  // diferença de verdade.
  const unchanged =
    JSON.stringify(proOut.result) === JSON.stringify(previous.pro || {}) &&
    JSON.stringify(proMonthly) === JSON.stringify(previous.pro_monthly || []);

  const data = {
    generated_at: unchanged && previous.generated_at ? previous.generated_at : new Date().toISOString(),
    pro: proOut.result,
    pro_monthly: proMonthly,
  };

  await writeFile(DATA_JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(unchanged ? 'Nada mudou — data.json regravado sem novo timestamp.' : 'data.json atualizado.');

  // Mantem os numeros ESCRITOS no resultados.html iguais aos do data.json.
  // Nunca derruba a rodada: o data.json ja esta gravado a esta altura.
  await syncFallbackTiles(data);

  if (proOut.critical) {
    // sai com erro (o job aparece como falho no Actions) mas o commit dos
    // dados de fallback já foi escrito — os tiles do site não quebram.
    process.exitCode = 1;
  }
}

// Só roda main() quando o arquivo é executado diretamente (node scripts/update-tiles.mjs),
// não quando é importado (ex.: pelo update-tiles.test.mjs, que testa as funções puras offline).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Falha geral no update-tiles:', err);
    process.exit(1);
  });
}
