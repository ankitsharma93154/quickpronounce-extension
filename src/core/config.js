/*
 * Every tunable constant for the extension lives here. Nothing else in the
 * codebase should hardcode an endpoint, a path, a limit, or a QuickPronounce
 * URL. Change the API surface in one place.
 *
 * ---------------------------------------------------------------------------
 * API KEY NOTE  (read before shipping)
 * ---------------------------------------------------------------------------
 * A published browser extension cannot hold a secret. Anything in this file is
 * trivially extractable from the packed .crx. `API_KEY` below is therefore a
 * LOW-TRUST, ROTATABLE key, not a credential.
 *
 * CURRENT VALUE: the shared "local-dev" key from quickpronounce_api/config/
 * api-keys.json (dailyLimit 1000). Fine for load-unpacked testing and the
 * early MVP. BEFORE any Chrome Web Store / Edge submission, swap it for a
 * dedicated "quickpronounce-extension" key with a deliberately low dailyLimit
 * (add it to config/api-keys.json and the API_KEYS_JSON env var). If a key
 * gets abused, change the string here and ship an extension update - nothing
 * else depends on its value.
 *
 * The real hardening step (see README "API key hardening") is a thin
 * unauthenticated proxy on the QuickPronounce side that injects the true key
 * server-side and rate-limits per IP. When that exists, point API_BASE at the
 * proxy and set API_KEY to "".
 */
(function () {
  var QP = (self.QP = self.QP || {});

  QP.config = {
    // --- API ---------------------------------------------------------------
    API_BASE: "https://api.quickpronounce.site",
    API_KEY: "qp_live_bcd108b156c5bd7a3b642b4887432aacc94e55f0cd598713cc8c96ae660bab21",

    // GET /v1/dictionary/:word  -> definitions + phonetics + syllables (no audio)
    dictionaryPath: function (word) {
      return "/v1/dictionary/" + encodeURIComponent(word);
    },
    // GET /v1/pronunciation/:word?accent=us|uk -> phonetics + syllables + one base64 mp3
    pronunciationPath: function (word, accent) {
      return (
        "/v1/pronunciation/" +
        encodeURIComponent(word) +
        "?accent=" +
        encodeURIComponent(accent === "uk" ? "uk" : "us")
      );
    },

    // --- QuickPronounce site links --------------------------------------
    SITE_URL: "https://www.quickpronounce.site",
    PRIVACY_URL: "https://www.quickpronounce.site/privacy-policy",
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
