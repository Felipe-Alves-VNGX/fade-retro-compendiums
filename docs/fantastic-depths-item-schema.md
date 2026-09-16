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
