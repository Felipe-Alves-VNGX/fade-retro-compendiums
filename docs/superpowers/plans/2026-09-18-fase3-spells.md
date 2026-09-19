# fade-retro-compendiums — Fase 3, domínio Spells — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o pipeline parser → `extract/parsed` → builder para o
subtipo `spell` (cap. 7, `ALPHABETICAL SPELL LIST`), produzindo
`packsrc/items/Spells/<Classe>/Circle_N/*.json` prontos para
`npm run validate`.

**Architecture:** `scripts/parse/spells.mjs` lê `extract/raw/spells.txt`
inteiro a partir de `ALPHABETICAL SPELL LIST` e detecta fronteiras de
verbete por lookahead (linha N+1 bate com classe+círculo), fazendo
fan-out no próprio parser: um registro de saída por combinação (magia,
classe, círculo). `scripts/build/spells.mjs` lê esse JSON, mapeia campos
pro schema `spell` real, resolve/cria pastas dinamicamente em
`_folders.json` (`Spells/<Classe>/Circle_N/`) e escreve um documento por
registro.

**Tech Stack:** Node.js (ESM), `node:test`, `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-09-18-fase3-spells-design.md` (e o
spec geral, seção 4)

## Global Constraints

- Fonte única: `extract/raw/spells.txt`, do texto `ALPHABETICAL SPELL
  LIST` (linha 550) até o fim do arquivo — o arquivo termina com o
  último verbete (`Word of Recall`), sem marcador de capítulo seguinte;
  não há necessidade de um limite superior além de `lines.length`.
- Verificado por extração real e exaustiva contra o arquivo inteiro
  (não amostra): **182 verbetes** detectáveis de forma limpa, fazendo
  fan-out para **254 registros** (magia × classe × círculo). Números
  exatos a confirmar de novo na Task 3 rodando o parser real — se
  divergirem desses valores, é sinal de regressão, não normalidade.
- **Gap aceito, ruling já tomada**: o verbete "Continual Light Rev"
  (e o bloco `Reverse:` "Continual Darkness" dentro dele) cai
  inteiramente dentro da página 103, cuja Table 7-4 (Contact Outer
  Plane) é full-width e faz o `pdftotext` intercalar a coluna esquerda
  (fim da descrição de "Contact Outer Plane" e o verbete "Contingency")
  com a coluna direita ("Continual Light Rev") na mesma linha física —
  mesma classe de degradação já documentada e aceita na Fase 2 para
  essa página. Como resultado, nem a linha de cabeçalho nem a linha
  classe+círculo desse verbete começam a linha (ficam à direita de uma
  frase de outro parágrafo), então o lookahead de detecção de fronteira
  legitimamente não o reconhece como verbete — ele fica de fora do
  parser, junto com sua contraparte reversa. **Não tentar
  hand-transcrever ou criar um override bespoke para este caso** — seguir
  o mesmo precedente de degradação aceita da Fase 2. Documentar a
  ausência no relatório final da Task 3, não silenciosamente.
- **Correção a uma afirmação errada do spec** (achada só por rodar o
  parser real contra o arquivo inteiro, não por amostra — o spec, seção
  3, afirmava que "a ordem de leitura das colunas [na p.103] está
  correta"; isso estava **errado**): a partir da linha "overwhelmed, no
  questions are answered..." (logo após a Table 7-4), a página 103 tem a
  mesma corrupção de merge de coluna documentada para outras páginas
  full-width — a coluna esquerda (fim de "Contact Outer Plane", depois
  "Contingency") e a direita ("Continual Light Rev") ficam intercaladas
  na mesma linha física por várias linhas seguidas, não só na linha do
  cabeçalho. Sem tratamento, isso faz a descrição de "Contact Outer
  Plane" absorver ~30 linhas de texto corrompido (incluindo o próprio
  cabeçalho de "Continual Light Rev" como prosa literal) antes do
  lookahead se realinhar em "Contingency". O parser (Task 1) trata isso
  parando a coleta de descrição na primeira linha com um "gap interior"
  (5+ espaços entre dois trechos de texto — mesmo heurística
  `hasInteriorGap` de equipment/weapons) ou que comece com `Table \d`
  (mesmo stop-condition de `matchDescription` nesses domínios) — **parar
  e manter o já coletado, nunca rejeitar o verbete inteiro**. Efeito
  colateral aceito: a descrição de "Contact Outer Plane" perde a Table
  7-4 (dados tabulares) e o parágrafo final antes dela — mesma classe de
  perda parcial já aceita em outros domínios para páginas degradadas
  deste tipo.
- **Classes reconhecidas**: apenas `Cleric`, `Druid`, `Wizard` (as 3
  classes conjuradoras confirmadas no capítulo, de um total de 10
  classes do cap. 4 — nenhuma outra classe do cap. 4 aparece nas linhas
  de classe+círculo). O verbete "Fireball" tem uma linha
  classe+círculo real `"Wizard 3, Elf 3, Sorcerer 3"` — `Elf` e
  `Sorcerer` **não** são classes deste projeto (não aparecem na lista de
  10 classes do cap. 4) e são **descartadas silenciosamente** pelo
  parser (que só extrai tokens das 3 classes conhecidas via regex) —
  "Fireball" gera só 1 documento (`Wizard 3`), não 3. Ruling já tomada,
  não é um bug a corrigir.
