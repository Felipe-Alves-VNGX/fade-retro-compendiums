import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KNOWN_CLASSES = ["Cleric", "Druid", "Wizard"];
const CLASS_TOKEN_RE = new RegExp(`(${KNOWN_CLASSES.join("|")})\\s+(\\d+)`, "g");
const HEADER_LOOKAHEAD_RE = /^(Cleric|Druid|Wizard)\s+\d/;
const INTERIOR_GAP_RE = /\S\s{5,}\S/;
const TABLE_TITLE_RE = /^Table \d/i;

// Unlike equipment/weapons/weaponMastery, most page breaks in this file
// have NO page-footer number before the "--- page N ---" marker (only
// "\f\n\n--- page N ---\n") — confirmed by sampling 6 real transitions.
// The footer-number group is therefore optional here (equipment/
// weapons/weaponMastery always have it, so their copies of this
// function require it) — verified against the full file: without this
// difference, 55/254 generated documents end up with a literal
// "--- page N ---" marker leaked into system.description.
function stripPageBoundaries(text) {
   return text
      .replace(/\f/g, "")
      .replace(/\n[ \t]*\n*(?:[ \t]*\d{1,4}[ \t]*\n[ \t]*\n*)?--- page \d+ ---\n/g, "\n");
}

function splitOnLabel(line, label) {
   const idx = line.indexOf(label);
   if (idx === -1) return null;
   return [line.slice(0, idx).trim(), line.slice(idx + label.length).trim()];
}

/**
 * Join raw description lines into one `<p>` block per blank-line-
 * separated paragraph, continuation lines joined with a single space.
 * @param {string[]} lines
 * @returns {string}
 */
export function paragraphsToHtml(lines) {
   const paragraphs = [];
   let current = [];
   for (const line of lines) {
      if (line.trim() === "") {
         if (current.length > 0) {
            paragraphs.push(current.join(" "));
            current = [];
         }
         continue;
      }
      current.push(line.trim());
   }
   if (current.length > 0) paragraphs.push(current.join(" "));
   return paragraphs.map((p) => `<p>${p}</p>`).join("");
}

/**
 * Parse the alphabetical spell list into one record per (spell, class,
 * circle) combination. A spell entry with N class+circle combos in its
 * header produces N records sharing the same sphere/target/range/
 * duration/description — the fan-out the Spells/<Classe>/Circle_N/
 * folder structure requires. A line N is treated as a spell's name/
 * sphere header only when line N+1 matches a class+circle pattern
 * (one-line lookahead) — this also naturally serves as the stop
 * condition for the previous entry's description.
 * @param {string} rawText - full contents of extract/raw/spells.txt
 * @returns {object[]}
 */
export function parseSpells(rawText) {
   const startIdx = rawText.indexOf("ALPHABETICAL SPELL LIST");
   const body = stripPageBoundaries(rawText.slice(startIdx));
   const lines = body.split("\n");

   const records = [];
   let i = 1;
   while (i < lines.length) {
      const line = lines[i];
      const next = lines[i + 1] || "";
      if (line.trim() === "" || !HEADER_LOOKAHEAD_RE.test(next.trim())) {
         i++;
         continue;
      }

      const headerTrimmed = line.trim();
      const headerMatch = headerTrimmed.match(/^(.+?)\s{2,}(.+)$/);
      const name = headerMatch ? headerMatch[1].trim() : headerTrimmed;
      const sphere = headerMatch ? headerMatch[2].trim().split(",").map((s) => s.trim()) : [];

      const l2 = next.trim();
      const l2split = splitOnLabel(l2, "Target:");
      const classCircleSeg = l2split ? l2split[0] : l2;
      const target = l2split ? l2split[1] : "";
      const classCircles = [];
      CLASS_TOKEN_RE.lastIndex = 0;
      let cm;
      while ((cm = CLASS_TOKEN_RE.exec(classCircleSeg))) {
         classCircles.push({ class: cm[1], circle: Number(cm[2]) });
      }

      const l3 = (lines[i + 2] || "").trim();
      const l3split = splitOnLabel(l3, "Range:");
      let range = "";
      let duration = "";
      if (l3split) {
         const rest = l3split[1];
         const durSplit = splitOnLabel(rest, "Duration:") || splitOnLabel(rest, "Damage:");
         if (durSplit) {
            range = durSplit[0];
            duration = durSplit[1];
         }
      }

      let j = i + 3;
      const descLines = [];
      while (j < lines.length) {
         const jNext = lines[j + 1] || "";
         if (lines[j].trim() !== "" && HEADER_LOOKAHEAD_RE.test(jNext.trim())) break;
         // Stop (keep what's collected so far), never reject the whole
         // entry — same asymmetry as equipment/weapons matchDescription.
         // Catches the page-103 column-merge corruption (a run of 5+
         // spaces inside a line) and an embedded table's title line
         // (which has no interior gap once trimmed, so needs its own
         // check) before either bleeds garbled prose into the
         // description.
         if (INTERIOR_GAP_RE.test(lines[j])) break;
         if (TABLE_TITLE_RE.test(lines[j].trim())) break;
         descLines.push(lines[j]);
         j++;
      }
      const description = paragraphsToHtml(descLines);

      for (const cc of classCircles) {
         records.push({ name, sphere, class: cc.class, circle: cc.circle, target, range, duration, description });
      }

      i = j;
   }
   return records;
}

async function main() {
   const rawPath = path.join(process.cwd(), "extract", "raw", "spells.txt");
   const rawText = await fs.readFile(rawPath, "utf8");
   const records = parseSpells(rawText);
   const outPath = path.join(process.cwd(), "extract", "parsed", "spells.json");
   await fs.writeFile(outPath, JSON.stringify(records, null, 2) + "\n", "utf8");
   console.log(`wrote ${records.length} spell record(s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
   main();
}
