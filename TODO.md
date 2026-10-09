# To do

Agreed work, not yet started. (Deferred or "maybe" ideas live in
plusversion.md instead.)

Nothing open right now.

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
