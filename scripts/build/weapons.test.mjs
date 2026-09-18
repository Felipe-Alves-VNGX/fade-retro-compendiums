import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, normalizeTag, buildDocument } from "./weapons.mjs";

test("deterministicId matches the 16-char alphanumeric ID pattern", () => {
   assert.match(deterministicId("weapons:Dagger"), /^[a-zA-Z0-9]{16}$/);
});

test("deterministicId is stable across calls", () => {
   assert.equal(deterministicId("weapons:Dagger"), deterministicId("weapons:Dagger"));
});

test("normalizeTag lowercases and hyphenates a multi-word trait", () => {
   assert.equal(normalizeTag("Deflect Penalty"), "deflect-penalty");
});

test("normalizeTag converges differently-cased hyphenated traits", () => {
   assert.equal(normalizeTag("Off-hand"), normalizeTag("Off-Hand"));
   assert.equal(normalizeTag("Off-hand"), "off-hand");
});

test("buildDocument maps a plain melee weapon", () => {
   const doc = buildDocument({
      name: "Club", lookupName: "Club", section: "one-handed",
      cost: { value: 3, currency: "gp" }, damageRoll: "1d6",
      traits: ["Blunt", "Natural", "Deflect", "Hurl"], masteryGroups: ["Hammers"], weightLb: 5,
   });
   assert.equal(doc.type, "weapon");
   assert.equal(doc.system.damageRoll, "1d6");
   assert.equal(doc.system.canMelee, true);
   assert.equal(doc.system.canRanged, false);
   assert.equal(doc.system.mastery, "Hammers");
   assert.equal(doc.system.weight, 50);
   assert.equal(doc.system.cost, 3);
   assert.deepEqual(doc.system.tags, ["blunt", "natural", "deflect", "hurl"]);
   assert.equal(doc.system.natural, false);
});

test("buildDocument gives a thrown weapon both canMelee and canRanged", () => {
   const doc = buildDocument({
      name: "Dagger", lookupName: "Dagger", section: "one-handed",
      cost: { value: 3, currency: "gp" }, damageRoll: "1d4",
      traits: ["Simple", "Off-Hand", "Throw"], masteryGroups: ["Short Blades"], weightLb: 1,
   });
   assert.equal(doc.system.canMelee, true);
   assert.equal(doc.system.canRanged, true);
});

test("buildDocument gives a Ranged-section weapon only canRanged", () => {
   const doc = buildDocument({
      name: "Bow, Long", lookupName: "Bow, Long", section: "ranged",
      cost: { value: 40, currency: "gp" }, damageRoll: "1d6",
      traits: ["Delay"], masteryGroups: ["Bows"], weightLb: 3,
   });
   assert.equal(doc.system.canMelee, false);
   assert.equal(doc.system.canRanged, true);
});

test("buildDocument marks an unarmed-section row as natural with zero cost", () => {
   const doc = buildDocument({
      name: "Unarmed Strikes", lookupName: "Unarmed Strikes", section: "unarmed",
      cost: null, damageRoll: "1", traits: ["Blunt", "Natural", "Simple"], masteryGroups: ["Brawling"], weightLb: 0,
   });
   assert.equal(doc.system.natural, true);
   assert.equal(doc.system.cost, 0);
   assert.equal(doc.system.weight, 0);
});

test("buildDocument records extra mastery groups in gm.notes without inventing a schema field", () => {
   const doc = buildDocument({
      name: "Sword, Short", lookupName: "Sword, Short", section: "one-handed",
      cost: { value: 7, currency: "gp" }, damageRoll: "1d6",
      traits: ["Deflect", "Disarm", "Hurl"], masteryGroups: ["Med. Blades", "Short Blades"], weightLb: 3,
   });
   assert.equal(doc.system.mastery, "Med. Blades");
   assert.match(doc.system.gm.notes, /Short Blades/);
});

test("buildDocument leaves range at schema defaults", () => {
   const doc = buildDocument({
      name: "Bow, Long", lookupName: "Bow, Long", section: "ranged",
      cost: { value: 40, currency: "gp" }, damageRoll: "1d6",
      traits: ["Delay"], masteryGroups: ["Bows"], weightLb: 3,
   });
   assert.deepEqual(doc.system.range, { short: null, medium: null, long: null, min: 0 });
});

test("buildDocument is idempotent: same row produces byte-identical output twice", () => {
   const row = {
      name: "Club", lookupName: "Club", section: "one-handed",
      cost: { value: 3, currency: "gp" }, damageRoll: "1d6",
      traits: ["Blunt", "Natural", "Deflect", "Hurl"], masteryGroups: ["Hammers"], weightLb: 5,
   };
   const first = buildDocument(row);
   const second = buildDocument(row);
   assert.deepEqual(first, second);
});
