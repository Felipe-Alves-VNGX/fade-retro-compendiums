# Design — Fase 2: Extração do PDF

Data: 2026-09-17
Status: aprovado para planejamento
Spec anterior: `docs/superpowers/specs/2026-09-16-fade-retro-compendiums-design.md`
(este documento detalha apenas a Fase 2 descrita na seção 7 daquele spec)

## 1. Objetivo

Construir a ferramenta de extração de texto do PDF *Dark Dungeons (4th
Edition)* que alimenta os parsers de domínio da Fase 3. Esta fase entrega
**só a extração e normalização de texto bruto** — nenhum parser ou builder
de domínio. O critério de conclusão é: para os 5 capítulos listados na
seção 4, `extract/raw/<capítulo>.txt` existe, é legível como texto corrido
(colunas na ordem certa, sem intercalamento, sem tabelas garbled), e as
duas transformações de texto (hifenização, aspas) foram aplicadas.

## 2. Problema técnico central

O livro é de duas colunas. `pdftotext -layout` (usado sem recorte)
intercala as colunas do PDF na mesma linha de saída — confirmado
experimentalmente na p.98, onde os verbetes de magia "Analyse" e "Animate
Objects" saem lado a lado na mesma linha em vez de sequenciais.

**Recorte validado:** `pdftotext -x 18 -y 36 -W 282 -H 720 -layout` para a
coluna esquerda e `-x 312 -y 36 -W 264 -H 720 -layout` para a direita,
concatenadas nessa ordem, produzem texto corrido correto (verificado
byte a byte contra o conteúdo esperado da p.98). A altura `H 720` a partir
de `y 36` já exclui o rodapé de número de página sem necessidade de
pós-processamento. Essas coordenadas são fixas porque o PDF inteiro usa o
mesmo template de página (612×792pt, confirmado via `pdfinfo`).

**Exceção confirmada:** tabelas que ocupam a largura total da página (ex.:
Tabela 6-2a, proficiência de arma) ficam com texto garbled quando
recortadas em coluna — cada célula é truncada pela metade. Essas páginas
precisam ser extraídas em largura total (sem recorte) e marcadas
explicitamente em `chapters.json` (seção 4).

**Ligaduras — achado que revoga uma suposição do spec anterior:** a seção
8 do spec da Fase 1 listava ligaduras (fi/fl) como algo que a normalização
da Fase 2 precisaria tratar. Testado em uma amostra de 200 páginas: o
`pdftotext` já decompõe ligaduras em letras separadas antes de emitir o
texto — nenhum caractere de ligadura (faixa Unicode U+FB00–FB06) aparece na
saída. **Não há normalização de ligadura a implementar.** Os únicos
caracteres não-ASCII que de fato aparecem no texto extraído (amostra de
200 páginas): `–` (travessão, 2907 ocorrências — semântica de tabela e
prosa, nunca tocado por esta fase), `’ ‘ " "` (aspas/apóstrofos
tipográficos — normalizados nesta fase), `■ † ‡ ½ ¾ °` (marcadores de
lista, notas de rodapé, frações, grau — fora de escopo desta fase, ficam
como estão).

## 3. Escopo de normalização (o que este documento chama de "normalização
de texto")

Aplicado ao texto já extraído e concatenado, antes de escrever em
`extract/raw/`:

1. **Junção de fim de linha em palavras compostas com hífen.** **Achado
   que corrige a suposição original desta seção:** o livro usa texto de
   alinhamento à direita irregular (ragged-right), não justificado — não
   há hifenização artificial de palavras longas. Busquei todas as 7
   ocorrências reais de hífen em fim de linha nos 5 capítulos desta fase
   (`grep` por `[a-z]-$` em cada coluna de cada capítulo) e **cada uma** é
   uma palavra composta com hífen próprio que calhou de cair na quebra de
   linha: `non-\nliving`, `non-\nmagical` (×3), `life-\nforce`,
   `semi-\ndesert`. Não existe nenhum caso de palavra comum quebrada
   arbitrariamente. Regra correta: uma linha terminando em hífen seguida
   de quebra de linha tem a quebra removida e **o hífen preservado**
   (`"non-\nliving"` → `"non-living"`) — nunca remover o hífen, pois isso
   destruiria a palavra composta (`"non-\nliving"` → `"nonliving"` estaria
   errado).
2. **Aspas e apóstrofos tipográficos → ASCII reto.** `’ ‘` → `'`; `" "` →
   `"`. Esta é a mesma convenção que os 3 itens escritos à mão da Fase 1
   (`Dagger.json`, `Torch.json`) já usam — a revisão final da Fase 1
   registrou essa divergência como risco a decidir "antes do normalizador
   da Fase 2" (spec anterior, seção 8); esta fase resolve isso ao adotar
   ASCII reto como a convenção de `packsrc/` daqui em diante.

