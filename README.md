# QuickPronounce browser extension (MVP)

**QuickPronounce wherever you read.** Select a word on any page and get its
pronunciation: IPA, respelling, syllables with stress, US/UK audio, and a short
definition, in a small card. Chrome + Edge, Manifest V3, no build step.

This is the **free MVP**. There are deliberately no accounts, no sync, no
subscription, no microphone, and no pronunciation feedback. Its job is to
validate: do people install it, do they do a first lookup, do they keep using
it, do they hit the daily cap, and which words / accents show up.

---

## Load it in Chrome or Edge (developer mode)

1. `node scripts/generate-icons.js` (writes `icons/icon*.png` from
   `icons/source-logo.png` - the icons are already committed, so this is only
   needed after replacing the source logo).
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick this folder (`quickpronounce-extension/`).
5. Pin the toolbar icon. Open any article and select a word.

To set the keyboard shortcut: `chrome://extensions/shortcuts`.

Reload after code changes: the refresh icon on the card in `chrome://extensions`.

---

## Auth: no API key, an install id instead

The extension ships no credential at all. On first run it generates a random
UUID (`crypto.randomUUID()`, see `store.js` `getInstallId`) and sends it as
`X-Install-Id` on every request instead of `X-API-Key`. It identifies an
install, not a person - no account, no email, nothing else attached to it.

The API (`quickpronounce_api/lib/installQuota.js`) uses that id to give each
install its own daily quota, backed by Upstash Redis so it's enforced for
real (survives cold starts, shared across concurrent Vercel instances) rather
than being a client-side-only number anyone can clear. A request with no
valid `X-Install-Id` - an old build, or someone hitting the routes directly -
falls back to the API's existing coarser per-IP limit rather than being
rejected outright.

This replaced an earlier design (a shared, baked-in API key) that had two
real problems: it shipped a real credential in the client, and every install
drew from one shared server-side budget, so a modest number of honest users
could exhaust it for everyone at once with no way to tell who. The install-id
design fixes both without adding accounts or login.

---

## How it talks to the API

The brief referenced `/v1/dictionary/pronunciation`; that route does not
exist. The real surface is two endpoints under `/ext/v1` - the extension's
own backend, same data and response shape as the public `/v1` API
(`quickpronounce_api/openapi.yaml`) but gated by install id instead of an API
key, and intentionally not part of the documented public surface:

| When | Call | Used for |
|---|---|---|
| On every lookup | `GET /ext/v1/dictionary/:word` | definition, IPA, syllables - fills the card immediately |
| On pressing play | `GET /ext/v1/pronunciation/:word?accent=us\|uk` | one base64 MP3 for that accent, fetched lazily and cached |

Audio is never fetched until you press a play button, and each clip is fetched
at most once per session (the API docs ask callers to cache aggressively
because it synthesizes real WaveNet audio).

**Requires a deploy of `quickpronounce_api`** with the `/ext/v1/*` routes and
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` set before this works
against production - see that repo's changes.

---

## Project layout

```
manifest.json                 MV3. Permissions: contextMenus, storage, scripting, activeTab.
                              Host permission: api.quickpronounce.site only.
src/core/                     Shared modules, all classic scripts on a single `self.QP` object
  globals.js                  namespace bootstrap (loaded first everywhere)
  config.js                   THE place endpoints, limits, and URLs live
  util.js                     debounce, base64->bytes, small helpers
  normalize.js                selection text -> one clean word
  respell.js                  syllables + stress -> "pruh-NUN-see-AY-shun"
  store.js                    chrome.storage.local wrapper (settings, recents, cap, analytics, install id)
  cap.js                      rolling-24h "unique new words" ledger
  analytics.js                LOCAL-ONLY event ring buffer, behind an interface
  offlineData.js              ~20 commonly-mispronounced words, bundled
  offlineCache.js             read interface for the bundled pack (swappable later)
  audioCache.js               base64 -> Blob URL, per-document Map
  api.js                      the only module that calls the API (service worker only)
  suggest.js                  prefix-match search suggestions over the bundled wordlist (popup only)
src/data/
  wordlist.txt                 bundled copy of the website's wordlist (~250k words, ~2.3MB),
                              powers the popup's search suggestions with no network call and no
                              extra host permission. Kept in sync via scripts/sync-wordlist.js -
                              see "Keeping the bundled wordlist in sync" below.
src/background/
  service-worker.js           context menu, keyboard command, all fetches, cap, recents
src/content/
  card.css.js                 the card stylesheet, as a string (shared with the popup)
  card.js                     the pronunciation card renderer (vanilla DOM, no framework)
  content.js                  selection pill + Shadow DOM host + message bridge
