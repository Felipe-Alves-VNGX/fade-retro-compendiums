# fade-retro-compendiums — Fase 3, domínio Skills e Talentos — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o pipeline parser → `extract/parsed` → builder para os
subtipos `skill` (31 skills) e `specialAbility` (10 talentos) do cap. 5,
produzindo `packsrc/items/General_Skills/*.json` e
`packsrc/items/Talents/*.json` prontos para `npm run validate`.

**Architecture:** `scripts/parse/skillsAndTalents.mjs` lê
`extract/raw/skills-and-talents.txt` inteiro, extrai os 10 talentos da
seção "SKILLS & TALENTS" (delimitados por uma lista fixa de nomes
conhecidos, não detecção genérica) e as 31 skills da seção "ALPHABETIC
SKILL LISTING" (delimitadas por cabeçalho em CAIXA ALTA), produzindo
`extract/parsed/skillsAndTalents.json` com os dois arrays.
`scripts/build/skillsAndTalents.mjs` lê esse JSON e gera um documento
Foundry por talento (subtipo `specialAbility`) e por skill (subtipo
`skill`).

**Tech Stack:** Node.js (ESM), `node:test`, `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-09-18-fase3-skills-design.md` (e
o spec geral, seção 4 — nota: esta spec corrige o mapeamento de subtipo
único `skill` do spec geral para dois subtipos, `skill` + `specialAbility`)

## Global Constraints

- Fonte única: `extract/raw/skills-and-talents.txt` (1195 linhas, cap. 5
  inteiro).
- Verificado por extração real e exaustiva contra o arquivo inteiro:
  **exatamente 10 talentos** e **exatamente 31 skills**. Se o parser
  real produzir um número diferente, é regressão — não ajustar os
  números deste plano pra bater com um resultado divergente sem investigar
  a causa primeiro.
- **Dois subtipos, não um**: talentos → `specialAbility` (pasta
  `Talents/`), skills → `skill` (pasta `General_Skills/`) — correção ao
  spec geral, justificada na spec seção 1 (schema real do
  `SkillItemDataModel` modela mecânica de pontos investidos, que
  talentos não têm; `SpecialAbilityDataModel` já é o subtipo certo pra
  habilidade binária de classe).
- **Delimitação de talento por lista fixa**: os 10 nomes
  (`Open Locks`, `Locate Traps`, `Remove Traps`, `Climb Walls`,
  `Move Silently`, `Hide in Shadows`, `Pick Pockets`, `Hear Noise`,
  `Read Languages`, `Wizard Scroll Use`) são hard-coded no parser, não
  detectados por regex genérica de `"Palavra: "` — a seção contém um
  bloco `"Example:"` (dentro da descrição de "Locate Traps") que bateria
  numa detecção genérica e criaria um 11º talento falso.
- **Cabeçalho de skill**: regex `/^[A-Z][A-Z0-9 /()\-]+$/` (não só
  `/^[A-Z][A-Z ]+$/`) — 6 das 31 skills têm sufixo entre parênteses
  indicando escolha de especialização (`CRAFT (CHOOSE MEDIUM)`,
  `ETIQUETTE (CHOOSE CULTURE)`, `LANGUAGE (CHOOSE LANGUAGE)`,
  `LAWS (CHOOSE CULTURE)`, `PERFORMANCE (CHOSE MEDIUM)` — nota: erro de
  grafia real do livro, "CHOSE" em vez de "CHOOSE", transcrito
  verbatim — `RIDING (CHOOSE ANIMAL)`). O sufixo vira uma nota em
  `gm.notes`, não faz parte do `name` do item (`"CRAFT (CHOOSE MEDIUM)"`
  → nome `"Craft"`, nota "escolha de especialização").
- **Extração de `ability`**: regex aceita `"bonus to X checks"` E
  `"bonus on X rolls"` (Etiquette/First Aid/Navigating usam "rolls").
  Duas skills são duplo-ability (`"bonus to both X checks and Y
  checks"`): `Intimidation` (charisma + strength) e `Performance`
  (dexterity + charisma) — primeira ability vira `system.ability`,
  segunda vira nota em `gm.notes`. `Language` não tem nenhuma frase
  desse padrão (é uma "special skill" documentada no livro, sem bônus
  de ability check) — `system.ability` fica no default do schema
  (`"str"`, nunca de fato consultado) com nota explícita em `gm.notes`
  dizendo que é special skill.
