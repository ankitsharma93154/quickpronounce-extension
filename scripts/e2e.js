#!/usr/bin/env node
/*
 * Automated smoke test. Loads the unpacked extension into the Chromium that
 * Pornounce_web's puppeteer already downloaded, then drives the real paths:
 * service worker, dictionary + audio API calls, normalize, not-found, the
 * daily cap, the session cache, the on-page selection pill + card, the full
 * audio playback lifecycle through the offscreen document, the popup, the
 * options page, and a privacy check on outbound requests.
 *
 *   node scripts/e2e.js
 *
 * Needs puppeteer. It is not a dependency of this extension; the script
 * borrows the copy in the sibling Pronounce_web/node_modules. Makes ~11 real
 * calls to api.quickpronounce.site with whatever key is in config.js. This is
 * functional testing, not rate-limit probing.
 */
"use strict";

const path = require("path");

let puppeteer;
try {
  puppeteer = require("puppeteer");
} catch (_) {
  try {
    puppeteer = require(path.resolve(__dirname, "../../Pronounce_web/node_modules/puppeteer"));
  } catch (e) {
    console.error("puppeteer not found. Install it, or run once in Pronounce_web so it downloads Chromium.");
    process.exit(2);
  }
}

const EXT = path.resolve(__dirname, "..");
const API = "api.quickpronounce.site";

