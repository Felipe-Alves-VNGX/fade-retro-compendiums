import { test } from "node:test";
import assert from "node:assert/strict";
import { deterministicId, buildTalentDocument, buildSkillDocument } from "./skillsAndTalents.mjs";

test("deterministicId matches the 16-char alphanumeric ID pattern", () => {
   assert.match(deterministicId("skills:Balance"), /^[a-zA-Z0-9]{16}$/);
});

test("deterministicId is stable across calls", () => {
   assert.equal(deterministicId("skills:Balance"), deterministicId("skills:Balance"));
});

test("buildTalentDocument maps a talent to the specialAbility subtype", () => {
   const doc = buildTalentDocument({ name: "Climb Walls", description: "<p>Any character can climb a tree.</p>" });
   assert.equal(doc.type, "specialAbility");
   assert.equal(doc.name, "Climb Walls");
   assert.equal(doc.system.category, "talent");
   assert.equal(doc.system.description, "<p>Any character can climb a tree.</p>");
   assert.deepEqual(doc.system.tags, []);
   assert.equal(doc.system.rollFormula, "");
   assert.equal(doc.system.savingThrow, null);
});

test("buildSkillDocument maps a simple single-ability skill", () => {
   const doc = buildSkillDocument({
      name: "Arcane Lore", ability: "int", extraAbility: null, choiceNote: null,
      description: "<p>Gives a bonus to recognise spells.</p>",
   });
   assert.equal(doc.type, "skill");
   assert.equal(doc.system.ability, "int");
   assert.equal(doc.system.level, 1);
   assert.equal(doc.system.rollFormula, "1d20");
   assert.equal(doc.system.targetFormula, "@rollTarget");
   assert.equal(doc.system.operator, "lte");
   assert.equal(doc.system.skillBonus, 0);
   assert.equal(doc.system.skillPenalty, 0);
   assert.equal(doc.system.gm.notes, "");
});

test("buildSkillDocument records a dual-ability skill's extra ability in gm.notes", () => {
   const doc = buildSkillDocument({
      name: "Intimidation", ability: "cha", extraAbility: "str", choiceNote: null,
      description: "<p>Bully an NPC.</p>",
   });
   assert.equal(doc.system.ability, "cha");
   assert.match(doc.system.gm.notes, /str/);
});

test("buildSkillDocument records the special-skill case (no ability) in gm.notes and defaults ability to str", () => {
   const doc = buildSkillDocument({
      name: "Language", ability: null, extraAbility: null, choiceNote: "CHOOSE LANGUAGE",
      description: "<p>Knows another language.</p>",
   });
   assert.equal(doc.system.ability, "str");
   assert.match(doc.system.gm.notes, /Special skill/);
});

test("buildSkillDocument records a choiceNote (CHOOSE X skill) in gm.notes", () => {
   const doc = buildSkillDocument({
      name: "Craft", ability: "dex", extraAbility: null, choiceNote: "CHOOSE MEDIUM",
      description: "<p>Craft skill.</p>",
   });
   assert.match(doc.system.gm.notes, /escolha de especialização/);
});

test("buildSkillDocument is idempotent: same record produces byte-identical output twice", () => {
   const skill = {
      name: "Balance", ability: "dex", extraAbility: null, choiceNote: null,
      description: "<p>Keep one's footing.</p>",
   };
   assert.deepEqual(buildSkillDocument(skill), buildSkillDocument(skill));
});
