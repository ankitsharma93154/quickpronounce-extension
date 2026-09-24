/*
 * The ONLY module that talks to the QuickPronounce API. Loaded in the service
 * worker only; every other context reaches it through runtime messages.
 *
 * Two real endpoints (see quickpronounce_api/openapi.yaml):
 *
 *   GET /ext/v1/dictionary/:word
 *     -> { word, entries[].definitions, phonetics:{us,uk}, syllables:{us,uk} }
 *        No audio. This fills the card.
 *
 *   GET /ext/v1/pronunciation/:word?accent=us|uk
 *     -> { word, phonetics, syllables, audio:{ content:<base64>, format } }
 *        One synthesized MP3 for the requested accent. Fetched lazily, only
 *        when the user presses a play button.
 *
 * Both take an `X-Install-Id` header (see store.js getInstallId) instead of
 * an API key - it identifies the install for a fair per-install quota, not a
 * credential, so there's nothing here worth protecting as a secret. Errors
 * are normalized to an ApiError with a stable `.kind` so the UI can pick
 * copy without parsing messages.
 */
(function () {
  var QP = (self.QP = self.QP || {});

  // kind: not_found | timeout | network | rate_limited | bad_response |
  //       server_error | unauthorized | unknown
  function ApiError(kind, message, extra) {
    this.name = "ApiError";
    this.kind = kind;
    this.message = message || kind;
    if (extra) Object.assign(this, extra);
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  // Resolved once per service-worker lifetime and reused: memoizing the
  // promise (not just the value) means two requests firing before the very
  // first one resolves still share one chrome.storage read/write instead of
  // racing to generate two different install ids.
  var installIdPromise = null;
  function getInstallId() {
    if (!installIdPromise) installIdPromise = QP.store.getInstallId();
    return installIdPromise;
  }

  async function request(path) {
    var cfg = QP.config;
    var installId = await getInstallId();
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, cfg.REQUEST_TIMEOUT_MS);

    return fetch(cfg.API_BASE + path, {
      method: "GET",
      headers: { "X-Install-Id": installId, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store"
    })
      .catch(function (err) {
        if (err && err.name === "AbortError") {
          throw new ApiError("timeout", "The request timed out.");
        }
        throw new ApiError("network", "Could not reach QuickPronounce.");
      })
      .then(parse)
      .finally(function () {
        clearTimeout(timer);
      });
  }

  async function parse(res) {
    var status = res.status;
    var body = null;
    try {
      body = await res.json();
    } catch (e) {
      body = null;
    }

    if (status >= 200 && status < 300) {
      if (!body || body.success !== true || !body.data) {
        throw new ApiError("bad_response", "Unexpected response from QuickPronounce.");
      }
      return body.data;
    }
    if (status === 404) {
      throw new ApiError("not_found", (body && body.message) || "Word not found.");
    }
    if (status === 401 || status === 403) {
      throw new ApiError("unauthorized", (body && body.message) || "Extension key was rejected.");
    }
    if (status === 429) {
      var retry =
        (body && Number(body.retryAfter)) ||
        parseInt(res.headers.get("Retry-After"), 10) ||
        60;
      throw new ApiError("rate_limited", (body && body.message) || "Too many requests.", {
        retryAfter: retry
      });
    }
    if (status >= 500) {
      throw new ApiError("server_error", (body && body.message) || "QuickPronounce had a problem.");
    }
    throw new ApiError("unknown", (body && body.message) || "Request failed (" + status + ").");
  }

  // Parts of speech worth defaulting to over the API's `defaultPartOfSpeech`.
  // That field is unreliable for common words: many dictionary entries list a
  // surname or place-name sense first ("Name"), and defaultPartOfSpeech often
  // just points at it (e.g. "record", "bank", "wind" all default to "Name").
  // Showing that as the one definition would be actively misleading, so a
  // major part of speech wins whenever one is present; every sense is still
  // reachable via the card's part-of-speech tabs.
  var PRIMARY_POS_PREFERENCE = ["Noun", "Verb", "Adjective", "Adverb"];

  // A word can have several distinct dictionary entries sharing one POS
  // (different etymology sections) - e.g. "sir" has three separate "Noun"
  // entries. Wiktionary's extraction order isn't quality-sorted, so the
  // *first* one isn't reliably the best: audited across the full dataset,
  // ~11% of duplicate-POS groups have a first entry that's an
  // initialism/abbreviation/acronym or an alt-form-of entry while a later
  // entry in the same group is a plain, ordinary sense (e.g. "sir" -> Noun
  // leads with "Initialism of surface insulation resistance" instead of
  // "the titular prefix given to a knight..."). Mirrors the rarity/alt-form
  // signals quickpronounce_api's reorderDefinitions() already uses, plus
  // initialism/abbreviation, which turned out to be the dominant case (~71%
  // of the audited mis-picks; alt-form covers the rest, rarity-tagged
  // definitions never won this particular way).
  var RARITY_RE =
    /^\((?:[^)]*\b(?:archaic|obsolete|rare|dialectal|dated|historical|nonstandard|proscribed|poetic)\b[^)]*)\)/i;
  var ALT_FORM_RE =
    /^(alternative\b.{0,30}\b(form|spelling)\s+of|misspelling of|obsolete (form |spelling )?of|archaic (form |spelling )?of|dialectal form of|pronunciation spelling of|dated form of)\b/i;
  var INITIALISM_RE = /^(initialism of|abbreviation of|acronym of|contraction of|clipping of)\b/i;

  function isNonPrimaryDefinition(def) {
    return RARITY_RE.test(def) || ALT_FORM_RE.test(def) || INITIALISM_RE.test(def);
  }

  // One sense per part of speech, reordered so the best default sense leads.
  // Returns [] if the word has no definitions at all.
  // How many definitions one part of speech contributes to the card's
  // scrollable Meaning list.
  var MAX_DEFINITIONS = 3;

  // Gathers every definition for a POS (all entries sharing it, and every
  // definition within each entry), ordered so ordinary senses lead and
  // rarity-tagged / alt-form / initialism ones follow. The order is stable, so
  // the first ordinary definition still matches what the single-definition
  // card used to show. If everything is non-primary the original order stands.
  function rankDefinitions(defs) {
    var seen = {};
    var primary = [];
    var rest = [];
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      if (seen[d]) continue;
      seen[d] = true;
      (isNonPrimaryDefinition(d) ? rest : primary).push(d);
    }
    return primary.concat(rest).slice(0, MAX_DEFINITIONS);
  }

  function pickSenses(entries, defaultPos) {
    var senses = [];
    var defsByKey = []; // parallel to `senses`: every definition seen for it
    var indexByPos = {}; // pos key -> that pos's index into `senses`
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!e || !Array.isArray(e.definitions) || !e.definitions.length) continue;
      var pos = e.partOfSpeech || null;
      var key = pos == null ? "#" + i : pos;
      var entryDefs = e.definitions.map(String);

      if (!(key in indexByPos)) {
        indexByPos[key] = senses.length;
        senses.push({ pos: pos });
        defsByKey.push(entryDefs);
      } else {
        defsByKey[indexByPos[key]] = defsByKey[indexByPos[key]].concat(entryDefs);
      }
    }
    for (var s = 0; s < senses.length; s++) {
      var ranked = rankDefinitions(defsByKey[s]);
      senses[s].definition = ranked[0];
      senses[s].definitions = ranked;
    }
    if (!senses.length) return senses;

    var findByPos = function (p) {
      for (var j = 0; j < senses.length; j++) if (senses[j].pos === p) return j;
      return -1;
    };
    var findMajor = function () {
      for (var j = 0; j < senses.length; j++) {
        if (PRIMARY_POS_PREFERENCE.indexOf(senses[j].pos) !== -1) return j;
      }
      return -1;
    };

    var primaryIdx = -1;
    if (defaultPos && PRIMARY_POS_PREFERENCE.indexOf(defaultPos) !== -1) primaryIdx = findByPos(defaultPos);
    if (primaryIdx === -1) primaryIdx = findMajor();
    if (primaryIdx === -1 && defaultPos) primaryIdx = findByPos(defaultPos);
    if (primaryIdx === -1) primaryIdx = 0;

    if (primaryIdx > 0) senses.unshift(senses.splice(primaryIdx, 1)[0]);
    return senses;
  }

  function shapeDictionary(data) {
    var entries = Array.isArray(data.entries) ? data.entries : [];
    var senses = pickSenses(entries, data.defaultPartOfSpeech || null);

    var ph = data.phonetics || {};
    var sy = data.syllables || {};
    return {
      word: data.word,
      ipa: { us: ph.us || null, uk: ph.uk || null },
      syllables: {
        us: Array.isArray(sy.us) ? sy.us : [],
        uk: Array.isArray(sy.uk) ? sy.uk : []
      },
      // All senses worth showing, primary (best-guess default) first. The
      // card renders senses[0] and, when there is more than one, small tabs
      // for the rest so the reader can pick the part of speech themselves
      // instead of silently trusting one guess.
      senses: senses,
      definition: senses.length ? senses[0].definition : null,
      partOfSpeech: senses.length ? senses[0].pos : null,
      found: true,
      // The API has no best-guess mode today. Field kept so the UI path
      // already exists when it does.
      bestGuess: false,
      source: "api"
    };
  }

  async function getDictionary(word) {
    var data = await request(QP.config.dictionaryPath(word));
    return shapeDictionary(data);
  }

  async function getAudio(word, accent) {
    var data = await request(QP.config.pronunciationPath(word, accent));
    if (!data.audio || !data.audio.content) {
      throw new ApiError("bad_response", "No audio was returned.");
    }
    return { base64: data.audio.content, format: data.audio.format || "mp3" };
  }

  // pickSenses exported for selftest.js only - not used by any other caller.
  QP.api = { getDictionary: getDictionary, getAudio: getAudio, ApiError: ApiError, pickSenses: pickSenses };
})();
