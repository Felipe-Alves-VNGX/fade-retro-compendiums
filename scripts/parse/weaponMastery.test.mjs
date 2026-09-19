import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWeaponMasteryTables, groupByWeapon } from "./weaponMastery.mjs";

const FIXTURE = `--- page 74 ---
                                           Table 6–1: Weapon Summary
                                                 Unarmed Attacks
    Weapon          Cost Base Damage             Base Traits        Advanced Traits            Proficiency Group
 Unarmed Strikes     –         1            Blunt, Natural, Simple Knockout, Off-hand               Brawling

--- page 76 ---
                                   Table 6–10a: Club vs Armed Opponents
                  None             Basic           Skilled       Expert          Master      Grand Master
Attack Bonus        –                –                +1            +2              +4             +6
  Damage           1d2              1d4             1d6+1         1d6+3           1d4+5          1d4+6
 AC Bonus           –                –            –1/–1/–/–     –2/–2/–/–       –3/–3/–3/–    –4/–4/–4/–4
   Deflect          –                –                 1             1               2              2
 Hurl Range         –                –                –          –/15/25         –/15/25       10/25/40

                                  Table 6–10b: Club vs Unarmed Opponents
                  None             Basic           Skilled       Expert          Master      Grand Master
Attack Bonus        –                –                +2            +4              +6             +8
  Damage           1d2              1d4             1d6+1         1d6+3           1d6+5          1d6+6
 AC Bonus           –                –            –1/–1/–/–     –2/–2/–/–       –3/–3/–3/–    –4/–4/–4/–4
   Deflect          –                –                 1             1               2              2
 Hurl Range         –                –                –          –/15/25         –/15/25       10/25/40

                              Table 6–40a: Wrestling vs Armed Opponents
                None             Basic         Skilled          Expert         Master      Grand Master
Attack Bonus     –                 –              +2              +4             +6              +8
  Damage         –                 –               1             1d2             1d4           1d6+1
  Strangle       –              20 (+0)         20 (–1)       19–20 (–2)      18–20 (–3)     17–20 (–4)

                             Table 6–40b: Wrestling vs Unarmed Opponents
                None             Basic          Skilled         Expert         Master      Grand Master
Attack Bonus     –                 –               +2             +4             +6              +8
  Damage         –                 –                1            1d2             1d3            1d4
  Strangle       –              20 (+0)          20 (–1)      19–20 (–2)      18–20 (–3)     17–20 (–4)

--- page 88 ---
WEAPON ABILITIES
The various weapon abilities listed on the previous tables are
described below.
`;

const CANONICAL_NAMES = ["Club", "Wrestling"];

test("parses each table into a flat list with name, side, and rows", () => {
   const tables = parseWeaponMasteryTables(FIXTURE);
   assert.equal(tables.length, 4);
   const clubArmed = tables.find((t) => t.name === "Club" && t.side === "armed");
   assert.ok(clubArmed);
   const attackBonus = clubArmed.rows.find((r) => r.label === "Attack Bonus");
   assert.deepEqual(attackBonus.values, ["–", "–", "+1", "+2", "+4", "+6"]);
});

test("keeps a compound cell value with an internal space as one token (Skewer/Strangle format)", () => {
   const tables = parseWeaponMasteryTables(FIXTURE);
   const wrestlingArmed = tables.find((t) => t.name === "Wrestling" && t.side === "armed");
   const strangle = wrestlingArmed.rows.find((r) => r.label === "Strangle");
   assert.deepEqual(strangle.values, ["–", "20 (+0)", "20 (–1)", "19–20 (–2)", "18–20 (–3)", "17–20 (–4)"]);
});

test("does not include Table 6-1 (Weapon Summary) rows", () => {
   const tables = parseWeaponMasteryTables(FIXTURE);
   assert.ok(!tables.some((t) => t.name === "Unarmed Strikes"));
});

test("groupByWeapon pairs armed/unarmed tables into one entry per weapon", () => {
   const tables = parseWeaponMasteryTables(FIXTURE);
   const grouped = groupByWeapon(tables, CANONICAL_NAMES);
   assert.equal(grouped.length, 2);
   const club = grouped.find((g) => g.name === "Club");
   assert.ok(club.armed.length > 0);
   assert.ok(club.unarmed.length > 0);
});

test("parses 'Double Damage' and 'Set' ability rows (Dagger, Pike/Spear labels missing from a prior fixture)", () => {
   const fixture = `--- page 80 ---
                                  Table 6–15a: Dagger vs Armed Opponents
                  None             Basic           Skilled       Expert          Master      Grand Master
Attack Bonus        –                –                +1            +2              +4             +6
  Damage           1d4              1d4             1d4+1         1d4+2           1d4+3          1d4+4
Double Damage        –                –                20         19–20           18–20          17–20

--- page 88 ---
WEAPON ABILITIES
The various weapon abilities listed on the previous tables are
described below.
`;
   const tables = parseWeaponMasteryTables(fixture);
   const daggerArmed = tables.find((t) => t.name === "Dagger" && t.side === "armed");
   const doubleDamage = daggerArmed.rows.find((r) => r.label === "Double Damage");
   assert.deepEqual(doubleDamage.values, ["–", "–", "20", "19–20", "18–20", "17–20"]);
   // Must not be mis-parsed as a shorter "Damage" row with a leading "Double" token.
   const damage = daggerArmed.rows.find((r) => r.label === "Damage");
   assert.deepEqual(damage.values, ["1d4", "1d4", "1d4+1", "1d4+2", "1d4+3", "1d4+4"]);
});

test("parses 'Set' ability row (Pike/Spear)", () => {
   const fixture = `--- page 82 ---
                                  Table 6–20a: Pike vs Armed Opponents
                  None             Basic           Skilled       Expert          Master      Grand Master
Attack Bonus        –                –                +1            +2              +4             +6
  Damage           1d10             1d10            1d10+1        1d10+2          1d10+3         1d10+4
   Set              –               Yes              Yes           Yes            Yes             Yes

--- page 88 ---
WEAPON ABILITIES
The various weapon abilities listed on the previous tables are
described below.
`;
   const tables = parseWeaponMasteryTables(fixture);
   const pikeArmed = tables.find((t) => t.name === "Pike" && t.side === "armed");
   const set = pikeArmed.rows.find((r) => r.label === "Set");
   assert.deepEqual(set.values, ["–", "Yes", "Yes", "Yes", "Yes", "Yes"]);
});

test("groupByWeapon matches table titles to canonical names case-insensitively", () => {
   const tables = parseWeaponMasteryTables(FIXTURE);
   // Simulate the real book's casing mismatch: canonical list says "Sword, Two-handed",
   // but the table title in the book says "Sword, Two-Handed".
   const mismatchTables = [
      { name: "Sword, Two-Handed", side: "armed", rows: [] },
      { name: "Sword, Two-Handed", side: "unarmed", rows: [] },
   ];
   const grouped = groupByWeapon(mismatchTables, ["Sword, Two-handed"]);
   assert.equal(grouped.length, 1);
   assert.equal(grouped[0].name, "Sword, Two-handed");
});
