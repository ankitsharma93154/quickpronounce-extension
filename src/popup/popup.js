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
    doLookup(input.value, "popup");
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
