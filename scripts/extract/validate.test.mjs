import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateDocument, validatePack } from "./validate.mjs";
import { buildDocument as buildSpellDocument } from "../build/spells.mjs";
import { buildSkillDocument, buildTalentDocument } from "../build/skillsAndTalents.mjs";

const validWeapon = {
   name: "Dagger",
   type: "weapon",
   _id: "OFQFxbNVm1qvEG9t",
   folder: "2AKCulCJIGNyAMaN",
   _originalKey: "!items!OFQFxbNVm1qvEG9t",
   system: {
      tags: ["thrown"],
      description: "<p>A short blade.</p>",
      quantity: 1,
      weight: 10,
      cost: 3,
      equipped: false,
      container: false,
      equippable: true,
      isDropped: false,
      isTreasure: false,
      damageRoll: "1d4",
      damageType: "physical",
      canMelee: true,
      canRanged: true,
      mastery: "Dagger",
      weaponType: "handheld",
      range: { short: 10, medium: 20, long: 30, min: 0 },
   },
};

test("validateDocument accepts a fully-formed weapon", () => {
   const errors = validateDocument(validWeapon, {
      packName: "items",
      knownFolderIds: new Set(["2AKCulCJIGNyAMaN"]),
   });
   assert.deepEqual(errors, []);
});

test("validateDocument flags a missing required weapon field", () => {
   const broken = structuredClone(validWeapon);
   delete broken.system.damageRoll;
   const errors = validateDocument(broken, {
      packName: "items",
      knownFolderIds: new Set(["2AKCulCJIGNyAMaN"]),
   });
   assert.ok(
      errors.some((e) => e.includes("system.damageRoll")),
      `expected an error mentioning system.damageRoll, got: ${errors.join(", ")}`
   );
});

test("validateDocument rejects a malformed _id", () => {
   const broken = structuredClone(validWeapon);
   broken._id = "too-short";
   const errors = validateDocument(broken, {
      packName: "items",
      knownFolderIds: new Set(["2AKCulCJIGNyAMaN"]),
   });
   assert.ok(errors.some((e) => e.includes("_id")));
});

test("validateDocument rejects a folder id absent from _folders.json", () => {
   const broken = structuredClone(validWeapon);
   broken.folder = "doesNotExist0000";
   const errors = validateDocument(broken, {
      packName: "items",
      knownFolderIds: new Set(["2AKCulCJIGNyAMaN"]),
   });
   assert.ok(errors.some((e) => e.includes("folder")));
});

test("validateDocument rejects an unknown subtype", () => {
   const broken = structuredClone(validWeapon);
   broken.type = "not-a-real-subtype";
   const errors = validateDocument(broken, {
      packName: "items",
      knownFolderIds: new Set(["2AKCulCJIGNyAMaN"]),
   });
   assert.ok(errors.some((e) => e.includes("unknown subtype")));
});

const validArmor = {
   name: "Leather Armour",
   type: "armor",
   _id: "xdkGfiDCe4dPI7Up",
   folder: "2AKCulCJIGNyAMaN",
   _originalKey: "!items!xdkGfiDCe4dPI7Up",
   system: {
      tags: [],
      description: "<p>Leather armour.</p>",
      quantity: 1,
      weight: 200,
      cost: 20,
      equipped: false,
      container: false,
      equippable: true,
      isDropped: false,
      isTreasure: false,
      ac: 7,
      armorWeight: "light",
      mod: 0,
      modRanged: 0,
      totalAC: 7,
      totalRangedAC: 7,
      totalAAC: 7,
      totalRangedAAC: 7,
   },
};

test("validateDocument accepts a fully-formed armor", () => {
   const errors = validateDocument(validArmor, {
      packName: "items",
      knownFolderIds: new Set(["2AKCulCJIGNyAMaN"]),
   });
   assert.deepEqual(errors, []);
});

test("validateDocument flags a missing required armor field", () => {
   const broken = structuredClone(validArmor);
   delete broken.system.armorWeight;
   const errors = validateDocument(broken, {
      packName: "items",
      knownFolderIds: new Set(["2AKCulCJIGNyAMaN"]),
   });
   assert.ok(
      errors.some((e) => e.includes("system.armorWeight")),
      `expected an error mentioning system.armorWeight, got: ${errors.join(", ")}`
   );
});

const validWeaponMastery = {
   name: "Club",
   type: "weaponMastery",
   _id: "IGtW7yuUTcYkhN4O",
   folder: "RcR10M9pJBiQMs2H",
   _originalKey: "!items!IGtW7yuUTcYkhN4O",
   system: {
      name: "Club",
      weaponType: "handheld",
      primaryType: "all",
      levels: [
         { name: "None", range: { short: 0, medium: 0, long: 0 }, pDmgFormula: "1d2", sDmgFormula: "1d2", acBonusType: null, acBonus: null, acBonusAT: null, pToHit: 0, sToHit: 0, special: null },
         { name: "Basic", range: { short: 0, medium: 0, long: 0 }, pDmgFormula: "1d4", sDmgFormula: "1d4", acBonusType: null, acBonus: null, acBonusAT: null, pToHit: 0, sToHit: 0, special: null },
         { name: "Skilled", range: { short: 0, medium: 0, long: 0 }, pDmgFormula: "1d6+1", sDmgFormula: "1d6+1", acBonusType: null, acBonus: -1, acBonusAT: null, pToHit: 1, sToHit: 2, special: "Deflect 1" },
         { name: "Expert", range: { short: 0, medium: 15, long: 25 }, pDmgFormula: "1d6+3", sDmgFormula: "1d6+3", acBonusType: null, acBonus: -2, acBonusAT: null, pToHit: 2, sToHit: 4, special: "Deflect 1" },
         { name: "Master", range: { short: 0, medium: 15, long: 25 }, pDmgFormula: "1d4+5", sDmgFormula: "1d6+5", acBonusType: null, acBonus: -3, acBonusAT: null, pToHit: 4, sToHit: 6, special: "Deflect 2" },
         { name: "Grand Master", range: { short: 10, medium: 25, long: 40 }, pDmgFormula: "1d4+6", sDmgFormula: "1d6+6", acBonusType: null, acBonus: -4, acBonusAT: null, pToHit: 6, sToHit: 8, special: "Deflect 2" },
      ],
   },
};