- **Vírgula solta**: o verbete "Snake Charm" tem uma linha real
  `"Cleric 2, Druid 2,                  Target: ..."` com vírgula
  sobrando antes de `Target:` (artefato do livro/extração, sem terceira
  classe faltando). A extração via regex global de tokens
  `<Classe> <círculo>` ignora naturalmente a vírgula solta — não precisa
  de tratamento especial.
- **Rótulo `Damage:` em vez de `Duration:`**: o verbete "Clothform" usa
  `"Range: touch                                    Damage: instant"`
  — único caso no capítulo inteiro (confirmado por grep exaustivo). É
  claramente um erro de impressão do livro (o valor `"instant"` é um
  valor típico de duração, não uma fórmula de dano, e o resto do texto
  do verbete não menciona dano algum). O parser trata `Damage:` como
  sinônimo posicional de `Duration:` nessa linha (mesmo campo
  `system.duration` no builder).
- **Espaçamento inconsistente antes de `Duration:`/`Target:`**: a maioria
  das linhas usa 2+ espaços antes do rótulo (coluna alinhada à direita),
  mas "Cure Disease Rev" e "Fly" usam só 1 espaço. O parser busca o
  rótulo por substring literal (`indexOf`), nunca por contagem mínima de
  espaços.
- **`stripPageBoundaries` não pode ser a cópia literal de
  equipment/weapons/weaponMastery neste domínio**: naqueles domínios, a
  quebra de página no `.txt` sempre tem um número de rodapé antes do
  marcador (`\f\n\n  103\n\n--- page 104 ---\n`). Em `spells.txt`,
  **a esmagadora maioria** das quebras de página **não tem** esse número
  de rodapé (`\f\n\n--- page 100 ---\n`, sem dígito algum) — confirmado
  por amostragem de 6 transições reais (p.99, 100, 101, 105, 110, 120),
  todas sem número. Só a transição p.103→104 tem o número (coincidência
  de layout daquela página específica, não o padrão geral). Rodar a
  regex das outras funções `stripPageBoundaries` (que exige o dígito)
  contra este arquivo deixa o marcador `--- page N ---` como texto
  literal dentro da descrição em quase toda página — confirmado por
  execução real: **55 dos 254 documentos** ficaram com `--- page N ---`
  vazando pra dentro de `system.description` antes desta correção. A
  versão deste domínio faz o número de rodapé **opcional** na regex (ver
  código do Task 1).
- Unidade de peso/custo: não se aplica a este domínio (schema `spell`
  não tem esses campos).
- `_id` determinístico: `sha1("spells:" + name + ":" + class + ":" +
  circle)`, truncado pelo mesmo `ID_ALPHABET`/algoritmo já usado em
  equipment/weapons/weaponMastery (reimplementação independente, sem
  import cruzado).
- `targetSelf`/`targetOther`: regra de keyword sobre o texto de
  `Target:` (case-insensitive) — contém `"caster"` ou `"personal"` →
  `{true, false}`; é exatamente `"none"` → `{false, false}`; qualquer
  outro texto → `{false, true}`.
- `classes` (array `{name, uuid}`) fica sempre `[]` — a granularidade de
  um documento por (classe, círculo) já resolve o que esse campo
  serviria.
- Campos sem coluna estruturada no livro (`effect`, `dmgFormula`,
  `healFormula`, `maxTargetFormula`, `durationFormula`, `savingThrow`,
  `saveDmgFormula`, `attackType`, `damageType`, `conditions`,
  `memorized`, `cast`) ficam nos valores neutros do próprio schema —
  o builder escreve explicitamente `""`/`null`/`0`/`[]` conforme o
  default de cada campo (`SpellField.ts`), não omite o campo.
- Pastas (`Spells/<Classe>/Circle_N/`) são resolvidas **dinamicamente**
  pelo builder, não hand-picked em `_folders.json` — até 27 pastas
  possíveis (1 top-level + 3 classes + até 23 combinações
  classe/círculo, confirmado por extração real: exatamente 23). Nome da
  pasta no Foundry usa espaço (`"Circle 3"`), caminho no filesystem usa
  underscore (`Circle_3`) — mesmo padrão já usado em
  `Adventuring_Gear`/`"Adventuring Gear"`.

---

### Task 1: Parser — `scripts/parse/spells.mjs`

**Files:**
- Create: `scripts/parse/spells.mjs`
- Test: `scripts/parse/spells.test.mjs`

