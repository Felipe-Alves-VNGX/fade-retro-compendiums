import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, buildAbilityDocument, buildSpecialAbilityLinks } from "./classAbilities.mjs";

test("deterministicId matches the 16-char alphanumeric ID pattern", () => {
   assert.match(deterministicId("classAbilities:fighter:Parry"), /^[a-zA-Z0-9]{16}$/);
});

test("deterministicId is stable across calls", () => {
   assert.equal(deterministicId("classAbilities:fighter:Parry"), deterministicId("classAbilities:fighter:Parry"));
});

test("buildAbilityDocument maps a class-owned ability with category 'class'", () => {
   const doc = buildAbilityDocument({ name: "Parry", description: "<p>...</p>", classKey: "fighter" });
   assert.equal(doc.type, "specialAbility");
   assert.equal(doc.name, "Parry");
   assert.equal(doc.system.category, "class");
   assert.equal(doc.system.classKey, "fighter");
   assert.equal(doc.system.description, "<p>...</p>");
});

test("buildAbilityDocument maps a shared ability with classKey null", () => {
   const doc = buildAbilityDocument({ name: "Breath Evasion", description: "<p>...</p>", classKey: null });
   assert.equal(doc.system.classKey, null);
});

test("buildAbilityDocument's _id differs between class-owned and shared seeds for the same name", () => {
   const fighterParry = buildAbilityDocument({ name: "Parry", description: "x", classKey: "fighter" });
   const mysticParry = buildAbilityDocument({ name: "Parry", description: "y", classKey: "mystic" });
   assert.notEqual(fighterParry._id, mysticParry._id);
});

test("buildSpecialAbilityLinks expands a single-level ability into one entry", () => {
   const links = buildSpecialAbilityLinks({ name: "Parry", levels: [7], changes: null }, "fighter");
   assert.deepEqual(links, [{ name: "Parry", uuid: "", level: 7, target: null, classKey: "fighter", changes: "" }]);
});

test("buildSpecialAbilityLinks expands a progressive ability into one entry per tier with matching changes text", () => {
   const links = buildSpecialAbilityLinks({ name: "Multi-attack", levels: [10, 20, 30], changes: ["2 ataques por rodada", "3 ataques por rodada", "4 ataques por rodada"] }, "fighter");
   assert.equal(links.length, 3);
   assert.equal(links[1].level, 20);
   assert.equal(links[1].changes, "3 ataques por rodada");
});

test("buildAbilityDocument is idempotent: same input produces byte-identical output twice", () => {
   const input = { name: "Parry", description: "<p>...</p>", classKey: "fighter" };
   assert.deepEqual(buildAbilityDocument(input), buildAbilityDocument(input));
});