**Explicitamente fora de escopo desta fase** (ficam para o parser de cada
domínio, Fase 3, que já tem o contexto de qual tabela/campo está lendo):
o travessão `–` como marcador de "sem valor" em tabelas; colapso de
espaços múltiplos ou linhas em branco (podem carregar informação de
alinhamento de tabela que um parser futuro precisa); qualquer outro
símbolo.

## 4. Capítulos e páginas

| Capítulo do livro | id / nome de arquivo | Páginas | Domínio da Fase 3 |
|---|---|---|---|
| Cap. 4 — Creating a Character | `creating-a-character` | 25–60 | classes |
| Cap. 5 — Ability Checks, Skills, & Talents | `skills-and-talents` | 61–72 | skills |
| Cap. 6 — Weapons & Weapon Proficiency | `weapons` | 73–90 | armas/masteries |
| Cap. 7 — Spells & Spell Casting | `spells` | 91–136 | magias |
| Cap. 9 — Equipping for Adventure | `equipment` | 147–164 | equipamento |

Páginas confirmadas pelo sumário do livro (p.2-4) e verificadas por
amostragem do início de cada capítulo (Cap. 6 em p.73, Cap. 7 em p.91,
Cap. 9 em p.147; o fim de cada capítulo é a página anterior ao início do
próximo). Cap. 8 (Red Powder) não entra nesta fase — não é um dos 5
domínios ordenados na seção 7 do spec anterior.

## 5. `chapters.json`

Config única, fonte de verdade sobre como cada página de cada capítulo é
extraída:

```json
{
  "creating-a-character": { "title": "Creating a Character", "startPage": 25, "endPage": 60, "fullWidthPages": [] },
  "skills-and-talents":   { "title": "Ability Checks, Skills, & Talents", "startPage": 61, "endPage": 72, "fullWidthPages": [] },
  "weapons":              { "title": "Weapons & Weapon Proficiency", "startPage": 73, "endPage": 90, "fullWidthPages": [] },
  "spells":               { "title": "Spells & Spell Casting", "startPage": 91, "endPage": 136, "fullWidthPages": [] },
  "equipment":            { "title": "Equipping for Adventure", "startPage": 147, "endPage": 164, "fullWidthPages": [] }
}
```

Os arrays `fullWidthPages` acima estão vazios de propósito — populá-los
corretamente exige inspecionar cada capítulo (130 páginas ao todo), o que
é trabalho de implementação, não de design. **Método de identificação**
(a primeira tarefa do plano de implementação):

1. Extrair o capítulo inteiro em largura total (`pdftotext -layout`, sem
   recorte).
2. Localizar todo cabeçalho de tabela (padrão `Table \d+–\d+`) e anotar o
   número de página onde aparece.
3. Para cada página candidata, rodar o recorte de coluna e comparar
   manualmente as duas saídas: se o recorte produzir células truncadas
   (como demonstrado na seção 2 para a p.76), a página entra em
   `fullWidthPages`.
4. Páginas com tabela que caiba inteiramente em uma única coluna (largura
   estreita, ex.: a Tabela 9-1 de itens mundanos, confirmada em coluna
   única na p.147-149) **não** entram em `fullWidthPages` — o recorte
   normal já funciona para elas.

## 6. `pdf2txt.mjs`

CLI: `node scripts/extract/pdf2txt.mjs --chapter <id>` (um capítulo) ou
`--all` (todos os capítulos de `chapters.json`).

Fluxo por capítulo: para cada página de `startPage` a `endPage`, decide
modo (coluna dupla ou largura total, conforme `fullWidthPages`), invoca
`pdftotext` via `child_process` com as coordenadas da seção 2 (coluna) ou
sem recorte (largura total), concatena o resultado de todas as páginas na
ordem do livro, aplica `normalize.mjs`, escreve
`extract/raw/<id>.txt`.

Caminho do PDF de origem: variável de ambiente `DD4_PDF_PATH`. Erro claro e
imediato (antes de processar qualquer página) se a variável não estiver
definida ou o arquivo não existir. Documentado no `README.md`. O caminho
nunca é escrito no repositório — o PDF é material com direitos de terceiro
e não é commitado.

## 7. `normalize.mjs`

Duas funções puras, sem I/O, exportadas e testáveis com fixtures de
string:

- `dehyphenate(text: string): string`
- `straightenQuotes(text: string): string`

