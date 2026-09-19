# fade-retro-compendiums — Fase 3, sub-projeto Classes (Tabela Núcleo) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o pipeline parser → `extract/parsed` → builder para a
parte tabular do subtipo `class` (10 classes do cap. 4:
`levels[]`, `saves[]`, `spells[][]`, `primeReqs`, identidade básica),
produzindo `packsrc/items/Character_Classes/*.json` prontos para
`npm run validate`.

**Architecture:** `scripts/parse/classesCore.mjs` lê
`extract/raw/creating-a-character.txt` inteiro e, usando uma tabela de
configuração fixa por classe (10 entradas — cada classe tem seu
próprio layout de tabela, catalogado na spec), extrai a Table N–Xa
(progressão por nível + recurso específico), a Table N–Xb (saves), a
Table 4-1 (prime ability), e a prosa introdutória de cada classe,
produzindo `extract/parsed/classesCore.json`. `scripts/build/classesCore.mjs`
mapeia esse JSON pro schema real `ClassDefinitionDataModel`.

**Tech Stack:** Node.js (ESM), `node:test`, `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-09-18-fase3-classes-core-design.md`
(e o spec geral, seção 4)

## Global Constraints

- Fonte única: `extract/raw/creating-a-character.txt` (2748 linhas,
  cap. 4 inteiro).
- **Cada uma das 10 classes tem seu próprio layout de coluna** — não
  existe uma tabela universal. Catalogado e verificado por extração
  real (36/36 níveis, 36/36 saves, 10/10 prime abilities, todos os
  valores conferidos contra o livro):

  | Classe | Recurso extra | Círculos de magia |
  |---|---|---|
  | Battlemage | spells | 9 |
  | Cleric | spells | 7 |
  | Druid | spells | 7 |
  | Fighter | nenhum | 0 |
  | Grenadier | powder (valor composto "N grain(s)") | 0 |
  | Mountebank | spells | 8 |
  | Mystic | martial (5 colunas: Armour Class/Move/Unarmed Attacks/Unarmed Damage/Unarmed Hit As) | 0 |
  | Ranger | nenhum | 0 |
  | Thief | nenhum | 0 |
  | Wizard | spells | 9 |

- **Regex de linha de nível precisa de `\s*` (não `\s+`) no final** —
  achado real: várias linhas não têm texto de "Abilities" depois do
  Attack Bonus (nada sobrando na linha), e `\s+` exigiria pelo menos um
  espaço; sem essa correção, Fighter/Ranger/Thief perderiam 35 dos 36
  níveis cada.
- **Grenadier tem valor de recurso composto** (`"1 grain"`,
  `"26 grains"`, ou `"–"`) — usa regex próprio
  (`/^(–|\d+ grains?)/`) em vez de tokenização por contagem de coluna;
  confirmado sem exceção nas 36 linhas reais.
- **`thac0` (THAC0 clássico) NUNCA é escrito** — o livro só imprime a
  coluna "Attack Bonus" ascendente, que vira `thbonus`. `thac0` fica
  omitido do objeto de cada nível, deixando o schema aplicar seu
  próprio default (`CONFIG.FADE.ToHit.baseTHAC0`) na importação.
- **Sem mecânica de bônus de XP por prime requisite neste livro** —
  `primeReqs` = `[{ ability, minScore: 0, percentage: 5, concatLogic:
  null }]`, um elemento por classe, derivado só da Table 4-1.
- **`saves` não tem sub-schema fixo no schema real** (é um
  `ArrayField(ObjectField)` genérico) — cada entrada é transcrita
  diretamente como `{ level, doom, ray, stasis, blast, spell }`, as 5
  colunas reais de toda Table N–Xb.
- **`hdcon` é sempre `true`** — o cap de bônus de constituição pós-9º
  nível já está embutido na própria string de HD impressa (ex.:
  Battlemage nível 9 = `"38+9c"`, nível 10 = `"39+9c"`, o coeficiente
  do `c` já para de crescer), o booleano não precisa sinalizar nada.
- **`title`/`femaleTitle`/`attackRank` ficam sempre `null`** — nenhuma
  das 10 tabelas tem coluna de título por nível.
- **`basicProficiency` confirmado por leitura das 10 prosas de
  "Equipment Restrictions" completas** (busca exaustiva, não amostra):
  `true` pra Battlemage/Fighter/Grenadier/Ranger (acesso irrestrito a
  armas); `false` pra Cleric/Druid/Mountebank/Mystic/Thief/Wizard
  (alguma restrição de trait/tipo de arma).
