import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dehyphenate, straightenQuotes } from "./normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAPTERS_PATH = path.join(__dirname, "chapters.json");

// Fixed for the whole book: every page is 612x792pt (confirmed via
// `pdfinfo`), and the two-column body text sits within these bounds.
// H=720 starting at y=36 already excludes the page-number footer.
const LEFT_COLUMN = { x: 18, y: 36, W: 282, H: 720 };
const RIGHT_COLUMN = { x: 312, y: 36, W: 264, H: 720 };

/**
 * Run pdftotext over one page, optionally cropped to a column box.
 * @param {string} pdfPath
 * @param {number} pageNum
 * @param {{x:number,y:number,W:number,H:number}|null} box - null means
 *   full page width (used for pages with a full-width table).
 * @returns {string}
 */
function extractRegion(pdfPath, pageNum, box) {
   const args = ["-f", String(pageNum), "-l", String(pageNum), "-layout"];
   if (box) {
      args.push("-x", String(box.x), "-y", String(box.y), "-W", String(box.W), "-H", String(box.H));
   }
   args.push(pdfPath, "-");
   return execFileSync("pdftotext", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
}

/**
 * Extract one page, applying the column split unless it is a declared
 * full-width (table) page.
 * @param {string} pdfPath
 * @param {number} pageNum
 * @param {boolean} isFullWidth
 * @returns {string}
 */
function extractPage(pdfPath, pageNum, isFullWidth) {
   if (isFullWidth) {
      return extractRegion(pdfPath, pageNum, null);
   }
   const left = extractRegion(pdfPath, pageNum, LEFT_COLUMN);
   const right = extractRegion(pdfPath, pageNum, RIGHT_COLUMN);
   return `${left}\n${right}`;
}

/**
 * Extract and normalize one full chapter into a single text blob, with a
 * "--- page N ---" marker before each page's content so a reader (or a
 * future Phase 3 parser) can locate the source page of any snippet.
 * @param {string} pdfPath
 * @param {{startPage:number,endPage:number,fullWidthPages:number[]}} chapter
 * @returns {string}
 */
export function extractChapter(pdfPath, chapter) {
   const fullWidthSet = new Set(chapter.fullWidthPages);
   const pageBlocks = [];
   for (let page = chapter.startPage; page <= chapter.endPage; page++) {
      const raw = extractPage(pdfPath, page, fullWidthSet.has(page));
      const normalized = straightenQuotes(dehyphenate(raw));
      pageBlocks.push(`--- page ${page} ---\n${normalized}`);
   }
   return pageBlocks.join("\n\n");
}

function parseArgs(argv) {
   const chapterIndex = argv.indexOf("--chapter");
   return {
      chapter: chapterIndex !== -1 ? argv[chapterIndex + 1] : null,
      all: argv.includes("--all"),
   };
}

function main() {
   const pdfPath = process.env.DD4_PDF_PATH;
   if (!pdfPath) {
      console.error("DD4_PDF_PATH is not set. Point it at your copy of Dark_Dungeons_(4th_Edition).pdf, e.g.:");
      console.error('  export DD4_PDF_PATH="$HOME/Documentos/DD4/Dark_Dungeons_(4th_Edition).pdf"');
      process.exit(1);
   }
   if (!fs.existsSync(pdfPath)) {
      console.error(`DD4_PDF_PATH points to a file that does not exist: ${pdfPath}`);
      process.exit(1);
   }

   const chapters = JSON.parse(fs.readFileSync(CHAPTERS_PATH, "utf8"));
   const { chapter, all } = parseArgs(process.argv.slice(2));

   let idsToRun;
   if (all) {
      idsToRun = Object.keys(chapters);
   } else if (chapter && chapters[chapter]) {
      idsToRun = [chapter];
   } else {
      console.error(`Usage: node scripts/extract/pdf2txt.mjs --chapter <id> | --all`);
      console.error(`Available chapters: ${Object.keys(chapters).join(", ")}`);
      process.exit(1);
   }

   const outDir = path.join(process.cwd(), "extract", "raw");
   fs.mkdirSync(outDir, { recursive: true });

   for (const id of idsToRun) {
      const ch = chapters[id];
      console.log(`Extracting ${id} (pages ${ch.startPage}-${ch.endPage})...`);
      const text = extractChapter(pdfPath, ch);
      const outPath = path.join(outDir, `${id}.txt`);
      fs.writeFileSync(outPath, text, "utf8");
      console.log(`  wrote ${outPath} (${text.length} chars)`);
   }
}

if (process.argv[1] && process.argv[1].endsWith("pdf2txt.mjs")) {
   main();
}