test("validateDocument accepts a fully-formed weaponMastery", () => {
   const errors = validateDocument(validWeaponMastery, {
      packName: "items",
      knownFolderIds: new Set(["RcR10M9pJBiQMs2H"]),
   });
   assert.deepEqual(errors, []);
});

test("validateDocument flags a missing required weaponMastery field", () => {
   const broken = structuredClone(validWeaponMastery);
   delete broken.system.primaryType;
   const errors = validateDocument(broken, {
      packName: "items",
      knownFolderIds: new Set(["RcR10M9pJBiQMs2H"]),
   });
   assert.ok(
      errors.some((e) => e.includes("system.primaryType")),
      `expected an error mentioning system.primaryType, got: ${errors.join(", ")}`
   );
});

const validSpellRecord = {
   name: "Fireball", sphere: ["Energy"], class: "Wizard", circle: 3,
   target: "20' radius", range: "240'", duration: "instant",
   description: "<p>Boom.</p>",
};

test("validateDocument accepts a real spell document built via buildDocument()", () => {
   const doc = buildSpellDocument(validSpellRecord);
   const errors = validateDocument(doc, {
      packName: "items",
      knownFolderIds: new Set([doc.folder]),
   });
   assert.deepEqual(errors, []);
});

test("validateDocument flags a missing required spell field", () => {
   const doc = buildSpellDocument(validSpellRecord);
   delete doc.system.spellLevel;
   const errors = validateDocument(doc, {
      packName: "items",
      knownFolderIds: new Set([doc.folder]),
   });
   assert.ok(
      errors.some((e) => e.includes("system.spellLevel")),
      `expected an error mentioning system.spellLevel, got: ${errors.join(", ")}`
   );
});

test("validatePack reports zero errors for a well-formed packsrc directory", async () => {
   const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fade-retro-validate-"));
   try {
      await fs.writeFile(
         path.join(dir, "_folders.json"),
         JSON.stringify({
            "!folders!2AKCulCJIGNyAMaN": { _id: "2AKCulCJIGNyAMaN", name: "Weapons", folder: null },
         })
      );
      await fs.writeFile(path.join(dir, "Dagger.json"), JSON.stringify(validWeapon));

      const { fileCount, errors } = await validatePack("items", dir);
      assert.equal(fileCount, 1);
      assert.deepEqual(errors, []);
   } finally {
      await fs.rm(dir, { recursive: true, force: true });
   }
});

test("validatePack flags duplicate _id across two files", async () => {
   const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fade-retro-validate-"));
   try {
      await fs.writeFile(
         path.join(dir, "_folders.json"),
         JSON.stringify({
            "!folders!2AKCulCJIGNyAMaN": { _id: "2AKCulCJIGNyAMaN", name: "Weapons", folder: null },
         })
      );
      await fs.writeFile(path.join(dir, "Dagger.json"), JSON.stringify(validWeapon));
      const duplicate = structuredClone(validWeapon);
      duplicate.name = "Dagger Copy";
      await fs.writeFile(path.join(dir, "Dagger_Copy.json"), JSON.stringify(duplicate));

      const { fileCount, errors } = await validatePack("items", dir);
      assert.equal(fileCount, 2);
      assert.ok(errors.some((e) => e.includes("duplicate _id")));
   } finally {
      await fs.rm(dir, { recursive: true, force: true });
   }
});

const validSkillRecord = {
   name: "Arcane Lore",
   ability: "int",
   extraAbility: null,
   choiceNote: null,
   description: "<p>Gives a bonus to recognise spells.</p>",
};

test("validateDocument accepts a real skill document built via buildSkillDocument()", () => {
   const doc = buildSkillDocument(validSkillRecord);
   const errors = validateDocument(doc, {
      packName: "items",
      knownFolderIds: new Set([doc.folder]),
   });
   assert.deepEqual(errors, []);
});

test("validateDocument flags a missing required skill field", () => {
   const doc = buildSkillDocument(validSkillRecord);
   delete doc.system.ability;
   const errors = validateDocument(doc, {
      packName: "items",
      knownFolderIds: new Set([doc.folder]),
   });
   assert.ok(
      errors.some((e) => e.includes("system.ability")),
      `expected an error mentioning system.ability, got: ${errors.join(", ")}`
   );
});

const validTalentRecord = {
   name: "Climb Walls",
   description: "<p>Any character can climb a tree.</p>",
};

test("validateDocument accepts a real specialAbility document built via buildTalentDocument()", () => {
   const doc = buildTalentDocument(validTalentRecord);
   const errors = validateDocument(doc, {
      packName: "items",
      knownFolderIds: new Set([doc.folder]),
   });
   assert.deepEqual(errors, []);
});
