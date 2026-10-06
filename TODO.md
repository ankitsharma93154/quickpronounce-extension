# To do

Agreed work, not yet started. (Deferred or "maybe" ideas live in
plusversion.md instead.)

---

## In-extension rating prompt for engaged users

**Status:** agreed 2026-10-05, not started.

**Why:** the store SEO recheck on 2026-10-05 (v1.0.3, 170 users, 0 ratings)
showed the keyword name/summary worked: rank 9 for "how to pronounce" and
rank 10 for "pronounce", both absent before. Still not in the top 10 for
"pronunciation", "IPA" or "pronunciation dictionary". Every listing that
outranks us has ratings, so ratings are now the main lever, not more copy.

**Idea:** a polite, dismissible "enjoying it? rate us" prompt that links to
the Chrome Web Store reviews page, shown only to engaged users. Usage data
shows a core of returning regulars while most newer installs go quiet after
a day or two, so target the regulars: they're the most likely to rate well.

**Open questions to settle before building:**
- Trigger threshold: N lookups across M distinct days (pick from usage data).
- Where it shows: popup vs the on-page card (card is more visible, popup is
  less intrusive).
- Ask once, with a "later" that re-asks once at most, and never again after
  "no" or after a click through to the store.
- Timing: the "golden hour" is 6 PM to 12 AM IST. On 2026-10-05, 62% of
  that day's active installs first used the extension in that window
  (peaks 7 to 9 PM and 10 to 11 PM IST). Consider showing the prompt then.
- Event names for tracking shown / clicked / dismissed.
- Store reviews URL:
  https://chromewebstore.google.com/detail/kndljjhkhmmgpleahjpkpopafinkkajk/reviews
