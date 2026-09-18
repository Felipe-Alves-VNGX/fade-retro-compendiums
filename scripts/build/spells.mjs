import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CLASS_ORDER = ["Cleric", "Druid", "Wizard"];
const SPELLS_FOLDER_SORT = 300000; // next top-level slot after Equipment (100000) and Weapon Masteries (200000)

/**
 * Derive a stable 16-char alphanumeric Foundry-style _id from a seed
 * string. Independent copy of the equipment/weapons/weaponMastery
 * domains' function of the same name/shape — no cross-module import.
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
 * Normalize a printed sphere name into a tag: lowercase, spaces become
 * hyphens.
 * @param {string} sphere
 * @returns {string}
 */
export function normalizeTag(sphere) {
   return sphere.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Derive targetSelf/targetOther from the book's free-text Target: value.
 * @param {string} target
 * @returns {{targetSelf: boolean, targetOther: boolean}}
 */
export function mapTarget(target) {
   const t = target.trim().toLowerCase();
   if (t === "none") return { targetSelf: false, targetOther: false };
   if (t.includes("caster") || t.includes("personal")) return { targetSelf: true, targetOther: false };
   return { targetSelf: false, targetOther: true };
}

function splitFileName(name) {
   const sanitized = name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
   return `${sanitized}.json`;
}

/**
 * Map one parsed record (Task 1 shape) to a full Foundry spell Item
 * document.
 * @param {object} record
 * @returns {object}
 */
export function buildDocument(record) {
   const { targetSelf, targetOther } = mapTarget(record.target);
   const id = deterministicId(`spells:${record.name}:${record.class}:${record.circle}`);
   const folderId = deterministicId(`spells-folder:${record.class}:${record.circle}`);

   return {
      folder: folderId,
      name: record.name,
      _id: id,
      img: "icons/svg/book.svg",
      effects: [],
      ownership: { default: 0 },
      flags: {},
      _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      _originalKey: `!items!${id}`,
      type: "spell",
      system: {
         name: record.name,
         tags: record.sphere.map(normalizeTag),
         description: record.description,
         gm: { notes: "" },
         spellLevel: record.circle,
         range: record.range,
         duration: record.duration,
         effect: "",
         memorized: 0,
         cast: 0,
         targetSelf,
         targetOther,
         dmgFormula: null,
         healFormula: null,
         maxTargetFormula: null,
         durationFormula: null,
         savingThrow: null,
         saveDmgFormula: null,
         attackType: "",
         damageType: "",
         conditions: [],
         classes: [],
      },
   };
}

function ensureFolder(folders, { id, name, parent, sort }) {
   const key = `!folders!${id}`;
   if (!folders[key]) {
      folders[key] = {
         name,
         sorting: "a",
         folder: parent,
         type: "Item",
         _id: id,
         description: "",
         sort,
         color: "#2f3c4a",
         flags: {},
         _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      };
   }
}

async function main() {
   const parsedPath = path.join(process.cwd(), "extract", "parsed", "spells.json");
   const records = JSON.parse(await fs.readFile(parsedPath, "utf8"));

   const foldersPath = path.join(process.cwd(), "packsrc", "items", "_folders.json");
   const folders = JSON.parse(await fs.readFile(foldersPath, "utf8"));

   const topId = deterministicId("spells-folder:top");
   ensureFolder(folders, { id: topId, name: "Spells", parent: null, sort: SPELLS_FOLDER_SORT });

   const classFolderIds = {};
   CLASS_ORDER.forEach((cls, idx) => {
      const classId = deterministicId(`spells-folder:${cls}`);
      ensureFolder(folders, { id: classId, name: cls, parent: topId, sort: (idx + 1) * 100000 });
      classFolderIds[cls] = classId;
   });

   const circlesByClass = {};
   for (const r of records) {
      circlesByClass[r.class] ??= new Set();
      circlesByClass[r.class].add(r.circle);
   }
   for (const cls of CLASS_ORDER) {
      const circles = [...(circlesByClass[cls] ?? [])].sort((a, b) => a - b);
      circles.forEach((circle, idx) => {
         const circleId = deterministicId(`spells-folder:${cls}:${circle}`);
         ensureFolder(folders, { id: circleId, name: `Circle ${circle}`, parent: classFolderIds[cls], sort: (idx + 1) * 100000 });
      });
   }

   await fs.writeFile(foldersPath, JSON.stringify(folders, null, 2) + "\n", "utf8");

   const spellsDir = path.join(process.cwd(), "packsrc", "items", "Spells");
   let written = 0;
   for (const record of records) {
      const doc = buildDocument(record);
      const dir = path.join(spellsDir, record.class, `Circle_${record.circle}`);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, splitFileName(record.name)), JSON.stringify(doc, null, 2) + "\n", "utf8");
      written++;
   }
   console.log(`wrote ${written} spell document(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
