# To do

Agreed work, not yet started. (Deferred or "maybe" ideas live in
plusversion.md instead.)

## Keep test installs out of the usage data

**Status:** built 2026-11-06, not deployed. The extension half ships with
v1.0.5 (unpacked copies get a `test-` id); the API half needs its push. Until
that push, run scripts/e2e.js only against a local API, not the live one.

**Why:** on 2026-10-09 the v1.0.4 browser test runs each launched a fresh
Chrome profile, so each got a new random install id and hit the live API.
That created 19 fake "new installs" in prod Redis (`ext:day:*`), which had to
be deleted by hand before the nightly usage snapshot recorded them.

**Plan (two halves):**
- Extension: in store.js getInstallId, if the manifest has no `update_url`
  (true for every unpacked copy, i.e. test browsers and manual "Load
  unpacked"; store installs always have it), generate the id as
  `test-<uuid>`. Store users are unaffected. The API's install-id check
  (`/^[a-z0-9-]{20,64}$/i`) already accepts that shape.
- quickpronounce_api: in lib/usageSnapshot.js readExtDays, skip install ids
  starting with `test-`, so they never enter usage history, cohorts or
  totals. Pushing it deploys the API.
- Until both are live: don't run live-API browser tests, or count the test
  installs they create and remove them before 6:30 AM IST (cron window).

## Publish on Edge Add-ons

**Status:** agreed 2026-10-26, Ankit doing it asap. Not started.

**Why:** the extension already runs on Edge (MV3, no Chrome-only APIs per
README), but it is only listed on the Chrome Web Store. Edge Add-ons is a
second store with its own search, at almost no build cost. New installs are
the current bottleneck (about 13 a day against roughly 3,300 daily website
visitors), not retention.

**Steps:**
- Register in Microsoft Partner Center (Edge program, no fee) and submit the
  same zip as the current Chrome version. Reuse store-listing/ copy, the
  1280x800 screenshots and the privacy policy URL.
- Rate prompt: config REVIEWS_URL links to the Chrome Web Store reviews page, which
  is the wrong store for Edge installs. Point Edge installs to the Edge
  listing's reviews (needs the Edge listing id, so after approval).
- Website: the promo CTAs link to the Chrome Web Store. Once approved,
  consider sending Edge browsers to the Edge listing.
- Usage data: Edge installs share the same API and install-id scheme, so they
  show up in the daily snapshots with no change. Store installs have an
  `update_url`, so the planned `test-` id rule above still holds.

---

# Done

## In-extension rating prompt for engaged users

**Status:** built 2026-10-09 in v1.0.4 (src/core/ratePrompt.js). Agreed
2026-10-05.

**Why:** the store SEO recheck on 2026-10-05 (v1.0.3, 170 users, 0 ratings)
showed the keyword name/summary worked: rank 9 for "how to pronounce" and
rank 10 for "pronounce", both absent before. Still not in the top 10 for
"pronunciation", "IPA" or "pronunciation dictionary". Every listing that
outranks us has ratings, so ratings are now the main lever, not more copy.

**What shipped (the decisions behind the open questions):**
- Who: installed 7+ days, successful lookups on 4+ distinct days, 25+
  successful lookups in total (config RATE_PROMPT). About 42 installs met
  this on 2026-10-09.
- Existing installs are seeded once from the local analytics buffer on
  update; a full buffer (250 events) counts as meeting the active-days rule,
  since it only covers a heavy user's last few days.
- Where: a short paragraph above the on-page card's footer, only after a
  successful lookup. Never in the popup (popup lookups still count).
- Copy, first showing: "Finding QuickPronounce useful? A quick rating helps
  other learners find it." then "Rate it" and "Not now".
- Copy, second showing (7 days later): "Still finding it useful? A rating
  takes a few seconds." then "Rate it" and "No thanks".
- At most two showings ever. "Rate it" and "No thanks" end it for good;
  "Not now" leaves the one re-ask. Answering in one tab removes it from any
  other tab's open card.
- Style: "Rate it" is a soft tinted pill with a thin outline (no icon, no
  solid fill, so it never competes with the Play buttons); "Not now" / "No
  thanks" are plain grey. No underlines. After an answer the box shrinks to
  a one-line acknowledgement.
- Timing: no time gate. Engaged users are mostly active in the golden hour
  (6 PM to 12 AM IST; 62% of 2026-10-05's active installs started then), so
  it lands there naturally.
- Measurement: local-only events rate_prompt_shown / rate_prompt_action (they
  never leave the device). The real signal is the store's rating count.
- Store reviews URL:
  https://chromewebstore.google.com/detail/kndljjhkhmmgpleahjpkpopafinkkajk/reviews