src/popup/                    toolbar popup: manual search, recents, usage
src/options/                  settings page
icons/                        source-logo.png (the QuickPronounce mark from
                              Pronounce_web/src/images/Logo_icon.png) + the
                              generated icon{16,32,48,128}.png
scripts/                      generate-icons.js, check.js, selftest.js, package.js  (stdlib only, no deps)
store-listing/                name, descriptions, PRIVACY.md, screenshot guide
```

No framework, no bundler. Content scripts can't be ES modules, so every file
is a classic script that hangs its exports off `self.QP`. The service worker
pulls the same files in via `importScripts`; the popup/options pages via
`<script>` tags.

---

## Scripts

```
node scripts/generate-icons.js   # (re)write icons/icon*.png from icons/source-logo.png
node scripts/check.js            # node --check every .js + manifest sanity
node scripts/selftest.js         # normalize / respell / cap logic, no browser needed
node scripts/e2e.js              # loads the extension in Chromium, drives it against the real API
node scripts/package.js          # dist/quickpronounce-extension-<version>.zip for the stores
node scripts/sync-wordlist.js    # refresh src/data/wordlist.txt from the website's copy
```

---

## Keeping the bundled wordlist in sync

`src/data/wordlist.txt` is a plain copy of `Pronounce_web/public/wordlist.txt`,
bundled into the extension so the popup's search suggestions work instantly
offline instead of fetching ~2.3MB from the site on every popup open (a
popup's JS context is destroyed on close, so there's no in-memory session to
cache it in the way the website's SPA does). It is a **copy, not a link** -
there is no build step or CI job that keeps the two in sync automatically.

Whenever the website's wordlist is regenerated from a dataset refresh (see
`wiktionary_dump/`), run this from a checkout where `Pronounce_web` is a
sibling directory of this repo, then commit the result:

```
node scripts/sync-wordlist.js
```

If this step is skipped, the extension's suggestions just go stale (missing
newly-added words) - it fails quietly, not loudly, so it's worth folding into
whatever checklist accompanies a dataset refresh.

---

## Privacy stance (see store-listing/PRIVACY.md)

- Only the single selected word is sent to the API. Never page content, URL, or
  title.
- No browsing history, no cross-site tracking, no analytics libraries.
- Recent words, settings, and the local diagnostics counter live only in
  `chrome.storage.local`.
- Minimal permissions; no `tabs`, no `history`, no microphone.

---

## Known limitations (MVP)

- **Single words only.** A multi-word selection uses the first word and the
  card shows a "first word only" chip. No phrase or sentence pronunciation.
- **The featured transcription follows the accent setting.** Both US and UK
  audio buttons are always present, but the IPA/respelling/syllable lines show
  the preferred accent (the other IPA is shown smaller when it differs).
- **Offline pack is ~20 words.** It is a genuine fallback for network failure,
  not a real offline mode. `offlineCache.js` is the seam to grow it.
- **The daily cap is client-side and per-browser-profile.** Not a security
  boundary; a determined user can reset it. That is acceptable and intended.
- **Not-found and offline lookups still consume a cap slot** (they reached, or
  tried to reach, the service). One-line change in `service-worker.js` if you
  want otherwise.
- **Tabs open before install** need a reload, or a right-click / shortcut
  trigger (which re-injects via `activeTab`), before the selection pill works.
- **Firefox / Safari not targeted.** Code is `chrome.*` throughout but message
  passing and storage are the only surfaces; a `browser.*` shim + a
  `background.scripts` fallback is the porting path.
- **PDFs, `chrome://` pages, the Web Store, and some canvas-rendered editors**
  can't run content scripts. Nothing to do about it.

---

## Do NOT build until MVP usage data comes in

Hold all of these until the numbers justify them:

- accounts, login, synced vocabulary, saved words, full history
- any subscription / paywall / "Plus" tier
- microphone capture, pronunciation scoring, AI feedback
- spaced repetition, flashcards, practice drills
- Indian / Australian / Canadian / Irish accents
- auto-pronounce while reading, hover-to-hear, paragraph mode
- a large offline dictionary pack
- Firefox / Safari ports
- a real analytics backend (keep the local buffer until there's a privacy-
  reviewed sink and a reason)

The interfaces (`analytics.js`, `offlineCache.js`, `store.js`, `api.js`,
`config.js`) are shaped so these can be added later without a rewrite. That is
the only work owed to them now.

---

## Manual test checklist

Run through `docs/TESTING.md` after loading unpacked.
