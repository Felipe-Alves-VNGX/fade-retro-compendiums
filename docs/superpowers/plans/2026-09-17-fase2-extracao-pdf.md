# fade-retro-compendiums — Fase 2: Extração e Normalização do PDF — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `scripts/extract/pdf2txt.mjs`, que extrai os 5 capítulos de *Dark Dungeons (4th Edition)* necessários à Fase 3, com recorte de coluna e normalização de texto, produzindo `extract/raw/*.txt` versionado e auditável.

**Architecture:** Um config (`chapters.json`) mapeia cada capítulo para sua faixa de páginas e quais páginas exigem extração em largura total (tabelas). `pdf2txt.mjs` orquestra chamadas ao `pdftotext` (já presente no sistema) por página, concatena, e aplica duas funções puras de normalização (`normalize.mjs`) antes de escrever o arquivo. Nenhuma dependência nova.

**Tech Stack:** Node.js (ESM), `pdftotext` (poppler-utils, já confirmado disponível), `node:test` para os testes de `normalize.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-17-fase2-extracao-pdf-design.md` (e o spec geral do projeto, `docs/superpowers/specs/2026-09-16-fade-retro-compendiums-design.md`, seção 7)

## Global Constraints

- O PDF de origem nunca é commitado; seu caminho vem exclusivamente da variável de ambiente `DD4_PDF_PATH`, documentada no `README.md`.
- Coordenadas de recorte de coluna, fixas para todo o livro (página 612×792pt): coluna esquerda `-x 18 -y 36 -W 282 -H 720`; coluna direita `-x 312 -y 36 -W 264 -H 720`. Páginas de largura total: `pdftotext -layout` sem recorte.
- Normalização aplicada nesta fase: (1) juntar quebra de linha em palavra composta com hífen, preservando o hífen (`"non-\nliving"` → `"non-living"` — nunca remover o hífen); (2) aspas/apóstrofos tipográficos → ASCII reto (`’ ‘` → `'`; `" "` → `"`). Nada além disso — travessão `–`, espaçamento e outros símbolos (`■ † ‡ ½ ¾ °`) ficam intocados.
- 5 capítulos desta fase: `creating-a-character` (25–60), `skills-and-talents` (61–72), `weapons` (73–90), `spells` (91–136), `equipment` (147–164). Capítulo 8 (Red Powder) fica de fora.
- `extract/raw/` é versionado (não gitignored).

---

### Task 1: `chapters.json` — configuração de páginas e exceções de largura total

**Files:**
- Create: `scripts/extract/chapters.json`

**Interfaces:**
- Consumes: nada.
- Produces: o objeto de configuração `{ [chapterId]: { title, startPage, endPage, fullWidthPages } }` que `pdf2txt.mjs` (Task 3) lê para decidir, por página, se extrai em coluna dupla ou largura total.

Os valores abaixo já foram determinados por inspeção real das 130 páginas dos 5 capítulos (não são estimativas): para cada página com um cabeçalho de tabela (`Table \d+–`), comparou-se a extração em coluna dupla contra a de largura total — uma tabela cujo cabeçalho ou colunas de dados aparecem truncados no recorte de coluna entra em `fullWidthPages`.

- [ ] **Step 1: Criar `scripts/extract/chapters.json`**

```json
{
  "creating-a-character": {
    "title": "Creating a Character",
    "startPage": 25,
    "endPage": 60,
    "fullWidthPages": [27, 30, 32, 34, 36, 38, 41, 44, 48, 52, 55, 59]
  },
  "skills-and-talents": {
    "title": "Ability Checks, Skills, & Talents",
    "startPage": 61,
    "endPage": 72,
    "fullWidthPages": []
  },
  "weapons": {
    "title": "Weapons & Weapon Proficiency",
    "startPage": 73,
    "endPage": 90,
    "fullWidthPages": [74, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 89]
  },
  "spells": {
    "title": "Spells & Spell Casting",
    "startPage": 91,
    "endPage": 136,
    "fullWidthPages": [93, 94, 95, 103]
  },
  "equipment": {
    "title": "Equipping for Adventure",
    "startPage": 147,
    "endPage": 164,
    "fullWidthPages": [152, 153, 156, 159, 163]
  }
}
```

Nota sobre `fullWidthPages` de cada capítulo, para quem for revisar ou
estender esta lista no futuro:

