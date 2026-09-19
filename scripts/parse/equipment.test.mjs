import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEquipment } from "./equipment.mjs";

const FIXTURE = `--- page 147 ---
                          Chapter 9 –
                             for Ad
T    hey say that money makes the world go around.

MONEY
The actual type of money that people use...

--- page 148 ---
                   Table 9–1: Mundane Items
              Item                 Weight           Cost
           20 Arrows                 1lb             5gp
    Backpack (holds 40lb)            2lb             5gp
         Clothes (royal)             3lb           50+gp
           30 Pellets               0.1lb            1gp

Backpack: A leather or canvas backpack with shoulder straps
for carrying things while leaving the hands free.

Clothes (royal): Extravagant and ostentatious clothing fit for
a king or even an emperor.

--- page 150 ---
                   Table 9–2: Weapons
              Item              Weight        Cost
              Axe, Battle          8lb          5gp

--- page 152 ---
                                                      Table 9–3: Armour
                 Item                       Armour Class      Weight                             Cost                 Movement Rate
            Leather Armour                       7              20lb                             20gp                      30'
             Banded Mail                         4              45lb                             50gp                      20'
Shield, Buckler: A buckler is a small shield.

ARMOUR
Armour is toughened clothing.

--- page 153 ---
                                         Table 9–4: Pack and Riding Animals
                     Item                       Carrying Capacity           Speed                      Cost
                    Camel                             300lb               50'/round                   100gp
`;

test("parses a Mundane Items row with no quantity prefix", () => {
   const rows = parseEquipment(FIXTURE);
   const backpack = rows.find((r) => r.table === "mundane-items" && r.name === "Backpack (holds 40lb)");
   assert.deepEqual(backpack, {
      table: "mundane-items",
      name: "Backpack (holds 40lb)",
      bundleQty: 1,
      weightLb: 2,
      cost: { value: 5, currency: "gp", isMinimum: false },
   });
});

test("parses a Mundane Items row with a bundle quantity prefix", () => {
   const rows = parseEquipment(FIXTURE);
   const arrows = rows.find((r) => r.table === "mundane-items" && r.name === "Arrows");
   assert.deepEqual(arrows, {
      table: "mundane-items",
      name: "Arrows",
      bundleQty: 20,
      weightLb: 1,
      cost: { value: 5, currency: "gp", isMinimum: false },
   });
});

test("parses a Mundane Items row with a fractional weight", () => {
   const rows = parseEquipment(FIXTURE);
   const pellets = rows.find((r) => r.table === "mundane-items" && r.name === "Pellets");
   assert.equal(pellets.weightLb, 0.1);
   assert.equal(pellets.bundleQty, 30);
});

test("parses a Mundane Items row with a minimum-cost marker", () => {
   const rows = parseEquipment(FIXTURE);
   const clothes = rows.find((r) => r.table === "mundane-items" && r.name === "Clothes (royal)");
   assert.deepEqual(clothes.cost, { value: 50, currency: "gp", isMinimum: true });
});

test("does not include rows from Table 9-2 (Weapons)", () => {
   const rows = parseEquipment(FIXTURE);
   assert.ok(!rows.some((r) => r.name === "Axe, Battle"));
});

test("parses an Armour row with all 5 columns", () => {
   const rows = parseEquipment(FIXTURE);
   const leather = rows.find((r) => r.table === "armour" && r.name === "Leather Armour");
   assert.deepEqual(leather, {
      table: "armour",
      name: "Leather Armour",
      armourClass: 7,
      weightLb: 20,
      cost: { value: 20, currency: "gp", isMinimum: false },
      movementRate: "30'",
   });
   const banded = rows.find((r) => r.table === "armour" && r.name === "Banded Mail");
   assert.equal(banded.armourClass, 4);
   assert.equal(banded.movementRate, "20'");
});

test("does not include rows from Table 9-4 (Pack and Riding Animals)", () => {
   const rows = parseEquipment(FIXTURE);
   assert.ok(!rows.some((r) => r.name === "Camel"));
});

test("returns exactly 6 rows for this fixture (4 mundane-items + 2 armour)", () => {
   const rows = parseEquipment(FIXTURE);
   assert.equal(rows.length, 6);
});
