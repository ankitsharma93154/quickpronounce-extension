/*
 * Per-document audio cache. Runs in page-ish contexts (content script, popup)
 * where Blob URLs can be created. The service worker fetches the base64 MP3
 * from the API and hands it here; this module turns it into an object URL
 * once and replays from memory afterwards, so pressing a play button twice
 * never re-downloads.
 *
 * IndexedDB was intentionally NOT used for the MVP: a session-lifetime Map is
 * enough, and the WaveNet clips are tiny. A persistent layer can be added
 * here later without changing callers.
 */
(function () {
  var QP = (self.QP = self.QP || {});

  var urls = new Map(); // "word::accent" -> objectURL

  function key(word, accent) {
    return word + "::" + (accent === "uk" ? "uk" : "us");
  }

  function fromBase64(word, accent, b64) {
    var k = key(word, accent);
    if (urls.has(k)) return urls.get(k);
    var bytes = QP.util.base64ToBytes(b64);
    var blob = new Blob([bytes], { type: "audio/mpeg" });
    var url = URL.createObjectURL(blob);
    urls.set(k, url);
    return url;
  }

  function get(word, accent) {
    return urls.get(key(word, accent)) || null;
  }

  function has(word, accent) {
    return urls.has(key(word, accent));
  }

  function revokeAll() {
    urls.forEach(function (u) {
      try {
        URL.revokeObjectURL(u);
      } catch (e) {
        /* noop */
      }
    });
    urls.clear();
  }

  QP.audioCache = { fromBase64: fromBase64, get: get, has: has, revokeAll: revokeAll };
})();
