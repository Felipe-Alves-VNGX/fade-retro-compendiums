import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTalents, parseSkills } from "./skillsAndTalents.mjs";

const TALENTS_FIXTURE = `SKILLS & TALENTS
Some character classes have talents that they can use.

Open Locks: Characters without this talent can't attempt to
pick locks under normal circumstances.

Locate Traps: Normally, a character searches an area for traps.

Example: Black Leaf and Aloysius are standing some
distance from a suspicious looking vault door.

The Gameguide informs the players.

Remove Traps: When faced with knowledge that there is a
trap, characters without the Remove Traps talent must simply
describe to the Gameguide what they are doing.

Climb Walls: Any character can climb a tree.

Move Silently: Characters who are attempting to sneak past
someone must make a Sneak check.

Hide in Shadows: As with Move Silently, characters without
the Hide in Shadows talent may still attempt to hide.

Pick Pockets: Characters without this talent can't attempt
to pick pockets under normal circumstances.

Hear Noise: Any character can make a Spot check to listen
for quiet noises.

Read Languages: Characters without this talent can't
attempt to read text in languages they don't know.

Wizard Scroll Use: Characters without this talent can't use
wizard scrolls unless they have the ability to cast wizard spells.

ALPHABETIC SKILL LISTING
`;

test("parseTalents extracts exactly the 10 known talents in order", () => {
   const talents = parseTalents(TALENTS_FIXTURE);
   assert.equal(talents.length, 10);
   assert.deepEqual(talents.map((t) => t.name), [
      "Open Locks", "Locate Traps", "Remove Traps", "Climb Walls",
      "Move Silently", "Hide in Shadows", "Pick Pockets", "Hear Noise",
      "Read Languages", "Wizard Scroll Use",
   ]);
});

test("parseTalents does not treat an embedded 'Example:' block as a new talent", () => {
   const talents = parseTalents(TALENTS_FIXTURE);
   const locateTraps = talents.find((t) => t.name === "Locate Traps");
   assert.match(locateTraps.description, /Example: Black Leaf/);
   assert.equal(talents.some((t) => t.name === "Example"), false);
});

test("parseTalents wraps each paragraph of a description in <p>", () => {
   const talents = parseTalents(TALENTS_FIXTURE);
   const removeTraps = talents.find((t) => t.name === "Remove Traps");
   assert.match(removeTraps.description, /^<p>.*<\/p>$/);
});

const SKILLS_FIXTURE = `ALPHABETIC SKILL LISTING
ARCANE LORE
Each point spent on the arcane lore skill gives a +1 bonus to
intelligence checks made to recognise spells.

ETIQUETTE (CHOOSE CULTURE)
The etiquette skill is not a single skill. Each point spent in
the etiquette skill for a particular culture gives a +1 bonus
to charisma rolls used to behave properly in formal settings.

INTIMIDATION
Each point spent on the intimidation skill gives a +1 bonus
to both charisma checks and strength checks made to bully
an NPC into co-operation through threats.

LANGUAGE (CHOOSE LANGUAGE)
Each skill point spent on the language skill means that the
character knows another language to an acceptable level.

PERFORMANCE (CHOSE MEDIUM)
Each skill point spent on a specific performance skill gives
a +1 bonus to both dexterity checks and charisma checks
used to make these artistic performances.
`;

test("parseSkills extracts a simple single-ability skill", () => {
   const skills = parseSkills(SKILLS_FIXTURE);
   const arcaneLore = skills.find((s) => s.name === "Arcane Lore");
   assert.equal(arcaneLore.ability, "int");
   assert.equal(arcaneLore.extraAbility, null);
   assert.equal(arcaneLore.choiceNote, null);
});

test("parseSkills accepts 'bonus on X rolls' phrasing, not just 'bonus to X checks'", () => {
   const skills = parseSkills(SKILLS_FIXTURE);
   const etiquette = skills.find((s) => s.name === "Etiquette");
   assert.equal(etiquette.ability, "cha");
});

test("parseSkills captures a dual-ability skill's primary and extra ability", () => {
   const skills = parseSkills(SKILLS_FIXTURE);
   const intimidation = skills.find((s) => s.name === "Intimidation");
   assert.equal(intimidation.ability, "cha");
   assert.equal(intimidation.extraAbility, "str");
   const performance = skills.find((s) => s.name === "Performance");
   assert.equal(performance.ability, "dex");
   assert.equal(performance.extraAbility, "cha");
});

test("parseSkills leaves ability null for a special skill with no ability-check sentence (Language)", () => {
   const skills = parseSkills(SKILLS_FIXTURE);
   const language = skills.find((s) => s.name === "Language");
   assert.equal(language.ability, null);
   assert.equal(language.extraAbility, null);
});

test("parseSkills strips a (CHOOSE X) suffix from the name into choiceNote", () => {
   const skills = parseSkills(SKILLS_FIXTURE);
   const etiquette = skills.find((s) => s.name === "Etiquette");
   assert.equal(etiquette.choiceNote, "CHOOSE CULTURE");
   const language = skills.find((s) => s.name === "Language");
   assert.equal(language.choiceNote, "CHOOSE LANGUAGE");
});

test("parseSkills title-cases a multi-word ALL-CAPS header", () => {
   const skills = parseSkills(SKILLS_FIXTURE);
   assert.equal(skills.find((s) => s.name === "Arcane Lore").name, "Arcane Lore");
});