- **`alignment` é sempre `"Any"`** — busca exaustiva por "alignment" no
  capítulo inteiro deu zero ocorrências; nenhuma classe tem restrição.
- **Recurso sem campo no schema real (Powder do Grenadier, martial arts
  do Mystic) vira tabela HTML dentro de `description`** — nunca
  descartado silenciosamente, mesmo sem automação do sistema pra
  consumir esse dado.
- **`description` extrai só a coluna esquerda de cada linha** (regex
  `/^(.*?)\s{5,}\S/`, mesmo padrão de merge de coluna já visto em
  domínios anteriores) — a coluna direita (seção "ABILITIES", "Equipment
  Restrictions", "Saves:") é descartada, fora de escopo deste
  sub-projeto (fica pro sub-projeto 2).
- **Cabeçalho "ABILITIES" tem duas grafias reais no livro** —
  `"<CLASSE> ABILITIES (SEE TABLE N–Xa)"` pras 5 primeiras classes,
  `"<CLASSE> ABILITIES (TABLE N–Xa)"` (sem "SEE") pras outras 5 — não é
  usado neste sub-projeto (fica pro sub-projeto 2), mas documentado
  aqui porque afeta onde a Task de implementação do sub-projeto 2 vai
  precisar procurar.
- `_id` determinístico: `sha1("classes:" + key)`, truncado pelo mesmo
  `ID_ALPHABET`/algoritmo já usado em todos os domínios anteriores
  (reimplementação independente, sem import cruzado).
- Pasta `Character_Classes/` é top-level, hand-picked em
  `_folders.json` (10 documentos, volume pequeno).
- `specialAbilities`/`classItems` ficam `[]` neste sub-projeto — o
  sub-projeto 2 os preenche num commit POSTERIOR sobre o MESMO
  documento (mesmo `_id` determinístico, não recriado do zero).
- Os testes do Task 1 rodam contra o **arquivo real**
  (`extract/raw/creating-a-character.txt`, já commitado na Fase 2), não
  contra um fixture sintético — a variação estrutural entre as 10
  classes é grande o suficiente que um fixture pequeno teria alto risco
  de não expor um bug real que só aparece no texto completo (mesma
  lição já registrada nos domínios anteriores: sampling não é
  suficiente).

---

### Task 1: Parser — `scripts/parse/classesCore.mjs`

**Files:**
- Create: `scripts/parse/classesCore.mjs`
- Test: `scripts/parse/classesCore.test.mjs`

**Interfaces:**
- Consumes: `extract/raw/creating-a-character.txt` (já existe,
  commitado na Fase 2).
- Produces:
  - `parseClasses(rawText: string) -> ClassRecord[]`, 10 registros, um
    por classe:
    ```
    {
      key: string, name: string, primeAbility: string,
      basicProficiency: boolean, circleCount: number,
      levels: { level, xp, hd, thbonus }[],  // 36 entradas
      spells: number[][],                     // 36 linhas, ou [] se circleCount=0
      saves: { level, doom, ray, stasis, blast, spell }[],  // 36 entradas
      description: string,                    // HTML, <p> por parágrafo
      resourceTable: string | null,            // HTML de tabela, só Grenadier/Mystic
    }
    ```
  - Um CLI (`node scripts/parse/classesCore.mjs`) que lê o arquivo raw
    e escreve `extract/parsed/classesCore.json`.

- [ ] **Step 1: Escrever os testes do parser (falhando)**

Criar `scripts/parse/classesCore.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseClasses } from "./classesCore.mjs";
import fs from "node:fs";

const raw = fs.readFileSync("extract/raw/creating-a-character.txt", "utf8");
const records = parseClasses(raw);

test("parseClasses returns exactly 10 class records", () => {
   assert.equal(records.length, 10);
});

test("every class has exactly 36 levels and 36 saves entries", () => {
   for (const r of records) {
      assert.equal(r.levels.length, 36, r.key);
      assert.equal(r.saves.length, 36, r.key);
   }
});

test("caster classes have a spells array of 36 rows matching their circle count", () => {
   const casters = records.filter((r) => r.circleCount > 0);
   assert.equal(casters.length, 5);
   for (const r of casters) {
      assert.equal(r.spells.length, 36, r.key);
      for (const row of r.spells) assert.equal(row.length, r.circleCount, r.key);
   }
});

test("non-caster classes have an empty spells array", () => {
   const nonCasters = records.filter((r) => r.circleCount === 0);
   assert.equal(nonCasters.length, 5);
   for (const r of nonCasters) assert.deepEqual(r.spells, []);
});

test("Battlemage level 1 and level 9 match the real book values", () => {
   const bm = records.find((r) => r.key === "battlemage");
   assert.deepEqual(bm.levels[0], { level: 1, xp: 0, hd: "6+c", thbonus: 1 });
   assert.deepEqual(bm.spells[0], [1, 0, 0, 0, 0, 0, 0, 0, 0]);
   assert.deepEqual(bm.saves[0], { level: 1, doom: 7, ray: 6, stasis: 7, blast: 4, spell: 5 });
   assert.deepEqual(bm.levels[8], { level: 9, xp: 400000, hd: "38+9c", thbonus: 4 });
   assert.deepEqual(bm.spells[8], [3, 3, 2, 2, 1, 0, 0, 0, 0]);
});

test("Grenadier's compound powder resource is parsed with its unit text intact", () => {
   const gr = records.find((r) => r.key === "grenadier");
   assert.equal(gr.spells.length, 0);
   assert.match(gr.resourceTable, /1 grain</);
   assert.match(gr.resourceTable, /250 grains</);
});

test("Mystic's 5 martial-arts columns are captured per level", () => {
   const my = records.find((r) => r.key === "mystic");
   assert.match(my.resourceTable, /Armour Class/);
   assert.match(my.resourceTable, /Unarmed Hit As/);
});

test("all 10 prime abilities match Table 4-1", () => {
   const byKey = Object.fromEntries(records.map((r) => [r.key, r.primeAbility]));
   assert.deepEqual(byKey, {
      battlemage: "int", cleric: "wis", druid: "wis", fighter: "str",
      grenadier: "dex", mountebank: "cha", mystic: "str", ranger: "dex",
      thief: "dex", wizard: "int",
   });
});

test("basicProficiency matches the Equipment Restrictions rulings", () => {
   const byKey = Object.fromEntries(records.map((r) => [r.key, r.basicProficiency]));
   assert.deepEqual(byKey, {
      battlemage: true, cleric: false, druid: false, fighter: true,
      grenadier: true, mountebank: false, mystic: false, ranger: true,
      thief: false, wizard: false,
   });
});

test("no description or resource table leaks a page marker or column-merge gap", () => {
   for (const r of records) {
      assert.doesNotMatch(r.description, /--- page/);
      assert.doesNotMatch(r.description, /\S {5,}\S/);
      if (r.resourceTable) {
         assert.doesNotMatch(r.resourceTable, /--- page/);
      }
   }
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test scripts/parse/classesCore.test.mjs`
Expected: FAIL — `Cannot find module './classesCore.mjs'`.

- [ ] **Step 3: Implementar `scripts/parse/classesCore.mjs`**

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLASS_CONFIG = [
   { name: "BATTLEMAGE", key: "battlemage", resource: "spells", circles: 9, basicProficiency: true },
   { name: "CLERIC", key: "cleric", resource: "spells", circles: 7, basicProficiency: false },
   { name: "DRUID", key: "druid", resource: "spells", circles: 7, basicProficiency: false },
   { name: "FIGHTER", key: "fighter", resource: "none", basicProficiency: true },
   { name: "GRENADIER", key: "grenadier", resource: "powder", basicProficiency: true },
   { name: "MOUNTEBANK", key: "mountebank", resource: "spells", circles: 8, basicProficiency: false },
   { name: "MYSTIC", key: "mystic", resource: "martial", basicProficiency: false },
   { name: "RANGER", key: "ranger", resource: "none", basicProficiency: true },
   { name: "THIEF", key: "thief", resource: "none", basicProficiency: false },
   { name: "WIZARD", key: "wizard", resource: "spells", circles: 9, basicProficiency: false },
];

const ABILITY_MAP = { Strength: "str", Intelligence: "int", Wisdom: "wis", Dexterity: "dex", Constitution: "con", Charisma: "cha" };
const MARTIAL_LABELS = ["Armour Class", "Move", "Unarmed Attacks", "Unarmed Damage", "Unarmed Hit As"];

// Same pdftotext-specific page-break shape already handled in the
// spells/skillsAndTalents domains (footer number optional).
function stripPageBoundaries(text) {
   return text
      .replace(/\f/g, "")
      .replace(/\n[ \t]*\n*(?:[ \t]*\d{1,4}[ \t]*\n[ \t]*\n*)?--- page \d+ ---\n/g, "\n");
}

// Keep only the left column of a two-column line (wide-gap merge,
// same degradation class documented across this project) — the right
// column here is the "ABILITIES" section, out of scope for this
// sub-project.
function leftColumnOnly(line) {
   const m = line.match(/^(.*?)\s{5,}\S/);
   return m ? m[1] : line;
}

function paragraphsToHtml(text) {
   const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.split("\n").map(leftColumnOnly).map((l) => l.trim()).filter(Boolean).join(" ").trim())
      .filter(Boolean);
   return paragraphs.map((p) => `<p>${p}</p>`).join("");
}

