import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateDocument, validatePack } from "./validate.mjs";

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
