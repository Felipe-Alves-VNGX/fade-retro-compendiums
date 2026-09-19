# fade-retro-compendiums — Fase 3, sub-projeto Weapons — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o pipeline parser → `extract/parsed` → builder para o subtipo `weapon` (Table 6-1: Weapon Summary + Table 9-2: Weapons), produzindo `packsrc/items/Equipment/Weapons/*.json` prontos para `npm run validate`.

**Architecture:** `scripts/parse/weapons.mjs` lê `extract/raw/weapons.txt` (Table 6-1: nome, custo, dano, traits, grupos de mastery) e `extract/raw/equipment.txt` (Table 9-2: peso, casado por nome), produzindo `extract/parsed/weapons.json` com unidades ainda como impressas no livro. `scripts/build/weapons.mjs` lê esse JSON e aplica as mesmas conversões de unidade do domínio equipment, mais a regra de melee/ranged e a normalização de traits em tags.

**Tech Stack:** Node.js (ESM), `node:test`, `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-09-18-fase3-weapons-design.md` (e o spec geral, seção 7)

## Global Constraints

- Escopo: só Table 6-1 (Weapon Summary) + Table 9-2 (Weapons, peso). As ~80 tabelas de mastery (6-2a em diante) ficam para um plano separado.
- Table 6-1 é a única fonte de custo (confirmado idêntico à Table 9-2 nos casos conferidos); Table 9-2 só contribui peso.
- Unidade de peso: `system.weight = pesoEmLibrasDoLivro × 10` (mesma regra do domínio equipment). Table 9-2 usa tanto `"2½lb"` (fração) quanto `"0.5lb"` (decimal) — o parser reconhece os dois formatos.
- Unidade de moeda: mesma tabela do domínio equipment (`cp×0.01, sp×0.1, ep×0.5, pp×5, gp×1`); na prática todo custo de Table 6-1 já está em gp.
- `_id` determinístico (`sha1("weapons:" + name)`), builder idempotente — mesmo esquema do domínio equipment.
- Nome do item = nome impresso na tabela, com UMA exceção deliberada: `"Sword, Bastard"` aparece em duas seções (One-Handed e Two-Handed, arma "Versatile") com os mesmos dados — o parser gera dois documentos com nomes distintos, `"Sword, Bastard"` (primeira ocorrência, One-Handed) e `"Sword, Bastard (Two-Handed)"` (segunda ocorrência), em vez de colapsar numa entrada só.
- Traits (Base Traits + Advanced Traits combinados) viram `system.tags`, normalizados para minúsculo com hífen no lugar de espaço (`"Off-hand"`/`"Off-Hand"` → `"off-hand"`, ambos convergem; `"Deflect Penalty"` → `"deflect-penalty"`).
- `mastery` = primeiro grupo de proficiência da célula (algumas armas têm mais de um); grupo(s) extra(s) vira(m) nota em `gm.notes`, nunca descartado.
- `range.{short,medium,long}` fica no default do schema (`null`) neste sub-projeto — as colunas de alcance ("Throw Range"/"Missile Range"/"Hurl Range") só existem nas tabelas de mastery (fora de escopo). `min` fica `0` (default).
- `size`/`grip` = `null` — sem coluna de origem na Table 6-1 para nenhum dos dois.
- `weaponType` = `"handheld"` fixo (único valor confirmado em uso, via `Dagger.json`).
- Armas da seção "Unarmed Attacks" (`Unarmed Strikes`, `Wrestling`) não têm entrada em Table 9-2 (não são compráveis) — viram `system.natural: true`, `cost: 0`, `weight: 0` (o schema já zera peso automaticamente quando `natural: true`, mas o builder ainda escreve o valor calculado por consistência).
- O hand-written `packsrc/items/Equipment/Weapons/Dagger.json` (Fase 1) é apagado e substituído pela versão gerada.

---

### Task 1: Parser — `scripts/parse/weapons.mjs`

