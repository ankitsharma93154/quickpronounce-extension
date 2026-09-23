/*
 * The pronunciation card renderer. Pure DOM, no framework. Used by both the
 * on-page Shadow DOM card (content.js) and the popup (popup.js), so it takes a
 * plain root element and a context object and never assumes where it lives.
 *
 * QP.card.render(root, view, ctx)
 *   view:
 *     { kind: "loading", word }
 *     | { state: "ok", model, cached, offline, multiword, usage }
 *     | { state: "not_found", word }
 *     | { state: "cap", usage }
 *     | { state: "error", kind, retryAfter, word }
 *     | { state: "invalid" }
 *   ctx:
 *     accent        "us" | "uk"  (which transcription/labels to feature)
 *     requestAudio(word, accent) -> Promise<{ok, base64, format, kind, retryAfter}>
 *     onRetry()     re-run the lookup
 *     onClose()     dismiss the card
 *     openUrl(url)  open a link in a new tab
 *     compact       boolean, true in the popup (no close button)
 *
 * QP.card.stopPlayback(ctx) - stop whatever audio this ctx is playing (the
 * caller should call this when it closes/replaces the card ctx was given
 * to). card.js stamps _activePlaybackId/_activeReset onto ctx itself; callers
 * don't need to touch those fields directly.
 */