- Mapeamento de nome de ability pro código de 3 letras do schema:
  `strength→str, intelligence→int, wisdom→wis, dexterity→dex,
  charisma→cha` (constitution não aparece em nenhuma skill do capítulo).
- `_id` determinístico: `sha1("skills:" + name)` / `sha1("talents:" +
  name)`, truncado pelo mesmo `ID_ALPHABET`/algoritmo já usado nos
  domínios anteriores (reimplementação independente, sem import
  cruzado).
- Pastas `General_Skills/` e `Talents/` são **top-level, hand-picked**
  em `packsrc/items/_folders.json` (volume pequeno, sem necessidade de
  resolução dinâmica como em `spells`).
- **Lista de campos obrigatórios do validador = literalmente os campos
  `required: true` do schema real, não uma lista inventada por
  analogia** (lição herdada de um bug real do domínio `spells`, onde
  `"name"` foi adicionado a `SUBTYPE_REQUIRED_FIELDS.spell` sem essa
  exigência existir no schema, e só foi pego na revisão final):
  - `SUBTYPE_REQUIRED_FIELDS.skill = ["ability", "targetFormula", "operator", "rollFormula", "level", "skillBonus", "skillPenalty"]`
  - `SUBTYPE_REQUIRED_FIELDS.specialAbility = []` (nenhum campo do
    schema real de `specialAbility` é `required: true` — a entrada
    existe só pra satisfazer o "unknown subtype" do validador).
- Campos sem dado do livro ficam nos valores neutros do schema real,
  escritos EXPLICITAMENTE pelo builder (não omitidos): ver a tabela
  completa de campos na spec, seção 5.

---

### Task 1: Parser — `scripts/parse/skillsAndTalents.mjs`

**Files:**
- Create: `scripts/parse/skillsAndTalents.mjs`
- Test: `scripts/parse/skillsAndTalents.test.mjs`

**Interfaces:**
- Consumes: `extract/raw/skills-and-talents.txt` (já existe, commitado
  na Fase 2).
- Produces:
  - `parseTalents(rawText: string) -> {name: string, description: string}[]`
    (10 registros).
  - `parseSkills(rawText: string) -> {name: string, ability: string|null, extraAbility: string|null, choiceNote: string|null, description: string}[]`
    (31 registros).
  - Um CLI (`node scripts/parse/skillsAndTalents.mjs`) que lê o arquivo
    raw e escreve `extract/parsed/skillsAndTalents.json` com o formato
    `{ "talents": [...], "skills": [...] }`.

- [ ] **Step 1: Escrever os testes do parser (falhando)**

Criar `scripts/parse/skillsAndTalents.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTalents, parseSkills } from "./skillsAndTalents.mjs";

const TALENTS_FIXTURE = `SKILLS & TALENTS
Some character classes have talents that they can use.

Open Locks: Characters without this talent can't attempt to
pick locks under normal circumstances.

Locate Traps: Normally, a character searches an area for traps.

Example: Black Leaf and Aloysius are standing some
distance from a suspicious looking vault door.

The Gameguide informs the players.

Remove Traps: When faced with knowledge that there is a
trap, characters without the Remove Traps talent must simply
describe to the Gameguide what they are doing.

Climb Walls: Any character can climb a tree.

Move Silently: Characters who are attempting to sneak past
someone must make a Sneak check.

Hide in Shadows: As with Move Silently, characters without
the Hide in Shadows talent may still attempt to hide.

Pick Pockets: Characters without this talent can't attempt
to pick pockets under normal circumstances.

Hear Noise: Any character can make a Spot check to listen
for quiet noises.

Read Languages: Characters without this talent can't
attempt to read text in languages they don't know.

Wizard Scroll Use: Characters without this talent can't use
wizard scrolls unless they have the ability to cast wizard spells.

