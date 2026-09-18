import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const GENERAL_SKILLS_FOLDER_ID = deterministicIdInternal("folders:General Skills");
const TALENTS_FOLDER_ID = deterministicIdInternal("folders:Talents");

function deterministicIdInternal(seed) {
   const hash = crypto.createHash("sha1").update(seed).digest();
   let id = "";
   for (let i = 0; i < 16; i++) id += ID_ALPHABET[hash[i] % ID_ALPHABET.length];
   return id;
}

/**
 * Derive a stable 16-char alphanumeric Foundry-style _id from a seed
 * string. Independent copy of the equipment/weapons/weaponMastery/
 * spells domains' function of the same name/shape — no cross-module
 * import.
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
 * Map one parsed talent (Task 1 shape) to a Foundry specialAbility Item
 * document.
 * @param {{ name: string, description: string }} talent
 * @returns {object}
 */
export function buildTalentDocument(talent) {
   const id = deterministicId(`talents:${talent.name}`);
   return {
      folder: TALENTS_FOLDER_ID,
      name: talent.name,
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
         description: talent.description,
         gm: { notes: "" },
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
         category: "talent",
         shortName: "",
         combatManeuver: null,
         customSaveCode: null,
         classKey: null,
         showResult: true,
         quantity: 1,
         quantityMax: null,
         conditions: [],
      },
   };
}

/**
 * Map one parsed skill (Task 1 shape) to a Foundry skill Item document.
 * @param {{ name: string, ability: string|null, extraAbility: string|null, choiceNote: string|null, description: string }} skill
 * @returns {object}
 */
export function buildSkillDocument(skill) {
   const id = deterministicId(`skills:${skill.name}`);
   const notes = [];
   if (skill.extraAbility) {
      notes.push(`Bônus também se aplica a checks de ${skill.extraAbility} (dupla ability no livro).`);
   }
   if (skill.ability === null) {
      notes.push("Special skill — não concede bônus de ability check, ver descrição.");
   }
   if (skill.choiceNote) {
      notes.push(`Skill de escolha de especialização (${skill.choiceNote}) — este item é genérico, ver descrição para exemplos.`);
   }

   return {
      folder: GENERAL_SKILLS_FOLDER_ID,
      name: skill.name,
      _id: id,
      img: "icons/svg/book.svg",
      effects: [],
      ownership: { default: 0 },
      flags: {},
      _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      _originalKey: `!items!${id}`,
      type: "skill",
      system: {
         description: skill.description,
         gm: { notes: notes.join(" ") },
         ability: skill.ability ?? "str",
         targetFormula: "@rollTarget",
         operator: "lte",
         rollFormula: "1d20",
         level: 1,
         rollMode: "",
         healFormula: null,
         showResult: true,
         skillBonus: 0,
         skillPenalty: 0,
         autoSuccess: null,
         autoFail: null,
      },
   };
}

async function ensureFolders(foldersPath) {
   const folders = JSON.parse(await fs.readFile(foldersPath, "utf8"));
   const maxSort = Math.max(0, ...Object.values(folders)
      .filter((f) => f.folder === null)
      .map((f) => f.sort));

   const skillsKey = `!folders!${GENERAL_SKILLS_FOLDER_ID}`;
   if (!folders[skillsKey]) {
      folders[skillsKey] = {
         name: "General Skills", sorting: "a", folder: null, type: "Item",
         _id: GENERAL_SKILLS_FOLDER_ID, description: "", sort: maxSort + 100000,
         color: "#2f4a3c", flags: {},
         _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      };
   }
   const talentsKey = `!folders!${TALENTS_FOLDER_ID}`;
   if (!folders[talentsKey]) {
      folders[talentsKey] = {
         name: "Talents", sorting: "a", folder: null, type: "Item",
         _id: TALENTS_FOLDER_ID, description: "", sort: maxSort + 200000,
         color: "#4a3c2f", flags: {},
         _stats: { coreVersion: "13.347", systemId: "fantastic-depths" },
      };
   }
   await fs.writeFile(foldersPath, JSON.stringify(folders, null, 2) + "\n", "utf8");
}

async function main() {
   const parsedPath = path.join(process.cwd(), "extract", "parsed", "skillsAndTalents.json");
   const { talents, skills } = JSON.parse(await fs.readFile(parsedPath, "utf8"));

   const foldersPath = path.join(process.cwd(), "packsrc", "items", "_folders.json");
   await ensureFolders(foldersPath);

   const talentsDir = path.join(process.cwd(), "packsrc", "items", "Talents");
   const skillsDir = path.join(process.cwd(), "packsrc", "items", "General_Skills");
   await fs.mkdir(talentsDir, { recursive: true });
   await fs.mkdir(skillsDir, { recursive: true });

   for (const t of talents) {
      const doc = buildTalentDocument(t);
      await fs.writeFile(path.join(talentsDir, splitFileName(t.name)), JSON.stringify(doc, null, 2) + "\n", "utf8");
   }
   for (const s of skills) {
      const doc = buildSkillDocument(s);
      await fs.writeFile(path.join(skillsDir, splitFileName(s.name)), JSON.stringify(doc, null, 2) + "\n", "utf8");
   }
   console.log(`wrote ${talents.length} talent(s), ${skills.length} skill(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
