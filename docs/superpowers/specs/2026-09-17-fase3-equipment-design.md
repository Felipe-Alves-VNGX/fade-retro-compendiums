# Design — Fase 3, domínio Equipment

Data: 2026-09-17
Status: aprovado para planejamento
Spec anterior: `docs/superpowers/specs/2026-09-16-fade-retro-compendiums-design.md`
(seção 7, item 3 — "domínios, um de cada vez")
Depende de: `docs/superpowers/specs/2026-09-17-fase2-extracao-pdf-design.md`
(consome `extract/raw/equipment.txt`, já commitado)

## 1. Objetivo

Construir o pipeline parser → `extract/parsed` → builder para o primeiro
domínio da Fase 3: equipamento mundano e armadura, extraídos do cap. 9 do
livro (`extract/raw/equipment.txt`). Critério de conclusão: `packsrc/items/
Equipment/{Adventuring_Gear,Armour}/*.json` contém um documento Item por
linha das Table 9-1 e Table 9-3, `npm run validate` passa sem erros, e os
dois itens hand-written da Fase 1 que duplicam entradas da Table 9-1
(`Backpack`, `Torch`) foram substituídos pelas versões geradas.

Este domínio é o primeiro por ter, segundo o spec geral, "a tabela mais
regular" — valida o formato do pipeline com o menor risco antes de armas,
magias, skills e classes.

## 2. Escopo

O cap. 9 tem 12 tabelas. Só duas entram nesta fase:

| Tabela | Conteúdo | Subtipo fantastic-depths | Pasta |
|---|---|---|---|
| Table 9-1: Mundane Items | ~40 itens gerais (mochilas, cordas, tochas, munição avulsa, roupas, etc.) | `item` | `packsrc/items/Equipment/Adventuring_Gear/` |
| Table 9-3: Armour | 6 conjuntos de armadura (Leather → Suit Armour) | `armor` | `packsrc/items/Equipment/Armour/` (nova) |

**Fora de escopo desta fase** (vão para specs futuros, fora de `Items` na
maioria dos casos):

- Table 9-2 (Weapons) — pertence ao domínio "armas e masteries" (cap. 6),
  não a este.
- Table 9-4 a 9-12 (animais de montaria, transporte terrestre, barding,
  navios, edifícios, contratados, mercenários, especialistas, cerco) —
  não mapeiam para nenhum subtipo de Item de personagem; são preços de
  referência para o mestre, não gear. Ficam no backlog "Fora da v1" do
  spec geral, com destino provável `packsrc/journals` ou `rollTables`.
- Munição com stats próprios de dano (o subtipo `ammo`) — as entradas de
  munição da Table 9-1 (Arrows, Bolts, Bullets, Pellets, Darts) entram
  como subtipo `item` genérico nesta fase (decisão explícita: não vale a
  pena pesquisar `AmmoItemDataModel` agora só para 5 linhas sem stats de
  dano na própria tabela). Uma fase futura de armas/munição pode
  remapeá-las para `ammo` quando precisar linkar com `ammoType` das armas.

## 3. Schema de `ArmorItemDataModel` — pesquisa pendente

`docs/fantastic-depths-item-schema.md` documenta hoje `item`, `weapon` e
`light` (lidos na Fase 1), mas não `armor`. A Task 1 deste plano lê
`ArmorItemDataModel` do código-fonte do `fantastic-depths`
(`src/item/dataModel/*.ts`, mesmo repo/commit já usado: `Forelius/
fantastic-depths` @ `4a8f2c8`) e atualiza esse documento antes de qualquer
parser/builder ser escrito — mesmo padrão da pesquisa de schema da Fase 1.

Campos mínimos esperados a partir da própria Table 9-3 (a confirmar contra
o código-fonte real, não assumir): um campo de Armour Class (valor
absoluto, já "melhor que 9", não um bônus), e possivelmente um campo de
tipo/categoria de armadura e penalidade de movimento — a tabela do livro
já traz `Movement Rate` por conjunto, que precisa de um campo
correspondente ou de uma decisão de mapeamento (`flags`, nota em
`gm.notes`, ou descartar se o `fantastic-depths` já deriva isso de outro
lugar). Essa decisão fica para a Task 1, depois de ler o schema real.

## 4. Parser (`scripts/parse/equipment.mjs`)

Lê `extract/raw/equipment.txt`, localiza os dois blocos de tabela por
âncora de título (`Table 9–1: Mundane Items` até a próxima ocorrência de
`Table 9–2`; `Table 9–3: Armour` até `Table 9–4`), e emite
`extract/parsed/equipment.json`.