function parsePrimeAbilities(rawText) {
   const start = rawText.indexOf("Table 4–1: Prime Ability Scores");
   const end = rawText.indexOf("(the modifier");
   const lines = rawText.slice(start, end).split("\n").map((l) => l.trim()).filter(Boolean);
   const map = {};
   for (const line of lines) {
      for (const cfg of CLASS_CONFIG) {
         const className = cfg.key[0].toUpperCase() + cfg.key.slice(1);
         if (line.startsWith(className)) {
            const abilityWord = line.slice(className.length).trim();
            map[cfg.key] = ABILITY_MAP[abilityWord];
         }
      }
   }
   return map;
}

function parseLevelsTable(body, cfg) {
   const lines = stripPageBoundaries(body).split("\n");
   const levels = [];
   const resourceRows = [];
   let i = 0;
   while (levels.length < 36 && i < lines.length) {
      const line = lines[i];
      const m = line.match(/^\s*(\d{1,2})\s+([\d,]+)\s+(\d+\+\d*c)\s+([+\-]?\d+)\s*(.*)$/);
      if (m && Number(m[1]) === levels.length + 1) {
         const level = Number(m[1]);
         const xp = Number(m[2].replace(/,/g, ""));
         const hd = m[3];
         const thbonus = Number(m[4]);
         const rest = m[5].trim();
         levels.push({ level, xp, hd, thbonus });

         if (cfg.resource === "spells") {
            const tokens = rest.split(/\s+/).filter(Boolean).slice(0, cfg.circles);
            resourceRows.push(tokens.map((t) => (t === "–" ? 0 : Number(t))));
         } else if (cfg.resource === "powder") {
            const gm = rest.match(/^(–|\d+ grains?)/);
            resourceRows.push(gm[1]);
         } else if (cfg.resource === "martial") {
            const tokens = rest.split(/\s+/).filter(Boolean).slice(0, 5);
            resourceRows.push(tokens);
         }
      }
      i++;
   }
   return { levels, resourceRows };
}

