# fade-retro-compendiums — Fase 3, domínio Equipment — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o pipeline parser → `extract/parsed` → builder para o domínio "equipment" (Table 9-1: Mundane Items e Table 9-3: Armour do cap. 9), produzindo `packsrc/items/Equipment/{Adventuring_Gear,Armour}/*.json` prontos para `npm run validate`.

**Architecture:** `scripts/parse/equipment.mjs` extrai as duas tabelas de `extract/raw/equipment.txt` (texto puro, já normalizado na Fase 2) para `extract/parsed/equipment.json` (formato intermediário, unidades ainda como impressas no livro). `scripts/build/equipment.mjs` lê esse JSON, aplica conversões de unidade (peso ×10, moeda→gp), casa descrição narrativa por nome, gera `_id` determinístico por hash, e escreve os documentos Item finais. Nenhuma dependência nova.

**Tech Stack:** Node.js (ESM), `node:test`, `node:crypto` (para `_id` determinístico).

**Spec:** `docs/superpowers/specs/2026-09-17-fase3-equipment-design.md` (e o spec geral, `docs/superpowers/specs/2026-09-16-fade-retro-compendiums-design.md`, seção 7)

## Global Constraints

- Escopo: só Table 9-1 (Mundane Items → subtipo `item`) e Table 9-3 (Armour → subtipo `armor`). Table 9-2 (Weapons) e Tables 9-4 a 9-12 ficam fora desta fase.
- Munição da Table 9-1 (Arrows, Bolts, Bullets, Pellets, Darts) entra como subtipo `item` genérico, não `ammo` — decisão deliberada, não pesquisar `AmmoItemDataModel` nesta fase.
- Unidade de peso: `system.weight = pesoEmLibrasDoLivro × 10`.
- Unidade de moeda: `cp×0.01, sp×0.1, ep×0.5, pp×5, gp×1`, tudo convertido para `system.cost` em gp decimal.
- `_id` de todo documento gerado é determinístico (hash do nome), nunca aleatório — builder idempotente.
- Os hand-written `packsrc/items/Equipment/Adventuring_Gear/Backpack.json` e `Torch.json` (Fase 1) são apagados e substituídos pelas versões geradas a partir da Table 9-1. `Dagger.json` não é tocado.
- Nome do documento Item gerado = nome da linha da tabela **como impresso**, só removendo um prefixo numérico de quantidade (`"20 Arrows"` → nome `"Arrows"`, `quantity: 20`). Nenhuma outra normalização de nome. Isso significa que o item antes chamado `"Backpack"` (Fase 1) passa a se chamar `"Backpack (holds 40lb)"` — mudança deliberada, não um bug.
- O builder não infere semanticamente quais itens são recipientes: todo item gerado usa os defaults do `GearItemDataModel` (`container: false`, `equippable: true`, `equipped: false`), mesmo para itens que logicamente são recipientes (Backpack, Sack, Purse, Quiver). Isso é uma perda aceita em relação ao `Backpack.json` manual da Fase 1 (que tinha `container: true`) — registrado aqui para não ser reaberto como bug nesta fase; um ajuste manual pontual desses itens fica para revisão futura, fora deste plano.
- Descrição de cada item gerado é casada por nome contra o texto narrativo de `extract/raw/equipment.txt` (algoritmo exato na Task 3). Quando não há correspondência, o item recebe `description: ""` e o builder loga um aviso — não é erro fatal.

---

### Task 1: Schema de `ArmorItemDataModel` e suporte no validador