- **creating-a-character:** as tabelas "Abilities by Level" (uma por
  classe, ex. Table 4-2a) têm uma coluna final de texto livre ("Abilities")
  que estoura a largura de uma coluna — full-width. "Saves by Level"
  (4-2b, 4-3b, ...) e "Talents by Level" (4-7c, 4-8c, ...) e "Prime
  Ability Scores" (4-1) são estreitas e cabem numa coluna — não entram na
  lista. "Turning Undead" (4-3c, p.32) e "Commanding Animals" (4-4c, p.36)
  têm muitas colunas — full-width.
- **skills-and-talents:** a única tabela do capítulo (5-1: Skills by
  Ability Score, p.62) é estreita — cabe numa coluna.
- **weapons:** toda tabela de proficiência de arma (formato "vs Armed
  Opponents" / "vs Unarmed Opponents", 6 colunas: None/Basic/Skilled/
  Expert/Master/Grand Master) é full-width, incluindo a Tabela 6-1 (Weapon
  Summary, p.74) e as Tabelas 6-41/6-42 (p.89). Páginas 75, 88 e 90 são
  prosa (Special Weapon Rules, Weapon Abilities) — coluna dupla normal.
- **spells:** as 3 tabelas de "Spells by Circle" (Cleric/Druid/Wizard,
  p.93-95) e a Tabela 7-4 (Contact Outer Plane, p.103) são full-width. As
  páginas 93 e 103 também contêm prosa de duas colunas compartilhando a
  página com a tabela — ver a seção 10 do spec desta fase sobre a
  degradação de ordem de leitura aceita nesses dois casos.
- **equipment:** Tabela 9-3 (Armour, p.152), 9-4/9-5/9-6 (Pack Animals/
  Land Transport/Barding, p.153), 9-7 (Ships, p.156), 9-9 (Hirelings,
  p.159) e 9-12 (Siege Equipment, p.163) são full-width. Tabela 9-1
  (Mundane Items, p.148), 9-2 (Weapons, p.150) e 9-8 (Buildings, p.158)
  são estreitas — cabem numa coluna.

- [ ] **Step 2: Validar sintaxe e estrutura do JSON**

Run:
```bash
node -e "
const c = JSON.parse(require('fs').readFileSync('scripts/extract/chapters.json', 'utf8'));
const ids = Object.keys(c);
console.assert(ids.length === 5, 'esperava 5 capítulos, achou ' + ids.length);
for (const id of ids) {
   const ch = c[id];
   console.assert(typeof ch.title === 'string' && ch.title.length > 0, id + ': title inválido');
   console.assert(Number.isInteger(ch.startPage) && Number.isInteger(ch.endPage) && ch.startPage < ch.endPage, id + ': páginas inválidas');
   console.assert(Array.isArray(ch.fullWidthPages), id + ': fullWidthPages não é array');
   for (const p of ch.fullWidthPages) {
      console.assert(p >= ch.startPage && p <= ch.endPage, id + ': página ' + p + ' fora da faixa do capítulo');
   }
}
console.log('chapters.json: estrutura OK,', ids.length, 'capítulos');
"
```
Expected: imprime `chapters.json: estrutura OK, 5 capítulos`, sem `Assertion failed`.

- [ ] **Step 3: Confirmar por amostragem que o `pdftotext` do sistema está disponível e as coordenadas de corte batem com o que este plano assume**

Você precisa da variável `DD4_PDF_PATH` apontando para o PDF de *Dark
Dungeons (4th Edition)* para este step (ex.:
`export DD4_PDF_PATH=~/Documentos/DD4/Dark_Dungeons_\(4th_Edition\).pdf`).

Run (confirma uma tabela estreita, que deve caber por completo na coluna
esquerda — Tabela 4-2b, Battlemage Saves by Level, p.28):
```bash
pdftotext -f 28 -l 28 -x 18 -y 36 -W 282 -H 720 -layout "$DD4_PDF_PATH" -
```
Expected: a saída mostra a tabela inteira, com as 5 colunas (Doom, Ray,
Stasis, Blast, Spell) e seus valores, sem nenhum título ou dado cortado.

Run (confirma uma tabela full-width, que deve aparecer truncada na coluna
esquerda — Tabela 6-2a, Axe Battle, p.76):
```bash
pdftotext -f 76 -l 76 -x 18 -y 36 -W 282 -H 720 -layout "$DD4_PDF_PATH" -
```
Expected: o título aparece cortado (`Table 6–2a: Axe, Battle` sem o resto)
e faltam colunas de dados — confirma por que p.76 está em `fullWidthPages`.

- [ ] **Step 4: Commit**