**Files:**
- Create: `scripts/parse/weapons.mjs`
- Test: `scripts/parse/weapons.test.mjs`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Consumes: `extract/raw/weapons.txt` e `extract/raw/equipment.txt` (ambos já existem, commitados na Fase 2).
- Produces:
  - `parseWeapons(weaponsRawText: string, equipmentRawText: string) -> Array<Row>`,
    exportado, onde `Row` é:
    ```
    {
      name: string,            // nome final (com sufixo "(Two-Handed)" só pro 2º Sword, Bastard)
      lookupName: string,      // nome original impresso, usado pra casar peso na Table 9-2
      section: "unarmed" | "one-handed" | "two-handed" | "ranged",
      cost: { value: number, currency: "gp" } | null,   // null só pras 2 armas unarmed
      damageRoll: string,      // "–"/"_" já viram "0"
      traits: string[],        // Base Traits + Advanced Traits combinados, como impressos (sem normalizar)
      masteryGroups: string[], // 1 ou mais grupos de proficiência, como impressos
      weightLb: number,        // casado da Table 9-2 por lookupName; 0 se não encontrado
    }
    ```
  - Um CLI (`node scripts/parse/weapons.mjs`) que lê os dois arquivos e escreve
    `extract/parsed/weapons.json` (`JSON.stringify(rows, null, 2)`).

Os valores abaixo (whitelist de traits e grupos de mastery) já foram
extraídos por leitura completa e manual de toda a Table 6-1 (todas as
40 linhas, 4 seções) — não são um chute, é o vocabulário fechado real do
livro.

- [ ] **Step 1: Escrever os testes do parser (falhando)**

Criar `scripts/parse/weapons.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWeapons } from "./weapons.mjs";

const WEAPONS_FIXTURE = `--- page 73 ---
                                    Chapter 6 – Weapons & We

--- page 74 ---
                                           Table 6–1: Weapon Summary
                                                 Unarmed Attacks
    Weapon          Cost Base Damage             Base Traits        Advanced Traits            Proficiency Group
 Unarmed Strikes     –         1            Blunt, Natural, Simple Knockout, Off-hand               Brawling
    Wrestling        –         –            Blunt, Natural, Simple  Entangle, Strangle             Grappling

                                            One-Handed Weapons
    Weapon          Cost Base Damage          Base Traits              Advanced Traits
   Axe, Hand         4gp      1d6                 Throw                          –                 Short Axes
     Dagger          3gp      1d4      Simple, Off-Hand, Throw          Double Damage             Short Blades
Hammer, Throwing     4gp      1d4             Blunt, Throw                     Stun                 Hammers
 Shield, Buckler     6gp       –             Blunt, Off-hand                 Deflect                 Shields
  Sword, Short       7gp      1d6                    –                Deflect, Disarm, Hurl Med. Blades, Short Blades
 Sword, Bastard     15gp    1d6+1               Versatile                    Deflect             Medium Blades

                                           Two-Handed Weapons
     Weapon         Cost Base Damage         Base Traits             Advanced Traits
    Axe, Battle      7gp      1d8                Bulky                Delay, Stun, Hurl     Short Axes, Long Axes
  Sword, Bastard    15gp    1d6+1              Versatile                Deflect, Hurl      Med. Blades, Long Blades

                                                 Ranged Weapons
     Weapon          Cost Base Damage            Base Traits            Advanced Traits
      Bolas           5gp      1d2                     _                Entangle, Strangle        Line Weapons
    Bow, Long       40gp      1d6                      –                      Delay                    Bows

--- page 75 ---
                                                         74


--- page 75 ---
Table 6–2a: Axe, Battle vs Armed Opponents
`;

const EQUIPMENT_FIXTURE = `--- page 150 ---
                   Table 9–2: Weapons
            Item                Weight              Cost
         Axe, Battle              6lb                7gp
         Axe, Hand                3lb                4gp
           Dagger                  1lb               3gp
      Hammer, Throwing            2½lb                4gp
       Shield, Buckler             2lb               6gp
       Sword, Bastard             8lb               15gp
        Sword, Short              3lb                7gp
            Bolas                0.5lb               5gp
        Bow, Long                3lb              40gp

