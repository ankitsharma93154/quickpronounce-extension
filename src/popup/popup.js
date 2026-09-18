/*
 * Toolbar popup: manual lookup, recent words, today's usage. It renders the
 * exact same card as the on-page one (QP.card), talking to the service worker
 * for lookups and audio so all the caching and cap logic stays in one place.
 */
(function () {
  var QP = window.QP;

  var $ = function (id) {
    return document.getElementById(id);
  };
  var form = $("pp-form");
  var input = $("pp-input");
  var result = $("pp-result");
  var recentsList = $("pp-recents-list");
  var recentsEmpty = $("pp-recents-empty");
  var usageEl = $("pp-usage");
  var suggestList = $("pp-suggest");

  // Bring the shared card stylesheet into this document.
  var style = document.createElement("style");
  style.textContent = QP.cardCss || "";
  document.head.appendChild(style);

  QP.analytics.track(QP.analytics.EVENTS.POPUP_OPENED, {});

  var accent = "us";

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

  var activeCardCtx = null;

  function cardCtx() {
    var ctx = {
      accent: accent,
      compact: true,
      requestAudio: function (word, acc) {
        return sendMessage({ type: "GET_AUDIO", word: word, accent: acc }).catch(function () {
          return { ok: false, kind: "network" };
        });
      },
      onRetry: function () {
        doLookup(input.value, "popup");
      },
      onClose: function () {
        QP.card.stopPlayback(ctx);
        result.hidden = true;
        result.innerHTML = "";
      },
      openUrl: function (url) {
        chrome.tabs.create({ url: url });
      }
    };
    return ctx;
  }

  function showView(view) {
    if (activeCardCtx) QP.card.stopPlayback(activeCardCtx);
    result.hidden = false;
    activeCardCtx = cardCtx();
    QP.card.render(result, view, activeCardCtx);
  }

  // Audio now plays in the extension's offscreen document (see card.js), not
  // a local <audio> element, so it no longer dies automatically when this
  // popup closes - stop it explicitly.
  window.addEventListener("pagehide", function () {
    if (activeCardCtx) QP.card.stopPlayback(activeCardCtx);
  });

  function doLookup(raw, source) {
    var text = String(raw || "").trim();
    if (!text) return;
    showView({ kind: "loading", word: text.split(/\s+/)[0] });
    sendMessage({ type: "LOOKUP", word: text, source: source })
      .then(function (res) {
        showView(res || { state: "error", kind: "unknown" });
        refreshUsage();
        refreshRecents();
      })
      .catch(function () {
        showView({ state: "error", kind: "network" });
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideSuggestions();
    doLookup(input.value, "popup");
  });

  // --- search suggestions --------------------------------------------
  // Bundled wordlist (src/data/wordlist.txt), loaded lazily on first focus
  // or keystroke and kept in memory only for this popup's lifetime - the
  // popup's JS is torn down on close, so there is nothing to persist here.
  var suggestions = [];
  var suggestIndex = -1;
  var suggestQuery = "";
  var wordlistPromise = null;

  function ensureWordlist() {
    if (!wordlistPromise) {
      wordlistPromise = QP.suggest.load(chrome.runtime.getURL("src/data/wordlist.txt"));
    }
    return wordlistPromise;
  }

  function hideSuggestions() {
    suggestions = [];
    suggestIndex = -1;
    suggestQuery = "";
    suggestList.hidden = true;
    suggestList.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
  }

  function renderSuggestions() {
    suggestList.innerHTML = "";
    suggestions.forEach(function (word, i) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pp-suggest-item" + (i === suggestIndex ? " pp-suggest-active" : "");
      btn.setAttribute("role", "option");
      // Muted typed prefix + bold completed remainder, e.g. "behal" + "f".
      var typed = document.createElement("span");
      typed.className = "pp-suggest-typed";
      typed.textContent = word.slice(0, suggestQuery.length);
      var rest = document.createElement("span");
      rest.className = "pp-suggest-rest";
      rest.textContent = word.slice(suggestQuery.length);
      btn.appendChild(typed);
      btn.appendChild(rest);
      // Plain click, same as .pp-recent and every other button in this
      // popup - nothing here hides the dropdown on blur, so there is no
      // input-blur race to dodge with a mousedown+preventDefault trick.
      btn.addEventListener("click", function () {
        selectSuggestion(word);
      });
      li.appendChild(btn);
      suggestList.appendChild(li);
    });
    suggestList.hidden = suggestions.length === 0;
    input.setAttribute("aria-expanded", suggestions.length > 0 ? "true" : "false");
  }

  function updateSuggestions() {
    var text = input.value.trim().toLowerCase();
    if (!text) {
      hideSuggestions();
      return;
    }
    ensureWordlist().then(function (list) {
      // The list the user is still typing may have moved on by the time the
      // (one-time) load resolves - re-check against the live input value.
      if (input.value.trim().toLowerCase() !== text) return;
      var matches = QP.suggest.pickPrefixMatches(list, text, 5);
      var exact = matches.indexOf(text) !== -1;
      suggestions = exact ? [] : matches;
      suggestIndex = -1;
      suggestQuery = text;
      renderSuggestions();
    });
  }

  // Selecting a suggestion performs the exact same lookup as pressing Enter.
  function selectSuggestion(word) {
    input.value = word;
    hideSuggestions();
    doLookup(word, "popup_suggest");
  }

  input.addEventListener("focus", function () {
    ensureWordlist();
  });

  input.addEventListener("input", function () {
    updateSuggestions();
  });

  input.addEventListener("keydown", function (e) {
    if (suggestList.hidden || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      suggestIndex = suggestIndex < suggestions.length - 1 ? suggestIndex + 1 : 0;
      renderSuggestions();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      suggestIndex = suggestIndex > 0 ? suggestIndex - 1 : suggestions.length - 1;
      renderSuggestions();
    } else if (e.key === "Enter") {
      if (suggestIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[suggestIndex]);
      } else {
        hideSuggestions();
      }
    } else if (e.key === "Escape") {
      hideSuggestions();
    }
  });

  document.addEventListener("mousedown", function (e) {
    if (!suggestList.hidden && !e.target.closest(".pp-search-wrap")) {
      hideSuggestions();
    }
  });

  $("pp-settings").addEventListener("click", function () {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  });

  $("pp-site").addEventListener("click", function (e) {
    e.preventDefault();
    chrome.tabs.create({ url: QP.config.SITE_URL });
  });

  function refreshRecents() {
    QP.store.getRecents().then(function (list) {
      recentsList.innerHTML = "";
      if (!list.length) {
        recentsEmpty.hidden = false;
        return;
      }
      recentsEmpty.hidden = true;
      list.forEach(function (item) {
        var li = document.createElement("li");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pp-recent";
        var b = document.createElement("b");
        b.textContent = item.word;
        var sub = document.createElement("span");
        var ipa = item.ipa && (accent === "uk" ? item.ipa.uk : item.ipa.us);
        sub.textContent = ipa || item.definition || "";
        btn.appendChild(b);
        btn.appendChild(sub);
        btn.addEventListener("click", function () {
          QP.analytics.track(QP.analytics.EVENTS.RECENT_OPENED, { word: item.word });
          input.value = item.word;
          doLookup(item.word, "popup_recent");
        });
        li.appendChild(btn);
        recentsList.appendChild(li);
      });
    });
  }

  function refreshUsage() {
    sendMessage({ type: "GET_USAGE" })
      .then(function (u) {
        if (!u) {
          usageEl.textContent = "";
          return;
        }
        var txt = u.used + " / " + u.limit + " words today";
        if (u.remaining === 0 && u.resetsAt) {
          txt += " · resets in ~" + QP.util.hoursUntil(u.resetsAt) + "h";
        }
        usageEl.textContent = txt;
      })
      .catch(function () {
        usageEl.textContent = "";
      });
  }

  QP.store.getSettings().then(function (s) {
    accent = s.accent === "uk" ? "uk" : "us";
    refreshRecents();
    refreshUsage();
  });

  input.focus();
})();
