# Design — Fase 3, domínio Magias (subtipo `spell`)

Data: 2026-09-18
Status: aprovado para planejamento
Spec anterior: `docs/superpowers/specs/2026-09-16-fade-retro-compendiums-design.md`
(seção 4, tabela de mapeamento — "Cap. 7 — lista alfabética de magias" →
`spell` → `Spells/<Classe>/Circle_N/`)

## 1. Objetivo

Terceiro domínio da Fase 3 (ordem do spec geral: equipamento → armas e
masteries [concluídos] → magias → skills → classes). Cobre o cap. 7
(`extract/raw/spells.txt`, seção `ALPHABETICAL SPELL LIST`, a partir da
linha 550), subtipo `spell`, único subtipo do domínio — não há
decomposição em sub-projetos (diferente de armas/masteries, que tinham
dois subtipos distintos).

Critério de conclusão: `packsrc/items/Spells/<Classe>/Circle_N/*.json`
cobre um documento por combinação (magia, classe, círculo) encontrada
no capítulo, e `npm run validate` passa sem erros.

## 2. Fonte e formato do verbete

Cada verbete de magia ocupa 3 linhas de cabeçalho seguidas de prosa
livre:

- **Linha 1**: nome da magia, opcionalmente seguido de uma ou mais
  "esferas" separadas por vírgula, alinhadas à direita na mesma linha
  (coluna larga, ex.: `Analyse` + `Energy`; `Animate Dead` + `Energy,
  Inertia`; `Anti-Animal Shell` sem esfera nenhuma).
- **Linha 2**: uma ou mais combinações `<Classe> <círculo>` separadas
  por vírgula (`Wizard 1`; `Cleric 4, Wizard 5`; `Cleric 6, Druid 6,
  Wizard 9`) seguidas de `Target: <texto livre>`.
- **Linha 3**: `Range: <texto livre>` + `Duration: <texto livre>`.
- **Linhas seguintes**: parágrafos de descrição livre até o próximo
  verbete, podendo incluir um bloco `Reverse: <descrição>` ao final
  (ex.: Continual Light Rev / Continual Darkness).

Contagem de referência (extração real, `grep -c`): 182 linhas batem com
`^(Cleric|Druid|Wizard) [0-9]` (linhas 2 de cabeçalho); 59 delas batem
com o sub-padrão "mesmo círculo, classes diferentes"
(`^(Cleric|Druid|Wizard) [0-9]+, (Cleric|Druid|Wizard) [0-9]+`). O
número final de documentos gerados será maior que 182 pelo fan-out
descrito na seção 4, mas seu valor exato só é conhecido após rodar o
parser contra o arquivo inteiro — não estimado aqui a priori.

## 3. Detecção de fronteira de verbete

Uma linha N é tratada como cabeçalho de novo verbete apenas quando a
linha N+1 bate com `/^(Cleric|Druid|Wizard) \d/`. Esse lookahead de uma
linha é suficiente para não confundir nomes de tabela, cabeçalhos de
página ou prosa comum com um novo verbete.

**Verificado contra a p.103** (linhas 1086–1146 de `spells.txt`): essa
página contém a Table 7-4 (Contact Outer Plane) embutida *dentro* do
verbete "Contact Outer Plane" como parte de sua própria descrição —
nenhuma linha da tabela bate com o padrão de classe+círculo, então não
gera falso positivo de fronteira.

