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
 * Extract a "Name: description" prose block, stopping at the next
 * "Table N" title line or the next named/ALL-CAPS header. Turn
 * Undead/Command Animal (whose own wide table IS part of their
 * content) are handled separately by extractWideTableAbility.
 */
function extractNamedBlock(section, name) {
   const idx = section.indexOf(`${name}:`);
   if (idx === -1) return null;
   const afterStart = idx + name.length + 1;
   const rest = section.slice(afterStart);
   const pattern = /\n[ \t]*(Table \d|[A-Z][A-Za-z '\-]{2,40}:|[A-Z][A-Z ]{3,40}\n)/;
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

/**
 * The book prints the prose before/after a wide reference table (Turn
 * Undead, Command Animal) in two side-by-side columns on the page. A
 * naive single-column join (paragraphsToHtml on the raw line stream)
 * interleaves unrelated sentences from the left and right columns
 * into an unreadable blob. This splits each line at its wide (5+
 * space) gap and reads the left/right streams as two separate,
 * internally-coherent paragraph sequences (concatenated, not
 * interleaved between columns).
 */
function splitColumns(line) {
   const m = line.match(/^(.*?)\s{5,}(\S.*)$/);
   return m ? [m[1], m[2]] : [line, ""];
}

function twoColumnParagraphsToHtml(lines) {
   const leftLines = [];
   const rightLines = [];
   for (const line of lines) {
      const [left, right] = splitColumns(line);
      leftLines.push(left);
      rightLines.push(right);
   }
   return paragraphsToHtml(leftLines.join("\n")) + paragraphsToHtml(rightLines.join("\n"));
}

function parseWideTableLines(lines, colCount) {
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
   return { rows, lastRowLineIdx: i - 1 };
}

/**
 * Extract a wide-table ability (Turn Undead / Command Animal): the
 * numeric table is parsed cell-by-cell as before, but the surrounding
 * prose (before and after the table) is printed in the book as two
 * side-by-side columns — a naive single-column join interleaves
 * unrelated sentences into an unreadable blob. This splits each line
 * at its wide (5+ space) gap and reads the left/right streams as two
 * separate, internally-coherent paragraph sequences (concatenated,
 * not interleaved — cross-column reading order between paragraphs is
 * not fully reconstructed, same accepted-degradation class as other
 * full-width tables already documented in this project).
 *
 * Known residual limitation (accepted, not fixed here): 1-2 legend
 * entries near the END of the post-table explanation (e.g. Command
 * Animal's 'X': entry, Turn Undead's 'd'/'t' entries) still get cut
 * mid-sentence, because the book's left column has fewer lines than
 * the right column in exactly that stretch, so the left stream "runs
 * out" before the right one. This is a physical limitation of the
 * book's two-column layout in that specific region, not a bug in this
 * function.
 */
function extractWideTableAbility(section, name, tableTitle, colCount, labels, displayTitle) {
   const idx = section.indexOf(`${name}:`);
   const afterStart = idx + name.length + 1;
   const rest = section.slice(afterStart);
   const lines = rest.split("\n");
   const titleLineIdx = lines.findIndex((l) => l.includes(tableTitle));
   const { rows, lastRowLineIdx } = parseWideTableLines(lines.slice(titleLineIdx), colCount);

   const beforeLines = lines.slice(0, titleLineIdx);
   const afterLines = lines.slice(titleLineIdx + lastRowLineIdx + 1);

   const beforeHtml = twoColumnParagraphsToHtml(beforeLines);
   const afterHtml = twoColumnParagraphsToHtml(afterLines);
   const header = labels.map((l) => `<th>${l}</th>`).join("");
   const body = rows.map((r) => `<tr><td>${r.level}</td>${r.values.map((v) => `<td>${v}</td>`).join("")}</tr>`).join("");
   const tableHtml = `<p>${displayTitle} (referência, não usado por automação do sistema):</p><table><tr><th>Level</th>${header}</tr>${body}</table>`;

   return beforeHtml + tableHtml + afterHtml;
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
      const description = isWideTableAbility ? null : extractNamedBlock(section, name);
      abilities.push({ classKey, name, levels, changes, description, shared: false });
   }

   const turnUndead = abilities.find((a) => a.classKey === "cleric" && a.name === "Turn Undead");
   turnUndead.description = extractWideTableAbility(
      getAbilitiesSection(rawText, "CLERIC"),
      "Turn Undead",
      "Table 4–3c: Turning Undead by Cleric Level",
      14,
      TURN_UNDEAD_LABELS,
      "Table 4-3c: Turning Undead by Cleric Level"
   );

   const commandAnimal = abilities.find((a) => a.classKey === "druid" && a.name === "Command Animal");
   commandAnimal.description = extractWideTableAbility(
      getAbilitiesSection(rawText, "DRUID"),
      "Command Animal",
      "Table 4–4c: Commanding Animals by Druid Level",
      14,
      COMMAND_ANIMAL_LABELS,
      "Table 4-4c: Commanding Animals by Druid Level"
   );

   const mysticSection = getAbilitiesSection(rawText, "MYSTIC");
   const breathText = extractNamedBlock(mysticSection, "Breath Evasion");
   for (const classKey of SHARED_ABILITY.classes) {
      abilities.push({ classKey, name: SHARED_ABILITY.name, levels: [SHARED_ABILITY.level], changes: null, description: breathText, shared: true });
   }

   const chivalricVows = extractCapsBlock(rawText, "CHIVALRIC VOWS", ["WARDENS", "WARLORDS", "GRENADIER"]);
   const warden = extractCapsBlock(rawText, "WARDENS", ["WARLORDS", "GRENADIER"]);
   const warlord = extractCapsBlock(rawText, "WARLORDS", ["GRENADIER"]);
   // Table 4-5a shows level 8 for Chivalric Vows, but the prose (line ~1101
   // of creating-a-character.txt) says "After reaching 9th level..." — same
   // level as Warden/Warlord. This is a real table-vs-prose discrepancy in
   // the book itself; per the ruling in the Phase 3 design spec ("Riscos e
   // decisões pendentes"), the structured `levels` field uses the prose
   // value (9), since that's the text that actually describes the mechanic.
   abilities.push({ classKey: "fighter", name: "Chivalric Vows", levels: [9], changes: null, description: chivalricVows, shared: false });
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
