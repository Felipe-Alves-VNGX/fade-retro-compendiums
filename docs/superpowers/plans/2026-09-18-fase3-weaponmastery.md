# fade-retro-compendiums — Fase 3, sub-projeto Weapon Mastery — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o pipeline parser → `extract/parsed` → builder para o subtipo `weaponMastery` (Tables 6-2a em diante), produzindo `packsrc/items/Weapon_Masteries/*.json` prontos para `npm run validate`, linkados por nome aos 40 documentos `weapon` já gerados.

**Architecture:** `scripts/parse/weaponMastery.mjs` lê `extract/raw/weapons.txt`, agrupa as 80 tabelas de mastery em 40 pares "vs Armed"/"vs Unarmed" por arma (usando `extract/parsed/weapons.json`, já existente, como lista canônica de nomes pra casar com case-insensitive), e produz `extract/parsed/weaponMastery.json`. `scripts/build/weaponMastery.mjs` lê esse JSON e mapeia cada par pro array `levels` de 6 ranks do `MasteryDefinitionDataModel`.

**Tech Stack:** Node.js (ESM), `node:test`, `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-09-18-fase3-weaponmastery-design.md` (e o spec geral, seção 7)

## Global Constraints

- Escopo: Tables 6-2a em diante (todas as tabelas de mastery do cap. 6), excluindo a Table 6-1 (já processada no sub-projeto `weapon`).
- 80 tabelas de dado agrupam em **40 documentos** — um por arma, cada um combinando o par "a" (vs Armed → campos `p*`) + "b" (vs Unarmed → campos `s*`). Sword, Bastard tem 2 pares (6-33a/b e 6-33c/d) → 2 documentos, com os mesmos nomes dos 2 documentos `weapon` correspondentes (`"Sword, Bastard"` e `"Sword, Bastard (Two-Handed)"`).
- **Link por nome de arma, case-insensitive**, usando `extract/parsed/weapons.json` como lista canônica — não pelo campo `mastery` (grupo de proficiência). O nome final do documento gerado usa a grafia canônica do item de arma (ex.: `"Sword, Two-handed"`, h minúsculo, mesmo a tabela do livro imprimindo `"Sword, Two-Handed"`).
- `pDmgFormula`/`sDmgFormula`: string literal da linha `Damage`; `"–"` → `null` (pode ocorrer — ex. Wrestling nos ranks None/Basic).
- `pToHit`/`sToHit`: valor numérico da linha `Attack Bonus`; `"–"` → `0`. **Atenção**: números negativos no livro usam en-dash (`–`, U+2013), não hífen ASCII — `Number.parseInt` falha silenciosamente nisso (retorna `NaN`) se o caractere não for trocado antes.
- `acBonus`/`acBonusType`/`acBonusAT`: a linha `AC Bonus` (preferencialmente da tabela "b"/unarmed, com fallback pra "a"/armed se só uma existir) vem em 4 valores separados por `/`; `acBonus` recebe só o primeiro segmento como número, `acBonusType`/`acBonusAT` ficam `null`, a string de 4 valores completa vai pro `system.gm.notes` do documento (não por nível). Sem linha `AC Bonus` pra essa arma, os três campos ficam `null` (default).
- `special`: concatena qualquer linha de habilidade extra presente (`Deflect`, `Disarm`, `Hook`, `Knockout`, `Delay`, `Stun`, `Strangle`, `Entangle`, `Skewer`, `Off-Hand`) nesse nível, formato `"Nome valor, Nome valor"`; valor `"Yes"` vira só o nome; valor `"–"` nesse nível específico é omitido; `null` se nenhuma habilidade extra existe.
- `range.{short,medium,long}`: da linha `Hurl Range`/`Throw Range`/`Missile Range` (qualquer uma presente), 3 valores separados por `/`; `"–"` → `0` (default do schema, não aceita `null`). Sem linha de alcance, os três campos ficam `0`.
- Duas linhas têm valores de célula com espaço interno (`Skewer`: `"4 HD"`; `Strangle`: `"20 (+0)"`) — o parser precisa reconhecer isso como um token só.
- `name` de cada nível = rótulo do rank como impresso (`"None"`, `"Basic"`, `"Skilled"`, `"Expert"`, `"Master"`, `"Grand Master"`).
- `weaponType` = `"handheld"` fixo; `primaryType` = `"all"` (default do schema, sem dado de origem melhor).
- `_id` determinístico (`sha1("weaponMastery:" + name)`), builder idempotente — mesmo esquema dos dois sub-projetos anteriores.
- Pasta destino: `packsrc/items/Weapon_Masteries/`, pasta de nível superior (irmã de `Equipment`, não aninhada) — precisa de entrada nova em `packsrc/items/_folders.json`.

---

### Task 1: Schema de `MasteryDefinitionDataModel` e suporte no validador

