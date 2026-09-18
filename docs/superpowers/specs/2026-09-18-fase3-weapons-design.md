# Design — Fase 3, domínio Armas (subtipo `weapon`)

Data: 2026-09-18
Status: aprovado para planejamento
Spec anterior: `docs/superpowers/specs/2026-09-16-fade-retro-compendiums-design.md`
(seção 7, item 3 — "domínios, um de cada vez": equipment → **armas e
masteries** → magias → skills → classes)
Também referencia: `docs/superpowers/specs/2026-09-17-fase3-equipment-design.md`
(domínio anterior, mesmo padrão de pipeline)

## 1. Objetivo

Este é o primeiro dos dois sub-projetos do domínio "armas e weapon
masteries" — cobre só os itens de arma (subtipo `weapon`), extraídos de
Table 6-1 (`extract/raw/weapons.txt`) e Table 9-2 (`extract/raw/equipment.txt`).
O segundo sub-projeto (subtipo `weaponMastery`, as ~80 tabelas de
progressão de proficiência) tem seu próprio spec/plano, depois deste.

Critério de conclusão: `packsrc/items/Equipment/Weapons/*.json` cobre
todas as armas de Table 6-1 (40 documentos — 39 armas distintas + a
duplicata deliberada de Sword, Bastard, contada como as duas entradas
que ela é), o `Dagger.json` hand-written da Fase 1 é substituído pela
versão gerada, e `npm run validate` passa sem erros.

## 2. Fontes e junção entre capítulos

Duas tabelas, dois arquivos:

- **Table 6-1: Weapon Summary** (`extract/raw/weapons.txt:106-143`) — nome,
  custo, dano base, traits, grupo de proficiência. Dividida em 4 seções
  com cabeçalho de coluna próprio: Unarmed Attacks, One-Handed Weapons,
  Two-Handed Weapons, Ranged Weapons.
- **Table 9-2: Weapons** (`extract/raw/equipment.txt:309-345`) — nome,
  peso, custo.

O custo aparece nas duas tabelas. Conferido manualmente (Axe Battle,
Axe Hand, Dagger): os valores batem exatamente. **Table 6-1 é a única
fonte de custo** no builder — Table 9-2 contribui só o peso, evitando
duas fontes de verdade para o mesmo campo.

## 3. Escopo

Só Table 6-1 + Table 9-2 → subtipo `weapon`, pasta
`packsrc/items/Equipment/Weapons/`.

**Fora de escopo deste sub-projeto** (fica pro sub-projeto 2, spec
separado):
- Tables 6-2a até 6-Nb (~80 tabelas, uma "vs Armed" + uma "vs Unarmed"
  por arma) → subtipo `weaponMastery` (`MasteryDefinitionDataModel` no
  fantastic-depths — confirmado no código-fonte, `src/fantastic-depths.ts:119`,
  distinto do subtipo `mastery`/`ActorMasteryItemDM`, que é tracking por
  personagem em tempo de jogo, não conteúdo de compêndio).
- Os campos `range.{short,medium,long}` do `WeaponItemDataModel` ficam
  no default do schema (`null`) neste sub-projeto — ver seção 6.

## 4. Casos especiais confirmados na tabela real

- **Peso em fração**: Table 9-2 usa o caractere `½` (ex.: `"2½lb"`,
  `"7½lb"`), diferente do formato decimal `"0.1lb"` usado na Table 9-1
  do domínio equipment. O parser precisa reconhecer `½` = 0.5 além do
  `parseFloat` decimal já usado.
- **Dano ausente**: célula `"–"` na coluna Base Damage (Shield Buckler/
  Normal/Tower, Net, Bolas, Wrestling) — armas sem dado de dano direto
  (defensivas ou de controle). Vira `damageRoll: "0"` no builder, já que
  o schema exige uma string não-nula (`required: true, initial: "1d6"`,
  sem conceito nativo de "sem dano").
- **Múltiplos grupos de proficiência**: algumas células da coluna
  "Proficiency Group" têm mais de um grupo (ex.: `"Med. Blades, Short
  Blades"` pra Sword Short; `"Long Axes, Pole Arms"` pra Poleaxe).
  Decisão: `system.mastery` recebe só o **primeiro** grupo da célula; o(s)
  grupo(s) extra(s) vira(m) uma nota em `system.gm.notes` (ex.: `"Grupos
  de proficiência adicionais do livro: Short Blades."`) — não descartado
  silenciosamente.