ALPHABETIC SKILL LISTING
`;

test("parseTalents extracts exactly the 10 known talents in order", () => {
   const talents = parseTalents(TALENTS_FIXTURE);
   assert.equal(talents.length, 10);
   assert.deepEqual(talents.map((t) => t.name), [
      "Open Locks", "Locate Traps", "Remove Traps", "Climb Walls",
      "Move Silently", "Hide in Shadows", "Pick Pockets", "Hear Noise",
      "Read Languages", "Wizard Scroll Use",
   ]);
});

test("parseTalents does not treat an embedded 'Example:' block as a new talent", () => {
   const talents = parseTalents(TALENTS_FIXTURE);
   const locateTraps = talents.find((t) => t.name === "Locate Traps");
   assert.match(locateTraps.description, /Example: Black Leaf/);
   assert.equal(talents.some((t) => t.name === "Example"), false);
});

test("parseTalents wraps each paragraph of a description in <p>", () => {
   const talents = parseTalents(TALENTS_FIXTURE);
   const removeTraps = talents.find((t) => t.name === "Remove Traps");
   assert.match(removeTraps.description, /^<p>.*<\/p>$/);
});

const SKILLS_FIXTURE = `ALPHABETIC SKILL LISTING
ARCANE LORE
Each point spent on the arcane lore skill gives a +1 bonus to
intelligence checks made to recognise spells.

ETIQUETTE (CHOOSE CULTURE)
The etiquette skill is not a single skill. Each point spent in
the etiquette skill for a particular culture gives a +1 bonus
to charisma rolls used to behave properly in formal settings.

INTIMIDATION
Each point spent on the intimidation skill gives a +1 bonus
to both charisma checks and strength checks made to bully
an NPC into co-operation through threats.

LANGUAGE (CHOOSE LANGUAGE)
Each skill point spent on the language skill means that the
character knows another language to an acceptable level.

PERFORMANCE (CHOSE MEDIUM)
Each skill point spent on a specific performance skill gives
a +1 bonus to both dexterity checks and charisma checks
used to make these artistic performances.
`;

test("parseSkills extracts a simple single-ability skill", () => {
   const skills = parseSkills(SKILLS_FIXTURE);
   const arcaneLore = skills.find((s) => s.name === "Arcane Lore");
   assert.equal(arcaneLore.ability, "int");
   assert.equal(arcaneLore.extraAbility, null);
   assert.equal(arcaneLore.choiceNote, null);
});

test("parseSkills accepts 'bonus on X rolls' phrasing, not just 'bonus to X checks'", () => {
   const skills = parseSkills(SKILLS_FIXTURE);
   const etiquette = skills.find((s) => s.name === "Etiquette");
   assert.equal(etiquette.ability, "cha");
});

test("parseSkills captures a dual-ability skill's primary and extra ability", () => {
   const skills = parseSkills(SKILLS_FIXTURE);
   const intimidation = skills.find((s) => s.name === "Intimidation");
   assert.equal(intimidation.ability, "cha");
   assert.equal(intimidation.extraAbility, "str");
   const performance = skills.find((s) => s.name === "Performance");
   assert.equal(performance.ability, "dex");
   assert.equal(performance.extraAbility, "cha");
});

test("parseSkills leaves ability null for a special skill with no ability-check sentence (Language)", () => {
   const skills = parseSkills(SKILLS_FIXTURE);
   const language = skills.find((s) => s.name === "Language");
   assert.equal(language.ability, null);
   assert.equal(language.extraAbility, null);
});

test("parseSkills strips a (CHOOSE X) suffix from the name into choiceNote", () => {
   const skills = parseSkills(SKILLS_FIXTURE);
   const etiquette = skills.find((s) => s.name === "Etiquette");
   assert.equal(etiquette.choiceNote, "CHOOSE CULTURE");
   const language = skills.find((s) => s.name === "Language");
   assert.equal(language.choiceNote, "CHOOSE LANGUAGE");
});

test("parseSkills title-cases a multi-word ALL-CAPS header", () => {
   const skills = parseSkills(SKILLS_FIXTURE);
   assert.equal(skills.find((s) => s.name === "Arcane Lore").name, "Arcane Lore");
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test scripts/parse/skillsAndTalents.test.mjs`
Expected: FAIL — `Cannot find module './skillsAndTalents.mjs'`.

- [ ] **Step 3: Implementar `scripts/parse/skillsAndTalents.mjs`**

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TALENT_NAMES = [
   "Open Locks", "Locate Traps", "Remove Traps", "Climb Walls",
   "Move Silently", "Hide in Shadows", "Pick Pockets", "Hear Noise",
   "Read Languages", "Wizard Scroll Use",
];

