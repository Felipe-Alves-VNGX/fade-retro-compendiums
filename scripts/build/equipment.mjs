import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ADVENTURING_GEAR_FOLDER_ID = "vItxVSiPb4vq0Mmc";
const ARMOUR_FOLDER_ID = "48tCQXEOwmD69xw2";
const CURRENCY_TO_GP = { cp: 0.01, sp: 0.1, ep: 0.5, pp: 5, gp: 1 };

/**
 * Derive a stable 16-char alphanumeric Foundry-style _id from a seed
 * string, so re-running the builder over the same input never changes
 * an existing document's identity.
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

function escapeRegExp(value) {
   return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasInteriorGap(line) {
   return /\S\s{5,}\S/.test(line);
}

// This shape (a page-footer number, a form-feed, then a "--- page N ---"
// marker) is specific to this book's pdftotext-based extraction (Phase 2)
// and would need re-verifying against a different source.
function stripPageBoundaries(text) {
   return text
      .replace(/\f/g, "")
      .replace(/\n[ \t]*\n+[ \t]*\d{1,4}[ \t]*\n[ \t]*\n*--- page \d+ ---\n/g, "\n");
}

/**
 * Find the narrative description paragraph for an item by matching a
 * "<Name>: " line header in the chapter's raw text, trying the full name
 * first and then the name with a trailing "(...)" qualifier stripped
 * (many table rows add a qualifier — e.g. "Backpack (holds 40lb)" — that
 * the book's own prose header omits — e.g. "Backpack: ..."). Page-boundary
 * artifacts are stripped before scanning so a paragraph split across pages
 * still reads as one block; a header line with a column-merged gap is
 * rejected (real data) since it means two side-by-side columns of prose got
 * flattened into one unreadable line, while a column-merged or table-title
 * continuation line merely stops the paragraph rather than rejecting the
 * whole match, since the header itself was still clean. Returns null, never
 * throws, when no candidate ever finds a clean header; the caller is
 * responsible for logging that as a warning.
 * @param {string} name
 * @param {string} rawText
 * @returns {string | null}
 */