(function () {
  var QP = (self.QP = self.QP || {});

  var SPEAKER =
    '<svg class="qp-play__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M11 5 6 9H2v6h4l5 4z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7"></path>' +
    '<path d="M18.5 5.5a9 9 0 0 1 0 13"></path></svg>';

  var AUDIO_TIMEOUT_MS = 12000;
  // Every real sense is still in the data (pickSenses in api.js does not cut
  // anything) - this only bounds how many tabs the inline Meaning header
  // row renders, so one pathologically ambiguous word can't overflow it.
  // Nothing observed so far ("record" -> 4) has come close to this.
  var MAX_SENSE_TABS = 4;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function clear(root) {
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  // The popup (ctx.compact) stays as tight as it is today so Recent stays in
  // view without scrolling; the on-page card gets the roomier variant.
  function cardClass(ctx) {
    return ctx.compact ? "qp-card" : "qp-card qp-card--roomy";
  }

  function accentLabel(a) {
    return a === "uk" ? "UK" : "US";
  }

  function pronRow(label, ipa) {
    var row = el("div", "qp-pron-row");
    row.appendChild(el("span", "qp-pron-row__accent", label));
    row.appendChild(el("span", "qp-pron-row__ipa", ipa));
    return row;
  }

  // --- state renderers ----------------------------------------------------

  function renderLoading(root, view, ctx) {
    var card = el("div", cardClass(ctx));
    card.appendChild(el("div", "qp-card__bar"));
    var body = el("div", "qp-card__body");
    var head = el("div", "qp-card__head");
    head.appendChild(el("div", "qp-word", view.word || "..."));
    body.appendChild(head);
    body.appendChild(el("div", "qp-skel qp-skel--w40"));
    body.appendChild(el("div", "qp-skel qp-skel--w90"));
    body.appendChild(el("div", "qp-skel qp-skel--w70"));
    card.appendChild(body);
    root.appendChild(card);
  }

  function renderOk(root, view, ctx) {
    var m = view.model;
    var accent = ctx.accent === "uk" ? "uk" : "us";
    var card = el("div", cardClass(ctx));

    // Every distinct part of speech the word has, primary sense first (see
    // pickSenses in api.js). Falls back to the single definition/partOfSpeech
    // pair for older cached/offline records that predate the senses list.
    var senses =
      m.senses && m.senses.length
        ? m.senses
        : m.definition
          ? [{ pos: m.partOfSpeech, definition: m.definition }]
          : [];

    // ---- hero: word, part of speech, close ----
    var hero = el("div", "qp-hero");
    // The whole word/pos block links out to the full entry, same destination
    // as "View full definition" below - one consistent way to get there.
    var heroLink = el("a", "qp-hero__link qp-focusable-light");
    heroLink.href = m.url;
    heroLink.appendChild(el("div", "qp-hero__word", m.word));
    // .qp-hero__pos collapses itself via :empty when there is no label.
    var posLine = el("div", "qp-hero__pos", (senses[0] && senses[0].pos) || "");
    heroLink.appendChild(posLine);
    heroLink.addEventListener("click", function (e) {
      e.preventDefault();
      ctx.openUrl(m.url);
    });
    hero.appendChild(heroLink);
    if (!ctx.compact) {
      var x = el("button", "qp-hero__close qp-focusable-light", "×");
      x.type = "button";
      x.setAttribute("aria-label", "Close");
      x.addEventListener("click", ctx.onClose);
      hero.appendChild(x);
    }
    card.appendChild(hero);

    var body = el("div", "qp-card__body");

    // context chips
    var chips = el("div", "qp-chips");
    var any = false;
    if (view.offline) {
      chips.appendChild(el("span", "qp-chip qp-chip--muted", "offline copy"));
      any = true;
    }
    if (m.bestGuess) {
      chips.appendChild(el("span", "qp-chip qp-chip--muted", "best guess"));
      any = true;
    }
    if (view.multiword) {
      chips.appendChild(el("span", "qp-chip qp-chip--muted", "first word only"));
      any = true;
    }
    if (any) body.appendChild(chips);

    // pronunciation table: both accents together, not just the featured one
    var hasUs = !!(m.ipa && m.ipa.us);
    var hasUk = !!(m.ipa && m.ipa.uk);
    if (hasUs || hasUk) {
      body.appendChild(el("div", "qp-label", "Pronunciation"));
      var pron = el("div", "qp-pron");
      if (hasUs) pron.appendChild(pronRow("US", m.ipa.us));
      if (hasUk) pron.appendChild(pronRow("UK", m.ipa.uk));
      body.appendChild(pron);
    }

    // respelling + syllable count, one line, follows the accent preference.
    // Each syllable is its own span, colour/weight-coded by stress (mirrors
    // Pronounce_web's phoneticSection.js) instead of the old caps-as-stress
    // convention, which had no way for a reader to discover what it meant.
    // The plain joined string (still computed server-side) becomes the
    // aria-label, so assistive tech gets a readable fallback instead of
    // walking the individual coloured spans.
    var syllables = m.syllables && (accent === "uk" ? m.syllables.uk : m.syllables.us);
    var validSyllables = (syllables || []).filter(function (s) {
      return s && String(s.text || "").trim();
    });
    var respellText = m.respell && (accent === "uk" ? m.respell.uk : m.respell.us);
    var sylCount = m.syllableCount && (accent === "uk" ? m.syllableCount.uk : m.syllableCount.us);
    if (validSyllables.length) {
      var rLine = el("div", "qp-respell-line");
      if (respellText) rLine.setAttribute("aria-label", respellText);
      var sylWrap = el("span", "qp-syllables");
      sylWrap.setAttribute("aria-hidden", "true");
      validSyllables.forEach(function (s, i) {
        var stress = s.stress === 1 ? 1 : s.stress === 2 ? 2 : 0;
        var syl = el("span", "qp-syl qp-syl--" + stress, String(s.text).trim());
        syl.title = stress === 1 ? "Primary stress" : stress === 2 ? "Secondary stress" : "Unstressed";
        sylWrap.appendChild(syl);
        if (i < validSyllables.length - 1) sylWrap.appendChild(el("span", "qp-syl-sep", QP.respell.MIDDOT));
      });
      rLine.appendChild(sylWrap);
      if (sylCount) {
        rLine.appendChild(document.createTextNode(" "));
        rLine.appendChild(el("span", "qp-dim", "· " + sylCount + (sylCount === 1 ? " syllable" : " syllables")));
      }
      body.appendChild(rLine);
    }

    // audio - right under pronunciation/respelling, ahead of meaning
    var audioRow = el("div", "qp-audio");
    audioRow.appendChild(makePlayButton(m.word, "us", ctx));
    audioRow.appendChild(makePlayButton(m.word, "uk", ctx));
    body.appendChild(audioRow);

    // meaning: a part-of-speech switcher when the word has more than one, so
    // an ambiguous word (e.g. "record", "bank", "wind") is never just one
    // silent guess. Each tab swaps the definition and the hero's pos line in
    // place; nothing is re-fetched, every sense came back with the original
    // lookup.
    if (senses.length) {
      var meaningHead = el("div", "qp-meaning-head");
      meaningHead.appendChild(el("div", "qp-label qp-label--amber", "Meaning"));

      if (senses.length > 1) {
        var senseRow = el("div", "qp-senses");
        senses.slice(0, MAX_SENSE_TABS).forEach(function (s, i) {
          var tab = el("button", "qp-sense" + (i === 0 ? " qp-sense--active qp-focusable" : " qp-focusable"), s.pos || "other");
          tab.type = "button";
          tab.setAttribute("aria-pressed", i === 0 ? "true" : "false");
          tab.addEventListener("click", function () {
            Array.prototype.forEach.call(senseRow.children, function (t) {
              t.classList.remove("qp-sense--active");
              t.setAttribute("aria-pressed", "false");
            });
            tab.classList.add("qp-sense--active");
            tab.setAttribute("aria-pressed", "true");
            meaning.classList.add("qp-meaning--fading");
            setTimeout(function () {
              meaningText.textContent = s.definition;
              posLine.textContent = s.pos || "";
              meaning.classList.remove("qp-meaning--fading");
            }, 120);
          });
          senseRow.appendChild(tab);
        });
        meaningHead.appendChild(senseRow);
      }
      body.appendChild(meaningHead);

      // padding lives on .qp-meaning (the callout box); the 3-line clamp
      // lives on a separate, padding-less inner element - Chromium can let a
      // stray 4th line escape the clamp boundary when line-clamp and padding
      // sit on the same element, so they're kept apart.
      var meaning = el("div", "qp-meaning");
      var meaningText = el("div", "qp-meaning__text", senses[0].definition);
      meaning.appendChild(meaningText);
      body.appendChild(meaning);
    }

    card.appendChild(body);

    // footer
    var foot = el("div", "qp-foot");
    var link = el("a", "qp-link qp-focusable", "View full definition");
    link.href = m.url;
    link.addEventListener("click", function (e) {
      e.preventDefault();
      ctx.openUrl(m.url);
    });
    foot.appendChild(link);
    foot.appendChild(el("span", "qp-brand", "QuickPronounce"));
    card.appendChild(foot);

    root.appendChild(card);
  }

  // A word with no dictionary entry still gets machine-generated audio (the
  // pronunciation endpoint synthesizes it regardless), so the card keeps the
  // familiar layout with placeholders for the fields we don't have, instead
  // of a dead end. The lookup already counted against the daily cap; playing
  // audio adds nothing to it.
  function renderNotFound(root, view, ctx) {
    var word = view.word || "";
    var url = QP.config.wordUrl(word);
    var card = el("div", cardClass(ctx));

    var hero = el("div", "qp-hero");
    var heroLink = el("a", "qp-hero__link qp-focusable-light");
    heroLink.href = url;
    heroLink.appendChild(el("div", "qp-hero__word", word));
    heroLink.addEventListener("click", function (e) {
      e.preventDefault();
      ctx.openUrl(url);
    });
    hero.appendChild(heroLink);
    if (!ctx.compact) {
      var x = el("button", "qp-hero__close qp-focusable-light", "×");
      x.type = "button";
      x.setAttribute("aria-label", "Close");
      x.addEventListener("click", ctx.onClose);
      hero.appendChild(x);
    }
    card.appendChild(hero);

    var body = el("div", "qp-card__body");

    var chips = el("div", "qp-chips");
    chips.appendChild(el("span", "qp-chip qp-chip--muted", "no dictionary entry yet"));
    body.appendChild(chips);

    body.appendChild(el("div", "qp-label", "Pronunciation"));
    body.appendChild(el("div", "qp-placeholder", "IPA and syllables not available yet."));

    var audioRow = el("div", "qp-audio");
    audioRow.appendChild(makePlayButton(word, "us", ctx));
    audioRow.appendChild(makePlayButton(word, "uk", ctx));
    body.appendChild(audioRow);
    body.appendChild(
      el("div", "qp-placeholder qp-placeholder--small", "Machine-generated audio, so it may not be accurate.")
    );

    var meaningHead = el("div", "qp-meaning-head");
    meaningHead.appendChild(el("div", "qp-label qp-label--amber", "Meaning"));
    body.appendChild(meaningHead);
    var meaning = el("div", "qp-meaning");
    meaning.appendChild(el("div", "qp-meaning__text", "Meaning not available yet."));
    body.appendChild(meaning);

    card.appendChild(body);

    var foot = el("div", "qp-foot");
    var link = el("a", "qp-link qp-focusable", "Search on QuickPronounce");
    link.href = url;
    link.addEventListener("click", function (e) {
      e.preventDefault();
      ctx.openUrl(url);
    });
    foot.appendChild(link);
    foot.appendChild(el("span", "qp-brand", "QuickPronounce"));
    card.appendChild(foot);

    root.appendChild(card);
  }

  // ------------------------------------------------------ offscreen audio
  // Actual decoding + <audio> playback happens in the extension's offscreen
  // document (src/offscreen/offscreen.js), not here: some host pages' CSP
  // (no media-src, falling back to a strict default-src) blocks a blob: URL
  // loaded into their own DOM. The offscreen document is a
  // chrome-extension:// page with its own CSP, so it's never subject to the
  // host page's policy. This module just relays base64 audio there via the
  // background service worker and listens for playback state back, tagged
  // with the playbackId the service worker handed back for that request -
  // that's what keeps a stale ended/error from a superseded clip from
  // touching a button that has since moved on to something else.
  var playbackHandlers = {}; // playbackId -> onEvent(event, extra)

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (!msg || msg.type !== "AUDIO_EVENT" || msg.playbackId == null) return;
      var handler = playbackHandlers[msg.playbackId];
      if (!handler) return;
      if (msg.event === "ended" || msg.event === "stopped" || msg.event === "error") {
        delete playbackHandlers[msg.playbackId];
      }
      handler(msg.event, msg);
    });
  }

  function sendRuntimeMessage(payload) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(payload, function (resp) {
          void chrome.runtime.lastError; // no listener / worker asleep: resp is undefined, handled below
          resolve(resp);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  // ctx._activePlaybackId/_activeReset track whichever button most recently
  // asked the offscreen document to play, so a card close or a fresh lookup
  // (see content.js/popup.js) can stop it even though the <audio> element
  // itself lives outside this page.
  function requestPlayback(ctx, base64, format, onEvent) {
    sendRuntimeMessage({ type: "PLAY_AUDIO", base64: base64, format: format }).then(function (resp) {
      if (!resp || !resp.ok) {
        onEvent("error", { message: "Could not play audio" });
        return;
      }
      var playbackId = resp.playbackId;
      ctx._activePlaybackId = playbackId;
      ctx._activeReset = function () {
        onEvent("stopped");
      };
      playbackHandlers[playbackId] = function (event, extra) {
        if (event === "ended" || event === "stopped" || event === "error") {
          if (ctx._activePlaybackId === playbackId) {
            ctx._activePlaybackId = null;
            ctx._activeReset = null;
          }
        }
        onEvent(event, extra);
      };
    });
  }

  // Exported as QP.card.stopPlayback so content.js/popup.js can stop
  // whatever's playing when a card closes or a new lookup replaces it.
  function stopPlayback(ctx) {
    if (!ctx || ctx._activePlaybackId == null) return;
    var playbackId = ctx._activePlaybackId;
    var reset = ctx._activeReset;
    delete playbackHandlers[playbackId];
    ctx._activePlaybackId = null;
    ctx._activeReset = null;
    if (reset) reset(); // instant UI feedback; the message below is the real stop
    sendRuntimeMessage({ type: "STOP_AUDIO", playbackId: playbackId });
  }

  function makePlayButton(word, accent, ctx) {
    var btn = el("button", "qp-play qp-focusable");
    btn.type = "button";
    var label = accentLabel(accent);
    var btnText = "Play " + label;
    setIdle();

    var state = "idle";
    var killTimer = null;

    function setIdle() {
      btn.disabled = false;
      btn.className = "qp-play qp-focusable";
      btn.innerHTML = SPEAKER + "<span>" + btnText + "</span>";
      btn.removeAttribute("title");
      btn.setAttribute("aria-label", "Play " + label + " pronunciation of " + word);
    }
    function setLoading() {
      btn.disabled = true;
      btn.className = "qp-play qp-focusable";
      btn.innerHTML = '<span class="qp-play__spin"></span><span>' + btnText + "</span>";
    }
    function setPlaying() {
      btn.disabled = false;
      btn.className = "qp-play qp-play--playing qp-focusable";
      btn.innerHTML = SPEAKER + "<span>" + btnText + "</span>";
    }
    function setError(msg) {
      btn.disabled = false;
      btn.className = "qp-play qp-play--error qp-focusable";
      btn.innerHTML = SPEAKER + "<span>" + btnText + "</span>";
      btn.title = msg || "Could not play audio";
    }
    function done() {
      if (killTimer) {
        clearTimeout(killTimer);
        killTimer = null;
      }
    }

    function onPlaybackEvent(event, extra) {
      if (event === "playing") {
        state = "playing";
        setPlaying();
      } else if (event === "ended" || event === "stopped") {
        state = "idle";
        setIdle();
      } else if (event === "error") {
        state = "idle";
        setError((extra && extra.message) || "Could not play audio");
      }
    }

    btn.addEventListener("click", function () {
      if (state === "loading") return;
      if (state === "playing") {
        stopPlayback(ctx);
        return;
      }

      // replay from cache if we already have the audio
      var cached = QP.audioCache.get(word, accent);
      if (cached) {
        resetOthers(ctx, btn);
        requestPlayback(ctx, cached.base64, cached.format, onPlaybackEvent);
        return;
      }

      state = "loading";
      setLoading();
      killTimer = setTimeout(function () {
        state = "idle";
        setError("Audio timed out");
      }, AUDIO_TIMEOUT_MS);

      ctx
        .requestAudio(word, accent)
        .then(function (res) {
          done();
          if (state !== "loading") return; // timed out already; ignore a late reply
          if (!res || !res.ok || !res.base64) {
            state = "idle";
            if (res && res.kind === "rate_limited") setError("Busy, try again shortly");
            else if (res && res.kind === "not_found") setError("No audio for this word");
            else setError("Could not load audio");
            return;
          }
          QP.audioCache.put(word, accent, res.base64, res.format);
          resetOthers(ctx, btn);
          requestPlayback(ctx, res.base64, res.format, onPlaybackEvent);
        })
        .catch(function () {
          done();
          state = "idle";
          setError("Could not load audio");
        });
    });

    btn._qpReset = function () {
      if (state === "playing" || state === "loading") {
        state = "idle";
        setIdle();
      }
    };

    return btn;
  }

  function resetOthers(ctx, keepBtn) {
    var row = keepBtn.parentNode;
    if (!row) return;
    Array.prototype.forEach.call(row.children, function (b) {
      if (b !== keepBtn && typeof b._qpReset === "function") b._qpReset();
    });
  }

  function renderMessage(root, opts, ctx) {
    var card = el("div", cardClass(ctx));
    card.appendChild(el("div", "qp-card__bar"));
    var msg = el("div", "qp-msg");
    msg.appendChild(el("div", "qp-msg__title", opts.title));
    if (opts.sub) msg.appendChild(el("div", "qp-msg__sub", opts.sub));
    if (opts.retry) {
      var r = el("button", "qp-retry qp-focusable", "Try again");
      r.type = "button";
      r.addEventListener("click", ctx.onRetry);
      msg.appendChild(r);
    }
    if (opts.link) {
      var wrap = el("div");
      wrap.style.marginTop = "10px";
      var a = el("a", "qp-link qp-focusable", opts.link.text);
      a.href = opts.link.url;
      a.addEventListener("click", function (e) {
        e.preventDefault();
        ctx.openUrl(opts.link.url);
      });
      wrap.appendChild(a);
      msg.appendChild(wrap);
    }
    card.appendChild(msg);

    if (!ctx.compact) {
      var foot = el("div", "qp-foot");
      var close = el("button", "qp-link qp-focusable", "Dismiss");
      close.type = "button";
      close.style.border = "0";
      close.style.background = "transparent";
      close.style.cursor = "pointer";
      close.addEventListener("click", ctx.onClose);
      foot.appendChild(close);
      foot.appendChild(el("span", "qp-brand", "QuickPronounce"));
      card.appendChild(foot);
    }
    root.appendChild(card);
  }

  function render(root, view, ctx) {
    clear(root);
    ctx = ctx || {};
    ctx.accent = ctx.accent === "uk" ? "uk" : "us";
    ctx.onRetry = ctx.onRetry || function () {};
    ctx.onClose = ctx.onClose || function () {};
    ctx.openUrl = ctx.openUrl || function (u) { try { window.open(u, "_blank", "noopener"); } catch (e) {} };
    ctx.requestAudio = ctx.requestAudio || function () { return Promise.resolve({ ok: false }); };

    if (view.kind === "loading") return renderLoading(root, view, ctx);

    switch (view.state) {
      case "ok":
        return renderOk(root, view, ctx);
      case "not_found":
        return renderNotFound(root, view, ctx);
      case "cap":
        return renderMessage(
          root,
          {
            title: "You've reached today's lookup limit.",
            sub:
              "That's " +
              (view.usage ? view.usage.limit : QP.config.DAILY_UNIQUE_WORD_LIMIT) +
              " new words in 24 hours. Words you've already looked up still play" +
              (view.usage && view.usage.resetsAt
                ? ". Resets in about " + QP.util.hoursUntil(view.usage.resetsAt) + "h."
                : "."),
            link: { text: "Open QuickPronounce", url: QP.config.SITE_URL }
          },
          ctx
        );
      case "invalid":
        return renderMessage(
          root,
          {
            title: "Select a single word",
            sub: "QuickPronounce works best on one word at a time right now."
          },
          ctx
        );
      case "error":
      default: {
        if (view.kind === "rate_limited") {
          return renderMessage(
            root,
            {
              title: "QuickPronounce is busy right now.",
              sub:
                "Try again in about " +
                (view.retryAfter || 60) +
                " seconds.",
              retry: true
            },
            ctx
          );
        }
        if (view.kind === "unauthorized") {
          return renderMessage(
            root,
            {
              title: "Couldn't authorize this lookup.",
              sub: "The extension's access key was rejected. Please update the extension or try later.",
              retry: true
            },
            ctx
          );
        }
        return renderMessage(
          root,
          {
            title: "Couldn't reach QuickPronounce.",
            sub: "Check your connection and try again.",
            retry: true
          },
          ctx
        );
      }
    }
  }

  QP.card = { render: render, stopPlayback: stopPlayback };
})();
