/*
 * Options page wiring. All settings live in chrome.storage.local via QP.store.
 * Preferences (on-page button, accent, theme) only take effect when the user
 * presses Save changes. The buttons further down the page (clear recents, reset
 * usage and so on) are one-off actions and run straight away.
 */
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

  // --- preferences, saved by the Save changes button -------------------
  var selBtn = $("op-selbtn");
  var accentRadios = document.querySelectorAll('input[name="op-accent"]');
  var themeRadios = document.querySelectorAll('input[name="op-theme"]');
  var saveBtn = $("op-save");
  var saveStatus = $("op-save-status");
  var saved = null; // what's in storage; null until it has loaded

  function radioValue(radios) {
    var picked = Array.prototype.find.call(radios, function (r) {
      return r.checked;
    });
    return picked ? picked.value : null;
  }

  function currentForm() {
    return {
      selectionButton: selBtn.checked,
      accent: radioValue(accentRadios) === "uk" ? "uk" : "us",
      theme: QP.theme.normalize(radioValue(themeRadios))
    };
  }

  function isDirty() {
    if (!saved) return false;
    var form = currentForm();
    return (
      form.selectionButton !== saved.selectionButton ||
      form.accent !== saved.accent ||
      form.theme !== saved.theme
    );
  }

  function onFormChange() {
    var dirty = isDirty();
    saveBtn.disabled = !dirty;
    saveStatus.textContent = dirty ? "Unsaved changes" : "";
  }

  QP.store.getSettings().then(function (s) {
    saved = { selectionButton: s.selectionButton, accent: s.accent, theme: s.theme };
    selBtn.checked = s.selectionButton;
    accentRadios.forEach(function (r) {
      r.checked = r.value === s.accent;
    });
    themeRadios.forEach(function (r) {
      r.checked = r.value === s.theme;
    });
    QP.theme.applyToPage(s.theme);
  });

  selBtn.addEventListener("change", onFormChange);
  accentRadios.forEach(function (r) {
    r.addEventListener("change", onFormChange);
  });
  themeRadios.forEach(function (r) {
    r.addEventListener("change", onFormChange);
  });

  saveBtn.addEventListener("click", function () {
    var form = currentForm();
    saveBtn.disabled = true;
    QP.store.setSettings(form).then(function () {
      saved = form;
      QP.theme.applyToPage(form.theme);
      saveStatus.textContent = "Saved";
    });
  });

  window.addEventListener("beforeunload", function (e) {
    if (isDirty()) e.preventDefault();
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
  function refreshUsage() {
    sendMessage({ type: "GET_USAGE" }).then(function (u) {
      if (!u) {
        $("op-usage").textContent = "—";
        return;
      }
      var txt = u.used + " word" + (u.used === 1 ? "" : "s") + " looked up in the last 24 hours";
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
