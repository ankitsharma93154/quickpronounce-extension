#!/usr/bin/env node
/*
 * Automated smoke test. Loads the unpacked extension into the Chromium that
 * Pornounce_web's puppeteer already downloaded, then drives the real paths:
 * service worker, dictionary + audio API calls, normalize, not-found, the
 * daily cap, the session cache, the on-page selection pill + card, the popup,
 * the options page, and a privacy check on outbound requests.
 *
 *   node scripts/e2e.js
 *
 * Needs puppeteer. It is not a dependency of this extension; the script
 * borrows the copy in the sibling Pronounce_web/node_modules. Makes ~9 real
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
          return sr.querySelector(".qp-ipa") && sr.querySelectorAll(".qp-play").length === 2;
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
      () => document.getElementById("qp-quickpronounce-host").shadowRoot.querySelector(".qp-word").textContent
    );
    if (word !== "accommodation") throw new Error("card word=" + word);
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
      return { pos: sr.querySelector(".qp-pos").textContent, def: sr.querySelector(".qp-def").textContent };
    });
    await page.evaluate(() => {
      const sr = document.getElementById("qp-quickpronounce-host").shadowRoot;
      const tabs = sr.querySelectorAll(".qp-sense");
      tabs[tabs.length - 1].click(); // switch to the last (least preferred) sense
    });
    const after = await page.evaluate(() => {
      const sr = document.getElementById("qp-quickpronounce-host").shadowRoot;
      return { pos: sr.querySelector(".qp-pos").textContent, def: sr.querySelector(".qp-def").textContent };
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
        () => document.querySelector("#pp-result .qp-card") && document.querySelector("#pp-result .qp-ipa"),
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
