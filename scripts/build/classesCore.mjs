import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function deterministicIdInternal(seed) {
   const hash = crypto.createHash("sha1").update(seed).digest();
   let id = "";
   for (let i = 0; i < 16; i++) id += ID_ALPHABET[hash[i] % ID_ALPHABET.length];
   return id;
}

const CLASSES_FOLDER_ID = deterministicIdInternal("folders:Character Classes");

/**
 * Derive a stable 16-char alphanumeric Foundry-style _id from a seed
 * string. Independent copy of the equipment/weapons/weaponMastery/
 * spells/skillsAndTalents domains' function of the same name/shape —
 * no cross-module import.
 * @param {string} seed
 * @returns {string}
 */
export function deterministicId(seed) {
   return deterministicIdInternal(seed);
}

function splitFileName(name) {
   const sanitized = name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
   return `${sanitized}.json`;
}

/**
 * Map one parsed class record (Task 1 shape) to a Foundry `class` Item
 * document (ClassDefinitionDataModel). specialAbilities/classItems are
 * left empty — populated by the "habilidades e talentos" sub-project
 * in a later commit over the same document (same deterministic _id).
 * @param {object} record
 * @returns {object}
 */
export function buildDocument(record) {
   const id = deterministicId(`classes:${record.key}`);
   const description = record.resourceTable ? record.description + record.resourceTable : record.description;

   const levels = record.levels.map((l) => ({
      level: l.level,
      xp: l.xp,
      thbonus: l.thbonus,
      hd: l.hd,
      hdcon: true,
      title: null,
      femaleTitle: null,
      attackRank: null,
   }));

   // The book's own column labels (doom/ray/stasis/blast/spell, kept
   // verbatim in the parser's Record shape) are Dark Dungeons's renamed
   // version of the classic save categories. The fantastic-depths
   // system's own class sheet (templates/item/classdef/saves.hbs)
   // renders this array by looking up each column's real customSaveCode
   // (from separate specialAbility/category:"save" items — e.g. the
   // official fade-compendiums module), not by these book-label keys,
   // so they must be remapped: doom→death (Death Ray or Poison),
   // ray→wand (Magic Wand), stasis→paralysis (Turn to Stone or
   // Paralysis), blast→breath (Dragon Breath), spell→spell (Rods,
   // Staves or Spells) — confirmed against the book's own "doom save"/
   // "stasis save" usage (poison/death and lost-turn contexts
   // respectively) and against real customSaveCode values found live
   // in a Foundry world with fade-compendiums installed.
   const saves = record.saves.map((s) => ({
      level: s.level,
      death: s.doom,
      wand: s.ray,
      paralysis: s.stasis,
      breath: s.blast,
      spell: s.spell,
   }));

   return {
      folder: CLASSES_FOLDER_ID,
      name: record.name,
      _id: id,
      img: "icons/svg/upgrade.svg",
      effects: [],
      ownership: { default: 0 },
      flags: {},
      _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      _originalKey: `!items!${id}`,
      type: "class",
      system: {
         key: record.key,
         species: "Human",
         firstLevel: 1,
         maxLevel: 36,
         firstSpellLevel: 1,
         maxSpellLevel: record.circleCount,
         basicProficiency: record.basicProficiency,
         unskilledToHitMod: -2,
         alignment: "Any",
         description,
         castAsKey: null,
         primeReqs: [{ ability: record.primeAbility, minScore: 0, percentage: 5, concatLogic: "" }],
         levels,
         saves,
         spells: record.spells,
         specialAbilities: [],
         classItems: [],
      },
   };
}

async function ensureClassesFolder(foldersPath) {
   const folders = JSON.parse(await fs.readFile(foldersPath, "utf8"));
   const maxSort = Math.max(0, ...Object.values(folders)
      .filter((f) => f.folder === null)
      .map((f) => f.sort));
   const key = `!folders!${CLASSES_FOLDER_ID}`;
   if (!folders[key]) {
      folders[key] = {
         name: "Character Classes", sorting: "a", folder: null, type: "Item",
         _id: CLASSES_FOLDER_ID, description: "", sort: maxSort + 100000,
         color: "#4a2f3c", flags: {},
         _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      };
      await fs.writeFile(foldersPath, JSON.stringify(folders, null, 2) + "\n", "utf8");
   }
}

async function main() {
   const parsedPath = path.join(process.cwd(), "extract", "parsed", "classesCore.json");
   const records = JSON.parse(await fs.readFile(parsedPath, "utf8"));

   const foldersPath = path.join(process.cwd(), "packsrc", "items", "_folders.json");
   await ensureClassesFolder(foldersPath);

   const dir = path.join(process.cwd(), "packsrc", "items", "Character_Classes");
   await fs.mkdir(dir, { recursive: true });

   for (const record of records) {
      const doc = buildDocument(record);
      await fs.writeFile(path.join(dir, splitFileName(record.name)), JSON.stringify(doc, null, 2) + "\n", "utf8");
   }
   console.log(`wrote ${records.length} class document(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
