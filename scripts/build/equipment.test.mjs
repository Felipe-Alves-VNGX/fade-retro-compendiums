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

test("matchDescription rejects a header line with column-merged text instead of returning garbled text", () => {
   const fixture = `Banded Mail: This is a suit primarily composed of chain mail           is made from natural materials it can be worn by druids. It is
with horizontal metal strips fastened into the mail. Banded            also light and quiet enough to be worn by thieves and
mail gives a character an armour class of 4. It doesn't quite          mountebanks. have the protection of plate mail, but is cheaper and lighter.
`;
   assert.equal(matchDescription("Banded Mail", fixture), null);
});

test("matchDescription continues a paragraph across a page-break marker instead of truncating", () => {
   const fixture = "Plate Mail: This is a suit primarily composed of large metal\n"
      + "plates and linked together with chain mail. Plate mail gives a character an armour class\n"
      + "\n\n\n\n                                                                 153\n"
      + "\f\n"
      + "\n--- page 154 ---\n"
      + "of 3. It is the best armour that can be bought second hand\n"
      + "or looted, since suit armour must be custom made.\n"
      + "\n"
      + "Scale Mail: This is a suit primarily composed of leather plates\n";
   const desc = matchDescription("Plate Mail", fixture);
   assert.ok(desc.includes("of 3. It is the best armour"), `expected the description to include the post-page-break continuation, got: ${desc}`);
   assert.ok(!desc.includes("Scale Mail"), "must stop before the next item's header");
});

test("matchDescription stops before a table title that follows a page break, without swallowing it", () => {
   const fixture = " MUNDANE ITEMS\n"
      + " Arrows: Arrows are the ammunition used by bows. The same\n"
      + " type of arrows are used in both long and short bows. Arrows\n"
      + " are often broken in use. At the end of a combat, a character\n"
      + "\f\n"
      + "\n--- page 148 ---\n"
      + "                   Table 9–1: Mundane Items\n"
      + "              Item                 Weight           Cost\n";
   const desc = matchDescription("Arrows", fixture);
   assert.equal(desc, "Arrows are the ammunition used by bows. The same type of arrows are used in both long and short bows. Arrows are often broken in use. At the end of a combat, a character");
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