**Files:**
- Modify: `docs/fantastic-depths-item-schema.md`
- Modify: `scripts/extract/validate.mjs`
- Modify: `scripts/extract/validate.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `SUBTYPE_REQUIRED_FIELDS.armor` em `validate.mjs` (lista de campos obrigatórios de `system` para o subtipo `armor`), consumida por `validateDocument` (já existente) e, transitivamente, por `npm run validate` ao final da Task 4. A lista de campos do schema documentada aqui é consumida pelo builder da Task 3.

O schema abaixo já foi lido do código-fonte real (`Forelius/fantastic-depths` @ `4a8f2c8`, `src/item/dataModel/ArmorItemDataModel.ts`) — não é uma tarefa de pesquisa em aberto, é conteúdo a transcrever.

- [ ] **Step 1: Escrever o teste de validação para `armor` (falhando)**

Adicionar ao final de `scripts/extract/validate.test.mjs` (antes do `test("validatePack reports zero errors...`, mantendo o `validWeapon` existente intocado):

```javascript
const validArmor = {
   name: "Leather Armour",
   type: "armor",
   _id: "xdkGfiDCe4dPI7Up",
   folder: "2AKCulCJIGNyAMaN",
   _originalKey: "!items!xdkGfiDCe4dPI7Up",
   system: {
      tags: [],
      description: "<p>Leather armour.</p>",
      quantity: 1,
      weight: 200,
      cost: 20,
      equipped: false,
      container: false,
      equippable: true,
      isDropped: false,
      isTreasure: false,
      ac: 7,
      armorWeight: "light",
      mod: 0,
      modRanged: 0,
      totalAC: 7,
      totalRangedAC: 7,
      totalAAC: 7,
      totalRangedAAC: 7,
   },
};

test("validateDocument accepts a fully-formed armor", () => {
   const errors = validateDocument(validArmor, {
      packName: "items",
      knownFolderIds: new Set(["2AKCulCJIGNyAMaN"]),
   });
   assert.deepEqual(errors, []);
});

test("validateDocument flags a missing required armor field", () => {
   const broken = structuredClone(validArmor);
   delete broken.system.armorWeight;
   const errors = validateDocument(broken, {
      packName: "items",
      knownFolderIds: new Set(["2AKCulCJIGNyAMaN"]),
   });
   assert.ok(
      errors.some((e) => e.includes("system.armorWeight")),
      `expected an error mentioning system.armorWeight, got: ${errors.join(", ")}`
   );
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test`
Expected: as duas novas asserções falham — `validateDocument accepts a fully-formed armor` falha porque `errors` contém `"unknown subtype 'armor' — add it to SUBTYPE_REQUIRED_FIELDS..."` em vez de `[]` (subtipo `armor` ainda não existe em `SUBTYPE_REQUIRED_FIELDS`).

- [ ] **Step 3: Adicionar `armor` a `SUBTYPE_REQUIRED_FIELDS` em `scripts/extract/validate.mjs`**

Em `scripts/extract/validate.mjs`, modificar o bloco (linhas 18-22 atuais):

```javascript
const SUBTYPE_REQUIRED_FIELDS = {
   item: GEAR_REQUIRED_FIELDS,
   weapon: [...GEAR_REQUIRED_FIELDS, "damageRoll", "damageType", "canMelee", "canRanged", "mastery", "weaponType", "range"],
   light: [...GEAR_REQUIRED_FIELDS, "light"],
   armor: [...GEAR_REQUIRED_FIELDS, "ac", "armorWeight", "mod", "modRanged", "totalAC", "totalRangedAC", "totalAAC", "totalRangedAAC"],
};
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: todos os testes passam, incluindo os dois novos.

- [ ] **Step 5: Documentar `ArmorItemDataModel` em `docs/fantastic-depths-item-schema.md`**

Adicionar uma nova seção ao final do arquivo (depois da seção `## Campos vistos em documentos reais mas não localizados nas DataModels lidas`):

```markdown
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
```

- [ ] **Step 6: Commit**

```bash
git add docs/fantastic-depths-item-schema.md scripts/extract/validate.mjs scripts/extract/validate.test.mjs
git commit -m "$(cat <<'EOF'
feat: ArmorItemDataModel schema doc and validator support

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Parser — `scripts/parse/equipment.mjs`

**Files:**
- Create: `scripts/parse/equipment.mjs`
- Test: `scripts/parse/equipment.test.mjs`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Consumes: `extract/raw/equipment.txt` (texto, já existe, commitado na Fase 2).
- Produces:
  - `parseEquipment(rawText: string) -> Array<Row>`, exportado, onde `Row` é
    `{ table: "mundane-items", name: string, bundleQty: number, weightLb: number, cost: { value: number, currency: "cp"|"sp"|"ep"|"pp"|"gp", isMinimum: boolean } }`
    ou
    `{ table: "armour", name: string, armourClass: number, weightLb: number, cost: {...mesma forma}, movementRate: string }`.
  - Um CLI (`node scripts/parse/equipment.mjs`) que lê `extract/raw/equipment.txt`,
    chama `parseEquipment`, e escreve `extract/parsed/equipment.json`
    (array de `Row`, `JSON.stringify(rows, null, 2)`).
  - `parseEquipment` é consumida pelo builder da Task 3 só indiretamente,
    via o arquivo `extract/parsed/equipment.json` que o CLI escreve — o
    builder nunca importa `equipment.mjs` do parser diretamente.

- [ ] **Step 1: Escrever os testes do parser (falhando)**

Criar `scripts/parse/equipment.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEquipment } from "./equipment.mjs";

