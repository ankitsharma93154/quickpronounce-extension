#!/usr/bin/env node
/*
 * Headless unit checks for the framework-free logic modules. Loads the core
 * classic scripts into one sandbox with stubbed `self` / `chrome`, then
 * asserts behaviour. No test framework.
 *
 *   node scripts/selftest.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log("  ok   " + name);
  } else {
    failed++;
    console.error("  FAIL " + name);
  }
}
function eq(name, a, b) {
  ok(name + "  (" + JSON.stringify(a) + " === " + JSON.stringify(b) + ")", JSON.stringify(a) === JSON.stringify(b));
}

// --- sandbox with in-memory chrome.storage.local ----------------------
const storageData = {};
const chromeStub = {
  runtime: { lastError: null },
  storage: {
    local: {
      get(key, cb) {
        const out = {};
        if (typeof key === "string") {
          if (key in storageData) out[key] = storageData[key];
        }
        cb(out);
      },
      set(obj, cb) {
        Object.assign(storageData, obj);
        cb && cb();
      }
    }
  }
};

const sandbox = { console };
sandbox.self = sandbox;
sandbox.window = sandbox;
sandbox.chrome = chromeStub;
sandbox.atob = (b64) => Buffer.from(b64, "base64").toString("binary");
vm.createContext(sandbox);

function load(rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), "utf8");
  vm.runInContext(code, sandbox, { filename: rel });
}

["src/core/globals.js", "src/core/util.js", "src/core/config.js", "src/core/respell.js", "src/core/normalize.js", "src/core/store.js", "src/core/cap.js", "src/core/offlineData.js", "src/core/offlineCache.js"].forEach(load);

const QP = sandbox.QP;

(async function run() {
  console.log("normalize:");
  eq('"running," -> running', QP.normalize.normalizeWord('"running,"').word, "running");
  eq("(accommodation) -> accommodation", QP.normalize.normalizeWord("(accommodation)").word, "accommodation");
  eq('"Hello!" -> hello', QP.normalize.normalizeWord('"Hello!"').word, "hello");
  eq("Running -> running", QP.normalize.normalizeWord("Running").word, "running");
  eq("don't kept", QP.normalize.normalizeWord("don't").word, "don't");
  eq("well-being kept", QP.normalize.normalizeWord("well-being").word, "well-being");
  {
    const r = QP.normalize.normalizeWord("quick brown fox");
    ok("multiword flagged + first token", r.multiword === true && r.word === "quick");
  }
  {
    // first token may be a real short word; that is fine, it has a pronunciation
    const r = QP.normalize.normalizeWord("a quick brown fox");
    ok("multiword picks first token 'a'", r.multiword === true && r.word === "a");
  }
  {
    // leading punctuation token is skipped to the first token with letters
    const r = QP.normalize.normalizeWord('"  -- quick brown');
    ok("skips punctuation-only leading token", r.word === "quick" && r.multiword === true);
  }
  ok("whitespace -> not ok", QP.normalize.normalizeWord("   ").ok === false);
  ok("digits/punct only -> not ok", QP.normalize.normalizeWord("123 -- !!").ok === false);
  eq("leading spaces + comma", QP.normalize.normalizeWord("  ,word ").word, "word");

  console.log("respell:");
  eq(
    "pronunciation respelling",
    QP.respell.toRespelling([
      { text: "pruh", stress: 0 },
      { text: "nun", stress: 2 },
      { text: "see", stress: 0 },
      { text: "ay", stress: 1 },
      { text: "shuhn", stress: 0 }
    ]),
    "pruh·Nun·see·AY·shuhn"
  );
  eq("empty syllables -> ''", QP.respell.toRespelling([]), "");
  eq("count", QP.respell.syllableCount([{ text: "a" }, { text: "b" }, { text: "" }]), 2);

  console.log("offlineCache:");
  ok("has(pronunciation)", QP.offlineCache.has("pronunciation") === true);
  ok("lookup miss -> null", QP.offlineCache.lookup("zzznotaword") === null);
  {
    const hit = QP.offlineCache.lookup("schedule");
    ok("schedule has us+uk ipa", !!(hit && hit.ipa.us && hit.ipa.uk && hit.ipa.us !== hit.ipa.uk));
  }

  console.log("cap (limit forced to 3):");
  QP.config.DAILY_UNIQUE_WORD_LIMIT = 3;
  await QP.cap.reset();
  let r1 = await QP.cap.record("alpha");
  ok("1st new word allowed + consumed", r1.allowed && r1.consumed);
  let r2 = await QP.cap.record("alpha");
  ok("same word again: allowed, not consumed", r2.allowed && !r2.consumed && r2.alreadyKnown);
  await QP.cap.record("bravo");
  await QP.cap.record("charlie");
  let r5 = await QP.cap.record("delta");
  ok("4th new word blocked", r5.allowed === false && r5.usage.remaining === 0);
  let r6 = await QP.cap.record("bravo");
  ok("known word still allowed at cap", r6.allowed === true && r6.consumed === false);
  const snap = await QP.cap.snapshot();
  eq("snapshot used", snap.used, 3);
  ok("snapshot resetsAt in the future", typeof snap.resetsAt === "number" && snap.resetsAt > Date.now());

  console.log("\n" + (failed ? failed + " FAILED, " : "") + passed + " passed");
  process.exit(failed ? 1 : 0);
})();
