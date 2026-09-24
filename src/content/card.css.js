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

  QP.cardCss = [
    /* ---- tokens (mirror Pronounce_web). Declared on the rendered root
       elements themselves so they work in a shadow root and in the popup
       document alike; descendants inherit. ---- */
    ".qp-card, .qp-toast, .qp-pill {",
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
    "  .qp-card, .qp-toast, .qp-pill {",
    "    --btn-primary-bg:var(--primary-gradient-hover);",
    "    --link:#a78bfa;",
    "    --text-primary:#f8fafc;",
    "    --text-secondary:#cbd5e1;",
    "    --bg-primary:#1e293b;",
    "    --bg-secondary:#334155;",
    "    --border-color:#475569;",
    "    --status-error:#f87171;",
    "    --shadow-card:0 14px 34px rgba(0,0,0,0.55), 0 4px 14px rgba(0,0,0,0.4);",
    "    --tint-purple:rgba(167,139,250,0.10);",
    "    --amber-gradient:linear-gradient(135deg,#3a2c12 0%,#4d3814 100%);",
    "    --amber-border:#5c431c;",
    "    --amber-text:#e2a83f;",
    "    --scroll-thumb:rgba(203,213,225,0.28);",
    "    --scroll-thumb-hover:rgba(203,213,225,0.5);",
    "  }",
    "}",

    ".qp-card * , .qp-toast * { box-sizing:border-box; }",

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
    ".qp-card--roomy .qp-pron-row { padding:9px 14px; }",
    ".qp-card--roomy .qp-respell-line { margin-top:11px; padding:9px 14px; }",
    ".qp-card--roomy .qp-audio { margin-top:14px; gap:10px; }",
    ".qp-card--roomy .qp-play { min-height:46px; padding:10px 14px; }",
    ".qp-card--roomy .qp-meaning { margin-top:9px; padding:11px 14px; }",
    ".qp-card--roomy .qp-foot { padding:11px 20px 14px; margin-top:10px; }",

    /* loading skeleton only - the "ok" result uses .qp-hero instead */
    ".qp-card__head { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }",
    ".qp-word { font-size:17px; font-weight:700; letter-spacing:-0.01em; color:var(--text-primary); word-break:break-word; }",

    /* ---- hero header: word, part of speech, close ---- */
    ".qp-hero { position:relative; background:var(--btn-primary-bg); background-color:var(--primary); padding:13px 42px 11px 14px; }",
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
    ".qp-hero__pos {",
    "  font-size:13px; font-weight:600; text-transform:capitalize;",
    "  color:rgba(255,255,255,0.85); margin-top:2px;",
    "}",
    ".qp-hero__pos:empty { display:none; }",
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

    /* ---- pronunciation table: both accents, always ---- */
    ".qp-pron { margin-top:6px; background:var(--tint-purple); border:1px solid var(--border-color); border-radius:var(--radius-md); overflow:hidden; }",
    ".qp-pron-row { display:flex; align-items:baseline; gap:10px; padding:6px 12px; }",
    ".qp-pron-row + .qp-pron-row { border-top:1px solid var(--border-color); }",
    /* the IPA leads; the US/UK tag is a quiet label beside it. line-height is
       tightened as the font grows so each row stays the height it was. */
    ".qp-pron-row__accent { flex:0 0 auto; width:22px; font-size:11px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; }",
    ".qp-pron-row__ipa {",
    "  font-family:'SFMono-Regular',ui-monospace,Menlo,Consolas,monospace;",
    "  font-size:16px; font-weight:600; line-height:1.35; letter-spacing:0.01em;",
    "  color:var(--text-primary); word-break:break-word;",
    "}",

    /* ---- respelling + syllable count, one line ---- */
    ".qp-respell-line {",
    "  margin-top:8px; padding:6px 12px; background:var(--tint-purple); border-radius:var(--radius-md);",
    "  font-size:13px; color:var(--text-primary); word-break:break-word;",
    "}",
    ".qp-respell-line .qp-dim { color:var(--text-secondary); }",
    /* stress-coded syllables: colour + weight, not letter case - matches
       Pronounce_web/src/components/phoneticSection.js's stress-0/1/2 classes
       (same tokens) so a reader who's seen the site recognizes it here too.
       Each syllable also carries a title tooltip since the card has no room
       for the website's persistent legend. */
    ".qp-syl--0 { color:var(--text-secondary); font-weight:400; }",
    ".qp-syl--2 { color:var(--text-primary); font-weight:500; }",
    ".qp-syl--1 { color:var(--primary); font-weight:700; }",
    ".qp-syl-sep { margin:0 1px; color:var(--text-secondary); opacity:0.75; }",

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
    ".qp-sense:hover { border-color:var(--primary); color:var(--primary); }",
    ".qp-sense--active {",
    "  background:var(--border-primary-soft); border-color:var(--primary);",
    "  color:var(--primary); font-weight:700;",
    "}",

    /* ---- audio buttons: model on .cta-button ---- */
    ".qp-audio { display:flex; gap:8px; margin-top:10px; }",
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
    ".qp-play.qp-play--playing .qp-play__ico { animation:qp-icon-bounce 0.4s ease; }",
    "@keyframes qp-icon-bounce { 0% { transform:scale(1); } 40% { transform:scale(1.18); } 100% { transform:scale(1); } }",
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
    "  .qp-play, .qp-pill, .qp-retry, .qp-hero__close, .qp-meaning, .qp-card { transition:none; }",
    "  .qp-play:hover, .qp-pill:hover, .qp-retry:hover, .qp-hero__close:hover, .qp-hero__close:active { transform:none; }",
    "  .qp-play__spin { animation-duration:1.4s; }",
    "  .qp-card, .qp-pill { animation:none; }",
    "  .qp-play.qp-play--playing .qp-play__ico { animation:none; }",
    "}"
  ].join("\n");
})();
