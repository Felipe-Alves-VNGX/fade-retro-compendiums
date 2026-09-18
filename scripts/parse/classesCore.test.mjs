import { test } from "node:test";
import assert from "node:assert/strict";
import { parseClasses } from "./classesCore.mjs";
import fs from "node:fs";

const raw = fs.readFileSync("extract/raw/creating-a-character.txt", "utf8");
const records = parseClasses(raw);

test("parseClasses returns exactly 10 class records", () => {
   assert.equal(records.length, 10);
});

test("every class has exactly 36 levels and 36 saves entries", () => {
   for (const r of records) {
      assert.equal(r.levels.length, 36, r.key);
      assert.equal(r.saves.length, 36, r.key);
   }
});

test("caster classes have a spells array of 36 rows matching their circle count", () => {
   const casters = records.filter((r) => r.circleCount > 0);
   assert.equal(casters.length, 5);
   for (const r of casters) {
      assert.equal(r.spells.length, 36, r.key);
      for (const row of r.spells) assert.equal(row.length, r.circleCount, r.key);
   }
});

test("non-caster classes have an empty spells array", () => {
   const nonCasters = records.filter((r) => r.circleCount === 0);
   assert.equal(nonCasters.length, 5);
   for (const r of nonCasters) assert.deepEqual(r.spells, []);
});

test("Battlemage level 1 and level 9 match the real book values", () => {
   const bm = records.find((r) => r.key === "battlemage");
   assert.deepEqual(bm.levels[0], { level: 1, xp: 0, hd: "6+c", thbonus: 1 });
   assert.deepEqual(bm.spells[0], [1, 0, 0, 0, 0, 0, 0, 0, 0]);
   assert.deepEqual(bm.saves[0], { level: 1, doom: 7, ray: 6, stasis: 7, blast: 4, spell: 5 });
   assert.deepEqual(bm.levels[8], { level: 9, xp: 400000, hd: "38+9c", thbonus: 4 });
   assert.deepEqual(bm.spells[8], [3, 3, 2, 2, 1, 0, 0, 0, 0]);
});

test("every spell-table cell for all 5 caster classes is a real integer between 0 and 9", () => {
   const casters = records.filter((r) => r.circleCount > 0);
   for (const r of casters) {
      for (const row of r.spells) {
         for (const v of row) {
            assert.ok(Number.isInteger(v) && v >= 0 && v <= 9, `${r.key}: ${JSON.stringify(row)}`);
         }
      }
   }
});

test("Druid level 1 spells and Mountebank level 1 spells are not NaN/null from the pushed-cell pdftotext bug", () => {
   const druid = records.find((r) => r.key === "druid");
   const mountebank = records.find((r) => r.key === "mountebank");
   assert.deepEqual(druid.spells[0], [0, 0, 0, 0, 0, 0, 0]);
   assert.deepEqual(mountebank.spells[0], [1, 0, 0, 0, 0, 0, 0, 0]);
});

test("Grenadier's compound powder resource is parsed with its unit text intact", () => {
   const gr = records.find((r) => r.key === "grenadier");
   assert.equal(gr.spells.length, 0);
   assert.match(gr.resourceTable, /1 grain</);
   assert.match(gr.resourceTable, /250 grains</);
});

test("Mystic's 5 martial-arts columns are captured per level", () => {
   const my = records.find((r) => r.key === "mystic");
   assert.match(my.resourceTable, /Armour Class/);
   assert.match(my.resourceTable, /Unarmed Hit As/);
});

test("all 10 prime abilities match Table 4-1", () => {
   const byKey = Object.fromEntries(records.map((r) => [r.key, r.primeAbility]));
   assert.deepEqual(byKey, {
      battlemage: "int", cleric: "wis", druid: "wis", fighter: "str",
      grenadier: "dex", mountebank: "cha", mystic: "str", ranger: "dex",
      thief: "dex", wizard: "int",
   });
});

test("basicProficiency matches the Equipment Restrictions rulings", () => {
   const byKey = Object.fromEntries(records.map((r) => [r.key, r.basicProficiency]));
   assert.deepEqual(byKey, {
      battlemage: true, cleric: false, druid: false, fighter: true,
      grenadier: true, mountebank: false, mystic: false, ranger: true,
      thief: false, wizard: false,
   });
});

test("Grenadier's description keeps the right-column prose intact, not cut mid-sentence", () => {
   const gr = records.find((r) => r.key === "grenadier");
   assert.match(gr.description, /combined with the wearing of armour for protection against\s+both mishap and enemy fire/);
});

test("Fighter's description excludes the ABILITIES/Equipment Restrictions/Saves section", () => {
   const fi = records.find((r) => r.key === "fighter");
   assert.doesNotMatch(fi.description, /ABILITIES/);
   assert.doesNotMatch(fi.description, /Equipment Restrictions/);
   assert.doesNotMatch(fi.description, /Saves:/);
});

test("no description or resource table leaks a page marker or column-merge gap", () => {
   for (const r of records) {
      assert.doesNotMatch(r.description, /--- page/);
      assert.doesNotMatch(r.description, /\S {5,}\S/);
      if (r.resourceTable) {
         assert.doesNotMatch(r.resourceTable, /--- page/);
      }
   }
});
