import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWeapons } from "./weapons.mjs";

const WEAPONS_FIXTURE = `--- page 73 ---
                                    Chapter 6 – Weapons & We

--- page 74 ---
                                           Table 6–1: Weapon Summary
                                                 Unarmed Attacks
    Weapon          Cost Base Damage             Base Traits        Advanced Traits            Proficiency Group
 Unarmed Strikes     –         1            Blunt, Natural, Simple Knockout, Off-hand               Brawling
    Wrestling        –         –            Blunt, Natural, Simple  Entangle, Strangle             Grappling

                                            One-Handed Weapons
    Weapon          Cost Base Damage          Base Traits              Advanced Traits
   Axe, Hand         4gp      1d6                 Throw                          –                 Short Axes
     Dagger          3gp      1d4      Simple, Off-Hand, Throw          Double Damage             Short Blades
Hammer, Throwing     4gp      1d4             Blunt, Throw                     Stun                 Hammers
 Shield, Buckler     6gp       –             Blunt, Off-hand                 Deflect                 Shields
  Sword, Short       7gp      1d6                    –                Deflect, Disarm, Hurl Med. Blades, Short Blades
 Sword, Bastard     15gp    1d6+1               Versatile                    Deflect             Medium Blades

                                           Two-Handed Weapons
     Weapon         Cost Base Damage         Base Traits             Advanced Traits
    Axe, Battle      7gp      1d8                Bulky                Delay, Stun, Hurl     Short Axes, Long Axes
  Sword, Bastard    15gp    1d6+1              Versatile                Deflect, Hurl      Med. Blades, Long Blades

                                                 Ranged Weapons
     Weapon          Cost Base Damage            Base Traits            Advanced Traits
      Bolas           5gp      1d2                     _                Entangle, Strangle        Line Weapons
    Bow, Long       40gp      1d6                      –                      Delay                    Bows

--- page 75 ---
                                                         74


--- page 75 ---
Table 6–2a: Axe, Battle vs Armed Opponents
`;

const EQUIPMENT_FIXTURE = `--- page 150 ---
                   Table 9–2: Weapons
            Item                Weight              Cost
         Axe, Battle              6lb                7gp
         Axe, Hand                3lb                4gp
           Dagger                  1lb               3gp
      Hammer, Throwing            2½lb                4gp
       Shield, Buckler             2lb               6gp
       Sword, Bastard             8lb               15gp
        Sword, Short              3lb                7gp
            Bolas                0.5lb               5gp
        Bow, Long                3lb              40gp

--- page 151 ---
Table 9–3: Armour
`;

test("parses the Unarmed Attacks section with no Table 9-2 weight and marks it natural", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const strikes = rows.find((r) => r.name === "Unarmed Strikes");
   assert.equal(strikes.section, "unarmed");
   assert.equal(strikes.cost, null);
   assert.equal(strikes.damageRoll, "1");
   assert.deepEqual(strikes.traits, ["Blunt", "Natural", "Simple", "Knockout", "Off-hand"]);
   assert.deepEqual(strikes.masteryGroups, ["Brawling"]);
   assert.equal(strikes.weightLb, 0);
});

test("splits a trait glued to a group name by a single space (Axe, Hand)", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const axeHand = rows.find((r) => r.name === "Axe, Hand");
   assert.deepEqual(axeHand.traits, ["Throw"]);
   assert.deepEqual(axeHand.masteryGroups, ["Short Axes"]);
});

test("splits two traits glued together by a single space (simulated Unarmed-Strikes-style collapse)", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const strikes = rows.find((r) => r.name === "Unarmed Strikes");
   assert.ok(strikes.traits.includes("Simple"));
   assert.ok(strikes.traits.includes("Knockout"));
});

test("splits a trait glued to a two-word abbreviated group name (Sword, Short)", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const swordShort = rows.find((r) => r.name === "Sword, Short");
   assert.deepEqual(swordShort.traits, ["Deflect", "Disarm", "Hurl"]);
   assert.deepEqual(swordShort.masteryGroups, ["Med. Blades", "Short Blades"]);
});

test("keeps multiple mastery groups in order (Axe, Battle)", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const axeBattle = rows.find((r) => r.name === "Axe, Battle");
   assert.deepEqual(axeBattle.masteryGroups, ["Short Axes", "Long Axes"]);
});

test("generates two distinct names for the duplicated Sword, Bastard row", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const oneHanded = rows.find((r) => r.name === "Sword, Bastard");
   const twoHanded = rows.find((r) => r.name === "Sword, Bastard (Two-Handed)");
   assert.ok(oneHanded, "expected a one-handed Sword, Bastard entry");
   assert.ok(twoHanded, "expected a two-handed Sword, Bastard entry");
   assert.equal(oneHanded.section, "one-handed");
   assert.equal(twoHanded.section, "two-handed");
   // both share the same Table 9-2 lookup name, so both must resolve the same weight
   assert.equal(oneHanded.weightLb, 8);
   assert.equal(twoHanded.weightLb, 8);
});

test("converts a fractional Table 9-2 weight (½) to a decimal", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const hammer = rows.find((r) => r.name === "Hammer, Throwing");
   assert.equal(hammer.weightLb, 2.5);
});

test("also handles a plain decimal Table 9-2 weight", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const bolas = rows.find((r) => r.name === "Bolas");
   assert.equal(bolas.weightLb, 0.5);
});

test("treats a '–' or '_' Base Damage cell as \"0\"", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   const shield = rows.find((r) => r.name === "Shield, Buckler");
   assert.equal(shield.damageRoll, "0");
});

test("does not include rows from Table 6-2a (mastery tables)", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   assert.ok(!rows.some((r) => r.name.includes("Axe, Battle vs")));
});

test("returns exactly 12 rows for this fixture (2 unarmed + 6 one-handed incl. Bastard + 2 two-handed incl. Bastard + 2 ranged)", () => {
   const rows = parseWeapons(WEAPONS_FIXTURE, EQUIPMENT_FIXTURE);
   assert.equal(rows.length, 12);
});