**Interfaces:**
- Consumes: `extract/raw/spells.txt` (já existe, commitado na Fase 2).
- Produces:
  - `parseSpells(rawText: string) -> Record[]`, onde `Record` é:
    ```
    {
      name: string,
      sphere: string[],        // [] quando o verbete não tem esfera
      class: "Cleric" | "Druid" | "Wizard",
      circle: number,
      target: string,
      range: string,
      duration: string,
      description: string,     // já em HTML, um <p> por parágrafo
    }
    ```
    Um registro por combinação (magia, classe, círculo) — fan-out já
    aplicado dentro desta função.
  - `paragraphsToHtml(lines: string[]) -> string` (helper exportado,
    reusado pelos testes).
  - Um CLI (`node scripts/parse/spells.mjs`) que lê
    `extract/raw/spells.txt` e escreve `extract/parsed/spells.json`.

- [ ] **Step 1: Escrever os testes do parser (falhando)**

Criar `scripts/parse/spells.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSpells, paragraphsToHtml } from "./spells.mjs";

const HEADER = "ALPHABETICAL SPELL LIST\n";

test("parseSpells extracts a single-class, single-circle spell", () => {
   const text = HEADER + `Analyse                                                 Energy
Wizard 1                             Target: one magic item
Range: special (see below)                    Duration: instant
To use an Analyse spell, the caster must imitate using the
item.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 1);
   assert.equal(records[0].name, "Analyse");
   assert.deepEqual(records[0].sphere, ["Energy"]);
   assert.equal(records[0].class, "Wizard");
   assert.equal(records[0].circle, 1);
   assert.equal(records[0].target, "one magic item");
   assert.equal(records[0].range, "special (see below)");
   assert.equal(records[0].duration, "instant");
   assert.equal(records[0].description, "<p>To use an Analyse spell, the caster must imitate using the item.</p>");
});

test("parseSpells fans out a multi-class, same-circle spell into one record per class", () => {
   const text = HEADER + `Animate Objects                                         Vitality
Cleric 6, Druid 6                 Target: one or more objects
Range: 60'                                     Duration: 1 hour
This spell will animate a number of objects.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 2);
   assert.deepEqual(records.map((r) => [r.class, r.circle]).sort(), [["Cleric", 6], ["Druid", 6]]);
   assert.equal(records[0].name, "Animate Objects");
   assert.equal(records[1].description, records[0].description);
});

test("parseSpells fans out a multi-class, different-circle spell", () => {
   const text = HEADER + `Animate Dead                                  Energy, Inertia
Cleric 4, Wizard 5              Target: one or more corpses
Range: 60'                              Duration: permanent
Zombies and skeletons.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 2);
   const byClass = Object.fromEntries(records.map((r) => [r.class, r.circle]));
   assert.deepEqual(byClass, { Cleric: 4, Wizard: 5 });
   assert.deepEqual(records[0].sphere, ["Energy", "Inertia"]);
});

test("parseSpells handles a spell with no sphere", () => {
   const text = HEADER + `Anti-Animal Shell
Druid 6                                         Target: caster
Range: personal                    Duration: 10 minutes/level
This spell prevents any animals from coming within 1" of the caster.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 1);
   assert.deepEqual(records[0].sphere, []);
});

test("parseSpells preserves a Reverse: block as part of the same description", () => {
   const text = HEADER + `Continual Light
Cleric 3, Druid 3, Wizard 2                     Target: 30' radius
Range: 120'                                  Duration: permanent
This lights an area.

Reverse: Continual Darkness causes the area to go dark.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 3);
   assert.match(records[0].description, /Reverse: Continual Darkness/);
});

test("parseSpells ignores a class token not in the known list (Fireball's Elf/Sorcerer)", () => {
   const text = HEADER + `Fireball                                                Energy
Wizard 3, Elf 3, Sorcerer 3                  Target: 20' radius
Range: 240'                                   Duration: instant
Boom.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 1);
   assert.equal(records[0].class, "Wizard");
   assert.equal(records[0].circle, 3);
});

test("parseSpells ignores a trailing comma with no following class (Snake Charm)", () => {
   const text = HEADER + `Snake Charm                                           Sympathy
Cleric 2, Druid 2,                  Target: one or more snakes
Range: 60'                                     Duration: special
Charms snakes.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 2);
   assert.deepEqual(records.map((r) => r.class).sort(), ["Cleric", "Druid"]);
});

test("parseSpells treats Damage: as a synonym for Duration: on that line (Clothform)", () => {
   const text = HEADER + `Clothform                                                Matter
Wizard 4                                           Target: none
Range: touch                                    Damage: instant
Creates cloth.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 1);
   assert.equal(records[0].range, "touch");
   assert.equal(records[0].duration, "instant");
});

test("parseSpells handles single-space separators before Target:/Duration: (Cure Disease Rev)", () => {
   const text = HEADER + `Cure Disease Rev                               Purity/Corruption
Cleric 3, Druid 3 Target: one living creature
Range: 30' Duration: permanent
Cures disease.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 2);
   assert.equal(records[0].target, "one living creature");
   assert.equal(records[0].range, "30'");
   assert.equal(records[0].duration, "permanent");
});

