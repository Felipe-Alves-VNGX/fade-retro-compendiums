# Schema de Item do sistema `fantastic-depths`

Fonte: [`Forelius/fantastic-depths`](https://github.com/Forelius/fantastic-depths),
commit `4a8f2c8`, `src/item/dataModel/*.ts`. Lido diretamente do código-fonte
das classes `DataModel`, não dos nomes de subtipo do `system.json`.

Subtipos declarados em `system.json` → `documentTypes.Item`: `item`, `weapon`,
`armor`, `spell`, `skill`, `actorClass`, `mastery`, `specialAbility`, `class`,
`weaponMastery`, `light`, `condition`, `treasure`, `species`, `ammo`.

Esta fase (1) só usa `item`, `weapon` e `light`. Os demais ficam para as fases
que tratam de classes, magias, skills e masteries.

## `IdentifiableData` (mixin usado por `GearItemDataModel`)

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `unidentifiedName` | string | não | `""` |
| `unidentifiedDesc` | string | não | `""` |
| `isIdentified` | boolean | não | `true` |
| `isCursed` | boolean | não | `false` |

## `GearItemDataModel` (base de `item`, `weapon`, `armor`, `light`, `ammo`)

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `shortName` | string | não | `""` |
| `tags` | string[] | não | `[]` |
| `description` | string | não | `""` |
| `gm.notes` | string | não | `""` |
| `quantity` | number | **sim** | `1` |
| `quantityMax` | number, nullable | não | `0` |
| `charges` | number | **sim** | `0` |
| `chargesMax` | number, nullable | não | `0` |
| `weight` | number | não | `1` |
| `weightEquipped` | number, nullable | não | `null` |
| `cost` | number | não | `0` |
| `totalWeight` | number | não | `0` |
| `totalCost` | number | não | `0` |
| `containerId` | string | não | `""` |
| `equipped` | boolean | não | `false` |
| `container` | boolean | não | `false` |
| `isOpen` | boolean | não | `false` |
| `equippable` | boolean | não | `false` |
| `fuelType` | string | não | `""` |
| `isDropped` | boolean | **sim** | `false` |
| `isTreasure` | boolean | **sim** | `false` |
| `specialAbilities` | array | não | `[]` |
| `spells` | array | não | `[]` |
| `conditions` | array | não | `[]` |

**Unidade de peso**: comparando o `Dagger.json` real do `fade-compendiums`
(`weight: 10`, DD4e diz "1lb") com o `Backpack.json` real (`weight: 20`,
DD4e diz "2lb"), o campo `weight` está em uma escala de 10 unidades por libra
(padrão retro-clone de encumbrance em moedas). Ao converter valores do livro:
`weight_no_pack = libras_no_livro × 10`.

**Unidade de custo**: `cost` está em peças de ouro (gp). Peças de prata (sp)
do livro viram fração decimal: `2sp = 0.2`.

Campos obrigatórios usados pelo validador (Task 6) para o subtipo `item`:
`tags, description, quantity, weight, cost, equipped, container, equippable,
isDropped, isTreasure`.

## `WeaponItemDataModel extends GearItemDataModel`

Campos adicionais:

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `damageRoll` | string | **sim** | `"1d6"` |
| `damageLabel` | string | não | `"1d6"` |
| `damageType` | string | **sim** | `"physical"` |
| `breath` | string, nullable | não | `null` |
| `canMelee` | boolean | **sim** | `true` |
| `canRanged` | boolean | **sim** | `false` |
| `canSet` | boolean | não | `false` |
| `isSlow` | boolean | não | `false` |
| `savingThrow` | string, nullable | não | `null` |
| `saveDmgFormula` | string, nullable | não | `null` |
| `mastery` | string | **sim** | `""` |
| `weaponType` | string | **sim** | `""` |
| `ammoType` | string | não | `""` |
| `range.{short,medium,long,min}` | number, nullable (min: não-nullable) | **sim** (o objeto `range`) | `null`/`null`/`null`/`0` |
| `size` | string, nullable | não | `null` |
| `grip` | string, nullable | não | `null` |
| `natural` | boolean | não | `false` |
| `mod.{dmg,toHit,dmgRanged,toHitRanged,rangeMultiplier,vsGroup}` | number/object | não | `0`/`0`/`0`/`0`/`1`/`{}` |
| `attacks.{used,max,group}` | number | não | `0`/`null`/`0` |
| `siege.*` | vários, nullable | não | todos `null`/`false` |

Campos obrigatórios usados pelo validador para o subtipo `weapon`: os de
`item` + `damageRoll, damageType, canMelee, canRanged, mastery, weaponType,
range`.

## `LightItemDataModel extends GearItemDataModel`

Campos adicionais:

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `isLight` | boolean | não | `true` |
| `light.enabled` | boolean | não | `false` |
| `light.type` | string (`torch`, `lantern`, `bullseye`, `candle`, `magic`, `custom`, `none`) | não | `""` |
| `light.duration` | number, nullable — **em turnos de 10 minutos** | não | `6` |
| `light.radius` | number | não | `30` |
| `light.fuelType` | string | não | `""` |
| `light.secondsRemain` | number | não | `0` |
| `light.bright` | number | não | `6` |
| `light.color` | string (hex) | não | `"#d0a750"` |
| `light.attenuation` | number | não | `0.7` |
| `light.luminosity` | number | não | `0.5` |
| `light.angle` | number | não | `360` |
| `light.animation.{type,speed,intensity}` | string/number | não | `"torch"`/`2`/`3` |

Campos obrigatórios usados pelo validador para o subtipo `light`: os de
`item` + `light`.

## Campos vistos em documentos reais mas não localizados nas DataModels lidas

O `Dagger.json` real do `fade-compendiums` inclui `isAmmo`, `isCarried`,
`dmgFormula`, `healFormula`, `isUsable` — provavelmente de um outro mixin
(`Usable`/`Ammo`) ainda não localizado no código-fonte. **Não** são exigidos
pelo validador desta fase; ficam como item aberto para quando um domínio
futuro (munição, itens usáveis) precisar deles — ver spec, seção 8.

## `ArmorItemDataModel extends GearItemDataModel`

Fonte: `Forelius/fantastic-depths` @ `4a8f2c8`, `src/item/dataModel/ArmorItemDataModel.ts`.

Campos adicionais:

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `ac` | number | **sim** | `9` |
| `isShield` | boolean | não | `false` |
| `av` | string, nullable | não | `null` |
| `armorWeight` | string (`"light"` \| `"heavy"`) | **sim** | `"light"` |
| `mod` | number | **sim** | `0` |
| `modRanged` | number | **sim** | `0` |
| `totalAC` | number | **sim** | `9` |
| `totalRangedAC` | number | **sim** | `9` |
| `totalAAC` | number | **sim** | `9` |
| `totalRangedAAC` | number | **sim** | `9` |
| `natural` | boolean | não | `false` |

**`ac`**: valor absoluto de Armour Class já "melhor que 9" (não um bônus) —
corresponde diretamente à coluna "Armour Class" da Table 9-3 do livro.

**`armorWeight`**: só tem dois valores válidos no código-fonte
(`src/sheets/item/ArmorItemSheet.ts`, `lang/en.json`: `FADE.Armor.armorWeight.choices.light`/`.heavy`).
`src/sys/registry/EncSystem.ts` usa esse campo para decidir o nível de
encumbrance do personagem quando `encSetting === "basic"` — exatamente o
papel que a coluna "Movement Rate" da Table 9-3 desempenha no livro (30'
para as armaduras mais leves, 20' para as mais pesadas). Mapeamento
adotado: `movementRate === "30'" → "light"`, `movementRate === "20'" →
"heavy"`. Não há campo nativo para armazenar a string `"30'"`/`"20'"` em
si — o valor do livro só sobrevive de forma indireta, via `armorWeight`.

**`totalAC`/`totalRangedAC`/`totalAAC`/`totalRangedAAC`**: campos "totais"
que a engine recalcula em runtime a partir de `ac` mais modificadores;
como dado de origem (`packsrc`), são inicializados iguais a `ac` (sem
modificadores aplicados ainda) — mesmo padrão do próprio schema, que já
inicializa `totalAC` igual ao default de `ac` (`9`).

**`isShield`/`natural`**: sempre `false` para os 6 conjuntos de armadura
da Table 9-3 (nenhum é escudo ou armadura natural).

Campos obrigatórios usados pelo validador para o subtipo `armor`: os de
`item` + `ac, armorWeight, mod, modRanged, totalAC, totalRangedAC,
totalAAC, totalRangedAAC`.

## `MasteryDefinitionDataModel`

Fonte: `Forelius/fantastic-depths` @ `4a8f2c8`,
`src/item/dataModel/MasteryDefinitionDataModel.ts`. Registrado em
`src/fantastic-depths.ts:119` como `weaponMastery:
MasteryDefinitionDataModel` — distinto do subtipo `mastery`
(`ActorMasteryItemDM`, linha 116), que é tracking por personagem em
tempo de jogo (embarcado em Actor), não conteúdo de compêndio.

Ao contrário de `item`/`weapon`/`armor`/`light`, este subtipo NÃO
estende `GearItemDataModel` — é `foundry.abstract.TypeDataModel`
direto, sem `tags`, `weight`, `cost`, `description`, etc.

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `name` | string | **sim** | — |
| `weaponType` | string | não | `"handheld"` |
| `primaryType` | string | **sim** | `"all"` |
| `levels` | array de 6 objetos | **sim** | ver abaixo |

Cada elemento de `levels` (um por rank de proficiência):

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `name` | string | **sim** | — |
| `range.{short,medium,long}` | number (NÃO nullable) | **sim** | `0` |
| `pDmgFormula` | string, nullable | não | `null` |
| `sDmgFormula` | string, nullable | não | `null` |
| `acBonusType` | string, nullable | não | `null` |
| `acBonus` | number, nullable | não | `null` |
| `acBonusAT` | number, nullable | não | `null` |
| `pToHit` | number | **sim** | `0` |
| `sToHit` | number | **sim** | `0` |
| `special` | string, nullable | não | `null` |

`p`/`s` = primário/secundário. A estrutura (duas colunas paralelas de
to-hit e dano) bate com o par de tabelas "a" (vs Armed) / "b" (vs
Unarmed) do livro — mapeamento adotado: `p* = tabela "a"`, `s* = tabela
"b"`. O campo `acBonus` de 4 valores do livro (ex. `"–2/–2/–/–"`) não
tem documentação clara de significado por posição; só o primeiro valor
vira `acBonus`, a string completa fica em `system.gm.notes` do
documento (não por nível — o schema não tem notas por nível).

Campos obrigatórios usados pelo validador para o subtipo
`weaponMastery`: `name`, `primaryType`, `levels` (só a presença do
array — a validação dos campos internos de cada nível fica fora do
escopo do validador atual, mesmo padrão dos demais subtipos).

## `SpellItemDataModel`

Fonte: `Forelius/fantastic-depths` @ `4a8f2c8`,
`src/item/fields/SpellField.ts`. Ao contrário de `item`/`weapon`/`armor`/`light`,
este subtipo NÃO estende `GearItemDataModel` — é uma especialização
`TypeDataModel` própria, sem campos de encumbrance (`quantity`, `weight`,
`cost`), equipamento (`equipped`, `container`, etc), ou treasure tracking
(`isTreasure`).

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `tags` | string[] | não | `[]` |
| `description` | string | não | `""` |
| `gm.notes` | string | não | `""` |
| `spellLevel` | number | **sim** | — |
| `range` | string | não | `""` |
| `duration` | string | não | `"Instant"` |
| `effect` | string | não | `""` |
| `memorized` | number, nullable | não | `0` |
| `cast` | number | não | `0` |
| `targetSelf` | boolean | não | `true` |
| `targetOther` | boolean | não | `true` |
| `dmgFormula` | string, nullable | não | `null` |
| `healFormula` | string, nullable | não | `null` |
| `maxTargetFormula` | string, nullable | não | `null` |
| `durationFormula` | string, nullable | não | `null` |
| `savingThrow` | string, nullable | não | `null` |
| `saveDmgFormula` | string, nullable | não | `null` |
| `attackType` | string | não | `""` |
| `damageType` | string | não | `""` |
| `conditions` | array | não | `[]` |
| `classes` | array | não | `[]` |

**`spellLevel`**: número do círculo da magia (1-9), correspondente à coluna
"Circle" do livro. É a única propriedade verdadeiramente obrigatória
do schema (sem default), especificada como `required: true` em
`SpellField.ts`.

**`targetSelf`/`targetOther`**: o schema tem default `true` para ambos,
indicando que qualquer magia pode ter o lançador como alvo e/ou outros
— quando não há valor explícito na interface, ambos são verdadeiros.
O builder, porém, sempre escreve um valor explícito derivado do campo
`target` (texto livre do livro), nunca deixa no default.

**`tags`**: lista de esferas de magia normalizadas (lowercase, espaços viram
hífens): `"Energy"` → `"energy"`, `"Inertia"` → `"inertia"`, etc.
Corresponde às colunas "Sphere" do livro, podendo ser múltiplas.

Campos obrigatórios usados pelo validador para o subtipo `spell`:
`spellLevel`, `range`, `duration`.

## `SkillItemDataModel`

Fonte: `Forelius/fantastic-depths` @ `4a8f2c8`,
`src/item/dataModel/SkillItemDataModel.ts`. Similar ao `SpellItemDataModel`,
este subtipo NÃO estende `GearItemDataModel` — é uma especialização
`TypeDataModel` própria.

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `description` | string | não | `""` |
| `gm.notes` | string | não | `""` |
| `ability` | string | **sim** | `"str"` |
| `targetFormula` | string | **sim** | `"@rollTarget"` |
| `operator` | string | **sim** | `"lte"` |
| `rollFormula` | string | **sim** | `"1d20"` |
| `level` | number | **sim** | `1` |
| `rollMode` | string | não | `""` |
| `healFormula` | string, nullable | não | `null` |
| `showResult` | boolean | não | `true` |
| `skillBonus` | number | **sim** | `0` |
| `skillPenalty` | number | **sim** | `0` |
| `autoSuccess` | number, nullable | não | `null` |
| `autoFail` | number, nullable | não | `null` |

**`ability`**: uma das 6 core abilities (`str`, `dex`, `con`, `int`, `wis`, `cha`).
Default para skills com dupla ability é registrado em `gm.notes` (não há campo
próprio); para "special skills" (sem ability), é `"str"` com nota em `gm.notes`.

**`rollFormula`/`targetFormula`/`operator`**: conjunto padrão para skills —
`"1d20"`, `"@rollTarget"`, `"lte"` — descreve um d20-lower-equals-better check.

**`skillBonus`/`skillPenalty`**: modificadores aplicáveis diretos (normalmente
`0`, deixando o bônus de ability ser fonte primária de modificação).

Campos obrigatórios usados pelo validador para o subtipo `skill`: `ability`,
`targetFormula`, `operator`, `rollFormula`, `level`, `skillBonus`, `skillPenalty`.

## `SpecialAbilityDataModel`

Fonte: `Forelius/fantastic-depths` @ `4a8f2c8`,
`src/item/fields/SpecialAbilityField.ts`. Este subtipo NÃO estende
`GearItemDataModel` — `SpecialAbilityDataModel` é a especialização
`TypeDataModel` própria (sem campos de encumbrance, equipamento ou treasure
tracking), que delega seus campos para `SpecialAbilityData`, a qual estende
diretamente `foundry.abstract.DataModel` (não `TypeDataModel`).

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `tags` | string[] | não | `[]` |
| `description` | string | não | `""` |
| `gm.notes` | string | não | `""` |
| `rollFormula` | string | não | `""` |
| `operator` | string | não | `""` |
| `target` | string | não | `""` |
| `rollMode` | string | não | `"publicroll"` |
| `autoSuccess` | number, nullable | não | `null` |
| `autoFail` | number, nullable | não | `null` |
| `abilityMod` | string | não | `""` |
| `savingThrow` | string, nullable | não | `null` |
| `dmgFormula` | string, nullable | não | `null` |
| `healFormula` | string, nullable | não | `null` |
| `damageType` | string | não | `""` |
| `category` | string | não | `""` |
| `shortName` | string | não | `""` |
| `combatManeuver` | string, nullable | não | `null` |
| `customSaveCode` | string, nullable | não | `null` |
| `classKey` | string, nullable | não | `null` |
| `showResult` | boolean | não | `true` |
| `quantity` | number | não | `1` |
| `quantityMax` | number, nullable | não | `null` |
| `conditions` | array | não | `[]` |

**`category`**: para talents (Task 2), sempre `"talent"`. Pode ter outros valores
em futuros domínios que gerem `specialAbility` items com categorias diferentes.

**`rollFormula`/`operator`/`target`**: campos para ações que exigem rolls
(podem ser vazios para talentos passivos).

**Campos vazios/nulos para talents**: Na Task 2 (talents), os seguintes campos
são sempre vazios/null pois talents são habilidades passivas sem teste obrigatório:
`rollFormula`, `operator`, `target`, `abilityMod`, `savingThrow`, `dmgFormula`,
`healFormula`, `damageType`, `shortName`, `combatManeuver`, `customSaveCode`, `classKey`.

Campos obrigatórios usados pelo validador para o subtipo `specialAbility`: nenhum
(lista vazia de campos obrigatórios — só envelopes e referências são checadas).

## `ClassDefinitionDataModel`

Fonte: `Forelius/fantastic-depths` @ `4a8f2c8`,
`src/item/dataModel/ClassDefinitionDataModel.ts`. Este subtipo NÃO estende
`GearItemDataModel` — é uma especialização `TypeDataModel` própria, sem campos
de encumbrance, equipamento ou treasure tracking.

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `key` | string | **sim** | — |
| `species` | string | **sim** | `"Human"` |
| `firstLevel` | number | **sim** | `1` |
| `maxLevel` | number | **sim** | `0` (o schema real; `36` é o valor de livro escrito por ESTE builder para todas as 10 classes, não o default do schema) |
| `firstSpellLevel` | number | **sim** | `1` |
| `maxSpellLevel` | number | **sim** | `0` |
| `basicProficiency` | boolean | **sim** | `false` |
| `unskilledToHitMod` | number | **sim** | `-2` |
| `alignment` | string | não | `"Any"` |
| `description` | string | não | `""` |
| `castAsKey` | string, nullable | não | `null` |
| `primeReqs` | array de objetos | **sim** | — |
| `levels` | array de objetos | **sim** | — |
| `saves` | array de objetos | **sim** | — |
| `spells` | 2D array | não | computado dinamicamente (`Array.from(...)`), não um literal `[]` fixo |
| `specialAbilities` | array | não | `[]` |
| `classItems` | array | não | `[]` |
| `abilities` | object | não | atribuído dinamicamente via `game.fade.registry` em runtime |

Cada elemento de `primeReqs` (todos os 4 campos são **obrigatórios** no schema
real):

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `ability` | string | **sim** | — |
| `minScore` | number | **sim** | sem `initial` no schema — não colocar um default fictício |
| `percentage` | number | **sim** | — |
| `concatLogic` | string (não nullable) | **sim** | — |

Cada elemento de `levels`:

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| `level` | number | **sim** | — |
| `xp` | number | **sim** | — |
| `thac0` | number | **sim** | `CONFIG.FADE.ToHit.baseTHAC0` — este projeto NUNCA sobrescreve esse valor (fica no default do schema; ver spec deste sub-projeto, seção 3) |
| `thbonus` | number | **sim** | `0` |
| `hd` | string | **sim** | `""` |
| `hdcon` | boolean | **sim** | `true` |
| `title` | string, nullable | não | `null` |
| `femaleTitle` | string, nullable | não | `null` |
| `attackRank` | string | não | `null` |

`saves` (a propriedade em si) é `new ArrayField(new ObjectField({}), {...})`
no schema real — um array de objetos genéricos, **sem sub-schema imposto pelo
Foundry** (nenhuma coluna, tipo ou default é validado pelo `ObjectField({})`
vazio). Este sub-projeto usa, por convenção própria (documentada na spec deste
sub-projeto, seção 5, não porque o schema exige), a forma
`{ level, doom, ray, stasis, blast, spell }` para cada elemento.

**`key`**: identificador único da classe, único dentro do domínio (ex. `"fighter"`, `"battlemage"`).
Corresponde ao arquivo `parsedKey` derivado pelo parser (Task 1) do nome na tabela do livro.

**`species`**: sempre `"Human"` para este sub-projeto (domínio núcleo de classes).
Diferenças de espécie ficam para um sub-projeto futuro (skills variadas por espécie).

**`maxSpellLevel`**: para não-lançadores, sempre `0`; para lançadores, igual a
`circleCount` do parser (Task 1) — mapeamento direto.

**`firstSpellLevel`**: para todos os lançadores, sempre `1` (primeira magia
disponível no nível 1 da classe).

**`spells`**: 2D array na forma real `spells[levelIndex][circleIndex]` — 36
linhas (uma por nível da classe) × `circleCount` colunas (uma por círculo de
magia), confirmado contra os JSONs reais gerados em
`packsrc/items/Character_Classes/*.json`; para não-lançadores, vazio `[]`.

**`specialAbilities`** e **`classItems`**: inicialmente vazios (já que as
class abilities pertencem a um sub-projeto separado — "habilidades e talentos").
Será populado pelo sub-projeto 2 da fase 3 em commits subsequentes, *sobre o
mesmo documento com mesmo `_id` determinístico*.

**`abilities`**: campo de runtime do Foundry, atribuído dinamicamente via
`game.fade.registry` quando uma classe é carregada num ator/personagem. **Fora
do alcance de qualquer builder deste projeto** — nunca é populado estaticamente.

Campos obrigatórios usados pelo validador para o subtipo `class`: `key`, `species`,
`firstLevel`, `maxLevel`, `firstSpellLevel`, `maxSpellLevel`, `basicProficiency`,
`unskilledToHitMod`, `primeReqs`, `levels`, `saves`.
