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

## API key

Both API endpoints need an `X-API-Key` header. It lives in one place:
[`src/core/config.js`](src/core/config.js) → `API_KEY`.

**Current value:** the shared `local-dev` key from
`quickpronounce_api/config/api-keys.json` (`dailyLimit` 1000). Good enough for
load-unpacked testing and the early MVP.

**Before any store submission:** swap it for a dedicated key.

1. Add an entry to `quickpronounce_api/config/api-keys.json` (see
   `config/api-keys.example.json`) named `quickpronounce-extension`, with a
   **deliberately low `dailyLimit`**.
2. Mirror the same `{ "keys": [...] }` JSON into the `API_KEYS_JSON` env var on
   the host.
3. Put that key in `config.js`.

A published extension cannot hide this key: treat it as low-trust and
rotatable. If it gets abused, change the string in `config.js` and ship an
update.

### API key hardening (post-MVP)

The right fix is a thin **unauthenticated proxy** on the QuickPronounce side:
an endpoint like `https://api.quickpronounce.site/ext/v1/...` that injects the
real key server-side and rate-limits per IP. When that exists, point
`API_BASE` at it and set `API_KEY` to `""` - no other code changes.

---

## How it talks to the API

The brief referenced `/v1/dictionary/pronunciation`; that route does not exist.
The real surface (`quickpronounce_api/openapi.yaml`) is two endpoints, and the
extension uses both:

| When | Call | Used for |
|---|---|---|
| On every lookup | `GET /v1/dictionary/:word` | definition, IPA, syllables - fills the card immediately |
| On pressing play | `GET /v1/pronunciation/:word?accent=us\|uk` | one base64 MP3 for that accent, fetched lazily and cached |

Audio is never fetched until you press a play button, and each clip is fetched
at most once per session (the API docs ask callers to cache aggressively
because it synthesizes real WaveNet audio).

---

## Project layout

```
manifest.json                 MV3. Permissions: contextMenus, storage, scripting, activeTab.
                              Host permission: api.quickpronounce.site only.
src/core/                     Shared modules, all classic scripts on a single `self.QP` object
  globals.js                  namespace bootstrap (loaded first everywhere)
  config.js                   THE place endpoints, the API key, limits, and URLs live
  util.js                     debounce, base64->bytes, small helpers
  normalize.js                selection text -> one clean word
  respell.js                  syllables + stress -> "pruh-NUN-see-AY-shun"
  store.js                    chrome.storage.local wrapper (settings, recents, cap, analytics)
  cap.js                      rolling-24h "unique new words" ledger
  analytics.js                LOCAL-ONLY event ring buffer, behind an interface
  offlineData.js              ~20 commonly-mispronounced words, bundled
  offlineCache.js             read interface for the bundled pack (swappable later)
  audioCache.js               base64 -> Blob URL, per-document Map
  api.js                      the only module that calls the API (service worker only)
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
node scripts/package.js          # dist/quickpronounce-extension-<version>.zip for the stores
```

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

- **API key ships in the client.** Low-trust and rotatable by design; the proxy
  is the fix (above).
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