**Files:**
- Modify: `docs/fantastic-depths-item-schema.md`
- Modify: `scripts/extract/validate.mjs`
- Modify: `scripts/extract/validate.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `SUBTYPE_REQUIRED_FIELDS.weaponMastery` em `validate.mjs`, consumida por `validateDocument` (já existente) e por `npm run validate` na Task 4.

O schema abaixo já foi lido do código-fonte real (`Forelius/fantastic-depths` @ `4a8f2c8`, `src/item/dataModel/MasteryDefinitionDataModel.ts`) durante o brainstorming — não é uma tarefa de pesquisa em aberto.

- [ ] **Step 1: Escrever o teste de validação para `weaponMastery` (falhando)**

Adicionar ao final de `scripts/extract/validate.test.mjs` (antes do `test("validatePack reports zero errors...`, mantendo o `validWeapon`/`validArmor` existentes intocados):

```javascript
const validWeaponMastery = {
   name: "Club",
   type: "weaponMastery",
   _id: "IGtW7yuUTcYkhN4O",
   folder: "RcR10M9pJBiQMs2H",
   _originalKey: "!items!IGtW7yuUTcYkhN4O",
   system: {
      name: "Club",
      weaponType: "handheld",
      primaryType: "all",
      levels: [
         { name: "None", range: { short: 0, medium: 0, long: 0 }, pDmgFormula: "1d2", sDmgFormula: "1d2", acBonusType: null, acBonus: null, acBonusAT: null, pToHit: 0, sToHit: 0, special: null },
         { name: "Basic", range: { short: 0, medium: 0, long: 0 }, pDmgFormula: "1d4", sDmgFormula: "1d4", acBonusType: null, acBonus: null, acBonusAT: null, pToHit: 0, sToHit: 0, special: null },
         { name: "Skilled", range: { short: 0, medium: 0, long: 0 }, pDmgFormula: "1d6+1", sDmgFormula: "1d6+1", acBonusType: null, acBonus: -1, acBonusAT: null, pToHit: 1, sToHit: 2, special: "Deflect 1" },
         { name: "Expert", range: { short: 0, medium: 15, long: 25 }, pDmgFormula: "1d6+3", sDmgFormula: "1d6+3", acBonusType: null, acBonus: -2, acBonusAT: null, pToHit: 2, sToHit: 4, special: "Deflect 1" },
         { name: "Master", range: { short: 0, medium: 15, long: 25 }, pDmgFormula: "1d4+5", sDmgFormula: "1d6+5", acBonusType: null, acBonus: -3, acBonusAT: null, pToHit: 4, sToHit: 6, special: "Deflect 2" },
         { name: "Grand Master", range: { short: 10, medium: 25, long: 40 }, pDmgFormula: "1d4+6", sDmgFormula: "1d6+6", acBonusType: null, acBonus: -4, acBonusAT: null, pToHit: 6, sToHit: 8, special: "Deflect 2" },
      ],
   },
};

test("validateDocument accepts a fully-formed weaponMastery", () => {
   const errors = validateDocument(validWeaponMastery, {
      packName: "items",
      knownFolderIds: new Set(["RcR10M9pJBiQMs2H"]),
   });
   assert.deepEqual(errors, []);
});

test("validateDocument flags a missing required weaponMastery field", () => {
   const broken = structuredClone(validWeaponMastery);
   delete broken.system.primaryType;
   const errors = validateDocument(broken, {
      packName: "items",
      knownFolderIds: new Set(["RcR10M9pJBiQMs2H"]),
   });
   assert.ok(
      errors.some((e) => e.includes("system.primaryType")),
      `expected an error mentioning system.primaryType, got: ${errors.join(", ")}`
   );
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test`
Expected: as duas novas asserções falham porque `weaponMastery` ainda não existe em `SUBTYPE_REQUIRED_FIELDS` (`validateDocument` retorna `"unknown subtype 'weaponMastery'..."`).

- [ ] **Step 3: Adicionar `weaponMastery` a `SUBTYPE_REQUIRED_FIELDS` em `scripts/extract/validate.mjs`**

`weaponMastery` não estende `GearItemDataModel` (é `foundry.abstract.TypeDataModel` direto — não tem `tags`, `weight`, `cost`, etc.), então sua lista de campos obrigatórios NÃO usa `GEAR_REQUIRED_FIELDS`:

```javascript
const SUBTYPE_REQUIRED_FIELDS = {
   item: GEAR_REQUIRED_FIELDS,
   weapon: [...GEAR_REQUIRED_FIELDS, "damageRoll", "damageType", "canMelee", "canRanged", "mastery", "weaponType", "range"],
   light: [...GEAR_REQUIRED_FIELDS, "light"],
   armor: [...GEAR_REQUIRED_FIELDS, "ac", "armorWeight", "mod", "modRanged", "totalAC", "totalRangedAC", "totalAAC", "totalRangedAAC"],
   weaponMastery: ["name", "primaryType", "levels"],
};
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: todos os testes passam, incluindo os dois novos.

- [ ] **Step 5: Documentar `MasteryDefinitionDataModel` em `docs/fantastic-depths-item-schema.md`**

Adicionar uma nova seção ao final do arquivo:

```markdown
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
```

- [ ] **Step 6: Commit**

```bash
git add docs/fantastic-depths-item-schema.md scripts/extract/validate.mjs scripts/extract/validate.test.mjs
git commit -m "$(cat <<'EOF'
feat: MasteryDefinitionDataModel schema doc and validator support

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Parser — `scripts/parse/weaponMastery.mjs`

**Files:**
- Create: `scripts/parse/weaponMastery.mjs`
- Test: `scripts/parse/weaponMastery.test.mjs`
- Modify: `package.json` (script `test`, se ainda não cobrir esse glob — já deveria, herdado dos sub-projetos anteriores)

**Interfaces:**
- Consumes: `extract/raw/weapons.txt` (já existe) e `extract/parsed/weapons.json` (já existe, do sub-projeto `weapon` — usado só como lista de nomes canônicos pra casamento case-insensitive, não como fonte de dado de mastery).
- Produces:
  - `parseWeaponMasteryTables(rawText: string) -> Array<{ name: string, side: "armed"|"unarmed", rows: Array<{ label: string, values: string[6] }> }>`, exportada — uma entrada por tabela individual (80 no total), ANTES de agrupar por arma. `name` aqui é a grafia da tabela (pode ter casing diferente do item de arma — ex. `"Sword, Two-Handed"`), `side` vem do "Armed"/"Unarmed" do título.
  - `groupByWeapon(tables: Array<...>, canonicalNames: string[]) -> Array<{ name: string, armed: Array<row>, unarmed: Array<row> }>`, exportada — agrupa as tabelas em pares por nome (case-insensitive contra `canonicalNames`), usando a grafia CANÔNICA (do array `canonicalNames`) como `name` de saída.
  - Um CLI (`node scripts/parse/weaponMastery.mjs`) que lê os dois arquivos, chama as duas funções em sequência, e escreve `extract/parsed/weaponMastery.json` (`JSON.stringify(grouped, null, 2)`).

- [ ] **Step 1: Escrever os testes do parser (falhando)**

Criar `scripts/parse/weaponMastery.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWeaponMasteryTables, groupByWeapon } from "./weaponMastery.mjs";

const FIXTURE = `--- page 74 ---
                                           Table 6–1: Weapon Summary
                                                 Unarmed Attacks
    Weapon          Cost Base Damage             Base Traits        Advanced Traits            Proficiency Group
 Unarmed Strikes     –         1            Blunt, Natural, Simple Knockout, Off-hand               Brawling

--- page 76 ---
                                   Table 6–10a: Club vs Armed Opponents
                  None             Basic           Skilled       Expert          Master      Grand Master
Attack Bonus        –                –                +1            +2              +4             +6
  Damage           1d2              1d4             1d6+1         1d6+3           1d4+5          1d4+6
 AC Bonus           –                –            –1/–1/–/–     –2/–2/–/–       –3/–3/–3/–    –4/–4/–4/–4
   Deflect          –                –                 1             1               2              2
 Hurl Range         –                –                –          –/15/25         –/15/25       10/25/40

                                  Table 6–10b: Club vs Unarmed Opponents
                  None             Basic           Skilled       Expert          Master      Grand Master
Attack Bonus        –                –                +2            +4              +6             +8
  Damage           1d2              1d4             1d6+1         1d6+3           1d6+5          1d6+6
 AC Bonus           –                –            –1/–1/–/–     –2/–2/–/–       –3/–3/–3/–    –4/–4/–4/–4
   Deflect          –                –                 1             1               2              2
 Hurl Range         –                –                –          –/15/25         –/15/25       10/25/40

                              Table 6–40a: Wrestling vs Armed Opponents
                None             Basic         Skilled          Expert         Master      Grand Master
Attack Bonus     –                 –              +2              +4             +6              +8
  Damage         –                 –               1             1d2             1d4           1d6+1
  Strangle       –              20 (+0)         20 (–1)       19–20 (–2)      18–20 (–3)     17–20 (–4)

                             Table 6–40b: Wrestling vs Unarmed Opponents
                None             Basic          Skilled         Expert         Master      Grand Master
Attack Bonus     –                 –               +2             +4             +6              +8
  Damage         –                 –                1            1d2             1d3            1d4
  Strangle       –              20 (+0)          20 (–1)      19–20 (–2)      18–20 (–3)     17–20 (–4)

--- page 88 ---
WEAPON ABILITIES
The various weapon abilities listed on the previous tables are
described below.
`;

const CANONICAL_NAMES = ["Club", "Wrestling"];

test("parses each table into a flat list with name, side, and rows", () => {
   const tables = parseWeaponMasteryTables(FIXTURE);
   assert.equal(tables.length, 4);
   const clubArmed = tables.find((t) => t.name === "Club" && t.side === "armed");
   assert.ok(clubArmed);
   const attackBonus = clubArmed.rows.find((r) => r.label === "Attack Bonus");
   assert.deepEqual(attackBonus.values, ["–", "–", "+1", "+2", "+4", "+6"]);
});

test("keeps a compound cell value with an internal space as one token (Skewer/Strangle format)", () => {
   const tables = parseWeaponMasteryTables(FIXTURE);
   const wrestlingArmed = tables.find((t) => t.name === "Wrestling" && t.side === "armed");
   const strangle = wrestlingArmed.rows.find((r) => r.label === "Strangle");
   assert.deepEqual(strangle.values, ["–", "20 (+0)", "20 (–1)", "19–20 (–2)", "18–20 (–3)", "17–20 (–4)"]);
});

test("does not include Table 6-1 (Weapon Summary) rows", () => {
   const tables = parseWeaponMasteryTables(FIXTURE);
   assert.ok(!tables.some((t) => t.name === "Unarmed Strikes"));
});

test("groupByWeapon pairs armed/unarmed tables into one entry per weapon", () => {
   const tables = parseWeaponMasteryTables(FIXTURE);
   const grouped = groupByWeapon(tables, CANONICAL_NAMES);
   assert.equal(grouped.length, 2);
   const club = grouped.find((g) => g.name === "Club");
   assert.ok(club.armed.length > 0);
   assert.ok(club.unarmed.length > 0);
});

test("groupByWeapon matches table titles to canonical names case-insensitively", () => {
   const tables = parseWeaponMasteryTables(FIXTURE);
   // Simulate the real book's casing mismatch: canonical list says "Sword, Two-handed",
   // but the table title in the book says "Sword, Two-Handed".
   const mismatchTables = [
      { name: "Sword, Two-Handed", side: "armed", rows: [] },
      { name: "Sword, Two-Handed", side: "unarmed", rows: [] },
   ];
   const grouped = groupByWeapon(mismatchTables, ["Sword, Two-handed"]);
   assert.equal(grouped.length, 1);
   assert.equal(grouped[0].name, "Sword, Two-handed");
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test scripts/parse/weaponMastery.test.mjs`
Expected: `Cannot find module './weaponMastery.mjs'`.

- [ ] **Step 3: Implementar `scripts/parse/weaponMastery.mjs`**

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TABLE_TITLE_RE = /^Table 6–\d+[a-d]: (.+?) vs (Armed|Unarmed) Opponents$/;

// The last table (Wrestling vs Unarmed) is immediately followed by prose
// ("WEAPON ABILITIES" and per-ability descriptions like "Hook: The wielder
// of a weapon with the hook ability can...") whose description lines start
// with a KNOWN_LABELS word followed by a colon — parseDataLine would
// otherwise misread them as real table rows and append them to the last
// table. Scanning stops the instant this line is seen.
const END_MARKER = "WEAPON ABILITIES";

const KNOWN_LABELS = [
   "Attack Bonus", "AC Bonus", "Hurl Range", "Throw Range", "Missile Range",
   "Double Damage", "Damage", "Deflect Penalty", "Deflect", "Disarm", "Hook", "Knockout", "Delay", "Stun",
   "Strangle", "Entangle", "Skewer", "Off-Hand", "Set",
].sort((a, b) => b.length - a.length);

// A cell value is normally one whitespace-free token, but three real cases
// print a compound value with an internal space that must stay together as
// a single token: "4 HD" (Skewer), "20 (+0)" (Strangle), and the one-off
// "–5 vs 4" (Hammer, War's unarmed AC Bonus at Grand Master — the only " vs "
// occurrence in any data row in the whole chapter, confirmed by grep).
const VALUE_TOKEN_RE = /\S+\s+HD|\S+\s+\([^)]*\)|\S+\s+vs\s+\S+|\S+/g;