```bash
git add scripts/extract/chapters.json
git commit -m "feat: chapters.json mapping the 5 Phase 2 chapters and their full-width table pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DerAeogX9ktF8XzEXXJHbP"
```

---

### Task 2: `normalize.mjs` — funções puras de normalização de texto

**Files:**
- Create: `scripts/extract/normalize.mjs`
- Test: `scripts/extract/normalize.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `dehyphenate(text: string) -> string`
  - `straightenQuotes(text: string) -> string`

  Estas duas funções são chamadas por `pdf2txt.mjs` (Task 3), em sequência
  (`dehyphenate` primeiro, depois `straightenQuotes`), sobre o texto de
  cada página já extraída, antes de concatenar as páginas do capítulo.

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `scripts/extract/normalize.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { dehyphenate, straightenQuotes } from "./normalize.mjs";

test("dehyphenate joins a compound word wrapped across a line break, keeping the hyphen", () => {
   const input = "any non-\nliving creatures such as automatons";
   assert.equal(dehyphenate(input), "any non-living creatures such as automatons");
});

test("dehyphenate handles multiple occurrences in the same text", () => {
   const input = "all non-\nmagical missiles and all non-\nliving creatures";
   assert.equal(dehyphenate(input), "all non-magical missiles and all non-living creatures");
});

test("dehyphenate leaves an inline compound hyphen untouched", () => {
   const input = "found in desert or semi-desert terrain";
   assert.equal(dehyphenate(input), "found in desert or semi-desert terrain");
});

test("dehyphenate leaves an em-dash used as a table 'no value' marker untouched", () => {
   const input = "Attack Bonus      –             –               +1";
   assert.equal(dehyphenate(input), input);
});

test("dehyphenate leaves text with no line-wrapped hyphen unchanged", () => {
   const input = "A short blade with a one-handed grip.";
   assert.equal(dehyphenate(input), input);
});

test("straightenQuotes converts curly single quotes and apostrophes to ASCII", () => {
   const input = "the wielder’s off hand, ‘simple’ to use";
   assert.equal(straightenQuotes(input), "the wielder's off hand, 'simple' to use");
});

test("straightenQuotes converts curly double quotes to ASCII", () => {
   const input = "a “simple” weapon";
   assert.equal(straightenQuotes(input), 'a "simple" weapon');
});

test("straightenQuotes leaves text with no typographic quotes unchanged", () => {
   const input = "A 1' to 2' length of wood dipped in pitch or tallow.";
   assert.equal(straightenQuotes(input), input);
});

