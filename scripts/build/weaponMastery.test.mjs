import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, buildLevels, buildDocument } from "./weaponMastery.mjs";

test("deterministicId matches the 16-char alphanumeric ID pattern", () => {
   assert.match(deterministicId("weaponMastery:Club"), /^[a-zA-Z0-9]{16}$/);
});

const CLUB_ARMED = [
   { label: "Attack Bonus", values: ["–", "–", "+1", "+2", "+4", "+6"] },
   { label: "Damage", values: ["1d2", "1d4", "1d6+1", "1d6+3", "1d4+5", "1d4+6"] },
   { label: "AC Bonus", values: ["–", "–", "–1/–1/–/–", "–2/–2/–/–", "–3/–3/–3/–", "–4/–4/–4/–4"] },
   { label: "Deflect", values: ["–", "–", "1", "1", "2", "2"] },
   { label: "Hurl Range", values: ["–", "–", "–", "–/15/25", "–/15/25", "10/25/40"] },
];
const CLUB_UNARMED = [
   { label: "Attack Bonus", values: ["–", "–", "+2", "+4", "+6", "+8"] },
   { label: "Damage", values: ["1d2", "1d4", "1d6+1", "1d6+3", "1d6+5", "1d6+6"] },
   { label: "AC Bonus", values: ["–", "–", "–1/–1/–/–", "–2/–2/–/–", "–3/–3/–3/–", "–4/–4/–4/–4"] },
   { label: "Deflect", values: ["–", "–", "1", "1", "2", "2"] },
   { label: "Hurl Range", values: ["–", "–", "–", "–/15/25", "–/15/25", "10/25/40"] },
];

test("buildLevels maps Attack Bonus to pToHit/sToHit, handling the en-dash negative sign", () => {
   const { levels } = buildLevels(CLUB_ARMED, CLUB_UNARMED);
   assert.equal(levels[2].pToHit, 1);
   assert.equal(levels[2].sToHit, 2);
   assert.equal(levels[2].acBonus, -1, "en-dash '–1' must parse as -1, not NaN/null");
});

test("buildLevels maps Damage to pDmgFormula/sDmgFormula verbatim", () => {
   const { levels } = buildLevels(CLUB_ARMED, CLUB_UNARMED);
   assert.equal(levels[0].pDmgFormula, "1d2");
   assert.equal(levels[4].sDmgFormula, "1d6+5");
});

test("buildLevels maps a single extra-ability row to special", () => {
   const { levels } = buildLevels(CLUB_ARMED, CLUB_UNARMED);
   assert.equal(levels[2].special, "Deflect 1");
   assert.equal(levels[0].special, null);
});

test("buildLevels maps Hurl Range to range.{short,medium,long}, treating '–' as 0", () => {
   const { levels } = buildLevels(CLUB_ARMED, CLUB_UNARMED);
   assert.deepEqual(levels[3].range, { short: 0, medium: 15, long: 25 });
   assert.deepEqual(levels[0].range, { short: 0, medium: 0, long: 0 });
});

test("buildLevels preserves the full 4-value AC Bonus string for gm.notes, using only the first value as acBonus", () => {
   const { levels, acBonusRaw } = buildLevels(CLUB_ARMED, CLUB_UNARMED);
   assert.equal(levels[5].acBonus, -4);
   assert.match(acBonusRaw, /–4\/–4\/–4\/–4$/);
});

test("buildLevels combines two extra-ability rows into one special string", () => {
   const armed = [
      { label: "Attack Bonus", values: ["–", "–", "+2", "+4", "+6", "+8"] },
      { label: "Damage", values: ["–", "1d8", "1d12", "2d8", "2d8+4", "2d6+6"] },
      { label: "Deflect", values: ["–", "–", "1", "2", "2", "3"] },
      { label: "Disarm", values: ["–", "–", "+0", "–1", "–2", "–4"] },
   ];
   const { levels } = buildLevels(armed, armed);
   assert.equal(levels[3].special, "Deflect 2, Disarm –1");
});

test("buildLevels treats a missing Damage cell ('–') as null, not the string", () => {
   const armed = [
      { label: "Attack Bonus", values: ["–", "–", "+2", "+4", "+6", "+8"] },
      { label: "Damage", values: ["–", "–", "1", "1d2", "1d4", "1d6+1"] },
   ];
   const { levels } = buildLevels(armed, armed);
   assert.equal(levels[0].pDmgFormula, null);
   assert.equal(levels[2].pDmgFormula, "1");
});

test("buildDocument produces a weaponMastery document with 6 levels and the arm's name", () => {
   const doc = buildDocument({ name: "Club", armed: CLUB_ARMED, unarmed: CLUB_UNARMED });
   assert.equal(doc.type, "weaponMastery");
   assert.equal(doc.name, "Club");
   assert.equal(doc.system.name, "Club");
   assert.equal(doc.system.weaponType, "handheld");
   assert.equal(doc.system.primaryType, "all");
   assert.equal(doc.system.levels.length, 6);
});

test("buildDocument is idempotent: same entry produces byte-identical output twice", () => {
   const entry = { name: "Club", armed: CLUB_ARMED, unarmed: CLUB_UNARMED };
   const first = buildDocument(entry);
   const second = buildDocument(entry);
   assert.deepEqual(first, second);
});