test("parseSpells stops (not rejects) a description at an embedded table's title line, and does not create a false entry boundary from it", () => {
   const text = HEADER + `Contact Outer Plane                                     Spirit
Wizard 5                                Target: one's own mind
Range: special                                Duration: special
This spell contacts a distant entity.
Table 7–4: Contact Outer Plane
   Distance to Plane              Questions             Chance to Know
           1                          3                       25%
If the caster is overwhelmed, no questions are answered.

Contingency                                            Energy
Wizard 9                Target: one creature, object or place
Range: touch                                Duration: special
When this spell is cast, the caster also casts a second spell.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 2);
   assert.equal(records[0].name, "Contact Outer Plane");
   assert.equal(records[0].description, "<p>This spell contacts a distant entity.</p>");
   assert.equal(records[1].name, "Contingency");
   assert.match(records[1].description, /When this spell is cast/);
});

test("parseSpells stops a description at a column-merge corruption (5+ space interior gap) without losing later entries", () => {
   const text = HEADER + `Fabricate                                               Matter
Wizard 6                                     Target: one object
Range: touch                                Duration: permanent
This spell shapes raw materials into a finished item.
be simply because the immortal is unhappy about being                   area will continue to be lit until it is dispelled.

Faerie Fire                                            Light
Wizard 1                                     Target: one creature
Range: 90'                                        Duration: 5 minutes
This spell outlines a creature in visible light.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 2);
   assert.equal(records[0].description, "<p>This spell shapes raw materials into a finished item.</p>");
   assert.equal(records[1].name, "Faerie Fire");
   assert.match(records[1].description, /outlines a creature/);
});

