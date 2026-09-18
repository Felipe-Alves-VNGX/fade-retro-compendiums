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
