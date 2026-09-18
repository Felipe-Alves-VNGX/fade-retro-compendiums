import fs from "node:fs/promises";
import path from "node:path";

const ORIGINAL_KEY_PREFIX = {
   actors: "!actors!",
   items: "!items!",
   macros: "!macros!",
   rollTables: "!tables!",
};

const ID_PATTERN = /^[a-zA-Z0-9]{16}$/;

const GEAR_REQUIRED_FIELDS = [
   "tags", "description", "quantity", "weight", "cost",
   "equipped", "container", "equippable", "isDropped", "isTreasure",
];

const SUBTYPE_REQUIRED_FIELDS = {
   item: GEAR_REQUIRED_FIELDS,
   weapon: [...GEAR_REQUIRED_FIELDS, "damageRoll", "damageType", "canMelee", "canRanged", "mastery", "weaponType", "range"],
   light: [...GEAR_REQUIRED_FIELDS, "light"],
   armor: [...GEAR_REQUIRED_FIELDS, "ac", "armorWeight", "mod", "modRanged", "totalAC", "totalRangedAC", "totalAAC", "totalRangedAAC"],
   weaponMastery: ["name", "primaryType", "levels"],
   spell: ["spellLevel", "range", "duration"],
};

/**
 * Validate a single document object against envelope and subtype rules.
 * @param {object} doc - parsed document JSON
 * @param {object} context
 * @param {string} context.packName - pack this document belongs to (e.g. "items")
 * @param {Set<string>} context.knownFolderIds - folder ids declared in _folders.json
 * @returns {string[]} list of error messages, empty when the document is valid
 */
export function validateDocument(doc, { packName, knownFolderIds }) {
   const errors = [];

   if (typeof doc.name !== "string" || doc.name.length === 0) {
      errors.push("missing or empty 'name'");
   }
   if (typeof doc.type !== "string" || doc.type.length === 0) {
      errors.push("missing or empty 'type'");
   }
   if (!ID_PATTERN.test(doc._id ?? "")) {
      errors.push(`invalid '_id': ${JSON.stringify(doc._id)} (expected 16 alphanumeric characters)`);
   }

   const expectedKeyPrefix = ORIGINAL_KEY_PREFIX[packName];
   if (expectedKeyPrefix) {
      const expectedKey = `${expectedKeyPrefix}${doc._id}`;
      if (doc._originalKey !== expectedKey) {
         errors.push(`_originalKey '${doc._originalKey}' does not match expected '${expectedKey}'`);
      }
   }

   if (doc.folder != null && doc.folder !== "") {
      if (!knownFolderIds.has(doc.folder)) {
         errors.push(`folder '${doc.folder}' is not declared in _folders.json`);
      }
   }

   if (doc.system == null || typeof doc.system !== "object") {
      errors.push("missing 'system' object");
   } else {
      const requiredFields = SUBTYPE_REQUIRED_FIELDS[doc.type];
      if (!requiredFields) {
         errors.push(`unknown subtype '${doc.type}' — add it to SUBTYPE_REQUIRED_FIELDS in scripts/extract/validate.mjs`);
      } else {
         for (const field of requiredFields) {
            if (!(field in doc.system)) {
               errors.push(`system.${field} is required for subtype '${doc.type}'`);
            }
         }
      }
   }

   return errors;
}

async function collectJsonFiles(dir) {
   const results = [];
   let entries;
   try {
      entries = await fs.readdir(dir, { withFileTypes: true });
   } catch (error) {
      if (error.code === "ENOENT") return results;
      throw error;
   }
   for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
         results.push(...(await collectJsonFiles(fullPath)));
      } else if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "_folders.json") {
         results.push(fullPath);
      }
   }
   return results;
}

/**
 * Validate every document file in a packsrc/<packName> directory.
 * @param {string} packName
 * @param {string} packsrcDir - path to packsrc/<packName>
 * @returns {Promise<{fileCount: number, errors: string[]}>}
 */
export async function validatePack(packName, packsrcDir) {
   const errors = [];
   let knownFolderIds = new Set();
   let folders = {};

   const foldersPath = path.join(packsrcDir, "_folders.json");
   try {
      const raw = await fs.readFile(foldersPath, "utf8");
      folders = JSON.parse(raw);
      knownFolderIds = new Set(Object.values(folders).map((f) => f._id));
   } catch (error) {
      if (error.code !== "ENOENT") {
         errors.push(`could not read _folders.json: ${error.message}`);
      }
   }

   // A folder's own parent reference must also resolve.
   for (const folder of Object.values(folders)) {
      if (folder.folder != null && folder.folder !== "" && !knownFolderIds.has(folder.folder)) {
         errors.push(`_folders.json: folder '${folder._id}' references unknown parent '${folder.folder}'`);
      }
   }

   const files = await collectJsonFiles(packsrcDir);
   const seenIds = new Map();

   for (const filePath of files) {
      const raw = await fs.readFile(filePath, "utf8");
      let doc;
      try {
         doc = JSON.parse(raw);
      } catch (error) {
         errors.push(`${filePath}: invalid JSON — ${error.message}`);
         continue;
      }

      const docErrors = validateDocument(doc, { packName, knownFolderIds });
      for (const message of docErrors) {
         errors.push(`${filePath}: ${message}`);
      }

      if (ID_PATTERN.test(doc._id ?? "")) {
         if (seenIds.has(doc._id)) {
            errors.push(`${filePath}: duplicate _id '${doc._id}' also used by ${seenIds.get(doc._id)}`);
         } else {
            seenIds.set(doc._id, filePath);
         }
      }
   }

   return { fileCount: files.length, errors };
}

const AVAILABLE_PACKS = ["actors", "items", "macros", "rollTables"];

async function main() {
   const args = process.argv.slice(2);
   const packIndex = args.indexOf("--pack");
   const packsToRun = packIndex !== -1 && args[packIndex + 1]
      ? [args[packIndex + 1]]
      : AVAILABLE_PACKS;

   let totalErrors = 0;
   for (const packName of packsToRun) {
      const packsrcDir = path.join(process.cwd(), "packsrc", packName);
      const { fileCount, errors } = await validatePack(packName, packsrcDir);
      if (errors.length === 0) {
         console.log(`✓ ${packName}: ${fileCount} document(s), no errors`);
      } else {
         console.error(`✗ ${packName}: ${fileCount} document(s), ${errors.length} error(s)`);
         for (const message of errors) {
            console.error(`  - ${message}`);
         }
      }
      totalErrors += errors.length;
   }

   if (totalErrors > 0) {
      console.error(`\nvalidate: ${totalErrors} error(s) found`);
      process.exit(1);
   }
   console.log("\nvalidate: all packs OK");
}

if (process.argv[1] && process.argv[1].endsWith("validate.mjs")) {
   main();
}