export function matchDescription(name, rawText) {
   const cleanedText = stripPageBoundaries(rawText);
   const candidates = [name];
   const parenMatch = name.match(/^(.*?)\s*\([^)]*\)\s*$/);
   if (parenMatch) candidates.push(parenMatch[1].trim());

   const lines = cleanedText.split("\n");
   for (const candidate of candidates) {
      const headerRe = new RegExp(`^${escapeRegExp(candidate)}:\\s*(.*)$`, "i");
      for (let i = 0; i < lines.length; i++) {
         const trimmedHeader = lines[i].trim();
         const headerMatch = trimmedHeader.match(headerRe);
         if (!headerMatch) continue;
         if (hasInteriorGap(trimmedHeader)) continue;

         const paragraph = [headerMatch[1]];
         for (let j = i + 1; j < lines.length; j++) {
            const next = lines[j].trim();
            if (next === "") break;
            if (/^Table \d/.test(next)) break;
            if (/^[A-Z][A-Za-z ,'()-]{1,40}:\s/.test(next)) break;
            if (hasInteriorGap(next)) break;
            paragraph.push(next);
         }
         return paragraph.join(" ").trim();
      }
   }
   return null;
}

function splitFileName(name) {
   const sanitized = name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
   return `${sanitized}.json`;
}

function baseGearSystem({ description, quantity, weightLb, cost, gmNotes }) {
   return {
      tags: [],
      description: description ? `<p>${description}</p>` : "",
      gm: { notes: gmNotes ?? "" },
      quantity,
      quantityMax: 0,
      charges: 0,
      chargesMax: 0,
      weight: weightLb * 10,
      weightEquipped: weightLb * 10,
      cost: cost.value * CURRENCY_TO_GP[cost.currency],
      totalWeight: 0,
      totalCost: 0,
      containerId: "",
      equipped: false,
      container: false,
      isOpen: false,
      equippable: true,
      fuelType: "",
      isDropped: false,
      isTreasure: false,
      specialAbilities: [],
      spells: [],
      conditions: [],
      unidentifiedName: "",
      unidentifiedDesc: "",
      isIdentified: true,
      isCursed: false,
   };
}

// Phase 1 hand-wrote Torch as a `light`-subtype item with a full light-emission
// block; the Table 9-1 regeneration must not silently regress that behavior.
// No other mundane item was ever hand-written as `light` in Phase 1, so this
// override stays specific to "Torch" — adding light support for Lantern, Oil
// (flask), etc. is a future domain decision, not part of this fix.
const TORCH_LIGHT_OVERRIDE = {
   tags: ["light-source"],
   isLight: true,
   fuelType: "wood",
   light: {
      enabled: false,
      type: "torch",
      duration: 6,
      radius: 30,
      fuelType: "wood",
      secondsRemain: 0,
      bright: 6,
      color: "#d0a750",
      attenuation: 0.7,
      luminosity: 0.5,
      angle: 360,
      animation: { type: "torch", speed: 2, intensity: 3 },
   },
};

function costNote(cost) {
   if (!cost.isMinimum) return "";
   return `Custo listado como mínimo (${cost.value}+${cost.currency}) no livro.`;
}

/**
 * Map one parsed row (Task 2 shape) to a full Foundry Item document.
 * @param {object} row
 * @param {{ rawText: string }} context - rawText: full extract/raw/equipment.txt, for description matching.
 * @returns {object}
 */
export function buildDocument(row, { rawText }) {
   const description = matchDescription(row.name, rawText);
   if (description === null) {
      console.warn(`[build/equipment] no description match for "${row.name}" (${row.table})`);
   }

   const id = deterministicId(`equipment:${row.name}`);
   const folder = row.table === "armour" ? ARMOUR_FOLDER_ID : ADVENTURING_GEAR_FOLDER_ID;

   const base = {
      folder,
      name: row.name,
      _id: id,
      img: "icons/svg/item-bag.svg",
      effects: [],
      ownership: { default: 0 },
      flags: {},
      _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      _originalKey: `!items!${id}`,
   };

   if (row.table === "armour") {
      return {
         ...base,
         type: "armor",
         system: {
            ...baseGearSystem({
               description,
               quantity: 1,
               weightLb: row.weightLb,
               cost: row.cost,
               gmNotes: costNote(row.cost),
            }),
            ac: row.armourClass,
            isShield: false,
            av: null,
            armorWeight: row.movementRate === "30'" ? "light" : "heavy",
            mod: 0,
            modRanged: 0,
            totalAC: row.armourClass,
            totalRangedAC: row.armourClass,
            totalAAC: row.armourClass,
            totalRangedAAC: row.armourClass,
            natural: false,
         },
      };
   }

   const gearSystem = baseGearSystem({
      description,
      quantity: row.bundleQty,
      weightLb: row.weightLb,
      cost: row.cost,
      gmNotes: costNote(row.cost),
   });

   if (row.name === "Torch") {
      return {
         ...base,
         type: "light",
         system: { ...gearSystem, ...TORCH_LIGHT_OVERRIDE },
      };
   }

   return {
      ...base,
      type: "item",
      system: gearSystem,
   };
}

async function removeIfExists(filePath) {
   try {
      await fs.unlink(filePath);
   } catch (error) {
      if (error.code !== "ENOENT") throw error;
   }
}

async function main() {
   const parsedPath = path.join(process.cwd(), "extract", "parsed", "equipment.json");
   const rawPath = path.join(process.cwd(), "extract", "raw", "equipment.txt");
   const rows = JSON.parse(await fs.readFile(parsedPath, "utf8"));
   const rawText = await fs.readFile(rawPath, "utf8");

   const gearDir = path.join(process.cwd(), "packsrc", "items", "Equipment", "Adventuring_Gear");
   const armourDir = path.join(process.cwd(), "packsrc", "items", "Equipment", "Armour");
   await fs.mkdir(armourDir, { recursive: true });

   await removeIfExists(path.join(gearDir, "Backpack.json"));
   await removeIfExists(path.join(gearDir, "Torch.json"));

   let sort = 100000;
   let written = 0;
   for (const row of rows) {
      const doc = buildDocument(row, { rawText });
      doc.sort = sort;
      sort += 100000;
      const dir = row.table === "armour" ? armourDir : gearDir;
      const filePath = path.join(dir, splitFileName(row.name));
      await fs.writeFile(filePath, JSON.stringify(doc, null, 2) + "\n", "utf8");
      written++;
   }
   console.log(`wrote ${written} item document(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
