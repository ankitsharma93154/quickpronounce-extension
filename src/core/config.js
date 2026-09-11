/*
 * Every tunable constant for the extension lives here. Nothing else in the
 * codebase should hardcode an endpoint, a path, a limit, or a QuickPronounce
 * URL. Change the API surface in one place.
 *
 * ---------------------------------------------------------------------------
 * AUTH NOTE
 * ---------------------------------------------------------------------------
 * The extension holds no API key and no credential of any kind. A published
 * extension can't keep a secret - anything shipped here is extractable from
 * the packed .crx - so instead of an API key, api.js sends a random install
 * id (see store.js getInstallId, generated once per install with
 * crypto.randomUUID) as X-Install-Id. The API uses it to give each install
 * its own fair daily quota (server-side, backed by Redis - see
 * quickpronounce_api/lib/installQuota.js) instead of every install sharing
 * one bucket. It identifies an install, not a person: no account, no email,
 * nothing else attached to it.
 */
(function () {
  var QP = (self.QP = self.QP || {});

  QP.config = {
    // --- API ---------------------------------------------------------------
    API_BASE: "https://api.quickpronounce.site",

    // GET /ext/v1/dictionary/:word  -> definitions + phonetics + syllables (no audio)
    // The /ext/v1/* routes are the extension's own backend: same data and
    // response shape as the public /v1/* API, gated by X-Install-Id instead
    // of X-API-Key so nothing here needs a shipped credential.
    dictionaryPath: function (word) {
      return "/ext/v1/dictionary/" + encodeURIComponent(word);
    },
    // GET /ext/v1/pronunciation/:word?accent=us|uk -> phonetics + syllables + one base64 mp3
    pronunciationPath: function (word, accent) {
      return (
        "/ext/v1/pronunciation/" +
        encodeURIComponent(word) +
        "?accent=" +
        encodeURIComponent(accent === "uk" ? "uk" : "us")
      );
    },

    // --- QuickPronounce site links --------------------------------------
    SITE_URL: "https://www.quickpronounce.site",
    // The extension's own policy, not the website's - different data
    // practices (see Pronounce_web/src/pages/ExtensionPrivacyPolicy.js).
    // Only resolves once that page is deployed.
    PRIVACY_URL: "https://www.quickpronounce.site/extension-privacy-policy",
    // The site auto-runs a lookup for /?word=<word> (see Pronounce_web Home.js).
    wordUrl: function (word) {
      return "https://www.quickpronounce.site/?word=" + encodeURIComponent(word);
    },

    // --- Behaviour -------------------------------------------------------
    REQUEST_TIMEOUT_MS: 8000,

    // Free usage: ~N unique NEW words per rolling window. Replaying a word
    // already looked up in the window does not consume another lookup.
    DAILY_UNIQUE_WORD_LIMIT: 40,
    CAP_WINDOW_MS: 24 * 60 * 60 * 1000,

    RECENTS_MAX: 10,
    ANALYTICS_BUFFER_MAX: 250,

    // API accepts up to 80 chars; longer selections are almost never one word.
    MAX_WORD_LEN: 80,
    // If a selection is longer than this, we treat it as "not a single word".
    MAX_SELECTION_LEN: 120
  };
})();
