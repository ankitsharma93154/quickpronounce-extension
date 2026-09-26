# QuickPronounce extension - Privacy policy

_Last updated: 2026-09-26_

The QuickPronounce browser extension is built to do one job with the least
possible access to your data.

## What the extension sends off your device

**Only the single word you explicitly ask to pronounce.** When you click the
"Pronounce" button, use the right-click menu, use the keyboard shortcut, or
type a word into the popup, that one word (lowercased, punctuation trimmed) is
sent to the QuickPronounce API at `https://api.quickpronounce.site` to look up
its pronunciation and, if you press play, its audio.

Nothing else is sent. No surrounding sentence, no page URL, no page title, no
page content.

## What the extension does NOT do

- It does not read or collect the content of pages you visit.
- It does not record your browsing history or the list of sites you open.
- It does not track you across sites.
- It contains no third-party analytics, advertising, or tracking scripts.
- It does not use your microphone (it holds no microphone permission).
- It does not have permission to read your tabs or history.

## What is stored, and where

Stored locally in your browser only (`chrome.storage.local`), never uploaded:

- your settings (accent preference, whether the selection button is shown),
- your last 10 looked-up words and their pronunciation data,
- a local count of how many new words you have looked up in the last 24 hours,
- a randomly generated install id (see below),
- a small local diagnostics counter (e.g. "lookups: 12") with no word text and
  no identifiers, used only to understand feature usage during testing. You can
  clear it any time from the extension's settings page.

Clearing the extension's data, or removing the extension, deletes all of this.

## The API request

Every request to the QuickPronounce API includes a random install id: a UUID
generated once, on your device, the first time you use the extension. It is
sent so the service can give your install its own fair daily limit instead of
every install sharing one budget. It identifies an install, not you - it is
not tied to your name, email, account, or any other identifier, and no other
device or browser profile shares it.

To understand overall usage and how many installs come back, we keep daily
totals (how many installs were active and how many lookups were made) and a
shortened one-way hash of each active install ID. The hash is not used to
identify you and cannot feasibly be used to recover the original random
install ID. It is used only for usage and retention measurement. This data is
kept for up to 90 days and then deleted.

## Permissions and why

- **contextMenus** - to add the "Pronounce with QuickPronounce" right-click item.
- **storage** - to save your settings and recent words locally.
- **scripting** + **activeTab** - to show the pronunciation card on the current
  page when you trigger a lookup from the keyboard shortcut or right-click menu.
- **host access to `api.quickpronounce.site`** - to fetch pronunciation data.
- The content script runs on pages so it can detect your selection and draw the
  card; it does not send page data anywhere.

## Contact

Questions: hello@quickpronounce.site
