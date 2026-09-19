import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, buildDocument } from "./classesCore.mjs";

const SAMPLE_RECORD = {
   key: "battlemage", name: "Battlemage", primeAbility: "int", basicProficiency: true,
   circleCount: 9,
   levels: [{ level: 1, xp: 0, hd: "6+c", thbonus: 1 }],
   spells: [[1, 0, 0, 0, 0, 0, 0, 0, 0]],
   saves: [{ level: 1, doom: 7, ray: 6, stasis: 7, blast: 4, spell: 5 }],
   description: "<p>Battlemages learn magic.</p>",
   resourceTable: null,
};

test("deterministicId matches the 16-char alphanumeric ID pattern", () => {
   assert.match(deterministicId("classes:battlemage"), /^[a-zA-Z0-9]{16}$/);
});

test("deterministicId is stable across calls", () => {
   assert.equal(deterministicId("classes:battlemage"), deterministicId("classes:battlemage"));
});

test("buildDocument maps the basic class identity fields", () => {
   const doc = buildDocument(SAMPLE_RECORD);
   assert.equal(doc.type, "class");
   assert.equal(doc.name, "Battlemage");
   assert.equal(doc.system.key, "battlemage");
   assert.equal(doc.system.species, "Human");
   assert.equal(doc.system.firstLevel, 1);
   assert.equal(doc.system.maxLevel, 36);
   assert.equal(doc.system.maxSpellLevel, 9);
   assert.equal(doc.system.basicProficiency, true);
   assert.equal(doc.system.alignment, "Any");
});

test("buildDocument maps primeReqs from primeAbility", () => {
   const doc = buildDocument(SAMPLE_RECORD);
   assert.deepEqual(doc.system.primeReqs, [{ ability: "int", minScore: 0, percentage: 5, concatLogic: "" }]);
});

test("buildDocument maps levels without a thac0 override, leaving it at the schema default", () => {
   const doc = buildDocument(SAMPLE_RECORD);
   assert.deepEqual(doc.system.levels[0], {
      level: 1, xp: 0, thbonus: 1, hd: "6+c", hdcon: true,
      title: null, femaleTitle: null, attackRank: null,
   });
   assert.equal("thac0" in doc.system.levels[0], false);
});

test("buildDocument copies saves entries verbatim", () => {
   const doc = buildDocument(SAMPLE_RECORD);
   assert.deepEqual(doc.system.saves[0], { level: 1, doom: 7, ray: 6, stasis: 7, blast: 4, spell: 5 });
});

test("buildDocument copies the spells 2D array for a caster", () => {
   const doc = buildDocument(SAMPLE_RECORD);
   assert.deepEqual(doc.system.spells, [[1, 0, 0, 0, 0, 0, 0, 0, 0]]);
});

test("buildDocument gives a non-caster an empty spells array and maxSpellLevel 0", () => {
   const doc = buildDocument({ ...SAMPLE_RECORD, key: "fighter", name: "Fighter", circleCount: 0, spells: [] });
   assert.deepEqual(doc.system.spells, []);
   assert.equal(doc.system.maxSpellLevel, 0);
});

test("buildDocument appends the resource table to description when present", () => {
   const doc = buildDocument({ ...SAMPLE_RECORD, resourceTable: "<p>extra</p>" });
   assert.equal(doc.system.description, "<p>Battlemages learn magic.</p><p>extra</p>");
});

test("buildDocument leaves specialAbilities and classItems empty (sub-project 2 scope)", () => {
   const doc = buildDocument(SAMPLE_RECORD);
   assert.deepEqual(doc.system.specialAbilities, []);
   assert.deepEqual(doc.system.classItems, []);
});

test("buildDocument is idempotent: same record produces byte-identical output twice", () => {
   assert.deepEqual(buildDocument(SAMPLE_RECORD), buildDocument(SAMPLE_RECORD));
});
