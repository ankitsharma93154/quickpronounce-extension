/*
 * Turn a raw text selection into the single word the API should receive.
 *
 *   '"running,"'        -> running
 *   '(accommodation)'   -> accommodation
 *   '"Hello!"'          -> hello
 *   'a quick brown fox' -> quick        (first token with letters, multiword=true)
 *   '   '               -> { ok: false, empty: true }
 *
 * Word-internal apostrophes and hyphens are kept (don't, well-being). Casing
 * is lowered to match the API, which normalizes anyway.
 */
(function () {
  var QP = (self.QP = self.QP || {});

  // Strip runs of non-letters from the start and end only.
  var EDGE = /^[^\p{L}]+|[^\p{L}]+$/gu;
  var HAS_LETTER = /\p{L}/u;

  function normalizeWord(raw) {
    var text = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
    if (!text) return { ok: false, empty: true, word: "", multiword: false };

    var multiword = text.indexOf(" ") !== -1;
    var candidate;

    if (multiword) {
      candidate = "";
      var tokens = text.split(" ");
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i].replace(EDGE, "");
        if (HAS_LETTER.test(t)) {
          candidate = t;
          break;
        }
      }
    } else {
      candidate = text.replace(EDGE, "");
    }

    candidate = candidate.replace(EDGE, "").toLowerCase();

    if (!candidate || !HAS_LETTER.test(candidate)) {
      return { ok: false, empty: true, word: "", multiword: multiword };
    }
    if (candidate.length > QP.config.MAX_WORD_LEN) {
      candidate = candidate.slice(0, QP.config.MAX_WORD_LEN);
    }
    return { ok: true, empty: false, word: candidate, multiword: multiword };
  }

  QP.normalize = { normalizeWord: normalizeWord };
})();
