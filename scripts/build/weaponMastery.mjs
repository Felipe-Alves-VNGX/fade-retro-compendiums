import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const WEAPON_MASTERIES_FOLDER_ID = "RcR10M9pJBiQMs2H";

const RANK_NAMES = ["None", "Basic", "Skilled", "Expert", "Master", "Grand Master"];
const RANGE_LABELS = new Set(["Hurl Range", "Throw Range", "Missile Range"]);
const SPECIAL_LABELS = ["Deflect", "Disarm", "Hook", "Knockout", "Delay", "Stun", "Strangle", "Entangle", "Skewer", "Off-Hand"];

/**
 * Derive a stable 16-char alphanumeric Foundry-style _id from a seed
 * string. Independent copy of the equipment/weapons domains' function
 * of the same name/shape — no cross-module import.
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

function rowsByLabel(rows) {
   const map = new Map();
   for (const row of rows) map.set(row.label, row.values);
   return map;
}

// The book prints negative numbers with an en-dash (–, U+2013), not the
// ASCII hyphen-minus Number.parseInt expects — without this replace,
// "–1" silently parses as NaN.
function parseNum(value) {
   if (value === "–" || value === undefined) return null;
   const n = Number.parseInt(value.replace(/^–/, "-"), 10);
   return Number.isNaN(n) ? null : n;
}

function parseRangeTriplet(value) {
   if (!value) return { short: 0, medium: 0, long: 0 };
   const parts = value.split("/").map((p) => (p === "–" ? 0 : Number.parseInt(p.replace(/^–/, "-"), 10) || 0));
   return { short: parts[0] || 0, medium: parts[1] || 0, long: parts[2] || 0 };
}

function findRangeRow(map) {
   for (const label of RANGE_LABELS) {
      if (map.has(label)) return map.get(label);
   }
   return null;
}

function buildSpecial(armedMap, unarmedMap, levelIndex) {
   const parts = [];
   for (const label of SPECIAL_LABELS) {
      const values = armedMap.get(label) || unarmedMap.get(label);
      if (!values) continue;
      const value = values[levelIndex];
      if (value === "–" || value === undefined) continue;
      parts.push(value === "Yes" ? label : `${label} ${value}`);
   }
   return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Combine a weapon's "vs Armed" and "vs Unarmed" table rows into the 6
 * MasteryDefinitionDataModel levels (None through Grand Master).
 * @param {Array<{label: string, values: string[]}>} armedRows
 * @param {Array<{label: string, values: string[]}>} unarmedRows
 * @returns {{ levels: object[], acBonusRaw: string | null }}
 */
export function buildLevels(armedRows, unarmedRows) {
   const armedMap = rowsByLabel(armedRows);
   const unarmedMap = rowsByLabel(unarmedRows);
   const pHit = armedMap.get("Attack Bonus");
   const sHit = unarmedMap.get("Attack Bonus");
   const pDmg = armedMap.get("Damage");
   const sDmg = unarmedMap.get("Damage");
   const acRow = unarmedMap.get("AC Bonus") || armedMap.get("AC Bonus");
   const rangeRow = findRangeRow(armedMap) || findRangeRow(unarmedMap);

   const levels = [];
   for (let i = 0; i < 6; i++) {
      const acRaw = acRow ? acRow[i] : "–";
      levels.push({
         name: RANK_NAMES[i],
         range: rangeRow ? parseRangeTriplet(rangeRow[i]) : { short: 0, medium: 0, long: 0 },
         pDmgFormula: pDmg && pDmg[i] !== "–" ? pDmg[i] : null,
         sDmgFormula: sDmg && sDmg[i] !== "–" ? sDmg[i] : null,
         acBonusType: null,
         acBonus: acRaw === "–" ? null : parseNum(acRaw.split("/")[0]),
         acBonusAT: null,
         pToHit: parseNum(pHit ? pHit[i] : "–") ?? 0,
         sToHit: parseNum(sHit ? sHit[i] : "–") ?? 0,
         special: buildSpecial(armedMap, unarmedMap, i),
      });
   }
   return { levels, acBonusRaw: acRow ? acRow.join("/") : null };
}

function splitFileName(name) {
   const sanitized = name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
   return `${sanitized}.json`;
}

/**
 * Map one grouped parser entry (Task 2 shape) to a full Foundry
 * weaponMastery Item document.
 * @param {{ name: string, armed: object[], unarmed: object[] }} entry
 * @returns {object}
 */
export function buildDocument(entry) {
   const { levels, acBonusRaw } = buildLevels(entry.armed, entry.unarmed);
   const id = deterministicId(`weaponMastery:${entry.name}`);

   return {
      folder: WEAPON_MASTERIES_FOLDER_ID,
      name: entry.name,
      _id: id,
      img: "icons/svg/item-bag.svg",
      effects: [],
      ownership: { default: 0 },
      flags: {},
      _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      _originalKey: `!items!${id}`,
      type: "weaponMastery",
      system: {
         name: entry.name,
         weaponType: "handheld",
         primaryType: "all",
         levels,
         gm: { notes: acBonusRaw ? `AC Bonus completo do livro: ${acBonusRaw}` : "" },
      },
   };
}

async function main() {
   const parsedPath = path.join(process.cwd(), "extract", "parsed", "weaponMastery.json");
   const entries = JSON.parse(await fs.readFile(parsedPath, "utf8"));

   const dir = path.join(process.cwd(), "packsrc", "items", "Weapon_Masteries");
   await fs.mkdir(dir, { recursive: true });

   let sort = 100000;
   let written = 0;
   for (const entry of entries) {
      const doc = buildDocument(entry);
      doc.sort = sort;
      sort += 100000;
      const filePath = path.join(dir, splitFileName(entry.name));
      await fs.writeFile(filePath, JSON.stringify(doc, null, 2) + "\n", "utf8");
      written++;
   }
   console.log(`wrote ${written} weaponMastery document(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
