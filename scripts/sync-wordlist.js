#!/usr/bin/env node
/*
 * Copies the canonical wordlist (Pronounce_web/public/wordlist.txt) into this
 * extension's bundled copy (src/data/wordlist.txt), used to power the
 * popup's search suggestions offline, with no extra host permission.
 *
 * Run this whenever the website's wordlist is regenerated from a dataset
 * refresh, then commit the result - there is no automatic link between the
 * two copies, this script is the sync step:
 *
 *   node scripts/sync-wordlist.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "..", "Pronounce_web", "public", "wordlist.txt");
const DEST = path.join(__dirname, "..", "src", "data", "wordlist.txt");

if (!fs.existsSync(SRC)) {
  console.error("Source not found: " + SRC);
  console.error("Expected the Pronounce_web repo checked out as a sibling of this one.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.copyFileSync(SRC, DEST);

const wordCount = fs.readFileSync(DEST, "utf8").split("\n").filter(Boolean).length;
const bytes = fs.statSync(DEST).size;
console.log(
  `Copied ${wordCount} words (${(bytes / 1024 / 1024).toFixed(2)} MB) to ` +
    path.relative(path.join(__dirname, ".."), DEST)
);
console.log("Commit this file if it changed.");
