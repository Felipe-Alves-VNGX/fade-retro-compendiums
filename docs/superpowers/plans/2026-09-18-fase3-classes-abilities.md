# fade-retro-compendiums — Fase 3, sub-projeto Classes (Habilidades e Talentos) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o pipeline parser → `extract/parsed` → builder que
preenche `classDefinition.specialAbilities[]` das 10 classes já geradas
no sub-projeto "Tabela Núcleo", cria os novos itens `specialAbility`
(38 registros, 35 documentos após deduplicar a habilidade
compartilhada "Breath Evasion") pras habilidades de combate/classe
catalogadas no cap. 4, e liga 4 classes aos 10 itens `specialAbility`
de Talento já existentes do domínio `skills`.

**Architecture:** `scripts/parse/classAbilities.mjs` combina um
catálogo fixo verificado (nomes de habilidade + níveis, já confirmados
contra o livro real — não uma tabela genérica, dado o vocabulário
pequeno e fechado) com extração de prosa por classe (mesmo padrão
"Nome: descrição" já usado em `skillsAndTalents.mjs`), mais parsing
dedicado das duas tabelas largas sem campo no schema (Turning Undead,
Commanding Animals). `scripts/build/classAbilities.mjs` gera os itens
novos, lê os itens de Talento e os documentos de classe já existentes,
e REESCREVE (não recria) os 10 documentos de classe com
`specialAbilities[]` preenchido.

**Tech Stack:** Node.js (ESM), `node:test`, `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-09-18-fase3-classes-abilities-design.md`
(e `docs/superpowers/specs/2026-09-18-fase3-classes-core-design.md`,
sub-projeto anterior, cujos documentos este plano modifica)

## Global Constraints

- **Catálogo de habilidades verificado por extração exaustiva das 10
  tabelas Na inteiras** (36 níveis cada) — não confiar em amostra: o
  vocabulário final tem 32 habilidades no catálogo fixo (uma delas,
  "Chivalric Vows" do Fighter, vira um bloco ALL-CAPS à parte, não uma
  prosa "Nome: "), mais 3 blocos ALL-CAPS do Fighter (Chivalric Vows,
  Warden, Warlord) e 1 habilidade compartilhada por 4 classes (Breath
  Evasion) — total **38 registros de habilidade**, deduplicando pra
  **35 documentos `specialAbility`** (Breath Evasion conta 1 vez, não
  4). Mais **22 links de talento** (catálogo fixo, seção 7 da spec,
  sem parsing de tabela — os níveis já são dado verificado).
- **"Skill Increase", "Weapon Feat" e "Spell Casting" NÃO viram
  itens** — são mecânica genérica de todas as classes, já coberta fora
  deste domínio (regra geral de criação de personagem).
- **Achado real, fix obrigatório**: `stripPageBoundaries` precisa
  aceitar fim-de-string como alternativa ao `\n` final
  (`(?:\n|$)` em vez de só `\n`) — quando o limite de seção de uma
  classe cai exatamente em cima de uma quebra de página (caso real:
  Battlemage→Cleric, página 30), o corte de seção consome a quebra de
  linha de que o regex de limpeza de marcador precisa, e sem esse
  ajuste o marcador `--- page 30 ---` vaza literalmente pra dentro da
  descrição de "Multi-attack" do Battlemage. Verificado: sem o fix, 2
  das 38 descrições vazam o marcador; com o fix, 0.
- **`category: "class"`** pras novas habilidades — achado real lendo
  `src/utils/finder.ts` do fantastic-depths (`_getSpecialAbility`,
  `options?.category === 'class'`), não `"classAbility"` como uma
  versão anterior da spec supunha por analogia. Talentos (domínio
  skills) continuam `category: "talent"`, sem mudança.
- **`specialAbilities[].uuid` sempre `""`** — achado real lendo
  `src/sys/registry/ClassSystem.ts`: o mecanismo real de concessão de
  habilidade ao subir de nível casa `actor.items` contra o array só
  por `name`, nunca lê `uuid`. `""` é também o próprio default do
  schema.
- **Item por (classe, habilidade), exceto Breath Evasion**: mesma
  habilidade em classes diferentes (Parry, Power Attack) tem prosa
  ligeiramente diferente por classe (confirmado por leitura real) — um
  item por classe. Breath Evasion tem texto idêntico nas 3 classes que
  têm prosa própria (Mountebank/Mystic/Ranger) — um item só,
  `classKey: null`, referenciado pelas 4 classes que a concedem
  (inclusive Thief, cujo próprio livro nunca escreveu uma prosa
  "Breath Evasion:" específica — achado real, não erro de extração;
  usa o mesmo texto compartilhado).
- **Habilidades progressivas** (Multi-attack, Powder Crafting, Gentle
  Touch) viram UM item `specialAbility` (uma descrição cobrindo todos
  os tiers), mas MÚLTIPLAS entradas em `specialAbilities[]` da classe
  (uma por nível/tier), cada uma com `changes` descrevendo o que muda
  naquele tier.
- **Fighter: Chivalric Vows engloba a prosa de Chevalier** — o livro
  não tem um cabeçalho "CHEVALIER" separado; o bloco "CHIVALRIC VOWS"
  já descreve os benefícios do Chevalier (Detect Evil/Spells/Turn
  Undead como clérigo de 1/3 nível) diretamente. "Warden" e "Warlord"
  são os outros 2 caminhos alternativos, cada um seu próprio bloco
  ALL-CAPS. Total: 3 itens (não 4).
