/*
 * QuickPronounce - MV3 service worker.
 *
 * Owns everything that must be central: the context menu, the keyboard
 * command, ALL network calls, the daily cap ledger, the recent-words list,
 * and local instrumentation. The content script and the popup never touch the
 * API directly - they send a message and this worker answers.
 *
 * Session-only caches (dictionary models, audio base64) live in plain Maps.
 * They evaporate when the worker is suspended; that is fine, they refill
 * lazily. Anything that must persist goes through chrome.storage via store.js.
 */

/* global importScripts */
importScripts(
  "../core/globals.js",
  "../core/util.js",
  "../core/config.js",
  "../core/respell.js",
  "../core/normalize.js",
  "../core/offlineData.js",
  "../core/offlineCache.js",
  "../core/store.js",
  "../core/analytics.js",
  "../core/cap.js",
  "../core/api.js"
);

var QP = self.QP;
var EV = QP.analytics.EVENTS;

// Files to (re-)inject when a tab predates the extension and has no content
// script. Order matters: globals first, entry point last.
var CONTENT_FILES = [
  "src/core/globals.js",
  "src/core/util.js",
  "src/core/config.js",
  "src/core/respell.js",
  "src/core/normalize.js",
  "src/core/audioCache.js",
  "src/content/card.css.js",
  "src/content/card.js",
  "src/content/content.js"
];

var memModels = new Map(); // word -> shaped dictionary model
var memAudio = new Map(); // "word::accent" -> { base64, format }

// ---------------------------------------------------------------------------
// Install / context menu
// ---------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(function (details) {
  chrome.contextMenus.create(
    {
      id: "qp-pronounce",
      title: "Pronounce with QuickPronounce",
      contexts: ["selection"]
    },
    function () {
      void chrome.runtime.lastError; // ignore "duplicate id" on reload
    }
  );

  if (details.reason === "install") {
    QP.store.setMeta({ installedAt: Date.now() });
    QP.analytics.track(EV.INSTALLED, {});
  }
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId !== "qp-pronounce" || !tab || tab.id == null) return;
  requestOnPageCard(tab.id, info.selectionText || "", "context_menu");
});

// ---------------------------------------------------------------------------
// Keyboard command
// ---------------------------------------------------------------------------
chrome.commands.onCommand.addListener(function (command) {
  if (command !== "pronounce-selection") return;
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    if (!tab || tab.id == null) return;
    ensureContentScript(tab.id)
      .then(function () {
        return sendToTab(tab.id, { type: "GET_SELECTION" });
      })
      .then(function (resp) {
        requestOnPageCard(tab.id, (resp && resp.text) || "", "keyboard");
      })
      .catch(function () {
        /* restricted page (chrome://, web store, PDF viewer, ...) */
      });
  });
});

// ---------------------------------------------------------------------------
// Messages from content script / popup
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || !msg.type) return;

  if (msg.type === "LOOKUP") {
    runLookup(msg.word, msg.source || "unknown").then(sendResponse);
    return true; // async
  }
  if (msg.type === "GET_AUDIO") {
    getAudio(msg.word, msg.accent).then(sendResponse);
    return true;
  }
  if (msg.type === "GET_USAGE") {
    QP.cap.snapshot().then(sendResponse);
    return true;
  }
  return false;
});

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------
function requestOnPageCard(tabId, rawText, source) {
  ensureContentScript(tabId)
    .then(function () {
      return runLookup(rawText, source);
    })
    .then(function (result) {
      return sendToTab(tabId, { type: "SHOW_CARD", result: result });
    })
    .catch(function () {
      /* nothing we can do on a page we can't script */
    });
}

