/*
 * Heteronym readings: words pronounced differently depending on meaning
 * ("record": noun /ˈɹɛk.ɚd/, verb /ɹɪˈkɔɹd/). Loaded in the service worker,
 * content script and popup. No DOM and no network, so any card design can use
 * it.
 *
 * What a card gets (see shapeDictionary in api.js):
 *
 *   view.model.readings      null for an ordinary word, else an array, default
 *                            reading first:
 *     { id, isDefault,
 *       ipa: {us, uk}, syllables: {us, uk}, inherited: {us, uk},
 *       partsOfSpeech: [..], entryIndexes: [..],
 *       senses: [..] }       same shape as model.senses, this reading only
 *   view.model.otherSenses   senses of entries no reading covers (names and
 *                            similar). [] when there are none.
 *
 * model.ipa / syllables / senses stay the word-level values, so a card that
 * ignores readings keeps working.
 *
 * Audio: ctx.requestAudio(word, accent, reading.id), and the same third
 * argument on QP.audioCache.get/has, plus a fifth on put(word, accent, base64,
 * format, readingId). A refused request resolves { ok: false, kind } with kind
 * "reading_unavailable" (no pronunciation in that accent) or "reading_invalid".
 * Never fall back to the plain clip: it could be another meaning's
 * pronunciation.
 *
 * QP.readings.forAccent(reading, accent) gives what to show for one accent. An
 * inherited accent has no pronunciation of its own (the stored value belongs
 * to another meaning), so it has no IPA or respelling and can't be played.
 * QP.readings.tabLabels(readings, accent) gives one short, unique label per
 * reading.
 */
(function () {
  var QP = (self.QP = self.QP || {});

  var READING_ID_RE = /^r-[0-9a-f]{10}$/;

  function isObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }
  function isStringOrNull(v) {
    return v === null || v === undefined || typeof v === "string";
  }
  function isSyllableList(v) {
    return (
      Array.isArray(v) &&
      v.every(function (s) {
        return isObject(s) && typeof s.text === "string";
      })
    );
  }

  function isReadingId(id) {
    return typeof id === "string" && READING_ID_RE.test(id);
  }

  // data: the API's dictionary response. Returns the readings to use (default
  // first, entryIndexes kept only when they point into data.entries), or null
  // when the word should get the ordinary card: not a heteronym, fewer than two
  // readings, any malformed reading, not exactly one default, duplicate ids, or
  // a reading left with no valid entry. Field names here are the model's (ipa,
  // not the API's phonetics).
  function valid(data) {
    if (!isObject(data) || data.isHeteronym !== true) return null;
    var readings = data.readings;
    var entryCount = Array.isArray(data.entries) ? data.entries.length : 0;
    if (!Array.isArray(readings) || readings.length < 2) return null;

    var ids = {};
    var cleaned = [];
    for (var i = 0; i < readings.length; i++) {
      var r = readings[i];
      if (!isObject(r) || !isReadingId(r.id) || ids[r.id]) return null;
      ids[r.id] = true;
      if (typeof r.isDefault !== "boolean") return null;
      if (!isObject(r.phonetics) || !isStringOrNull(r.phonetics.us) || !isStringOrNull(r.phonetics.uk)) return null;
      if (!isObject(r.inherited)) return null;
      var entryIndexes = (Array.isArray(r.entryIndexes) ? r.entryIndexes : []).filter(function (n) {
        return Number.isInteger(n) && n >= 0 && n < entryCount;
      });
      if (!entryIndexes.length) return null;
      var syl = isObject(r.syllables) ? r.syllables : {};
      cleaned.push({
        id: r.id,
        isDefault: r.isDefault,
        ipa: { us: r.phonetics.us || null, uk: r.phonetics.uk || null },
        syllables: {
          us: isSyllableList(syl.us) ? syl.us : [],
          uk: isSyllableList(syl.uk) ? syl.uk : []
        },
        inherited: { us: r.inherited.us === true, uk: r.inherited.uk === true },
        entryIndexes: entryIndexes,
        partsOfSpeech: (Array.isArray(r.partsOfSpeech) ? r.partsOfSpeech : []).filter(function (p) {
          return typeof p === "string" && p;
        })
      });
    }
    var defaults = cleaned.filter(function (r) {
      return r.isDefault;
    });
    if (defaults.length !== 1) return null;
    return defaults.concat(
      cleaned.filter(function (r) {
        return !r.isDefault;
      })
    );
  }

  // Indexes of the entries no reading claims.
  function otherEntryIndexes(entryCount, readings) {
    var claimed = {};
    (readings || []).forEach(function (r) {
      r.entryIndexes.forEach(function (i) {
        claimed[i] = true;
      });
    });
    var out = [];
    for (var i = 0; i < entryCount; i++) if (!claimed[i]) out.push(i);
    return out;
  }

  function forAccent(reading, accent) {
    var a = accent === "uk" ? "uk" : "us";
    var ipa = (reading && reading.ipa && reading.ipa[a]) || null;
    var available = !!ipa && !(reading.inherited && reading.inherited[a] === true);
    var syllables = available ? (reading.syllables && reading.syllables[a]) || [] : [];
    return {
      accent: a,
      available: available,
      ipa: available ? ipa : null,
      syllables: syllables,
      respell: available ? QP.respell.toRespelling(syllables) : "",
      syllableCount: available ? QP.respell.syllableCount(syllables) : 0
    };
  }

  // Short label: syllables joined with "-", the primary-stressed one in
  // capitals when there's more than one ("rih-KAWRD"); one syllable stays
  // lowercase ("lehd").
  function respellLabel(syllables) {
    if (!Array.isArray(syllables) || !syllables.length) return "";
    if (syllables.length === 1) return syllables[0].text.toLowerCase();
    return syllables
      .map(function (s) {
        return s.stress === 1 ? s.text.toUpperCase() : s.text.toLowerCase();
      })
      .join("-");
  }

  // One label per reading: always a respelling, never parts of speech (those
  // can't tell readings apart: both readings of "lead" are nouns and verbs).
  //   - this accent's respelling when the reading has one;
  //   - otherwise the other accent's, marked with it ("LAY-suhr (UK)");
  //   - identical labels are numbered ("kuhz 1", "kuhz 2");
  //   - last resort for data with no respelling at all: its position.
  // Matches Pronounce_web/src/lib/readings.js readingTabLabels.
  function tabLabels(readings, accent) {
    var list = readings || [];
    var a = accent === "uk" ? "uk" : "us";
    var other = a === "us" ? "uk" : "us";
    var labels = list.map(function (r, i) {
      var own = respellLabel(forAccent(r, a).syllables);
      if (own) return own;
      var alt = r.inherited && r.inherited[other] ? "" : respellLabel(r.syllables && r.syllables[other]);
      return alt ? alt + " (" + other.toUpperCase() + ")" : String(i + 1);
    });
    var count = {};
    labels.forEach(function (l) {
      count[l] = (count[l] || 0) + 1;
    });
    var seen = {};
    return labels.map(function (l) {
      if (count[l] === 1) return l;
      seen[l] = (seen[l] || 0) + 1;
      return l + " " + seen[l];
    });
  }

  QP.readings = {
    isReadingId: isReadingId,
    valid: valid,
    otherEntryIndexes: otherEntryIndexes,
    forAccent: forAccent,
    respellLabel: respellLabel,
    tabLabels: tabLabels
  };
})();
