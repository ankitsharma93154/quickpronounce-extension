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

["src/core/globals.js", "src/core/util.js", "src/core/config.js", "src/core/respell.js", "src/core/normalize.js", "src/core/store.js", "src/core/cap.js", "src/core/offlineData.js", "src/core/offlineCache.js", "src/core/api.js", "src/core/suggest.js"].forEach(load);

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

  console.log("pickSenses (duplicate-POS entry selection):");
  {
    // real shape from the dataset: "sir" has three separate Noun entries -
    // the first is an unrelated initialism, so it must be skipped in favor
    // of the real "titular prefix" sense further down the list.
    const entries = [
      { partOfSpeech: "Noun", definitions: ["Initialism of surface insulation resistance."] },
      { partOfSpeech: "Name", definitions: ["Initialism of Special Intensive Revision, a voter-roll revision process in India."] },
      { partOfSpeech: "Adjective", definitions: ["Initialism of susceptible-infected/infectious-removed/recovered."] },
      { partOfSpeech: "Noun", definitions: ["The titular prefix given to a knight or baronet."] },
      { partOfSpeech: "Name", definitions: ["Alternative form of Syr."] },
      { partOfSpeech: "Noun", definitions: ["A man of a higher rank or position."] },
      { partOfSpeech: "Verb", definitions: ["To address another individual using \"sir\"."] }
    ];
    const senses = QP.api.pickSenses(entries, "Noun");
    const noun = senses.find((s) => s.pos === "Noun");
    ok("sir: Noun sense skips the initialism entry", noun && noun.definition === "The titular prefix given to a knight or baronet.");
    ok("sir: primary Noun sense still leads", senses[0].pos === "Noun");
  }
  {
    // "ad": first Noun entry is an initialism, a later Noun entry is the
    // real meaning - same shape, different word, confirms it's not a
    // one-off fix for "sir" specifically.
    const entries = [
      { partOfSpeech: "Noun", definitions: ["Initialism of assistant director."] },
      { partOfSpeech: "Adverb", definitions: ["Initialism of Anno Domini (borrowed from Latin); in the year of our Lord."] },
      { partOfSpeech: "Adjective", definitions: ["Initialism of antidumping."] },
      { partOfSpeech: "Name", definitions: ["Initialism of Abu Dhabi."] },
      { partOfSpeech: "Noun", definitions: ["Advantage; also, designating the left-hand side, from the player's point of view."] },
      { partOfSpeech: "Preposition", definitions: ["to, toward"] }
    ];
    const senses = QP.api.pickSenses(entries, "Noun");
    const noun = senses.find((s) => s.pos === "Noun");
    eq("ad: Noun sense skips the initialism entry", noun.definition, "Advantage; also, designating the left-hand side, from the player's point of view.");
  }
  {
    // "app": the alt-form-of signal, not initialism - a different family of
    // the same underlying problem.
    const entries = [
      { partOfSpeech: "Noun", definitions: ["Alternative form of app."] },
      { partOfSpeech: "Name", definitions: ["A surname from German."] },
      { partOfSpeech: "Noun", definitions: ["An application (program), especially a small one designed for a mobile device."] }
    ];
    const senses = QP.api.pickSenses(entries, "Noun");
    const noun = senses.find((s) => s.pos === "Noun");
    eq("app: Noun sense skips the alt-form entry", noun.definition, "An application (program), especially a small one designed for a mobile device.");
  }
  {
    // "aaa"-shaped: every entry sharing the POS is non-primary - there is no
    // better option, so the first one must be kept rather than discarded.
    const entries = [
      { partOfSpeech: "Noun", definitions: ["Initialism of abdominal aortic aneurysm."] },
      { partOfSpeech: "Noun", definitions: ["Initialism of abdominal aortic aneurysm; a second listing."] }
    ];
    const senses = QP.api.pickSenses(entries, "Noun");
    eq("aaa: no better option -> first entry kept", senses[0].definition, "Initialism of abdominal aortic aneurysm.");
  }
  {
    // control: duplicate POS where the first entry is already a plain,
    // ordinary sense - must NOT be swapped for a later one just because a
    // later one exists (first-wins is correct here, e.g. "bank" - financial
    // institution vs. riverbank, both legitimate, neither should be demoted).
    const entries = [
      { partOfSpeech: "Noun", definitions: ["A financial institution."] },
      { partOfSpeech: "Name", definitions: ["A surname."] },
      { partOfSpeech: "Noun", definitions: ["The edge of a river or lake."] }
    ];
    const senses = QP.api.pickSenses(entries, "Noun");
    const noun = senses.find((s) => s.pos === "Noun");
    eq("bank-like: first legitimate Noun sense is left alone", noun.definition, "A financial institution.");
  }
  {
    // control: ordinary word, one entry per POS, no duplicates at all -
    // completely unaffected by this change.
    const entries = [{ partOfSpeech: "Noun", definitions: ["The formal or informal way in which a word is made to sound when spoken."] }];
    const senses = QP.api.pickSenses(entries, "Noun");
    eq("single-entry word unchanged", senses.length, 1);
    eq("single-entry word: definition intact", senses[0].definition, "The formal or informal way in which a word is made to sound when spoken.");
  }

  console.log("suggest (prefix matching over a bundled wordlist):");
  {
    const list = ["ace", "act", "action", "actor", "add", "apple", "banana", "bandana", "band"].sort();
    eq(
      "multiple suggestions share a prefix, in sorted order",
      QP.suggest.pickPrefixMatches(list, "ac"),
      ["ace", "act", "action", "actor"]
    );
    eq(
      "limit caps the number of suggestions",
      QP.suggest.pickPrefixMatches(list, "ac", 2),
      ["ace", "act"]
    );
    eq("no-match prefix -> empty list", QP.suggest.pickPrefixMatches(list, "zzz"), []);
    eq(
      "prefix matching an exact entry still returns it among matches",
      QP.suggest.pickPrefixMatches(list, "band"),
      ["band", "bandana"]
    );
    eq(
      "single-candidate prefix",
      QP.suggest.pickPrefixMatches(list, "app"),
      ["apple"]
    );
    eq("empty prefix matches from the start of the list", QP.suggest.pickPrefixMatches(list, "", 3), ["ace", "act", "action"]);
  }

  console.log("\n" + (failed ? failed + " FAILED, " : "") + passed + " passed");
  process.exit(failed ? 1 : 0);
})();
