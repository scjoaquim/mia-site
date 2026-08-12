#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dock_sem_cotacao_check.py — o cadeado do lado do SITE para o degrau 3.3 do cobre.

Corre sem rede e sem instalar nada, com o Python que o Mac ja traz (3.9.6):

    cd ~/Documents/mia-site
    python3 scripts/dock_sem_cotacao_check.py

Aceita um caminho alternativo como argumento, para se poder apontar a uma copia
e ver o cadeado VERMELHO com o conserto desfeito:

    python3 scripts/dock_sem_cotacao_check.py /tmp/script_antigo.js

ESCRITO EM 12-Ago-2026 (Bahia), na S3.

⚠ PORQUE E' PYTHON E NAO .mjs
-----------------------------
A primeira versao deste cadeado era um `.test.mjs`, a seguir a convencao do
`scripts/update-tiles.test.mjs` que ja existia aqui. So que este Mac NAO tem `node`
instalado — e portanto aquele teste tambem nunca correu nesta maquina. Um cadeado que o
dono do repositorio nao consegue correr nao e um cadeado dele. Este corre.

O QUE ISTO TRANCA
-----------------
O gerador do positions.json passou a publicar "price": null quando nao ha cotacao nenhuma
(ver bot_mt5/gen_positions_json.py, com cadeado proprio em pytest). Do lado do site, todo
o preco passa por:

    function nf(v, d) { return Number(v).toLocaleString(...); }

e `Number(null) === 0`. Sem guarda, um price null NAO rebenta — escreve "0" no ecra, com a
etiqueta "ultimo", e o grafico desenha uma reta por baixo. Trocavamos uma mentira (o preco
de ENTRADA) por outra (zero). Medido em 12-Ago com jsdom, no script antigo: "ultimo 0"
mais um path SVG desenhado.

⛔ O QUE ISTO **NAO** PROVA
--------------------------
Isto le o script.js como TEXTO e verifica a FORMA das guardas — o mesmo metodo dos testes
que leem o .mqh, e pela mesma razao: aqui nao ha browser nem jsdom.
  * Nao prova que o ecra mostra o traco. Isso foi provado a mao em 12-Ago, com jsdom, nos
    tres casos (sem cotacao / ultimo conhecido / ao vivo).
  * Nao prova nada sobre o gerador. Esse tem cadeado proprio, em pytest.
  * Nao cobre o script.js da RAIZ deste repositorio — esse e o site antigo, que a S4
    substitui. So o _novo_site/ vai ao ar.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
ALVO = Path(sys.argv[1]) if len(sys.argv) > 1 else AQUI.parent / "_novo_site" / "script.js"

if not ALVO.is_file():
    print("ERRO: nao achei %s" % ALVO)
    raise SystemExit(2)

src = ALVO.read_text(encoding="utf-8")
liso = re.sub(r"\s+", " ", src)          # espacos e quebras nao contam


def tem(trecho: str) -> bool:
    return re.sub(r"\s+", " ", trecho) in liso


falhas = []
TOTAL = 0


def checa(nome: str, condicao: bool, dica: str) -> None:
    global TOTAL
    TOTAL += 1
    if condicao:
        print("  ok    %s" % nome)
    else:
        falhas.append(nome)
        print("  FALHA %s\n        %s" % (nome, dica))


print("cadeado 3.3 (site) -> %s" % ALVO)

# 1. rotulo proprio: "sem cotacao" nao e a mesma afirmacao que "ultimo"
checa("T.nopr existe",
      tem("nopr:") and "sem cotação" in liso,
      "sem rotulo proprio, o ecra diria \"ultimo\" para um preco que nunca existiu.")

# 2. o desenho para quando nao ha dado
checa("drawBind sai cedo com noData",
      bool(re.search(r"function drawBind\([^)]*\)\s*\{[\s\S]{0,600}?if\s*\(p\.noData\)", src)),
      "sem isto, pts a null coagem para 0 e sai uma reta achatada que parece dado real.")

checa("drawBind limpa o path e tira o ponto do viewBox",
      bool(re.search(r"if\s*\(p\.noData\)\s*\{[\s\S]{0,300}?setAttribute\('d',\s*''\)[\s\S]{0,300}?return;", src)),
      "o path anterior ficaria desenhado no ecra.")

# 3. a linha deixa de ser semeada com um preco que nao existe.
#    So a declaracao `var seed =` do ensureViews: a re-semeadura do applyData usa
#    `: [pos.price]` de proposito, e so e alcancada quando ja se sabe que ha dado.
m = re.search(r"var seed\s*=[\s\S]{0,240}?;", src)
decl = m.group(0) if m else ""
checa("o seed do ensureViews nao usa [pos.price] a seco",
      bool(decl) and bool(re.search(r"pos\.price == null \? \[\]", decl)),
      "o seed `: [pos.price]` com price null enche a linha de zeros. Achei: %r"
      % re.sub(r"\s+", " ", decl))

checa("ensureViews trata o caso sem serie e sem preco",
      tem("(pos.price == null ? [] : [pos.price])") and tem("s.noData = !seed.length"),
      "e aqui que o noData nasce.")

# 4. noData recalcula-se a cada pull (a cotacao pode voltar)
checa("applyData recalcula noData",
      tem("var semDados = (pos.price == null) && !(pos.series && pos.series.length);")
      and tem("s.noData = semDados;"),
      "se o noData ficasse preso, a linha nao voltava quando a cotacao voltasse.")

# 5. o unico sitio onde o preco e escrito no ecra
checa("o preco so vai ao nf() depois da guarda",
      not re.search(r"\+\s*nf\(pos\.price,\s*s\.dec\)\s*\+", src),
      "chamada a nf(pos.price) sem guarda: Number(null) === 0 escreve \"0\".")

checa("sem preco, escreve um traco",
      tem("(pos.price == null) ? '—' : nf(pos.price, s.dec)"),
      "e o traco que diz ao leitor que nao ha numero, em vez de inventar um.")

# ── ASSUNTO SEPARADO: singular/plural do contador (S4, 12-Ago-2026) ──────────
# Nao e do 3.3. Anda neste ficheiro para nao multiplicar cadeados de uma linha
# cada. Com UMA posicao aberta - o caso no dia do lancamento - lia-se
# "1 posicoes . 1 abertos" e "1 de 1 mercados abertos", nas duas linguas.

checa("cntTxt trata o singular (pt e en)",
      tem("(n === 1 ? ' posição'  : ' posições')") and tem("(n === 1 ? ' position' : ' positions')")
      and tem("(o === 1 ? ' aberta' : ' abertas')"),
      "com 1 posicao volta a ler-se \"1 posicoes . 1 abertos\".")

checa("mktTxt trata o singular (pt e en)",
      tem("(n === 1 ? ' mercado aberto' : ' mercados abertos')")
      and tem("(n === 1 ? ' market open'    : ' markets open')"),
      "com 1 mercado volta a ler-se \"1 de 1 mercados abertos\".")

checa("as formas antigas sairam",
      not tem("(n + ' posições · ' + o + ' abertos')") and not tem("(n + ' positions · ' + o + ' open')"),
      "a versao sem singular ainda esta no ficheiro.")

# -----------------------------------------------------------------------------
print("")
if falhas:
    print(">>> %d FALHA(S) em %d verificacoes." % (len(falhas), TOTAL))
    for n in falhas:
        print("    - %s" % n)
    raise SystemExit(1)
print("%d verificacoes, todas ok." % TOTAL)
