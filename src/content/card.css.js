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
    "}",
    ".qp-card__bar { height:3px; background:var(--primary-gradient); }",
    ".qp-card__body { padding:12px 14px 6px; }",

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
    ".qp-hero__word {",
    "  position:relative; z-index:1; font-size:19px; font-weight:800; letter-spacing:-0.01em;",
    "  color:#fff; line-height:1.2; word-break:break-word;",
    "}",
    ".qp-hero__pos {",
    "  position:relative; z-index:1; font-size:13px; font-weight:600; text-transform:capitalize;",
    "  color:rgba(255,255,255,0.85); margin-top:2px;",
    "}",
    ".qp-hero__pos:empty { display:none; }",
    ".qp-hero__close {",
    "  position:absolute; z-index:2; top:14px; right:14px; width:26px; height:26px;",
    "  display:inline-flex; align-items:center; justify-content:center; border-radius:50%;",
    "  border:0; background:rgba(255,255,255,0.22); color:#fff; font-size:15px; line-height:1; cursor:pointer;",
    "  transition:background-color var(--transition);",
    "}",
    ".qp-hero__close:hover { background:rgba(255,255,255,0.34); }",
    ".qp-hero__close:focus-visible { outline:2px solid #fff; outline-offset:2px; }",

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
    ".qp-label--amber { color:var(--amber-text); }",
    ".qp-meaning-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px 10px; margin-top:9px; }",
    ".qp-meaning-head .qp-label { margin-top:0; }",
    ".qp-meaning-head .qp-senses { margin-top:0; }",

    /* ---- pronunciation table: both accents, always ---- */
    ".qp-pron { margin-top:6px; background:var(--tint-purple); border:1px solid var(--border-color); border-radius:var(--radius-md); overflow:hidden; }",
    ".qp-pron-row { display:flex; align-items:baseline; gap:10px; padding:6px 12px; }",
    ".qp-pron-row + .qp-pron-row { border-top:1px solid var(--border-color); }",
    ".qp-pron-row__accent { flex:0 0 auto; width:22px; font-size:11px; font-weight:700; color:var(--primary); text-transform:uppercase; }",
    ".qp-pron-row__ipa {",
    "  font-family:'SFMono-Regular',ui-monospace,Menlo,Consolas,monospace;",
    "  font-size:14px; color:var(--text-primary); word-break:break-word;",
    "}",

    /* ---- respelling + syllable count, one line ---- */
    ".qp-respell-line {",
    "  margin-top:8px; padding:6px 12px; background:var(--tint-purple); border-radius:var(--radius-md);",
    "  font-size:13px; color:var(--text-primary); word-break:break-word;",
    "}",
    ".qp-respell-line b { font-weight:700; }",
    ".qp-respell-line .qp-dim { color:var(--text-secondary); }",

    /* ---- meaning callout: the one deliberate amber accent in the card ---- */
    ".qp-meaning {",
    "  margin-top:6px; padding:8px 12px; background:var(--amber-gradient); border:1px solid var(--amber-border);",
    "  border-radius:var(--radius-md); font-size:13px; color:var(--text-primary);",
    "  display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;",
    "}",

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
    ".qp-play {",
    "  flex:1 1 0; display:inline-flex; align-items:center; justify-content:center; gap:7px;",
    "  min-height:43px; padding:9px 12px; font-size:14px; font-weight:700; cursor:pointer;",
    "  border:1px solid var(--border-primary-soft); border-radius:var(--radius-md);",
    "  background:var(--border-primary-soft); color:var(--primary);",
    "  transition:transform .2s ease, box-shadow .2s ease, background-color .2s ease, color .2s ease, border-color .2s ease;",
    "}",
    ".qp-play:hover { background:rgba(var(--primary-rgb),0.22); transform:translateY(-1px); }",
    ".qp-play:disabled { opacity:0.6; cursor:default; transform:none; }",
    /* Compound selectors (.qp-play.qp-play--X), not bare .qp-play--X: a bare
       single class has the same specificity as .qp-play:hover above, and
       loses the fill when the cursor is still sitting on the button right
       after a click - which it always is - leaving white text on a
       near-white background. Compounding wins outright, hovered or not. */
    ".qp-play.qp-play--playing {",
    "  background:var(--btn-primary-bg); background-color:var(--primary);",
    "  border-color:transparent; color:#fff; box-shadow:var(--shadow-primary-sm);",
    "}",
    ".qp-play.qp-play--playing:hover {",
    "  background:var(--btn-primary-bg); background-color:var(--primary);",
    "  box-shadow:var(--shadow-primary-md); color:#fff;",
    "}",
    ".qp-play.qp-play--error { border-color:var(--status-error); color:var(--status-error); background:transparent; }",
    ".qp-play.qp-play--error:hover { background:rgba(239,68,68,0.08); }",
    ".qp-play__ico { width:16px; height:16px; flex:0 0 auto; }",
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
    "}",
    ".qp-pill:hover { box-shadow:var(--shadow-primary-lg); transform:translateY(-1px); }",
    ".qp-pill svg { width:13px; height:13px; flex:0 0 auto; }",
    ".qp-pill:focus-visible { outline:2px solid #fff; outline-offset:2px; }",

    ".qp-focusable:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }",

    "@media (prefers-reduced-motion: reduce) {",
    "  .qp-play, .qp-pill, .qp-retry, .qp-hero__close { transition:none; }",
    "  .qp-play:hover, .qp-pill:hover, .qp-retry:hover { transform:none; }",
    "  .qp-play__spin { animation-duration:1.4s; }",
    "}"
  ].join("\n");
})();
