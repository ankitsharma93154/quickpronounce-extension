/*
 * Build the phonetic respelling line from the API's anglicized syllable list.
 *
 *   [{text:"pruh",stress:0},{text:"nun",stress:0},{text:"see",stress:0},
 *    {text:"ay",stress:1},{text:"shuhn",stress:0}]
 *     ->  pruh·nun·see·AY·shuhn
 *
 * stress: 1 = primary (UPPERCASE), 2 = secondary (Capitalised), 0 = unstressed.
 */
(function () {
  var QP = (self.QP = self.QP || {});

  var MIDDOT = "·";

  function toRespelling(syllables) {
    if (!Array.isArray(syllables) || syllables.length === 0) return "";
    return syllables
      .map(function (s) {
        var t = String(s && s.text != null ? s.text : "").trim();
        if (!t) return "";
        if (s.stress === 1) return t.toUpperCase();
        if (s.stress === 2) return t.charAt(0).toUpperCase() + t.slice(1);
        return t;
      })
      .filter(Boolean)
      .join(MIDDOT);
  }

  function syllableCount(syllables) {
    if (!Array.isArray(syllables)) return 0;
    return syllables.filter(function (s) {
      return s && String(s.text || "").trim();
    }).length;
  }

  QP.respell = { toRespelling: toRespelling, syllableCount: syllableCount, MIDDOT: MIDDOT };
})();
