/*
 * Read side of the bundled offline word cache. Isolated behind this interface
 * so the data source (currently the small object in offlineData.js) can be
 * swapped for a larger downloaded pack later without changing callers.
 */
(function () {
  var QP = (self.QP = self.QP || {});

  function lookup(word) {
    var data = QP.offlineData || {};
    var hit = data[word];
    if (!hit) return null;
    return {
      word: word,
      ipa: { us: (hit.ipa && hit.ipa.us) || null, uk: (hit.ipa && hit.ipa.uk) || null },
      syllables: {
        us: (hit.syllables && hit.syllables.us) || [],
        uk: (hit.syllables && hit.syllables.uk) || []
      },
      senses: hit.definition ? [{ pos: hit.partOfSpeech || null, definition: hit.definition }] : [],
      definition: hit.definition || null,
      partOfSpeech: hit.partOfSpeech || null,
      found: true,
      bestGuess: false,
      source: "offline"
    };
  }

  function has(word) {
    return !!(QP.offlineData && QP.offlineData[word]);
  }

  QP.offlineCache = { lookup: lookup, has: has };
})();
