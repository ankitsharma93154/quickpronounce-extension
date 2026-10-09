/*
 * "Rate it" prompt for engaged users. Decides, after a successful lookup,
 * whether the on-page card should carry a one-line rating request. All of
 * it is local: nothing here touches the network, and the only thing the
 * user can be sent to is the Chrome Web Store reviews page.
 *
 * Who sees it (all three, see config RATE_PROMPT):
 *   - installed at least MIN_INSTALL_DAYS ago (installMeta.installedAt)
 *   - successful lookups on at least MIN_ACTIVE_DAYS distinct local days
 *   - at least MIN_LOOKUPS successful lookups in total
 *
 * How often: at most MAX_SHOWS impressions, ever. An impression (answered or
 * not) holds the next one back by REASK_DELAY_MS. "Rate it" (either showing)
 * and "No thanks" (second showing) end it for good; "Not now" (first
 * showing) leaves the one re-ask in place.
 *
 * Installs that predate this feature are seeded once from the local
 * analytics ring buffer (analytics.js), so existing regulars don't start from
 * zero. A full buffer only covers the last few days of a heavy user, which
 * would undercount their active days, so a full buffer counts as meeting the
 * active-days condition on its own.
 *
 * State lives under the `ratePrompt` storage key:
 *   { seeded, fullHistory, activeDays: ["YYYY-MM-DD"], lookups,
 *     shows, nextAt, done }
 */
(function () {
  var QP = (self.QP = self.QP || {});

  var DAY_MS = 24 * 60 * 60 * 1000;
  var MAX_DAYS_KEPT = 30; // only the count matters; keep the list bounded

  function localDay(ts) {
    var d = new Date(ts);
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function normalize(s) {
    s = s && typeof s === "object" ? s : {};
    return {
      seeded: !!s.seeded,
      fullHistory: !!s.fullHistory,
      activeDays: Array.isArray(s.activeDays) ? s.activeDays.slice(-MAX_DAYS_KEPT) : [],
      lookups: Number(s.lookups) || 0,
      shows: Number(s.shows) || 0,
      nextAt: Number(s.nextAt) || 0,
      done: !!s.done
    };
  }

  function addDay(state, day) {
    if (state.activeDays.indexOf(day) === -1) {
      state.activeDays.push(day);
      if (state.activeDays.length > MAX_DAYS_KEPT) state.activeDays = state.activeDays.slice(-MAX_DAYS_KEPT);
    }
  }

  // Pure: build the starting counters from the analytics buffer. Counts the
  // same things recordLookup counts going forward: lookups that reached an
  // answer (found, from the API or the offline copy) and session-cache hits.
  function seedFrom(buffer) {
    var state = normalize({ seeded: true });
    var events = Array.isArray(buffer) ? buffer : [];
    var EV = QP.analytics ? QP.analytics.EVENTS : { LOOKUP: "lookup", CACHED_LOOKUP: "cached_lookup" };
    events.forEach(function (e) {
      if (!e || typeof e.ts !== "number") return;
      var counts =
        e.event === EV.CACHED_LOOKUP || (e.event === EV.LOOKUP && e.props && e.props.found === true);
      if (!counts) return;
      state.lookups++;
      addDay(state, localDay(e.ts));
    });
    state.fullHistory = events.length >= QP.config.ANALYTICS_BUFFER_MAX;
    return state;
  }

  // Pure: is this install eligible, and is an impression due right now?
  function due(state, installedAt, now) {
    var cfg = QP.config.RATE_PROMPT;
    if (state.done || state.shows >= cfg.MAX_SHOWS) return false;
    if (now < state.nextAt) return false;
    if (!installedAt || now - installedAt < cfg.MIN_INSTALL_DAYS * DAY_MS) return false;
    if (state.lookups < cfg.MIN_LOOKUPS) return false;
    return state.fullHistory || state.activeDays.length >= cfg.MIN_ACTIVE_DAYS;
  }

  async function load() {
    var state = normalize(await QP.store.getRatePrompt());
    if (state.seeded) return state;
    state = seedFrom(await QP.store.getAnalyticsBuffer());
    // Every public build has set installedAt on install; if it's somehow
    // missing, start the clock now rather than treat the install as old.
    var meta = await QP.store.getMeta();
    if (!meta.installedAt) await QP.store.setMeta({ installedAt: Date.now() });
    await QP.store.setRatePrompt(state);
    return state;
  }

  // Seeds counters if this install has never been seeded (called on update,
  // and lazily from onSuccessfulLookup in case that event was missed).
  async function ensureSeeded() {
    await load();
  }

  // Call once per successful lookup. Records the activity and returns
  // { variant: "first" | "second" } when this card should carry the prompt,
  // or null. Returning a variant counts as the impression.
  async function onSuccessfulLookup(opts) {
    opts = opts || {};
    var now = Date.now();
    var state = await load();
    state.lookups++;
    addDay(state, localDay(now));

    var show = null;
    if (opts.canShow) {
      var meta = await QP.store.getMeta();
      if (due(state, meta.installedAt, now)) {
        show = { variant: state.shows === 0 ? "first" : "second" };
        state.shows++;
        state.nextAt = now + QP.config.RATE_PROMPT.REASK_DELAY_MS;
        // Not marking `done` at MAX_SHOWS here: due() already stops further
        // impressions, and `done` going true is what tells other tabs to pull
        // the prompt, which would also pull it from the card just shown.
      }
    }
    await QP.store.setRatePrompt(state);
    return show;
  }

  // action: "rate" | "later" | "dismiss"
  async function respond(action) {
    var state = await load();
    if (action === "rate" || action === "dismiss") state.done = true;
    // "later": nothing to change, the impression already pushed nextAt out.
    await QP.store.setRatePrompt(state);
    return state;
  }

  QP.ratePrompt = {
    localDay: localDay,
    seedFrom: seedFrom,
    due: due,
    ensureSeeded: ensureSeeded,
    onSuccessfulLookup: onSuccessfulLookup,
    respond: respond
  };
})();
