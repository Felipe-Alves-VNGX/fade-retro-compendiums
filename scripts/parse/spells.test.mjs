import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSpells, paragraphsToHtml } from "./spells.mjs";

const HEADER = "ALPHABETICAL SPELL LIST\n";

test("parseSpells extracts a single-class, single-circle spell", () => {
   const text = HEADER + `Analyse                                                 Energy
Wizard 1                             Target: one magic item
Range: special (see below)                    Duration: instant
To use an Analyse spell, the caster must imitate using the
item.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 1);
   assert.equal(records[0].name, "Analyse");
   assert.deepEqual(records[0].sphere, ["Energy"]);
   assert.equal(records[0].class, "Wizard");
   assert.equal(records[0].circle, 1);
   assert.equal(records[0].target, "one magic item");
   assert.equal(records[0].range, "special (see below)");
   assert.equal(records[0].duration, "instant");
   assert.equal(records[0].description, "<p>To use an Analyse spell, the caster must imitate using the item.</p>");
});

test("parseSpells fans out a multi-class, same-circle spell into one record per class", () => {
   const text = HEADER + `Animate Objects                                         Vitality
Cleric 6, Druid 6                 Target: one or more objects
Range: 60'                                     Duration: 1 hour
This spell will animate a number of objects.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 2);
   assert.deepEqual(records.map((r) => [r.class, r.circle]).sort(), [["Cleric", 6], ["Druid", 6]]);
   assert.equal(records[0].name, "Animate Objects");
   assert.equal(records[1].description, records[0].description);
});

test("parseSpells fans out a multi-class, different-circle spell", () => {
   const text = HEADER + `Animate Dead                                  Energy, Inertia
Cleric 4, Wizard 5              Target: one or more corpses
Range: 60'                              Duration: permanent
Zombies and skeletons.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 2);
   const byClass = Object.fromEntries(records.map((r) => [r.class, r.circle]));
   assert.deepEqual(byClass, { Cleric: 4, Wizard: 5 });
   assert.deepEqual(records[0].sphere, ["Energy", "Inertia"]);
});

test("parseSpells handles a spell with no sphere", () => {
   const text = HEADER + `Anti-Animal Shell
Druid 6                                         Target: caster
Range: personal                    Duration: 10 minutes/level
This spell prevents any animals from coming within 1" of the caster.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 1);
   assert.deepEqual(records[0].sphere, []);
});

test("parseSpells preserves a Reverse: block as part of the same description", () => {
   const text = HEADER + `Continual Light
Cleric 3, Druid 3, Wizard 2                     Target: 30' radius
Range: 120'                                  Duration: permanent
This lights an area.

Reverse: Continual Darkness causes the area to go dark.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 3);
   assert.match(records[0].description, /Reverse: Continual Darkness/);
});

test("parseSpells ignores a class token not in the known list (Fireball's Elf/Sorcerer)", () => {
   const text = HEADER + `Fireball                                                Energy
Wizard 3, Elf 3, Sorcerer 3                  Target: 20' radius
Range: 240'                                   Duration: instant
Boom.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 1);
   assert.equal(records[0].class, "Wizard");
   assert.equal(records[0].circle, 3);
});

test("parseSpells ignores a trailing comma with no following class (Snake Charm)", () => {
   const text = HEADER + `Snake Charm                                           Sympathy
Cleric 2, Druid 2,                  Target: one or more snakes
Range: 60'                                     Duration: special
Charms snakes.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 2);
   assert.deepEqual(records.map((r) => r.class).sort(), ["Cleric", "Druid"]);
});

test("parseSpells treats Damage: as a synonym for Duration: on that line (Clothform)", () => {
   const text = HEADER + `Clothform                                                Matter
Wizard 4                                           Target: none
Range: touch                                    Damage: instant
Creates cloth.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 1);
   assert.equal(records[0].range, "touch");
   assert.equal(records[0].duration, "instant");
});

test("parseSpells handles single-space separators before Target:/Duration: (Cure Disease Rev)", () => {
   const text = HEADER + `Cure Disease Rev                               Purity/Corruption
Cleric 3, Druid 3 Target: one living creature
Range: 30' Duration: permanent
Cures disease.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 2);
   assert.equal(records[0].target, "one living creature");
   assert.equal(records[0].range, "30'");
   assert.equal(records[0].duration, "permanent");
});

test("parseSpells stops (not rejects) a description at an embedded table's title line, and does not create a false entry boundary from it", () => {
   const text = HEADER + `Contact Outer Plane                                     Spirit
Wizard 5                                Target: one's own mind
Range: special                                Duration: special
This spell contacts a distant entity.
Table 7–4: Contact Outer Plane
   Distance to Plane              Questions             Chance to Know
           1                          3                       25%
If the caster is overwhelmed, no questions are answered.

Contingency                                            Energy
Wizard 9                Target: one creature, object or place
Range: touch                                Duration: special
When this spell is cast, the caster also casts a second spell.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 2);
   assert.equal(records[0].name, "Contact Outer Plane");
   assert.equal(records[0].description, "<p>This spell contacts a distant entity.</p>");
   assert.equal(records[1].name, "Contingency");
   assert.match(records[1].description, /When this spell is cast/);
});

test("parseSpells stops a description at a column-merge corruption (5+ space interior gap) without losing later entries", () => {
   const text = HEADER + `Fabricate                                               Matter
Wizard 6                                     Target: one object
Range: touch                                Duration: permanent
This spell shapes raw materials into a finished item.
be simply because the immortal is unhappy about being                   area will continue to be lit until it is dispelled.

Faerie Fire                                            Light
Wizard 1                                     Target: one creature
Range: 90'                                        Duration: 5 minutes
This spell outlines a creature in visible light.

`;
   const records = parseSpells(text);
   assert.equal(records.length, 2);
   assert.equal(records[0].description, "<p>This spell shapes raw materials into a finished item.</p>");
   assert.equal(records[1].name, "Faerie Fire");
   assert.match(records[1].description, /outlines a creature/);
});

test("paragraphsToHtml joins continuation lines with a space and wraps each paragraph in <p>", () => {
   const html = paragraphsToHtml(["This is line one", "continuing here.", "", "Second paragraph."]);
   assert.equal(html, "<p>This is line one continuing here.</p><p>Second paragraph.</p>");
});
