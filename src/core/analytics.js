/*
 * Local-only instrumentation. NOTHING here goes to a network. Events are
 * appended to a ring buffer in chrome.storage.local so that, later, a
 * privacy-friendly analytics sink can be wired in behind this exact
 * interface without touching any call site.
 *
 * Measured events (per the MVP validation goals):
 *   extension_installed   first run
 *   first_lookup          the very first successful/attempted lookup, once
 *   lookup                any lookup that reached the API ({found:true|false})
 *   cached_lookup         served from the in-memory session cache
 *   cap_hit               a lookup blocked by the daily limit
 *   recent_word_opened    a recent-words entry reopened from the popup
 *   popup_opened          the toolbar popup was opened
 */
(function () {
  var QP = (self.QP = self.QP || {});

  var EVENTS = {
    INSTALLED: "extension_installed",
    FIRST_LOOKUP: "first_lookup",
    LOOKUP: "lookup",
    CACHED_LOOKUP: "cached_lookup",
    CAP_HIT: "cap_hit",
    RECENT_OPENED: "recent_word_opened",
    POPUP_OPENED: "popup_opened"
  };

  async function track(event, props) {
    try {
      var buf = await QP.store.getAnalyticsBuffer();
      buf.push({ event: event, props: props || {}, ts: Date.now() });
      var max = QP.config.ANALYTICS_BUFFER_MAX;
      if (buf.length > max) buf = buf.slice(buf.length - max);
      await QP.store.setAnalyticsBuffer(buf);
    } catch (e) {
      /* instrumentation must never break a user action */
    }
  }

  async function summary() {
    var buf = await QP.store.getAnalyticsBuffer();
    var counts = {};
    buf.forEach(function (e) {
      counts[e.event] = (counts[e.event] || 0) + 1;
    });
    return {
      total: buf.length,
      counts: counts,
      firstAt: buf.length ? buf[0].ts : null,
      lastAt: buf.length ? buf[buf.length - 1].ts : null
    };
  }

  function all() {
    return QP.store.getAnalyticsBuffer();
  }

  async function clear() {
    await QP.store.setAnalyticsBuffer([]);
  }

  QP.analytics = { EVENTS: EVENTS, track: track, summary: summary, all: all, clear: clear };
})();
