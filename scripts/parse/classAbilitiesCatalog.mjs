// Ground truth catalog, verified by hand against the real book
// (spec sections 3 e 7 — extração exaustiva das 10 tabelas na
// inteiras, não amostra).
export const CLASS_NAMES = ["BATTLEMAGE", "CLERIC", "DRUID", "FIGHTER", "GRENADIER", "MOUNTEBANK", "MYSTIC", "RANGER", "THIEF", "WIZARD"];

export const ABILITY_CATALOG = [
   // [classKey, abilityName, levels[], changesPerLevel[] ou null]
   ["fighter", "Parry", [7], null],
   ["fighter", "Power Attack", [11], null],
   ["fighter", "Multi-attack", [10, 20, 30], ["2 ataques por rodada", "3 ataques por rodada", "4 ataques por rodada"]],
   ["battlemage", "Parry", [7], null],
   ["battlemage", "Power Attack", [11], null],
   ["battlemage", "Multi-attack", [14, 26], ["2 ataques por rodada", "3 ataques por rodada"]],
   ["cleric", "Turn Undead", [1], null],
   ["druid", "Command Animal", [1], null],
   ["grenadier", "Powder Crafting", [2, 4, 6, 8, 10, 13, 17], ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"]],
   ["grenadier", "Covering Fire", [7], null],
   ["grenadier", "Power Shot", [11], null],
   ["grenadier", "Powder Distillation", [14], null],
   ["grenadier", "Multi-attack", [10, 20, 30], ["2 ataques por rodada", "3 ataques por rodada", "4 ataques por rodada"]],
   ["mountebank", "Weak Magic", [1], null],
   ["mountebank", "Item Use", [1], null],
   ["mystic", "Alertness", [2], null],
   ["mystic", "Self Healing", [4], null],
   ["mystic", "Speak with Animals", [6], null],
   ["mystic", "Parry", [7], null],
   ["mystic", "Spell Resistance", [8], null],
   ["mystic", "Speak with Anyone", [10], null],
   ["mystic", "Power Attack", [11], null],
   ["mystic", "Still Mind", [12], null],
   ["mystic", "Pass Unnoticed", [14], null],
   ["mystic", "Gentle Touch", [18, 19, 20, 22, 24], ["Cureall", "Charm Monster", "Hold Monster", "Quest", "morte instantânea"]],
   ["ranger", "Nimble", [1], null],
   ["ranger", "Parry", [7], null],
   ["ranger", "Power Attack", [11], null],
   ["ranger", "Power Shot", [11], null],
   ["ranger", "Multi-attack", [14, 26], ["2 ataques por rodada", "3 ataques por rodada"]],
   ["thief", "Sneak Attack", [1], null],
];

// Ability with text identical across classes except the class name —
// one shared item, referenced by all 4 classes (including Thief,
// whose own book never writes a "Breath Evasion:" prose of its own —
// a real omission in the source material, not an extraction bug).
export const SHARED_ABILITY = {
   name: "Breath Evasion",
   level: 16,
   classes: ["mountebank", "mystic", "ranger", "thief"],
};

// [classKey, talentName, level] — talentName must match an existing
// item in packsrc/items/Talents/*.json (domain skills) exactly.
export const TALENT_LINKS = [
   ["thief", "Open Locks", 1], ["thief", "Locate Traps", 1], ["thief", "Remove Traps", 1],
   ["thief", "Climb Walls", 1], ["thief", "Move Silently", 1], ["thief", "Hide in Shadows", 1],
   ["thief", "Pick Pockets", 1], ["thief", "Hear Noise", 1],
   ["thief", "Read Languages", 4], ["thief", "Wizard Scroll Use", 10],
   ["mountebank", "Climb Walls", 1], ["mountebank", "Move Silently", 1],
   ["mountebank", "Hide in Shadows", 1], ["mountebank", "Pick Pockets", 1],
   ["mystic", "Locate Traps", 1], ["mystic", "Remove Traps", 1], ["mystic", "Climb Walls", 1],
   ["mystic", "Move Silently", 1], ["mystic", "Hide in Shadows", 1],
   ["ranger", "Climb Walls", 1], ["ranger", "Move Silently", 1], ["ranger", "Hide in Shadows", 1],
];