async function runLookup(rawWord, source) {
  var norm = QP.normalize.normalizeWord(rawWord);
  if (!norm.ok) return { state: "invalid" };

  var word = norm.word;

  var cap = await QP.cap.record(word);
  if (!cap.allowed) {
    QP.analytics.track(EV.CAP_HIT, { source: source });
    return { state: "cap", word: word, usage: cap.usage };
  }

  if (memModels.has(word)) {
    QP.analytics.track(EV.CACHED_LOOKUP, { source: source });
    return okResult(memModels.get(word), {
      cached: true,
      multiword: norm.multiword,
      usage: cap.usage
    });
  }

  try {
    var model = await QP.api.getDictionary(word);
    memModels.set(word, model);
    await addRecent(model);
    await trackLookup(source, { found: true, data: "api" });
    return okResult(model, { multiword: norm.multiword, usage: cap.usage });
  } catch (err) {
    var kind = (err && err.kind) || "unknown";

    if (kind === "not_found") {
      await trackLookup(source, { found: false });
      return { state: "not_found", word: word, usage: cap.usage };
    }

    if (kind === "network" || kind === "timeout") {
      var offline = QP.offlineCache.lookup(word);
      if (offline) {
        memModels.set(word, offline);
        await addRecent(offline);
        await trackLookup(source, { found: true, data: "offline" });
        return okResult(offline, {
          offline: true,
          multiword: norm.multiword,
          usage: cap.usage
        });
      }
      return { state: "error", kind: kind, word: word, usage: cap.usage };
    }

    if (kind === "rate_limited") {
      return {
        state: "error",
        kind: "rate_limited",
        retryAfter: err.retryAfter || 60,
        word: word,
        usage: cap.usage
      };
    }

    // unauthorized / bad_response / server_error / unknown
    return { state: "error", kind: kind, word: word, usage: cap.usage };
  }
}

function okResult(model, extra) {
  extra = extra || {};
  return {
    state: "ok",
    model: {
      word: model.word,
      partOfSpeech: model.partOfSpeech || null,
      definition: model.definition || null,
      senses: Array.isArray(model.senses) ? model.senses : [],
      bestGuess: !!model.bestGuess,
      ipa: model.ipa || { us: null, uk: null },
      syllables: model.syllables || { us: [], uk: [] },
      respell: {
        us: QP.respell.toRespelling(model.syllables && model.syllables.us),
        uk: QP.respell.toRespelling(model.syllables && model.syllables.uk)
      },
      syllableCount: {
        us: QP.respell.syllableCount(model.syllables && model.syllables.us),
        uk: QP.respell.syllableCount(model.syllables && model.syllables.uk)
      },
      url: QP.config.wordUrl(model.word)
    },
    cached: !!extra.cached,
    offline: !!extra.offline,
    multiword: !!extra.multiword,
    usage: extra.usage || null
  };
}

async function addRecent(model) {
  await QP.store.addRecent({
    word: model.word,
    ipa: model.ipa,
    syllables: model.syllables,
    definition: model.definition,
    partOfSpeech: model.partOfSpeech,
    ts: Date.now()
  });
}

async function trackLookup(source, props) {
  var meta = await QP.store.getMeta();
  if (!meta.firstLookupDone) {
    await QP.store.setMeta({ firstLookupDone: true });
    QP.analytics.track(EV.FIRST_LOOKUP, { source: source });
  }
  QP.analytics.track(EV.LOOKUP, Object.assign({ source: source }, props || {}));
}

async function getAudio(word, accent) {
  var norm = QP.normalize.normalizeWord(word);
  if (!norm.ok) return { ok: false, kind: "invalid" };

  var acc = accent === "uk" ? "uk" : "us";
  var key = norm.word + "::" + acc;

  if (memAudio.has(key)) {
    return Object.assign({ ok: true, cached: true }, memAudio.get(key));
  }
  try {
    var res = await QP.api.getAudio(norm.word, acc);
    memAudio.set(key, res);
    return Object.assign({ ok: true }, res);
  } catch (err) {
    return {
      ok: false,
      kind: (err && err.kind) || "unknown",
      retryAfter: err && err.retryAfter
    };
  }
}

// ---------------------------------------------------------------------------
// Tab messaging helpers
// ---------------------------------------------------------------------------
function sendToTab(tabId, message) {
  return new Promise(function (resolve, reject) {
    try {
      chrome.tabs.sendMessage(tabId, message, function (resp) {
        var e = chrome.runtime.lastError;
        if (e) reject(new Error(e.message));
        else resolve(resp);
      });
    } catch (e) {
      reject(e);
    }
  });
}

// Make sure the content script is live in a tab. The static registration
// covers pages loaded after install; this handles tabs that predate it.
// Injection needs activeTab (granted by the context-menu click / command
// gesture) plus the scripting permission.
function ensureContentScript(tabId) {
  return sendToTab(tabId, { type: "PING" })
    .then(function () {
      return true;
    })
    .catch(function () {
      return new Promise(function (resolve, reject) {
        chrome.scripting.executeScript(
          { target: { tabId: tabId }, files: CONTENT_FILES },
          function () {
            var e = chrome.runtime.lastError;
            if (e) reject(new Error(e.message));
            else resolve(true);
          }
        );
      });
    });
}
