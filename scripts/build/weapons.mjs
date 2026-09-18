import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const WEAPONS_FOLDER_ID = "2AKCulCJIGNyAMaN";
const CURRENCY_TO_GP = { cp: 0.01, sp: 0.1, ep: 0.5, pp: 5, gp: 1 };

/**
 * Derive a stable 16-char alphanumeric Foundry-style _id from a seed
 * string, so re-running the builder over the same input never changes
 * an existing document's identity. Independent copy of the equipment
 * domain's function of the same name/shape — no cross-module import.
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

/**
 * Normalize a printed trait name into a tag: lowercase, spaces become
 * hyphens. This also converges the book's own inconsistent capitalization
 * ("Off-hand" vs "Off-Hand" both appear) into a single tag.
 * @param {string} trait
 * @returns {string}
 */
export function normalizeTag(trait) {
   return trait.toLowerCase().replace(/\s+/g, "-");
}

function splitFileName(name) {
   const sanitized = name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
   return `${sanitized}.json`;
}

function convertCost(cost) {
   if (cost === null) return 0;
   return cost.value * CURRENCY_TO_GP[cost.currency];
}

/**
 * Map one parsed row (Task 1 shape) to a full Foundry weapon Item document.
 * @param {object} row
 * @returns {object}
 */
export function buildDocument(row) {
   const isNatural = row.section === "unarmed";
   const hasThrow = row.traits.includes("Throw");
   const canRanged = row.section === "ranged" || hasThrow;
   const canMelee = row.section !== "ranged";

   const id = deterministicId(`weapons:${row.name}`);
   const extraGroups = row.masteryGroups.slice(1);
   const gmNotes = extraGroups.length > 0
      ? `Grupos de proficiência adicionais do livro: ${extraGroups.join(", ")}.`
      : "";

   return {
      folder: WEAPONS_FOLDER_ID,
      name: row.name,
      _id: id,
      img: "icons/svg/item-bag.svg",
      effects: [],
      ownership: { default: 0 },
      flags: {},
      _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      _originalKey: `!items!${id}`,
      type: "weapon",
      system: {
         tags: row.traits.map(normalizeTag),
         description: "",
         gm: { notes: gmNotes },
         quantity: 1,
         quantityMax: 0,
         charges: 0,
         chargesMax: 0,
         weight: row.weightLb * 10,
         weightEquipped: row.weightLb * 10,
         cost: convertCost(row.cost),
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
         damageRoll: row.damageRoll,
         damageLabel: row.damageRoll,
         damageType: "physical",
         breath: null,
         canMelee,
         canRanged,
         canSet: false,
         isSlow: false,
         savingThrow: null,
         saveDmgFormula: null,
         mastery: row.masteryGroups[0] ?? "",
         weaponType: "handheld",
         ammoType: "",
         range: { short: null, medium: null, long: null, min: 0 },
         size: null,
         grip: null,
         natural: isNatural,
         mod: { dmg: 0, toHit: 0, dmgRanged: 0, toHitRanged: 0, rangeMultiplier: 1, vsGroup: {} },
         attacks: { used: 0, max: null, group: 0 },
         siege: {
            thac0: null, thbonus: null, crew: null, fullCrew: null,
            fireRate: null, ammoCostWk: null, weightTowed: null, acplus: null, artillerist: false,
         },
      },
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
   const parsedPath = path.join(process.cwd(), "extract", "parsed", "weapons.json");
   const rows = JSON.parse(await fs.readFile(parsedPath, "utf8"));

   const weaponsDir = path.join(process.cwd(), "packsrc", "items", "Equipment", "Weapons");
   await removeIfExists(path.join(weaponsDir, "Dagger.json"));

   let sort = 100000;
   let written = 0;
   for (const row of rows) {
      const doc = buildDocument(row);
      doc.sort = sort;
      sort += 100000;
      const filePath = path.join(weaponsDir, splitFileName(row.name));
      await fs.writeFile(filePath, JSON.stringify(doc, null, 2) + "\n", "utf8");
      written++;
   }
   console.log(`wrote ${written} weapon document(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
