import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, matchDescription, buildDocument } from "./equipment.mjs";

test("deterministicId is stable across calls", () => {
   assert.equal(deterministicId("equipment:Backpack"), deterministicId("equipment:Backpack"));
});

test("deterministicId matches 16-char alphanumeric ID pattern", () => {
   assert.match(deterministicId("equipment:Torch"), /^[a-zA-Z0-9]{16}$/);
});

test("deterministicId produces the expected value for a known seed", () => {
   assert.equal(deterministicId("equipment:Backpack"), "PnbbSsOUyqXtYttz");
});

const DESCRIPTION_FIXTURE = `Backpack: A leather or canvas backpack with shoulder straps
for carrying things while leaving the hands free.

Boots (plain): Simple yet sturdy hard leather boots for
walking or riding in.

Sack (small): A canvas sack for either carrying in one hand
or loading onto a horse or other beast of burden.
`;

test("matchDescription finds an exact-name header", () => {
   const desc = matchDescription("Boots (plain)", DESCRIPTION_FIXTURE);
   assert.equal(desc, "Simple yet sturdy hard leather boots for walking or riding in.");
});

test("matchDescription falls back to the name with its parenthetical stripped", () => {
   const desc = matchDescription("Backpack (holds 40lb)", DESCRIPTION_FIXTURE);
   assert.equal(desc, "A leather or canvas backpack with shoulder straps for carrying things while leaving the hands free.");
});

test("matchDescription returns null when no header matches either candidate", () => {
   const desc = matchDescription("Sack (holds 20lb)", DESCRIPTION_FIXTURE);
   assert.equal(desc, null);
});

test("buildDocument maps a mundane-items row with a bundle quantity", () => {
   const doc = buildDocument({
      table: "mundane-items",
      name: "Arrows",
      bundleQty: 20,
      weightLb: 1,
      cost: { value: 5, currency: "gp", isMinimum: false },
   }, { rawText: "" });

   assert.equal(doc.name, "Arrows");
   assert.equal(doc.type, "item");
   assert.equal(doc.system.quantity, 20);
   assert.equal(doc.system.weight, 10);
   assert.equal(doc.system.cost, 5);
   assert.equal(doc.system.description, "");
});

test("buildDocument converts sp cost to a gp fraction", () => {
   const doc = buildDocument({
      table: "mundane-items",
      name: "Belt",
      bundleQty: 1,
      weightLb: 0.5,
      cost: { value: 2, currency: "sp", isMinimum: false },
   }, { rawText: "" });

   assert.equal(doc.system.cost, 0.2);
});

test("buildDocument records a minimum-cost note without inventing a schema field", () => {
   const doc = buildDocument({
      table: "mundane-items",
      name: "Clothes (royal)",
      bundleQty: 1,
      weightLb: 3,
      cost: { value: 50, currency: "gp", isMinimum: true },
   }, { rawText: "" });

   assert.equal(doc.system.cost, 50);
   assert.match(doc.system.gm.notes, /50\+gp/);
});

test("buildDocument maps an armour row, deriving armorWeight from movementRate", () => {
   const light = buildDocument({
      table: "armour",
      name: "Leather Armour",
      armourClass: 7,
      weightLb: 20,
      cost: { value: 20, currency: "gp", isMinimum: false },
      movementRate: "30'",
   }, { rawText: "" });
   assert.equal(light.type, "armor");
   assert.equal(light.system.ac, 7);
   assert.equal(light.system.totalAC, 7);
   assert.equal(light.system.armorWeight, "light");

   const heavy = buildDocument({
      table: "armour",
      name: "Banded Mail",
      armourClass: 4,
      weightLb: 45,
      cost: { value: 50, currency: "gp", isMinimum: false },
      movementRate: "20'",
   }, { rawText: "" });
   assert.equal(heavy.system.armorWeight, "heavy");
});

test("buildDocument is idempotent: same row produces byte-identical _id and name twice", () => {
   const row = {
      table: "mundane-items", name: "Torch", bundleQty: 1, weightLb: 0.5,
      cost: { value: 2, currency: "sp", isMinimum: false },
   };
   const first = buildDocument(row, { rawText: "" });
   const second = buildDocument(row, { rawText: "" });
   assert.equal(first._id, second._id);
   assert.deepEqual(first, second);
});