**Reconhecimento de linha de dado**: uma linha pertence à tabela se
contém um valor terminando em `gp`/`sp`/`ep`/`pp` (coluna Cost) — usado
como âncora, não a posição de caractere, porque o espaçamento entre
colunas no `.txt` varia levemente entre linhas (herdado do recorte em
coluna da Fase 2). Split dos campos por `/\s{2,}/` dentro da linha
reconhecida.

**Duas tabelas, dois extratores de coluna** — Table 9-1 tem 3 colunas
(`Item, Weight, Cost`), Table 9-3 tem 5 (`Item, Armour Class, Weight,
Cost, Movement Rate`). Não há um extractor de coluna genérico único; cada
tabela tem sua própria função de parsing de linha, já que o shape difere.

**Casos especiais (confirmados na amostra real da Table 9-1)**:

- **Prefixo de quantidade**: `"20 Arrows"`, `"5 Bullets (silver)"`,
  `"30 Pellets"`, `"5 Darts"` → regex `/^(\d+)\s+(.+)/` separa
  `bundleQty` (número) do `name` (resto da string, sem o prefixo).
  Itens sem prefixo numérico recebem `bundleQty: 1`.
- **Custo com sufixo `+`**: `"Clothes (royal)"` → `"50+gp"`. O parser
  extrai o valor numérico (`50`) e marca `cost.isMinimum: true` — não
  descarta o `+` silenciosamente.
- **Peso fracionário**: `"0.1lb"`, `"2.5lb"` → `parseFloat` direto. A
  conversão de unidade (×10) é responsabilidade do builder, não do
  parser: o parser só transcreve o valor impresso no livro.

**Formato de saída** (`extract/parsed/equipment.json`), array plano com
um campo `table` de origem por linha:

```json
[
  { "table": "mundane-items", "name": "Backpack", "bundleQty": 1,
    "weightLb": 2, "cost": { "value": 5, "currency": "gp", "isMinimum": false } },
  { "table": "mundane-items", "name": "Arrows", "bundleQty": 20,
    "weightLb": 1, "cost": { "value": 5, "currency": "gp", "isMinimum": false } },
  { "table": "mundane-items", "name": "Clothes (royal)", "bundleQty": 1,
    "weightLb": 3, "cost": { "value": 50, "currency": "gp", "isMinimum": true } },
  { "table": "armour", "name": "Leather Armour", "armourClass": 7,
    "weightLb": 20, "cost": { "value": 20, "currency": "gp", "isMinimum": false },
    "movementRate": "30'" }
]
```

O objeto `cost` fica em unidade original (não convertido para gp
decimal) — a conversão de moeda é regra de domínio do builder.

## 5. Builder (`scripts/build/equipment.mjs`)

Lê `extract/parsed/equipment.json`, produz um documento Item por linha em
`packsrc/items/Equipment/{Adventuring_Gear,Armour}/<Nome>.json`.

**Conversões**:
- **Peso**: `system.weight = weightLb × 10` (regra já documentada em
  `docs/fantastic-depths-item-schema.md`, seção "Unidade de peso").
- **Moeda**: `cp → ×0.01`, `sp → ×0.1`, `ep → ×0.5`, `pp → ×5`,
  `gp → ×1`, aplicado a `cost.value` para produzir `system.cost`.
  `cost.isMinimum: true` não tem campo correspondente no schema — vira
  uma frase em `system.gm.notes` (ex.: `"Custo listado como mínimo (50+gp) no livro."`),
  para não perder a informação sem inventar um campo.
- **Quantidade em pacote**: `bundleQty > 1` vira `system.quantity` no
  Item gerado (ex.: Arrows → `quantity: 20`), e o `name` do documento usa
  o nome sem o prefixo numérico (`"Arrows"`, não `"20 Arrows"`).

**Subtipo**: `table === "mundane-items"` → `type: "item"`;
`table === "armour"` → `type: "armor"`.

**Descrição**: o texto narrativo logo abaixo de cada tabela no livro (ex.:
"Backpack: A leather or canvas backpack...") é casado por nome exato do
item e vira `system.description` (envolto em `<p>`, mesmo padrão dos
hand-written da Fase 1). Se um item gerado não tiver descrição
correspondente encontrada no texto, o builder **loga um aviso e continua**
com `description: ""` — não lança exceção, já que a ausência de prosa
correspondente é uma situação a inspecionar manualmente na revisão, não
um estado inválido que deve parar o build.

**`_id` determinístico**: em vez de aleatório (como os hand-written da
Fase 1), o builder deriva o `_id` de um hash estável
(`sha1("equipment:" + name)`, truncado/mapeado para o alfabeto de IDs de
16 caracteres do Foundry). Isso torna o builder idempotente — rodar de
novo sobre o mesmo `extract/parsed/equipment.json` produz exatamente os
mesmos arquivos, byte a byte, sem gerar documentos duplicados nem invalidar
referências existentes (ex.: de um Actor que já tenha esse Item
embarcado).

