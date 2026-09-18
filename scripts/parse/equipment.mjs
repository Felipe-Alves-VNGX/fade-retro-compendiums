import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Includes "cp" deliberately, even though no row in the book currently uses it:
// the builder's CURRENCY_TO_GP table already supports cp, and omitting it here
// would make a future cp-priced row silently vanish instead of failing loudly.
const CURRENCY_PATTERN = "(?:cp|gp|sp|ep|pp)";

const MUNDANE_ROW_RE = new RegExp(
   `^\\s*(.+?)\\s{2,}(\\d+(?:\\.\\d+)?)lb\\s{2,}(\\d+(?:\\.\\d+)?)(\\+)?(${CURRENCY_PATTERN})\\s*$`
);
const ARMOUR_ROW_RE = new RegExp(
   `^\\s*(.+?)\\s{2,}(\\d+)\\s{2,}(\\d+(?:\\.\\d+)?)lb\\s{2,}(\\d+(?:\\.\\d+)?)(\\+)?(${CURRENCY_PATTERN})\\s{2,}(\\d+)'\\s*$`
);
const BUNDLE_PREFIX_RE = /^(\d+)\s+(.+)$/;

function extractBlock(rawText, startMarker, endMarker) {
   const startIndex = rawText.indexOf(startMarker);
   if (startIndex === -1) return "";
   const afterStart = startIndex + startMarker.length;
   const endIndex = endMarker ? rawText.indexOf(endMarker, afterStart) : -1;
   return endIndex === -1 ? rawText.slice(afterStart) : rawText.slice(afterStart, endIndex);
}

function parseCost(value, plus, currency) {
   return {
      value: Number.parseFloat(value),
      currency,
      isMinimum: plus === "+",
   };
}

function splitBundle(rawName) {
   const match = rawName.match(BUNDLE_PREFIX_RE);
   if (!match) return { bundleQty: 1, name: rawName };
   return { bundleQty: Number.parseInt(match[1], 10), name: match[2] };
}

function parseMundaneItemsBlock(block) {
   const rows = [];
   for (const line of block.split("\n")) {
      const match = line.match(MUNDANE_ROW_RE);
      if (!match) continue;
      const [, rawName, weightLb, costValue, costPlus, currency] = match;
      const { bundleQty, name } = splitBundle(rawName.trim());
      rows.push({
         table: "mundane-items",
         name,
         bundleQty,
         weightLb: Number.parseFloat(weightLb),
         cost: parseCost(costValue, costPlus, currency),
      });
   }
   return rows;
}

function parseArmourBlock(block) {
   const rows = [];
   for (const line of block.split("\n")) {
      const match = line.match(ARMOUR_ROW_RE);
      if (!match) continue;
      const [, rawName, armourClass, weightLb, costValue, costPlus, currency, movement] = match;
      rows.push({
         table: "armour",
         name: rawName.trim(),
         armourClass: Number.parseInt(armourClass, 10),
         weightLb: Number.parseFloat(weightLb),
         cost: parseCost(costValue, costPlus, currency),
         movementRate: `${movement}'`,
      });
   }
   return rows;
}

/**
 * Parse Table 9-1 (Mundane Items) and Table 9-3 (Armour) out of the
 * chapter 9 raw text produced by Phase 2's pdf2txt.mjs.
 * @param {string} rawText - full contents of extract/raw/equipment.txt
 * @returns {Array<object>} rows, see plan Task 2 "Produces" for shape
 */
export function parseEquipment(rawText) {
   const mundaneBlock = extractBlock(rawText, "Table 9–1: Mundane Items", "Table 9–2");
   const armourBlock = extractBlock(rawText, "Table 9–3: Armour", "Table 9–4");
   return [...parseMundaneItemsBlock(mundaneBlock), ...parseArmourBlock(armourBlock)];
}

async function main() {
   const rawPath = path.join(process.cwd(), "extract", "raw", "equipment.txt");
   const rawText = await fs.readFile(rawPath, "utf8");
   const rows = parseEquipment(rawText);
   const outDir = path.join(process.cwd(), "extract", "parsed");
   await fs.mkdir(outDir, { recursive: true });
   const outPath = path.join(outDir, "equipment.json");
   await fs.writeFile(outPath, JSON.stringify(rows, null, 2) + "\n", "utf8");
   console.log(`wrote ${outPath} (${rows.length} rows)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
