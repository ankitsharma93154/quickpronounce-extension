/*
 * The page a fresh install opens (see onInstalled in the service worker). The
 * demo renders the real card with bundled clips, so it makes no API calls and
 * uses no lookups. Content scripts don't run on extension pages, so selecting
 * text here shows no Pronounce button: the underlined words stand in for it.
 */
(function () {
  var QP = window.QP;
  var $ = function (id) {
    return document.getElementById(id);
  };

  var isEdge = /\bEdg\//.test(navigator.userAgent);
  var SENTENCE = [
    "The ", { w: "colonel" }, " ordered ", { w: "quinoa" }, ", which he called the ",
    { w: "epitome" }, " of a perfect ", { w: "segue" }, " into dessert."
  ];

  // Bring the shared card stylesheet into this document.
  var style = document.createElement("style");
  style.textContent = QP.cardCss || "";
  document.head.appendChild(style);

  // --- checklist ------------------------------------------------------------
  var done = { select: false, play: false, pin: false };

  function refreshSteps() {
    var count = 0;
    Object.keys(done).forEach(function (k) {
      if (done[k]) count++;
      $("wl-step-" + k).classList.toggle("wl-step--done", done[k]);
    });
    $("wl-progress").textContent = count + " of 3 done";
  }

  function tick(step) {
    if (done[step]) return;
    done[step] = true;
    refreshSteps();
  }

  // A real lookup on any other site finishes the first two steps.
  function checkRealLookup() {
    QP.store.getMeta().then(function (meta) {
      if (meta && meta.firstLookupDone) {
        tick("select");
        tick("play");
      }
    });
  }

  function checkPinned() {
    if (!chrome.action || !chrome.action.getUserSettings) return;
    chrome.action.getUserSettings(function (s) {
      void chrome.runtime.lastError;
      if (s && s.isOnToolbar) tick("pin");
    });
  }

  $("wl-pin-text").textContent = isEdge
    ? "Open Extensions (the puzzle piece) in Edge's toolbar, then choose Show in toolbar, for one-click lookups."
    : "Click the puzzle piece in Chrome's toolbar, then the pin, for one-click lookups.";

  if (chrome.commands && chrome.commands.getAll) {
    chrome.commands.getAll(function (cmds) {
      var c = (cmds || []).find(function (x) {
        return x.name === "pronounce-selection";
      });
      if (c && c.shortcut) $("wl-step-play-title").textContent = "Press " + c.shortcut + ", or tap Pronounce";
    });
  }

  // --- demo -----------------------------------------------------------------
  var accent = "us";
  var demoRoot = $("wl-demo");
  var ctx = null;
  var current = null;

  function bytesToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function requestClip(word, acc) {
    var name = word + "-" + (acc === "uk" ? "uk" : "us") + ".mp3";
    return fetch(chrome.runtime.getURL("src/welcome/audio/" + name))
      .then(function (res) {
        if (!res.ok) throw new Error("missing clip");
        return res.arrayBuffer();
      })
      .then(function (buffer) {
        return { ok: true, base64: bytesToBase64(buffer), format: "audio/mpeg" };
      })
      .catch(function () {
        return { ok: false, kind: "unknown" };
      });
  }

  function showWord(word) {
    var demo = QP.demoWords[word];
    if (!demo) return;
    current = word;
    if (ctx) QP.card.stopPlayback(ctx);
    ctx = {
      accent: accent,
      compact: true,
      requestAudio: requestClip,
      openUrl: function (url) {
        chrome.tabs.create({ url: url });
      }
    };
    Array.prototype.forEach.call(document.querySelectorAll(".wl-word"), function (b) {
      var on = b.dataset.word === word;
      b.classList.toggle("wl-word--active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var url = QP.config.wordUrl(word);
    QP.card.render(
      demoRoot,
      {
        state: "ok",
        model: {
          word: demo.word,
          ipa: demo.ipa,
          syllables: demo.syllables,
          note: demo.note,
          senses: [],
          url: url
        }
      },
      ctx
    );
  }

  var sentence = $("wl-sentence");
  SENTENCE.forEach(function (part) {
    if (typeof part === "string") {
      sentence.appendChild(document.createTextNode(part));
      return;
    }
    var b = document.createElement("button");
    b.type = "button";
    b.className = "wl-word";
    b.dataset.word = part.w;
    b.textContent = part.w;
    b.addEventListener("click", function () {
      tick("select");
      showWord(part.w);
    });
    sentence.appendChild(b);
  });

  // Pressing play in the demo is the same step as pressing it on a real card.
  // Capture phase: the button disables itself while its clip loads, so by the
  // time the click bubbles here it would look like a disabled button.
  demoRoot.addEventListener("click", function (e) {
    var play = e.target.closest && e.target.closest(".qp-play");
    if (play && !play.disabled) tick("play");
  }, true);

  // The shortcut can't open a card on this page, so it plays the word on show.
  if (chrome.commands && chrome.commands.onCommand) {
    chrome.commands.onCommand.addListener(function (command) {
      if (command !== "pronounce-selection") return;
      var play = demoRoot.querySelector(".qp-play:not(:disabled)");
      if (play) play.click();
    });
  }

  window.addEventListener("pagehide", function () {
    if (ctx) QP.card.stopPlayback(ctx);
  });

  // --- links ----------------------------------------------------------------
  function openSettings() {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  }
  $("wl-settings").addEventListener("click", openSettings);
  $("wl-settings-foot").addEventListener("click", openSettings);
  $("wl-site").href = QP.config.SITE_URL;

  // --- start ----------------------------------------------------------------
  refreshSteps();
  checkRealLookup();
  checkPinned();
  // Both happen away from this tab, so check again on the way back.
  window.addEventListener("focus", function () {
    checkRealLookup();
    checkPinned();
  });

  QP.store.getSettings().then(function (s) {
    QP.theme.applyToPage(s.theme);
    accent = s.accent === "uk" ? "uk" : "us";
    showWord(current || "epitome");
  });
})();