const FIXTURE = `--- page 147 ---
                          Chapter 9 –
                             for Ad
T    hey say that money makes the world go around.

MONEY
The actual type of money that people use...

--- page 148 ---
                   Table 9–1: Mundane Items
              Item                 Weight           Cost
           20 Arrows                 1lb             5gp
    Backpack (holds 40lb)            2lb             5gp
         Clothes (royal)             3lb           50+gp
           30 Pellets               0.1lb            1gp

Backpack: A leather or canvas backpack with shoulder straps
for carrying things while leaving the hands free.

Clothes (royal): Extravagant and ostentatious clothing fit for
a king or even an emperor.

--- page 150 ---
                   Table 9–2: Weapons
              Item              Weight        Cost
              Axe, Battle          8lb          5gp

--- page 152 ---
                                                      Table 9–3: Armour
                 Item                       Armour Class      Weight                             Cost                 Movement Rate
            Leather Armour                       7              20lb                             20gp                      30'
             Banded Mail                         4              45lb                             50gp                      20'
Shield, Buckler: A buckler is a small shield.

ARMOUR
Armour is toughened clothing.

--- page 153 ---
                                         Table 9–4: Pack and Riding Animals
                     Item                       Carrying Capacity           Speed                      Cost
                    Camel                             300lb               50'/round                   100gp
`;

test("parses a Mundane Items row with no quantity prefix", () => {
   const rows = parseEquipment(FIXTURE);
   const backpack = rows.find((r) => r.table === "mundane-items" && r.name === "Backpack (holds 40lb)");
   assert.deepEqual(backpack, {
      table: "mundane-items",
      name: "Backpack (holds 40lb)",
      bundleQty: 1,
      weightLb: 2,
      cost: { value: 5, currency: "gp", isMinimum: false },
   });
});

test("parses a Mundane Items row with a bundle quantity prefix", () => {
   const rows = parseEquipment(FIXTURE);
   const arrows = rows.find((r) => r.table === "mundane-items" && r.name === "Arrows");
   assert.deepEqual(arrows, {
      table: "mundane-items",
      name: "Arrows",
      bundleQty: 20,
      weightLb: 1,
      cost: { value: 5, currency: "gp", isMinimum: false },
   });
});

test("parses a Mundane Items row with a fractional weight", () => {
   const rows = parseEquipment(FIXTURE);
   const pellets = rows.find((r) => r.table === "mundane-items" && r.name === "Pellets");
   assert.equal(pellets.weightLb, 0.1);
   assert.equal(pellets.bundleQty, 30);
});

test("parses a Mundane Items row with a minimum-cost marker", () => {
   const rows = parseEquipment(FIXTURE);
   const clothes = rows.find((r) => r.table === "mundane-items" && r.name === "Clothes (royal)");
   assert.deepEqual(clothes.cost, { value: 50, currency: "gp", isMinimum: true });
});

test("does not include rows from Table 9-2 (Weapons)", () => {
   const rows = parseEquipment(FIXTURE);
   assert.ok(!rows.some((r) => r.name === "Axe, Battle"));
});

test("parses an Armour row with all 5 columns", () => {
   const rows = parseEquipment(FIXTURE);
   const leather = rows.find((r) => r.table === "armour" && r.name === "Leather Armour");
   assert.deepEqual(leather, {
      table: "armour",
      name: "Leather Armour",
      armourClass: 7,
      weightLb: 20,
      cost: { value: 20, currency: "gp", isMinimum: false },
      movementRate: "30'",
   });
   const banded = rows.find((r) => r.table === "armour" && r.name === "Banded Mail");
   assert.equal(banded.armourClass, 4);
   assert.equal(banded.movementRate, "20'");
});

test("does not include rows from Table 9-4 (Pack and Riding Animals)", () => {
   const rows = parseEquipment(FIXTURE);
   assert.ok(!rows.some((r) => r.name === "Camel"));
});