const ABILITY_MAP = {
   strength: "str", intelligence: "int", wisdom: "wis",
   dexterity: "dex", charisma: "cha", constitution: "con",
};
const ABILITY_RE = /bonus\s+(?:to|on)\s+(?:both\s+)?(\w+)\s+(?:checks|rolls)(?:\s+and\s+(\w+)\s+checks)?/i;

/**
 * Join raw text into one `<p>` block per blank-line-separated
 * paragraph, continuation lines joined with a single space.
 * @param {string} text
 * @returns {string}
 */
function paragraphsToHtml(text) {
   const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean).join(" ").trim())
      .filter(Boolean);
   return paragraphs.map((p) => `<p>${p}</p>`).join("");
}

/**
 * Extract the 10 talents from the "SKILLS & TALENTS" section, using a
 * fixed name list as delimiters rather than generic "Word: " detection
 * — the section also contains an "Example:" block (inside "Locate
 * Traps"'s own description) that would otherwise be mistaken for an
 * 11th talent.
 * @param {string} rawText
 * @returns {{name: string, description: string}[]}
 */
export function parseTalents(rawText) {
   const startIdx = rawText.indexOf("SKILLS & TALENTS");
   const endIdx = rawText.indexOf("ALPHABETIC SKILL LISTING");
   const body = rawText.slice(startIdx, endIdx).replace(/\n--- page \d+ ---\n/g, "\n");

   const positions = TALENT_NAMES.map((name) => {
      const idx = body.indexOf(`${name}:`);
      if (idx === -1) throw new Error(`talent not found in source text: ${name}`);
      return { name, idx };
   }).sort((a, b) => a.idx - b.idx);

   return positions.map((pos, i) => {
      const contentStart = pos.idx + pos.name.length + 1;
      const contentEnd = i + 1 < positions.length ? positions[i + 1].idx : body.length;
      const raw = body.slice(contentStart, contentEnd);
      return { name: pos.name, description: paragraphsToHtml(raw) };
   });
}

/**
 * Extract the 31 skills from the "ALPHABETIC SKILL LISTING" section.
 * A header line is ALL-CAPS, optionally with a "(CHOOSE X)" suffix for
 * the 6 specialization-choice skills — that suffix is stripped from
 * the name and returned separately as `choiceNote`.
 * @param {string} rawText
 * @returns {{name: string, ability: string|null, extraAbility: string|null, choiceNote: string|null, description: string}[]}
 */
export function parseSkills(rawText) {
   const startIdx = rawText.indexOf("ALPHABETIC SKILL LISTING") + "ALPHABETIC SKILL LISTING".length;
   const body = rawText.slice(startIdx).replace(/\n--- page \d+ ---\n/g, "\n");
   const lines = body.split("\n");

   const headerRe = /^[A-Z][A-Z0-9 /()\-]+$/;
   const headers = [];
   for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() !== "" && headerRe.test(lines[i])) {
         headers.push({ line: i, raw: lines[i].trim() });
      }
   }

   return headers.map((h, i) => {
      const nextLine = i + 1 < headers.length ? headers[i + 1].line : lines.length;
      const content = lines.slice(h.line + 1, nextLine).join("\n");
      const description = paragraphsToHtml(content);

      const nameMatch = h.raw.match(/^([A-Z][A-Z0-9 /\-]*?)(?:\s*\(([^)]*)\))?$/);
      const name = nameMatch[1].trim().split(" ")
         .map((w) => w[0] + w.slice(1).toLowerCase())
         .join(" ");
      const choiceNote = nameMatch[2] || null;

      const abilityMatch = content.replace(/\n/g, " ").match(ABILITY_RE);
      const ability = abilityMatch ? (ABILITY_MAP[abilityMatch[1].toLowerCase()] ?? null) : null;
      const extraAbility = abilityMatch && abilityMatch[2]
         ? (ABILITY_MAP[abilityMatch[2].toLowerCase()] ?? null)
         : null;

      return { name, ability, extraAbility, choiceNote, description };
   });
}

