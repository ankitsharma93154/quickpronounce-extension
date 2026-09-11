#!/usr/bin/env node
/*
 * No build step, no linter dependency. This just runs `node --check` (a real
 * syntax parse) over every .js file in the extension, plus a couple of sanity
 * checks on manifest.json. Run before loading/packing:
 *
 *   node scripts/check.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const JS_DIRS = ["src", "scripts"];

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && entry.name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

let failed = 0;
const files = [];
for (const d of JS_DIRS) {
  const abs = path.join(ROOT, d);
  if (fs.existsSync(abs)) walk(abs, files);
}

for (const file of files) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    console.log("ok   " + path.relative(ROOT, file));
  } catch (err) {
    failed++;
    console.error("FAIL " + path.relative(ROOT, file));
    console.error(String(err.stderr || err.message).trim());
  }
}

// manifest sanity
try {
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const problems = [];
  if (mf.manifest_version !== 3) problems.push("manifest_version must be 3");
  if (!mf.background || !mf.background.service_worker) problems.push("missing background.service_worker");
  for (const cs of mf.content_scripts || []) {
    for (const js of cs.js || []) {
      if (!fs.existsSync(path.join(ROOT, js))) problems.push("content_scripts file missing: " + js);
    }
  }
  for (const key of ["16", "32", "48", "128"]) {
    const p = mf.icons && mf.icons[key];
    if (p && !fs.existsSync(path.join(ROOT, p))) problems.push("icon missing: " + p + " (run: node scripts/generate-icons.js)");
  }
  if (problems.length) {
    failed += problems.length;
    problems.forEach((p) => console.error("FAIL manifest.json: " + p));
  } else {
    console.log("ok   manifest.json");
  }
} catch (err) {
  failed++;
  console.error("FAIL manifest.json: " + err.message);
}

console.log(failed ? `\n${failed} problem(s)` : "\nall good");
process.exit(failed ? 1 : 0);
