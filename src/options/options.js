/* Options page wiring. All settings live in chrome.storage.local via QP.store. */
(function () {
  var QP = window.QP;
  var $ = function (id) {
    return document.getElementById(id);
  };

  function sendMessage(payload) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(payload, function (resp) {
          void chrome.runtime.lastError;
          resolve(resp);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  // --- selection button + accent -------------------------------------
  var selBtn = $("op-selbtn");
  var accentRadios = document.querySelectorAll('input[name="op-accent"]');

  QP.store.getSettings().then(function (s) {
    selBtn.checked = s.selectionButton !== false;
    accentRadios.forEach(function (r) {
      r.checked = r.value === (s.accent === "uk" ? "uk" : "us");
    });
  });

  selBtn.addEventListener("change", function () {
    QP.store.setSettings({ selectionButton: selBtn.checked });
  });
  accentRadios.forEach(function (r) {
    r.addEventListener("change", function () {
      if (r.checked) QP.store.setSettings({ accent: r.value === "uk" ? "uk" : "us" });
    });
  });

  // --- keyboard shortcut -------------------------------------------------
  var shortcutEl = $("op-shortcut");
  if (chrome.commands && chrome.commands.getAll) {
    chrome.commands.getAll(function (cmds) {
      var c = (cmds || []).find(function (x) {
        return x.name === "pronounce-selection";
      });
      if (c && c.shortcut) {
        shortcutEl.textContent = "Current: " + c.shortcut + " — pronounce the selected text";
      } else {
        shortcutEl.textContent = "No shortcut set yet. Click below to add one.";
      }
    });
  } else {
    shortcutEl.textContent = "Manage shortcuts in chrome://extensions/shortcuts";
  }
  $("op-change-shortcut").addEventListener("click", function () {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });

  // --- recents --------------------------------------------------------
  function refreshRecents() {
    QP.store.getRecents().then(function (list) {
      $("op-recents-count").textContent =
        list.length === 0
          ? "No recent words stored."
          : list.length + (list.length === 1 ? " word stored locally." : " words stored locally.");
    });
  }
  $("op-clear-recents").addEventListener("click", function () {
    QP.store.clearRecents().then(refreshRecents);
  });

  // --- usage ---------------------------------------------------------
  $("op-limit").textContent = String(QP.config.DAILY_UNIQUE_WORD_LIMIT);
  function refreshUsage() {
    sendMessage({ type: "GET_USAGE" }).then(function (u) {
      if (!u) {
        $("op-usage").textContent = "—";
        return;
      }
      var txt = u.used + " / " + u.limit + " new words in the last 24 hours";
      if (u.resetsAt) txt += " · oldest resets in ~" + QP.util.hoursUntil(u.resetsAt) + "h";
      $("op-usage").textContent = txt;
    });
  }
  $("op-reset-usage").addEventListener("click", function () {
    QP.store.setCapLedger({}).then(refreshUsage);
  });

  // --- diagnostics -------------------------------------------------
  function refreshDiag() {
    QP.analytics.summary().then(function (sum) {
      var lines = [];
      lines.push("events total: " + sum.total);
      if (sum.firstAt) lines.push("since: " + new Date(sum.firstAt).toLocaleString());
      lines.push("");
      Object.keys(QP.analytics.EVENTS).forEach(function (k) {
        var name = QP.analytics.EVENTS[k];
        lines.push(name.padEnd(20, " ") + " " + (sum.counts[name] || 0));
      });
      $("op-diag").textContent = lines.join("\n");
    });
  }
  $("op-copy-diag").addEventListener("click", function () {
    QP.analytics.all().then(function (all) {
      var text = JSON.stringify(all, null, 2);
      navigator.clipboard.writeText(text).then(
        function () {
          var b = $("op-copy-diag");
          var was = b.textContent;
          b.textContent = "Copied";
          setTimeout(function () {
            b.textContent = was;
          }, 1200);
        },
        function () {}
      );
    });
  });
  $("op-clear-diag").addEventListener("click", function () {
    QP.analytics.clear().then(refreshDiag);
  });

  // --- links ------------------------------------------------------
  $("op-site").href = QP.config.SITE_URL;
  $("op-privacy").href = QP.config.PRIVACY_URL;

  refreshRecents();
  refreshUsage();
  refreshDiag();
})();
