#!/usr/bin/env node
// Atualiza data.json com os números ao vivo dos sinais MQL5 (PRO + Essential).
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
  essential: { id: '2382452', label: 'Essential' },
};

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const DATA_JSON_PATH = new URL('../data.json', import.meta.url);

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
  const out = { dd: null, winRate: null, profitFactor: null, profitUsd: null };

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

  const result = {
    balance: widget.balance != null ? fmtBalance(widget.balance) : prev.balance ?? null,
    growth: widget.growth != null ? fmtSignedPct(widget.growth, 2) : prev.growth ?? null,
    growth_usd: full.profitUsd != null ? fmtSignedUsd(full.profitUsd, 2) : prev.growth_usd ?? null,
    growth_positive: widget.growth != null ? widget.growth >= 0 : prev.growth_positive ?? true,
    dd: full.dd != null ? fmtPct(full.dd, 2) : prev.dd ?? null,
    trades: widget.trades != null ? fmtInt(widget.trades) : prev.trades ?? null,
    win_rate: full.winRate != null ? fmtPct(Math.round(full.winRate), 0) : prev.win_rate ?? null,
    profit_factor: full.profitFactor != null ? fmtDecimal(full.profitFactor, 2) : prev.profit_factor ?? null,
  };

  // Falha crítica = nenhum dos 6 campos veio ao vivo nesta rodada (bloqueio
  // total, mudança de layout, etc.) — os tiles ficam com o último valor bom
  // (via prev), mas o run deve aparecer como falho no Actions pra alguém notar.
  const critical = liveCount === 0;
  if (critical) console.error(`[${label}] FALHA CRÍTICA: nenhum campo veio ao vivo nesta rodada.`);

  console.log(`[${label}] ${JSON.stringify(result)}`);
  return { result, critical };
}

async function main() {
  const previous = await loadExisting();

  const [proOut, essentialOut] = await Promise.all([
    buildSignal('pro', SIGNALS.pro, previous),
    buildSignal('essential', SIGNALS.essential, previous),
  ]);

  // Só avança o "generated_at" se algum número realmente mudou. Isso evita
  // um commit novo a cada rodada do cron quando nada mudou na MQL5 (ex.:
  // conta parada, ou falha crítica caindo 100% no fallback) — o passo
  // "commitar se houve mudança" do workflow só encontra diff quando há
  // diferença de verdade.
  const unchanged =
    JSON.stringify(proOut.result) === JSON.stringify(previous.pro || {}) &&
    JSON.stringify(essentialOut.result) === JSON.stringify(previous.essential || {});

  const data = {
    generated_at: unchanged && previous.generated_at ? previous.generated_at : new Date().toISOString(),
    pro: proOut.result,
    essential: essentialOut.result,
  };

  await writeFile(DATA_JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(unchanged ? 'Nada mudou — data.json regravado sem novo timestamp.' : 'data.json atualizado.');

  if (proOut.critical || essentialOut.critical) {
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
