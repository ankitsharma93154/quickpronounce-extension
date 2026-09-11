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

  function renderLoading(root, view) {
    var card = el("div", "qp-card");
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
    var card = el("div", "qp-card");

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
    hero.appendChild(el("div", "qp-hero__word", m.word));
    // .qp-hero__pos collapses itself via :empty when there is no label.
    var posLine = el("div", "qp-hero__pos", (senses[0] && senses[0].pos) || "");
    hero.appendChild(posLine);
    if (!ctx.compact) {
      var x = el("button", "qp-hero__close", "×");
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

    // respelling + syllable count, one line, follows the accent preference -
    // the respelling string already encodes stress (the stressed syllable is
    // UPPERCASE), so there is no need for a separate coloured breakdown too.
    var respell = m.respell && (accent === "uk" ? m.respell.uk : m.respell.us);
    var sylCount = m.syllableCount && (accent === "uk" ? m.syllableCount.uk : m.syllableCount.us);
    if (respell) {
      var rLine = el("div", "qp-respell-line");
      rLine.appendChild(el("b", null, respell));
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
            meaning.textContent = s.definition;
            posLine.textContent = s.pos || "";
          });
          senseRow.appendChild(tab);
        });
        meaningHead.appendChild(senseRow);
      }
      body.appendChild(meaningHead);

      var meaning = el("div", "qp-meaning", senses[0].definition);
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

    btn.addEventListener("click", function () {
      if (state === "loading") return;
      if (state === "playing") {
        stopAudio(ctx);
        state = "idle";
        setIdle();
        return;
      }

      // replay from cache if we already have the object URL
      var cachedUrl = QP.audioCache.get(word, accent);
      if (cachedUrl) {
        play(cachedUrl);
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
          var url = QP.audioCache.fromBase64(word, accent, res.base64);
          play(url);
        })
        .catch(function () {
          done();
          state = "idle";
          setError("Could not load audio");
        });
    });

    function play(url) {
      var audio = getAudio(ctx);
      try {
        audio.pause();
      } catch (e) {
        /* noop */
      }
      resetOthers(ctx, btn);
      audio.src = url;
      audio.onended = function () {
        state = "idle";
        setIdle();
      };
      audio.onerror = function () {
        state = "idle";
        setError("Could not play audio");
      };
      var p = audio.play();
      if (p && p.catch) {
        p.then(function () {
          state = "playing";
          setPlaying();
        }).catch(function () {
          state = "idle";
          setError("Playback blocked");
        });
      } else {
        state = "playing";
        setPlaying();
      }
    }

    btn._qpReset = function () {
      if (state === "playing") {
        state = "idle";
        setIdle();
      }
    };

    return btn;
  }

  function getAudio(ctx) {
    if (!ctx._audio) ctx._audio = new Audio();
    return ctx._audio;
  }
  function stopAudio(ctx) {
    if (ctx._audio) {
      try {
        ctx._audio.pause();
        ctx._audio.currentTime = 0;
      } catch (e) {
        /* noop */
      }
    }
  }
  function resetOthers(ctx, keepBtn) {
    var row = keepBtn.parentNode;
    if (!row) return;
    Array.prototype.forEach.call(row.children, function (b) {
      if (b !== keepBtn && typeof b._qpReset === "function") b._qpReset();
    });
  }

  function renderMessage(root, opts, ctx) {
    var card = el("div", "qp-card");
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

    if (view.kind === "loading") return renderLoading(root, view);

    switch (view.state) {
      case "ok":
        return renderOk(root, view, ctx);
      case "not_found":
        return renderMessage(
          root,
          {
            title: "We couldn't find a full entry for this word.",
            sub: view.word ? '"' + view.word + '" isn’t in the QuickPronounce dictionary yet.' : "",
            link: { text: "Search on QuickPronounce", url: QP.config.wordUrl(view.word || "") }
          },
          ctx
        );
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

  QP.card = { render: render };
})();