- **Sword, Bastard duplicado**: aparece em DUAS seções (One-Handed e
  Two-Handed) com os mesmos dados de custo/dano, refletindo o trait
  "Versatile" (pode ser usada de uma mão ou duas). Decisão: o parser gera
  duas entradas com nomes distintos — a primeira ocorrência (One-Handed)
  fica com o nome impresso sem sufixo, `"Sword, Bastard"`, e a segunda
  (Two-Handed) recebe o sufixo, `"Sword, Bastard (Two-Handed)"` — em vez
  de colapsar numa só, pra evitar colisão de `_id`/nome de arquivo. Mesmo
  padrão de sufixo parentético já usado no domínio equipment (ex.:
  `"Boots (plain)"`), aplicado só à ocorrência repetida.
- **Dano com bônus fixo**: `"1d6+1"` (Sword Bastard) — o parser trata a
  string inteira como valor opaco, sem separar o `+1`; mesmo padrão do
  `damageRoll` do `Dagger.json` hand-written (`"1d4"` sem parsing).

## 5. Parser (`scripts/parse/weapons.mjs`)

Lê `extract/raw/weapons.txt` (Table 6-1) e `extract/raw/equipment.txt`
(Table 9-2, mesmo arquivo que o domínio equipment já lê, mas um bloco
diferente), produz `extract/parsed/weapons.json`.

**Reconhecimento de seção**: o parser varre o bloco de Table 6-1 e marca
qual seção cada linha pertence pelo cabeçalho de subseção mais recente
(`"Unarmed Attacks"`, `"One-Handed Weapons"`, `"Two-Handed Weapons"`,
`"Ranged Weapons"`) — precisa disso pra decidir `canMelee`/`canRanged`
no builder (seção 6) sem repetir a lógica no parser.

**Formato de saída** (`extract/parsed/weapons.json`), array plano:

```json
[
  { "name": "Dagger", "section": "one-handed", "cost": { "value": 3, "currency": "gp" },
    "damageRoll": "1d4", "baseTraits": ["Simple", "Off-Hand", "Throw"],
    "advancedTraits": ["Double Damage"], "masteryGroups": ["Short Blades"],
    "weightLb": 1 },
  { "name": "Sword, Bastard", "section": "one-handed",
    "cost": { "value": 15, "currency": "gp" }, "damageRoll": "1d6+1",
    "baseTraits": ["Versatile"], "advancedTraits": ["Deflect"],
    "masteryGroups": ["Medium Blades"], "weightLb": 8 },
  { "name": "Shield, Buckler", "section": "one-handed",
    "cost": { "value": 6, "currency": "gp" }, "damageRoll": "–",
    "baseTraits": ["Blunt", "Off-hand"], "advancedTraits": ["Deflect"],
    "masteryGroups": ["Shields"], "weightLb": 2 }
]
```

`baseTraits`/`advancedTraits` ficam em arrays separados (não já
combinados) — o parser transcreve o que está impresso; combinar em
`tags` é regra de domínio do builder (mesma separação de responsabilidade
do domínio equipment: parser transcreve, builder converte).

`weightLb` vem de casar o `name` contra Table 9-2 por nome exato — os
dois nomes já são idênticos nas duas tabelas (conferido manualmente para
os 3 casos testados na seção 2); um nome sem correspondência em Table 9-2
loga um aviso e usa `weightLb: 0`, não é erro fatal (mesmo padrão de
degradação aceita do domínio equipment).

## 6. Builder (`scripts/build/weapons.mjs`)

Lê `extract/parsed/weapons.json`, produz um documento `type: "weapon"`
por linha em `packsrc/items/Equipment/Weapons/<Nome>.json`.

**Mapeamento**:
- `damageRoll`/`damageLabel` = `row.damageRoll` (célula `"–"` já virou
  `"0"` no parser, ver seção 4).
- `damageType` = `"physical"` (default do schema; sem dado de origem
  diferente no livro).
- `canMelee`/`canRanged`:
  - `row.section === "ranged"` → `canMelee: false, canRanged: true`.
  - `"Throw"` presente em `baseTraits` ou `advancedTraits` (qualquer
    seção) → `canMelee: true, canRanged: true`.
  - Caso contrário → `canMelee: true, canRanged: false`.
  - `row.section === "unarmed"` é tratado como melee puro (mesma regra
    do "caso contrário").
