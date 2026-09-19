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

/**
 * Derive a stable 16-char alphanumeric Foundry-style _id from a seed
 * string. Independent copy of the equipment/weapons/weaponMastery/
 * spells/skillsAndTalents/classesCore domains' function of the same
 * name/shape — no cross-module import.
 * @param {string} seed
 * @returns {string}
 */
export function deterministicId(seed) {
   return deterministicIdInternal(seed);
}

const CLASS_ABILITIES_FOLDER_ID = deterministicIdInternal("folders:Class Abilities");

function splitFileName(name) {
   return `${name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}.json`;
}

/**
 * Build a specialAbility Item document for a class-granted ability.
 * `classKey: null` marks a shared ability (Breath Evasion) owned by
 * no single class.
 * @param {{name: string, description: string, classKey: string|null, notes?: string|null}} ability
 * @returns {object}
 */
export function buildAbilityDocument(ability) {
   const seed = ability.classKey ? `classAbilities:${ability.classKey}:${ability.name}` : `classAbilities:shared:${ability.name}`;
   const id = deterministicId(seed);
   return {
      folder: CLASS_ABILITIES_FOLDER_ID,
      name: ability.name,
      _id: id,
      img: "icons/svg/upgrade.svg",
      effects: [],
      ownership: { default: 0 },
      flags: {},
      _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      _originalKey: `!items!${id}`,
      type: "specialAbility",
      system: {
         tags: [],
         description: ability.description,
         gm: { notes: ability.notes ?? "" },
         rollFormula: "",
         operator: "",
         target: "",
         rollMode: "publicroll",
         autoSuccess: null,
         autoFail: null,
         abilityMod: "",
         savingThrow: null,
         dmgFormula: null,
         healFormula: null,
         damageType: "",
         category: "class",
         shortName: "",
         combatManeuver: null,
         customSaveCode: null,
         classKey: ability.classKey,
         showResult: true,
         quantity: 1,
         quantityMax: null,
         conditions: [],
      },
   };
}

/**
 * Expand one parsed ability record into classDefinition.specialAbilities[]
 * entries for the granting class — one per level/tier.
 *
 * `classKey` here is the LINK's classKey, which fantastic-depths'
 * `finder.ts::_getSpecialAbility` requires to MATCH the classKey of the
 * referenced `specialAbility` item (or both `null`) — it is NOT
 * necessarily the granting class's own key. Pass `null` for shared
 * items (e.g. Breath Evasion) and for talent items, since those items
 * always have `classKey: null`; pass the class's own key only when the
 * referenced item is itself owned by that class.
 * @param {{name: string, levels: number[], changes: string[]|null}} record
 * @param {string|null} classKey
 * @returns {object[]}
 */
export function buildSpecialAbilityLinks(record, classKey) {
   return record.levels.map((level, i) => ({
      name: record.name,
      uuid: "",
      level,
      target: null,
      classKey,
      changes: record.changes ? record.changes[i] : "",
   }));
}

/**
 * Build a classDefinition.specialAbilities[] link to a Talent item
 * (domain `skills`). Talent items always have `classKey: null`, so per
 * `finder.ts::_getSpecialAbility`'s lookup rule the link must too —
 * regardless of which class is granting it (Finding C1).
 * @param {string} talentName
 * @param {number} level
 * @returns {object}
 */
export function buildTalentLink(talentName, level) {
   return { name: talentName, uuid: "", level, target: null, classKey: null, changes: "" };
}

async function ensureClassAbilitiesFolder(foldersPath) {
   const folders = JSON.parse(await fs.readFile(foldersPath, "utf8"));
   const maxSort = Math.max(0, ...Object.values(folders).filter((f) => f.folder === null).map((f) => f.sort));
   const key = `!folders!${CLASS_ABILITIES_FOLDER_ID}`;
   if (!folders[key]) {
      folders[key] = {
         name: "Class Abilities", sorting: "a", folder: null, type: "Item",
         _id: CLASS_ABILITIES_FOLDER_ID, description: "", sort: maxSort + 100000,
         color: "#3c4a2f", flags: {},
         _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      };
      await fs.writeFile(foldersPath, JSON.stringify(folders, null, 2) + "\n", "utf8");
   }
}

async function main() {
   const parsedPath = path.join(process.cwd(), "extract", "parsed", "classAbilities.json");
   const { abilities, talentLinks } = JSON.parse(await fs.readFile(parsedPath, "utf8"));

   const foldersPath = path.join(process.cwd(), "packsrc", "items", "_folders.json");
   await ensureClassAbilitiesFolder(foldersPath);

   const seen = new Set();
   const abilityDocsDir = path.join(process.cwd(), "packsrc", "items", "Class_Abilities");
   await fs.mkdir(abilityDocsDir, { recursive: true });
   let abilityDocsWritten = 0;
   for (const record of abilities) {
      const ownerKey = record.shared ? null : record.classKey;
      const dedupeKey = ownerKey ? `${ownerKey}:${record.name}` : `shared:${record.name}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const doc = buildAbilityDocument({ name: record.name, description: record.description, classKey: ownerKey, notes: record.notes });
      await fs.writeFile(path.join(abilityDocsDir, splitFileName(`${ownerKey ?? "shared"}_${record.name}`)), JSON.stringify(doc, null, 2) + "\n", "utf8");
      abilityDocsWritten++;
   }

   const talentsDir = path.join(process.cwd(), "packsrc", "items", "Talents");
   const talentFiles = await fs.readdir(talentsDir);
   const talentNames = new Set();
   for (const f of talentFiles) {
      const doc = JSON.parse(await fs.readFile(path.join(talentsDir, f), "utf8"));
      talentNames.add(doc.name);
   }

   const classesDir = path.join(process.cwd(), "packsrc", "items", "Character_Classes");
   const classFiles = await fs.readdir(classesDir);
   const classDocsByKey = {};
   for (const f of classFiles) {
      const filePath = path.join(classesDir, f);
      const doc = JSON.parse(await fs.readFile(filePath, "utf8"));
      classDocsByKey[doc.system.key] = { doc, filePath };
   }

   // Reset before rebuilding — running the builder twice must not
   // duplicate entries (real bug found and fixed while verifying this
   // plan: without the reset, a second run doubled every class's
   // specialAbilities array).
   for (const { doc } of Object.values(classDocsByKey)) {
      doc.system.specialAbilities = [];
   }
   for (const record of abilities) {
      const { doc } = classDocsByKey[record.classKey];
      doc.system.specialAbilities.push(...buildSpecialAbilityLinks(record, record.shared ? null : record.classKey));
   }
   for (const [classKey, talentName, level] of talentLinks) {
      if (!talentNames.has(talentName)) throw new Error(`talent not found in packsrc/items/Talents: ${talentName}`);
      const { doc } = classDocsByKey[classKey];
      doc.system.specialAbilities.push(buildTalentLink(talentName, level));
   }

   let classDocsUpdated = 0;
   for (const { doc, filePath } of Object.values(classDocsByKey)) {
      doc.system.specialAbilities.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
      await fs.writeFile(filePath, JSON.stringify(doc, null, 2) + "\n", "utf8");
      classDocsUpdated++;
   }

   console.log(`wrote ${abilityDocsWritten} class-ability document(s), updated ${classDocsUpdated} class document(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
