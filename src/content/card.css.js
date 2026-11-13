/*
 * The pronunciation card's stylesheet, as a string. Used two ways:
 *   - content script: injected into a Shadow DOM root, isolated from page CSS.
 *   - popup: injected into a <style> tag in the popup document.
 *
 * Everything scoped under .qp-card / .qp-toast / .qp-pill. Tokens and values
 * are lifted straight from Pronounce_web/src/index.css so the extension reads
 * as part of QuickPronounce: the same #4a6cf7->#6e45e2 primary gradient, the
 * same --primary-hover (#3a5ce7), the --shadow-primary-* glow, the --radius-*
 * scale, the syllable stress colours, and the body.dark palette. The card
 * follows the OS colour scheme (it can't see the site's .dark class on an
 * arbitrary page).
 */
(function () {
  var QP = (self.QP = self.QP || {});

  var FONT =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,'Open Sans','Helvetica Neue',sans-serif";

  // Every token the dark palette changes, and its light value, so a theme chosen
  // in Settings can override the OS in either direction.
  var DARK_TOKENS =
    "--btn-primary-bg:var(--primary-gradient-hover);--link:#a78bfa;--text-primary:#f8fafc;" +
    "--text-secondary:#cbd5e1;--bg-primary:#1e293b;--bg-secondary:#334155;--border-color:#475569;" +
    "--status-error:#f87171;--shadow-card:0 14px 34px rgba(0,0,0,0.55), 0 4px 14px rgba(0,0,0,0.4);" +
    "--tint-purple:rgba(167,139,250,0.10);--beat-weak:rgba(167,139,250,0.32);--beat-mid:rgba(167,139,250,0.6);" +
    "--amber-gradient:linear-gradient(135deg,#3a2c12 0%,#4d3814 100%);--amber-border:#5c431c;--amber-text:#e2a83f;" +
    "--scroll-thumb:rgba(203,213,225,0.28);--scroll-thumb-hover:rgba(203,213,225,0.5);";
  var LIGHT_TOKENS =
    "--btn-primary-bg:var(--primary-gradient);--link:var(--primary);--text-primary:#1e293b;" +
    "--text-secondary:#64748b;--bg-primary:#ffffff;--bg-secondary:#f8fafc;--border-color:#e2e8f0;" +
    "--status-error:#ef4444;--shadow-card:0 12px 28px rgba(110,69,226,0.20), 0 8px 24px rgba(15,23,42,0.12);" +
    "--tint-purple:rgba(110,69,226,0.06);--beat-weak:rgba(110,69,226,0.2);--beat-mid:rgba(110,69,226,0.5);" +
    "--amber-gradient:linear-gradient(135deg,#fdf1dd 0%,#fadfa4 100%);--amber-border:#f6ddab;--amber-text:#a15c07;" +
    "--scroll-thumb:rgba(100,116,139,0.30);--scroll-thumb-hover:rgba(100,116,139,0.55);";

  QP.cardCss = [
    /* ---- tokens (mirror Pronounce_web). Declared on the rendered root
       elements themselves so they work in a shadow root and in the popup
       document alike; descendants inherit. ---- */
    ".qp-card, .qp-toast, .qp-pill, .qp-rchips {",
    "  --primary:#6e45e2;",
    "  --primary-rgb:110,69,226;",
    "  --primary-hover:#3a5ce7;",
    "  --primary-gradient:linear-gradient(135deg,#4a6cf7 0%,#6e45e2 100%);",
    "  --primary-gradient-hover:linear-gradient(135deg,#3a5ce7 0%,#5e35d2 100%);",
    "  --btn-primary-bg:var(--primary-gradient);",
    "  --link:var(--primary);",
    "  --text-primary:#1e293b;",
    "  --text-secondary:#64748b;",
    "  --bg-primary:#ffffff;",
    "  --bg-secondary:#f8fafc;",
    "  --border-color:#e2e8f0;",
    "  --border-primary-soft:rgba(110,69,226,0.15);",
    "  --status-error:#ef4444;",
    "  --shadow-primary-sm:0 4px 10px rgba(110,69,226,0.15);",
    "  --shadow-primary-md:0 8px 18px rgba(110,69,226,0.18);",
    "  --shadow-primary-lg:0 12px 28px rgba(110,69,226,0.22);",
    "  --shadow-card:0 12px 28px rgba(110,69,226,0.20), 0 8px 24px rgba(15,23,42,0.12);",
    "  --tint-purple:rgba(110,69,226,0.06);",
    "  --beat-weak:rgba(110,69,226,0.2);",
    "  --beat-mid:rgba(110,69,226,0.5);",
    "  --amber-gradient:linear-gradient(135deg,#fdf1dd 0%,#fadfa4 100%);",
    "  --amber-border:#f6ddab;",
    "  --amber-text:#a15c07;",
    "  --scroll-thumb:rgba(100,116,139,0.30);",
    "  --scroll-thumb-hover:rgba(100,116,139,0.55);",
    "  --radius-sm:0.375rem;",
    "  --radius-md:0.5rem;",
    "  --radius-lg:0.875rem;",
    "  --radius-pill:999px;",
    "  --transition:250ms;",
    "  font-family:" + FONT + ";",
    "  color:var(--text-primary);",
    "  line-height:1.5;",
    "  text-align:left;",
    "}",
    "@media (prefers-color-scheme: dark) {",
    "  .qp-card, .qp-toast, .qp-pill, .qp-rchips {" + DARK_TOKENS + "}",
    "}",
    /* the choice from Settings beats the OS: two classes outrank the one above */
    "[data-qp-theme='dark'] .qp-card, [data-qp-theme='dark'] .qp-toast, [data-qp-theme='dark'] .qp-pill, [data-qp-theme='dark'] .qp-rchips {" + DARK_TOKENS + "}",
    "[data-qp-theme='light'] .qp-card, [data-qp-theme='light'] .qp-toast, [data-qp-theme='light'] .qp-pill, [data-qp-theme='light'] .qp-rchips {" + LIGHT_TOKENS + "}",

    ".qp-card * , .qp-toast * { box-sizing:border-box; }",
    ".qp-card button { font-family:inherit; }",

    /* ---- card shell ---- */
    ".qp-card {",
    "  width:340px; max-width:calc(100vw - 24px);",
    "  background:var(--bg-primary);",
    "  border:1px solid var(--border-color);",
    "  border-radius:var(--radius-lg);",
    "  box-shadow:var(--shadow-card);",
    "  overflow:hidden;",
    "  font-size:14px;",
    "  animation:qp-card-in 0.18s ease-out;",
    "}",
    "@keyframes qp-card-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }",
    ".qp-card__bar { height:3px; background:var(--primary-gradient); }",
    ".qp-card__body { padding:12px 14px 6px; }",

    /* ---- roomy variant: the on-page card only (ctx.compact is false there).
       The popup keeps the tight defaults above so Recent stays in view
       without scrolling. ---- */
    ".qp-card--roomy { width:360px; }",
    ".qp-card--roomy .qp-card__body { padding:18px 20px 12px; }",
    ".qp-card--roomy .qp-hero { padding:20px 48px 18px 20px; }",
    ".qp-card--roomy .qp-hero__word { font-size:21px; }",
    ".qp-card--roomy .qp-chips { margin-top:11px; }",
    ".qp-card--roomy .qp-label { margin-top:13px; }",
    ".qp-card--roomy .qp-meaning-head { margin-top:13px; }",
    ".qp-card--roomy .qp-pron { margin-top:9px; }",
    ".qp-card--roomy .qp-pron-row { padding:8px 10px 8px 14px; }",
    ".qp-card--roomy .qp-stress { margin-top:10px; padding:10px 14px 9px; }",
    ".qp-card--roomy .qp-readings { margin-top:9px; }",
    ".qp-card--roomy .qp-pron-head { margin-top:13px; }",
    ".qp-card--roomy .qp-audio { margin-top:14px; gap:10px; }",
    ".qp-card--roomy .qp-play { min-height:46px; padding:10px 14px; }",
    ".qp-card--roomy .qp-meaning { margin-top:9px; padding:11px 14px; }",
    ".qp-card--roomy .qp-foot { padding:11px 20px 14px; margin-top:10px; }",

    /* loading skeleton only - the "ok" result uses .qp-hero instead */
    ".qp-card__head { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }",
    ".qp-word { font-size:17px; font-weight:700; letter-spacing:-0.01em; color:var(--text-primary); word-break:break-word; }",

    /* ---- hero header: word, part of speech, close ---- */
    ".qp-hero { position:relative; overflow:hidden; background:var(--btn-primary-bg); background-color:var(--primary); padding:13px 42px 11px 14px; }",
    ".qp-hero::before, .qp-hero::after {",
    "  content:''; position:absolute; border-radius:50%; pointer-events:none;",
    "  border:1px solid rgba(255,255,255,0.22);",
    "}",
    ".qp-hero::before { width:120px; height:120px; top:-46px; right:-26px; }",
    ".qp-hero::after { width:190px; height:190px; top:-86px; right:-66px; border-color:rgba(255,255,255,0.13); }",
    /* the word+pos block, linked out to the full entry - same destination as
       "View full definition" below, so there are two ways to reach it */
    ".qp-hero__link { position:relative; z-index:1; display:block; text-decoration:none; color:inherit; border-radius:var(--radius-sm); }",
    ".qp-hero__word {",
    "  font-size:19px; font-weight:800; letter-spacing:-0.01em;",
    "  color:#fff; line-height:1.2; word-break:break-word;",
    "}",
    ".qp-hero__close {",
    "  position:absolute; z-index:2; top:14px; right:14px; width:26px; height:26px;",
    "  display:inline-flex; align-items:center; justify-content:center; border-radius:50%;",
    "  border:0; background:rgba(255,255,255,0.22); color:#fff; font-size:15px; line-height:1; cursor:pointer;",
    "  transition:background-color var(--transition), transform 0.15s ease;",
    "}",
    ".qp-hero__close:hover { background:rgba(255,255,255,0.34); transform:rotate(90deg); }",
    ".qp-hero__close:active { transform:rotate(90deg) scale(0.88); }",
    /* shared white focus ring for anything sitting on the purple hero - the
       usual purple .qp-focusable ring would be invisible against it */
    ".qp-focusable-light:focus-visible { outline:2px solid #fff; outline-offset:2px; }",

    ".qp-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }",
    ".qp-chip, .qp-chip--muted {",
    "  font-size:11px; font-weight:600; padding:2px 8px; border-radius:var(--radius-pill);",
    "  background:var(--bg-secondary); color:var(--text-secondary);",
    "  border:1px solid var(--border-color);",
    "}",

    ".qp-label {",
    "  font-size:0.72rem; font-weight:600; text-transform:uppercase; letter-spacing:0.06em;",
    "  color:var(--text-secondary); margin-top:9px;",
    "}",
    /* legacy class name on the Meaning label; deliberately neutral now */
    ".qp-label--amber { color:var(--text-secondary); }",
    ".qp-meaning-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px 10px; margin-top:9px; }",
    ".qp-meaning-head .qp-label { margin-top:0; }",
    ".qp-meaning-head .qp-senses { margin-top:0; }",

    /* ---- heteronyms: one tab per pronunciation, labelled by its respelling.
       Case is meaningful in the labels (rih-KAWRD), so no text-transform. ---- */
    ".qp-readings { display:flex; flex-wrap:wrap; gap:6px; margin-top:7px; }",
    ".qp-reading {",
    "  font-size:13px; font-weight:600; padding:4px 12px; cursor:pointer;",
    "  border-radius:var(--radius-pill); border:1px solid var(--border-color);",
    "  background:var(--bg-primary); color:var(--text-secondary);",
    "  transition:background-color .2s ease, color .2s ease, border-color .2s ease;",
    "}",
    ".qp-reading:hover { border-color:var(--primary); color:var(--link); }",
    ".qp-reading.qp-reading--active {",
    "  background:var(--btn-primary-bg); background-color:var(--primary);",
    "  border-color:transparent; color:#fff; font-weight:700;",
    "}",

    /* ---- stress bars: one per syllable, taller means stronger. They wrap
       rather than shrink, so a long word never loses a syllable's text. ---- */
    ".qp-stress {",
    "  display:flex; flex-wrap:wrap; align-items:flex-end; gap:6px 5px;",
    "  margin-top:7px; padding:9px 12px 7px;",
    "  background:var(--tint-purple); border-radius:var(--radius-md);",
    "}",
    ".qp-beat { flex:1 1 auto; min-width:30px; text-align:center; }",
    ".qp-beat__bar { border-radius:4px; background:var(--beat-weak); height:7px; }",
    ".qp-beat--2 .qp-beat__bar { background:var(--beat-mid); height:15px; }",
    ".qp-beat--1 .qp-beat__bar { background:var(--btn-primary-bg); background-color:var(--primary); height:24px; }",
    ".qp-beat__text { margin-top:4px; font-size:13px; line-height:1.25; color:var(--text-secondary); white-space:nowrap; }",
    ".qp-beat--2 .qp-beat__text { color:var(--text-primary); font-weight:500; }",
    ".qp-beat--1 .qp-beat__text { color:var(--link); font-weight:700; }",

    /* ---- both accents, always: IPA, then that accent's play button ---- */
    /* a two-way switch of separate cards. The unselected one is a quiet grey
       fill with no visible border; the selected one is tinted with a brand
       border. Every row always has a 1px border (transparent when quiet), so
       selecting only recolours it and never shifts the layout. */
    ".qp-pron { margin-top:7px; display:flex; flex-direction:column; gap:4px; }",
    ".qp-pron-row {",
    "  display:flex; align-items:center; gap:10px; padding:6px 8px 6px 12px;",
    "  border:1px solid transparent; border-radius:var(--radius-md); background:var(--bg-secondary);",
    "  transition:background-color .2s ease, border-color .2s ease, box-shadow .2s ease, transform .12s ease;",
    "}",
    ".qp-pron-row--tappable { cursor:pointer; }",
    ".qp-pron-row--tappable:hover { border-color:rgba(var(--primary-rgb),0.25); }",
    /* pressed: the row is a button, so it gives a little on press */
    ".qp-pron-row--tappable:active { transform:scale(0.985); }",
    ".qp-pron-row.qp-pron-row--selected {",
    "  background:rgba(var(--primary-rgb),0.10);",
    "  border-color:rgba(var(--primary-rgb),0.45);",
    "}",
    ".qp-pron-row.qp-pron-row--selected.qp-pron-row--tappable:hover { border-color:rgba(var(--primary-rgb),0.65); }",
    /* while this row's clip plays, the whole row glows, not just the icon */
    ".qp-pron-row.qp-pron-row--selected:has(.qp-play--playing) {",
    "  background:rgba(var(--primary-rgb),0.14);",
    "  border-color:rgba(var(--primary-rgb),0.65);",
    "  box-shadow:0 0 0 3px rgba(var(--primary-rgb),0.15);",
    "}",
    ".qp-pron-row__accent {",
    "  flex:0 0 auto; width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center;",
    /* bg-primary, not bg-secondary: the quiet row is already bg-secondary */
    "  border-radius:50%; border:1px solid var(--border-color); background:var(--bg-primary);",
    "  font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase;",
    "  transition:background-color .2s ease, color .2s ease, border-color .2s ease;",
    "}",
    ".qp-pron-row--selected .qp-pron-row__accent { border-color:transparent; background:var(--btn-primary-bg); background-color:var(--primary); color:#fff; }",
    ".qp-pron-row__main { flex:1 1 auto; min-width:0; display:flex; flex-wrap:wrap; align-items:center; gap:3px 8px; }",
    ".qp-pron-row__ipa {",
    "  font-family:'SFMono-Regular',ui-monospace,Menlo,Consolas,monospace;",
    "  font-size:15px; font-weight:600; line-height:1.35; letter-spacing:0.01em;",
    "  color:var(--text-primary); word-break:break-word;",
    "}",
    ".qp-pron-row__none { font-size:12px; color:var(--text-secondary); }",

    ".qp-note { margin:8px 0 8px; padding:8px 12px; border-radius:var(--radius-md); background:var(--tint-purple); font-size:13px; line-height:1.45; color:var(--text-primary); }",

    /* ---- speed ---- */
    ".qp-pron-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:4px 10px; margin-top:9px; }",
    ".qp-pron-head .qp-label { margin-top:0; }",
    ".qp-speed { display:inline-flex; gap:2px; padding:2px; border-radius:var(--radius-pill); background:var(--tint-purple); }",
    ".qp-speed__opt {",
    "  border:0; background:transparent; cursor:pointer; padding:2px 9px; font-size:11px; font-weight:600;",
    "  border-radius:var(--radius-pill); color:var(--text-secondary); font-variant-numeric:tabular-nums;",
    "  transition:background-color .2s ease, color .2s ease;",
    "}",
    ".qp-speed__opt:hover { color:var(--link); }",
    ".qp-speed__opt.qp-speed__opt--active { background:var(--bg-primary); color:var(--link); font-weight:700; box-shadow:0 1px 2px rgba(15,23,42,0.15); }",

    /* ---- meaning callout: supporting context, so a neutral surface rather
       than an accent - pronunciation and the play buttons carry the colour.
       padding/border/background live on .qp-meaning; the 3-line clamp lives
       on .qp-meaning__text alone - Chromium lets a stray 4th line escape the
       clamp boundary when -webkit-line-clamp and padding sit on the same
       element, so they're deliberately kept on separate elements. ---- */
    ".qp-meaning {",
    "  margin-top:6px; padding:8px 12px; background:var(--bg-secondary); border:1px solid var(--border-color);",
    "  border-radius:var(--radius-md); font-size:13px; color:var(--text-primary);",
    "  transition:opacity 0.15s ease;",
    "}",
    ".qp-meaning__text {",
    "  display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;",
    "}",
    /* several definitions: numbered, 2 lines each, list scrolls inside the
       same 3-line height a single definition occupies (line-height is 1.5),
       so the card is never taller than it was before */
    ".qp-def { display:flex; gap:6px; }",
    ".qp-def + .qp-def { margin-top:7px; }",
    ".qp-def__n { flex:none; color:var(--text-secondary); font-weight:600; }",
    ".qp-def .qp-meaning__text { flex:1; min-width:0; }",
    ".qp-defs--multi { max-height:calc(3 * 1.5em); overflow-y:auto; padding-right:6px; }",
    /* slim, low-contrast scrollbar with no arrow buttons: present enough to
       find, quiet until the cursor is over the list. The half-clipped second
       definition is the main cue that there is more. Uses the
       ::-webkit-scrollbar family because a standard scrollbar-width/-color
       would override it. */
    ".qp-defs--multi::-webkit-scrollbar { width:5px; }",
    ".qp-defs--multi::-webkit-scrollbar-track { background:transparent; }",
    ".qp-defs--multi::-webkit-scrollbar-thumb { background:var(--scroll-thumb); border-radius:5px; }",
    ".qp-defs--multi:hover::-webkit-scrollbar-thumb { background:var(--scroll-thumb-hover); }",
    ".qp-defs--multi::-webkit-scrollbar-button { display:none; }",
    ".qp-defs--multi .qp-meaning__text { -webkit-line-clamp:2; }",
    ".qp-meaning--fading { opacity:0; }",

    /* part-of-speech tabs: which sense of an ambiguous word is showing */
    ".qp-senses { display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; }",
    ".qp-sense {",
    "  font-size:11px; font-weight:600; text-transform:capitalize; padding:4px 11px;",
    "  border-radius:var(--radius-pill); border:1px solid var(--border-color);",
    "  background:var(--bg-primary); color:var(--text-secondary); cursor:pointer;",
    "  transition:background-color .2s ease, color .2s ease, border-color .2s ease;",
    "}",
    /* --link, not --primary: same purple in light mode, but a lighter violet
       in dark, where #6e45e2 text on the dark card is only ~3:1 */
    ".qp-sense:hover { border-color:var(--link); color:var(--link); }",
    ".qp-sense--only { cursor:default; }",
    ".qp-sense--active {",
    "  background:var(--border-primary-soft); border-color:var(--link);",
    "  color:var(--link); font-weight:700;",
    "}",

    /* ---- audio buttons: model on .cta-button ---- */
    ".qp-audio { display:flex; gap:8px; margin-top:10px; }",
    ".qp-other { margin-top:6px; }",
    ".qp-other__toggle { border:0; background:transparent; padding:0; cursor:pointer; font-size:12px; font-weight:600; color:var(--text-secondary); }",
    ".qp-other__toggle:hover { color:var(--link); }",
    ".qp-other__toggle::after {",
    "  content:''; display:inline-block; width:5px; height:5px; margin-left:6px; vertical-align:2px;",
    "  border-right:1.5px solid currentColor; border-bottom:1.5px solid currentColor; transform:rotate(45deg);",
    "}",
    ".qp-other__toggle[aria-expanded='true']::after { transform:rotate(-135deg); vertical-align:-1px; }",
    ".qp-other__list { margin-top:4px; max-height:96px; overflow-y:auto; font-size:12px; color:var(--text-primary); }",
    ".qp-other__list[hidden] { display:none; }",
    ".qp-other__pos { margin-top:4px; font-size:11px; font-weight:600; text-transform:capitalize; color:var(--text-secondary); }",
    ".qp-placeholder { margin-top:6px; font-size:13px; color:var(--text-secondary); }",
    ".qp-play {",
    "  flex:1 1 0; display:inline-flex; align-items:center; justify-content:center; gap:7px;",
    "  min-height:43px; padding:9px 12px; font-size:14px; font-weight:700; cursor:pointer;",
    /* the primary action: solid brand gradient at rest, like the hero. The
       playing state is told apart by a ring (below), not by the fill. */
    "  border:1px solid transparent; border-radius:var(--radius-md);",
    "  background:var(--btn-primary-bg); background-color:var(--primary); color:#fff;",
    "  box-shadow:var(--shadow-primary-sm);",
    "  transition:transform .2s ease, box-shadow .2s ease, background-color .2s ease, color .2s ease, border-color .2s ease;",
    "}",
    ".qp-play:hover { box-shadow:var(--shadow-primary-md); transform:translateY(-1px); }",
    ".qp-play:disabled { opacity:0.6; cursor:default; transform:none; }",
    /* round, icon-only, inside an accent row */
    ".qp-card .qp-play.qp-play--icon { flex:0 0 auto; width:34px; height:34px; min-height:0; padding:0; border-radius:50%; }",
    /* the other accent: still a play button, but the reader's own leads */
    ".qp-play.qp-play--soft { background:var(--border-primary-soft); color:var(--link); box-shadow:none; }",
    /* inside the accent switch, the unselected row's button is the soft one.
       Playing/error/disabled keep their own look (the :nots), since this
       selector outranks them. */
    ".qp-pron-row:not(.qp-pron-row--selected) .qp-play.qp-play--icon:not(.qp-play--playing):not(.qp-play--error):not(:disabled) { background:var(--border-primary-soft); color:var(--link); box-shadow:none; }",
    ".qp-card .qp-play.qp-play--icon:disabled { background:var(--bg-secondary); color:var(--text-secondary); box-shadow:none; opacity:0.75; }",
    /* Compound selectors (.qp-play.qp-play--X), not bare .qp-play--X: a bare
       single class has the same specificity as .qp-play:hover above, and
       loses the fill when the cursor is still sitting on the button right
       after a click - which it always is - leaving white text on a
       near-white background. Compounding wins outright, hovered or not. */
    ".qp-play.qp-play--playing {",
    "  background:var(--btn-primary-bg); background-color:var(--primary);",
    "  border-color:transparent; color:#fff;",
    "  box-shadow:0 0 0 3px rgba(var(--primary-rgb),0.28), var(--shadow-primary-sm);",
    "}",
    ".qp-play.qp-play--playing:hover {",
    "  background-color:var(--primary); color:#fff;",
    "  box-shadow:0 0 0 3px rgba(var(--primary-rgb),0.28), var(--shadow-primary-md);",
    "}",
    ".qp-play.qp-play--error { border-color:var(--status-error); color:var(--status-error); background:transparent; }",
    ".qp-play.qp-play--error:hover { background:rgba(239,68,68,0.08); }",
    ".qp-play__ico { width:16px; height:16px; flex:0 0 auto; }",
    /* three bars while the clip plays; still bars for reduced motion */
    ".qp-eq { display:inline-flex; align-items:center; gap:2px; height:14px; flex:0 0 auto; }",
    ".qp-eq span { display:block; width:3px; height:14px; border-radius:2px; background:currentColor; transform-origin:center; animation:qp-eq 0.7s ease-in-out infinite; }",
    ".qp-eq span:nth-child(1) { animation-delay:-0.45s; }",
    ".qp-eq span:nth-child(2) { animation-delay:-0.2s; }",
    ".qp-eq span:nth-child(3) { animation-delay:-0.6s; }",
    "@keyframes qp-eq { 0%,100% { transform:scaleY(0.35); } 50% { transform:scaleY(1); } }",
    ".qp-play__spin {",
    "  width:13px; height:13px; border:2px solid currentColor; border-right-color:transparent;",
    "  border-radius:50%; animation:qp-spin 0.7s linear infinite;",
    "}",
    "@keyframes qp-spin { to { transform:rotate(360deg); } }",

    ".qp-foot {",
    "  display:flex; align-items:center; justify-content:space-between; gap:8px;",
    "  padding:9px 14px 11px; border-top:1px solid var(--border-color); margin-top:8px;",
    "}",
    ".qp-link {",
    "  color:var(--link); text-decoration:none; font-size:12px; font-weight:600;",
    "  border:0; background:transparent; padding:0; cursor:pointer;",
    "}",
    ".qp-link:hover { text-decoration:underline; }",
    ".qp-brand { font-size:11px; color:var(--text-secondary); }",

    /* ---- rating prompt: one quiet box under the pronunciation, revealed
       after the first clip plays, no entry animation ---- */
    /* one paragraph whose last words are the two choices. The line height
       leaves room for the "Rate it" pill, so its line sits no lower than the
       others. */
    ".qp-rate {",
    "  margin:10px 0 0; padding:8px 12px; border-radius:var(--radius-md);",
    "  background:var(--tint-purple); font-size:12px; line-height:22px; color:var(--text-secondary);",
    "  text-wrap:pretty;",
    "}",
    /* baseline, not middle: the labels then sit on the sentence's own line */
    ".qp-rate__actions { display:inline-flex; align-items:baseline; gap:2px; white-space:nowrap; vertical-align:baseline; margin-left:2px; }",
    ".qp-rate__go, .qp-rate__btn {",
    "  height:20px; display:inline-flex; align-items:center; justify-content:center;",
    "  border:0; background:transparent; cursor:pointer; font:inherit; font-size:12px; line-height:1.2;",
    "  border-radius:var(--radius-pill);",
    "  transition:background-color .2s ease, color .2s ease, transform .15s ease, box-shadow .2s ease;",
    "}",
    /* hover: tinted pills that fill in and lift slightly, no underlines */
    /* the prompt's one real action: a soft tinted pill with a thin outline.
       Noticeable by shape, not by colour weight, so it never competes with
       the Play buttons. */
    ".qp-rate__go {",
    "  height:22px; padding:0 10px; color:var(--link); font-weight:700;",
    "  background:rgba(var(--primary-rgb),0.14); border:1px solid rgba(var(--primary-rgb),0.35);",
    "}",
    ".qp-rate__go:hover { background:rgba(var(--primary-rgb),0.22); transform:translateY(-1px); }",
    ".qp-rate__go:active { transform:translateY(0) scale(0.97); }",
    ".qp-rate__btn { padding:0 8px; color:var(--text-secondary); font-weight:600; }",
    ".qp-rate__btn:hover { background:rgba(var(--primary-rgb),0.08); color:var(--text-primary); }",

    /* ---- recent words as chips: play, then the word ---- */
    ".qp-rchips { display:flex; flex-wrap:wrap; gap:6px; list-style:none; margin:0; padding:0; }",
    ".qp-rchip {",
    "  display:inline-flex; align-items:center; gap:2px; max-width:100%; min-width:0; padding:2px;",
    "  background:var(--bg-primary); border:1px solid var(--border-color); border-radius:var(--radius-pill);",
    "}",
    ".qp-rchip .qp-play.qp-play--icon { flex:0 0 auto; width:24px; height:24px; min-height:0; padding:0; border-radius:50%; }",
    ".qp-rchip .qp-play__ico { width:13px; height:13px; }",
    ".qp-rchip .qp-play__spin { width:10px; height:10px; }",
    ".qp-rchip__word {",
    "  min-width:0; padding:0 9px 0 4px; font-size:13px; font-weight:600; line-height:1.4; color:var(--text-primary);",
    "  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;",
    "}",
    ".qp-rchip__word--open { border:0; background:transparent; cursor:pointer; font-family:inherit; border-radius:var(--radius-pill); }",
    ".qp-rchip__word--open:hover { color:var(--link); }",

    /* ---- cap screen ---- */
    ".qp-cap { display:flex; flex-direction:column; align-items:center; padding:16px 16px 12px; text-align:center; }",
    ".qp-recharge { position:relative; width:128px; height:128px; }",
    ".qp-recharge__ring { display:block; width:100%; height:100%; transform:rotate(-90deg); }",
    ".qp-recharge__track, .qp-recharge__fill { fill:none; stroke-width:7; }",
    ".qp-recharge__track { stroke:var(--beat-weak); }",
    ".qp-recharge__fill { stroke:var(--primary); stroke-linecap:round; }",
    ".qp-recharge__text { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 18px; }",
    ".qp-recharge__time { font-size:22px; font-weight:800; letter-spacing:-0.01em; line-height:1.15; font-variant-numeric:tabular-nums; color:var(--text-primary); }",
    ".qp-recharge__sub { margin-top:2px; font-size:11px; line-height:1.25; color:var(--text-secondary); }",
    ".qp-cap__title { margin-top:12px; font-size:16px; font-weight:700; color:var(--text-primary); }",
    ".qp-cap__sub { margin-top:4px; font-size:13px; color:var(--text-secondary); text-wrap:pretty; }",
    ".qp-cap__cta {",
    "  width:100%; min-height:42px; margin-top:12px; padding:9px 14px; font-size:14px; font-weight:700; cursor:pointer;",
    "  border:0; border-radius:var(--radius-md); background:var(--btn-primary-bg); background-color:var(--primary); color:#fff;",
    "  box-shadow:var(--shadow-primary-sm); transition:transform .2s ease, box-shadow .2s ease;",
    "}",
    ".qp-cap__cta:hover { box-shadow:var(--shadow-primary-md); transform:translateY(-1px); }",
    ".qp-cap__site { margin-top:10px; font-size:13px; }",
    ".qp-cap__still { padding:0 16px 12px; }",
    ".qp-cap__still-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-bottom:5px; }",
    ".qp-cap__still-head .qp-label { margin:0; }",
    ".qp-cap__still-note { font-size:11px; color:var(--text-secondary); }",

    ".qp-msg { padding:14px; font-size:13px; color:var(--text-primary); }",
    ".qp-msg__title { font-weight:600; margin-bottom:3px; }",
    ".qp-msg__sub { color:var(--text-secondary); }",
    ".qp-retry {",
    "  margin-top:12px; min-height:32px; padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer;",
    "  border:0; border-radius:var(--radius-md);",
    "  background:var(--btn-primary-bg); background-color:var(--primary); color:#fff;",
    "  box-shadow:var(--shadow-primary-sm); transition:transform .2s ease, box-shadow .2s ease;",
    "}",
    ".qp-retry:hover { box-shadow:var(--shadow-primary-md); transform:translateY(-1px); }",

    ".qp-skel { height:11px; border-radius:var(--radius-sm); background:var(--bg-secondary); margin-top:9px; }",
    ".qp-skel--w40 { width:40%; } .qp-skel--w70 { width:70%; } .qp-skel--w90 { width:90%; }",

    ".qp-toast {",
    "  background:var(--bg-primary); border:1px solid var(--border-color); border-radius:var(--radius-md);",
    "  box-shadow:var(--shadow-card); padding:10px 12px; font-size:13px; max-width:280px; color:var(--text-primary);",
    "}",

    /* ---- selection pill: the primary CTA, floated ---- */
    ".qp-pill {",
    "  display:inline-flex; align-items:center; gap:6px; padding:6px 11px;",
    "  border-radius:var(--radius-pill); border:0; cursor:pointer;",
    "  font-size:12px; font-weight:700; line-height:1; white-space:nowrap;",
    "  color:#fff; background:var(--btn-primary-bg); background-color:var(--primary);",
    "  box-shadow:var(--shadow-primary-md);",
    "  transition:transform .2s ease, box-shadow .2s ease;",
    "  animation:qp-pill-in 0.18s cubic-bezier(.34,1.56,.64,1);",
    "}",
    "@keyframes qp-pill-in { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }",
    ".qp-pill:hover { box-shadow:var(--shadow-primary-lg); transform:translateY(-1px); }",
    ".qp-pill svg { width:13px; height:13px; flex:0 0 auto; }",
    ".qp-pill:focus-visible { outline:2px solid #fff; outline-offset:2px; }",

    ".qp-focusable:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }",

    "@media (prefers-reduced-motion: reduce) {",
    "  .qp-play, .qp-pill, .qp-retry, .qp-hero__close, .qp-meaning, .qp-card, .qp-rate__go, .qp-rate__btn, .qp-reading, .qp-speed__opt, .qp-cap__cta, .qp-pron-row, .qp-pron-row__accent { transition:none; }",
    "  .qp-play:hover, .qp-pill:hover, .qp-retry:hover, .qp-hero__close:hover, .qp-hero__close:active, .qp-rate__go:hover, .qp-rate__go:active, .qp-cap__cta:hover, .qp-pron-row--tappable:active { transform:none; }",
    "  .qp-play__spin { animation-duration:1.4s; }",
    "  .qp-card, .qp-pill { animation:none; }",
    "  .qp-eq span { animation:none; transform:scaleY(0.7); }",
    "}"
  ].join("\n");
})();
