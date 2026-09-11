/* Small dependency-free helpers used across contexts. */
(function () {
  var QP = (self.QP = self.QP || {});

  function debounce(fn, wait) {
    var t = null;
    function debounced() {
      var args = arguments;
      var ctx = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () {
        t = null;
        fn.apply(ctx, args);
      }, wait);
    }
    debounced.cancel = function () {
      if (t) {
        clearTimeout(t);
        t = null;
      }
    };
    return debounced;
  }

  // base64 -> Uint8Array. `atob` exists in both the service worker and pages.
  function base64ToBytes(b64) {
    var bin = atob(String(b64 || ""));
    var len = bin.length;
    var out = new Uint8Array(len);
    for (var i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  // Coarse "resets in ~Nh" label for the usage cap.
  function hoursUntil(ts) {
    if (!ts) return 0;
    var ms = ts - Date.now();
    if (ms <= 0) return 0;
    return Math.max(1, Math.round(ms / (60 * 60 * 1000)));
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  QP.util = {
    debounce: debounce,
    base64ToBytes: base64ToBytes,
    clamp: clamp,
    hoursUntil: hoursUntil,
    escapeHtml: escapeHtml
  };
})();