- `mastery` = `row.masteryGroups[0]`; se `row.masteryGroups.length > 1`,
  os grupos restantes viram uma frase em `system.gm.notes`.
- `tags` = `[...row.baseTraits, ...row.advancedTraits]`, cada trait
  normalizado (minúsculo, espaços viram hífen: `"Off-hand"` → `"off-hand"`,
  `"Deflect Penalty"` → `"deflect-penalty"`); célula `"–"` (sem traits)
  já chega como array vazio do parser.
- `weaponType` = `"handheld"` fixo (mesmo valor do `Dagger.json`
  hand-written; não há coluna na Table 6-1 para isso).
- `size`, `grip` = `null` (sem dado de origem — decisão da seção de
  brainstorming, mesma filosofia de "não inventar dado" do domínio
  equipment).
- `range` = `{ short: null, medium: null, long: null, min: 0 }` (default
  do schema). **Decisão consciente, não lacuna**: as colunas de alcance
  ("Throw Range", "Missile Range", "Hurl Range") só existem nas ~80
  tabelas de mastery (uma coluna por rank de proficiência), que são o
  sub-projeto 2 — Table 6-1 não tem dado de alcance algum. O alcance
  efetivo em jogo provavelmente vem do item de mastery equipado do
  personagem (`ActorMasteryItemDM` também define seu próprio `range` no
  fantastic-depths), não do item de arma estático. Isso pode ficar
  errado se o sub-projeto 2 revelar que o `range` do weapon item também
  precisa ser preenchido — registrado como risco na seção 8.
- `weight`/`cost`: mesmas conversões do domínio equipment (`weight =
  weightLb × 10`; `cost = cost.value × {cp:.01,sp:.1,ep:.5,pp:5,gp:1}[cost.currency]`).
- `_id`: determinístico (`sha1("weapons:" + name)`, mesmo esquema do
  domínio equipment — hash truncado pro alfabeto de 16 caracteres).
- **Substituição do hand-written**: o builder apaga
  `packsrc/items/Equipment/Weapons/Dagger.json` antes de escrever a leva
  gerada (mesmo padrão do Backpack/Torch no domínio equipment).

## 7. Testes e validação

- **Parser**: fixtures reais reduzidas cobrindo as 4 seções de Table 6-1,
  peso em fração (`½`), dano `"–"`, múltiplos grupos de mastery, e o caso
  Sword Bastard duplicado virando dois nomes distintos.
- **Builder**: conversões de peso/moeda, regra melee/ranged (as 3
  variantes: seção ranged, trait Throw, nem um nem outro), `mastery` com
  grupo único vs múltiplo, `range` sempre no default, determinismo do
  `_id`, dedupe do `Dagger.json`.
- `npm run validate` como gate final, igual às fases anteriores.
- Revisão manual: amostragem de 4-5 armas geradas comparadas com a
  tabela do livro (custo, peso, dano, traits, grupo de mastery).

## 8. Riscos e decisões pendentes

- **`range` vazio pode precisar ser revisitado no sub-projeto 2.** Se ao
  pesquisar `MasteryDefinitionDataModel` a fundo (sub-projeto 2) ficar
  claro que o weapon item PRECISA de um `range` base não-nulo pra
  funcionar corretamente no Foundry (em vez de só o item de mastery
  carregar isso), este sub-projeto pode precisar de uma correção
  pontual — não é um bloqueio agora, mas deve ser checado explicitamente
  no início do próximo spec.
- **Traits como tags é uma tradução mecânica, não uma modelagem de
  regras.** Nenhum trait (Blunt, Simple, Knockout, Deflect, etc.) tem
  efeito mecânico real no Foundry só por estar em `tags` — isso é
  "documentação pesquisável", não implementação de regra. Se o sistema
  fantastic-depths tiver mecânica própria pra algum desses traits (ex.:
  Delay, Stun aplicando condição), fica fora do escopo desta fase.
- **`weaponType: "handheld"` fixo pode estar errado pra armas de
  cerco/fogo.** Pistol e Smoothbore (armas de fogo) usam `"handheld"`
  igual às demais, seguindo o único precedente real (`Dagger.json`); não
  há outro valor de `weaponType` confirmado no código-fonte para
  diferenciar isso nesta fase.
