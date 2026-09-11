# Manual test checklist

Do this after **Load unpacked** and after setting a real `API_KEY` in
`src/core/config.js`. Without a key every lookup shows "Couldn't authorize
this lookup." (that itself is worth confirming once).

Automated first:

```
node scripts/check.js      # syntax + manifest
node scripts/selftest.js   # normalize / respell / cap logic
node scripts/e2e.js        # loads the extension in Chromium, drives the real
                           # paths end to end (needs puppeteer from
                           # ../Pronounce_web/node_modules)
```

`e2e.js` covers: service worker boot, dictionary + audio calls to the live
API, normalize, not-found, session cache, the daily cap (blocks new words at
40, still serves known ones), recents, the on-page selection pill + Shadow DOM
card, the popup search + recents + usage line, the options page, and the
privacy property (only `GET /v1/dictionary|pronunciation/<word>` leaves, no
page content). It does NOT judge: visual polish, real audio playback quality,
how the card looks on specific dark sites, or selector robustness across many
real sites. Do those by hand below.

## Pages to try (at least 3 kinds)

- A long article: Wikipedia (e.g. /wiki/Serendipity).
- A dense app UI: GitHub, Gmail, or a docs site.
- A dark-themed page: any site in dark mode, or GitHub with dark theme.

## Selection flow

1. Select a single word ("pronunciation"). The purple **Pronounce** pill
   appears near the selection.
2. Click it. A loading card appears, then fills with: word, IPA (with a US or
   UK tag), respelling, syllables with the stressed one in purple, a
   definition, **US** and **UK** buttons, "View full definition".
3. Press **US**. Button shows a spinner, then turns solid purple while it
   plays, then resets. Press it again: replays instantly (no spinner).
4. Press **UK**. Plays the UK clip. The US button resets.
5. Click outside the card, or press **Esc** - it dismisses. Scroll - it
   dismisses.
6. Select `"running,"` (with quotes and comma). Card headword is `running`.
7. Select two words. Card shows a "first word only" chip and uses the first
   word.
8. Select whitespace / a number. Pill does not appear (or context menu shows
   the "Select a single word" message).

## Context menu

9. Select a word, right-click, **Pronounce with QuickPronounce**. Card appears
   near the selection.
10. Open a tab that was already open before you installed the extension.
    Right-click a selection -> it still works (re-injects via activeTab).

## Keyboard shortcut

11. Set one at `chrome://extensions/shortcuts` (e.g. Alt+P).
12. Select a word, press the shortcut. Card appears.

## Popup

13. Click the toolbar icon. Type `colonel`, press Enter. Result card renders
    in the popup. Audio buttons work.
14. The word now shows under **Recent**. Close and reopen the popup - still
    there. Click it - re-opens the result.
15. "Today: N / 40 words" shows and increments only for new words.

## Daily cap

16. In `src/core/config.js` set `DAILY_UNIQUE_WORD_LIMIT: 3`, reload the
    extension. Look up 3 new words, then a 4th -> "You've reached today's
    lookup limit." Look up one of the first 3 again -> it still works.
17. Restore the limit to 40, reload.

## Failure handling

18. Open DevTools -> Network -> offline (or block `api.quickpronounce.site`).
    Look up `schedule` -> comes back with an **offline copy** chip (bundled).
    Look up `serendipity` -> "Couldn't reach QuickPronounce" with **Try again**.
19. Temporarily break `API_KEY` -> "Couldn't authorize this lookup."
20. Look up a nonsense string like `asdfghjk` -> "We couldn't find a full
    entry for this word." with a QuickPronounce link.

## Dark pages

21. On a dark page, the card is a solid light-or-dark panel (follows your OS
    theme), never transparent, text readable, purple accents visible.

## Persistence

22. Reload the extension from `chrome://extensions`. Recent words and settings
    survive. Look up a word, restart the browser, reopen the popup - recent
    words still there.

## Settings

23. Options page: toggle **Show the "Pronounce" button** off -> pill no longer
    appears on selection (context menu + shortcut still work).
24. Switch preference to **UK** -> the card now features UK IPA/respelling.
25. **Clear recent words**, **Reset local usage count**, **Diagnostics ->
    Copy / Clear** all work.

## Privacy sanity

26. DevTools -> Network, filter to `quickpronounce`. Confirm the only
    outgoing requests are `GET /v1/dictionary/<word>` and (on play)
    `GET /v1/pronunciation/<word>` - one word each, no page URL, no page text.
