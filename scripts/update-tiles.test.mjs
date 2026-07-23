// Teste offline dos parsers/formatadores do update-tiles.mjs, usando trechos
// de HTML reconstruídos a partir da estrutura real observada ao vivo (via
// Chrome) nas páginas MQL5. Roda sem rede: `node scripts/update-tiles.test.mjs`.

import assert from 'node:assert/strict';
import {
  parseNum,
  extractWidget,
  extractFullPage,
  findDataColumnValue,
  fmtBalance,
  fmtSignedPct,
  fmtPct,
  fmtInt,
  fmtDecimal,
} from './update-tiles.mjs';

// --- amostra do WIDGET (estrutura real: h3>span pro saldo, dl/dt/dd pro resto) ---
const widgetHtmlPro = `
<html><body class="dark">
<div class="wrapper bg">
  <a href="/en/signals/2381728">MIA Trading System PRO</a>
  <h2>Joaquim Severiano De Carvalho Junior</h2>
  <div class="info">
    <h3><span>4 321.23</span> USD</h3>
    <dl>
      <dt>Growth:</dt><dd class="blue">0.69%</dd>
      <dt>Trades:</dt><dd>110</dd>
    </dl>
  </div>
  <a class="btn">Subscribe</a>
  <a class="logo">MQL5.com</a>
</div>
</body></html>`;

const widgetHtmlEssentialNeg = `
<html><body class="dark">
<div class="wrapper bg">
  <div class="info">
    <h3><span>2 009.50</span> USD</h3>
    <dl>
      <dt>Growth:</dt><dd class="red">-4.86%</dd>
      <dt>Trades:</dt><dd>30</dd>
    </dl>
  </div>
</div>
</body></html>`;

// --- amostra da PÁGINA COMPLETA (estrutura real: s-data-columns__item) ---
function dataColumnsItem(label, value, title) {
  return `<div class="s-data-columns__item" title="${title || ''}">
                <div class="s-data-columns__label">${label}</div>
                <div class="s-data-columns__value">${value}</div>
              </div>`;
}

const fullPagePro = `
<html><body>
${dataColumnsItem('Trades:', '110')}
${dataColumnsItem('Profit Trades:', '41 (37.27%)')}
${dataColumnsItem('Loss Trades:', '69 (62.73%)')}
${dataColumnsItem('Maximal consecutive profit:', '255.33 USD (2)')}
${dataColumnsItem('Profit Factor:', '1.02')}
<div class="s-data-columns__item"></div>
${dataColumnsItem('Absolute:', '123.65 USD')}
${dataColumnsItem('Maximal:', '516.72 USD (11.25%)')}
<div class="s-data-columns__item"></div>
${dataColumnsItem('By Balance:', '11.25% (516.72 USD)')}
${dataColumnsItem('By Equity:', '1.45% (62.58 USD)')}
</body></html>`;

const fullPageEssential = `
<html><body>
${dataColumnsItem('Trades:', '30')}
${dataColumnsItem('Profit Trades:', '7 (23.33%)')}
${dataColumnsItem('Profit Factor:', '0.58')}
${dataColumnsItem('Absolute:', '101.32 USD')}
${dataColumnsItem('Maximal:', '121.38 USD (5.77%)')}
</body></html>`;

// --- parseNum ---
assert.equal(parseNum('4 321.23'), 4321.23);
assert.equal(parseNum('4 321.23'), 4321.23); // nbsp
assert.equal(parseNum('-4.86'), -4.86);
assert.equal(parseNum(null), null);
assert.equal(parseNum('abc'), null);

// --- extractWidget ---
const wPro = extractWidget(widgetHtmlPro, 'PRO');
assert.equal(wPro.balance, 4321.23);
assert.equal(wPro.growth, 0.69);
assert.equal(wPro.trades, 110);

const wEss = extractWidget(widgetHtmlEssentialNeg, 'Essential');
assert.equal(wEss.balance, 2009.5);
assert.equal(wEss.growth, -4.86);
assert.equal(wEss.trades, 30);

// --- findDataColumnValue / extractFullPage ---
assert.equal(findDataColumnValue(fullPagePro, 'Profit Factor:'), '1.02');
assert.equal(findDataColumnValue(fullPagePro, 'Maximal:'), '516.72 USD (11.25%)');
// garante que "Maximal:" não confunde com "Maximal consecutive profit:"
assert.notEqual(findDataColumnValue(fullPagePro, 'Maximal:'), '255.33 USD (2)');

const fPro = extractFullPage(fullPagePro, 'PRO');
assert.equal(fPro.dd, 11.25);
assert.equal(fPro.winRate, 37.27);
assert.equal(fPro.profitFactor, 1.02);

const fEss = extractFullPage(fullPageEssential, 'Essential');
assert.equal(fEss.dd, 5.77);
assert.equal(fEss.winRate, 23.33);
assert.equal(fEss.profitFactor, 0.58);

// --- formatação (padrão pt-BR usado no site) ---
assert.equal(fmtBalance(4321.23), 'US$ 4.321');
assert.equal(fmtBalance(2009.5), 'US$ 2.010'); // arredonda .5 pra cima
assert.equal(fmtSignedPct(0.69, 2), '+0,69%');
assert.equal(fmtSignedPct(-4.86, 2), '−4,86%'); // U+2212
assert.equal(fmtSignedPct(0, 2), '+0,00%');
assert.equal(fmtPct(11.25, 2), '11,25%');
assert.equal(fmtInt(110), '110');
assert.equal(fmtDecimal(1.02, 2), '1,02');
assert.equal(fmtDecimal(0.58, 2), '0,58');

console.log('OK — todos os testes offline passaram.');
