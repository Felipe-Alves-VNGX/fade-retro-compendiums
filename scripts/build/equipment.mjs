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

/**
 * Find the narrative description paragraph for an item by matching a
 * "<Name>: " line header in the chapter's raw text, trying the full name
 * first and then the name with a trailing "(...)" qualifier stripped
 * (many table rows add a qualifier — e.g. "Backpack (holds 40lb)" — that
 * the book's own prose header omits — e.g. "Backpack: ..."). Returns null,
 * never throws, when neither candidate has a matching header; the caller
 * is responsible for logging that as a warning.
 * @param {string} name
 * @param {string} rawText
 * @returns {string | null}
 */
function hasInteriorGap(line) {
   return /\S\s{5,}\S/.test(line);
}

function stripPageBoundaries(text) {
   return text
      .replace(/\f/g, "")
      .replace(/\n[ \t]*\n+[ \t]*\d{1,4}[ \t]*\n[ \t]*\n*--- page \d+ ---\n/g, "\n");
}

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
         if (hasInteriorGap(trimmedHeader)) return null;

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

   return {
      ...base,
      type: "item",
      system: baseGearSystem({
         description,
         quantity: row.bundleQty,
         weightLb: row.weightLb,
         cost: row.cost,
         gmNotes: costNote(row.cost),
      }),
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
