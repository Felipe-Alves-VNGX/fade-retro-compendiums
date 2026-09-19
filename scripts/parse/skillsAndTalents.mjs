import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TALENT_NAMES = [
   "Open Locks", "Locate Traps", "Remove Traps", "Climb Walls",
   "Move Silently", "Hide in Shadows", "Pick Pockets", "Hear Noise",
   "Read Languages", "Wizard Scroll Use",
];

const ABILITY_MAP = {
   strength: "str", intelligence: "int", wisdom: "wis",
   dexterity: "dex", charisma: "cha", constitution: "con",
};
const ABILITY_RE = /bonus\s+(?:to|on)\s+(?:both\s+)?(\w+)\s+(?:checks|rolls)(?:\s+and\s+(\w+)\s+checks)?/i;

/**
 * Collapse a page-boundary run (form feed + blank lines + the literal
 * "--- page N ---" marker line) into either a paragraph break or a
 * single space, depending on whether the text immediately before it
 * ends a sentence. Verified against all 12 page breaks in this
 * chapter: 11 end in sentence-ending punctuation and must stay
 * paragraph breaks (otherwise legitimate breaks like Bluff's "Note:"
 * paragraph or Disguise's bullet list get merged into the preceding
 * text); exactly 1 (Magical Engineering, p.71) does not, and joining
 * it with a space is what keeps that sentence intact.
 * @param {string} text
 * @returns {string}
 */
function stripPageBoundaries(text) {
   return text.replace(/([^\n])\n\f?\n*--- page \d+ ---\n/g, (match, lastChar) => {
      const endsSentence = /[.!?:;"'’”\)\]]/.test(lastChar);
      return endsSentence ? `${lastChar}\n\n` : `${lastChar} `;
   });
}

/**
 * Join raw text into one `<p>` block per blank-line-separated
 * paragraph, continuation lines joined with a single space.
 * @param {string} text
 * @returns {string}
 */
function paragraphsToHtml(text) {
   const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean).join(" ").trim())
      .filter(Boolean);
   return paragraphs.map((p) => `<p>${p}</p>`).join("");
}

/**
 * Extract the 10 talents from the "SKILLS & TALENTS" section, using a
 * fixed name list as delimiters rather than generic "Word: " detection
 * — the section also contains an "Example:" block (inside "Locate
 * Traps"'s own description) that would otherwise be mistaken for an
 * 11th talent.
 * @param {string} rawText
 * @returns {{name: string, description: string}[]}
 */
export function parseTalents(rawText) {
   const startIdx = rawText.indexOf("SKILLS & TALENTS");
   const endIdx = rawText.indexOf("ALPHABETIC SKILL LISTING");
   const body = stripPageBoundaries(rawText.slice(startIdx, endIdx));

   const positions = TALENT_NAMES.map((name) => {
      const idx = body.indexOf(`${name}:`);
      if (idx === -1) throw new Error(`talent not found in source text: ${name}`);
      return { name, idx };
   }).sort((a, b) => a.idx - b.idx);

   return positions.map((pos, i) => {
      const contentStart = pos.idx + pos.name.length + 1;
      const contentEnd = i + 1 < positions.length ? positions[i + 1].idx : body.length;
      const raw = body.slice(contentStart, contentEnd);
      return { name: pos.name, description: paragraphsToHtml(raw) };
   });
}

/**
 * Extract the 31 skills from the "ALPHABETIC SKILL LISTING" section.
 * A header line is ALL-CAPS, optionally with a "(CHOOSE X)" suffix for
 * the 6 specialization-choice skills — that suffix is stripped from
 * the name and returned separately as `choiceNote`.
 * @param {string} rawText
 * @returns {{name: string, ability: string|null, extraAbility: string|null, choiceNote: string|null, description: string}[]}
 */
export function parseSkills(rawText) {
   const startIdx = rawText.indexOf("ALPHABETIC SKILL LISTING") + "ALPHABETIC SKILL LISTING".length;
   const body = stripPageBoundaries(rawText.slice(startIdx));
   const lines = body.split("\n");

   const headerRe = /^[A-Z][A-Z0-9 /()\-]+$/;
   const headers = [];
   for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() !== "" && headerRe.test(lines[i])) {
         headers.push({ line: i, raw: lines[i].trim() });
      }
   }

   return headers.map((h, i) => {
      const nextLine = i + 1 < headers.length ? headers[i + 1].line : lines.length;
      const content = lines.slice(h.line + 1, nextLine).join("\n");
      const description = paragraphsToHtml(content);

      const nameMatch = h.raw.match(/^([A-Z][A-Z0-9 /\-]*?)(?:\s*\(([^)]*)\))?$/);
      const name = nameMatch[1].trim().split(" ")
         .map((w) => w[0] + w.slice(1).toLowerCase())
         .join(" ");
      const choiceNote = nameMatch[2] || null;

      const abilityMatch = content.replace(/\n/g, " ").match(ABILITY_RE);
      const ability = abilityMatch ? (ABILITY_MAP[abilityMatch[1].toLowerCase()] ?? null) : null;
      const extraAbility = abilityMatch && abilityMatch[2]
         ? (ABILITY_MAP[abilityMatch[2].toLowerCase()] ?? null)
         : null;

      return { name, ability, extraAbility, choiceNote, description };
   });
}

async function main() {
   const rawPath = path.join(process.cwd(), "extract", "raw", "skills-and-talents.txt");
   const rawText = await fs.readFile(rawPath, "utf8");
   const talents = parseTalents(rawText);
   const skills = parseSkills(rawText);
   const outPath = path.join(process.cwd(), "extract", "parsed", "skillsAndTalents.json");
   await fs.writeFile(outPath, JSON.stringify({ talents, skills }, null, 2) + "\n", "utf8");
   console.log(`wrote ${talents.length} talent(s), ${skills.length} skill(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