const results = [];
const rec = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "  ok  " : "  FAIL"} ${name}${detail ? "  - " + detail : ""}`);
};
async function test(name, fn) {
  try {
    const d = await fn();
    rec(name, true, d);
  } catch (e) {
    rec(name, false, e && e.message ? e.message : String(e));
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Poll a condition instead of a blind sleep - used for state that lives in
// the service worker (a WebWorker handle has no waitForFunction of its own).
async function waitFor(fn, timeoutMs, intervalMs) {
  const start = Date.now();
  for (;;) {
    if (await fn()) return true;
    if (Date.now() - start >= timeoutMs) return false;
    await sleep(intervalMs || 100);
  }
}

(async () => {
  let browser;
  for (const headless of [true, false]) {
    try {
      browser = await puppeteer.launch({
        headless,
        args: [
          `--disable-extensions-except=${EXT}`,
          `--load-extension=${EXT}`,
          "--no-sandbox",
          "--no-first-run"
        ]
      });
      // confirm the extension actually registered
      const t = await browser.waitForTarget(
        (x) => x.type() === "service_worker" && x.url().includes("service-worker"),
        { timeout: 8000 }
      );
      if (t) {
        console.log(`launched (headless: ${headless})`);
        break;
      }
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      browser = null;
      console.log(`headless:${headless} did not load the extension (${e.message})`);
    }
  }
  if (!browser) {
    console.error("\nCould not load the extension in Chromium. Manual testing required.");
    process.exit(2);
  }

  const swTarget = await browser.waitForTarget(
    (x) => x.type() === "service_worker" && x.url().includes("service-worker")
  );
  const worker = await swTarget.worker();
  const extId = new URL(swTarget.url()).host;
  console.log("extension id:", extId, "\n");

  // Observer for the audio playback lifecycle tests further down. The
  // offscreen document broadcasts AUDIO_EVENT via chrome.runtime.sendMessage,
  // which every extension page (this worker included) receives directly -
  // unlike a content script in a tab, which needs it relayed through
  // chrome.tabs.sendMessage. That relay bug is exactly what let a real
  // regression ship (Play button stuck in "loading" forever); the worker is
  // used here as a reliable, race-free observer of what actually got
  // broadcast, instead of racing to attach a CDP session to the offscreen
  // target before its first messages fire.
  await worker.evaluate(() => {
    self.__qpAudioEvents = [];
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "AUDIO_EVENT") self.__qpAudioEvents.push(msg);
    });
  });

  // ---- service worker internals ------------------------------------
  await test("service worker exposes QP + runLookup", async () => {
    const ok = await worker.evaluate(
      () => typeof QP === "object" && typeof runLookup === "function" && typeof getAudio === "function"
    );
    if (!ok) throw new Error("missing globals");
  });

  await test("dictionary lookup: real API returns ipa + definition + respelling", async () => {
    const r = await worker.evaluate(() => runLookup("pronunciation", "e2e"));
    if (r.state !== "ok") throw new Error("state=" + r.state);
    if (!r.model.ipa.us) throw new Error("no US ipa");
    if (!r.model.definition) throw new Error("no definition");
    if (!/[A-Z]/.test(r.model.respell.us) || r.model.respell.us.indexOf("·") === -1)
      throw new Error("respell looks wrong: " + r.model.respell.us);
    return `${r.model.ipa.us}  |  ${r.model.respell.us}`;
  });

  await test("audio: real API returns base64 mp3 (UK)", async () => {
    const r = await worker.evaluate(() => getAudio("colonel", "uk"));
    if (!r.ok || !r.base64 || r.format !== "mp3") throw new Error(JSON.stringify(r).slice(0, 120));
    return `${r.base64.length} b64 chars`;
  });

  await test("normalize: '\"Running,\"' -> running", async () => {
    const r = await worker.evaluate(() => runLookup('"Running,"', "e2e"));
    if (r.state !== "ok" || r.model.word !== "running") throw new Error("word=" + (r.model && r.model.word));
  });

  await test("multi-sense word: 'record' defaults to a major part of speech, not 'Name'", async () => {
    const r = await worker.evaluate(() => runLookup("record", "e2e"));
    if (r.state !== "ok") throw new Error("state=" + r.state);
    const major = ["Noun", "Verb", "Adjective", "Adverb"];
    if (!major.includes(r.model.partOfSpeech))
      throw new Error(`primary pos = "${r.model.partOfSpeech}" (senses: ${r.model.senses.map((s) => s.pos).join(", ")})`);
    if (r.model.senses.length < 2) throw new Error("expected multiple senses, got " + r.model.senses.length);
    return `pos=${r.model.partOfSpeech}, senses=[${r.model.senses.map((s) => s.pos).join(", ")}]`;
  });

  await test("not found: nonsense -> state:not_found", async () => {
    const r = await worker.evaluate(() => runLookup("asdfghjklzxcv", "e2e"));
    if (r.state !== "not_found") throw new Error("state=" + r.state);
  });

  await test("session cache: 2nd lookup of same word -> cached:true", async () => {
    await worker.evaluate(() => runLookup("water", "e2e"));
    const r2 = await worker.evaluate(() => runLookup("water", "e2e"));
    if (r2.state !== "ok" || r2.cached !== true) throw new Error("cached=" + r2.cached);
  });

  await test("daily cap: ledger full -> state:cap; a real known word still resolves", async () => {
    // seed 39 fake + one real word ('water', already looked up above) = 40
    await worker.evaluate(async () => {
      const led = { water: Date.now() };
      for (let i = 0; i < 39; i++) led["caphold" + i] = Date.now();
      await new Promise((res) => chrome.storage.local.set({ capLedger: led }, res));
    });
    const seeded = await worker.evaluate(
      () => new Promise((res) => chrome.storage.local.get("capLedger", (o) => res(Object.keys(o.capLedger || {}).length)))
    );
    const blocked = await worker.evaluate(() => runLookup("brandnewword" + Date.now(), "e2e"));
    const known = await worker.evaluate(() => runLookup("water", "e2e"));
    await worker.evaluate(() => new Promise((res) => chrome.storage.local.set({ capLedger: {} }, res)));
    if (blocked.state !== "cap") throw new Error(`seeded ${seeded}; expected cap, got ${blocked.state}`);
    if (known.state !== "ok") throw new Error(`known 'water' -> ${known.state} (expected ok)`);
    return `seeded ${seeded}, blocked new, resolved known`;
  });

  await test("recents: a successful lookup is stored", async () => {
    const r = await worker.evaluate(() => runLookup("serendipity", "e2e"));
    await sleep(200);
    const list = await worker.evaluate(
      () => new Promise((res) => chrome.storage.local.get("recents", (o) => res(o.recents || [])))
    );
    if (!list.some((x) => x.word === "serendipity"))
      throw new Error(`lookup state=${r.state}; recents=[${list.map((x) => x.word).join(",")}]`);
    return list.length + " recent(s)";
  });

  // ---- browser-wide network capture (SW fetches don't show on page) ---
  const netUrls = [];
  const netReqs = []; // { url, headers }
  const cdp = await browser.target().createCDPSession();
  await cdp.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  browser.on("targetcreated", async (t) => {
    try {
      const s = await t.createCDPSession();
      await s.send("Network.enable");
      s.on("Network.requestWillBeSent", (e) => {
        if (e.request.url.includes(API)) {
          netUrls.push(e.request.method + " " + e.request.url);
          netReqs.push({ url: e.request.url, headers: e.request.headers });
        }
      });
    } catch (_) {}
  });

  // ---- on-page: selection pill + card -----------------------------
  const page = await browser.newPage();
  const swSession = await swTarget.createCDPSession();
  await swSession.send("Network.enable");
  swSession.on("Network.requestWillBeSent", (e) => {
    if (e.request.url.includes(API)) {
      netUrls.push(e.request.method + " " + e.request.url);
      netReqs.push({ url: e.request.url, headers: e.request.headers });
    }
  });
  await page.goto("https://example.com/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.body.innerHTML = '<p id="w" style="font-size:20px;padding:40px">accommodation</p>';
  });
  await sleep(400); // let the content script settle

  await test("selecting a word shows the Pronounce pill", async () => {
    await page.evaluate(() => {
      const el = document.getElementById("w");
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    await page.waitForFunction(
      () => {
        const h = document.getElementById("qp-quickpronounce-host");
        return h && h.shadowRoot && h.shadowRoot.querySelector(".qp-pill");
      },
      { timeout: 4000 }
    );
  });

  await test("clicking the pill opens a card with ipa + play buttons", async () => {
    await page.evaluate(() =>
      document.getElementById("qp-quickpronounce-host").shadowRoot.querySelector(".qp-pill").click()
    );
    // first: a card of any kind appears synchronously (loading skeleton)
    await page.waitForFunction(
      () => document.getElementById("qp-quickpronounce-host").shadowRoot.querySelector(".qp-card"),
      { timeout: 3000 }
    );
    try {
      await page.waitForFunction(
        () => {
          const sr = document.getElementById("qp-quickpronounce-host").shadowRoot;
          return sr.querySelector(".qp-pron-row__ipa") && sr.querySelectorAll(".qp-play").length === 2;
        },
        { timeout: 12000 }
      );
    } catch (e) {
      const html = await page.evaluate(
        () => document.getElementById("qp-quickpronounce-host").shadowRoot.querySelector(".qp-card").innerText
      );
      throw new Error("result card never rendered. card text: " + JSON.stringify(html).slice(0, 200));
    }
    const word = await page.evaluate(
      () => document.getElementById("qp-quickpronounce-host").shadowRoot.querySelector(".qp-hero__word").textContent
    );
    if (word !== "accommodation") throw new Error("card word=" + word);
  });

  await test("syllables render as stress-coded spans, one per syllable, exactly one primary", async () => {
    const info = await page.evaluate(() => {
      const sr = document.getElementById("qp-quickpronounce-host").shadowRoot;
      const syls = Array.from(sr.querySelectorAll(".qp-syl"));
      return {
        count: syls.length,
        primaryCount: syls.filter((s) => s.classList.contains("qp-syl--1")).length,
        hasTitles: syls.every((s) => !!s.title),
        ariaLabel: sr.querySelector(".qp-respell-line") && sr.querySelector(".qp-respell-line").getAttribute("aria-label")
      };
    });
    if (info.count < 2) throw new Error("expected multiple syllable spans, got " + info.count);
    if (info.primaryCount !== 1) throw new Error("expected exactly one primary-stress syllable, got " + info.primaryCount);
    if (!info.hasTitles) throw new Error("every syllable span should have a stress tooltip");
    if (!info.ariaLabel) throw new Error("respell line should carry an aria-label fallback for assistive tech");
    return `${info.count} syllables, aria-label="${info.ariaLabel}"`;
  });

  // ---- audio playback lifecycle (offscreen document) ----------------
  // The 'accommodation' card from the tests above is still open with its two
  // play buttons; reused here rather than doing a fresh lookup.
  const playButtonState = (index) =>
    page.evaluate((i) => {
      const b = document.getElementById("qp-quickpronounce-host").shadowRoot.querySelectorAll(".qp-play")[i];
      return {
        playing: b.classList.contains("qp-play--playing"),
        error: b.classList.contains("qp-play--error"),
        disabled: b.disabled,
        title: b.title
      };
    }, index);
  const clickPlayButton = (index) =>
    page.evaluate((i) => {
      document.getElementById("qp-quickpronounce-host").shadowRoot.querySelectorAll(".qp-play")[i].click();
    }, index);
  const waitForButtons = (fn, timeout) =>
    page.waitForFunction(
      fn,
      { timeout: timeout || 12000 },
    );

  await test("audio: clicking Play reaches 'playing', not stuck loading", async () => {
    // This is the real regression: the offscreen doc's "playing" broadcast
    // reached the background/popup but never the content script, because
    // chrome.runtime.sendMessage doesn't deliver to a tab's content script -
    // only chrome.tabs.sendMessage does. The button sat disabled in
    // "loading" forever. If that relay breaks again, this test times out
    // here instead of someone finding out by hand.
    await clickPlayButton(0); // US
    const reached = await waitFor(
      async () => {
        const s = await playButtonState(0);
        return s.playing || s.error;
      },
      12000,
      200
    );
    const state = await playButtonState(0);
    if (!reached) throw new Error("US button never left loading (stuck). state=" + JSON.stringify(state));
    if (!state.playing) throw new Error("US button settled in error, not playing: " + JSON.stringify(state));
    return "US button reached playing";
  });

  await test("audio: playback creates the extension's offscreen document", async () => {
    const target = await browser.waitForTarget((t) => t.url().includes("src/offscreen/offscreen.html"), {
      timeout: 4000
    });
    if (!target) throw new Error("no offscreen document found");
    return target.url();
  });

  await test("audio: switching US -> UK stops the first clip and plays the second", async () => {
    await clickPlayButton(1); // UK
    const settled = await waitFor(
      async () => {
        const s0 = await playButtonState(0);
        const s1 = await playButtonState(1);
        return !s0.playing && s1.playing;
      },
      12000,
      200
    );
    if (!settled) {
      const s0 = await playButtonState(0);
      const s1 = await playButtonState(1);
      throw new Error("accent switch didn't settle. US=" + JSON.stringify(s0) + " UK=" + JSON.stringify(s1));
    }
    // A stale "ended"/"stopped" belonging to the superseded US clip must not
    // flip UK back off. Give any late/out-of-order message a real window to
    // arrive and confirm the settled state actually holds.
    await sleep(1000);
    const s0 = await playButtonState(0);
    const s1 = await playButtonState(1);
    if (s0.playing || !s1.playing)
      throw new Error(
        "state regressed after settling (stale event reached the wrong button?). US=" +
          JSON.stringify(s0) +
          " UK=" +
          JSON.stringify(s1)
      );
    return "US idle, UK playing, held for 1s";
  });

  await test("audio: rapid accent switching settles correctly, nothing left stuck loading", async () => {
    // Fire clicks back to back with no waits in between - this is what
    // actually stresses the playbackId ordering guard (a genuine race
    // through real extension messaging, not a synthetic injected event).
    await clickPlayButton(0);
    await clickPlayButton(1);
    await clickPlayButton(0);
    await clickPlayButton(1); // last click: UK should end up the one playing
    const settled = await waitFor(
      async () => {
        const s0 = await playButtonState(0);
        const s1 = await playButtonState(1);
        return !s0.playing && s1.playing && !s0.disabled && !s1.disabled;
      },
      12000,
      200
    );
    const s0 = await playButtonState(0);
    const s1 = await playButtonState(1);
    if (!settled) throw new Error("rapid switching left a bad/stuck state. US=" + JSON.stringify(s0) + " UK=" + JSON.stringify(s1));
    return "settled on UK playing after 4 rapid clicks, neither button stuck";
  });

  await test("audio: closing the card stops playback", async () => {
    const before = await worker.evaluate(() => self.__qpAudioEvents.length);
    // Clear the text selection first: Escape's own keyup handler re-runs the
    // selection-pill check against whatever is still selected, which would
    // otherwise reopen the pill a moment later and has nothing to do with
    // what's being tested here (audio actually stopping).
    await page.evaluate(() => window.getSelection().removeAllRanges());
    await page.keyboard.press("Escape");

    const gotStopped = await waitFor(
      async () => {
        const events = await worker.evaluate((from) => self.__qpAudioEvents.slice(from), before);
        return events.some((e) => e.event === "stopped");
      },
      4000,
      150
    );
    if (!gotStopped) {
      const events = await worker.evaluate((from) => self.__qpAudioEvents.slice(from), before);
      throw new Error("no 'stopped' AUDIO_EVENT after closing the card. events=" + JSON.stringify(events));
    }
    await waitForButtons(() => {
      const sr = document.getElementById("qp-quickpronounce-host").shadowRoot;
      const stage = sr.querySelector(".qp-stage");
      return !stage || stage.style.display === "none";
    }, 3000);
    return "stopped event observed + card hidden";
  });

  await test("ambiguous word on-page: pos tabs render and switching updates the definition", async () => {
    // dismiss the still-open card from the previous test first - the content
    // script ignores new selections while a card is open (by design).
    await page.keyboard.press("Escape");
    await sleep(150);
    await page.evaluate(() => {
      document.body.innerHTML = '<p id="w2" style="font-size:20px;padding:40px">record</p>';
      const el = document.getElementById("w2");
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    await page.waitForFunction(
      () => {
        const h = document.getElementById("qp-quickpronounce-host");
        return h && h.shadowRoot && h.shadowRoot.querySelector(".qp-pill");
      },
      { timeout: 4000 }
    );
    await page.evaluate(() =>
      document.getElementById("qp-quickpronounce-host").shadowRoot.querySelector(".qp-pill").click()
    );
    await page.waitForFunction(
      () => document.getElementById("qp-quickpronounce-host").shadowRoot.querySelectorAll(".qp-sense").length > 1,
      { timeout: 12000 }
    );
    const before = await page.evaluate(() => {
      const sr = document.getElementById("qp-quickpronounce-host").shadowRoot;
      return { pos: sr.querySelector(".qp-hero__pos").textContent, def: sr.querySelector(".qp-meaning").textContent };
    });
    await page.evaluate(() => {
      const sr = document.getElementById("qp-quickpronounce-host").shadowRoot;
      const tabs = sr.querySelectorAll(".qp-sense");
      tabs[tabs.length - 1].click(); // switch to the last (least preferred) sense
    });
    // the swap is deliberately delayed ~120ms for a crossfade (see
    // qp-meaning--fading in card.js/card.css.js), so wait for it instead of
    // reading synchronously right after the click.
    await page.waitForFunction(
      (beforeDef) => {
        const sr = document.getElementById("qp-quickpronounce-host").shadowRoot;
        const def = sr.querySelector(".qp-meaning").textContent;
        return def !== beforeDef;
      },
      { timeout: 2000 },
      before.def
    );
    const after = await page.evaluate(() => {
      const sr = document.getElementById("qp-quickpronounce-host").shadowRoot;
      return { pos: sr.querySelector(".qp-hero__pos").textContent, def: sr.querySelector(".qp-meaning").textContent };
    });
    if (before.def === after.def) throw new Error(`definition did not change: "${before.def}"`);
    return `${before.pos} "${before.def.slice(0, 30)}..." -> ${after.pos} "${after.def.slice(0, 30)}..."`;
  });

  await test("privacy: only /ext/v1/dictionary|pronunciation/<word> hit the API, nothing else", async () => {
    if (netUrls.length === 0) throw new Error("no API calls captured");
    const bad = netUrls.filter((u) => !/\/ext\/v1\/(dictionary|pronunciation)\/[^/?]+$|\/ext\/v1\/(dictionary|pronunciation)\/[^/?]+\?/.test(u));
    if (bad.length) throw new Error("unexpected: " + bad.join(", "));
    const leak = netUrls.filter((u) => /example\.com|<p|innerHTML/.test(u));
    if (leak.length) throw new Error("page content in URL: " + leak.join(", "));
    return netUrls.map((u) => u.split(API)[1]).join(" , ");
  });

  await test("auth: every request carries a UUID X-Install-Id, never an API key", async () => {
    if (netReqs.length === 0) throw new Error("no API requests captured");
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const bad = netReqs.filter((r) => {
      const h = r.headers || {};
      const installId = h["X-Install-Id"] || h["x-install-id"];
      const apiKey = h["X-API-Key"] || h["x-api-key"];
      return apiKey || !installId || !uuidRe.test(installId);
    });
    if (bad.length) throw new Error(JSON.stringify(bad.map((r) => ({ url: r.url, headers: r.headers })).slice(0, 2)));
    const ids = new Set(netReqs.map((r) => (r.headers["X-Install-Id"] || r.headers["x-install-id"] || "").toLowerCase()));
    if (ids.size !== 1) throw new Error("install id was not stable across requests: " + [...ids].join(", "));
    return "install id: " + [...ids][0];
  });

  await test("hero header links to the same full-entry URL as the footer link", async () => {
    const hrefs = await page.evaluate(() => {
      const sr = document.getElementById("qp-quickpronounce-host").shadowRoot;
      return {
        hero: sr.querySelector(".qp-hero__link").getAttribute("href"),
        foot: sr.querySelector(".qp-foot .qp-link").getAttribute("href")
      };
    });
    if (hrefs.hero !== hrefs.foot) throw new Error(`hero href (${hrefs.hero}) != footer href (${hrefs.foot})`);
    if (!/quickpronounce\.site\/\?word=/.test(hrefs.hero)) throw new Error("href doesn't look like a real entry URL: " + hrefs.hero);

    // click handler calls ctx.openUrl -> window.open() in the content
    // script's isolated JS world, a different realm than page.evaluate's -
    // so verify the real side effect (an actual new tab) instead of mocking
    // window.open, which page.evaluate can't reach from here.
    const newTargetPromise = browser.waitForTarget((t) => t.url() === hrefs.hero, { timeout: 8000 });
    await page.evaluate(() => document.getElementById("qp-quickpronounce-host").shadowRoot.querySelector(".qp-hero__link").click());
    const newTarget = await newTargetPromise;
    const newPage = await newTarget.page();
    if (newPage) await newPage.close();
    return hrefs.hero;
  });

  await test("Esc dismisses the card", async () => {
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => {
        const sr = document.getElementById("qp-quickpronounce-host").shadowRoot;
        const stage = sr.querySelector(".qp-stage");
        return !stage || stage.style.display === "none";
      },
      { timeout: 3000 }
    );
  });

  // ---- popup -----------------------------------------------------
  await test("popup: manual search renders a card, word lands in recents", async () => {
    const pop = await browser.newPage();
    await pop.goto(`chrome-extension://${extId}/src/popup/popup.html`, { waitUntil: "domcontentloaded" });
    const perr = [];
    pop.on("pageerror", (e) => perr.push(e.message));
    await pop.type("#pp-input", "espresso");
    await pop.keyboard.press("Enter");
    try {
      await pop.waitForFunction(
        () => document.querySelector("#pp-result .qp-card") && document.querySelector("#pp-result .qp-pron-row__ipa"),
        { timeout: 12000 }
      );
    } catch (e) {
      const txt = await pop.$eval("#pp-result", (n) => n.innerText).catch(() => "(no #pp-result content)");
      await pop.close();
      throw new Error(`no result card. pageerrors=[${perr.join("|")}] result="${txt.slice(0, 160)}"`);
    }
    await pop.waitForFunction(
      () => Array.from(document.querySelectorAll(".pp-recent b")).some((b) => b.textContent === "espresso"),
      { timeout: 4000 }
    );
    const usage = await pop.$eval("#pp-usage", (e) => e.textContent).catch(() => "");
    await pop.close();
    return "usage line: " + (usage || "(empty)");
  });

  // ---- options -------------------------------------------------
  await test("options page loads without console errors; controls present", async () => {
    const opt = await browser.newPage();
    const errs = [];
    opt.on("pageerror", (e) => errs.push(e.message));
    opt.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    await opt.goto(`chrome-extension://${extId}/src/options/options.html`, { waitUntil: "networkidle0" });
    const ok = await opt.evaluate(
      () =>
        !!document.getElementById("op-selbtn") &&
        document.querySelectorAll('input[name="op-accent"]').length === 2 &&
        !!document.getElementById("op-clear-recents")
    );
    await opt.close();
    if (!ok) throw new Error("missing controls");
    if (errs.length) throw new Error("console errors: " + errs.join(" | "));
  });

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("FAILED: " + failed.map((f) => f.name).join("; "));
    process.exit(1);
  }
})().catch((e) => {
  console.error("\nharness error:", e);
  process.exit(3);
});
