/*
 * Prefix-match search suggestions for the popup's manual lookup. The matcher
 * is a direct port of Pronounce_web/src/components/inputCard.js's
 * pickPrefixMatches: binary-search into the sorted wordlist for the first
 * candidate, then walk forward while the prefix still matches. That keeps
 * per-keystroke cost at ~O(log n) instead of scanning all ~250k entries.
 *
 * The wordlist itself is a bundled copy at src/data/wordlist.txt, kept in
 * sync with the website's copy by scripts/sync-wordlist.js (see that file
 * and the README for when to re-run it).
 */
(function () {
  var QP = self.QP || (self.QP = {});

  function pickPrefixMatches(sortedList, prefix, limit) {
    limit = limit || 5;
    var lo = 0;
    var hi = sortedList.length;
    while (lo < hi) {
      var mid = (lo + hi) >>> 1;
      if (sortedList[mid] < prefix) lo = mid + 1;
      else hi = mid;
    }
    var out = [];
    for (var i = lo; i < sortedList.length && out.length < limit; i++) {
      if (sortedList[i].indexOf(prefix) !== 0) break;
      out.push(sortedList[i]);
    }
    return out;
  }

  var cache = null; // sorted word array, once loaded, kept for this page's lifetime only
  var loading = null;

  function load(url) {
    if (cache) return Promise.resolve(cache);
    if (loading) return loading;
    loading = fetch(url)
      .then(function (r) {
        return r.text();
      })
      .then(function (text) {
        cache = text
          .split("\n")
          .map(function (w) {
            return w.trim().toLowerCase();
          })
          .filter(Boolean)
          // Guard against the source file ever shipping unsorted - matching
          // relies on sorted order. Near-O(n) here since it already is.
          .sort();
        return cache;
      })
      .catch(function () {
        cache = [];
        return cache;
      });
    return loading;
  }

  QP.suggest = { pickPrefixMatches: pickPrefixMatches, load: load };
})();