- **Turning Undead (Table 4-3c) e Commanding Animals (Table 4-4c)
  viram tabela HTML de referência dentro da description**, mesmo
  padrão já usado no sub-projeto anterior (Powder do Grenadier, artes
  marciais do Mystic) — 36 linhas × 14 colunas cada, com a legenda das
  siglas (`t`/`d`/`D`/`X` pra Turn Undead; `c`/`m`/`M`/`X` pra Command
  Animal) transcrita por extenso, não só as siglas soltas.
- **Sem mudança no validador nem novo subtipo**: `specialAbility` já
  está registrado (`SUBTYPE_REQUIRED_FIELDS.specialAbility = []`, do
  domínio skills) e `class` não ganha nenhum campo novo na lista de
  obrigatórios (`specialAbilities`/`classItems` já são opcionais no
  schema real).
- **Os 10 documentos de classe são REESCRITOS, não recriados** — mesmo
  `_id` determinístico do sub-projeto anterior (`sha1("classes:" +
  key)`), só o campo `system.specialAbilities` muda. O builder DEVE
  resetar esse array pra `[]` antes de reconstruí-lo a cada execução —
  achado real de bug de idempotência: sem o reset, rodar o builder duas
  vezes duplica todas as entradas (confirmado: sem o fix, 2ª execução
  dobra o array de 8 pra 16 entradas no Fighter; com o fix, fica em 8
  nas duas).
- `deterministicId` das novas habilidades: `sha1("classAbilities:" +
  classKey + ":" + nome)` pras específicas de classe,
  `sha1("classAbilities:shared:" + nome)` pra Breath Evasion (sem
  classe no seed). Mesmo algoritmo/`ID_ALPHABET` dos domínios
  anteriores, reimplementado de forma independente.
- Pasta `Class_Abilities/`, top-level, hand-picked em `_folders.json`.

---

### Task 1: Parser — `scripts/parse/classAbilities.mjs`

**Files:**
- Create: `scripts/parse/classAbilitiesCatalog.mjs` (dado fixo
  verificado — nomes/níveis, não lógica de parsing)
- Create: `scripts/parse/classAbilities.mjs`
- Test: `scripts/parse/classAbilities.test.mjs`

**Interfaces:**
- Consumes: `extract/raw/creating-a-character.txt` (já existe,
  commitado na Fase 2).
- Produces:
  - `parseClassAbilities(rawText: string) -> { abilities: AbilityRecord[], talentLinks: [classKey, talentName, level][] }`
    onde `AbilityRecord` é:
    ```
    {
      classKey: string, name: string, levels: number[],
      changes: string[] | null,  // mesmo tamanho de levels, ou null se concessão única
      description: string,       // HTML
      shared: boolean,           // true só pra Breath Evasion (4 registros, mesmo texto)
    }
    ```
  - Um CLI (`node scripts/parse/classAbilities.mjs`) que escreve
    `extract/parsed/classAbilities.json`.

- [ ] **Step 1: Criar o catálogo fixo verificado**

Criar `scripts/parse/classAbilitiesCatalog.mjs`:

```javascript
// Ground truth catalog, verified by hand against the real book
// (spec sections 3 e 7 — extração exaustiva das 10 tabelas Na
// inteiras, não amostra).
export const CLASS_NAMES = ["BATTLEMAGE", "CLERIC", "DRUID", "FIGHTER", "GRENADIER", "MOUNTEBANK", "MYSTIC", "RANGER", "THIEF", "WIZARD"];

export const ABILITY_CATALOG = [
   // [classKey, abilityName, levels[], changesPerLevel[] ou null]
   ["fighter", "Parry", [7], null],
   ["fighter", "Power Attack", [11], null],
   ["fighter", "Multi-attack", [10, 20, 30], ["2 ataques por rodada", "3 ataques por rodada", "4 ataques por rodada"]],
   ["battlemage", "Parry", [7], null],
   ["battlemage", "Power Attack", [11], null],
   ["battlemage", "Multi-attack", [14, 26], ["2 ataques por rodada", "3 ataques por rodada"]],
   ["cleric", "Turn Undead", [1], null],
   ["druid", "Command Animal", [1], null],
   ["grenadier", "Powder Crafting", [2, 4, 6, 8, 10, 13, 17], ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"]],
   ["grenadier", "Covering Fire", [7], null],
   ["grenadier", "Power Shot", [11], null],
   ["grenadier", "Powder Distillation", [14], null],
   ["grenadier", "Multi-attack", [10, 20, 30], ["2 ataques por rodada", "3 ataques por rodada", "4 ataques por rodada"]],
   ["mountebank", "Weak Magic", [1], null],
   ["mountebank", "Item Use", [1], null],
   ["mystic", "Alertness", [2], null],
   ["mystic", "Self Healing", [4], null],
   ["mystic", "Speak with Animals", [6], null],
   ["mystic", "Parry", [7], null],
   ["mystic", "Spell Resistance", [8], null],
   ["mystic", "Speak with Anyone", [10], null],
   ["mystic", "Power Attack", [11], null],
   ["mystic", "Still Mind", [12], null],
   ["mystic", "Pass Unnoticed", [14], null],
   ["mystic", "Gentle Touch", [18, 19, 20, 22, 24], ["Cureall", "Charm Monster", "Hold Monster", "Quest", "morte instantânea"]],
   ["ranger", "Nimble", [1], null],
   ["ranger", "Parry", [7], null],
   ["ranger", "Power Attack", [11], null],
   ["ranger", "Power Shot", [11], null],
   ["ranger", "Multi-attack", [14, 26], ["2 ataques por rodada", "3 ataques por rodada"]],
   ["thief", "Sneak Attack", [1], null],
];

// Ability with text identical across classes except the class name —
// one shared item, referenced by all 4 classes (including Thief,
// whose own book never writes a "Breath Evasion:" prose of its own —
// a real omission in the source material, not an extraction bug).
export const SHARED_ABILITY = {
   name: "Breath Evasion",
   level: 16,
   classes: ["mountebank", "mystic", "ranger", "thief"],
};

// [classKey, talentName, level] — talentName must match an existing
// item in packsrc/items/Talents/*.json (domain skills) exactly.
export const TALENT_LINKS = [
   ["thief", "Open Locks", 1], ["thief", "Locate Traps", 1], ["thief", "Remove Traps", 1],
   ["thief", "Climb Walls", 1], ["thief", "Move Silently", 1], ["thief", "Hide in Shadows", 1],
   ["thief", "Pick Pockets", 1], ["thief", "Hear Noise", 1],
   ["thief", "Read Languages", 4], ["thief", "Wizard Scroll Use", 10],
   ["mountebank", "Climb Walls", 1], ["mountebank", "Move Silently", 1],
   ["mountebank", "Hide in Shadows", 1], ["mountebank", "Pick Pockets", 1],
   ["mystic", "Locate Traps", 1], ["mystic", "Remove Traps", 1], ["mystic", "Climb Walls", 1],
   ["mystic", "Move Silently", 1], ["mystic", "Hide in Shadows", 1],
   ["ranger", "Climb Walls", 1], ["ranger", "Move Silently", 1], ["ranger", "Hide in Shadows", 1],
];
```