test("paragraphsToHtml joins continuation lines with a space and wraps each paragraph in <p>", () => {
   const html = paragraphsToHtml(["This is line one", "continuing here.", "", "Second paragraph."]);
   assert.equal(html, "<p>This is line one continuing here.</p><p>Second paragraph.</p>");
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test scripts/parse/spells.test.mjs`
Expected: FAIL — `Cannot find module './spells.mjs'` (o arquivo ainda não
existe).

- [ ] **Step 3: Implementar `scripts/parse/spells.mjs`**

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KNOWN_CLASSES = ["Cleric", "Druid", "Wizard"];
const CLASS_TOKEN_RE = new RegExp(`(${KNOWN_CLASSES.join("|")})\\s+(\\d+)`, "g");
const HEADER_LOOKAHEAD_RE = /^(Cleric|Druid|Wizard)\s+\d/;
const INTERIOR_GAP_RE = /\S\s{5,}\S/;
const TABLE_TITLE_RE = /^Table \d/i;

// Unlike equipment/weapons/weaponMastery, most page breaks in this file
// have NO page-footer number before the "--- page N ---" marker (only
// "\f\n\n--- page N ---\n") — confirmed by sampling 6 real transitions.
// The footer-number group is therefore optional here (equipment/
// weapons/weaponMastery always have it, so their copies of this
// function require it) — verified against the full file: without this
// difference, 55/254 generated documents end up with a literal
// "--- page N ---" marker leaked into system.description.
function stripPageBoundaries(text) {
   return text
      .replace(/\f/g, "")
      .replace(/\n[ \t]*\n*(?:[ \t]*\d{1,4}[ \t]*\n[ \t]*\n*)?--- page \d+ ---\n/g, "\n");
}

function splitOnLabel(line, label) {
   const idx = line.indexOf(label);
   if (idx === -1) return null;
   return [line.slice(0, idx).trim(), line.slice(idx + label.length).trim()];
}

/**
 * Join raw description lines into one `<p>` block per blank-line-
 * separated paragraph, continuation lines joined with a single space.
 * @param {string[]} lines
 * @returns {string}
 */
export function paragraphsToHtml(lines) {
   const paragraphs = [];
   let current = [];
   for (const line of lines) {
      if (line.trim() === "") {
         if (current.length > 0) {
            paragraphs.push(current.join(" "));
            current = [];
         }
         continue;
      }
      current.push(line.trim());
   }
   if (current.length > 0) paragraphs.push(current.join(" "));
   return paragraphs.map((p) => `<p>${p}</p>`).join("");
}

/**
 * Parse the alphabetical spell list into one record per (spell, class,
 * circle) combination. A spell entry with N class+circle combos in its
 * header produces N records sharing the same sphere/target/range/
 * duration/description — the fan-out the Spells/<Classe>/Circle_N/
 * folder structure requires. A line N is treated as a spell's name/
 * sphere header only when line N+1 matches a class+circle pattern
 * (one-line lookahead) — this also naturally serves as the stop
 * condition for the previous entry's description.
 * @param {string} rawText - full contents of extract/raw/spells.txt
 * @returns {object[]}
 */
export function parseSpells(rawText) {
   const startIdx = rawText.indexOf("ALPHABETICAL SPELL LIST");
   const body = stripPageBoundaries(rawText.slice(startIdx));
   const lines = body.split("\n");

   const records = [];
   let i = 1;
   while (i < lines.length) {
      const line = lines[i];
      const next = lines[i + 1] || "";
      if (line.trim() === "" || !HEADER_LOOKAHEAD_RE.test(next.trim())) {
         i++;
         continue;
      }

      const headerTrimmed = line.trim();
      const headerMatch = headerTrimmed.match(/^(.+?)\s{2,}(.+)$/);
      const name = headerMatch ? headerMatch[1].trim() : headerTrimmed;
      const sphere = headerMatch ? headerMatch[2].trim().split(",").map((s) => s.trim()) : [];

      const l2 = next.trim();
      const l2split = splitOnLabel(l2, "Target:");
      const classCircleSeg = l2split ? l2split[0] : l2;
      const target = l2split ? l2split[1] : "";
      const classCircles = [];
      CLASS_TOKEN_RE.lastIndex = 0;
      let cm;
      while ((cm = CLASS_TOKEN_RE.exec(classCircleSeg))) {
         classCircles.push({ class: cm[1], circle: Number(cm[2]) });
      }

      const l3 = (lines[i + 2] || "").trim();
      const l3split = splitOnLabel(l3, "Range:");
      let range = "";
      let duration = "";
      if (l3split) {
         const rest = l3split[1];
         const durSplit = splitOnLabel(rest, "Duration:") || splitOnLabel(rest, "Damage:");
         if (durSplit) {
            range = durSplit[0];
            duration = durSplit[1];
         }
      }

      let j = i + 3;
      const descLines = [];
      while (j < lines.length) {
         const jNext = lines[j + 1] || "";
         if (lines[j].trim() !== "" && HEADER_LOOKAHEAD_RE.test(jNext.trim())) break;
         // Stop (keep what's collected so far), never reject the whole
         // entry — same asymmetry as equipment/weapons matchDescription.
         // Catches the page-103 column-merge corruption (a run of 5+
         // spaces inside a line) and an embedded table's title line
         // (which has no interior gap once trimmed, so needs its own
         // check) before either bleeds garbled prose into the
         // description.
         if (INTERIOR_GAP_RE.test(lines[j])) break;
         if (TABLE_TITLE_RE.test(lines[j].trim())) break;
         descLines.push(lines[j]);
         j++;
      }
      const description = paragraphsToHtml(descLines);

      for (const cc of classCircles) {
         records.push({ name, sphere, class: cc.class, circle: cc.circle, target, range, duration, description });
      }

      i = j;
   }
   return records;
}

async function main() {
   const rawPath = path.join(process.cwd(), "extract", "raw", "spells.txt");
   const rawText = await fs.readFile(rawPath, "utf8");
   const records = parseSpells(rawText);
   const outPath = path.join(process.cwd(), "extract", "parsed", "spells.json");
   await fs.writeFile(outPath, JSON.stringify(records, null, 2) + "\n", "utf8");
   console.log(`wrote ${records.length} spell record(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test scripts/parse/spells.test.mjs`
Expected: PASS, todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add scripts/parse/spells.mjs scripts/parse/spells.test.mjs
git commit -m "$(cat <<'EOF'
feat: add spells parser for the alphabetical spell list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Builder — `scripts/build/spells.mjs`

**Files:**
- Create: `scripts/build/spells.mjs`
- Test: `scripts/build/spells.test.mjs`
- Modify: `scripts/extract/validate.mjs` (adicionar `SUBTYPE_REQUIRED_FIELDS.spell`)
- Modify: `docs/fantastic-depths-item-schema.md` (adicionar seção `SpellItemDataModel`)

**Interfaces:**
- Consumes: `extract/parsed/spells.json` (Task 1, array de `Record` —
  mesma forma documentada no Task 1 "Produces").
- Produces:
  - `deterministicId(seed: string) -> string` (mesma função dos domínios
    anteriores — reimplementada aqui, sem import cruzado).
  - `normalizeTag(trait: string) -> string` (mesma função dos domínios
    anteriores).
  - `mapTarget(target: string) -> {targetSelf: boolean, targetOther: boolean}`.
  - `buildDocument(record: Record) -> object` (documento Item `spell`
    pronto para `JSON.stringify`; `record.folder` **não** é lido daqui —
    o `_id` da pasta é recalculado dentro de `buildDocument` via
    `deterministicId(\`spells-folder:${record.class}:${record.circle}\`)`,
    a mesma seed que o CLI usa para criar a pasta, garantindo que os dois
    nunca divirjam).
  - Um CLI (`node scripts/build/spells.mjs`) que lê
    `extract/parsed/spells.json`, garante (idempotente) as pastas
    `Spells` → `<Classe>` → `Circle_N` em `packsrc/items/_folders.json`,
    e escreve um arquivo por registro em
    `packsrc/items/Spells/<Classe>/Circle_N/`.

**Campos reais do schema `spell`** (`SpellItemDataModel` delega a
`SpellField.ts`/`SpellData.defineSchema()`, Forelius/fantastic-depths @
4a8f2c8, já verificado na fase de brainstorming): `tags` (string[]),
`description` (string), `gm.notes` (string), `spellLevel` (number,
`required: true`), `range` (string, default `""`), `duration` (string,
default `"Instant"`), `effect` (string, default `""`), `memorized`
(number nullable, default `0`), `cast` (number, default `0`),
`targetSelf`/`targetOther` (boolean, default `true` ambos no schema —
este builder sempre escreve um valor explícito, nunca deixa no default),
`dmgFormula`/`healFormula`/`maxTargetFormula`/`durationFormula`/
`savingThrow`/`saveDmgFormula` (string nullable, default `null`),
`attackType`/`damageType` (string, default `""`), `conditions` (array,
default `[]`), `classes` (array, default `[]`).

- [ ] **Step 1: Escrever os testes do builder (falhando)**

Criar `scripts/build/spells.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, normalizeTag, mapTarget, buildDocument } from "./spells.mjs";

test("deterministicId matches the 16-char alphanumeric ID pattern", () => {
   assert.match(deterministicId("spells:Fireball:Wizard:3"), /^[a-zA-Z0-9]{16}$/);
});

test("deterministicId is stable across calls", () => {
   assert.equal(deterministicId("spells:Fireball:Wizard:3"), deterministicId("spells:Fireball:Wizard:3"));
});

test("deterministicId differs between fan-out records of the same spell", () => {
   assert.notEqual(
      deterministicId("spells:Animate Dead:Cleric:4"),
      deterministicId("spells:Animate Dead:Wizard:5"),
   );
});

test("mapTarget maps caster/personal to targetSelf only", () => {
   assert.deepEqual(mapTarget("caster"), { targetSelf: true, targetOther: false });
   assert.deepEqual(mapTarget("personal"), { targetSelf: true, targetOther: false });
});

test("mapTarget maps none to neither", () => {
   assert.deepEqual(mapTarget("none"), { targetSelf: false, targetOther: false });
});

test("mapTarget maps any other text to targetOther only", () => {
   assert.deepEqual(mapTarget("one living creature"), { targetSelf: false, targetOther: true });
   assert.deepEqual(mapTarget("20' radius"), { targetSelf: false, targetOther: true });
});

test("buildDocument maps a single-sphere spell", () => {
   const doc = buildDocument({
      name: "Fireball", sphere: ["Energy"], class: "Wizard", circle: 3,
      target: "20' radius", range: "240'", duration: "instant",
      description: "<p>Boom.</p>",
   });
   assert.equal(doc.type, "spell");
   assert.equal(doc.name, "Fireball");
   assert.equal(doc.system.spellLevel, 3);
   assert.equal(doc.system.range, "240'");
   assert.equal(doc.system.duration, "instant");
   assert.deepEqual(doc.system.tags, ["energy"]);
   assert.equal(doc.system.description, "<p>Boom.</p>");
   assert.deepEqual(doc.system.targetSelf === false && doc.system.targetOther === true, true);
   assert.deepEqual(doc.system.classes, []);
   assert.equal(doc.system.dmgFormula, null);
   assert.equal(doc.system.effect, "");
});

test("buildDocument maps a no-sphere spell to an empty tags array", () => {
   const doc = buildDocument({
      name: "Anti-Animal Shell", sphere: [], class: "Druid", circle: 6,
      target: "caster", range: "personal", duration: "10 minutes/level",
      description: "<p>Prevents animals.</p>",
   });
   assert.deepEqual(doc.system.tags, []);
   assert.deepEqual({ targetSelf: doc.system.targetSelf, targetOther: doc.system.targetOther }, { targetSelf: true, targetOther: false });
});

test("buildDocument maps multiple spheres to multiple tags", () => {
   const doc = buildDocument({
      name: "Animate Dead", sphere: ["Energy", "Inertia"], class: "Wizard", circle: 5,
      target: "one or more corpses", range: "60'", duration: "permanent",
      description: "<p>Zombies.</p>",
   });
   assert.deepEqual(doc.system.tags, ["energy", "inertia"]);
});

test("buildDocument's folder id matches the seed spells-folder:<class>:<circle>", () => {
   const doc = buildDocument({
      name: "Fireball", sphere: ["Energy"], class: "Wizard", circle: 3,
      target: "20' radius", range: "240'", duration: "instant",
      description: "<p>Boom.</p>",
   });
   assert.equal(doc.folder, deterministicId("spells-folder:Wizard:3"));
});

test("buildDocument is idempotent: same record produces byte-identical output twice", () => {
   const record = {
      name: "Fireball", sphere: ["Energy"], class: "Wizard", circle: 3,
      target: "20' radius", range: "240'", duration: "instant",
      description: "<p>Boom.</p>",
   };
   assert.deepEqual(buildDocument(record), buildDocument(record));
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test scripts/build/spells.test.mjs`
Expected: FAIL — `Cannot find module './spells.mjs'`.

- [ ] **Step 3: Implementar `scripts/build/spells.mjs`**

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CLASS_ORDER = ["Cleric", "Druid", "Wizard"];
const SPELLS_FOLDER_SORT = 300000; // next top-level slot after Equipment (100000) and Weapon Masteries (200000)

/**
 * Derive a stable 16-char alphanumeric Foundry-style _id from a seed
 * string. Independent copy of the equipment/weapons/weaponMastery
 * domains' function of the same name/shape — no cross-module import.
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
 * Normalize a printed sphere name into a tag: lowercase, spaces become
 * hyphens.
 * @param {string} sphere
 * @returns {string}
 */
export function normalizeTag(sphere) {
   return sphere.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Derive targetSelf/targetOther from the book's free-text Target: value.
 * @param {string} target
 * @returns {{targetSelf: boolean, targetOther: boolean}}
 */
export function mapTarget(target) {
   const t = target.trim().toLowerCase();
   if (t === "none") return { targetSelf: false, targetOther: false };
   if (t.includes("caster") || t.includes("personal")) return { targetSelf: true, targetOther: false };
   return { targetSelf: false, targetOther: true };
}

function splitFileName(name) {
   const sanitized = name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
   return `${sanitized}.json`;
}

/**
 * Map one parsed record (Task 1 shape) to a full Foundry spell Item
 * document.
 * @param {object} record
 * @returns {object}
 */
export function buildDocument(record) {
   const { targetSelf, targetOther } = mapTarget(record.target);
   const id = deterministicId(`spells:${record.name}:${record.class}:${record.circle}`);
   const folderId = deterministicId(`spells-folder:${record.class}:${record.circle}`);

   return {
      folder: folderId,
      name: record.name,
      _id: id,
      img: "icons/svg/book.svg",
      effects: [],
      ownership: { default: 0 },
      flags: {},
      _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      _originalKey: `!items!${id}`,
      type: "spell",
      system: {
         tags: record.sphere.map(normalizeTag),
         description: record.description,
         gm: { notes: "" },
         spellLevel: record.circle,
         range: record.range,
         duration: record.duration,
         effect: "",
         memorized: 0,
         cast: 0,
         targetSelf,
         targetOther,
         dmgFormula: null,
         healFormula: null,
         maxTargetFormula: null,
         durationFormula: null,
         savingThrow: null,
         saveDmgFormula: null,
         attackType: "",
         damageType: "",
         conditions: [],
         classes: [],
      },
   };
}

function ensureFolder(folders, { id, name, parent, sort }) {
   const key = `!folders!${id}`;
   if (!folders[key]) {
      folders[key] = {
         name,
         sorting: "a",
         folder: parent,
         type: "Item",
         _id: id,
         description: "",
         sort,
         color: "#2f3c4a",
         flags: {},
         _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      };
   }
}

async function main() {
   const parsedPath = path.join(process.cwd(), "extract", "parsed", "spells.json");
   const records = JSON.parse(await fs.readFile(parsedPath, "utf8"));

   const foldersPath = path.join(process.cwd(), "packsrc", "items", "_folders.json");
   const folders = JSON.parse(await fs.readFile(foldersPath, "utf8"));

   const topId = deterministicId("spells-folder:top");
   ensureFolder(folders, { id: topId, name: "Spells", parent: null, sort: SPELLS_FOLDER_SORT });

   const classFolderIds = {};
   CLASS_ORDER.forEach((cls, idx) => {
      const classId = deterministicId(`spells-folder:${cls}`);
      ensureFolder(folders, { id: classId, name: cls, parent: topId, sort: (idx + 1) * 100000 });
      classFolderIds[cls] = classId;
   });

   const circlesByClass = {};
   for (const r of records) {
      circlesByClass[r.class] ??= new Set();
      circlesByClass[r.class].add(r.circle);
   }
   for (const cls of CLASS_ORDER) {
      const circles = [...(circlesByClass[cls] ?? [])].sort((a, b) => a - b);
      circles.forEach((circle, idx) => {
         const circleId = deterministicId(`spells-folder:${cls}:${circle}`);
         ensureFolder(folders, { id: circleId, name: `Circle ${circle}`, parent: classFolderIds[cls], sort: (idx + 1) * 100000 });
      });
   }

   await fs.writeFile(foldersPath, JSON.stringify(folders, null, 2) + "\n", "utf8");

   const spellsDir = path.join(process.cwd(), "packsrc", "items", "Spells");
   let written = 0;
   for (const record of records) {
      const doc = buildDocument(record);
      const dir = path.join(spellsDir, record.class, `Circle_${record.circle}`);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, splitFileName(record.name)), JSON.stringify(doc, null, 2) + "\n", "utf8");
      written++;
   }
   console.log(`wrote ${written} spell document(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test scripts/build/spells.test.mjs`
Expected: PASS, todos os testes verdes.

- [ ] **Step 5: Adicionar o subtipo `spell` ao validador**

Em `scripts/extract/validate.mjs`, dentro de `SUBTYPE_REQUIRED_FIELDS`
(mesmo objeto que já tem `item`, `weapon`, `light`, `armor`,
`weaponMastery`), adicionar:

```javascript
   spell: ["name", "spellLevel", "range", "duration"],
```

(Não usar `GEAR_REQUIRED_FIELDS` como base — igual `weaponMastery`, o
subtipo `spell` não estende `GearItemDataModel`, então campos como
`quantity`/`weight`/`cost` não existem nele.)

- [ ] **Step 6: Documentar o schema em `docs/fantastic-depths-item-schema.md`**

Adicionar uma seção `SpellItemDataModel`, no mesmo formato usado pelas
seções `ArmorItemDataModel`/`MasteryDefinitionDataModel` já existentes
nesse arquivo, listando os campos reais copiados da seção "Campos reais
do schema `spell`" acima (fonte:
`Forelius/fantastic-depths@4a8f2c8/src/item/fields/SpellField.ts`).

- [ ] **Step 7: Commit**

```bash
git add scripts/build/spells.mjs scripts/build/spells.test.mjs \
   scripts/extract/validate.mjs docs/fantastic-depths-item-schema.md
git commit -m "$(cat <<'EOF'
feat: add spells builder, validator subtype, and schema docs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Rodar o pipeline completo, validar, e revisar por amostragem

**Files:**
- Create: `packsrc/items/Spells/<Classe>/Circle_N/*.json` (254 arquivos
  esperados)
- Modify: `packsrc/items/_folders.json` (novas pastas)

**Interfaces:**
- Consumes: `node scripts/parse/spells.mjs` (Task 1) e
  `node scripts/build/spells.mjs` (Task 2), em sequência.
- Produces: o conteúdo final de `packsrc/items/Spells/**`, que fecha o
  critério de conclusão deste domínio.

- [ ] **Step 1: Rodar parser e builder em sequência**

Run:
```bash
node scripts/parse/spells.mjs
node scripts/build/spells.mjs
```
Expected: `wrote 254 spell record(s)` seguido de `wrote 254 spell
document(s)`, sem exceção lançada. **Se o número de registros divergir
de 254**, isso é uma regressão real — pare e investigue antes de
prosseguir (não ajuste os números deste plano para bater com um
resultado divergente sem entender a causa primeiro).

- [ ] **Step 2: Confirmar a contagem e a ausência de "Continual Light Rev"**

Run: `find packsrc/items/Spells -name '*.json' | wc -l`
Expected: `254`.

Run: `grep -rl "Continual Light Rev" packsrc/items/Spells/ || echo "not found (expected)"`
Expected: `not found (expected)` — confirma que o gap aceito
documentado nas Global Constraints se manifestou como esperado, não
como uma perda de dados não intencional em outro verbete.

- [ ] **Step 3: Rodar o validador**

Run: `npm run validate`
Expected: `✓ items: <N> document(s), no errors` entre as linhas de
saída, e `validate: all packs OK` ao final — exit code 0.

- [ ] **Step 4: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes passam (incluindo `scripts/parse/spells.test.mjs`
e `scripts/build/spells.test.mjs` desta feature, mais todos os testes
pré-existentes de domínios anteriores).

- [ ] **Step 5: Amostragem manual**

Run:
```bash
cat packsrc/items/Spells/Wizard/Circle_3/Fireball.json
cat packsrc/items/Spells/Cleric/Circle_4/Animate_Dead.json
cat packsrc/items/Spells/Wizard/Circle_5/Animate_Dead.json
cat packsrc/items/Spells/Druid/Circle_6/Anti_Animal_Shell.json
```
Expected: `Fireball.json` tem `spellLevel: 3`, `tags: ["energy"]`,
`targetSelf: false`, `targetOther: true` (target real "20' radius", não
"caster"/"personal"/"none"). Os dois `Animate_Dead.json` (Cleric/Circle_4
e Wizard/Circle_5) têm o mesmo `description`/`tags`
(`["energy", "inertia"]`) mas `spellLevel` diferente (4 vs 5) e `_id`
diferente. `Anti_Animal_Shell.json` tem `targetSelf: true`,
`targetOther: false` (target "caster").

Run: `cat packsrc/items/_folders.json | grep -c '"type": "Item"'`
Expected: valor anterior (5, dos domínios equipment/weaponMastery) + 27
(1 `Spells` + 3 classes + 23 combinações classe/círculo confirmadas na
extração real) = `32`.

- [ ] **Step 6: Commit**

```bash
git add extract/parsed/spells.json packsrc/items/Spells packsrc/items/_folders.json
git commit -m "$(cat <<'EOF'
feat: generate Spell items from the alphabetical spell list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Este commit é o critério de conclusão do domínio spells:
`packsrc/items/Spells/<Classe>/Circle_N/*.json` cobre os 254 registros
de fan-out, `npm run validate` passa sem erros, e o gap aceito
("Continual Light Rev"/"Continual Darkness") está documentado, não
silencioso.

---

## Fim do domínio spells

Próximo passo, por ordem do spec geral: domínio **skills**, com seu
próprio spec/plano — não depende do resultado deste domínio. Conforme
instrução do usuário, o PR combinado (`phase-2-pdf-extraction` →
`master`) só é aberto depois que todos os domínios (exceto o bestiário,
explicitamente adiado) estiverem completos.
