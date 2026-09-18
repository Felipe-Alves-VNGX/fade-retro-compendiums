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
