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