- [ ] **Step 2: Escrever os testes do parser (falhando)**

Criar `scripts/parse/classAbilities.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseClassAbilities } from "./classAbilities.mjs";

const raw = fs.readFileSync("extract/raw/creating-a-character.txt", "utf8");
const { abilities, talentLinks } = parseClassAbilities(raw);

test("parseClassAbilities returns 38 ability records (31 catalog + 4 shared Breath Evasion + 3 Fighter subpaths) and 22 talent links", () => {
   assert.equal(abilities.length, 38);
   assert.equal(talentLinks.length, 22);
});

test("every ability record has a non-empty description", () => {
   for (const a of abilities) {
      assert.ok(a.description && a.description.length > 0, `${a.classKey}/${a.name}`);
   }
});

test("no description leaks a page marker or an unrelated column-merge gap", () => {
   for (const a of abilities) {
      assert.doesNotMatch(a.description, /--- page/, `${a.classKey}/${a.name}`);
   }
});

test("Battlemage's own Multi-attack description does not leak the page-30 marker (real bug found and fixed: class-boundary slicing ate the trailing newline stripPageBoundaries needs)", () => {
   const bm = abilities.find((a) => a.classKey === "battlemage" && a.name === "Multi-attack");
   assert.doesNotMatch(bm.description, /--- page/);
   assert.match(bm.description, /details of multi-attack/);
});

test("progressive abilities carry one level per tier with matching changes text", () => {
   const fighterMulti = abilities.find((a) => a.classKey === "fighter" && a.name === "Multi-attack");
   assert.deepEqual(fighterMulti.levels, [10, 20, 30]);
   assert.equal(fighterMulti.changes.length, 3);
   const gentleTouch = abilities.find((a) => a.classKey === "mystic" && a.name === "Gentle Touch");
   assert.deepEqual(gentleTouch.levels, [18, 19, 20, 22, 24]);
});

test("Breath Evasion is shared by exactly 4 classes with identical description text", () => {
   const breathEvasions = abilities.filter((a) => a.name === "Breath Evasion");
   assert.equal(breathEvasions.length, 4);
   assert.deepEqual(breathEvasions.map((a) => a.classKey).sort(), ["mountebank", "mystic", "ranger", "thief"]);
   const texts = new Set(breathEvasions.map((a) => a.description));
   assert.equal(texts.size, 1);
});

test("Fighter gets Chivalric Vows, Warden, and Warlord as three distinct items", () => {
   const fighterSubpaths = abilities.filter((a) => a.classKey === "fighter" && ["Chivalric Vows", "Warden", "Warlord"].includes(a.name));
   assert.equal(fighterSubpaths.length, 3);
   for (const a of fighterSubpaths) assert.ok(a.description.length > 50, a.name);
});

test("Turn Undead's description includes a 36-row, 14-column reference table with the real legend", () => {
   const turnUndead = abilities.find((a) => a.classKey === "cleric" && a.name === "Turn Undead");
   const rowCount = (turnUndead.description.match(/<tr>/g) || []).length - 1;
   assert.equal(rowCount, 36);
   assert.match(turnUndead.description, /<th>Skeleton<\/th>/);
   assert.match(turnUndead.description, /<th>Lich<\/th>/);
   assert.match(turnUndead.description, /you are not powerful enough to turn/);
});

test("Command Animal's description includes a 36-row, 14-column reference table with the real legend", () => {
   const commandAnimal = abilities.find((a) => a.classKey === "druid" && a.name === "Command Animal");
   const rowCount = (commandAnimal.description.match(/<tr>/g) || []).length - 1;
   assert.equal(rowCount, 36);
   assert.match(commandAnimal.description, /you are not powerful enough to command/);
});

test("Thief's talent links include the 4th-level Read Languages and 10th-level Wizard Scroll Use exceptions", () => {
   const thiefLinks = talentLinks.filter(([classKey]) => classKey === "thief");
   assert.equal(thiefLinks.length, 10);
   assert.deepEqual(thiefLinks.find(([, name]) => name === "Read Languages"), ["thief", "Read Languages", 4]);
   assert.deepEqual(thiefLinks.find(([, name]) => name === "Wizard Scroll Use"), ["thief", "Wizard Scroll Use", 10]);
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `node --test scripts/parse/classAbilities.test.mjs`
Expected: FAIL — `Cannot find module './classAbilities.mjs'`.

- [ ] **Step 4: Implementar `scripts/parse/classAbilities.mjs`**

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLASS_NAMES, ABILITY_CATALOG, SHARED_ABILITY, TALENT_LINKS } from "./classAbilitiesCatalog.mjs";

const TURN_UNDEAD_LABELS = ["Skeleton", "Zombie", "Ghoul", "Wight", "Wraith", "Mummy", "Spectre", "Vampire", "Phantom", "Haunt", "Spirit", "Pestilent", "Lich", "Special"];
const COMMAND_ANIMAL_LABELS = ["<1", "1 to 1+", "2 to 2+", "3 to 3+", "4 to 4+", "5 to 6+", "7 to 8+", "9 to 11+", "12 to 13+", "14 to 16+", "17 to 20+", "21 to 25+", "26 to 30+", "31 or more"];

// Same pdftotext-specific page-break shape already handled in
// spells/skillsAndTalents/classesCore — but with an extra fix: the
// trailing "\n" is made optional ((?:\n|$)) because a class-boundary
// slice can end exactly at a page marker with no character after it
// (real case: Battlemage → Cleric at page 30), and without this the
// marker survives unstripped inside the last ability's description.
function stripPageBoundaries(text) {
   return text
      .replace(/\f/g, "")
      .replace(/\n[ \t]*\n*(?:[ \t]*\d{1,4}[ \t]*\n[ \t]*\n*)?--- page \d+ ---(?:\n|$)/g, "\n");
}

function paragraphsToHtml(text) {
   const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean).join(" ").trim())
      .filter(Boolean);
   return paragraphs.map((p) => `<p>${p}</p>`).join("");
}

/** Slice of chapter 4 covering one class's "<CLASS> ABILITIES (...)" block, up to the next class's name header. */
function getAbilitiesSection(rawText, className) {
   const headerIdx = rawText.indexOf(`${className} ABILITIES (`);
   const nextClassIdxs = CLASS_NAMES
      .map((n) => rawText.indexOf(`\n${n}\n`, headerIdx + 1))
      .filter((x) => x > -1);
   const end = nextClassIdxs.length ? Math.min(...nextClassIdxs) : rawText.length;
   return stripPageBoundaries(rawText.slice(headerIdx, end));
}

/**
 * Extract a "Name: description" prose block. `stopAtTable` (default
 * true) stops the block at the next "Table N" title line — set to
 * false for Turn Undead/Command Animal, whose own wide table IS part
 * of their content.
 */
function extractNamedBlock(section, name, { stopAtTable = true } = {}) {
   const idx = section.indexOf(`${name}:`);
   if (idx === -1) return null;
   const afterStart = idx + name.length + 1;
   const rest = section.slice(afterStart);
   const pattern = stopAtTable
      ? /\n[ \t]*(Table \d|[A-Z][A-Za-z '\-]{2,40}:|[A-Z][A-Z ]{3,40}\n)/
      : /\n[ \t]*([A-Z][A-Za-z '\-]{2,40}:|[A-Z][A-Z ]{3,40}\n)/;
   const stopMatch = rest.match(pattern);
   const end = stopMatch ? stopMatch.index : rest.length;
   return paragraphsToHtml(rest.slice(0, end));
}

/** Extract an ALL-CAPS-headed block (e.g. "CHIVALRIC VOWS") up to the next known ALL-CAPS header. */
function extractCapsBlock(rawText, headerName, nextHeaderNames) {
   const idx = rawText.indexOf(`\n${headerName}\n`);
   if (idx === -1) return null;
   const start = idx + headerName.length + 2;
   const stopIdxs = nextHeaderNames
      .map((h) => rawText.indexOf(`\n${h}\n`, start))
      .filter((x) => x > -1);
   const end = stopIdxs.length ? Math.min(...stopIdxs) : rawText.length;
   return paragraphsToHtml(stripPageBoundaries(rawText.slice(start, end)));
}

function parseWideTable(rawText, tableTitle, colCount) {
   const idx = rawText.indexOf(tableTitle);
   const section = stripPageBoundaries(rawText.slice(idx, idx + 6000));
   const lines = section.split("\n");
   let start = lines.findIndex((l) => /^\s*Level\s/.test(l));
   if (start === -1) start = 0;
   const rows = [];
   let i = start;
   while (rows.length < 36 && i < lines.length) {
      const m = lines[i].match(/^\s*(\d{1,2})\s+(.*)$/);
      if (m && Number(m[1]) === rows.length + 1) {
         const tokens = m[2].trim().split(/\s+/).filter(Boolean).slice(0, colCount);
         if (tokens.length === colCount) rows.push({ level: Number(m[1]), values: tokens });
      }
      i++;
   }
   return rows;
}

function wideTableToHtml(title, labels, rows, legendHtml) {
   const header = labels.map((l) => `<th>${l}</th>`).join("");
   const body = rows.map((r) => `<tr><td>${r.level}</td>${r.values.map((v) => `<td>${v}</td>`).join("")}</tr>`).join("");
   return `<p>${title} (referência, não usado por automação do sistema):</p><table><tr><th>Level</th>${header}</tr>${body}</table>${legendHtml}`;
}

/**
 * Parse the ~38 class-granted abilities of chapter 4 plus the 22
 * talent links (see classAbilitiesCatalog.mjs for the verified
 * catalog this function drives off).
 * @param {string} rawText - full contents of extract/raw/creating-a-character.txt
 * @returns {{ abilities: object[], talentLinks: [string, string, number][] }}
 */
export function parseClassAbilities(rawText) {
   const abilities = [];

   for (const [classKey, name, levels, changes] of ABILITY_CATALOG) {
      const className = classKey.toUpperCase();
      const section = getAbilitiesSection(rawText, className);
      const isWideTableAbility = (classKey === "cleric" && name === "Turn Undead") || (classKey === "druid" && name === "Command Animal");
      const description = extractNamedBlock(section, name, { stopAtTable: !isWideTableAbility });
      abilities.push({ classKey, name, levels, changes, description, shared: false });
   }

   const turnUndead = abilities.find((a) => a.classKey === "cleric" && a.name === "Turn Undead");
   const legendIdx = turnUndead.description.indexOf("<p>'–':");
   const legendHtml = legendIdx > -1 ? turnUndead.description.slice(legendIdx) : "";
   const introHtml = legendIdx > -1 ? turnUndead.description.slice(0, legendIdx) : turnUndead.description;
   const turnUndeadRows = parseWideTable(rawText, "Table 4–3c: Turning Undead by Cleric Level", 14);
   turnUndead.description = introHtml + wideTableToHtml("Table 4-3c: Turning Undead by Cleric Level", TURN_UNDEAD_LABELS, turnUndeadRows, legendHtml);

   const commandAnimal = abilities.find((a) => a.classKey === "druid" && a.name === "Command Animal");
   const legendIdx2 = commandAnimal.description.indexOf("<p>'–':");
   const legendHtml2 = legendIdx2 > -1 ? commandAnimal.description.slice(legendIdx2) : "";
   const introHtml2 = legendIdx2 > -1 ? commandAnimal.description.slice(0, legendIdx2) : commandAnimal.description;
   const commandAnimalRows = parseWideTable(rawText, "Table 4–4c: Commanding Animals by Druid Level", 14);
   commandAnimal.description = introHtml2 + wideTableToHtml("Table 4-4c: Commanding Animals by Druid Level", COMMAND_ANIMAL_LABELS, commandAnimalRows, legendHtml2);

   const mysticSection = getAbilitiesSection(rawText, "MYSTIC");
   const breathText = extractNamedBlock(mysticSection, "Breath Evasion");
   for (const classKey of SHARED_ABILITY.classes) {
      abilities.push({ classKey, name: SHARED_ABILITY.name, levels: [SHARED_ABILITY.level], changes: null, description: breathText, shared: true });
   }

   const chivalricVows = extractCapsBlock(rawText, "CHIVALRIC VOWS", ["WARDENS", "WARLORDS", "GRENADIER"]);
   const warden = extractCapsBlock(rawText, "WARDENS", ["WARLORDS", "GRENADIER"]);
   const warlord = extractCapsBlock(rawText, "WARLORDS", ["GRENADIER"]);
   abilities.push({ classKey: "fighter", name: "Chivalric Vows", levels: [8], changes: null, description: chivalricVows, shared: false });
   abilities.push({ classKey: "fighter", name: "Warden", levels: [9], changes: null, description: warden, shared: false });
   abilities.push({ classKey: "fighter", name: "Warlord", levels: [9], changes: null, description: warlord, shared: false });

   return { abilities, talentLinks: TALENT_LINKS };
}

async function main() {
   const rawPath = path.join(process.cwd(), "extract", "raw", "creating-a-character.txt");
   const rawText = await fs.readFile(rawPath, "utf8");
   const result = parseClassAbilities(rawText);
   const outPath = path.join(process.cwd(), "extract", "parsed", "classAbilities.json");
   await fs.writeFile(outPath, JSON.stringify(result, null, 2) + "\n", "utf8");
   console.log(`wrote ${result.abilities.length} ability record(s), ${result.talentLinks.length} talent link(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `node --test scripts/parse/classAbilities.test.mjs`
Expected: PASS, todos os testes verdes.

- [ ] **Step 6: Commit**

```bash
git add scripts/parse/classAbilitiesCatalog.mjs scripts/parse/classAbilities.mjs scripts/parse/classAbilities.test.mjs
git commit -m "$(cat <<'EOF'
feat: add class abilities/talents parser

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Sv5Ek7ypXvkGSWgE9JosAY
EOF
)"
```

---

### Task 2: Builder — `scripts/build/classAbilities.mjs`

**Files:**
- Create: `scripts/build/classAbilities.mjs`
- Test: `scripts/build/classAbilities.test.mjs`
- Modify: `docs/fantastic-depths-item-schema.md` (nota sobre o valor
  `category: "class"` na seção `SpecialAbilityDataModel` já existente)

**Interfaces:**
- Consumes: `extract/parsed/classAbilities.json` (Task 1), os 10
  arquivos reais em `packsrc/items/Talents/*.json` (domínio skills,
  pra pegar nomes de talento válidos), os 10 arquivos reais em
  `packsrc/items/Character_Classes/*.json` (sub-projeto anterior, pra
  reescrever com `specialAbilities[]` preenchido).
- Produces:
  - `deterministicId(seed: string) -> string`.
  - `buildAbilityDocument({name, description, classKey}) -> object`
    (documento `specialAbility`, `category: "class"`).
  - `buildSpecialAbilityLinks(record, classKey) -> object[]` (uma
    entrada por nível/tier de `record.levels`).
  - Um CLI (`node scripts/build/classAbilities.mjs`) que escreve os 35
    novos itens em `packsrc/items/Class_Abilities/`, garante a pasta
    `Class Abilities`, e REESCREVE os 10 arquivos de
    `packsrc/items/Character_Classes/` com `specialAbilities[]`
    recalculado do zero (não anexado — ver Global Constraints, achado
    de bug de idempotência).

- [ ] **Step 1: Escrever os testes do builder (falhando)**

Criar `scripts/build/classAbilities.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, buildAbilityDocument, buildSpecialAbilityLinks } from "./classAbilities.mjs";

test("deterministicId matches the 16-char alphanumeric ID pattern", () => {
   assert.match(deterministicId("classAbilities:fighter:Parry"), /^[a-zA-Z0-9]{16}$/);
});

test("deterministicId is stable across calls", () => {
   assert.equal(deterministicId("classAbilities:fighter:Parry"), deterministicId("classAbilities:fighter:Parry"));
});

test("buildAbilityDocument maps a class-owned ability with category 'class'", () => {
   const doc = buildAbilityDocument({ name: "Parry", description: "<p>...</p>", classKey: "fighter" });
   assert.equal(doc.type, "specialAbility");
   assert.equal(doc.name, "Parry");
   assert.equal(doc.system.category, "class");
   assert.equal(doc.system.classKey, "fighter");
   assert.equal(doc.system.description, "<p>...</p>");
});

test("buildAbilityDocument maps a shared ability with classKey null", () => {
   const doc = buildAbilityDocument({ name: "Breath Evasion", description: "<p>...</p>", classKey: null });
   assert.equal(doc.system.classKey, null);
});

test("buildAbilityDocument's _id differs between class-owned and shared seeds for the same name", () => {
   const fighterParry = buildAbilityDocument({ name: "Parry", description: "x", classKey: "fighter" });
   const mysticParry = buildAbilityDocument({ name: "Parry", description: "y", classKey: "mystic" });
   assert.notEqual(fighterParry._id, mysticParry._id);
});

test("buildSpecialAbilityLinks expands a single-level ability into one entry", () => {
   const links = buildSpecialAbilityLinks({ name: "Parry", levels: [7], changes: null }, "fighter");
   assert.deepEqual(links, [{ name: "Parry", uuid: "", level: 7, target: null, classKey: "fighter", changes: "" }]);
});

test("buildSpecialAbilityLinks expands a progressive ability into one entry per tier with matching changes text", () => {
   const links = buildSpecialAbilityLinks({ name: "Multi-attack", levels: [10, 20, 30], changes: ["2 ataques por rodada", "3 ataques por rodada", "4 ataques por rodada"] }, "fighter");
   assert.equal(links.length, 3);
   assert.equal(links[1].level, 20);
   assert.equal(links[1].changes, "3 ataques por rodada");
});

test("buildAbilityDocument is idempotent: same input produces byte-identical output twice", () => {
   const input = { name: "Parry", description: "<p>...</p>", classKey: "fighter" };
   assert.deepEqual(buildAbilityDocument(input), buildAbilityDocument(input));
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test scripts/build/classAbilities.test.mjs`
Expected: FAIL — `Cannot find module './classAbilities.mjs'`.

- [ ] **Step 3: Implementar `scripts/build/classAbilities.mjs`**

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function deterministicIdInternal(seed) {
   const hash = crypto.createHash("sha1").update(seed).digest();
   let id = "";
   for (let i = 0; i < 16; i++) id += ID_ALPHABET[hash[i] % ID_ALPHABET.length];
   return id;
}

/**
 * Derive a stable 16-char alphanumeric Foundry-style _id from a seed
 * string. Independent copy of the equipment/weapons/weaponMastery/
 * spells/skillsAndTalents/classesCore domains' function of the same
 * name/shape — no cross-module import.
 * @param {string} seed
 * @returns {string}
 */
export function deterministicId(seed) {
   return deterministicIdInternal(seed);
}

const CLASS_ABILITIES_FOLDER_ID = deterministicIdInternal("folders:Class Abilities");

function splitFileName(name) {
   return `${name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}.json`;
}

/**
 * Build a specialAbility Item document for a class-granted ability.
 * `classKey: null` marks a shared ability (Breath Evasion) owned by
 * no single class.
 * @param {{name: string, description: string, classKey: string|null}} ability
 * @returns {object}
 */
export function buildAbilityDocument(ability) {
   const seed = ability.classKey ? `classAbilities:${ability.classKey}:${ability.name}` : `classAbilities:shared:${ability.name}`;
   const id = deterministicId(seed);
   return {
      folder: CLASS_ABILITIES_FOLDER_ID,
      name: ability.name,
      _id: id,
      img: "icons/svg/upgrade.svg",
      effects: [],
      ownership: { default: 0 },
      flags: {},
      _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      _originalKey: `!items!${id}`,
      type: "specialAbility",
      system: {
         tags: [],
         description: ability.description,
         gm: { notes: "" },
         rollFormula: "",
         operator: "",
         target: "",
         rollMode: "publicroll",
         autoSuccess: null,
         autoFail: null,
         abilityMod: "",
         savingThrow: null,
         dmgFormula: null,
         healFormula: null,
         damageType: "",
         category: "class",
         shortName: "",
         combatManeuver: null,
         customSaveCode: null,
         classKey: ability.classKey,
         showResult: true,
         quantity: 1,
         quantityMax: null,
         conditions: [],
      },
   };
}

/**
 * Expand one parsed ability record into classDefinition.specialAbilities[]
 * entries for the granting class — one per level/tier.
 * @param {{name: string, levels: number[], changes: string[]|null}} record
 * @param {string} classKey
 * @returns {object[]}
 */
export function buildSpecialAbilityLinks(record, classKey) {
   return record.levels.map((level, i) => ({
      name: record.name,
      uuid: "",
      level,
      target: null,
      classKey,
      changes: record.changes ? record.changes[i] : "",
   }));
}

async function ensureClassAbilitiesFolder(foldersPath) {
   const folders = JSON.parse(await fs.readFile(foldersPath, "utf8"));
   const maxSort = Math.max(0, ...Object.values(folders).filter((f) => f.folder === null).map((f) => f.sort));
   const key = `!folders!${CLASS_ABILITIES_FOLDER_ID}`;
   if (!folders[key]) {
      folders[key] = {
         name: "Class Abilities", sorting: "a", folder: null, type: "Item",
         _id: CLASS_ABILITIES_FOLDER_ID, description: "", sort: maxSort + 100000,
         color: "#3c4a2f", flags: {},
         _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      };
      await fs.writeFile(foldersPath, JSON.stringify(folders, null, 2) + "\n", "utf8");
   }
}

async function main() {
   const parsedPath = path.join(process.cwd(), "extract", "parsed", "classAbilities.json");
   const { abilities, talentLinks } = JSON.parse(await fs.readFile(parsedPath, "utf8"));

   const foldersPath = path.join(process.cwd(), "packsrc", "items", "_folders.json");
   await ensureClassAbilitiesFolder(foldersPath);

   const seen = new Set();
   const abilityDocsDir = path.join(process.cwd(), "packsrc", "items", "Class_Abilities");
   await fs.mkdir(abilityDocsDir, { recursive: true });
   let abilityDocsWritten = 0;
   for (const record of abilities) {
      const ownerKey = record.shared ? null : record.classKey;
      const dedupeKey = ownerKey ? `${ownerKey}:${record.name}` : `shared:${record.name}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const doc = buildAbilityDocument({ name: record.name, description: record.description, classKey: ownerKey });
      await fs.writeFile(path.join(abilityDocsDir, splitFileName(`${ownerKey ?? "shared"}_${record.name}`)), JSON.stringify(doc, null, 2) + "\n", "utf8");
      abilityDocsWritten++;
   }

   const talentsDir = path.join(process.cwd(), "packsrc", "items", "Talents");
   const talentFiles = await fs.readdir(talentsDir);
   const talentNames = new Set();
   for (const f of talentFiles) {
      const doc = JSON.parse(await fs.readFile(path.join(talentsDir, f), "utf8"));
      talentNames.add(doc.name);
   }

   const classesDir = path.join(process.cwd(), "packsrc", "items", "Character_Classes");
   const classFiles = await fs.readdir(classesDir);
   const classDocsByKey = {};
   for (const f of classFiles) {
      const filePath = path.join(classesDir, f);
      const doc = JSON.parse(await fs.readFile(filePath, "utf8"));
      classDocsByKey[doc.system.key] = { doc, filePath };
   }

   // Reset before rebuilding — running the builder twice must not
   // duplicate entries (real bug found and fixed while verifying this
   // plan: without the reset, a second run doubled every class's
   // specialAbilities array).
   for (const { doc } of Object.values(classDocsByKey)) {
      doc.system.specialAbilities = [];
   }
   for (const record of abilities) {
      const { doc } = classDocsByKey[record.classKey];
      doc.system.specialAbilities.push(...buildSpecialAbilityLinks(record, record.classKey));
   }
   for (const [classKey, talentName, level] of talentLinks) {
      if (!talentNames.has(talentName)) throw new Error(`talent not found in packsrc/items/Talents: ${talentName}`);
      const { doc } = classDocsByKey[classKey];
      doc.system.specialAbilities.push({ name: talentName, uuid: "", level, target: null, classKey, changes: "" });
   }

   let classDocsUpdated = 0;
   for (const { doc, filePath } of Object.values(classDocsByKey)) {
      doc.system.specialAbilities.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
      await fs.writeFile(filePath, JSON.stringify(doc, null, 2) + "\n", "utf8");
      classDocsUpdated++;
   }

   console.log(`wrote ${abilityDocsWritten} class-ability document(s), updated ${classDocsUpdated} class document(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test scripts/build/classAbilities.test.mjs`
Expected: PASS, todos os testes verdes.

- [ ] **Step 5: Nota na doc de schema**

Em `docs/fantastic-depths-item-schema.md`, na seção `SpecialAbilityDataModel`
já existente (criada no domínio skills), adicionar uma nota ao campo
`category` listando os valores reais confirmados em uso neste projeto
até agora: `"talent"` (domínio skills) e `"class"` (este sub-projeto,
confirmado contra `src/utils/finder.ts` do fantastic-depths@4a8f2c8 —
não inventar outros valores como `"save"`/`"spellcasting"`, que também
existem no sistema real mas não são produzidos por este projeto).

- [ ] **Step 6: Commit**

```bash
git add scripts/build/classAbilities.mjs scripts/build/classAbilities.test.mjs \
   docs/fantastic-depths-item-schema.md
git commit -m "$(cat <<'EOF'
feat: add class abilities/talents builder and schema doc note

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Sv5Ek7ypXvkGSWgE9JosAY
EOF
)"
```

---

### Task 3: Rodar o pipeline completo, validar, e revisar por amostragem

**Files:**
- Create: `packsrc/items/Class_Abilities/*.json` (35 arquivos)
- Modify: `packsrc/items/Character_Classes/*.json` (os 10 já
  existentes, `specialAbilities[]` preenchido)
- Modify: `packsrc/items/_folders.json` (nova pasta)

**Interfaces:**
- Consumes: `node scripts/parse/classAbilities.mjs` (Task 1) e
  `node scripts/build/classAbilities.mjs` (Task 2), em sequência.
- Produces: o conteúdo final de `packsrc/items/Class_Abilities/**` e
  os 10 documentos de `packsrc/items/Character_Classes/**`
  atualizados, que fecham o critério de conclusão deste sub-projeto (e
  do domínio classes inteiro).

- [ ] **Step 1: Rodar parser e builder em sequência**

Run:
```bash
node scripts/parse/classAbilities.mjs
node scripts/build/classAbilities.mjs
```
Expected: `wrote 38 ability record(s), 22 talent link(s)` seguido de
`wrote 35 class-ability document(s), updated 10 class document(s)`,
sem exceção lançada. Se qualquer número divergir, pare e investigue —
não ajuste este plano pra bater com um resultado divergente sem
entender a causa primeiro.

- [ ] **Step 2: Confirmar a contagem e a idempotência**

Run: `find packsrc/items/Class_Abilities -name '*.json' | wc -l`
Expected: `35`.

Run: `python3 -c "import json; d=json.load(open('packsrc/items/Character_Classes/Fighter.json')); print(len(d['system']['specialAbilities']))"`
Expected: `8` (Parry, Power Attack, Chivalric Vows, Warden, Warlord,
Multi-attack×3).

Rode o builder DE NOVO (`node scripts/build/classAbilities.mjs`) e
repita a checagem acima — o número deve continuar `8`, não `16`
(confirma o fix de idempotência das Global Constraints).

- [ ] **Step 3: Rodar o validador**

Run: `npm run validate`
Expected: `✓ items: <N> document(s), no errors` e `validate: all packs
OK` — exit code 0.

- [ ] **Step 4: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes passam.

- [ ] **Step 5: Amostragem manual**

Run:
```bash
cat packsrc/items/Class_Abilities/fighter_Multi-attack.json
cat packsrc/items/Class_Abilities/shared_Breath_Evasion.json
cat packsrc/items/Class_Abilities/fighter_Chivalric_Vows.json
python3 -c "import json; d=json.load(open('packsrc/items/Character_Classes/Thief.json')); print(len(d['system']['specialAbilities'])); [print(a) for a in d['system']['specialAbilities']]"
python3 -c "import json; d=json.load(open('packsrc/items/Character_Classes/Cleric.json')); print(d['system']['specialAbilities'])"
```
Expected: `fighter_Multi-attack.json` tem `category: "class"`,
`classKey: "fighter"`. `shared_Breath_Evasion.json` tem `classKey:
null`. `fighter_Chivalric_Vows.json` tem descrição substancial
(menciona Detect Evil/Turn Undead como parte dos benefícios).
`Thief.json` tem 12 entradas em `specialAbilities` (8 talentos no
nível 1, Read Languages no 4, Wizard Scroll Use no 10, Sneak Attack no
1, Breath Evasion no 16). `Cleric.json` tem só 1 entrada (Turn Undead,
nível 1).

Run: `cat packsrc/items/_folders.json | grep -c '"type": "Item"'`
Expected: valor anterior (35, de equipment/weaponMastery/spells/skills/
classes-core) + 1 (`Class Abilities`) = `36`.

- [ ] **Step 6: Commit**

```bash
git add extract/parsed/classAbilities.json packsrc/items/Class_Abilities \
   packsrc/items/Character_Classes packsrc/items/_folders.json
git commit -m "$(cat <<'EOF'
feat: link class special abilities and talents from chapter 4

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Sv5Ek7ypXvkGSWgE9JosAY
EOF
)"
```

Este commit fecha o critério de conclusão do domínio classes inteiro
(os dois sub-projetos): as 10 classes têm `levels`/`saves`/`spells`/
`primeReqs` (sub-projeto 1) e `specialAbilities[]` (este sub-projeto)
preenchidos, `npm run validate` passa sem erros.

---

## Fim do domínio classes

Domínio classes completo (2 sub-projetos: Tabela Núcleo + Habilidades
e Talentos). Próximo domínio, por ordem do spec geral: nenhum restante
além do bestiário (cap. 19), explicitamente adiado pelo usuário. Um PR
combinado (`phase-2-pdf-extraction` → `master`) pode ser considerado
agora que todos os domínios planejados (exceto o bestiário) estão
completos — decisão do usuário, não deste plano.