function parseDataLine(line) {
   const trimmed = line.trim();
   for (const label of KNOWN_LABELS) {
      if (trimmed.startsWith(label)) {
         const rest = trimmed.slice(label.length).trim();
         const values = rest.match(VALUE_TOKEN_RE) || [];
         return { label, values };
      }
   }
   return null;
}

function normalizeTableWeaponName(rawName) {
   if (rawName.endsWith("(One Handed)")) {
      return rawName.replace(/\s*\(One Handed\)$/, "");
   }
   if (rawName.endsWith("(Two Handed)")) {
      return rawName.replace(/\(Two Handed\)$/, "(Two-Handed)");
   }
   return rawName;
}

/**
 * Parse every individual weapon-mastery table (Table 6-2a onward) in the
 * chapter's raw text into a flat list — one entry per table, not yet
 * grouped by weapon. Table 6-1 (Weapon Summary) is a different table
 * shape entirely and is never matched by TABLE_TITLE_RE.
 * @param {string} rawText - full contents of extract/raw/weapons.txt
 * @returns {Array<{ name: string, side: "armed"|"unarmed", rows: Array<{label: string, values: string[]}> }>}
 */
export function parseWeaponMasteryTables(rawText) {
   const lines = rawText.split("\n");
   const tables = [];
   let current = null;
   for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === END_MARKER) {
         if (current) tables.push(current);
         return tables;
      }
      const titleMatch = trimmed.match(TABLE_TITLE_RE);
      if (titleMatch) {
         if (current) tables.push(current);
         current = {
            name: normalizeTableWeaponName(titleMatch[1]),
            side: titleMatch[2].toLowerCase(),
            rows: [],
         };
         continue;
      }
      if (!current) continue;
      const parsed = parseDataLine(line);
      if (parsed) current.rows.push(parsed);
   }
   if (current) tables.push(current);
   return tables;
}