--- page 151 ---
Table 9–3: Armour
`;

test("parses the Unarmed Attacks section with no Table 9-2 weight and marks it natural", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const strikes = rows.find((r) => r.name === "Unarmed Strikes");
   assert.equal(strikes.section, "unarmed");
   assert.equal(strikes.cost, null);
   assert.equal(strikes.damageRoll, "1");
   assert.deepEqual(strikes.traits, ["Blunt", "Natural", "Simple", "Knockout", "Off-hand"]);
   assert.deepEqual(strikes.masteryGroups, ["Brawling"]);
   assert.equal(strikes.weightLb, 0);
});

test("splits a trait glued to a group name by a single space (Axe, Hand)", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const axeHand = rows.find((r) => r.name === "Axe, Hand");
   assert.deepEqual(axeHand.traits, ["Throw"]);
   assert.deepEqual(axeHand.masteryGroups, ["Short Axes"]);
});

test("splits two traits glued together by a single space (simulated Unarmed-Strikes-style collapse)", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const strikes = rows.find((r) => r.name === "Unarmed Strikes");
   assert.ok(strikes.traits.includes("Simple"));
   assert.ok(strikes.traits.includes("Knockout"));
});

test("splits a trait glued to a two-word abbreviated group name (Sword, Short)", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const swordShort = rows.find((r) => r.name === "Sword, Short");
   assert.deepEqual(swordShort.traits, ["Deflect", "Disarm", "Hurl"]);
   assert.deepEqual(swordShort.masteryGroups, ["Med. Blades", "Short Blades"]);
});

test("keeps multiple mastery groups in order (Axe, Battle)", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const axeBattle = rows.find((r) => r.name === "Axe, Battle");
   assert.deepEqual(axeBattle.masteryGroups, ["Short Axes", "Long Axes"]);
});

test("generates two distinct names for the duplicated Sword, Bastard row", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const oneHanded = rows.find((r) => r.name === "Sword, Bastard");
   const twoHanded = rows.find((r) => r.name === "Sword, Bastard (Two-Handed)");
   assert.ok(oneHanded, "expected a one-handed Sword, Bastard entry");
   assert.ok(twoHanded, "expected a two-handed Sword, Bastard entry");
   assert.equal(oneHanded.section, "one-handed");
   assert.equal(twoHanded.section, "two-handed");
   // both share the same Table 9-2 lookup name, so both must resolve the same weight
   assert.equal(oneHanded.weightLb, 8);
   assert.equal(twoHanded.weightLb, 8);
});

test("converts a fractional Table 9-2 weight (½) to a decimal", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const hammer = rows.find((r) => r.name === "Hammer, Throwing");
   assert.equal(hammer.weightLb, 2.5);
});

test("also handles a plain decimal Table 9-2 weight", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const bolas = rows.find((r) => r.name === "Bolas");
   assert.equal(bolas.weightLb, 0.5);
});

test("treats a '–' or '_' Base Damage cell as \\"0\\"", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const shield = rows.find((r) => r.name === "Shield, Buckler");
   assert.equal(shield.damageRoll, "0");
});

test("does not include rows from Table 6-2a (mastery tables)", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   assert.ok(!rows.some((r) => r.name.includes("Axe, Battle vs")));
});

test("returns exactly 12 rows for this fixture (2 unarmed + 6 one-handed incl. Bastard + 2 two-handed incl. Bastard + 2 ranged)", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   assert.equal(rows.length, 12);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test scripts/parse/weapons.test.mjs`
Expected: `Cannot find module './weapons.mjs'`.

- [ ] **Step 3: Implementar `scripts/parse/weapons.mjs`**

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KNOWN_TRAITS = [
   "Blunt", "Natural", "Simple", "Throw", "Charge", "Bulky", "Versatile",
   "Knockout", "Off-hand", "Off-Hand", "Entangle", "Strangle", "Deflect", "Hurl", "Stun",
   "Skewer", "Set", "Disarm", "Deflect Penalty", "Double Damage", "Delay", "Hook",
];
const KNOWN_GROUPS = [
   "Brawling", "Grappling", "Short Axes", "Long Axes", "Hammers",
   "Short Blades", "Medium Blades", "Med. Blades", "Long Blades", "Spears", "Staves",
   "Chains", "Nets", "Shields", "Whips", "Pole Arms", "Bows", "Crossbows", "Firearms", "Line Weapons",
];
const KNOWN_PHRASES = [...KNOWN_TRAITS, ...KNOWN_GROUPS].sort((a, b) => b.length - a.length);

const SECTION_HEADERS = {
   "Unarmed Attacks": "unarmed",
   "One-Handed Weapons": "one-handed",
   "Two-Handed Weapons": "two-handed",
   "Ranged Weapons": "ranged",
};

const WEAPON_ROW_RE = /^\s*(.+?)\s{2,}(\d+gp|–)\s{2,}(\d+d\d+(?:\+\d+)?|\d+|–|_)\s{2,}(.+)$/;
const PRICE_ROW_RE = /^\s*(.+?)\s{2,}(\d+(?:\.\d+|½)?)lb\s{2,}(\d+(?:\.\d+)?)(\+)?(gp|sp|ep|pp|cp)\s*$/;

