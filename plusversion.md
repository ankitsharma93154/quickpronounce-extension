# Plus / future-version ideas

Features that were designed (sometimes fully built and tested) and then
deliberately rolled back rather than shipped, because there's no signal yet
that they're worth the added complexity. Revisit if usage data or user
feedback makes the case. Unlike the "do NOT build until usage data" list in
README.md (things never started), everything here was working code at some
point - the design is proven, just not committed to.

Two entries below (marked "proposed") are the exception: nothing was built,
these are ideas from competitor research, kept here anyway since this is
the closest thing to a deferred-ideas list.

---

## Paid tier ("QuickPronounce Plus"): draft plan

**Status:** draft 2026-10-27, nothing built. Decided: (1) a higher
daily limit is a paid benefit, the free cap stays at 40 new words per
rolling 24h (src/core/cap.js); (2) Ankit prefers ONE Plus covering both
the website and the extension over an extension-only tier. Ad-free is a
familiar, accepted reason to pay (other sites and apps already sell it).

**Usage at the time of writing:** about 470 store users, 70 to 80 active
installs on weekdays, 30 to 40 on weekends, about 1 in 6 new installs
still active 7 days later. About 6% of a day's active installs hit the
cap, and it's mostly different people each day, so dozens of distinct
people hit it per month.

### What Plus would include: website (Pronounce_web)

The website already gives a lot away free (saved words in localStorage,
US/UK/AU/IN accents, the quiz path, the blog). Word pages and the blog
bring the ~100K monthly visitors from search, so nothing indexed goes
behind a paywall. Plus adds convenience, continuity and depth:
- Ad-free. The easiest thing to sell and cheap to give: at about $7 RPM
  one visitor's ads are worth cents a month.
- Saved words and quiz progress synced across devices and with the
  extension (today both live only in the browser; clearing it loses
  them). This is the shared core of the combined Plus.
- Practice built from your own saved / looked-up words (same feature as
  the extension's, built once).
- Longer sentence and paragraph audio, higher limits. Sentence and name
  audio drove the October TTS cost doubling, so this ties the benefit to
  real cost.
- MP3 downloads, word lists, printable sheets (teachers, IELTS tutors;
  possibly a later, higher teacher tier).
- Record yourself and compare against the reference audio, in the
  browser only, no AI scoring, no server cost.

Stays free forever: every word page, IPA, audio in all accents, the blog,
basic saved words on one device, the first quiz lessons. Don't paywall
later quiz lessons while lesson 1 -> 2 still loses ~70% of starters.

### What Plus would include: extension

Core (the reason to pay monthly, built as one loop: look up, keep,
practice):
- Higher or no daily limit.
- Saved words with full lookup history (today only the last 10 lookups
  are kept, locally).
- Practice on your own looked-up words: "you looked this up 3 days ago"
  reminders first, spaced repetition later. Speakerly's whole paid tier
  is this loop.

Add-ons, if the core sells:
- Extra accents (Indian, Australian, Canadian, Irish).
- Playback controls (slow, repeat).
- Export saved words to Anki / CSV.

Stays free (these win installs and ratings): the lookup card itself,
US and UK audio, IPA, respelling, "did you mean", color-coded vowels.

Not in Plus yet: microphone scoring / AI feedback (costly to build and
run, needs its own demand signal).

### Prerequisites (why this is not a small build)
- Accounts: saved words and paid status must survive a reinstall or a
  second browser, so Plus needs sign-in. That moves "accounts" off the
  README's do-not-build list.
- Payments: the Chrome Web Store no longer handles payments, so it's our
  own checkout (Razorpay, or a Stripe-based service such as ExtensionPay;
  check India eligibility first) plus a server-side entitlement check
  that the API enforces, not just the client cap.
- Pricing in two bands: an India price and a global price (website
  traffic is about 46% tier-1 countries; extension user geography not
  checked yet).
- One account and one entitlement shared by the website and the
  extension (sign in once, Plus works in both).

### How we find out if anyone wants it (in order, stop if a step fails)
1. Website first, it reaches far more people: a "Go ad-free + sync your
   saved words" waitlist link (near ads, on /saved, after a quiz
   lesson). In parallel, on the extension: one line on the cap message, "Need more?
   Join the list for QuickPronounce Plus", linking to a page on the
   website. Clicks and sign-ups show up in the standard GA4 events
   report; nothing new is collected inside the extension. Run 4 weeks.
2. Show a price on that page (India and global), still email only. Watch
   whether sign-ups hold once a number is visible.
3. Founding-member pre-sale to the list: a discounted first year, paid
   now, refunded if Plus doesn't ship. Real money is the only signal that
   settles it.

Draft go bar (revisit with real numbers): step 1 gets clicks from at
least 10% of the people who see the cap message and 25+ sign-ups; step
3 gets 10+ paid founding members. Below that, Plus waits and the effort
goes into installs instead.

### Realistic revenue (rough, for expectations only)
Freemium utilities usually convert about 1 to 3% of active users.
Assume a blended price of about $2.50/month across India and global.
- Today (roughly 200 monthly actives): 2 to 6 payers, about $5 to
  $15/month.
- At 1,500 monthly actives: 15 to 45 payers, about $40 to $110/month.
- At 10,000 monthly actives: 100 to 300 payers, about $250 to
  $750/month.
For comparison, website AdSense is about $1,500/month. An extension-only
Plus is small money for a long while; it only becomes meaningful at much
larger scale or as a combined website + extension Plus.

Website side: content sites typically convert about 0.1 to 0.3% of
monthly visitors. At ~100K/month that's roughly 100 to 300 subscribers,
about $250 to $750/month, on top of the extension figures above.
Meaningful next to AdSense, not a replacement for it.

---

## Color-coded vowel sounds on the card

**Status:** proposed 2026-09-28, not built. From looking at Blue Canoe
Pronunciation Dictionary (a competitor extension), which uses the
"Color Vowel System" - assigns each of English's 14 vowel sounds a color
plus a memorable two-word anchor phrase (e.g. "BLUE MOON", "GREEN TEA"), so
a word is remembered by its color/phrase instead of an IPA symbol.

**What it would be:** not their trademarked system or wording, just the
underlying idea - a consistent color tint per vowel phoneme, shown on the
stressed syllable in the card. The data this needs already exists:
`us_ipa`/`uk_ipa` and per-syllable `stress: 1`/`stress: 0` are already in
`data/*.json`. This would be a front-end-only change (a phoneme -> color
map plus a style tweak in `card.js`/`card.css.js`), no new data pipeline,
no backend work.

**Why it's here and not just done:** genuinely cheap, but still a design
decision (which colors, how prominent, does it clash with the existing
card styling) worth doing deliberately rather than bolting on.

## Bringing users back to their recent lookups

**Status:** proposed 2026-09-28, not built. Overlaps with the "spaced
repetition, flashcards, practice drills" line already in README.md's
"Do NOT build until MVP usage data comes in" list - recorded here for the
concrete shape it took, not to jump that list.

**From looking at Speakerly** (a competitor extension/app): its whole paid
tier is built around saving looked-up words and prompting spaced practice
on them. The extension already stores the last 10 lookups
(`store.js`/popup), but nothing ever resurfaces them to the user.

**The concrete idea:** something small and low-effort as a first version,
e.g. a popup line like "you looked this up 3 days ago, still remember it?"
on a previously-seen word. Ties directly to the D1/D7 retention now being
measured (see `quickpronounce_api/lib/usageSnapshot.js`) - this is a
plausible lever for exactly that number, which is why it's worth
remembering even while parked.

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
