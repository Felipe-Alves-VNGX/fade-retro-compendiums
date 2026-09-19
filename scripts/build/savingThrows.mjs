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
 * spells/skillsAndTalents/classesCore/classAbilities domains' function
 * of the same name/shape — no cross-module import.
 * @param {string} seed
 * @returns {string}
 */
export function deterministicId(seed) {
   return deterministicIdInternal(seed);
}

const SAVING_THROWS_FOLDER_ID = deterministicIdInternal("folders:Saving Throws");

function splitFileName(name) {
   return `${name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}.json`;
}

/**
 * Dark Dungeons's 5 saving throw categories, in the book's own
 * renamed terms (Table 4-2b etc.) rather than the classic B/X names.
 * `customSaveCode` is fixed by the real fantastic-depths system
 * (templates/item/classdef/saves.hbs resolves saves.hbs columns by
 * this code, not by name) — these 5 values are not ours to choose.
 * `name`/`shortName` are ours, and use Dark Dungeons's own labels so
 * the class sheet shows the book's terminology instead of the classic
 * B/X names the official fade-compendiums module uses.
 */
export const SAVING_THROWS = [
   {
      customSaveCode: "death",
      name: "Doom Save",
      shortName: "Doom",
      description: "<p>A jogada de resistência de Perdição protege o personagem contra ameaças que trazem morte instantânea ou debilitação severa — como raios de morte, venenos letais e efeitos similares. Uma jogada bem-sucedida evita ou reduz o efeito; uma falha costuma significar a morte do personagem.</p>",
   },
   {
      customSaveCode: "wand",
      name: "Ray Save",
      shortName: "Ray",
      description: "<p>A jogada de resistência de Raio protege contra ataques disparados de varinhas e cajados mágicos — como raios paralisantes ou feixes de dano. Uma jogada bem-sucedida evita ou reduz o efeito do disparo.</p>",
   },
   {
      customSaveCode: "paralysis",
      name: "Stasis Save",
      shortName: "Stasis",
      description: "<p>A jogada de resistência de Estase protege contra efeitos que imobilizam o personagem — paralisia ou petrificação. Falhar nessa jogada deixa o personagem paralisado ou transformado em pedra, dependendo do efeito.</p>",
   },
   {
      customSaveCode: "breath",
      name: "Blast Save",
      shortName: "Blast",
      description: "<p>A jogada de resistência de Rajada protege contra ataques de sopro em área — como o sopro de um dragão ou de outras criaturas semelhantes. Uma jogada bem-sucedida costuma reduzir o dano ou evitar efeitos secundários.</p>",
   },
   {
      customSaveCode: "spell",
      name: "Spell Save",
      shortName: "Spell",
      description: "<p>A jogada de resistência de Magia protege contra os efeitos de feitiços, cajados e varinhas mágicas em geral. Uma jogada bem-sucedida costuma reduzir ou anular o efeito mágico.</p>",
   },
];

/**
 * Build a specialAbility Item document for one saving throw category.
 * @param {{customSaveCode: string, name: string, shortName: string, description: string}} save
 * @returns {object}
 */
export function buildSavingThrowDocument(save) {
   const id = deterministicId(`savingThrows:${save.customSaveCode}`);
   return {
      folder: SAVING_THROWS_FOLDER_ID,
      name: save.name,
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
         description: save.description,
         gm: { notes: "" },
         rollFormula: "1d20",
         operator: "gte",
         target: "15",
         rollMode: "publicroll",
         autoSuccess: null,
         autoFail: null,
         abilityMod: "",
         savingThrow: null,
         dmgFormula: null,
         healFormula: null,
         damageType: "",
         category: "save",
         shortName: save.shortName,
         combatManeuver: null,
         customSaveCode: save.customSaveCode,
         classKey: null,
         showResult: true,
         quantity: 1,
         quantityMax: null,
         conditions: [],
      },
   };
}

async function ensureSavingThrowsFolder(foldersPath) {
   const folders = JSON.parse(await fs.readFile(foldersPath, "utf8"));
   const maxSort = Math.max(0, ...Object.values(folders).filter((f) => f.folder === null).map((f) => f.sort));
   const key = `!folders!${SAVING_THROWS_FOLDER_ID}`;
   if (!folders[key]) {
      folders[key] = {
         name: "Saving Throws", sorting: "a", folder: null, type: "Item",
         _id: SAVING_THROWS_FOLDER_ID, description: "", sort: maxSort + 100000,
         color: "#4a3f2f", flags: {},
         _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      };
      await fs.writeFile(foldersPath, JSON.stringify(folders, null, 2) + "\n", "utf8");
   }
}

async function main() {
   const foldersPath = path.join(process.cwd(), "packsrc", "items", "_folders.json");
   await ensureSavingThrowsFolder(foldersPath);

   const dir = path.join(process.cwd(), "packsrc", "items", "Saving_Throws");
   await fs.mkdir(dir, { recursive: true });

   for (const save of SAVING_THROWS) {
      const doc = buildSavingThrowDocument(save);
      await fs.writeFile(path.join(dir, splitFileName(save.name)), JSON.stringify(doc, null, 2) + "\n", "utf8");
   }
   console.log(`wrote ${SAVING_THROWS.length} saving throw document(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