function escapeRegExp(value) {
   return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split a single comma-token that may have a trait or mastery-group name
 * glued to it by whitespace instead of a comma — a confirmed real artifact
 * of Table 6-1 where a row's text is long enough to collapse the column
 * gap down to a single space (e.g. "Hurl Med. Blades", "Simple Knockout").
 * Recurses so a token gluing more than one known phrase still resolves.
 * @param {string} token
 * @returns {string[]}
 */
function splitGluedToken(token) {
   const trimmed = token.trim();
   if (KNOWN_PHRASES.includes(trimmed)) return [trimmed];
   for (const phrase of KNOWN_PHRASES) {
      const suffixRe = new RegExp(`\\s+${escapeRegExp(phrase)}$`);
      if (suffixRe.test(trimmed)) {
         const prefix = trimmed.replace(suffixRe, "").trim();
         return prefix ? [...splitGluedToken(prefix), phrase] : [phrase];
      }
   }
   return [trimmed];
}

/**
 * Parse the free-form tail of a Table 6-1 row (everything after Base
 * Damage: Base Traits + Advanced Traits + Proficiency Group, in that
 * order but with no reliable single delimiter between them) into a flat
 * trait list and a mastery-group list. Wide whitespace gaps (2+ spaces)
 * are normalized to commas first — that resolves most column boundaries;
 * `splitGluedToken` then catches the rarer single-space collapse within
 * an already-comma-separated token.
 * @param {string} tail
 * @returns {{ traits: string[], groups: string[] }}
 */
function parseTail(tail) {
   const normalized = tail.replace(/\s{2,}/g, ", ");
   const rawTokens = normalized.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
   const tokens = rawTokens.flatMap(splitGluedToken).filter((t) => t !== "–" && t !== "_");
   const groups = tokens.filter((t) => KNOWN_GROUPS.includes(t));
   const traits = tokens.filter((t) => !KNOWN_GROUPS.includes(t));
   return { traits, groups };
}

function extractBlock(rawText, startMarker, endMarker) {
   const startIndex = rawText.indexOf(startMarker);
   if (startIndex === -1) return "";
   const afterStart = startIndex + startMarker.length;
   const endIndex = endMarker ? rawText.indexOf(endMarker, afterStart) : -1;
   return endIndex === -1 ? rawText.slice(afterStart) : rawText.slice(afterStart, endIndex);
}

function parseWeaponSummary(block) {
   const rows = [];
   let currentSection = null;
   const seenNames = new Set();
   for (const line of block.split("\n")) {
      const trimmed = line.trim();
      if (SECTION_HEADERS[trimmed]) {
         currentSection = SECTION_HEADERS[trimmed];
         continue;
      }
      const match = line.match(WEAPON_ROW_RE);
      if (!match) continue;
      const [, rawName, costRaw, damageRoll, tail] = match;
      const lookupName = rawName.trim();
      let name = lookupName;
      if (seenNames.has(lookupName)) {
         const sectionLabel = currentSection === "one-handed" ? "One-Handed" : "Two-Handed";
         name = `${lookupName} (${sectionLabel})`;
      }
      seenNames.add(lookupName);
      const { traits, groups } = parseTail(tail);
      rows.push({
         name,
         lookupName,
         section: currentSection,
         cost: costRaw === "–" ? null : { value: Number.parseInt(costRaw, 10), currency: "gp" },
         damageRoll: damageRoll === "–" || damageRoll === "_" ? "0" : damageRoll,
         traits,
         masteryGroups: groups,
      });
   }
   return rows;
}

function parseWeaponPrices(block) {
   const weights = new Map();
   for (const line of block.split("\n")) {
      const match = line.match(PRICE_ROW_RE);
      if (!match) continue;
      const [, name, weightStr] = match;
      const weightLb = weightStr.includes("½")
         ? Number.parseInt(weightStr, 10) + 0.5
         : Number.parseFloat(weightStr);
      weights.set(name.trim(), weightLb);
   }
   return weights;
}

/**
 * Parse Table 6-1 (Weapon Summary, weapons.txt) joined with Table 9-2
 * (Weapons, equipment.txt) into a flat list of weapon rows.
 * @param {string} weaponsRawText - full contents of extract/raw/weapons.txt
 * @param {string} equipmentRawText - full contents of extract/raw/equipment.txt
 * @returns {Array<object>} rows, see plan Task 1 "Produces" for shape
 */
export function parseWeapons(weaponsRawText, equipmentRawText) {
   const summaryBlock = extractBlock(weaponsRawText, "Table 6–1: Weapon Summary", "Table 6–2a");
   const priceBlock = extractBlock(equipmentRawText, "Table 9–2: Weapons", "Table 9–3");
   const weights = parseWeaponPrices(priceBlock);
   const rows = parseWeaponSummary(summaryBlock);
   for (const row of rows) {
      const weightLb = weights.get(row.lookupName);
      row.weightLb = weightLb === undefined ? 0 : weightLb;
      if (weightLb === undefined && row.section !== "unarmed") {
         console.warn(`[parse/weapons] no Table 9-2 weight match for "${row.lookupName}"`);
      }
   }
   return rows;
}

async function main() {
   const weaponsPath = path.join(process.cwd(), "extract", "raw", "weapons.txt");
   const equipmentPath = path.join(process.cwd(), "extract", "raw", "equipment.txt");
   const [weaponsRawText, equipmentRawText] = await Promise.all([
      fs.readFile(weaponsPath, "utf8"),
      fs.readFile(equipmentPath, "utf8"),
   ]);
   const rows = parseWeapons(weaponsRawText, equipmentRawText);
   const outDir = path.join(process.cwd(), "extract", "parsed");
   await fs.mkdir(outDir, { recursive: true });
   const outPath = path.join(outDir, "weapons.json");
   await fs.writeFile(outPath, JSON.stringify(rows, null, 2) + "\n", "utf8");
   console.log(`wrote ${outPath} (${rows.length} rows)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test scripts/parse/weapons.test.mjs`
Expected: todos os 10 testes passam.

- [ ] **Step 5: Atualizar `package.json` para incluir os testes do parser de armas**

```json
"test": "node --test scripts/extract/*.test.mjs scripts/parse/*.test.mjs scripts/build/*.test.mjs",
```

(Já inclui `scripts/parse/*.test.mjs` do domínio equipment — o glob pega
`weapons.test.mjs` automaticamente, sem editar a string se ela já tiver
essa forma; confirme o conteúdo atual do arquivo antes de decidir se há
o que mudar.)

Run: `npm test`
Expected: todos os testes passam (o total inclui os 10 novos deste parser).

- [ ] **Step 6: Rodar o CLI contra o texto real e inspecionar a contagem**

Run:
```bash
node scripts/parse/weapons.mjs
node -e "
const rows = JSON.parse(require('fs').readFileSync('extract/parsed/weapons.json', 'utf8'));
console.log('total:', rows.length);
console.assert(rows.length === 40, 'esperava 40 linhas, achou ' + rows.length);
const missingWeight = rows.filter(r => r.weightLb === 0 && r.section !== 'unarmed');
console.log('sem peso (fora unarmed, deveria ser vazio):', JSON.stringify(missingWeight.map(r => r.name)));
console.assert(missingWeight.length === 0, 'arma(s) sem peso fora das unarmed');
const bastard = rows.filter(r => r.lookupName === 'Sword, Bastard');
console.log('Sword, Bastard ocorrências:', bastard.length, JSON.stringify(bastard.map(r => r.name)));
console.assert(bastard.length === 2, 'esperava 2 entradas de Sword, Bastard');
"
```
Expected: `total: 40`, `sem peso (fora unarmed, deveria ser vazio): []`, `Sword,
Bastard ocorrências: 2 ["Sword, Bastard","Sword, Bastard (Two-Handed)"]`, sem
`Assertion failed`. (Estes números já foram confirmados manualmente antes de
escrever este plano — se a contagem vier diferente, o texto de
`extract/raw/weapons.txt` ou `equipment.txt` mudou desde então; investigue,
não ajuste o plano pra "passar".)

- [ ] **Step 7: Commit**

```bash
git add scripts/parse/weapons.mjs scripts/parse/weapons.test.mjs package.json extract/parsed/weapons.json
git commit -m "$(cat <<'EOF'
feat: weapons parser (Table 6-1 + Table 9-2 -> extract/parsed/weapons.json)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Builder — `scripts/build/weapons.mjs`

**Files:**
- Create: `scripts/build/weapons.mjs`
- Test: `scripts/build/weapons.test.mjs`
- Modify: `package.json` (script `test`, se ainda não cobrir `scripts/build/*.test.mjs` — já deveria, do domínio equipment)

**Interfaces:**
- Consumes: `extract/parsed/weapons.json` (Task 1, array de `Row` — mesma
  forma documentada no Task 1 "Produces").
- Produces:
  - `deterministicId(seed: string) -> string` (mesma função do domínio
    equipment — pode ser reimplementada aqui de forma idêntica, já que os
    dois builders são módulos independentes; não há import cruzado entre
    `scripts/build/equipment.mjs` e `scripts/build/weapons.mjs`).
  - `normalizeTag(trait: string) -> string`.
  - `buildDocument(row: Row) -> object` (documento Item pronto para
    `JSON.stringify`).
  - Um CLI (`node scripts/build/weapons.mjs`) que lê
    `extract/parsed/weapons.json`, apaga
    `packsrc/items/Equipment/Weapons/Dagger.json` se existir, e escreve um
    arquivo por linha em `packsrc/items/Equipment/Weapons/`.

- [ ] **Step 1: Escrever os testes do builder (falhando)**

Criar `scripts/build/weapons.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, normalizeTag, buildDocument } from "./weapons.mjs";

test("deterministicId matches the 16-char alphanumeric ID pattern", () => {
   assert.match(deterministicId("weapons:Dagger"), /^[a-zA-Z0-9]{16}$/);
});

test("deterministicId is stable across calls", () => {
   assert.equal(deterministicId("weapons:Dagger"), deterministicId("weapons:Dagger"));
});

test("normalizeTag lowercases and hyphenates a multi-word trait", () => {
   assert.equal(normalizeTag("Deflect Penalty"), "deflect-penalty");
});

test("normalizeTag converges differently-cased hyphenated traits", () => {
   assert.equal(normalizeTag("Off-hand"), normalizeTag("Off-Hand"));
   assert.equal(normalizeTag("Off-hand"), "off-hand");
});

test("buildDocument maps a plain melee weapon", () => {
   const doc = buildDocument({
      name: "Club", lookupName: "Club", section: "one-handed",
      cost: { value: 3, currency: "gp" }, damageRoll: "1d6",
      traits: ["Blunt", "Natural", "Deflect", "Hurl"], masteryGroups: ["Hammers"], weightLb: 5,
   });
   assert.equal(doc.type, "weapon");
   assert.equal(doc.system.damageRoll, "1d6");
   assert.equal(doc.system.canMelee, true);
   assert.equal(doc.system.canRanged, false);
   assert.equal(doc.system.mastery, "Hammers");
   assert.equal(doc.system.weight, 50);
   assert.equal(doc.system.cost, 3);
   assert.deepEqual(doc.system.tags, ["blunt", "natural", "deflect", "hurl"]);
   assert.equal(doc.system.natural, false);
});

test("buildDocument gives a thrown weapon both canMelee and canRanged", () => {
   const doc = buildDocument({
      name: "Dagger", lookupName: "Dagger", section: "one-handed",
      cost: { value: 3, currency: "gp" }, damageRoll: "1d4",
      traits: ["Simple", "Off-Hand", "Throw"], masteryGroups: ["Short Blades"], weightLb: 1,
   });
   assert.equal(doc.system.canMelee, true);
   assert.equal(doc.system.canRanged, true);
});

test("buildDocument gives a Ranged-section weapon only canRanged", () => {
   const doc = buildDocument({
      name: "Bow, Long", lookupName: "Bow, Long", section: "ranged",
      cost: { value: 40, currency: "gp" }, damageRoll: "1d6",
      traits: ["Delay"], masteryGroups: ["Bows"], weightLb: 3,
   });
   assert.equal(doc.system.canMelee, false);
   assert.equal(doc.system.canRanged, true);
});

test("buildDocument marks an unarmed-section row as natural with zero cost", () => {
   const doc = buildDocument({
      name: "Unarmed Strikes", lookupName: "Unarmed Strikes", section: "unarmed",
      cost: null, damageRoll: "1", traits: ["Blunt", "Natural", "Simple"], masteryGroups: ["Brawling"], weightLb: 0,
   });
   assert.equal(doc.system.natural, true);
   assert.equal(doc.system.cost, 0);
   assert.equal(doc.system.weight, 0);
});

test("buildDocument records extra mastery groups in gm.notes without inventing a schema field", () => {
   const doc = buildDocument({
      name: "Sword, Short", lookupName: "Sword, Short", section: "one-handed",
      cost: { value: 7, currency: "gp" }, damageRoll: "1d6",
      traits: ["Deflect", "Disarm", "Hurl"], masteryGroups: ["Med. Blades", "Short Blades"], weightLb: 3,
   });
   assert.equal(doc.system.mastery, "Med. Blades");
   assert.match(doc.system.gm.notes, /Short Blades/);
});

test("buildDocument leaves range at schema defaults", () => {
   const doc = buildDocument({
      name: "Bow, Long", lookupName: "Bow, Long", section: "ranged",
      cost: { value: 40, currency: "gp" }, damageRoll: "1d6",
      traits: ["Delay"], masteryGroups: ["Bows"], weightLb: 3,
   });
   assert.deepEqual(doc.system.range, { short: null, medium: null, long: null, min: 0 });
});

test("buildDocument is idempotent: same row produces byte-identical output twice", () => {
   const row = {
      name: "Club", lookupName: "Club", section: "one-handed",
      cost: { value: 3, currency: "gp" }, damageRoll: "1d6",
      traits: ["Blunt", "Natural", "Deflect", "Hurl"], masteryGroups: ["Hammers"], weightLb: 5,
   };
   const first = buildDocument(row);
   const second = buildDocument(row);
   assert.deepEqual(first, second);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test scripts/build/weapons.test.mjs`
Expected: `Cannot find module './weapons.mjs'`.

- [ ] **Step 3: Implementar `scripts/build/weapons.mjs`**

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const WEAPONS_FOLDER_ID = "2AKCulCJIGNyAMaN";
const CURRENCY_TO_GP = { cp: 0.01, sp: 0.1, ep: 0.5, pp: 5, gp: 1 };

/**
 * Derive a stable 16-char alphanumeric Foundry-style _id from a seed
 * string, so re-running the builder over the same input never changes
 * an existing document's identity. Independent copy of the equipment
 * domain's function of the same name/shape — no cross-module import.
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

/**
 * Normalize a printed trait name into a tag: lowercase, spaces become
 * hyphens. This also converges the book's own inconsistent capitalization
 * ("Off-hand" vs "Off-Hand" both appear) into a single tag.
 * @param {string} trait
 * @returns {string}
 */
export function normalizeTag(trait) {
   return trait.toLowerCase().replace(/\s+/g, "-");
}

function splitFileName(name) {
   const sanitized = name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
   return `${sanitized}.json`;
}

function convertCost(cost) {
   if (cost === null) return 0;
   return cost.value * CURRENCY_TO_GP[cost.currency];
}

/**
 * Map one parsed row (Task 1 shape) to a full Foundry weapon Item document.
 * @param {object} row
 * @returns {object}
 */
export function buildDocument(row) {
   const isNatural = row.section === "unarmed";
   const hasThrow = row.traits.includes("Throw");
   const canRanged = row.section === "ranged" || hasThrow;
   const canMelee = row.section !== "ranged";

   const id = deterministicId(`weapons:${row.name}`);
   const extraGroups = row.masteryGroups.slice(1);
   const gmNotes = extraGroups.length > 0
      ? `Grupos de proficiência adicionais do livro: ${extraGroups.join(", ")}.`
      : "";

   return {
      folder: WEAPONS_FOLDER_ID,
      name: row.name,
      _id: id,
      img: "icons/svg/item-bag.svg",
      effects: [],
      ownership: { default: 0 },
      flags: {},
      _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      _originalKey: `!items!${id}`,
      type: "weapon",
      system: {
         tags: row.traits.map(normalizeTag),
         description: "",
         gm: { notes: gmNotes },
         quantity: 1,
         quantityMax: 0,
         charges: 0,
         chargesMax: 0,
         weight: row.weightLb * 10,
         weightEquipped: row.weightLb * 10,
         cost: convertCost(row.cost),
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
         damageRoll: row.damageRoll,
         damageLabel: row.damageRoll,
         damageType: "physical",
         breath: null,
         canMelee,
         canRanged,
         canSet: false,
         isSlow: false,
         savingThrow: null,
         saveDmgFormula: null,
         mastery: row.masteryGroups[0] ?? "",
         weaponType: "handheld",
         ammoType: "",
         range: { short: null, medium: null, long: null, min: 0 },
         size: null,
         grip: null,
         natural: isNatural,
         mod: { dmg: 0, toHit: 0, dmgRanged: 0, toHitRanged: 0, rangeMultiplier: 1, vsGroup: {} },
         attacks: { used: 0, max: null, group: 0 },
         siege: {
            thac0: null, thbonus: null, crew: null, fullCrew: null,
            fireRate: null, ammoCostWk: null, weightTowed: null, acplus: null, artillerist: false,
         },
      },
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
   const parsedPath = path.join(process.cwd(), "extract", "parsed", "weapons.json");
   const rows = JSON.parse(await fs.readFile(parsedPath, "utf8"));

   const weaponsDir = path.join(process.cwd(), "packsrc", "items", "Equipment", "Weapons");
   await removeIfExists(path.join(weaponsDir, "Dagger.json"));

   let sort = 100000;
   let written = 0;
   for (const row of rows) {
      const doc = buildDocument(row);
      doc.sort = sort;
      sort += 100000;
      const filePath = path.join(weaponsDir, splitFileName(row.name));
      await fs.writeFile(filePath, JSON.stringify(doc, null, 2) + "\n", "utf8");
      written++;
   }
   console.log(`wrote ${written} weapon document(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test scripts/build/weapons.test.mjs`
Expected: todos os 11 testes passam.

- [ ] **Step 5: Confirmar que `package.json` já cobre `scripts/build/*.test.mjs`**

O glob já foi ajustado no domínio equipment; confirme lendo `package.json`
— se já tiver `scripts/build/*.test.mjs` no script `test`, nenhuma
mudança é necessária aqui.

Run: `npm test`
Expected: todos os testes passam (inclui os 10 do parser + 11 do builder
deste sub-projeto, mais tudo que já existia).

- [ ] **Step 6: Commit**

```bash
git add scripts/build/weapons.mjs scripts/build/weapons.test.mjs
git commit -m "$(cat <<'EOF'
feat: weapons builder (extract/parsed/weapons.json -> packsrc Item documents)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Rodar o pipeline completo, validar, e revisar por amostragem

**Files:**
- Create: `packsrc/items/Equipment/Weapons/*.json` (40 arquivos)
- Delete: `packsrc/items/Equipment/Weapons/Dagger.json`

**Interfaces:**
- Consumes: `node scripts/parse/weapons.mjs` (Task 1) e
  `node scripts/build/weapons.mjs` (Task 2), em sequência.
- Produces: o conteúdo final de `packsrc/items/Equipment/Weapons/**`, que
  fecha o critério de conclusão deste sub-projeto.

- [ ] **Step 1: Rodar parser e builder em sequência**

Run:
```bash
node scripts/parse/weapons.mjs
node scripts/build/weapons.mjs
```
Expected: `wrote extract/parsed/weapons.json (40 rows)` seguido de `wrote 40
weapon document(s)`, sem exceção lançada e sem nenhum
`[parse/weapons] no Table 9-2 weight match` no console (isso indicaria uma
arma fora das 2 "unarmed" sem peso — já confirmado que isso não acontece
nos dados reais).

- [ ] **Step 2: Confirmar que `Dagger.json` foi substituído**

Run: `ls packsrc/items/Equipment/Weapons/ | grep -c '\.json$'`
Expected: `40`. Run também: `cat packsrc/items/Equipment/Weapons/Dagger.json`
— o conteúdo deve refletir os dados gerados (mesmos campos de Task 2), não
o hand-written original (que não tinha `mastery: "Short Blades"` como
único grupo nem os traits derivados da Table 6-1 completos).

- [ ] **Step 3: Rodar o validador**

Run: `npm run validate`
Expected: `✓ items: <N> document(s), no errors` entre as linhas de saída, e
`validate: all packs OK` ao final — exit code 0.

- [ ] **Step 4: Amostragem manual**

Run:
```bash
cat packsrc/items/Equipment/Weapons/Sword_Bastard.json
cat "packsrc/items/Equipment/Weapons/$(ls packsrc/items/Equipment/Weapons | grep -i 'Bastard.*Two')"
cat packsrc/items/Equipment/Weapons/Unarmed_Strikes.json
```
Expected: as duas versões de Sword Bastard têm `damageRoll: "1d6+1"`,
`weight: 80` (8lb×10), `cost: 15`, mas `tags` diferentes na versão
Two-Handed (inclui `"hurl"`, que a versão One-Handed não tem — confere
com o livro: a versão 2H tem "Deflect, Hurl" como advanced traits, a 1H só
"Deflect"). `Unarmed_Strikes.json` tem `"natural": true`, `"cost": 0`,
`"weight": 0`, `"damageRoll": "1"`.

- [ ] **Step 5: Commit**

```bash
git add extract/parsed/weapons.json packsrc/items/Equipment/Weapons
git commit -m "$(cat <<'EOF'
feat: generate Weapon items from Table 6-1 and Table 9-2

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Este commit é o critério de conclusão do sub-projeto weapons:
`packsrc/items/Equipment/Weapons/*.json` cobre as 40 linhas de Table 6-1,
`npm run validate` passa sem erros, e o `Dagger.json` hand-written foi
substituído.

---

## Fim do sub-projeto weapons

Próximo passo: o sub-projeto `weaponMastery` (as ~80 tabelas de
proficiência do cap. 6), com seu próprio spec/plano — depende do
resultado deste sub-projeto (o campo `system.mastery` de cada arma gerada
aqui é a chave que vai linkar com os documentos `weaponMastery` de lá).