`pdf2txt.mjs` aplica as duas em sequência (dehyphenate primeiro, depois
straightenQuotes) ao texto já concatenado de todas as páginas de um
capítulo, antes de escrever o arquivo.

## 8. Testes

Não há lógica de negócio em `pdf2txt.mjs` além de orquestração de I/O
(chamar `pdftotext`, concatenar, escrever arquivo) — isso não ganha teste
unitário, é verificado por execução real contra o PDF (seção 9). A lógica
real e testável é `normalize.mjs`:

- `dehyphenate`: uma palavra quebrada por hífen de fim de linha é
  reconstituída; um hífen que não está em fim de linha (ex.: "well-known")
  não é tocado; um hífen em fim de linha seguido de palavra capitalizada
  (nome próprio, início de nova sentença abreviada) não é uma junção óbvia
  — o teste documenta o comportamento escolhido explicitamente em vez de
  deixar ambíguo.
- `straightenQuotes`: as 4 variantes (aspas simples/duplas, abertura/
  fechamento) viram os 2 caracteres ASCII corretos; texto sem nenhuma
  aspas tipográfica não muda.

`npm test` já roda `node --test scripts/extract/*.test.mjs` (configurado na
Fase 1) — `normalize.test.mjs` entra nesse padrão sem mudança de script.

## 9. Verificação de ponta a ponta (critério de conclusão da fase)

Rodar `node scripts/extract/pdf2txt.mjs --all` contra o PDF real e
confirmar, por capítulo:

- O arquivo `extract/raw/<id>.txt` existe e não está vazio.
- As primeiras linhas do arquivo batem com o título do capítulo esperado
  (ex.: `equipment.txt` começa perto de "Chapter 9 – Equipping for
  Adventure").
- Amostragem manual de ao menos 2 pontos no meio do arquivo: nenhuma linha
  mistura conteúdo de coluna esquerda e direita (o sintoma da p.98 antes do
  recorte); nenhuma tabela de largura total aparece truncada.
- Nenhuma linha termina em hífen seguido por uma palavra que deveria estar
  unida à anterior (verificação de que `dehyphenate` rodou).
- Nenhuma aspa/apóstrofo curvo (`’ ‘ " "`) aparece no arquivo (verificação
  de que `straightenQuotes` rodou) — checável por `grep` simples.

## 10. Riscos e decisões pendentes

- **`fullWidthPages` resolvido durante o planejamento (não mais um risco em
  aberto).** O método da seção 5 foi rodado nas 130 páginas dos 5
  capítulos; os valores exatos estão no plano de implementação. Mantido
  aqui só o modo de falha residual: se uma página escapar da lista, o
  sintoma é texto de tabela garbled em `extract/raw/`, detectável na
  verificação da seção 9.
- **Páginas com tabela de largura total misturada a prosa de duas colunas
  degradam a ordem de leitura da prosa (achado durante o planejamento).**
  Duas páginas nos 5 capítulos (p.93 e p.103, ambas do capítulo de magias)
  têm uma tabela de largura total seguida ou cercada de prosa em duas
  colunas no restante da página. Extrair a página inteira em modo largura
  total (necessário para a tabela) faz a prosa perder a ordem de leitura
  correta — nos dois casos observados, cada parágrafo continua
  gramaticalmente íntegro, mas a ordem entre parágrafos de colunas
  diferentes não é garantida (às vezes agrupada por coluna inteira, às
  vezes intercalada linha a linha, dependendo de como o `pdftotext`
  interpreta a geometria daquela página específica). Decisão: aceitar essa
  degradação nesta fase em vez de implementar um recorte de três bandas
  (coluna dupla acima da tabela + largura total na tabela + coluna dupla
  abaixo) — o texto de `extract/raw/` continua auditável e o parser de
  magias da Fase 3 já vai precisar de lógica própria para separar verbetes
  de magia nessas duas páginas de qualquer forma. Se mais páginas assim
  aparecerem em capítulos futuros e a degradação afetar dados importantes,
  reconsiderar o recorte de três bandas.
- **Notas de rodapé com símbolos (`†ᅟ‡`) e frações (`½ ¾`) não são
  tratadas.** Se algum domínio da Fase 3 precisar delas (ex.: uma nota de
  rodapé referenciada por `†` em uma tabela), o parser daquele domínio
  precisa lidar com o símbolo bruto — não há normalização aqui.
- **Capítulo 8 (Red Powder) fica de fora desta fase e do mapeamento de
  domínios da Fase 3 original.** Grenadier/Red Powder é uma mecânica sem
  equivalente direto no `fantastic-depths` (já registrado como risco no
  spec anterior); extrair seu texto fica para quando essa decisão de
  mapeamento for tomada.
