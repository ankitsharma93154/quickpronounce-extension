/*
 * Thin promise wrapper over chrome.storage.local. Used by the service worker,
 * popup, and options page. The content script does NOT load this module: it
 * reads the `settings` key directly (see content.js) and never writes.
 *
 * Keys:
 *   settings         { selectionButton:boolean, accent:"us"|"uk" }
 *   recents          [{ word, ipa, syllables, definition, partOfSpeech, ts }]  (<= RECENTS_MAX)
 *   capLedger        { <word>: firstLookupTs }  (rolling window, pruned on read)
 *   analyticsBuffer  [{ event, props, ts }]     (local only, ring buffer)
 *   installMeta      { installedAt, firstLookupDone }
 */
(function () {
  var QP = (self.QP = self.QP || {});

  var KEYS = {
    SETTINGS: "settings",
    RECENTS: "recents",
    CAP: "capLedger",
    ANALYTICS: "analyticsBuffer",
    META: "installMeta"
  };

  var DEFAULT_SETTINGS = { selectionButton: true, accent: "us" };

  function get(key) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(key, function (res) {
          if (chrome.runtime.lastError) return resolve(undefined);
          resolve(res && Object.prototype.hasOwnProperty.call(res, key) ? res[key] : undefined);
        });
      } catch (e) {
        resolve(undefined);
      }
    });
  }

  function set(obj) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.set(obj, function () {
          void chrome.runtime.lastError;
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
  }

  async function getSettings() {
    var s = await get(KEYS.SETTINGS);
    var merged = Object.assign({}, DEFAULT_SETTINGS, s && typeof s === "object" ? s : {});
    merged.accent = merged.accent === "uk" ? "uk" : "us";
    merged.selectionButton = merged.selectionButton !== false;
    return merged;
  }

  async function setSettings(patch) {
    var next = Object.assign({}, await getSettings(), patch || {});
    var obj = {};
    obj[KEYS.SETTINGS] = next;
    await set(obj);
    return next;
  }

  async function getRecents() {
    var r = await get(KEYS.RECENTS);
    return Array.isArray(r) ? r : [];
  }

  async function addRecent(snapshot) {
    var list = await getRecents();
    list = list.filter(function (x) {
      return x && x.word !== snapshot.word;
    });
    list.unshift(snapshot);
    if (list.length > QP.config.RECENTS_MAX) list = list.slice(0, QP.config.RECENTS_MAX);
    var obj = {};
    obj[KEYS.RECENTS] = list;
    await set(obj);
    return list;
  }

  async function clearRecents() {
    var obj = {};
    obj[KEYS.RECENTS] = [];
    await set(obj);
  }

  async function getCapLedger() {
    var c = await get(KEYS.CAP);
    return c && typeof c === "object" ? c : {};
  }

  async function setCapLedger(ledger) {
    var obj = {};
    obj[KEYS.CAP] = ledger || {};
    await set(obj);
  }

  async function getAnalyticsBuffer() {
    var a = await get(KEYS.ANALYTICS);
    return Array.isArray(a) ? a : [];
  }

  async function setAnalyticsBuffer(arr) {
    var obj = {};
    obj[KEYS.ANALYTICS] = Array.isArray(arr) ? arr : [];
    await set(obj);
  }

  async function getMeta() {
    var m = await get(KEYS.META);
    return m && typeof m === "object" ? m : {};
  }

  async function setMeta(patch) {
    var next = Object.assign({}, await getMeta(), patch || {});
    var obj = {};
    obj[KEYS.META] = next;
    await set(obj);
    return next;
  }

  QP.store = {
    KEYS: KEYS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    getSettings: getSettings,
    setSettings: setSettings,
    getRecents: getRecents,
    addRecent: addRecent,
    clearRecents: clearRecents,
    getCapLedger: getCapLedger,
    setCapLedger: setCapLedger,
    getAnalyticsBuffer: getAnalyticsBuffer,
    setAnalyticsBuffer: setAnalyticsBuffer,
    getMeta: getMeta,
    setMeta: setMeta
  };
})();