function parseSavesTable(body) {
   const lines = stripPageBoundaries(body).split("\n");
   const saves = [];
   let i = 0;
   while (saves.length < 36 && i < lines.length) {
      const line = lines[i];
      const m = line.match(/^\s*(\d{1,2})\s+([+\-]?\d+)\s+([+\-]?\d+)\s+([+\-]?\d+)\s+([+\-]?\d+)\s+([+\-]?\d+)\s*$/);
      if (m && Number(m[1]) === saves.length + 1) {
         saves.push({
            level: Number(m[1]), doom: Number(m[2]), ray: Number(m[3]),
            stasis: Number(m[4]), blast: Number(m[5]), spell: Number(m[6]),
         });
      }
      i++;
   }
   return saves;
}

function buildResourceTableHtml(cfg, resourceRows) {
   if (cfg.resource === "powder") {
      const rows = resourceRows.map((v, idx) => `<tr><td>${idx + 1}</td><td>${v}</td></tr>`).join("");
      return `<p>Powder Refinement por nível (referência, não usado por automação do sistema):</p><table><tr><th>Level</th><th>Powder Refinement</th></tr>${rows}</table>`;
   }
   if (cfg.resource === "martial") {
      const header = MARTIAL_LABELS.map((l) => `<th>${l}</th>`).join("");
      const rows = resourceRows.map((cols, idx) => `<tr><td>${idx + 1}</td>${cols.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
      return `<p>Enhanced Martial Arts Abilities por nível (referência, não usado por automação do sistema):</p><table><tr><th>Level</th>${header}</tr>${rows}</table>`;
   }
   return null;
}

/**
 * Parse the 10 character classes of chapter 4 into class records. Each
 * class has its own table layout (see CLASS_CONFIG) — there is no
 * universal column schema across classes.
 * @param {string} rawText - full contents of extract/raw/creating-a-character.txt
 * @returns {object[]}
 */
export function parseClasses(rawText) {
   const primeAbilities = parsePrimeAbilities(rawText);
   const records = [];
   for (const cfg of CLASS_CONFIG) {
      const nameIdx = rawText.indexOf(`\n${cfg.name}\n`);
      const savesTitleIdx = rawText.indexOf(`${cfg.key[0].toUpperCase()}${cfg.key.slice(1)} Saves by Level`, nameIdx);
      const levelsSection = rawText.slice(nameIdx, savesTitleIdx);
      const { levels, resourceRows } = parseLevelsTable(levelsSection, cfg);

      const nextClassIdxs = CLASS_CONFIG.map((c) => rawText.indexOf(`\n${c.name}\n`, savesTitleIdx)).filter((x) => x > -1);
      const sectionEnd = nextClassIdxs.length ? Math.min(...nextClassIdxs) : rawText.length;
      const savesSection = rawText.slice(savesTitleIdx, sectionEnd);
      const saves = parseSavesTable(savesSection);

      const stripped = stripPageBoundaries(levelsSection).split("\n");
      let lastLevelLineIdx = -1;
      for (let i = 0; i < stripped.length; i++) {
         if (/^\s*36\s+[\d,]+\s+\d+\+\d*c/.test(stripped[i])) lastLevelLineIdx = i;
      }
      const description = paragraphsToHtml(stripped.slice(lastLevelLineIdx + 1).join("\n"));
      const resourceTable = buildResourceTableHtml(cfg, resourceRows);

      records.push({
         key: cfg.key,
         name: cfg.key[0].toUpperCase() + cfg.key.slice(1),
         primeAbility: primeAbilities[cfg.key],
         basicProficiency: cfg.basicProficiency,
         circleCount: cfg.circles ?? 0,
         levels,
         spells: cfg.resource === "spells" ? resourceRows : [],
         saves,
         description,
         resourceTable,
      });
   }
   return records;
}

async function main() {
   const rawPath = path.join(process.cwd(), "extract", "raw", "creating-a-character.txt");
   const rawText = await fs.readFile(rawPath, "utf8");
   const records = parseClasses(rawText);
   const outPath = path.join(process.cwd(), "extract", "parsed", "classesCore.json");
   await fs.writeFile(outPath, JSON.stringify(records, null, 2) + "\n", "utf8");
   console.log(`wrote ${records.length} class record(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test scripts/parse/classesCore.test.mjs`
Expected: PASS, todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add scripts/parse/classesCore.mjs scripts/parse/classesCore.test.mjs
git commit -m "$(cat <<'EOF'
feat: add classes core parser (levels/saves/spells/primeReqs)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Sv5Ek7ypXvkGSWgE9JosAY
EOF
)"
```

---

### Task 2: Builder — `scripts/build/classesCore.mjs`

**Files:**
- Create: `scripts/build/classesCore.mjs`
- Test: `scripts/build/classesCore.test.mjs`
- Modify: `scripts/extract/validate.mjs` (adicionar `class` a
  `SUBTYPE_REQUIRED_FIELDS`)
- Modify: `scripts/extract/validate.test.mjs` (teste de integração real)
- Modify: `docs/fantastic-depths-item-schema.md` (adicionar seção
  `ClassDefinitionDataModel`)
- Modify: `packsrc/items/_folders.json` (adicionar pasta `Character
  Classes`, top-level)

**Interfaces:**
- Consumes: `extract/parsed/classesCore.json` (Task 1, array de
  `ClassRecord` — mesma forma documentada no Task 1 "Produces").
- Produces:
  - `deterministicId(seed: string) -> string` (mesma função dos
    domínios anteriores, reimplementada aqui).
  - `buildDocument(record: ClassRecord) -> object` (documento Item
    `class` pronto pra `JSON.stringify`).
  - Um CLI (`node scripts/build/classesCore.mjs`) que lê
    `extract/parsed/classesCore.json`, garante (idempotente) a pasta
    `Character Classes` em `packsrc/items/_folders.json`, e escreve um
    arquivo por classe em `packsrc/items/Character_Classes/`.

**Campos obrigatórios reais do schema `class`** (confirmar contra
`ClassDefinitionDataModel.ts`, Forelius/fantastic-depths@4a8f2c8, os
`required: true` de nível superior, EXCLUINDO `abilities` — esse campo
é atribuído dinamicamente via `game.fade.registry` em runtime do
Foundry, não é algo que o builder deste projeto consiga ou precise
popular estaticamente): `key`, `species`, `firstLevel`, `maxLevel`,
`firstSpellLevel`, `maxSpellLevel`, `basicProficiency`,
`unskilledToHitMod`, `primeReqs`, `levels`, `saves`.

- [ ] **Step 1: Escrever os testes do builder (falhando)**

Criar `scripts/build/classesCore.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, buildDocument } from "./classesCore.mjs";

const SAMPLE_RECORD = {
   key: "battlemage", name: "Battlemage", primeAbility: "int", basicProficiency: true,
   circleCount: 9,
   levels: [{ level: 1, xp: 0, hd: "6+c", thbonus: 1 }],
   spells: [[1, 0, 0, 0, 0, 0, 0, 0, 0]],
   saves: [{ level: 1, doom: 7, ray: 6, stasis: 7, blast: 4, spell: 5 }],
   description: "<p>Battlemages learn magic.</p>",
   resourceTable: null,
};

test("deterministicId matches the 16-char alphanumeric ID pattern", () => {
   assert.match(deterministicId("classes:battlemage"), /^[a-zA-Z0-9]{16}$/);
});

test("deterministicId is stable across calls", () => {
   assert.equal(deterministicId("classes:battlemage"), deterministicId("classes:battlemage"));
});

test("buildDocument maps the basic class identity fields", () => {
   const doc = buildDocument(SAMPLE_RECORD);
   assert.equal(doc.type, "class");
   assert.equal(doc.name, "Battlemage");
   assert.equal(doc.system.key, "battlemage");
   assert.equal(doc.system.species, "Human");
   assert.equal(doc.system.firstLevel, 1);
   assert.equal(doc.system.maxLevel, 36);
   assert.equal(doc.system.maxSpellLevel, 9);
   assert.equal(doc.system.basicProficiency, true);
   assert.equal(doc.system.alignment, "Any");
});

test("buildDocument maps primeReqs from primeAbility", () => {
   const doc = buildDocument(SAMPLE_RECORD);
   assert.deepEqual(doc.system.primeReqs, [{ ability: "int", minScore: 0, percentage: 5, concatLogic: null }]);
});

test("buildDocument maps levels without a thac0 override, leaving it at the schema default", () => {
   const doc = buildDocument(SAMPLE_RECORD);
   assert.deepEqual(doc.system.levels[0], {
      level: 1, xp: 0, thbonus: 1, hd: "6+c", hdcon: true,
      title: null, femaleTitle: null, attackRank: null,
   });
   assert.equal("thac0" in doc.system.levels[0], false);
});

test("buildDocument copies saves entries verbatim", () => {
   const doc = buildDocument(SAMPLE_RECORD);
   assert.deepEqual(doc.system.saves[0], { level: 1, doom: 7, ray: 6, stasis: 7, blast: 4, spell: 5 });
});

test("buildDocument copies the spells 2D array for a caster", () => {
   const doc = buildDocument(SAMPLE_RECORD);
   assert.deepEqual(doc.system.spells, [[1, 0, 0, 0, 0, 0, 0, 0, 0]]);
});

test("buildDocument gives a non-caster an empty spells array and maxSpellLevel 0", () => {
   const doc = buildDocument({ ...SAMPLE_RECORD, key: "fighter", name: "Fighter", circleCount: 0, spells: [] });
   assert.deepEqual(doc.system.spells, []);
   assert.equal(doc.system.maxSpellLevel, 0);
});

test("buildDocument appends the resource table to description when present", () => {
   const doc = buildDocument({ ...SAMPLE_RECORD, resourceTable: "<p>extra</p>" });
   assert.equal(doc.system.description, "<p>Battlemages learn magic.</p><p>extra</p>");
});

test("buildDocument leaves specialAbilities and classItems empty (sub-project 2 scope)", () => {
   const doc = buildDocument(SAMPLE_RECORD);
   assert.deepEqual(doc.system.specialAbilities, []);
   assert.deepEqual(doc.system.classItems, []);
});

test("buildDocument is idempotent: same record produces byte-identical output twice", () => {
   assert.deepEqual(buildDocument(SAMPLE_RECORD), buildDocument(SAMPLE_RECORD));
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test scripts/build/classesCore.test.mjs`
Expected: FAIL — `Cannot find module './classesCore.mjs'`.

- [ ] **Step 3: Implementar `scripts/build/classesCore.mjs`**

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

const CLASSES_FOLDER_ID = deterministicIdInternal("folders:Character Classes");

/**
 * Derive a stable 16-char alphanumeric Foundry-style _id from a seed
 * string. Independent copy of the equipment/weapons/weaponMastery/
 * spells/skillsAndTalents domains' function of the same name/shape —
 * no cross-module import.
 * @param {string} seed
 * @returns {string}
 */
export function deterministicId(seed) {
   return deterministicIdInternal(seed);
}

function splitFileName(name) {
   const sanitized = name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
   return `${sanitized}.json`;
}

/**
 * Map one parsed class record (Task 1 shape) to a Foundry `class` Item
 * document (ClassDefinitionDataModel). specialAbilities/classItems are
 * left empty — populated by the "habilidades e talentos" sub-project
 * in a later commit over the same document (same deterministic _id).
 * @param {object} record
 * @returns {object}
 */
export function buildDocument(record) {
   const id = deterministicId(`classes:${record.key}`);
   const description = record.resourceTable ? record.description + record.resourceTable : record.description;

   const levels = record.levels.map((l) => ({
      level: l.level,
      xp: l.xp,
      thbonus: l.thbonus,
      hd: l.hd,
      hdcon: true,
      title: null,
      femaleTitle: null,
      attackRank: null,
   }));

   const saves = record.saves.map((s) => ({ ...s }));

   return {
      folder: CLASSES_FOLDER_ID,
      name: record.name,
      _id: id,
      img: "icons/svg/upgrade.svg",
      effects: [],
      ownership: { default: 0 },
      flags: {},
      _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      _originalKey: `!items!${id}`,
      type: "class",
      system: {
         key: record.key,
         species: "Human",
         firstLevel: 1,
         maxLevel: 36,
         firstSpellLevel: 1,
         maxSpellLevel: record.circleCount,
         basicProficiency: record.basicProficiency,
         unskilledToHitMod: -2,
         alignment: "Any",
         description,
         castAsKey: null,
         primeReqs: [{ ability: record.primeAbility, minScore: 0, percentage: 5, concatLogic: null }],
         levels,
         saves,
         spells: record.spells,
         specialAbilities: [],
         classItems: [],
      },
   };
}

async function ensureClassesFolder(foldersPath) {
   const folders = JSON.parse(await fs.readFile(foldersPath, "utf8"));
   const maxSort = Math.max(0, ...Object.values(folders)
      .filter((f) => f.folder === null)
      .map((f) => f.sort));
   const key = `!folders!${CLASSES_FOLDER_ID}`;
   if (!folders[key]) {
      folders[key] = {
         name: "Character Classes", sorting: "a", folder: null, type: "Item",
         _id: CLASSES_FOLDER_ID, description: "", sort: maxSort + 100000,
         color: "#4a2f3c", flags: {},
         _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      };
      await fs.writeFile(foldersPath, JSON.stringify(folders, null, 2) + "\n", "utf8");
   }
}

async function main() {
   const parsedPath = path.join(process.cwd(), "extract", "parsed", "classesCore.json");
   const records = JSON.parse(await fs.readFile(parsedPath, "utf8"));

   const foldersPath = path.join(process.cwd(), "packsrc", "items", "_folders.json");
   await ensureClassesFolder(foldersPath);

   const dir = path.join(process.cwd(), "packsrc", "items", "Character_Classes");
   await fs.mkdir(dir, { recursive: true });

   for (const record of records) {
      const doc = buildDocument(record);
      await fs.writeFile(path.join(dir, splitFileName(record.name)), JSON.stringify(doc, null, 2) + "\n", "utf8");
   }
   console.log(`wrote ${records.length} class document(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test scripts/build/classesCore.test.mjs`
Expected: PASS, todos os testes verdes.

- [ ] **Step 5: Adicionar o subtipo `class` ao validador**

Em `scripts/extract/validate.mjs`, dentro de `SUBTYPE_REQUIRED_FIELDS`,
adicionar (lista literalmente derivada dos `required: true` reais do
schema, seção "Campos obrigatórios reais" acima — NÃO por analogia com
outro domínio, lição herdada de um bug real do domínio spells):

```javascript
   class: ["key", "species", "firstLevel", "maxLevel", "firstSpellLevel", "maxSpellLevel", "basicProficiency", "unskilledToHitMod", "primeReqs", "levels", "saves"],
```

E adicione um teste de integração real em
`scripts/extract/validate.test.mjs` (mesmo padrão já usado nos domínios
anteriores — import direto de `buildDocument` de
`../build/classesCore.mjs`, seguido de `validateDocument()`, esperando
`[]` de erros, mais o caso "campo obrigatório faltando").

- [ ] **Step 6: Documentar o schema em `docs/fantastic-depths-item-schema.md`**

Adicionar uma seção `ClassDefinitionDataModel`, no mesmo formato das
seções existentes, listando os campos reais usados por este
sub-projeto (`key`, `species`, `firstLevel`, `maxLevel`,
`firstSpellLevel`, `maxSpellLevel`, `basicProficiency`,
`unskilledToHitMod`, `alignment`, `description`, `castAsKey`,
`primeReqs`, `levels[]`, `saves[]`, `spells[][]`) e notando que
`specialAbilities`/`classItems` existem no schema mas são populados
pelo sub-projeto "habilidades e talentos" (documentar como "usado
parcialmente" — não é a seção final, um comentário de futuro trabalho
é aceitável aqui já que reflete um sub-projeto já planejado, não uma
lacuna desconhecida). Notar explicitamente que `abilities` é um campo
dinâmico atribuído em runtime do Foundry (`game.fade.registry`), fora
do alcance de qualquer builder deste projeto.

- [ ] **Step 7: Commit**

```bash
git add scripts/build/classesCore.mjs scripts/build/classesCore.test.mjs \
   scripts/extract/validate.mjs scripts/extract/validate.test.mjs \
   docs/fantastic-depths-item-schema.md
git commit -m "$(cat <<'EOF'
feat: add classes core builder, validator subtype, and schema docs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Sv5Ek7ypXvkGSWgE9JosAY
EOF
)"
```

---

### Task 3: Rodar o pipeline completo, validar, e revisar por amostragem

**Files:**
- Create: `packsrc/items/Character_Classes/*.json` (10 arquivos)
- Modify: `packsrc/items/_folders.json` (nova pasta)

**Interfaces:**
- Consumes: `node scripts/parse/classesCore.mjs` (Task 1) e
  `node scripts/build/classesCore.mjs` (Task 2), em sequência.
- Produces: o conteúdo final de `packsrc/items/Character_Classes/**`,
  que fecha o critério de conclusão deste sub-projeto.

- [ ] **Step 1: Rodar parser e builder em sequência**

Run:
```bash
node scripts/parse/classesCore.mjs
node scripts/build/classesCore.mjs
```
Expected: `wrote 10 class record(s)` seguido de `wrote 10 class
document(s)`, sem exceção lançada. Se o número divergir de 10, pare e
investigue — não ajuste este plano pra bater com um resultado
divergente sem entender a causa primeiro.

- [ ] **Step 2: Confirmar a contagem**

Run: `find packsrc/items/Character_Classes -name '*.json' | wc -l`
Expected: `10`.

- [ ] **Step 3: Rodar o validador**

Run: `npm run validate`
Expected: `✓ items: <N> document(s), no errors` entre as linhas de
saída, e `validate: all packs OK` ao final — exit code 0.

- [ ] **Step 4: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes passam (incluindo os novos testes desta
feature e todos os testes pré-existentes de domínios anteriores).

- [ ] **Step 5: Amostragem manual**

Run:
```bash
cat packsrc/items/Character_Classes/Battlemage.json
cat packsrc/items/Character_Classes/Fighter.json
cat packsrc/items/Character_Classes/Grenadier.json
cat packsrc/items/Character_Classes/Mystic.json
```
Expected: `Battlemage.json` tem `primeReqs: [{ability: "int", ...}]`,
`maxSpellLevel: 9`, `levels[0]` com `hd: "6+c"`, `thbonus: 1`, e SEM
campo `thac0`; `spells[8]` (nível 9) = `[3,3,2,2,1,0,0,0,0]`.
`Fighter.json` tem `basicProficiency: true`, `spells: []`,
`maxSpellLevel: 0`. `Grenadier.json` tem `basicProficiency: true`,
`description` terminando numa tabela HTML com "1 grain"/"250 grains".
`Mystic.json` tem `basicProficiency: false`, `description` com tabela
HTML "Armour Class"/"Unarmed Hit As".

Run: `cat packsrc/items/_folders.json | grep -c '"type": "Item"'`
Expected: valor anterior (34, de equipment/weaponMastery/spells/skills)
+ 1 (`Character Classes`) = `35`.

- [ ] **Step 6: Commit**

```bash
git add extract/parsed/classesCore.json packsrc/items/Character_Classes packsrc/items/_folders.json
git commit -m "$(cat <<'EOF'
feat: generate Class items (core level/save/spell tables) from chapter 4

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Sv5Ek7ypXvkGSWgE9JosAY
EOF
)"
```

Este commit fecha o critério de conclusão deste sub-projeto:
`packsrc/items/Character_Classes/*.json` cobre as 10 classes com
`levels`/`saves`/`spells`/`primeReqs` preenchidos, `npm run validate`
passa sem erros.

---

## Fim do sub-projeto "Tabela Núcleo"

Próximo passo: o sub-projeto "Habilidades e Talentos" (a coluna de
texto "Abilities" de cada Table Na, `specialAbilities[]`, `classItems[]`,
os sub-caminhos de Fighter — Chevalier/Warden/Warlord — e a ligação com
os itens `specialAbility` já criados no domínio skills), com seu
próprio spec/plano. Escreve num commit POSTERIOR sobre os MESMOS 10
documentos gerados aqui (mesmo `_id` determinístico por classe) —
depende do resultado deste sub-projeto, não roda em paralelo.