async function main() {
   const rawPath = path.join(process.cwd(), "extract", "raw", "skills-and-talents.txt");
   const rawText = await fs.readFile(rawPath, "utf8");
   const talents = parseTalents(rawText);
   const skills = parseSkills(rawText);
   const outPath = path.join(process.cwd(), "extract", "parsed", "skillsAndTalents.json");
   await fs.writeFile(outPath, JSON.stringify({ talents, skills }, null, 2) + "\n", "utf8");
   console.log(`wrote ${talents.length} talent(s), ${skills.length} skill(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test scripts/parse/skillsAndTalents.test.mjs`
Expected: PASS, todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add scripts/parse/skillsAndTalents.mjs scripts/parse/skillsAndTalents.test.mjs
git commit -m "$(cat <<'EOF'
feat: add skills and talents parser

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Sv5Ek7ypXvkGSWgE9JosAY
EOF
)"
```

---

### Task 2: Builder — `scripts/build/skillsAndTalents.mjs`

**Files:**
- Create: `scripts/build/skillsAndTalents.mjs`
- Test: `scripts/build/skillsAndTalents.test.mjs`
- Modify: `scripts/extract/validate.mjs` (adicionar `skill` e
  `specialAbility` a `SUBTYPE_REQUIRED_FIELDS`)
- Modify: `docs/fantastic-depths-item-schema.md` (adicionar seções
  `SkillItemDataModel` e `SpecialAbilityDataModel`)
- Modify: `packsrc/items/_folders.json` (adicionar pastas `General
  Skills` e `Talents`, top-level)

**Interfaces:**
- Consumes: `extract/parsed/skillsAndTalents.json` (Task 1, forma
  `{ talents: Talent[], skills: Skill[] }` documentada no Task 1
  "Produces").
- Produces:
  - `deterministicId(seed: string) -> string` (mesma função dos
    domínios anteriores, reimplementada aqui).
  - `buildTalentDocument(talent: Talent) -> object` (documento Item
    `specialAbility`).
  - `buildSkillDocument(skill: Skill) -> object` (documento Item
    `skill`).
  - Um CLI (`node scripts/build/skillsAndTalents.mjs`) que lê o JSON do
    Task 1 e escreve um arquivo por talento em
    `packsrc/items/Talents/` e um por skill em
    `packsrc/items/General_Skills/`.

**IDs de pasta a usar** (hand-picked, seguindo o padrão já usado nos
domínios anteriores — próximos slots livres de `_folders.json`, que
hoje tem 5 pastas de `equipment`/`weaponMastery` mais 27 de `spells` =
32 entradas): gerar os IDs com
`deterministicId("folders:General Skills")` e
`deterministicId("folders:Talents")` (mesmo algoritmo do resto do
builder, aplicado ao nome da pasta em vez do nome de um item — garante
determinismo sem precisar hardcodar strings arbitrárias à mão).

- [ ] **Step 1: Escrever os testes do builder (falhando)**

Criar `scripts/build/skillsAndTalents.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, buildTalentDocument, buildSkillDocument } from "./skillsAndTalents.mjs";

test("deterministicId matches the 16-char alphanumeric ID pattern", () => {
   assert.match(deterministicId("skills:Balance"), /^[a-zA-Z0-9]{16}$/);
});

test("deterministicId is stable across calls", () => {
   assert.equal(deterministicId("skills:Balance"), deterministicId("skills:Balance"));
});

test("buildTalentDocument maps a talent to the specialAbility subtype", () => {
   const doc = buildTalentDocument({ name: "Climb Walls", description: "<p>Any character can climb a tree.</p>" });
   assert.equal(doc.type, "specialAbility");
   assert.equal(doc.name, "Climb Walls");
   assert.equal(doc.system.category, "talent");
   assert.equal(doc.system.description, "<p>Any character can climb a tree.</p>");
   assert.deepEqual(doc.system.tags, []);
   assert.equal(doc.system.rollFormula, "");
   assert.equal(doc.system.savingThrow, null);
});

