# Plus / future-version ideas

Features that were designed (sometimes fully built and tested) and then
deliberately rolled back rather than shipped, because there's no signal yet
that they're worth the added complexity. Revisit if usage data or user
feedback makes the case. Unlike the "do NOT build until usage data" list in
README.md (things never started), everything here was working code at some
point - the design is proven, just not committed to.

---

## "Did you mean" suggestions on a dictionary miss

**Status:** designed, implemented, tested end-to-end, then rolled back
2026-09-18 (not committed on either side) pending real demand.

**What it was:** when a lookup misses, offer 1-3 close spelling suggestions
from the same bundled/loaded wordlist already used for live search
suggestions, instead of a dead-end "not found" message. Clicking a
suggestion re-runs the lookup for that word.

**Why rolled back:** built opportunistically off the "why don't we have
suggestions" conversation, without first confirming the `not_found` rate is
high enough to matter (see "not_found diagnostics" idea below - we don't
currently have that number on either surface). Shipping it now would be
guessing at value rather than responding to it.

### The matching approach (and its known limitation)

Plain prefix matching on the full missed word almost never matches anything,
since it requires some dictionary word to start with the exact (wrong)
string. The design trims the word from the end, one character at a time,
retrying the prefix search until it gets a hit, floored at 4 characters to
avoid noisy suggestions from a near-empty prefix:

```
pickDidYouMean(sortedList, word, { limit = 3, minLength = 4 }):
  for len from word.length down to minLength:
    matches = pickPrefixMatches(sortedList, word[0:len], limit)
    if matches is non-empty: return matches
  return []
```

**Known gap, not yet fixed:** it stops at the *first* length with any match,
even if that's just one word, rather than continuing to broaden the search
until it actually collects up to `limit`. E.g. "accommodatez" trims to
"accommodate" (11 chars), finds exactly one match, and stops - even though
trimming one character further would likely surface 2-3 more candidates.
Fix, if this gets picked back up: keep trimming past the first hit,
accumulating de-duplicated matches, only stopping once `limit` is reached or
`minLength` is hit.

**Also out of scope, deliberately:** real fuzzy/edit-distance matching
(typos in the *middle* of a word, e.g. "recieve" -> "receive"). Prefix
trimming only catches a truncated word or a wrong/extra suffix. Only worth
adding if the simpler version proves useful first.

### Where it plugged in

**Extension:**
- `src/core/suggest.js` - `pickDidYouMean`, alongside the existing
  `pickPrefixMatches`/`load`.
- `src/background/service-worker.js` - `runLookup()`'s `not_found` branch is
  the single place suggestions were computed, so the popup and the on-page
  card got identical results from one code path. Needed
  `suggest.js` added to the service worker's `importScripts(...)` and its
  own lazy-loaded wordlist cache (mirroring `popup.js`'s pattern).
- `src/content/card.js` - `renderMessage` grew a `suggestions` option,
  rendered as clickable chips; new `ctx.onSuggestionSelect(word)` callback
  on the shared card context (same pattern as `onRetry`/`onClose`).
- `src/content/content.js` / `src/popup/popup.js` - trivial
  `onSuggestionSelect` implementations, re-running the lookup via the
  functions they already had (`startLookup` / `doLookup`).
- `src/content/card.css.js` - `.qp-suggest-chips` / `.qp-suggest-chip`
  styles.

**Website (`Pronounce_web`):** the trigger condition is *not* a 404 here -
the backend (`api/index.js`, the DigitalOcean-hosted Express app the website
actually calls, separate from `quickpronounce_api`) returns HTTP 200 with
TTS-only audio for any string, found or not. A genuine miss is signaled by
`entries: [], default_pos: null, phonetic: null` coming back together (see
`assemblePronunciationResponse` in `api/index.js`). Checked this against v4's
"thin" inflected/variant entries (e.g. `c's`, `d's`) first - they carry real
`entries`/`default_pos`, so this signal doesn't false-positive on them.
- `src/components/inputCard.js` - same `pickDidYouMean` ported alongside its
  existing `pickPrefixMatches`; a `notFoundWord` prop (not a boolean - the
  actual missed word, so suggestions don't reference whatever the user has
  since typed but not submitted); reused the existing `handleSelectSuggestion`
  as-is for clicking a suggestion.
- `src/pages/Home.js` - `isNotFound` derived inline from
  `hasPronounced && !phonetic && entries.length === 0 && !default_pos`; no
  new state field needed.

### How it was verified

Extension: new `scripts/selftest.js` cases for the trim/floor/limit logic,
plus real e2e tests (`scripts/e2e.js`) against the loaded extension - a
mistyped real word gets real suggestions, gibberish gets none, clicking a
chip in the popup produces an actual result.

Website: the real backend rejects `localhost` via CORS, and this repo's own
`local-dev-mock/mock-api.js` always synthesizes a *found* result for unknown
words (so it can't simulate a miss either). Verified by intercepting the
network call in a Puppeteer script and feeding it the exact miss-shape JSON
the real backend sends - confirmed chips appear, clicking one re-runs the
lookup and shows a real result, and a normal word shows no chips.

---

## `not_found` diagnostics (a prerequisite for the above)

**Status:** investigated, not built.

Neither the website nor the extension currently tells you *how often* a
genuine dictionary miss happens, which is the number that would justify
picking "did you mean" back up:

- **Website:** the existing `word_not_found` GA4 event
  (`Pronounce_web/src/pages/Home.js`) doesn't mean what its name says - it
  fires on any non-2xx response (bad input, rate limits, TTS-budget
  exhaustion, 500s), never on a genuine miss, since a miss is an HTTP 200.
- **Extension:** `service-worker.js` already records `{found:false}` on a
  miss, but it lands in the local-only `chrome.storage.local` ring buffer
  (capped at 250 events), never aggregated anywhere you'd see it.
- **Best option found:** `api/index.js` (website backend) already has a
  live `/metrics` endpoint and a `securityMetrics` counter object tracking
  similar things the same way - a `dictionaryMisses` counter incremented
  wherever `fetchWordData` returns `null` would slot into that existing
  pattern for free. `quickpronounce_api` (extension + API customers) would
  need an equivalent small counter, using the Redis it already has for quota.
