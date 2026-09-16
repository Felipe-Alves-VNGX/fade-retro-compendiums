import { test } from "node:test";
import assert from "node:assert/strict";
import { dehyphenate, straightenQuotes } from "./normalize.mjs";

test("dehyphenate joins a compound word wrapped across a line break, keeping the hyphen", () => {
   const input = "any non-\nliving creatures such as automatons";
   assert.equal(dehyphenate(input), "any non-living creatures such as automatons");
});

test("dehyphenate handles multiple occurrences in the same text", () => {
   const input = "all non-\nmagical missiles and all non-\nliving creatures";
   assert.equal(dehyphenate(input), "all non-magical missiles and all non-living creatures");
});

test("dehyphenate leaves an inline compound hyphen untouched", () => {
   const input = "found in desert or semi-desert terrain";
   assert.equal(dehyphenate(input), "found in desert or semi-desert terrain");
});

test("dehyphenate leaves an em-dash used as a table 'no value' marker untouched", () => {
   const input = "Attack Bonus      –             –               +1";
   assert.equal(dehyphenate(input), input);
});

test("dehyphenate leaves text with no line-wrapped hyphen unchanged", () => {
   const input = "A short blade with a one-handed grip.";
   assert.equal(dehyphenate(input), input);
});

test("straightenQuotes converts curly single quotes and apostrophes to ASCII", () => {
   const input = `the wielder’s off hand, ‘simple’ to use`;
   assert.equal(straightenQuotes(input), "the wielder's off hand, 'simple' to use");
});

test("straightenQuotes converts curly double quotes to ASCII", () => {
   const input = `a “simple” weapon`;
   assert.equal(straightenQuotes(input), 'a "simple" weapon');
});

test("straightenQuotes leaves text with no typographic quotes unchanged", () => {
   const input = "A 1' to 2' length of wood dipped in pitch or tallow.";
   assert.equal(straightenQuotes(input), input);
});

test("straightenQuotes does not affect the en-dash table marker", () => {
   const input = "Hurl Range       –             –                –";
   assert.equal(straightenQuotes(input), input);
});