test("buildSkillDocument maps a simple single-ability skill", () => {
   const doc = buildSkillDocument({
      name: "Arcane Lore", ability: "int", extraAbility: null, choiceNote: null,
      description: "<p>Gives a bonus to recognise spells.</p>",
   });
   assert.equal(doc.type, "skill");
   assert.equal(doc.system.ability, "int");
   assert.equal(doc.system.level, 1);
   assert.equal(doc.system.rollFormula, "1d20");
   assert.equal(doc.system.targetFormula, "@rollTarget");
   assert.equal(doc.system.operator, "lte");
   assert.equal(doc.system.skillBonus, 0);
   assert.equal(doc.system.skillPenalty, 0);
   assert.equal(doc.system.gm.notes, "");
});

test("buildSkillDocument records a dual-ability skill's extra ability in gm.notes", () => {
   const doc = buildSkillDocument({
      name: "Intimidation", ability: "cha", extraAbility: "str", choiceNote: null,
      description: "<p>Bully an NPC.</p>",
   });
   assert.equal(doc.system.ability, "cha");
   assert.match(doc.system.gm.notes, /str/);
});

test("buildSkillDocument records the special-skill case (no ability) in gm.notes and defaults ability to str", () => {
   const doc = buildSkillDocument({
      name: "Language", ability: null, extraAbility: null, choiceNote: "CHOOSE LANGUAGE",
      description: "<p>Knows another language.</p>",
   });
   assert.equal(doc.system.ability, "str");
   assert.match(doc.system.gm.notes, /Special skill/);
});

test("buildSkillDocument records a choiceNote (CHOOSE X skill) in gm.notes", () => {
   const doc = buildSkillDocument({
      name: "Craft", ability: "dex", extraAbility: null, choiceNote: "CHOOSE MEDIUM",
      description: "<p>Craft skill.</p>",
   });
   assert.match(doc.system.gm.notes, /escolha de especialização/);
});

