/*
 * Per-document audio cache. Runs in page-ish contexts (content script, popup)
 * where lookups happen. Caches the raw base64 audio (+ format) the service
 * worker fetched, keyed by word+accent, so pressing a play button twice never
 * re-downloads.
 *
 * This used to also build a Blob/object URL for local <audio> playback, but
 * playback now happens in the extension's offscreen document (see
 * src/offscreen/offscreen.js) so host pages with a strict CSP can't block it.
 * A blob: URL is only valid in the document that created it, so there's
 * nothing for that document to reuse from here - it gets the base64 instead
 * and builds its own blob there.
 *
 * IndexedDB was intentionally NOT used for the MVP: a session-lifetime Map is
 * enough, and the WaveNet clips are tiny. A persistent layer can be added
 * here later without changing callers.
 */
(function () {
  var QP = (self.QP = self.QP || {});

  var cache = new Map(); // "word::accent" -> { base64, format }

  function key(word, accent) {
    return word + "::" + (accent === "uk" ? "uk" : "us");
  }

  function put(word, accent, base64, format) {
    cache.set(key(word, accent), { base64: base64, format: format || "audio/mpeg" });
  }

  function get(word, accent) {
    return cache.get(key(word, accent)) || null;
  }

  function has(word, accent) {
    return cache.has(key(word, accent));
  }

  function clear() {
    cache.clear();
  }

  QP.audioCache = { put: put, get: get, has: has, clear: clear };
})();