/**
 * Group individual armed/unarmed tables into one entry per weapon,
 * matching each table's (possibly differently-cased) name against the
 * canonical weapon-item name list case-insensitively, and using the
 * canonical spelling for the output entry's name — so the generated
 * document links cleanly to its weapon Item by exact name.
 * @param {Array<object>} tables - output of parseWeaponMasteryTables
 * @param {string[]} canonicalNames - names from extract/parsed/weapons.json
 * @returns {Array<{ name: string, armed: Array<object>, unarmed: Array<object> }>}
 */
export function groupByWeapon(tables, canonicalNames) {
   const canonicalByLower = new Map(canonicalNames.map((n) => [n.toLowerCase(), n]));
   const grouped = new Map();
   for (const table of tables) {
      const canonicalName = canonicalByLower.get(table.name.toLowerCase()) ?? table.name;
      if (!grouped.has(canonicalName)) {
         grouped.set(canonicalName, { name: canonicalName, armed: [], unarmed: [] });
      }
      const entry = grouped.get(canonicalName);
      if (table.side === "armed") entry.armed = table.rows;
      else entry.unarmed = table.rows;
   }
   return Array.from(grouped.values());
}

async function main() {
   const rawPath = path.join(process.cwd(), "extract", "raw", "weapons.txt");
   const weaponsPath = path.join(process.cwd(), "extract", "parsed", "weapons.json");
   const rawText = await fs.readFile(rawPath, "utf8");
   const weaponRows = JSON.parse(await fs.readFile(weaponsPath, "utf8"));
   const canonicalNames = weaponRows.map((r) => r.name);

   const tables = parseWeaponMasteryTables(rawText);
   const grouped = groupByWeapon(tables, canonicalNames);

   const outDir = path.join(process.cwd(), "extract", "parsed");
   await fs.mkdir(outDir, { recursive: true });
   const outPath = path.join(outDir, "weaponMastery.json");
   await fs.writeFile(outPath, JSON.stringify(grouped, null, 2) + "\n", "utf8");
   console.log(`wrote ${outPath} (${grouped.length} weapons, from ${tables.length} tables)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test scripts/parse/weaponMastery.test.mjs`
Expected: todos os 5 testes passam.

- [ ] **Step 5: Confirmar que `package.json` já cobre `scripts/parse/*.test.mjs`**

Já deveria estar assim desde o domínio equipment. Confirme lendo o arquivo — sem mudança necessária se já cobrir.

Run: `npm test`
Expected: todos os testes passam.

- [ ] **Step 6: Rodar o CLI contra o texto real e inspecionar a contagem**

Run:
```bash
node scripts/parse/weaponMastery.mjs
node -e "
const rows = JSON.parse(require('fs').readFileSync('extract/parsed/weaponMastery.json', 'utf8'));
console.log('total:', rows.length);
console.assert(rows.length === 40, 'esperava 40, achou ' + rows.length);
for (const r of rows) {
   console.assert(r.armed.length > 0 && r.unarmed.length > 0, r.name + ': par armed/unarmed incompleto');
}
console.log('todas as 40 armas têm par armed+unarmed completo');
const sth = rows.find(r => r.name === 'Sword, Two-handed');
console.log('Sword, Two-handed presente (grafia canônica)?', !!sth);
"
```
Expected: `total: 40`, `todas as 40 armas têm par armed+unarmed completo`, `Sword, Two-handed presente (grafia canônica)? true`, sem `Assertion failed`. (Estes números já foram confirmados manualmente antes de escrever este plano.)

- [ ] **Step 7: Commit**

```bash
git add scripts/parse/weaponMastery.mjs scripts/parse/weaponMastery.test.mjs extract/parsed/weaponMastery.json
git commit -m "$(cat <<'EOF'
feat: weaponMastery parser (Table 6-2a onward -> extract/parsed/weaponMastery.json)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Builder — `scripts/build/weaponMastery.mjs`

**Files:**
- Create: `scripts/build/weaponMastery.mjs`
- Test: `scripts/build/weaponMastery.test.mjs`
- Modify: `packsrc/items/_folders.json` (nova pasta de nível superior `Weapon Masteries`)
- Modify: `package.json` (script `test`, se ainda não cobrir `scripts/build/*.test.mjs` — já deveria)

**Interfaces:**
- Consumes: `extract/parsed/weaponMastery.json` (Task 2, array de `{ name, armed: Row[], unarmed: Row[] }`).
- Produces:
  - `deterministicId(seed: string) -> string` (mesmo esquema dos sub-projetos anteriores).
  - `buildLevels(armedRows: Row[], unarmedRows: Row[]) -> { levels: object[6], acBonusRaw: string | null }`.
  - `buildDocument(entry: { name, armed, unarmed }) -> object` (documento Item pronto para `JSON.stringify`).
  - Um CLI (`node scripts/build/weaponMastery.mjs`) que lê `extract/parsed/weaponMastery.json` e escreve um arquivo por arma em `packsrc/items/Weapon_Masteries/`.

- [ ] **Step 1: Adicionar a pasta `Weapon Masteries` a `packsrc/items/_folders.json`**

Pasta de nível superior (irmã de `Equipment`, `folder: null`), não aninhada:

```json
"!folders!RcR10M9pJBiQMs2H": {
   "name": "Weapon Masteries",
   "sorting": "a",
   "folder": null,
   "type": "Item",
   "_id": "RcR10M9pJBiQMs2H",
   "description": "",
   "sort": 200000,
   "color": "#2f3c4a",
   "flags": {},
   "_stats": {
      "coreVersion": "13.347",
      "systemId": "fantastic-depths"
   }
}
```

Run: `node -e "JSON.parse(require('fs').readFileSync('packsrc/items/_folders.json', 'utf8')); console.log('JSON OK')"`
Expected: `JSON OK`.

- [ ] **Step 2: Escrever os testes do builder (falhando)**

Criar `scripts/build/weaponMastery.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, buildLevels, buildDocument } from "./weaponMastery.mjs";

test("deterministicId matches the 16-char alphanumeric ID pattern", () => {
   assert.match(deterministicId("weaponMastery:Club"), /^[a-zA-Z0-9]{16}$/);
});

const CLUB_ARMED = [
   { label: "Attack Bonus", values: ["–", "–", "+1", "+2", "+4", "+6"] },
   { label: "Damage", values: ["1d2", "1d4", "1d6+1", "1d6+3", "1d4+5", "1d4+6"] },
   { label: "AC Bonus", values: ["–", "–", "–1/–1/–/–", "–2/–2/–/–", "–3/–3/–3/–", "–4/–4/–4/–4"] },
   { label: "Deflect", values: ["–", "–", "1", "1", "2", "2"] },
   { label: "Hurl Range", values: ["–", "–", "–", "–/15/25", "–/15/25", "10/25/40"] },
];
const CLUB_UNARMED = [
   { label: "Attack Bonus", values: ["–", "–", "+2", "+4", "+6", "+8"] },
   { label: "Damage", values: ["1d2", "1d4", "1d6+1", "1d6+3", "1d6+5", "1d6+6"] },
   { label: "AC Bonus", values: ["–", "–", "–1/–1/–/–", "–2/–2/–/–", "–3/–3/–3/–", "–4/–4/–4/–4"] },
   { label: "Deflect", values: ["–", "–", "1", "1", "2", "2"] },
   { label: "Hurl Range", values: ["–", "–", "–", "–/15/25", "–/15/25", "10/25/40"] },
];

test("buildLevels maps Attack Bonus to pToHit/sToHit, handling the en-dash negative sign", () => {
   const { levels } = buildLevels(CLUB_ARMED, CLUB_UNARMED);
   assert.equal(levels[2].pToHit, 1);
   assert.equal(levels[2].sToHit, 2);
   assert.equal(levels[2].acBonus, -1, "en-dash '–1' must parse as -1, not NaN/null");
});

test("buildLevels maps Damage to pDmgFormula/sDmgFormula verbatim", () => {
   const { levels } = buildLevels(CLUB_ARMED, CLUB_UNARMED);
   assert.equal(levels[0].pDmgFormula, "1d2");
   assert.equal(levels[4].sDmgFormula, "1d6+5");
});

test("buildLevels maps a single extra-ability row to special", () => {
   const { levels } = buildLevels(CLUB_ARMED, CLUB_UNARMED);
   assert.equal(levels[2].special, "Deflect 1");
   assert.equal(levels[0].special, null);
});

test("buildLevels maps Hurl Range to range.{short,medium,long}, treating '–' as 0", () => {
   const { levels } = buildLevels(CLUB_ARMED, CLUB_UNARMED);
   assert.deepEqual(levels[3].range, { short: 0, medium: 15, long: 25 });
   assert.deepEqual(levels[0].range, { short: 0, medium: 0, long: 0 });
});

test("buildLevels preserves each rank's full 4-value AC Bonus string for gm.notes, using only the first value as acBonus", () => {
   const { levels, acBonusRaw } = buildLevels(CLUB_ARMED, CLUB_UNARMED);
   assert.equal(levels[5].acBonus, -4);
   // Must stay one distinct segment per rank — not all 6 ranks' cells
   // naively joined with "/", which would be ambiguous with the "/"
   // already used inside each cell (e.g. "–1/–1/–/–").
   assert.equal(
      acBonusRaw,
      "None: –; Basic: –; Skilled: –1/–1/–/–; Expert: –2/–2/–/–; Master: –3/–3/–3/–; Grand Master: –4/–4/–4/–4"
   );
});

test("buildLevels combines two extra-ability rows into one special string", () => {
   const armed = [
      { label: "Attack Bonus", values: ["–", "–", "+2", "+4", "+6", "+8"] },
      { label: "Damage", values: ["–", "1d8", "1d12", "2d8", "2d8+4", "2d6+6"] },
      { label: "Deflect", values: ["–", "–", "1", "2", "2", "3"] },
      { label: "Disarm", values: ["–", "–", "+0", "–1", "–2", "–4"] },
   ];
   const { levels } = buildLevels(armed, armed);
   assert.equal(levels[3].special, "Deflect 2, Disarm –1");
});

test("buildLevels treats a missing Damage cell ('–') as null, not the string", () => {
   const armed = [
      { label: "Attack Bonus", values: ["–", "–", "+2", "+4", "+6", "+8"] },
      { label: "Damage", values: ["–", "–", "1", "1d2", "1d4", "1d6+1"] },
   ];
   const { levels } = buildLevels(armed, armed);
   assert.equal(levels[0].pDmgFormula, null);
   assert.equal(levels[2].pDmgFormula, "1");
});

test("buildDocument produces a weaponMastery document with 6 levels and the arm's name", () => {
   const doc = buildDocument({ name: "Club", armed: CLUB_ARMED, unarmed: CLUB_UNARMED });
   assert.equal(doc.type, "weaponMastery");
   assert.equal(doc.name, "Club");
   assert.equal(doc.system.name, "Club");
   assert.equal(doc.system.weaponType, "handheld");
   assert.equal(doc.system.primaryType, "all");
   assert.equal(doc.system.levels.length, 6);
});

test("buildDocument is idempotent: same entry produces byte-identical output twice", () => {
   const entry = { name: "Club", armed: CLUB_ARMED, unarmed: CLUB_UNARMED };
   const first = buildDocument(entry);
   const second = buildDocument(entry);
   assert.deepEqual(first, second);
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `node --test scripts/build/weaponMastery.test.mjs`
Expected: `Cannot find module './weaponMastery.mjs'`.

- [ ] **Step 4: Implementar `scripts/build/weaponMastery.mjs`**

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const WEAPON_MASTERIES_FOLDER_ID = "RcR10M9pJBiQMs2H";

const RANK_NAMES = ["None", "Basic", "Skilled", "Expert", "Master", "Grand Master"];
const RANGE_LABELS = new Set(["Hurl Range", "Throw Range", "Missile Range"]);
const SPECIAL_LABELS = ["Deflect Penalty", "Deflect", "Disarm", "Hook", "Knockout", "Delay", "Stun", "Strangle", "Entangle", "Skewer", "Off-Hand", "Double Damage", "Set"];

/**
 * Derive a stable 16-char alphanumeric Foundry-style _id from a seed
 * string. Independent copy of the equipment/weapons domains' function
 * of the same name/shape — no cross-module import.
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

function rowsByLabel(rows) {
   const map = new Map();
   for (const row of rows) map.set(row.label, row.values);
   return map;
}

// The book prints negative numbers with an en-dash (–, U+2013), not the
// ASCII hyphen-minus Number.parseInt expects — without this replace,
// "–1" silently parses as NaN.
function parseNum(value) {
   if (value === "–" || value === undefined) return null;
   const n = Number.parseInt(value.replace(/^–/, "-"), 10);
   return Number.isNaN(n) ? null : n;
}

function parseRangeTriplet(value) {
   if (!value) return { short: 0, medium: 0, long: 0 };
   const parts = value.split("/").map((p) => (p === "–" ? 0 : Number.parseInt(p.replace(/^–/, "-"), 10) || 0));
   return { short: parts[0] || 0, medium: parts[1] || 0, long: parts[2] || 0 };
}

function findRangeRow(map) {
   for (const label of RANGE_LABELS) {
      if (map.has(label)) return { label, values: map.get(label) };
   }
   return null;
}

// The schema has only ONE range and ONE special per level (no primary/
// secondary split, unlike pToHit/pDmgFormula) — so whichever side
// (armed/unarmed) buildLevels reads from, the OTHER side's values for
// the same row are silently dropped if they differ. This happens for
// real: Bow Short and Crossbow Light's Missile Range, and Net's
// Entangle, all diverge between armed and unarmed. Describe what got
// dropped so it survives in gm.notes instead of vanishing, using the
// same document-level-note mechanism already used for acBonus's
// dropped 3-of-4 slash-segments.
function describeDivergence(armedMap, unarmedMap) {
   const notes = [];
   const armedRange = findRangeRow(armedMap);
   const unarmedRange = findRangeRow(unarmedMap);
   if (
      armedRange && unarmedRange && armedRange.label === unarmedRange.label &&
      JSON.stringify(armedRange.values) !== JSON.stringify(unarmedRange.values)
   ) {
      notes.push(`${armedRange.label} (vs Unarmed) diverge do impresso acima: ${unarmedRange.values.join(" / ")}`);
   }
   for (const label of SPECIAL_LABELS) {
      const a = armedMap.get(label);
      const u = unarmedMap.get(label);
      if (a && u && JSON.stringify(a) !== JSON.stringify(u)) {
         notes.push(`${label} (vs Unarmed) diverge do impresso acima: ${u.join(" / ")}`);
      }
   }
   return notes;
}

function buildSpecial(armedMap, unarmedMap, levelIndex) {
   const parts = [];
   for (const label of SPECIAL_LABELS) {
      const values = armedMap.get(label) || unarmedMap.get(label);
      if (!values) continue;
      const value = values[levelIndex];
      if (value === "–" || value === undefined) continue;
      parts.push(value === "Yes" ? label : `${label} ${value}`);
   }
   return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Combine a weapon's "vs Armed" and "vs Unarmed" table rows into the 6
 * MasteryDefinitionDataModel levels (None through Grand Master).
 * @param {Array<{label: string, values: string[]}>} armedRows
 * @param {Array<{label: string, values: string[]}>} unarmedRows
 * @returns {{ levels: object[], acBonusRaw: string | null }}
 */
export function buildLevels(armedRows, unarmedRows) {
   const armedMap = rowsByLabel(armedRows);
   const unarmedMap = rowsByLabel(unarmedRows);
   const pHit = armedMap.get("Attack Bonus");
   const sHit = unarmedMap.get("Attack Bonus");
   const pDmg = armedMap.get("Damage");
   const sDmg = unarmedMap.get("Damage");
   const acRow = unarmedMap.get("AC Bonus") || armedMap.get("AC Bonus");
   const rangeRow = (findRangeRow(armedMap) || findRangeRow(unarmedMap))?.values;

   const levels = [];
   for (let i = 0; i < 6; i++) {
      const acRaw = acRow ? acRow[i] : "–";
      levels.push({
         name: RANK_NAMES[i],
         range: rangeRow ? parseRangeTriplet(rangeRow[i]) : { short: 0, medium: 0, long: 0 },
         pDmgFormula: pDmg && pDmg[i] !== "–" ? pDmg[i] : null,
         sDmgFormula: sDmg && sDmg[i] !== "–" ? sDmg[i] : null,
         acBonusType: null,
         acBonus: acRaw === "–" ? null : parseNum(acRaw.split("/")[0]),
         acBonusAT: null,
         pToHit: parseNum(pHit ? pHit[i] : "–") ?? 0,
         sToHit: parseNum(sHit ? sHit[i] : "–") ?? 0,
         special: buildSpecial(armedMap, unarmedMap, i),
      });
   }
   const acBonusNote = acRow
      ? RANK_NAMES.map((name, i) => `${name}: ${acRow[i]}`).join("; ")
      : null;
   const divergenceNotes = describeDivergence(armedMap, unarmedMap);
   const acBonusRaw = [acBonusNote, ...divergenceNotes].filter(Boolean).join(" | ") || null;
   return { levels, acBonusRaw };
}

function splitFileName(name) {
   const sanitized = name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
   return `${sanitized}.json`;
}

/**
 * Map one grouped parser entry (Task 2 shape) to a full Foundry
 * weaponMastery Item document.
 * @param {{ name: string, armed: object[], unarmed: object[] }} entry
 * @returns {object}
 */
export function buildDocument(entry) {
   const { levels, acBonusRaw } = buildLevels(entry.armed, entry.unarmed);
   const id = deterministicId(`weaponMastery:${entry.name}`);

   return {
      folder: WEAPON_MASTERIES_FOLDER_ID,
      name: entry.name,
      _id: id,
      img: "icons/svg/item-bag.svg",
      effects: [],
      ownership: { default: 0 },
      flags: {},
      _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      _originalKey: `!items!${id}`,
      type: "weaponMastery",
      system: {
         name: entry.name,
         weaponType: "handheld",
         primaryType: "all",
         levels,
         gm: { notes: acBonusRaw ? `AC Bonus completo do livro: ${acBonusRaw}` : "" },
      },
   };
}

async function main() {
   const parsedPath = path.join(process.cwd(), "extract", "parsed", "weaponMastery.json");
   const entries = JSON.parse(await fs.readFile(parsedPath, "utf8"));

   const dir = path.join(process.cwd(), "packsrc", "items", "Weapon_Masteries");
   await fs.mkdir(dir, { recursive: true });

   let sort = 100000;
   let written = 0;
   for (const entry of entries) {
      const doc = buildDocument(entry);
      doc.sort = sort;
      sort += 100000;
      const filePath = path.join(dir, splitFileName(entry.name));
      await fs.writeFile(filePath, JSON.stringify(doc, null, 2) + "\n", "utf8");
      written++;
   }
   console.log(`wrote ${written} weaponMastery document(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
```

**Nota**: `system.gm.notes` aqui é uma decisão pragmática — o schema real
de `MasteryDefinitionDataModel` (Task 1) não tem um campo `gm.notes`
documentado (diferente de `GearItemDataModel`, que tem). Adicionar esse
campo mesmo assim é seguro pro Foundry (campos extras em `system` que o
`DataModel` não declara são ignorados, não geram erro), e é o único
lugar disponível pra não descartar a string completa de AC Bonus. Se
isso se provar errado na Task 5 (revisão por amostragem/`npm run
validate`), a alternativa é mover essa nota pra um campo de nível
superior do documento (`flags`) — ajustar ali, não aqui.

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `node --test scripts/build/weaponMastery.test.mjs`
Expected: todos os 10 testes passam.

- [ ] **Step 6: Confirmar que `package.json` já cobre `scripts/build/*.test.mjs`**

Sem mudança necessária se já cobrir (deveria, herdado do domínio equipment).

Run: `npm test`
Expected: todos os testes passam.

- [ ] **Step 7: Commit**

```bash
git add scripts/build/weaponMastery.mjs scripts/build/weaponMastery.test.mjs packsrc/items/_folders.json
git commit -m "$(cat <<'EOF'
feat: weaponMastery builder (extract/parsed/weaponMastery.json -> packsrc Item documents)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Rodar o pipeline completo, validar, e revisar por amostragem

**Files:**
- Create: `packsrc/items/Weapon_Masteries/*.json` (40 arquivos)

**Interfaces:**
- Consumes: `node scripts/parse/weaponMastery.mjs` (Task 2) e `node scripts/build/weaponMastery.mjs` (Task 3), em sequência.
- Produces: o conteúdo final de `packsrc/items/Weapon_Masteries/**`, que fecha o critério de conclusão deste sub-projeto e, por extensão, do domínio "armas e weapon masteries" inteiro.

- [ ] **Step 1: Rodar parser e builder em sequência**

Run:
```bash
node scripts/parse/weaponMastery.mjs
node scripts/build/weaponMastery.mjs
```
Expected: `wrote extract/parsed/weaponMastery.json (40 weapons, from 80 tables)` seguido de `wrote 40 weaponMastery document(s)`.

- [ ] **Step 2: Rodar o validador**

Run: `npm run validate`
Expected: `✓ items: <N> document(s), no errors` (N deve ser 130 = 90 já existentes + 40 novos), `validate: all packs OK`, exit code 0.

- [ ] **Step 3: Amostragem manual**

Run:
```bash
cat packsrc/items/Weapon_Masteries/Club.json
cat "packsrc/items/Weapon_Masteries/$(ls packsrc/items/Weapon_Masteries | grep -i wrestling)"
cat "packsrc/items/Weapon_Masteries/$(ls packsrc/items/Weapon_Masteries | grep -i 'Sword_Two')"
```
Expected: `Club.json` tem `system.levels[2].pToHit === 1`, `system.levels[2].sToHit === 2`, `system.levels[2].acBonus === -1` (não `null` nem erro de parsing do en-dash), `system.levels[2].special === "Deflect 1"`. `Wrestling.json` tem `system.levels[1].special` incluindo `"Strangle 20 (+0)"` (formato composto preservado). O arquivo do Sword Two-Handed tem `name` e `system.name` grafados `"Sword, Two-handed"` (h minúsculo, igual ao item de arma) mesmo a tabela do livro usando H maiúsculo.

- [ ] **Step 4: Confirmar visualmente que cada arma de `packsrc/items/Equipment/Weapons/` tem uma entrada correspondente em `packsrc/items/Weapon_Masteries/`**

Run:
```bash
node -e "
const fs = require('fs');
const weaponNames = fs.readdirSync('packsrc/items/Equipment/Weapons').map(f => {
   const doc = JSON.parse(fs.readFileSync('packsrc/items/Equipment/Weapons/' + f, 'utf8'));
   return doc.name;
});
const masteryNames = fs.readdirSync('packsrc/items/Weapon_Masteries').map(f => {
   const doc = JSON.parse(fs.readFileSync('packsrc/items/Weapon_Masteries/' + f, 'utf8'));
   return doc.name;
});
const missing = weaponNames.filter(n => !masteryNames.includes(n));
console.log('armas sem weaponMastery correspondente:', JSON.stringify(missing));
console.assert(missing.length === 0, 'link por nome incompleto');
"
```
Expected: `armas sem weaponMastery correspondente: []`, sem `Assertion failed`.

- [ ] **Step 5: Commit**

```bash
git add extract/parsed/weaponMastery.json packsrc/items/Weapon_Masteries
git commit -m "$(cat <<'EOF'
feat: generate WeaponMastery items from Table 6-2a onward

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Este commit é o critério de conclusão do sub-projeto weaponMastery e,
com ele, do domínio "armas e weapon masteries" inteiro:
`packsrc/items/Weapon_Masteries/*.json` cobre as 40 armas, cada uma
linkada por nome ao seu documento `weapon` correspondente, e `npm run
validate` passa sem erros.

---

## Fim do domínio "armas e weapon masteries"

Próximo domínio na ordem do spec geral (seção 7): magias (cap. 7 —
lista alfabética de magias), depois skills, depois classes.
