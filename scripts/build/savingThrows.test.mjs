import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, buildSavingThrowDocument, SAVING_THROWS } from "./savingThrows.mjs";

test("SAVING_THROWS has exactly the 5 real fantastic-depths customSaveCode values", () => {
   const codes = SAVING_THROWS.map((s) => s.customSaveCode).sort();
   assert.deepEqual(codes, ["breath", "death", "paralysis", "spell", "wand"]);
});

test("buildSavingThrowDocument produces a specialAbility item in category 'save'", () => {
   const doc = buildSavingThrowDocument(SAVING_THROWS[0]);
   assert.equal(doc.type, "specialAbility");
   assert.equal(doc.system.category, "save");
   assert.equal(doc.system.customSaveCode, "death");
   assert.equal(doc.name, "Doom Save");
   assert.equal(doc.system.shortName, "Doom");
   assert.equal(doc.system.classKey, null);
});

test("buildSavingThrowDocument sets a default d20-vs-target roll", () => {
   const doc = buildSavingThrowDocument(SAVING_THROWS[0]);
   assert.equal(doc.system.rollFormula, "1d20");
   assert.equal(doc.system.operator, "gte");
   assert.equal(doc.system.target, "15");
});

test("deterministicId is stable across calls", () => {
   assert.equal(deterministicId("savingThrows:death"), deterministicId("savingThrows:death"));
});

test("all 5 documents have distinct _id values", () => {
   const ids = new Set(SAVING_THROWS.map((s) => buildSavingThrowDocument(s)._id));
   assert.equal(ids.size, 5);
});