**Correção (achada só rodando o parser contra o arquivo inteiro, não por
amostra — ver plano de implementação, seção "Correção a uma afirmação
errada do spec")**: a afirmação original aqui de que "a ordem de leitura
das colunas nessa página está correta" estava **errada**. A partir da
linha logo após a Table 7-4, a p.103 tem a mesma corrupção de merge de
coluna full-width das páginas 93–95 — a coluna esquerda (fim de "Contact
Outer Plane", depois "Contingency") e a direita ("Continual Light Rev")
ficam intercaladas na mesma linha física por várias linhas seguidas. O
verbete "Continual Light Rev" (e sua contraparte reversa "Continual
Darkness") fica de fora do parser como gap aceito (ver seção 11); o
parser também precisa de uma condição de parada explícita (gap interior
de 5+ espaços, ou linha de título de tabela) para não deixar esse texto
corrompido vazar para dentro da descrição de "Contact Outer Plane" —
detalhes no plano de implementação.

Como em equipment/weapons, o parser reaproveita (cópia independente,
sem import cruzado) `stripPageBoundaries`/`hasInteriorGap` para
remover marcadores de página antes de dividir em linhas, e rejeita uma
linha de cabeçalho corrompida por gap interior (mas não uma linha de
continuação — mesma assimetria "rejeitar só no cabeçalho, parar na
continuação" adotada em equipment/weapons).

## 4. Fan-out por (magia, classe, círculo)

O schema real do subtipo `spell` (`SpellItemDataModel` → delega a
`SpellField.ts`/`SpellData.defineSchema()`, Forelius/fantastic-depths @
4a8f2c8) modela `spellLevel` como um **único** number por documento, não
por classe. O spec geral já define a pasta destino como
`Spells/<Classe>/Circle_N/`, o que implica um documento por
combinação.

**Decisão confirmada com o usuário**: uma magia com N combinações
classe+círculo gera N documentos de compêndio — um por (nome, classe,
círculo) — todos compartilhando esfera/target/range/duration/descrição.
Exemplo: `"Cleric 4, Wizard 5"` gera dois documentos: um em
`Spells/Cleric/Circle_4/`, outro em `Spells/Wizard/Circle_5/`.

O fan-out acontece no **parser**, não no builder: `extract/parsed/
spells.json` já contém um registro por (nome, classe, círculo),
mantendo a mesma granularidade final usada em todos os domínios
anteriores (builder consome 1:1, sem lógica de expansão).

## 5. Mapeamento de campos (builder)

Campos do schema real usados:

| Campo do livro | Campo do schema | Regra |
|---|---|---|
| Nome da magia | `name` | verbatim |
| Esfera(s) | `system.tags` | `normalizeTag` por esfera, pode ter múltiplas (`"Energy, Inertia"` → `["energy", "inertia"]`); ausente → `[]` |
| Círculo (da combinação) | `system.spellLevel` | number, valor da combinação classe+círculo específica deste documento |
| `Target:` | `system.targetSelf` / `system.targetOther` | regra de keyword (ver abaixo) |
| `Range:` | `system.range` | string bruta, sem parsing |
| `Duration:` | `system.duration` | string bruta, sem parsing |
| Descrição + bloco `Reverse:` | `system.description` | `<p>` por parágrafo, `Reverse:` como parágrafo final dentro do mesmo campo |

**Regra de `targetSelf`/`targetOther`** (aprovada com o usuário):
- texto de `Target:` contém `"caster"` ou `"personal"` (case-insensitive)
  → `{ targetSelf: true, targetOther: false }`
- texto é `"none"` (case-insensitive) → `{ targetSelf: false, targetOther: false }`
- qualquer outro texto → `{ targetSelf: false, targetOther: true }`

**Campos deixados nos defaults do schema** (sem coluna estruturada no
livro para alimentá-los de forma confiável): `effect`, `dmgFormula`,
`healFormula`, `maxTargetFormula`, `durationFormula`, `savingThrow`,
`saveDmgFormula`, `attackType`, `damageType`, `conditions`, `memorized`,
`cast`. O builder simplesmente omite esses campos do objeto que
constrói, deixando o schema do sistema aplicar seus próprios defaults
na importação.

**`classes` (array `{name, uuid}`)**: deixado vazio (`[]`). A
granularidade de um documento por (classe, círculo) já resolve a
necessidade que esse campo serviria; populá-lo introduziria semântica
não suportada pelos dados do livro nem necessária para o schema
funcionar (`spellLevel` já é suficiente).

## 6. IDs determinísticos e organização de pastas

- `deterministicId(\`spells:${name}:${class}:${circle}\`)` — cópia
  independente da função, mesmo padrão dos domínios anteriores. O seed
  inclui classe+círculo para garantir unicidade entre os documentos de
  fan-out da mesma magia.
- Pasta: `Spells/<Classe>/Circle_N/`, resolvida **dinamicamente** pelo
  builder (não hand-picked em `_folders.json` como nos domínios
  anteriores, dado o volume — até 3 classes × 9 círculos = até 27
  pastas, só criando as que realmente têm magia). O builder mantém um
  cache em memória de pastas já criadas nesta execução para evitar
  duplicar entradas em `_folders.json` quando duas magias caem na mesma
  pasta.
- IDs de pasta seguem o mesmo padrão dos domínios anteriores
  (`deterministicId` truncado, ou geração determinística equivalente),
  com `sort` incrementando por classe e depois por círculo.

## 7. Parser (`scripts/parse/spells.mjs`)

Entrada: `extract/raw/spells.txt`. Saída: `extract/parsed/spells.json`,
array de registros já com fan-out aplicado:

```json
{
  "name": "Animate Dead",
  "sphere": ["Energy", "Inertia"],
  "class": "Wizard",
  "circle": 5,
  "target": "one or more corpses",
  "range": "30'",
  "duration": "permanent",
  "description": "..."
}
```

Tratamento de en-dash: qualquer valor numérico eventualmente presente
no texto recebe o mesmo `replace(/^–/, "-")` preventivo usado nos
domínios anteriores (baixo risco aqui, já que a maior parte do conteúdo
é prosa, mas mantido por consistência e porque não custa nada).

## 8. Builder (`scripts/build/spells.mjs`)

Lê `extract/parsed/spells.json`, aplica o mapeamento da seção 5,
resolve pasta dinamicamente (seção 6), escreve um arquivo por
documento em `packsrc/items/Spells/<Classe>/Circle_N/<Nome>.json`, e
atualiza `packsrc/items/_folders.json` com as pastas novas.

## 9. Validador e documentação de schema

- `docs/fantastic-depths-item-schema.md` ganha uma seção
  `SpellItemDataModel` documentando os campos reais usados (e os
  deixados em default, com a justificativa da seção 5).
- `scripts/extract/validate.mjs` ganha
  `SUBTYPE_REQUIRED_FIELDS.spell = ["name", "spellLevel", "range", "duration"]`.

## 10. Testes e validação

**Parser** (`scripts/parse/spells.test.mjs`):
- magia de classe única, círculo único
- magia multi-classe, mesmo círculo (`"Cleric 4, Druid 4"`)
- magia multi-classe, círculos diferentes (`"Cleric 4, Wizard 5"`)
- magia sem esfera
- magia com múltiplas esferas
- bloco `Reverse:` presente (Continual Light Rev / Continual Darkness)
- verbete cuja descrição contém uma tabela interna (Contact Outer
  Plane, p.103) sem gerar fronteira falsa de novo verbete

**Builder** (`scripts/build/spells.test.mjs`):
- as 3 regras de `targetSelf`/`targetOther` (caster/personal, none,
  outro texto)
- `spellLevel` correto por registro de fan-out
- `deterministicId` estável e único entre os documentos de fan-out da
  mesma magia
- pasta resolvida corretamente por (classe, círculo)
- múltiplas tags de esfera

**Verificação exaustiva antes de finalizar o plano** (lição herdada da
revisão final de weaponMastery — sampling não basta): rodar o parser
real contra o arquivo inteiro e (a) contar verbetes detectados contra
as 182 linhas de classe+círculo já contadas; (b) rodar um "residue
check" sobre toda linha entre `ALPHABETICAL SPELL LIST` e o fim do
capítulo que não foi consumida por nenhum verbete reconhecido, para
achar corrupções ou formatos não previstos antes de escrever o plano
de implementação.

## 11. Riscos e decisões pendentes

- A extração de "esfera" da linha 1 depende de heurística de espaço
  (coluna larga sem delimitador fixo) — precisa ser verificada contra
  amostra real antes do plano, com atenção a nomes de magia que
  contenham vírgula ou múltiplas palavras longas o suficiente para
  colidir com o espaçamento da coluna de esfera.
- Volume de pastas dinâmicas (até 27) é maior que qualquer domínio
  anterior — risco de duplicar entrada em `_folders.json` se o builder
  rodar mais de uma vez sem idempotência na resolução de pasta; deve
  ser coberto por teste explícito de idempotência (mesmo padrão já
  usado em weapons/weaponMastery).
- Segue a recomendação já registrada nos domínios anteriores de
  consolidar `deterministicId`/envelope de documento Foundry em
  `scripts/lib/` — ainda não feito, mas agora com 4 cópias
  independentes (equipment, weapons, weaponMastery, spells), o custo de
  adiar cresce. Fica registrado aqui como risco, não como bloqueio
  deste domínio.
