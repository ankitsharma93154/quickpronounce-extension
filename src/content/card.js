/*
 * The pronunciation card renderer. Pure DOM, no framework. Used by both the
 * on-page Shadow DOM card (content.js) and the popup (popup.js), so it takes a
 * plain root element and a context object and never assumes where it lives.
 *
 * QP.card.render(root, view, ctx)
 *   view:
 *     { kind: "loading", word }
 *     | { state: "ok", model, cached, offline, multiword, usage, ratePrompt? }
 *     | { state: "not_found", word }
 *     | { state: "cap", word, usage, recents }
 *     | { state: "error", kind, retryAfter, word }
 *     | { state: "invalid" }
 *   ctx:
 *     accent        "us" | "uk"  (which transcription/labels to feature)
 *     requestAudio(word, accent) -> Promise<{ok, base64, format, kind, retryAfter}>
 *     onRetry()     re-run the lookup
 *     onClose()     dismiss the card
 *     openUrl(url)  open a link in a new tab
 *     compact       boolean, true in the popup (no close button)
 *     onRatePrompt(action)  the rating prompt was answered: rate|later|dismiss
 *     onResize()    optional: the card changed height (a tab was switched)
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

  var EQUALIZER =
    '<span class="qp-eq" aria-hidden="true"><span></span><span></span><span></span></span>';

  var AUDIO_TIMEOUT_MS = 12000;
  // Every real sense is still in the data (pickSenses in api.js does not cut
  // anything) - this only bounds how many tabs the inline Meaning header
  // row renders, so one pathologically ambiguous word can't overflow it.
  // Nothing observed so far ("record" -> 4) has come close to this.
  var MAX_SENSE_TABS = 4;

  // Playback speed, remembered across cards and pages in its own storage key.
  // Slowing a clip is done by the player, so it costs no extra audio request.
  var SPEEDS = [1, 0.75, 0.5];
  var SPEED_KEY = "playbackRate";
  var playbackRate = 1;

  function applyStoredRate(value) {
    playbackRate = SPEEDS.indexOf(value) !== -1 ? value : 1;
  }

  function setPlaybackRate(rate) {
    playbackRate = rate;
    try {
      var item = {};
      item[SPEED_KEY] = rate;
      chrome.storage.local.set(item, function () {
        void chrome.runtime.lastError;
      });
    } catch (e) {
      /* extension context gone: it still applies to this card */
    }
  }

  try {
    chrome.storage.local.get(SPEED_KEY, function (res) {
      if (chrome.runtime.lastError) return;
      applyStoredRate(res && res[SPEED_KEY]);
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "local" && changes[SPEED_KEY]) applyStoredRate(changes[SPEED_KEY].newValue);
    });
  } catch (e) {
    /* no extension context: stays at 1x */
  }

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

  // Fills the Meaning callout with one sense's definitions. Padding lives on
  // .qp-meaning (the callout box); the line clamp lives on a separate,
  // padding-less inner element per definition - Chromium can let a stray extra
  // line escape the clamp boundary when line-clamp and padding sit on the same
  // element, so they're kept apart. With more than one definition the list
  // scrolls inside a capped height so the card never grows; older cached or
  // offline records only carry a single `definition`.
  function fillMeaning(box, sense) {
    clear(box);
    var defs =
      sense.definitions && sense.definitions.length
        ? sense.definitions
        : sense.definition
          ? [sense.definition]
          : [];
    var multi = defs.length > 1;
    var list = el("div", "qp-defs" + (multi ? " qp-defs--multi" : ""));
    defs.forEach(function (d, i) {
      var row = el("div", "qp-def");
      if (multi) row.appendChild(el("span", "qp-def__n", i + 1 + "."));
      row.appendChild(el("div", "qp-meaning__text", d));
      list.appendChild(row);
    });
    box.appendChild(list);
  }

  function notifyResize(ctx) {
    if (ctx && typeof ctx.onResize === "function") ctx.onResize();
  }

  function resetPlayButtons(root) {
    Array.prototype.forEach.call(root.querySelectorAll("button"), function (b) {
      if (typeof b._qpReset === "function") b._qpReset();
    });
  }

  // What one accent shows for a reading, or for the word when reading is null.
  function accentView(m, reading, accent) {
    if (reading) {
      var v = QP.readings.forAccent(reading, accent);
      return { ipa: v.ipa, syllables: v.syllables, playable: v.available };
    }
    return {
      ipa: (m.ipa && m.ipa[accent]) || null,
      syllables: (m.syllables && m.syllables[accent]) || [],
      playable: true
    };
  }

  // One bar per syllable: the taller the bar, the stronger the stress. The
  // joined respelling is the aria-label, so assistive tech gets one readable
  // string instead of walking the individual bars.
  function makeStressBars(syllables) {
    var valid = (syllables || []).filter(function (s) {
      return s && String(s.text || "").trim();
    });
    if (!valid.length) return null;
    var wrap = el("div", "qp-stress");
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", QP.respell.toRespelling(valid));
    valid.forEach(function (s) {
      var stress = s.stress === 1 ? 1 : s.stress === 2 ? 2 : 0;
      var beat = el("div", "qp-beat qp-beat--" + stress);
      beat.title = stress === 1 ? "Primary stress" : stress === 2 ? "Secondary stress" : "Unstressed";
      beat.appendChild(el("div", "qp-beat__bar"));
      beat.appendChild(el("div", "qp-beat__text", String(s.text).trim()));
      wrap.appendChild(beat);
    });
    return wrap;
  }

  function accentRow(m, reading, a, featured, ctx, onPlay) {
    var view = accentView(m, reading, a);
    var row = el("div", "qp-pron-row");
    // The reader's own accent is the filled circle.
    var mine = a === featured;
    var tag = el("span", "qp-pron-row__accent" + (mine ? " qp-pron-row__accent--mine" : ""), accentLabel(a));
    if (mine) {
      tag.title = "Your accent";
      tag.setAttribute("role", "img");
      tag.setAttribute("aria-label", accentLabel(a) + ", your accent");
    }
    row.appendChild(tag);

    var main = el("div", "qp-pron-row__main");
    if (view.ipa) {
      main.appendChild(el("span", "qp-pron-row__ipa", view.ipa));
    } else {
      main.appendChild(
        el("span", "qp-pron-row__none", view.playable ? "Audio only" : "Not recorded for this meaning")
      );
    }
    row.appendChild(main);

    row.appendChild(
      makePlayButton(m.word, a, ctx, {
        icon: true,
        soft: a !== featured,
        readingId: reading ? reading.id : null,
        unavailable: !view.playable,
        onPlay: function () {
          onPlay(a);
        }
      })
    );
    return row;
  }

  // Stress bars and both accents for one reading (null: the word itself). The
  // reader's accent leads. The bars start on it and then follow whichever row
  // was last played, because the two accents can stress different syllables
  // (belay: UK /ˈbiːleɪ/, US /bɪˈleɪ/). An accent with no syllables of its own
  // leaves the bars as they are.
  function fillPronunciation(wrap, m, reading, ctx) {
    clear(wrap);
    var featured = ctx.accent === "uk" ? "uk" : "us";
    var other = featured === "us" ? "uk" : "us";

    var barsSlot = el("div", "qp-stress-slot");
    var barsAccent = null;
    function showBars(a) {
      if (a === barsAccent) return;
      var bars = makeStressBars(accentView(m, reading, a).syllables);
      if (!bars) return;
      clear(barsSlot);
      barsSlot.appendChild(bars);
      barsAccent = a;
      notifyResize(ctx);
    }
    showBars(featured);
    if (barsAccent === null) showBars(other);
    wrap.appendChild(barsSlot);

    var pron = el("div", "qp-pron");
    pron.appendChild(accentRow(m, reading, featured, featured, ctx, showBars));
    pron.appendChild(accentRow(m, reading, other, featured, ctx, showBars));
    wrap.appendChild(pron);
  }

  function makeSpeedControl() {
    var group = el("div", "qp-speed");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Playback speed");
    SPEEDS.forEach(function (rate) {
      var active = rate === playbackRate;
      var b = el("button", "qp-speed__opt qp-focusable" + (active ? " qp-speed__opt--active" : ""), rate + "\u00d7");
      b.type = "button";
      b.setAttribute("aria-pressed", active ? "true" : "false");
      b.addEventListener("click", function () {
        setPlaybackRate(rate);
        Array.prototype.forEach.call(group.children, function (o) {
          o.classList.remove("qp-speed__opt--active");
          o.setAttribute("aria-pressed", "false");
        });
        b.classList.add("qp-speed__opt--active");
        b.setAttribute("aria-pressed", "true");
      });
      group.appendChild(b);
    });
    return group;
  }

  // The section heading and the speed control share one line.
  function pronHead(title) {
    var head = el("div", "qp-pron-head");
    head.appendChild(el("div", "qp-label", title));
    head.appendChild(makeSpeedControl());
    return head;
  }

  // The "Meaning" heading, part-of-speech tabs and definitions for one list of
  // senses. These tabs are the only place the part of speech appears, so a word
  // with one sense still gets its label. Each tab swaps the definition in place;
  // nothing is re-fetched, every sense came back with the original lookup.
  function fillSenses(wrap, senses, ctx) {
    clear(wrap);
    if (!senses.length) return;

    var head = el("div", "qp-meaning-head");
    head.appendChild(el("div", "qp-label qp-label--amber", "Meaning"));
    var meaning = el("div", "qp-meaning");

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
            fillMeaning(meaning, s);
            meaning.classList.remove("qp-meaning--fading");
            notifyResize(ctx);
          }, 120);
        });
        senseRow.appendChild(tab);
      });
      head.appendChild(senseRow);
    } else if (senses[0].pos) {
      var onlyRow = el("div", "qp-senses");
      onlyRow.appendChild(el("span", "qp-sense qp-sense--active qp-sense--only", senses[0].pos));
      head.appendChild(onlyRow);
    }
    wrap.appendChild(head);
    fillMeaning(meaning, senses[0]);
    wrap.appendChild(meaning);
  }

  // Meanings no reading covers (surnames and the like): out of the way until
  // asked for, since they do not belong to any of the pronunciations shown.
  function makeOtherMeanings(otherSenses, ctx) {
    var wrap = el("div", "qp-other");
    var toggle = el("button", "qp-other__toggle qp-focusable", "Other meanings");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    var list = el("div", "qp-other__list");
    list.hidden = true;
    otherSenses.forEach(function (s) {
      if (s.pos) list.appendChild(el("div", "qp-other__pos", s.pos));
      (s.definitions && s.definitions.length ? s.definitions : s.definition ? [s.definition] : []).forEach(function (d) {
        list.appendChild(el("div", "qp-other__def", d));
      });
    });
    toggle.addEventListener("click", function () {
      list.hidden = !list.hidden;
      toggle.setAttribute("aria-expanded", list.hidden ? "false" : "true");
      notifyResize(ctx);
    });
    wrap.appendChild(toggle);
    wrap.appendChild(list);
    return wrap;
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

    // Heteronyms get one tab per reading. Everything below the tabs (stress
    // bars, IPA, audio, meanings) belongs to the chosen reading, so a tab
    // switch rebuilds those sections. Ordinary words have no tabs and one
    // implicit reading.
    var readings = m.readings && m.readings.length > 1 ? m.readings : null;

    body.appendChild(pronHead(readings ? readings.length + " pronunciations" : "Pronunciation"));

    var pronWrap = el("div", "qp-pron-wrap");
    var sensesWrap = el("div", "qp-senses-wrap");

    function showReading(reading) {
      fillPronunciation(pronWrap, m, reading, ctx);
      fillSenses(sensesWrap, reading ? reading.senses || [] : senses, ctx);
    }

    if (readings) {
      var tabRow = el("div", "qp-readings");
      QP.readings.tabLabels(readings, accent).forEach(function (label, i) {
        var tab = el("button", "qp-reading qp-focusable" + (i === 0 ? " qp-reading--active" : ""), label);
        tab.type = "button";
        tab.setAttribute("aria-pressed", i === 0 ? "true" : "false");
        tab.addEventListener("click", function () {
          if (tab.classList.contains("qp-reading--active")) return;
          Array.prototype.forEach.call(tabRow.children, function (t) {
            t.classList.remove("qp-reading--active");
            t.setAttribute("aria-pressed", "false");
          });
          tab.classList.add("qp-reading--active");
          tab.setAttribute("aria-pressed", "true");
          // Nothing from the old reading may keep playing, or start late.
          stopPlayback(ctx);
          resetPlayButtons(pronWrap);
          showReading(readings[i]);
          notifyResize(ctx);
        });
        tabRow.appendChild(tab);
      });
      body.appendChild(tabRow);
    }

    body.appendChild(pronWrap);
    body.appendChild(sensesWrap);
    showReading(readings ? readings[0] : null);

    if (readings && m.otherSenses && m.otherSenses.length) {
      body.appendChild(makeOtherMeanings(m.otherSenses, ctx));
    }

    card.appendChild(body);

    // The service worker only attaches ratePrompt for engaged installs (see
    // ratePrompt.js); the popup never shows it.
    if (view.ratePrompt && !ctx.compact) card.appendChild(renderRatePrompt(view.ratePrompt, ctx));

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

  // One short paragraph above the footer, ending in the two choices.
  // Answering swaps it for a one-line acknowledgement, and the box shrinks
  // to fit that line.
  function renderRatePrompt(prompt, ctx) {
    var second = prompt.variant === "second";
    var box = el("div", "qp-rate");
    box.appendChild(
      el(
        "span",
        "qp-rate__text",
        second
          ? "Still finding it useful? A rating takes a few seconds."
          : "Finding QuickPronounce useful? A quick rating helps other learners find it."
      )
    );

    // The choices end the sentence: read the question, then reach the
    // buttons. They wrap together as one unit, never split across lines.
    box.appendChild(document.createTextNode(" "));
    var actions = el("span", "qp-rate__actions");
    function answer(action, thanks) {
      clear(box);
      box.appendChild(el("span", "qp-rate__text", thanks));
      ctx.onRatePrompt(action);
    }

    var rate = el("button", "qp-rate__go qp-focusable", "Rate it");
    rate.type = "button";
    rate.addEventListener("click", function () {
      ctx.openUrl(QP.config.REVIEWS_URL);
      answer("rate", "Thank you, that really helps.");
    });
    actions.appendChild(rate);

    // The first showing's "Not now" asks again once (REASK_DELAY_MS later);
    // the second showing's "No thanks" ends it.
    var out = second
      ? el("button", "qp-rate__btn qp-focusable", "No thanks")
      : el("button", "qp-rate__btn qp-focusable", "Not now");
    out.type = "button";
    out.addEventListener("click", function () {
      if (second) answer("dismiss", "Got it, we won't ask again.");
      else answer("later", "Okay, we'll ask another time.");
    });
    actions.appendChild(out);

    box.appendChild(actions);
    return box;
  }

  // Lets content.js take the prompt off a card that's still open when it was
  // answered somewhere else (another tab). A prompt already answered on this
  // card (its buttons replaced by the acknowledgement) is left alone.
  function removeRatePrompt(root) {
    var node = root && root.querySelector && root.querySelector(".qp-rate");
    if (node && node.querySelector(".qp-rate__actions") && node.parentNode) node.parentNode.removeChild(node);
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

    body.appendChild(pronHead("Pronunciation"));
    body.appendChild(el("div", "qp-placeholder", "IPA and syllables not available yet."));

    var audioRow = el("div", "qp-audio");
    audioRow.appendChild(makePlayButton(word, "us", ctx));
    audioRow.appendChild(makePlayButton(word, "uk", ctx));
    body.appendChild(audioRow);

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
    sendRuntimeMessage({ type: "PLAY_AUDIO", base64: base64, format: format, rate: playbackRate }).then(function (resp) {
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

  // opts (all optional):
  //   icon         round icon-only button, for inside an accent row
  //   soft         tinted instead of the solid gradient (the other accent)
  //   readingId    play this heteronym reading; never falls back to plain audio
  //   unavailable  this reading has no pronunciation in this accent
  //   onPlay       called when the user starts this button's audio
  function makePlayButton(word, accent, ctx, opts) {
    opts = opts || {};
    var readingId = opts.readingId || null;
    var base =
      "qp-play qp-focusable" + (opts.icon ? " qp-play--icon" : "") + (opts.soft ? " qp-play--soft" : "");
    var btn = el("button", base);
    btn.type = "button";
    var label = accentLabel(accent);
    var btnText = opts.icon ? "" : "<span>Play " + label + "</span>";

    if (opts.unavailable) {
      btn.disabled = true;
      btn.innerHTML = SPEAKER;
      btn.title = "Not available in this accent";
      btn.setAttribute("aria-label", "Not available in this accent");
      return btn;
    }

    setIdle();

    var state = "idle";
    var killTimer = null;

    function setIdle() {
      btn.disabled = false;
      btn.className = base;
      btn.innerHTML = SPEAKER + btnText;
      btn.removeAttribute("title");
      btn.setAttribute("aria-label", "Play " + label + " pronunciation of " + word);
    }
    function setLoading() {
      btn.disabled = true;
      btn.className = base;
      btn.innerHTML = '<span class="qp-play__spin"></span>' + btnText;
    }
    function setPlaying() {
      btn.disabled = false;
      btn.className = base + " qp-play--playing";
      btn.innerHTML = EQUALIZER + btnText;
    }
    function setError(msg) {
      btn.disabled = false;
      btn.className = base + " qp-play--error";
      btn.innerHTML = SPEAKER + btnText;
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
      if (opts.onPlay) opts.onPlay();

      // replay from cache if we already have the audio
      var cached = QP.audioCache.get(word, accent, readingId);
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
        .requestAudio(word, accent, readingId)
        .then(function (res) {
          done();
          if (state !== "loading") return; // timed out already; ignore a late reply
          if (!res || !res.ok || !res.base64) {
            state = "idle";
            if (res && res.kind === "rate_limited") setError("Busy, try again shortly");
            else if (res && res.kind === "not_found") setError("No audio for this word");
            else if (res && res.kind === "reading_unavailable") setError("Not available in this accent");
            else setError("Could not load audio");
            return;
          }
          QP.audioCache.put(word, accent, res.base64, res.format, readingId);
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
    var scope = keepBtn.closest(".qp-card, .qp-rchips");
    if (!scope) return;
    Array.prototype.forEach.call(scope.querySelectorAll("button"), function (b) {
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

  // One recent word as a chip: its play button, then the word. Playing costs no
  // lookup. onOpen (optional) makes the word open its full card.
  function makeRecentChip(item, accent, ctx, onOpen) {
    var a = accent === "uk" ? "uk" : "us";
    var reading = item.defaultReading || null;
    var chip = el("li", "qp-rchip");
    chip.appendChild(
      makePlayButton(item.word, a, ctx, {
        icon: true,
        soft: true,
        readingId: reading ? reading.id : null,
        unavailable: !!(reading && reading.inherited && reading.inherited[a])
      })
    );
    if (onOpen) {
      var open = el("button", "qp-rchip__word qp-rchip__word--open qp-focusable", item.word);
      open.type = "button";
      open.addEventListener("click", onOpen);
      chip.appendChild(open);
    } else {
      chip.appendChild(el("span", "qp-rchip__word", item.word));
    }
    return chip;
  }

  // "2h 41m" / "41m" / "1m"; never "0m" while something is still counting down.
  function formatWait(ms) {
    var minutes = Math.max(1, Math.ceil(ms / 60000));
    var hours = Math.floor(minutes / 60);
    return hours ? hours + "h " + (minutes % 60) + "m" : minutes + "m";
  }

  // Lookups come back one at a time as each ages out of the rolling window, so
  // the ring shows how far the next one has come. The limit itself is not shown.
  function makeRecharge(resetsAt) {
    var wrap = el("div", "qp-recharge");
    var left = Math.max(0, resetsAt - Date.now());
    var windowMs = QP.config.CAP_WINDOW_MS;
    var circumference = 2 * Math.PI * 52;
    var done = Math.min(1, Math.max(0, 1 - left / windowMs));
    wrap.innerHTML =
      '<svg class="qp-recharge__ring" viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle class="qp-recharge__track" cx="60" cy="60" r="52"></circle>' +
      '<circle class="qp-recharge__fill" cx="60" cy="60" r="52" stroke-dasharray="' +
      (circumference * done).toFixed(1) + " " + circumference.toFixed(1) +
      '"></circle></svg>';
    var text = el("div", "qp-recharge__text");
    text.appendChild(el("div", "qp-recharge__time", formatWait(left)));
    text.appendChild(el("div", "qp-recharge__sub", "until your next lookup"));
    wrap.appendChild(text);
    return wrap;
  }

  function renderCap(root, view, ctx) {
    var usage = view.usage || {};
    var card = el("div", cardClass(ctx));
    card.appendChild(el("div", "qp-card__bar"));
    var body = el("div", "qp-cap");

    if (usage.resetsAt) body.appendChild(makeRecharge(usage.resetsAt));
    body.appendChild(el("div", "qp-cap__title", "Your lookups are recharging"));
    body.appendChild(
      el("div", "qp-cap__sub", "You've used all your free lookups for now. They come back one at a time over 24 hours.")
    );

    var plus = el("button", "qp-cap__cta qp-focusable", "Join the Plus waitlist");
    plus.type = "button";
    plus.addEventListener("click", function () {
      ctx.openUrl(QP.config.PLUS_URL);
    });
    body.appendChild(plus);

    var siteUrl = view.word ? QP.config.wordUrl(view.word) : QP.config.SITE_URL;
    var site = el("a", "qp-link qp-cap__site qp-focusable", "Or look it up on quickpronounce.site");
    site.href = siteUrl;
    site.addEventListener("click", function (e) {
      e.preventDefault();
      ctx.openUrl(siteUrl);
    });
    body.appendChild(site);
    card.appendChild(body);

    // The popup has its own Recent list right below the card.
    var recents = !ctx.compact && Array.isArray(view.recents) ? view.recents.slice(0, 4) : [];
    if (recents.length) {
      var still = el("div", "qp-cap__still");
      var stillHead = el("div", "qp-cap__still-head");
      stillHead.appendChild(el("div", "qp-label", "Still playable"));
      stillHead.appendChild(el("span", "qp-cap__still-note", "Replays are always free"));
      still.appendChild(stillHead);
      var list = el("ul", "qp-rchips");
      recents.forEach(function (item) {
        list.appendChild(makeRecentChip(item, ctx.accent, ctx));
      });
      still.appendChild(list);
      card.appendChild(still);
    }

    if (!ctx.compact) {
      var foot = el("div", "qp-foot");
      var close = el("button", "qp-link qp-focusable", "Dismiss");
      close.type = "button";
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
    ctx.onRatePrompt = ctx.onRatePrompt || function () {};

    if (view.kind === "loading") return renderLoading(root, view, ctx);

    switch (view.state) {
      case "ok":
        return renderOk(root, view, ctx);
      case "not_found":
        return renderNotFound(root, view, ctx);
      case "cap":
        return renderCap(root, view, ctx);
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

  QP.card = {
    render: render,
    stopPlayback: stopPlayback,
    removeRatePrompt: removeRatePrompt,
    makeRecentChip: makeRecentChip
  };
})();