test("straightenQuotes does not affect the en-dash table marker", () => {
   const input = "Hurl Range       –             –                –";
   assert.equal(straightenQuotes(input), input);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test scripts/extract/normalize.test.mjs`
Expected: FAIL — `Cannot find module './normalize.mjs'` (o arquivo ainda
não existe).

- [ ] **Step 3: Implementar `scripts/extract/normalize.mjs`**

```javascript
/**
 * Rejoin a hyphenated compound word that wraps across a line break,
 * preserving the hyphen. Dark Dungeons uses ragged-right (non-justified)
 * text — every real occurrence of a line-ending hyphen in the book's
 * text is a compound word (non-living, non-magical, life-force,
 * semi-desert) that happens to wrap at its own hyphen, never a word
 * broken arbitrarily to fit. Removing the hyphen would incorrectly fuse
 * the compound into one word (e.g. "non-living" must not become
 * "nonliving"). The table "no value" marker uses an en-dash (–),
 * a different character from the ASCII hyphen-minus this function
 * matches, so table content is never touched by this function.
 * @param {string} text
 * @returns {string}
 */
export function dehyphenate(text) {
   return text.replace(/([a-z])-\n([a-z])/g, "$1-$2");
}

/**
 * Convert typographic (curly) quotes and apostrophes to straight ASCII,
 * matching the convention the Phase 1 hand-written items already use.
 * Only the quote/apostrophe characters are touched; the en-dash table
 * marker and every other symbol are left as-is.
 * @param {string} text
 * @returns {string}
 */
export function straightenQuotes(text) {
   return text
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"');
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test scripts/extract/normalize.test.mjs`
Expected: PASS — 9 testes, 0 falhas.

- [ ] **Step 5: Rodar via `npm test`**

Run: `npm test`
Expected: `node --test scripts/extract/*.test.mjs` agora roda tanto
`validate.test.mjs` (da Fase 1, 7 testes) quanto `normalize.test.mjs` (9
testes) — 16 testes, 0 falhas.

- [ ] **Step 6: Commit**

```bash
git add scripts/extract/normalize.mjs scripts/extract/normalize.test.mjs
git commit -m "feat: text normalization (hyphen-preserving line-wrap join, straight quotes)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DerAeogX9ktF8XzEXXJHbP"
```

---

### Task 3: `pdf2txt.mjs` — CLI de extração

**Files:**
- Create: `scripts/extract/pdf2txt.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: `dehyphenate`, `straightenQuotes` de `./normalize.mjs` (Task
  2); a configuração de `chapters.json` (Task 1).
- Produces: o comando `node scripts/extract/pdf2txt.mjs --chapter <id> |
  --all`, que a Task 4 usa para gerar os 5 arquivos de
  `extract/raw/`.

- [ ] **Step 1: Criar `scripts/extract/pdf2txt.mjs`**

```javascript
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dehyphenate, straightenQuotes } from "./normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAPTERS_PATH = path.join(__dirname, "chapters.json");

// Fixed for the whole book: every page is 612x792pt (confirmed via
// `pdfinfo`), and the two-column body text sits within these bounds.
// H=720 starting at y=36 already excludes the page-number footer.
const LEFT_COLUMN = { x: 18, y: 36, W: 282, H: 720 };
const RIGHT_COLUMN = { x: 312, y: 36, W: 264, H: 720 };

/**
 * Run pdftotext over one page, optionally cropped to a column box.
 * @param {string} pdfPath
 * @param {number} pageNum
 * @param {{x:number,y:number,W:number,H:number}|null} box - null means
 *   full page width (used for pages with a full-width table).
 * @returns {string}
 */
function extractRegion(pdfPath, pageNum, box) {
   const args = ["-f", String(pageNum), "-l", String(pageNum), "-layout"];
   if (box) {
      args.push("-x", String(box.x), "-y", String(box.y), "-W", String(box.W), "-H", String(box.H));
   }
   args.push(pdfPath, "-");
   return execFileSync("pdftotext", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
}

/**
 * Extract one page, applying the column split unless it is a declared
 * full-width (table) page.
 * @param {string} pdfPath
 * @param {number} pageNum
 * @param {boolean} isFullWidth
 * @returns {string}
 */
function extractPage(pdfPath, pageNum, isFullWidth) {
   if (isFullWidth) {
      return extractRegion(pdfPath, pageNum, null);
   }
   const left = extractRegion(pdfPath, pageNum, LEFT_COLUMN);
   const right = extractRegion(pdfPath, pageNum, RIGHT_COLUMN);
   return `${left}\n${right}`;
}

/**
 * Extract and normalize one full chapter into a single text blob, with a
 * "--- page N ---" marker before each page's content so a reader (or a
 * future Phase 3 parser) can locate the source page of any snippet.
 * @param {string} pdfPath
 * @param {{startPage:number,endPage:number,fullWidthPages:number[]}} chapter
 * @returns {string}
 */
export function extractChapter(pdfPath, chapter) {
   const fullWidthSet = new Set(chapter.fullWidthPages);
   const pageBlocks = [];
   for (let page = chapter.startPage; page <= chapter.endPage; page++) {
      const raw = extractPage(pdfPath, page, fullWidthSet.has(page));
      const normalized = straightenQuotes(dehyphenate(raw));
      pageBlocks.push(`--- page ${page} ---\n${normalized}`);
   }
   return pageBlocks.join("\n\n");
}

function parseArgs(argv) {
   const chapterIndex = argv.indexOf("--chapter");
   return {
      chapter: chapterIndex !== -1 ? argv[chapterIndex + 1] : null,
      all: argv.includes("--all"),
   };
}

function main() {
   const pdfPath = process.env.DD4_PDF_PATH;
   if (!pdfPath) {
      console.error("DD4_PDF_PATH is not set. Point it at your copy of Dark_Dungeons_(4th_Edition).pdf, e.g.:");
      console.error('  export DD4_PDF_PATH="$HOME/Documentos/DD4/Dark_Dungeons_(4th_Edition).pdf"');
      process.exit(1);
   }
   if (!fs.existsSync(pdfPath)) {
      console.error(`DD4_PDF_PATH points to a file that does not exist: ${pdfPath}`);
      process.exit(1);
   }

   const chapters = JSON.parse(fs.readFileSync(CHAPTERS_PATH, "utf8"));
   const { chapter, all } = parseArgs(process.argv.slice(2));

   let idsToRun;
   if (all) {
      idsToRun = Object.keys(chapters);
   } else if (chapter && chapters[chapter]) {
      idsToRun = [chapter];
   } else {
      console.error(`Usage: node scripts/extract/pdf2txt.mjs --chapter <id> | --all`);
      console.error(`Available chapters: ${Object.keys(chapters).join(", ")}`);
      process.exit(1);
   }

   const outDir = path.join(process.cwd(), "extract", "raw");
   fs.mkdirSync(outDir, { recursive: true });

   for (const id of idsToRun) {
      const ch = chapters[id];
      console.log(`Extracting ${id} (pages ${ch.startPage}-${ch.endPage})...`);
      const text = extractChapter(pdfPath, ch);
      const outPath = path.join(outDir, `${id}.txt`);
      fs.writeFileSync(outPath, text, "utf8");
      console.log(`  wrote ${outPath} (${text.length} chars)`);
   }
}

if (process.argv[1] && process.argv[1].endsWith("pdf2txt.mjs")) {
   main();
}
```

- [ ] **Step 2: Checar sintaxe**

Run: `node --check scripts/extract/pdf2txt.mjs`
Expected: nenhum output (sintaxe válida).

- [ ] **Step 3: Testar a mensagem de erro sem `DD4_PDF_PATH`**

Run: `unset DD4_PDF_PATH && node scripts/extract/pdf2txt.mjs --chapter equipment`
Expected: imprime a mensagem `DD4_PDF_PATH is not set...` e sai com código
diferente de zero (`echo $?` mostra um valor diferente de 0).

- [ ] **Step 4: Atualizar `README.md`**

Adicione uma seção nova ao `README.md`, depois da seção "## Development"
já existente:

```markdown
## Extracting the source PDF (Phase 2+)

The compendium content is derived from *Dark Dungeons, 4th Edition*
(Gurbintroll Games). The PDF itself is never committed to this
repository — point the extraction tool at your own copy:

```bash
export DD4_PDF_PATH="$HOME/Documentos/DD4/Dark_Dungeons_(4th_Edition).pdf"
node scripts/extract/pdf2txt.mjs --chapter equipment   # one chapter
node scripts/extract/pdf2txt.mjs --all                 # all chapters in scripts/extract/chapters.json
```

Output lands in `extract/raw/<chapter-id>.txt`, versioned and
human-auditable. See `docs/superpowers/specs/2026-09-17-fase2-extracao-pdf-design.md`
for how the extraction and normalization work.
```

- [ ] **Step 5: Commit**

```bash
git add scripts/extract/pdf2txt.mjs README.md
git commit -m "feat: pdf2txt.mjs extraction CLI with column/full-width page handling

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DerAeogX9ktF8XzEXXJHbP"
```

---

### Task 4: Extração dos 5 capítulos e verificação de ponta a ponta

**Files:**
- Create: `extract/raw/creating-a-character.txt`
- Create: `extract/raw/skills-and-talents.txt`
- Create: `extract/raw/weapons.txt`
- Create: `extract/raw/spells.txt`
- Create: `extract/raw/equipment.txt`

**Interfaces:**
- Consumes: `node scripts/extract/pdf2txt.mjs --all` (Task 3).
- Produces: os 5 arquivos de `extract/raw/`, que a Fase 3 (parsers de
  domínio, fora deste plano) vai consumir.

Esta tarefa exige `DD4_PDF_PATH` definido e apontando para o PDF real.

- [ ] **Step 1: Rodar a extração de todos os 5 capítulos**

Run:
```bash
export DD4_PDF_PATH="$HOME/Documentos/DD4/Dark_Dungeons_(4th_Edition).pdf"
node scripts/extract/pdf2txt.mjs --all
```
Expected: 5 linhas `Extracting <id> (pages X-Y)...` seguidas de `wrote
extract/raw/<id>.txt (N chars)`, uma por capítulo, sem exceção lançada.

- [ ] **Step 2: Verificar que cada arquivo começa com o título esperado do capítulo**

Run:
```bash
for f in creating-a-character skills-and-talents weapons spells equipment; do
  echo "=== $f ==="
  head -5 "extract/raw/$f.txt"
done
```
Expected: `creating-a-character.txt` menciona "Chapter 4" e "Creating a
Character" perto do topo; `skills-and-talents.txt` menciona "Chapter 5";
`weapons.txt` menciona "Chapter 6"; `spells.txt` menciona "Chapter 7";
`equipment.txt` menciona "Chapter 9" e "Equipping for Adventure" — em
todos os casos dentro das primeiras linhas do bloco `--- page N ---`
correspondente à primeira página do capítulo.

- [ ] **Step 3: Confirmar que nenhuma linha mistura coluna esquerda e direita**

Sintoma original (antes do recorte): um verbete de magia e o próximo
aparecendo lado a lado na mesma linha (ex.: "Analyse" e "Animate Objects"
na p.98). Verificar que isso não ocorre mais:

Run:
```bash
grep -n "^Analyse" extract/raw/spells.txt
grep -n "^Animate Objects" extract/raw/spells.txt
```
Expected: as duas linhas existem, em linhas DIFERENTES do arquivo (não na
mesma linha, não intercaladas), com o conteúdo de "Analyse" terminando
antes de "Animate Objects" começar.

- [ ] **Step 4: Confirmar que as tabelas de largura total não aparecem truncadas**

Run:
```bash
grep -A6 "Table 6–2a" extract/raw/weapons.txt
```
Expected: a linha do título aparece completa (`Table 6–2a: Axe, Battle vs
Armed Opponents`, sem corte), seguida das 6 colunas de dados (None, Basic,
Skilled, Expert, Master, Grand Master) com todos os valores — não apenas
os primeiros caracteres de cada célula.

- [ ] **Step 5: Confirmar que a normalização de hífen rodou**

Run:
```bash
grep -n -- "[a-z]-$" extract/raw/*.txt
```
Expected: nenhuma saída (nenhuma linha termina em hífen seguido de letra
minúscula — todas as ocorrências reais identificadas no planejamento,
como "non-living" e "life-force", já foram religadas pelo
`dehyphenate`).

Run:
```bash
grep -n "non-living\|non-magical\|life-force\|semi-desert" extract/raw/spells.txt extract/raw/equipment.txt
```
Expected: as palavras aparecem inteiras, com o hífen preservado
(confirma que `dehyphenate` juntou a linha sem destruir a palavra
composta).

- [ ] **Step 6: Confirmar que não sobrou nenhuma aspa/apóstrofo tipográfico**

Run:
```bash
grep -c $'[‘’“”]' extract/raw/*.txt
```
Expected: `0` para cada um dos 5 arquivos (o comando pode reportar "no
matches found" ou `0`, dependendo do shell — o importante é que nenhum
arquivo tenha contagem maior que zero).

- [ ] **Step 7: Amostragem manual das duas páginas com tabela + prosa mista (p.93, p.103)**

Estas são as duas páginas onde o spec (seção 10) documenta e aceita uma
degradação conhecida na ordem de leitura da prosa ao redor da tabela.

Run:
```bash
sed -n '/--- page 93 ---/,/--- page 94 ---/p' extract/raw/spells.txt
sed -n '/--- page 103 ---/,/--- page 104 ---/p' extract/raw/spells.txt
```
Expected: a tabela (Table 7-1: Cleric Spells by Circle na p.93; Table 7-4:
Contact Outer Plane na p.103) aparece completa e legível. A prosa ao redor
pode ter parágrafos fora da ordem de leitura estritamente linear (ex.:
um cabeçalho de magia como "PREPARING SPELLS" podendo aparecer na mesma
linha que o fim de uma frase da coluna vizinha) — isso é esperado e
aceito por esta fase; não é motivo para reabrir a tarefa. Se, em vez
disso, você encontrar uma tabela com dados numéricos incorretos ou
ausentes nessas duas páginas, isso SERIA um problema (a normalização não
deve alterar números) — investigue antes de prosseguir.

- [ ] **Step 8: Commit**

```bash
git add extract/raw
git commit -m "feat: extract/raw text for the 5 Phase 2 chapters (creating-a-character, skills-and-talents, weapons, spells, equipment)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DerAeogX9ktF8XzEXXJHbP"
```

Este commit é o critério de conclusão da Fase 2: `extract/raw/*.txt`
existe para os 5 capítulos, é legível, sem intercalamento de coluna, sem
tabela truncada, e as duas normalizações rodaram.

---

## Fim da Fase 2

Ao final da Task 4, o repositório tem uma ferramenta de extração
reutilizável (`pdf2txt.mjs` + `chapters.json`, extensível para capítulos
futuros só editando o config) e o texto bruto normalizado dos 5 domínios
que a Fase 3 vai processar. Próximo passo: um novo spec/plano por domínio
da Fase 3 (parser + builder), começando por `equipment`, conforme a seção
7 do spec geral do projeto.