**Pastas**: `_folders.json` ganha uma entrada nova `Armour` (irmã de
`Weapons` e `Adventuring Gear`, mesmo `folder` pai `Equipment`).
`Adventuring_Gear/` recebe os `item` gerados; `Armour/` (nova) recebe os
`armor`.

**Substituição dos hand-written**: antes de escrever os itens gerados da
Table 9-1, o builder apaga especificamente
`packsrc/items/Equipment/Adventuring_Gear/Backpack.json` e
`.../Torch.json` (só esses dois nomes exatos, sem limpeza ampla da
pasta) — eles são recriados pelo builder a partir da tabela, tornando-se a
única fonte de verdade para esses dois itens daqui em diante. `Dagger.json`
não é tocado (é `weapon`, fora deste domínio).

## 6. Testes e validação

- **Parser** (`scripts/parse/equipment.test.mjs`): fixtures com trechos
  reais reduzidos cobrindo prefixo de quantidade, custo com `+`, peso
  fracionário, e uma passada completa contra as duas tabelas reais
  (extraídas de `extract/raw/equipment.txt`, não reescritas à mão).
- **Builder** (`scripts/build/equipment.test.mjs`): conversão de peso e
  moeda (casos de cada uma das 5 moedas), remoção de prefixo numérico do
  nome + `quantity` correspondente, determinismo do `_id` (rodar a função
  duas vezes com o mesmo input, comparar), dedupe dos dois hand-written.
- **`npm run validate`** (já existente, Fase 1) roda contra
  `packsrc/items/Equipment/**` inteiro como gate de aceitação — mesmo
  padrão das fases anteriores.
- **Revisão manual final**: amostragem de 3-4 itens gerados de cada
  tabela, comparados linha a linha com o livro (peso, custo, texto da
  descrição) — não é possível validar isso automaticamente sem duplicar o
  próprio parser.

## 7. Riscos e decisões pendentes

- **Schema de `armor` — resolvido durante o planejamento.** Lido de
  `ArmorItemDataModel.ts` (`Forelius/fantastic-depths` @ `4a8f2c8`) antes
  de escrever o plano de implementação, para não deixar a Task 1 como
  pesquisa em aberto. Não há campo nativo para `Movement Rate`; o
  `EncSystem.ts` do próprio `fantastic-depths` usa o campo `armorWeight`
  (`"light"`/`"heavy"`) para o mesmo papel que a coluna Movement Rate
  desempenha no livro — mapeamento adotado: `30' → light`, `20' →
  heavy`. Detalhe completo em
  `docs/fantastic-depths-item-schema.md` e no plano de implementação.
- **Munição como `item` genérico é uma simplificação deliberada**, não um
  esquecimento — registrado na seção 2 para não ser reaberto como bug
  numa revisão futura.
- **Achado durante a verificação do plano**: ao contrário do que se
  esperava só de olhar o texto logo após a Table 9-3, 4 das 6 armaduras
  (Scale Mail, Banded Mail, Plate Mail, Suit Armour) têm descrição
  narrativa individual mais adiante no capítulo — o algoritmo de
  casamento por nome (seção 5) encontra essas automaticamente sem
  nenhuma mudança de design. Só Leather Armour e Chain Mail (e, na Table
  9-1, Darts e as duas variantes de Sack) ficam de fato sem
  correspondência.
- **Achado durante a implementação (Task 4)**: duas páginas full-width
  do cap. 9 (152, 153 — mesma classe de degradação já aceita para
  p.93/p.103 na Fase 2) mesclam colunas de itens diferentes numa única
  linha de texto. Isso quebrou a descrição de Banded Mail (texto
  ilegível, corrigido: `matchDescription` agora rejeita e retorna vazio
  quando a própria linha de cabeçalho tem esse padrão) e truncou a de
  Plate Mail num salto de página (corrigido: a função agora atravessa
  corretamente o marcador `--- page N ---`). `Arrows` e `Arrows
  (silver)` (Table 9-1) sofrem uma variante do mesmo problema — a
  continuação do texto fica do outro lado do bloco inteiro da Table
  9-1 — e ficam com a descrição truncada em "...At the end of a combat,
  a character" como degradação aceita, não corrigida: consertar
  exigiria fazer `matchDescription` atravessar um bloco de tabela
  inteiro, o que é mais especial-caseamento do que vale a pena nesta
  fase. **Risco para a próxima fase (armas/masteries)**: as mesmas
  páginas full-width que mesclam colunas de armadura também mesclam
  colunas de arma (`extract/raw/equipment.txt:463-469` — Shield/Sword
  intercalados) — o domínio de armas provavelmente vai bater no mesmo
  problema em escala maior, e a correção certa lá é tratar o
  merge-de-coluna na extração da Fase 2, não continuar corrigindo
  `matchDescription` linha a linha.
