import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, normalizeTag, mapTarget, buildDocument } from "./spells.mjs";

test("deterministicId matches the 16-char alphanumeric ID pattern", () => {
   assert.match(deterministicId("spells:Fireball:Wizard:3"), /^[a-zA-Z0-9]{16}$/);
});

test("deterministicId is stable across calls", () => {
   assert.equal(deterministicId("spells:Fireball:Wizard:3"), deterministicId("spells:Fireball:Wizard:3"));
});

test("deterministicId differs between fan-out records of the same spell", () => {
   assert.notEqual(
      deterministicId("spells:Animate Dead:Cleric:4"),
      deterministicId("spells:Animate Dead:Wizard:5"),
   );
});

test("mapTarget maps caster/personal to targetSelf only", () => {
   assert.deepEqual(mapTarget("caster"), { targetSelf: true, targetOther: false });
   assert.deepEqual(mapTarget("personal"), { targetSelf: true, targetOther: false });
});

test("mapTarget maps none to neither", () => {
   assert.deepEqual(mapTarget("none"), { targetSelf: false, targetOther: false });
});

test("mapTarget maps any other text to targetOther only", () => {
   assert.deepEqual(mapTarget("one living creature"), { targetSelf: false, targetOther: true });
   assert.deepEqual(mapTarget("20' radius"), { targetSelf: false, targetOther: true });
});

test("buildDocument maps a single-sphere spell", () => {
   const doc = buildDocument({
      name: "Fireball", sphere: ["Energy"], class: "Wizard", circle: 3,
      target: "20' radius", range: "240'", duration: "instant",
      description: "<p>Boom.</p>",
   });
   assert.equal(doc.type, "spell");
   assert.equal(doc.name, "Fireball");
   assert.equal(doc.system.spellLevel, 3);
   assert.equal(doc.system.range, "240'");
   assert.equal(doc.system.duration, "instant");
   assert.deepEqual(doc.system.tags, ["energy"]);
   assert.equal(doc.system.description, "<p>Boom.</p>");
   assert.deepEqual(doc.system.targetSelf === false && doc.system.targetOther === true, true);
   assert.deepEqual(doc.system.classes, []);
   assert.equal(doc.system.dmgFormula, null);
   assert.equal(doc.system.effect, "");
});

test("buildDocument writes system.name matching the record name (regression test)", () => {
   const doc = buildDocument({
      name: "Magic Missile", sphere: ["Energy"], class: "Wizard", circle: 1,
      target: "one or more creatures", range: "150'", duration: "instant",
      description: "<p>Missiles.</p>",
   });
   assert.equal(doc.system.name, "Magic Missile");
});

test("buildDocument maps a no-sphere spell to an empty tags array", () => {
   const doc = buildDocument({
      name: "Anti-Animal Shell", sphere: [], class: "Druid", circle: 6,
      target: "caster", range: "personal", duration: "10 minutes/level",
      description: "<p>Prevents animals.</p>",
   });
   assert.deepEqual(doc.system.tags, []);
   assert.deepEqual({ targetSelf: doc.system.targetSelf, targetOther: doc.system.targetOther }, { targetSelf: true, targetOther: false });
});

test("buildDocument maps multiple spheres to multiple tags", () => {
   const doc = buildDocument({
      name: "Animate Dead", sphere: ["Energy", "Inertia"], class: "Wizard", circle: 5,
      target: "one or more corpses", range: "60'", duration: "permanent",
      description: "<p>Zombies.</p>",
   });
   assert.deepEqual(doc.system.tags, ["energy", "inertia"]);
});

test("buildDocument's folder id matches the seed spells-folder:<class>:<circle>", () => {
   const doc = buildDocument({
      name: "Fireball", sphere: ["Energy"], class: "Wizard", circle: 3,
      target: "20' radius", range: "240'", duration: "instant",
      description: "<p>Boom.</p>",
   });
   assert.equal(doc.folder, deterministicId("spells-folder:Wizard:3"));
});

test("buildDocument is idempotent: same record produces byte-identical output twice", () => {
   const record = {
      name: "Fireball", sphere: ["Energy"], class: "Wizard", circle: 3,
      target: "20' radius", range: "240'", duration: "instant",
      description: "<p>Boom.</p>",
   };
   assert.deepEqual(buildDocument(record), buildDocument(record));
});
