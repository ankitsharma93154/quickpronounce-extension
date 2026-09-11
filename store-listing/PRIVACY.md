# QuickPronounce extension - Privacy policy

_Last updated: 2026-09-10_

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
- a small local diagnostics counter (e.g. "lookups: 12") with no word text and
  no identifiers, used only to understand feature usage during testing. You can
  clear it any time from the extension's settings page.

Clearing the extension's data, or removing the extension, deletes all of this.

## The API request

Requests to the QuickPronounce API include a shared extension access key so the
service can apply fair-use limits. The key is not tied to you and is the same
for every install.

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