test("returns exactly 6 rows for this fixture (4 mundane-items + 2 armour)", () => {
   const rows = parseEquipment(FIXTURE);
   assert.equal(rows.length, 6);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test scripts/parse/equipment.test.mjs`
Expected: `Cannot find module './equipment.mjs'` (o arquivo ainda não existe).

- [ ] **Step 3: Implementar `scripts/parse/equipment.mjs`**

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENCY_PATTERN = "(?:gp|sp|ep|pp)";

const MUNDANE_ROW_RE = new RegExp(
   `^\\s*(.+?)\\s{2,}(\\d+(?:\\.\\d+)?)lb\\s{2,}(\\d+(?:\\.\\d+)?)(\\+)?(${CURRENCY_PATTERN})\\s*$`
);
const ARMOUR_ROW_RE = new RegExp(
   `^\\s*(.+?)\\s{2,}(\\d+)\\s{2,}(\\d+(?:\\.\\d+)?)lb\\s{2,}(\\d+(?:\\.\\d+)?)(\\+)?(${CURRENCY_PATTERN})\\s{2,}(\\d+)'\\s*$`
);
const BUNDLE_PREFIX_RE = /^(\d+)\s+(.+)$/;

function extractBlock(rawText, startMarker, endMarker) {
   const startIndex = rawText.indexOf(startMarker);
   if (startIndex === -1) return "";
   const afterStart = startIndex + startMarker.length;
   const endIndex = endMarker ? rawText.indexOf(endMarker, afterStart) : -1;
   return endIndex === -1 ? rawText.slice(afterStart) : rawText.slice(afterStart, endIndex);
}

function parseCost(value, plus, currency) {
   return {
      value: Number.parseFloat(value),
      currency,
      isMinimum: plus === "+",
   };
}

function splitBundle(rawName) {
   const match = rawName.match(BUNDLE_PREFIX_RE);
   if (!match) return { bundleQty: 1, name: rawName };
   return { bundleQty: Number.parseInt(match[1], 10), name: match[2] };
}

function parseMundaneItemsBlock(block) {
   const rows = [];
   for (const line of block.split("\n")) {
      const match = line.match(MUNDANE_ROW_RE);
      if (!match) continue;
      const [, rawName, weightLb, costValue, costPlus, currency] = match;
      const { bundleQty, name } = splitBundle(rawName.trim());
      rows.push({
         table: "mundane-items",
         name,
         bundleQty,
         weightLb: Number.parseFloat(weightLb),
         cost: parseCost(costValue, costPlus, currency),
      });
   }
   return rows;
}

function parseArmourBlock(block) {
   const rows = [];
   for (const line of block.split("\n")) {
      const match = line.match(ARMOUR_ROW_RE);
      if (!match) continue;
      const [, rawName, armourClass, weightLb, costValue, costPlus, currency, movement] = match;
      rows.push({
         table: "armour",
         name: rawName.trim(),
         armourClass: Number.parseInt(armourClass, 10),
         weightLb: Number.parseFloat(weightLb),
         cost: parseCost(costValue, costPlus, currency),
         movementRate: `${movement}'`,
      });
   }
   return rows;
}

/**
 * Parse Table 9-1 (Mundane Items) and Table 9-3 (Armour) out of the
 * chapter 9 raw text produced by Phase 2's pdf2txt.mjs.
 * @param {string} rawText - full contents of extract/raw/equipment.txt
 * @returns {Array<object>} rows, see plan Task 2 "Produces" for shape
 */
export function parseEquipment(rawText) {
   const mundaneBlock = extractBlock(rawText, "Table 9–1: Mundane Items", "Table 9–2");
   const armourBlock = extractBlock(rawText, "Table 9–3: Armour", "Table 9–4");
   return [...parseMundaneItemsBlock(mundaneBlock), ...parseArmourBlock(armourBlock)];
}

async function main() {
   const rawPath = path.join(process.cwd(), "extract", "raw", "equipment.txt");
   const rawText = await fs.readFile(rawPath, "utf8");
   const rows = parseEquipment(rawText);
   const outDir = path.join(process.cwd(), "extract", "parsed");
   await fs.mkdir(outDir, { recursive: true });
   const outPath = path.join(outDir, "equipment.json");
   await fs.writeFile(outPath, JSON.stringify(rows, null, 2) + "\n", "utf8");
   console.log(`wrote ${outPath} (${rows.length} rows)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test scripts/parse/equipment.test.mjs`
Expected: todos os 8 testes passam.

- [ ] **Step 5: Atualizar `package.json` para incluir os testes do parser**

Modificar o script `test` em `package.json`:

```json
"test": "node --test scripts/extract/*.test.mjs scripts/parse/*.test.mjs",
```

Run: `npm test`
Expected: todos os testes de `scripts/extract/` e `scripts/parse/` passam (18 + 8 = 26 testes — os 18 de `scripts/extract/` já incluem os 2 novos de `armor` da Task 1).

- [ ] **Step 6: Rodar o CLI contra o texto real e inspecionar a contagem**

Run:
```bash
node scripts/parse/equipment.mjs
node -e "
const rows = JSON.parse(require('fs').readFileSync('extract/parsed/equipment.json', 'utf8'));
const mundane = rows.filter(r => r.table === 'mundane-items');
const armour = rows.filter(r => r.table === 'armour');
console.log('mundane-items:', mundane.length, '| armour:', armour.length);
console.assert(armour.length === 6, 'esperava 6 linhas de armour, achou ' + armour.length);
console.assert(mundane.length >= 40 && mundane.length <= 45, 'esperava entre 40 e 45 linhas mundane-items, achou ' + mundane.length);
"
```
Expected: `mundane-items: <N entre 40 e 45> | armour: 6`, sem `Assertion failed`. (A tabela do livro tem 43 linhas de item; a faixa 40-45 tolera o parser eventualmente não casar 1-2 linhas por alguma variação de espaçamento não prevista — se isso acontecer, inspecione `extract/parsed/equipment.json` manualmente antes de prosseguir, não ajuste a tolerância para "passar".)

- [ ] **Step 7: Commit**

```bash
git add scripts/parse/equipment.mjs scripts/parse/equipment.test.mjs package.json extract/parsed/equipment.json
git commit -m "$(cat <<'EOF'
feat: equipment parser (Table 9-1 and Table 9-3 -> extract/parsed/equipment.json)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Builder — `scripts/build/equipment.mjs`

**Files:**
- Create: `scripts/build/equipment.mjs`
- Test: `scripts/build/equipment.test.mjs`
- Modify: `packsrc/items/_folders.json` (nova pasta `Armour`)
- Modify: `package.json` (script `test`)

**Interfaces:**
- Consumes: `extract/parsed/equipment.json` (Task 2, array de `Row` — mesma
  forma documentada na Task 2 "Produces"); `extract/raw/equipment.txt`
  (Fase 2, para casamento de descrição); os campos de `ArmorItemDataModel`
  documentados na Task 1.
- Produces:
  - `deterministicId(seed: string) -> string` (16 caracteres alfanuméricos).
  - `matchDescription(name: string, rawText: string) -> string | null`.
  - `buildDocument(row: Row) -> object` (documento Item pronto para
    `JSON.stringify`).
  - Um CLI (`node scripts/build/equipment.mjs`) que lê os dois arquivos de
    entrada, apaga `packsrc/items/Equipment/Adventuring_Gear/Backpack.json`
    e `.../Torch.json` se existirem, e escreve um arquivo por linha em
    `packsrc/items/Equipment/Adventuring_Gear/` (subtipo `item`) ou
    `packsrc/items/Equipment/Armour/` (subtipo `armor`).

- [ ] **Step 1: Adicionar a pasta `Armour` a `packsrc/items/_folders.json`**

Adicionar esta entrada ao objeto existente em `packsrc/items/_folders.json`
(irmã de `"!folders!2AKCulCJIGNyAMaN"`, mesmo pai `"luTBWNJHVwpLxh6c"`):

```json
"!folders!48tCQXEOwmD69xw2": {
   "name": "Armour",
   "sorting": "a",
   "folder": "luTBWNJHVwpLxh6c",
   "type": "Item",
   "_id": "48tCQXEOwmD69xw2",
   "description": "",
   "sort": 300000,
   "color": "#4a4a4a",
   "flags": {},
   "_stats": {
      "coreVersion": "13.347",
      "systemId": "fantastic-depths"
   }
}
```

Run: `node -e "JSON.parse(require('fs').readFileSync('packsrc/items/_folders.json', 'utf8')); console.log('JSON OK')"`
Expected: `JSON OK` (sem exceção de parse).

- [ ] **Step 2: Escrever os testes do builder (falhando)**

Criar `scripts/build/equipment.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, matchDescription, buildDocument } from "./equipment.mjs";

test("deterministicId is stable across calls", () => {
   assert.equal(deterministicId("equipment:Backpack"), deterministicId("equipment:Backpack"));
});

test("deterministicId matches 16-char alphanumeric ID pattern", () => {
   assert.match(deterministicId("equipment:Torch"), /^[a-zA-Z0-9]{16}$/);
});

test("deterministicId produces the expected value for a known seed", () => {
   assert.equal(deterministicId("equipment:Backpack"), "PnbbSsOUyqXtYttz");
});

const DESCRIPTION_FIXTURE = `Backpack: A leather or canvas backpack with shoulder straps
for carrying things while leaving the hands free.

Boots (plain): Simple yet sturdy hard leather boots for
walking or riding in.

Sack (small): A canvas sack for either carrying in one hand
or loading onto a horse or other beast of burden.
`;

test("matchDescription finds an exact-name header", () => {
   const desc = matchDescription("Boots (plain)", DESCRIPTION_FIXTURE);
   assert.equal(desc, "Simple yet sturdy hard leather boots for walking or riding in.");
});

test("matchDescription falls back to the name with its parenthetical stripped", () => {
   const desc = matchDescription("Backpack (holds 40lb)", DESCRIPTION_FIXTURE);
   assert.equal(desc, "A leather or canvas backpack with shoulder straps for carrying things while leaving the hands free.");
});

test("matchDescription returns null when no header matches either candidate", () => {
   const desc = matchDescription("Sack (holds 20lb)", DESCRIPTION_FIXTURE);
   assert.equal(desc, null);
});

test("buildDocument maps a mundane-items row with a bundle quantity", () => {
   const doc = buildDocument({
      table: "mundane-items",
      name: "Arrows",
      bundleQty: 20,
      weightLb: 1,
      cost: { value: 5, currency: "gp", isMinimum: false },
   }, { rawText: "" });

   assert.equal(doc.name, "Arrows");
   assert.equal(doc.type, "item");
   assert.equal(doc.system.quantity, 20);
   assert.equal(doc.system.weight, 10);
   assert.equal(doc.system.cost, 5);
   assert.equal(doc.system.description, "");
});

test("buildDocument converts sp cost to a gp fraction", () => {
   const doc = buildDocument({
      table: "mundane-items",
      name: "Belt",
      bundleQty: 1,
      weightLb: 0.5,
      cost: { value: 2, currency: "sp", isMinimum: false },
   }, { rawText: "" });

   assert.equal(doc.system.cost, 0.2);
});

test("buildDocument records a minimum-cost note without inventing a schema field", () => {
   const doc = buildDocument({
      table: "mundane-items",
      name: "Clothes (royal)",
      bundleQty: 1,
      weightLb: 3,
      cost: { value: 50, currency: "gp", isMinimum: true },
   }, { rawText: "" });

   assert.equal(doc.system.cost, 50);
   assert.match(doc.system.gm.notes, /50\+gp/);
});

test("buildDocument maps an armour row, deriving armorWeight from movementRate", () => {
   const light = buildDocument({
      table: "armour",
      name: "Leather Armour",
      armourClass: 7,
      weightLb: 20,
      cost: { value: 20, currency: "gp", isMinimum: false },
      movementRate: "30'",
   }, { rawText: "" });
   assert.equal(light.type, "armor");
   assert.equal(light.system.ac, 7);
   assert.equal(light.system.totalAC, 7);
   assert.equal(light.system.armorWeight, "light");

   const heavy = buildDocument({
      table: "armour",
      name: "Banded Mail",
      armourClass: 4,
      weightLb: 45,
      cost: { value: 50, currency: "gp", isMinimum: false },
      movementRate: "20'",
   }, { rawText: "" });
   assert.equal(heavy.system.armorWeight, "heavy");
});

test("buildDocument is idempotent: same row produces byte-identical _id and name twice", () => {
   const row = {
      table: "mundane-items", name: "Torch", bundleQty: 1, weightLb: 0.5,
      cost: { value: 2, currency: "sp", isMinimum: false },
   };
   const first = buildDocument(row, { rawText: "" });
   const second = buildDocument(row, { rawText: "" });
   assert.equal(first._id, second._id);
   assert.deepEqual(first, second);
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `node --test scripts/build/equipment.test.mjs`
Expected: `Cannot find module './equipment.mjs'`.

- [ ] **Step 4: Implementar `scripts/build/equipment.mjs`**

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ADVENTURING_GEAR_FOLDER_ID = "vItxVSiPb4vq0Mmc";
const ARMOUR_FOLDER_ID = "48tCQXEOwmD69xw2";
const CURRENCY_TO_GP = { cp: 0.01, sp: 0.1, ep: 0.5, pp: 5, gp: 1 };

/**
 * Derive a stable 16-char alphanumeric Foundry-style _id from a seed
 * string, so re-running the builder over the same input never changes
 * an existing document's identity.
 * @param {string} seed
 * @returns {string}
 */
export function deterministicId(seed) {
   const hash = crypto.createHash("sha1").update(seed).digest();
   let id = "";
   for (let i = 0; i < 16; i++) {
      id += ID_ALPHABET[hash[i] % ID_ALPHABET.length];
   }
   return id;
}

function escapeRegExp(value) {
   return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find the narrative description paragraph for an item by matching a
 * "<Name>: " line header in the chapter's raw text, trying the full name
 * first and then the name with a trailing "(...)" qualifier stripped
 * (many table rows add a qualifier — e.g. "Backpack (holds 40lb)" — that
 * the book's own prose header omits — e.g. "Backpack: ..."). Returns null,
 * never throws, when neither candidate has a matching header; the caller
 * is responsible for logging that as a warning.
 * @param {string} name
 * @param {string} rawText
 * @returns {string | null}
 */
export function matchDescription(name, rawText) {
   const candidates = [name];
   const parenMatch = name.match(/^(.*?)\s*\([^)]*\)\s*$/);
   if (parenMatch) candidates.push(parenMatch[1].trim());

   const lines = rawText.split("\n");
   for (const candidate of candidates) {
      const headerRe = new RegExp(`^${escapeRegExp(candidate)}:\\s*(.*)$`, "i");
      for (let i = 0; i < lines.length; i++) {
         const match = lines[i].trim().match(headerRe);
         if (!match) continue;
         const paragraph = [match[1]];
         for (let j = i + 1; j < lines.length; j++) {
            const next = lines[j].trim();
            if (next === "") break;
            if (/^[A-Z][A-Za-z ,'()-]{1,40}:\s/.test(next)) break;
            paragraph.push(next);
         }
         return paragraph.join(" ").trim();
      }
   }
   return null;
}

function splitFileName(name) {
   const sanitized = name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
   return `${sanitized}.json`;
}

function baseGearSystem({ description, quantity, weightLb, cost, gmNotes }) {
   return {
      tags: [],
      description: description ? `<p>${description}</p>` : "",
      gm: { notes: gmNotes ?? "" },
      quantity,
      quantityMax: 0,
      charges: 0,
      chargesMax: 0,
      weight: weightLb * 10,
      weightEquipped: weightLb * 10,
      cost: cost.value * CURRENCY_TO_GP[cost.currency],
      totalWeight: 0,
      totalCost: 0,
      containerId: "",
      equipped: false,
      container: false,
      isOpen: false,
      equippable: true,
      fuelType: "",
      isDropped: false,
      isTreasure: false,
      specialAbilities: [],
      spells: [],
      conditions: [],
      unidentifiedName: "",
      unidentifiedDesc: "",
      isIdentified: true,
      isCursed: false,
   };
}

function costNote(cost) {
   if (!cost.isMinimum) return "";
   return `Custo listado como mínimo (${cost.value}+${cost.currency}) no livro.`;
}

/**
 * Map one parsed row (Task 2 shape) to a full Foundry Item document.
 * @param {object} row
 * @param {{ rawText: string }} context - rawText: full extract/raw/equipment.txt, for description matching.
 * @returns {object}
 */
export function buildDocument(row, { rawText }) {
   const description = matchDescription(row.name, rawText);
   if (description === null) {
      console.warn(`[build/equipment] no description match for "${row.name}" (${row.table})`);
   }

   const id = deterministicId(`equipment:${row.name}`);
   const folder = row.table === "armour" ? ARMOUR_FOLDER_ID : ADVENTURING_GEAR_FOLDER_ID;

   const base = {
      folder,
      name: row.name,
      _id: id,
      img: "icons/svg/item-bag.svg",
      effects: [],
      ownership: { default: 0 },
      flags: {},
      _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      _originalKey: `!items!${id}`,
   };

   if (row.table === "armour") {
      return {
         ...base,
         type: "armor",
         system: {
            ...baseGearSystem({
               description,
               quantity: 1,
               weightLb: row.weightLb,
               cost: row.cost,
               gmNotes: costNote(row.cost),
            }),
            ac: row.armourClass,
            isShield: false,
            av: null,
            armorWeight: row.movementRate === "30'" ? "light" : "heavy",
            mod: 0,
            modRanged: 0,
            totalAC: row.armourClass,
            totalRangedAC: row.armourClass,
            totalAAC: row.armourClass,
            totalRangedAAC: row.armourClass,
            natural: false,
         },
      };
   }

   return {
      ...base,
      type: "item",
      system: baseGearSystem({
         description,
         quantity: row.bundleQty,
         weightLb: row.weightLb,
         cost: row.cost,
         gmNotes: costNote(row.cost),
      }),
   };
}

async function removeIfExists(filePath) {
   try {
      await fs.unlink(filePath);
   } catch (error) {
      if (error.code !== "ENOENT") throw error;
   }
}

async function main() {
   const parsedPath = path.join(process.cwd(), "extract", "parsed", "equipment.json");
   const rawPath = path.join(process.cwd(), "extract", "raw", "equipment.txt");
   const rows = JSON.parse(await fs.readFile(parsedPath, "utf8"));
   const rawText = await fs.readFile(rawPath, "utf8");

   const gearDir = path.join(process.cwd(), "packsrc", "items", "Equipment", "Adventuring_Gear");
   const armourDir = path.join(process.cwd(), "packsrc", "items", "Equipment", "Armour");
   await fs.mkdir(armourDir, { recursive: true });

   await removeIfExists(path.join(gearDir, "Backpack.json"));
   await removeIfExists(path.join(gearDir, "Torch.json"));

   let sort = 100000;
   let written = 0;
   for (const row of rows) {
      const doc = buildDocument(row, { rawText });
      doc.sort = sort;
      sort += 100000;
      const dir = row.table === "armour" ? armourDir : gearDir;
      const filePath = path.join(dir, splitFileName(row.name));
      await fs.writeFile(filePath, JSON.stringify(doc, null, 2) + "\n", "utf8");
      written++;
   }
   console.log(`wrote ${written} item document(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `node --test scripts/build/equipment.test.mjs`
Expected: todos os 11 testes passam.

- [ ] **Step 6: Atualizar `package.json` para incluir os testes do builder**

```json
"test": "node --test scripts/extract/*.test.mjs scripts/parse/*.test.mjs scripts/build/*.test.mjs",
```

Run: `npm test`
Expected: todos os testes passam (26 + 11 = 37 testes).

- [ ] **Step 7: Commit**

```bash
git add scripts/build/equipment.mjs scripts/build/equipment.test.mjs packsrc/items/_folders.json package.json
git commit -m "$(cat <<'EOF'
feat: equipment builder (extract/parsed/equipment.json -> packsrc Item documents)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Rodar o pipeline completo, validar, e revisar por amostragem

**Files:**
- Create: `packsrc/items/Equipment/Adventuring_Gear/*.json` (um por linha da Table 9-1, ~40-45 arquivos)
- Create: `packsrc/items/Equipment/Armour/*.json` (6 arquivos)
- Delete: `packsrc/items/Equipment/Adventuring_Gear/Backpack.json`, `.../Torch.json`

**Interfaces:**
- Consumes: `node scripts/parse/equipment.mjs` (Task 2) e
  `node scripts/build/equipment.mjs` (Task 3), em sequência.
- Produces: o conteúdo final de `packsrc/items/Equipment/**`, que a
  próxima fase (domínio "armas e masteries") não consome diretamente, mas
  que fecha o critério de conclusão desta fase.

- [ ] **Step 1: Rodar parser e builder em sequência**

Run:
```bash
node scripts/parse/equipment.mjs
node scripts/build/equipment.mjs
```
Expected: `wrote extract/parsed/equipment.json (<N> rows)` seguido de
`wrote <N> item document(s)`, sem exceção lançada.

- [ ] **Step 2: Confirmar que os hand-written duplicados sumiram**

Run: `ls packsrc/items/Equipment/Adventuring_Gear/ | grep -x "Backpack.json\|Torch.json"`
Expected: nenhuma saída (grep não encontra nada — ambos os arquivos foram apagados pelo builder).

- [ ] **Step 3: Confirmar que `Dagger.json` não foi tocado**

Run: `git status packsrc/items/Equipment/Weapons/`
Expected: `nothing to commit, working tree clean` para essa pasta (o builder não escreve em `Weapons/`).

- [ ] **Step 4: Rodar o validador**

Run: `npm run validate`
Expected: `✓ items: <N> document(s), no errors` entre as linhas de saída (junto
com as outras packs, que continuam sem erro), e `validate: all packs OK`
ao final — exit code 0.

- [ ] **Step 5: Amostragem manual — Table 9-1**

Run:
```bash
cat packsrc/items/Equipment/Armour/Leather_Armour.json
cat "packsrc/items/Equipment/Adventuring_Gear/$(ls packsrc/items/Equipment/Adventuring_Gear | grep -i '^Torch')"
```
Expected: `Leather_Armour.json` tem `"ac": 7`, `"armorWeight": "light"`,
`"weight": 200` (20lb × 10), `"cost": 20` (`"description": ""` é esperado
aqui — ver Step 6). O arquivo do Torch tem `"weight": 5` (0.5lb × 10),
`"cost": 0.2` (2sp × 0.1), e uma descrição não vazia (bate com o texto da
Fase 1: "A 1' to 2' length of wood dipped in pitch or tallow...").

Run também:
```bash
cat packsrc/items/Equipment/Armour/Scale_Mail.json
```
Expected: `"description"` não vazia — deve conter "Scale mail gives a
character an armour class of 6" (achado durante a verificação deste
plano: ao contrário do que a spec assumia de início, 4 das 6 armaduras
têm descrição individual mais adiante no capítulo, não só o parágrafo
geral "ARMOUR" logo após a tabela).

- [ ] **Step 6: Amostragem manual — conferir 2 casos de descrição vazia esperada (não é bug)**

Run:
```bash
node -e "
const fs = require('fs');
const dir = 'packsrc/items/Equipment/Adventuring_Gear';
for (const f of fs.readdirSync(dir)) {
   const doc = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8'));
   if (doc.name.startsWith('Sack') || doc.name === 'Arrows' || doc.name === 'Darts') {
      console.log(doc.name, '->', JSON.stringify(doc.system.description));
   }
}
"
node -e "
const doc = require('./packsrc/items/Equipment/Armour/Leather_Armour.json');
console.log('Leather Armour ->', JSON.stringify(doc.system.description));
const doc2 = require('./packsrc/items/Equipment/Armour/Chain_Mail.json');
console.log('Chain Mail ->', JSON.stringify(doc2.system.description));
"
```
Expected: `Sack (holds 20lb)`, `Sack (holds 60lb)`, `Arrows`, `Darts`,
`Leather Armour` e `Chain Mail` aparecem com `description: ""` — confirma
o comportamento aceito documentado nas Global Constraints (nenhum
casamento de nome encontrado para esses 6 no texto do livro), não um
builder quebrado. Todos os outros itens gerados (incluindo as outras 4
armaduras) devem ter `description` não vazia.

- [ ] **Step 7: Commit**

```bash
git add extract/parsed/equipment.json packsrc/items/Equipment
git commit -m "$(cat <<'EOF'
feat: generate Equipment items from Table 9-1 and Table 9-3

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Este commit é o critério de conclusão da Fase 3 / domínio equipment:
`packsrc/items/Equipment/{Adventuring_Gear,Armour}/*.json` cobre as duas
tabelas, `npm run validate` passa sem erros, e os dois hand-written
duplicados da Fase 1 foram substituídos.

---

## Fim do domínio equipment

Próximo passo: um novo spec/plano para o segundo domínio da Fase 3 —
armas e weapon masteries (cap. 6 + Table 9-2), conforme a ordem definida
na seção 7 do spec geral do projeto.
