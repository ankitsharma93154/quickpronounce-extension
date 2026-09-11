/*
 * Content script. Injected on every http/https page (see manifest). It does
 * three things and nothing else:
 *
 *   1. Watches for a text selection and shows a small "hear it" pill near it.
 *   2. Renders the pronunciation card inside a Shadow DOM so no page CSS can
 *      touch it and it touches no page CSS.
 *   3. Bridges the page and the service worker (PING / GET_SELECTION /
 *      SHOW_CARD).
 *
 * It never reads the page's content, only the string the user has selected,
 * and it only sends that string when the user asks for a lookup.
 */
(function () {
  if (window.__qpInjected) return;
  window.__qpInjected = true;

  var QP = window.QP || {};
  var DEFAULT_SETTINGS = { selectionButton: true, accent: "us" };
  var settings = Object.assign({}, DEFAULT_SETTINGS);

  var host = null;
  var shadow = null;
  var stage = null; // positioned wrapper holding pill OR card
  var mode = "none"; // none | pill | card
  var lastAnchorRect = null;
  var lastWord = "";
  var currentCtx = null; // the ctx object handed to the open card (holds its <audio>)

  // ------------------------------------------------------------------ setup
  function ensureHost() {
    if (host) return;
    host = document.createElement("div");
    host.id = "qp-quickpronounce-host";
    host.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;margin:0;padding:0;border:0;" +
      "z-index:2147483647;pointer-events:none;";
    (document.documentElement || document.body).appendChild(host);

    shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    // The card / pill / toast visual design all live in QP.cardCss (which
    // mirrors the QuickPronounce website tokens). Only the shadow-root reset
    // and the positioning wrapper are defined here.
    style.textContent =
      ":host{all:initial;}\n" +
      "*{box-sizing:border-box;}\n" +
      ".qp-stage{position:fixed;pointer-events:auto;}\n" +
      (QP.cardCss || "");
    shadow.appendChild(style);

    stage = document.createElement("div");
    stage.className = "qp-stage";
    stage.style.display = "none";
    shadow.appendChild(stage);
  }

  function loadSettings() {
    try {
      chrome.storage.local.get("settings", function (res) {
        if (chrome.runtime.lastError) return;
        settings = Object.assign({}, DEFAULT_SETTINGS, (res && res.settings) || {});
        settings.accent = settings.accent === "uk" ? "uk" : "us";
        settings.selectionButton = settings.selectionButton !== false;
      });
    } catch (e) {
      /* extension context gone; leave defaults */
    }
  }

  // ------------------------------------------------------- selection + pill
  function currentSelectionText() {
    var sel = window.getSelection && window.getSelection();
    return sel ? String(sel.toString() || "").trim() : "";
  }

  function selectionRect() {
    var sel = window.getSelection && window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    var rects = sel.getRangeAt(0).getClientRects();
    if (rects && rects.length) return rects[rects.length - 1];
    var r = sel.getRangeAt(0).getBoundingClientRect();
    return r && (r.width || r.height) ? r : null;
  }

  function looksLikeLookup(text) {
    if (!text) return false;
    if (text.length > (QP.config ? QP.config.MAX_SELECTION_LEN : 120)) return false;
    return /\p{L}/u.test(text);
  }

  var onSelectionChange = (QP.util && QP.util.debounce ? QP.util.debounce : fallbackDebounce)(
    function () {
      if (mode === "card") return; // don't fight an open card
      if (!settings.selectionButton) {
        hide();
        return;
      }
      var text = currentSelectionText();
      var rect = selectionRect();
      if (!looksLikeLookup(text) || !rect) {
        if (mode === "pill") hide();
        return;
      }
      showPill(rect);
    },
    220
  );

  function fallbackDebounce(fn, wait) {
    var t = null;
    return function () {
      var a = arguments;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(null, a);
      }, wait);
    };
  }

  function showPill(rect) {
    ensureHost();
    lastAnchorRect = rect;
    stage.innerHTML = "";
    stage.style.display = "block";

    var pill = document.createElement("button");
    pill.type = "button";
    pill.className = "qp-pill";
    pill.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"></path>' +
      '<path d="M15.5 8.5a5 5 0 0 1 0 7"></path></svg><span>Pronounce</span>';
    // mousedown must not collapse the selection
    pill.addEventListener("mousedown", function (e) {
      e.preventDefault();
    });
    pill.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var text = currentSelectionText();
      startLookup(text, lastAnchorRect);
    });
    stage.appendChild(pill);
    mode = "pill";

    position(stage, rect, pill.offsetWidth || 112, pill.offsetHeight || 30);
  }

  // ------------------------------------------------------------------ card
  function startLookup(rawText, rect) {
    ensureHost();
    lastAnchorRect = rect || selectionRect() || centerRect();
    lastWord = rawText;
    mode = "card";
    stage.style.display = "block";
    stage.innerHTML = "";

    QP.card.render(stage, { kind: "loading", word: firstWordGuess(rawText) }, cardCtx());
    position(stage, lastAnchorRect, 320, 220);

    sendMessage({ type: "LOOKUP", word: rawText, source: "selection_button" })
      .then(function (result) {
        if (mode !== "card") return;
        renderResult(result || { state: "error", kind: "unknown" });
      })
      .catch(function () {
        if (mode !== "card") return;
        renderResult({ state: "error", kind: "network" });
      });
  }

  function renderResult(result) {
    stage.innerHTML = "";
    QP.card.render(stage, result, cardCtx());
    // measure and reposition against the real card size
    var card = stage.firstElementChild;
    var w = card ? card.offsetWidth : 320;
    var h = card ? card.offsetHeight : 200;
    position(stage, lastAnchorRect, w, h);
  }

  function cardCtx() {
    currentCtx = {
      accent: settings.accent,
      compact: false,
      requestAudio: function (word, accent) {
        return sendMessage({ type: "GET_AUDIO", word: word, accent: accent }).catch(function () {
          return { ok: false, kind: "network" };
        });
      },
      onRetry: function () {
        startLookup(lastWord, lastAnchorRect);
      },
      onClose: hide,
      openUrl: function (url) {
        try {
          window.open(url, "_blank", "noopener");
        } catch (e) {
          /* noop */
        }
      }
    };
    return currentCtx;
  }

  function firstWordGuess(text) {
    var t = String(text || "").trim().split(/\s+/)[0] || "";
    return t.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").toLowerCase();
  }

  // --------------------------------------------------------------- position
  function centerRect() {
    var x = window.innerWidth / 2;
    var y = window.innerHeight / 2;
    return { left: x, right: x, top: y, bottom: y, width: 0, height: 0 };
  }

  function position(node, rect, w, h) {
    var margin = 8;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var r = rect || centerRect();

    var left = r.left;
    if (left + w + margin > vw) left = vw - w - margin;
    if (left < margin) left = margin;

    var top = r.bottom + 6;
    if (top + h + margin > vh) {
      var above = r.top - h - 6;
      top = above >= margin ? above : Math.max(margin, vh - h - margin);
    }

    node.style.left = Math.round(left) + "px";
    node.style.top = Math.round(top) + "px";
  }

  function hide() {
    mode = "none";
    if (currentCtx && currentCtx._audio) {
      try {
        currentCtx._audio.pause();
      } catch (e) {
        /* noop */
      }
    }
    currentCtx = null;
    if (stage) {
      stage.style.display = "none";
      stage.innerHTML = "";
    }
  }

  // ---------------------------------------------------------------- events
  document.addEventListener("mouseup", onSelectionChange, true);
  document.addEventListener("keyup", function (e) {
    // Only re-check on keys that can change a selection (Shift+arrows, Ctrl+A,
    // Escape). Skip ordinary typing so we don't run on every keystroke.
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey) return;
    onSelectionChange();
  });

  document.addEventListener(
    "mousedown",
    function (e) {
      if (mode === "none") return;
      if (host && e.composedPath && e.composedPath().indexOf(host) !== -1) return;
      hide();
    },
    true
  );

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && mode !== "none") hide();
  });

  window.addEventListener(
    "scroll",
    function () {
      if (mode !== "none") hide();
    },
    true
  );

  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "local" && changes.settings) {
        settings = Object.assign({}, DEFAULT_SETTINGS, changes.settings.newValue || {});
        settings.accent = settings.accent === "uk" ? "uk" : "us";
        settings.selectionButton = settings.selectionButton !== false;
        if (!settings.selectionButton && mode === "pill") hide();
      }
    });
  } catch (e) {
    /* noop */
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return;
    if (msg.type === "PING") {
      sendResponse({ pong: true });
      return;
    }
    if (msg.type === "GET_SELECTION") {
      sendResponse({ text: currentSelectionText() });
      return;
    }
    if (msg.type === "SHOW_CARD") {
      ensureHost();
      lastAnchorRect = selectionRect() || centerRect();
      lastWord = currentSelectionText();
      mode = "card";
      stage.style.display = "block";
      stage.innerHTML = "";
      QP.card.render(stage, msg.result || { state: "error", kind: "unknown" }, cardCtx());
      var card = stage.firstElementChild;
      position(
        stage,
        lastAnchorRect,
        card ? card.offsetWidth : 320,
        card ? card.offsetHeight : 200
      );
      sendResponse({ ok: true });
      return;
    }
  });

  function sendMessage(payload) {
    return new Promise(function (resolve, reject) {
      try {
        chrome.runtime.sendMessage(payload, function (resp) {
          var e = chrome.runtime.lastError;
          if (e) reject(new Error(e.message));
          else resolve(resp);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  loadSettings();
})();
