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
   "Damage", "Deflect Penalty", "Deflect", "Disarm", "Hook", "Knockout", "Delay", "Stun",
   "Strangle", "Entangle", "Skewer", "Off-Hand",
].sort((a, b) => b.length - a.length);

// A cell value is normally one whitespace-free token, but some ability rows
// print a compound value with an internal space — "4 HD" (Skewer),
// "20 (+0)" (Strangle), and "–5 vs 4" (Hammer, War's AC Bonus) — that must
// stay together as a single token.
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