test("buildSkillDocument is idempotent: same record produces byte-identical output twice", () => {
   const skill = {
      name: "Balance", ability: "dex", extraAbility: null, choiceNote: null,
      description: "<p>Keep one's footing.</p>",
   };
   assert.deepEqual(buildSkillDocument(skill), buildSkillDocument(skill));
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test scripts/build/skillsAndTalents.test.mjs`
Expected: FAIL — `Cannot find module './skillsAndTalents.mjs'`.

- [ ] **Step 3: Implementar `scripts/build/skillsAndTalents.mjs`**

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const GENERAL_SKILLS_FOLDER_ID = deterministicIdInternal("folders:General Skills");
const TALENTS_FOLDER_ID = deterministicIdInternal("folders:Talents");

function deterministicIdInternal(seed) {
   const hash = crypto.createHash("sha1").update(seed).digest();
   let id = "";
   for (let i = 0; i < 16; i++) id += ID_ALPHABET[hash[i] % ID_ALPHABET.length];
   return id;
}

/**
 * Derive a stable 16-char alphanumeric Foundry-style _id from a seed
 * string. Independent copy of the equipment/weapons/weaponMastery/
 * spells domains' function of the same name/shape — no cross-module
 * import.
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
 * Map one parsed talent (Task 1 shape) to a Foundry specialAbility Item
 * document.
 * @param {{ name: string, description: string }} talent
 * @returns {object}
 */
export function buildTalentDocument(talent) {
   const id = deterministicId(`talents:${talent.name}`);
   return {
      folder: TALENTS_FOLDER_ID,
      name: talent.name,
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
         description: talent.description,
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
         category: "talent",
         shortName: "",
         combatManeuver: null,
         customSaveCode: null,
         classKey: null,
         showResult: true,
         quantity: 1,
         quantityMax: null,
         conditions: [],
      },
   };
}

/**
 * Map one parsed skill (Task 1 shape) to a Foundry skill Item document.
 * @param {{ name: string, ability: string|null, extraAbility: string|null, choiceNote: string|null, description: string }} skill
 * @returns {object}
 */
export function buildSkillDocument(skill) {
   const id = deterministicId(`skills:${skill.name}`);
   const notes = [];
   if (skill.extraAbility) {
      notes.push(`Bônus também se aplica a checks de ${skill.extraAbility} (dupla ability no livro).`);
   }
   if (skill.ability === null) {
      notes.push("Special skill — não concede bônus de ability check, ver descrição.");
   }
   if (skill.choiceNote) {
      notes.push(`Skill de escolha de especialização (${skill.choiceNote}) — este item é genérico, ver descrição para exemplos.`);
   }

   return {
      folder: GENERAL_SKILLS_FOLDER_ID,
      name: skill.name,
      _id: id,
      img: "icons/svg/book.svg",
      effects: [],
      ownership: { default: 0 },
      flags: {},
      _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      _originalKey: `!items!${id}`,
      type: "skill",
      system: {
         description: skill.description,
         gm: { notes: notes.join(" ") },
         ability: skill.ability ?? "str",
         targetFormula: "@rollTarget",
         operator: "lte",
         rollFormula: "1d20",
         level: 1,
         rollMode: "",
         healFormula: null,
         showResult: true,
         skillBonus: 0,
         skillPenalty: 0,
         autoSuccess: null,
         autoFail: null,
      },
   };
}

async function ensureFolders(foldersPath) {
   const folders = JSON.parse(await fs.readFile(foldersPath, "utf8"));
   const maxSort = Math.max(0, ...Object.values(folders)
      .filter((f) => f.folder === null)
      .map((f) => f.sort));

   const skillsKey = `!folders!${GENERAL_SKILLS_FOLDER_ID}`;
   if (!folders[skillsKey]) {
      folders[skillsKey] = {
         name: "General Skills", sorting: "a", folder: null, type: "Item",
         _id: GENERAL_SKILLS_FOLDER_ID, description: "", sort: maxSort + 100000,
         color: "#2f4a3c", flags: {},
         _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      };
   }
   const talentsKey = `!folders!${TALENTS_FOLDER_ID}`;
   if (!folders[talentsKey]) {
      folders[talentsKey] = {
         name: "Talents", sorting: "a", folder: null, type: "Item",
         _id: TALENTS_FOLDER_ID, description: "", sort: maxSort + 200000,
         color: "#4a3c2f", flags: {},
         _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      };
   }
   await fs.writeFile(foldersPath, JSON.stringify(folders, null, 2) + "\n", "utf8");
}

async function main() {
   const parsedPath = path.join(process.cwd(), "extract", "parsed", "skillsAndTalents.json");
   const { talents, skills } = JSON.parse(await fs.readFile(parsedPath, "utf8"));

   const foldersPath = path.join(process.cwd(), "packsrc", "items", "_folders.json");
   await ensureFolders(foldersPath);

   const talentsDir = path.join(process.cwd(), "packsrc", "items", "Talents");
   const skillsDir = path.join(process.cwd(), "packsrc", "items", "General_Skills");
   await fs.mkdir(talentsDir, { recursive: true });
   await fs.mkdir(skillsDir, { recursive: true });

   for (const t of talents) {
      const doc = buildTalentDocument(t);
      await fs.writeFile(path.join(talentsDir, splitFileName(t.name)), JSON.stringify(doc, null, 2) + "\n", "utf8");
   }
   for (const s of skills) {
      const doc = buildSkillDocument(s);
      await fs.writeFile(path.join(skillsDir, splitFileName(s.name)), JSON.stringify(doc, null, 2) + "\n", "utf8");
   }
   console.log(`wrote ${talents.length} talent(s), ${skills.length} skill(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test scripts/build/skillsAndTalents.test.mjs`
Expected: PASS, todos os testes verdes.

- [ ] **Step 5: Adicionar os subtipos ao validador**

Em `scripts/extract/validate.mjs`, dentro de `SUBTYPE_REQUIRED_FIELDS`,
adicionar:

```javascript
   skill: ["ability", "targetFormula", "operator", "rollFormula", "level", "skillBonus", "skillPenalty"],
   specialAbility: [],
```

E adicione um teste de integração real em
`scripts/extract/validate.test.mjs` (mesmo padrão já usado nos domínios
anteriores — import direto de `buildSkillDocument`/`buildTalentDocument`
de `../build/skillsAndTalents.mjs`, seguido de `validateDocument()`,
esperando `[]` de erros para os dois subtipos, mais o caso "campo
obrigatório faltando" para `skill` — não é necessário pra
`specialAbility`, já que a lista de obrigatórios está vazia).

- [ ] **Step 6: Documentar o schema em `docs/fantastic-depths-item-schema.md`**

Adicionar duas seções, `SkillItemDataModel` e `SpecialAbilityDataModel`,
no mesmo formato das seções existentes, com os campos reais listados na
spec seção 5 (fonte:
`Forelius/fantastic-depths@4a8f2c8/src/item/dataModel/SkillItemDataModel.ts`
e `src/item/fields/SpecialAbilityField.ts`).

- [ ] **Step 7: Commit**

```bash
git add scripts/build/skillsAndTalents.mjs scripts/build/skillsAndTalents.test.mjs \
   scripts/extract/validate.mjs scripts/extract/validate.test.mjs \
   docs/fantastic-depths-item-schema.md
git commit -m "$(cat <<'EOF'
feat: add skills and talents builder, validator subtypes, and schema docs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Sv5Ek7ypXvkGSWgE9JosAY
EOF
)"
```

---

### Task 3: Rodar o pipeline completo, validar, e revisar por amostragem

**Files:**
- Create: `packsrc/items/General_Skills/*.json` (31 arquivos),
  `packsrc/items/Talents/*.json` (10 arquivos)
- Modify: `packsrc/items/_folders.json` (novas pastas)

**Interfaces:**
- Consumes: `node scripts/parse/skillsAndTalents.mjs` (Task 1) e
  `node scripts/build/skillsAndTalents.mjs` (Task 2), em sequência.
- Produces: o conteúdo final de `packsrc/items/General_Skills/**` e
  `packsrc/items/Talents/**`, que fecha o critério de conclusão deste
  domínio.

- [ ] **Step 1: Rodar parser e builder em sequência**

Run:
```bash
node scripts/parse/skillsAndTalents.mjs
node scripts/build/skillsAndTalents.mjs
```
Expected: `wrote 10 talent(s), 31 skill(s)` impresso DUAS vezes (uma
pelo parser, uma pelo builder), sem exceção lançada. Se os números
divergirem de 10/31, pare e investigue — não ajuste este plano pra
bater com um resultado divergente sem entender a causa primeiro.

- [ ] **Step 2: Confirmar a contagem**

Run: `find packsrc/items/General_Skills -name '*.json' | wc -l`
Expected: `31`.
Run: `find packsrc/items/Talents -name '*.json' | wc -l`
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
cat packsrc/items/General_Skills/Intimidation.json
cat packsrc/items/General_Skills/Language.json
cat packsrc/items/General_Skills/Craft.json
cat packsrc/items/Talents/Climb_Walls.json
cat packsrc/items/Talents/Locate_Traps.json
```
Expected: `Intimidation.json` tem `ability: "cha"` e `gm.notes`
mencionando "str" (dupla ability). `Language.json` tem `ability: "str"`
(default, nunca consultado) e `gm.notes` mencionando "Special skill".
`Craft.json` tem `gm.notes` mencionando "escolha de especialização" e a
descrição preserva os exemplos do livro (Carpentry, Smithing, etc.).
`Climb_Walls.json` tem `type: "specialAbility"`, `system.category:
"talent"`. `Locate_Traps.json` tem a descrição preservando o bloco
"Example: Black Leaf..." como texto normal, não como um item separado.

Run: `cat packsrc/items/_folders.json | grep -c '"type": "Item"'`
Expected: valor anterior (32, de equipment/weaponMastery/spells) + 2
(`General Skills`, `Talents`) = `34`.

- [ ] **Step 6: Commit**

```bash
git add extract/parsed/skillsAndTalents.json packsrc/items/General_Skills \
   packsrc/items/Talents packsrc/items/_folders.json
git commit -m "$(cat <<'EOF'
feat: generate Skill and Talent items from chapter 5

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Sv5Ek7ypXvkGSWgE9JosAY
EOF
)"
```

Este commit é o critério de conclusão do domínio skills e talentos:
`packsrc/items/General_Skills/*.json` cobre as 31 skills,
`packsrc/items/Talents/*.json` cobre os 10 talentos, `npm run validate`
passa sem erros.

---

## Fim do domínio skills e talentos

Próximo passo, por ordem do spec geral: domínio **classes** (cap. 4),
com seu próprio spec/plano — não depende do resultado deste domínio.
Conforme instrução do usuário, o PR combinado
(`phase-2-pdf-extraction` → `master`) só é aberto depois que todos os
domínios (exceto o bestiário, explicitamente adiado) estiverem
completos.
