import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseClassAbilities } from "./classAbilities.mjs";

const raw = fs.readFileSync("extract/raw/creating-a-character.txt", "utf8");
const { abilities, talentLinks } = parseClassAbilities(raw);

test("parseClassAbilities returns 38 ability records (31 catalog + 4 shared Breath Evasion + 3 Fighter subpaths) and 22 talent links", () => {
   assert.equal(abilities.length, 38);
   assert.equal(talentLinks.length, 22);
});

test("every ability record has a non-empty description", () => {
   for (const a of abilities) {
      assert.ok(a.description && a.description.length > 0, `${a.classKey}/${a.name}`);
   }
});

test("no description leaks a page marker or an unrelated column-merge gap", () => {
   for (const a of abilities) {
      assert.doesNotMatch(a.description, /--- page/, `${a.classKey}/${a.name}`);
   }
});

test("Battlemage's own Multi-attack description does not leak the page-30 marker (real bug found and fixed: class-boundary slicing ate the trailing newline stripPageBoundaries needs)", () => {
   const bm = abilities.find((a) => a.classKey === "battlemage" && a.name === "Multi-attack");
   assert.doesNotMatch(bm.description, /--- page/);
   assert.match(bm.description, /details of multi-attack/);
});

test("progressive abilities carry one level per tier with matching changes text", () => {
   const fighterMulti = abilities.find((a) => a.classKey === "fighter" && a.name === "Multi-attack");
   assert.deepEqual(fighterMulti.levels, [10, 20, 30]);
   assert.equal(fighterMulti.changes.length, 3);
   const gentleTouch = abilities.find((a) => a.classKey === "mystic" && a.name === "Gentle Touch");
   assert.deepEqual(gentleTouch.levels, [18, 19, 20, 22, 24]);
});

test("Breath Evasion is shared by exactly 4 classes with identical description text", () => {
   const breathEvasions = abilities.filter((a) => a.name === "Breath Evasion");
   assert.equal(breathEvasions.length, 4);
   assert.deepEqual(breathEvasions.map((a) => a.classKey).sort(), ["mountebank", "mystic", "ranger", "thief"]);
   const texts = new Set(breathEvasions.map((a) => a.description));
   assert.equal(texts.size, 1);
});

test("Fighter gets Chivalric Vows, Warden, and Warlord as three distinct items", () => {
   const fighterSubpaths = abilities.filter((a) => a.classKey === "fighter" && ["Chivalric Vows", "Warden", "Warlord"].includes(a.name));
   assert.equal(fighterSubpaths.length, 3);
   for (const a of fighterSubpaths) assert.ok(a.description.length > 50, a.name);
});

test("Turn Undead's description includes a 36-row, 14-column reference table with the real legend", () => {
   const turnUndead = abilities.find((a) => a.classKey === "cleric" && a.name === "Turn Undead");
   const rowCount = (turnUndead.description.match(/<tr>/g) || []).length - 1;
   assert.equal(rowCount, 36);
   assert.match(turnUndead.description, /<th>Skeleton<\/th>/);
   assert.match(turnUndead.description, /<th>Lich<\/th>/);
   assert.match(turnUndead.description, /you are not powerful enough to turn/);
});

test("Command Animal's description includes a 36-row, 14-column reference table with the real legend", () => {
   const commandAnimal = abilities.find((a) => a.classKey === "druid" && a.name === "Command Animal");
   const rowCount = (commandAnimal.description.match(/<tr>/g) || []).length - 1;
   assert.equal(rowCount, 36);
   assert.match(commandAnimal.description, /you are not powerful enough to command/);
});

test("Turn Undead and Command Animal legends read as coherent prose, not an interleaved two-column blob", () => {
   const turnUndead = abilities.find((a) => a.classKey === "cleric" && a.name === "Turn Undead");
   const commandAnimal = abilities.find((a) => a.classKey === "druid" && a.name === "Command Animal");
   // These full sentences only appear intact if the two book columns were
   // read as separate coherent streams instead of merged word-by-word.
   assert.match(
      commandAnimal.description,
      /you are not powerful enough to command or control this type of animal\./
   );
   assert.match(
      turnUndead.description,
      /'–': you are not powerful enough to turn this type of undead\./
   );
});

test("Thief's talent links include the 4th-level Read Languages and 10th-level Wizard Scroll Use exceptions", () => {
   const thiefLinks = talentLinks.filter(([classKey]) => classKey === "thief");
   assert.equal(thiefLinks.length, 10);
   assert.deepEqual(thiefLinks.find(([, name]) => name === "Read Languages"), ["thief", "Read Languages", 4]);
   assert.deepEqual(thiefLinks.find(([, name]) => name === "Wizard Scroll Use"), ["thief", "Wizard Scroll Use", 10]);
});
