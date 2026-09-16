/**
 * Rejoin a hyphenated compound word that wraps across a line break,
 * preserving the hyphen. Dark Dungeons uses ragged-right (non-justified)
 * text — every real occurrence of a line-ending hyphen in the book's
 * text is a compound word (non-living, non-magical, life-force,
 * semi-desert) that happens to wrap at its own hyphen, never a word
 * broken arbitrarily to fit. Removing the hyphen would incorrectly fuse
 * the compound into one word (e.g. "non-living" must not become
 * "nonliving"). The table "no value" marker uses an en-dash (–),
 * a different character from the ASCII hyphen-minus this function
 * matches, so table content is never touched by this function.
 * @param {string} text
 * @returns {string}
 */
export function dehyphenate(text) {
   return text.replace(/([a-z])-\n([a-z])/g, "$1-$2");
}

/**
 * Convert typographic (curly) quotes and apostrophes to straight ASCII,
 * matching the convention the Phase 1 hand-written items already use.
 * Only the quote/apostrophe characters are touched; the en-dash table
 * marker and every other symbol are left as-is.
 * @param {string} text
 * @returns {string}
 */
export function straightenQuotes(text) {
   return text
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"');
}
