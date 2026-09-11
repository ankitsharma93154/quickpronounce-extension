/*
 * Rolling-window "unique new words" limit. Not a security boundary: it is
 * client-side and easily reset. Its only job is to make the free ceiling real
 * enough to measure how many users hit it.
 *
 * A word already looked up inside the window is "known" and free to replay:
 * it does not consume another slot. A word that has aged out of the window is
 * a fresh lookup again.
 */
(function () {
  var QP = (self.QP = self.QP || {});

  function prune(ledger) {
    var cutoff = Date.now() - QP.config.CAP_WINDOW_MS;
    var out = {};
    Object.keys(ledger).forEach(function (w) {
      if (typeof ledger[w] === "number" && ledger[w] >= cutoff) out[w] = ledger[w];
    });
    return out;
  }

  function usageFrom(ledger) {
    var cfg = QP.config;
    var words = Object.keys(ledger);
    var oldest = words.length
      ? words.reduce(function (min, w) {
          return ledger[w] < min ? ledger[w] : min;
        }, Infinity)
      : null;
    return {
      used: words.length,
      limit: cfg.DAILY_UNIQUE_WORD_LIMIT,
      remaining: Math.max(0, cfg.DAILY_UNIQUE_WORD_LIMIT - words.length),
      resetsAt: oldest ? oldest + cfg.CAP_WINDOW_MS : null
    };
  }

  // Peek without writing.
  async function snapshot() {
    var ledger = prune(await QP.store.getCapLedger());
    await QP.store.setCapLedger(ledger);
    return usageFrom(ledger);
  }

  // Attempt to register a lookup for `word`.
  // Returns { allowed, consumed, alreadyKnown, usage }.
  async function record(word) {
    var cfg = QP.config;
    var ledger = prune(await QP.store.getCapLedger());

    if (Object.prototype.hasOwnProperty.call(ledger, word)) {
      await QP.store.setCapLedger(ledger);
      return { allowed: true, consumed: false, alreadyKnown: true, usage: usageFrom(ledger) };
    }
    if (Object.keys(ledger).length >= cfg.DAILY_UNIQUE_WORD_LIMIT) {
      await QP.store.setCapLedger(ledger);
      return { allowed: false, consumed: false, alreadyKnown: false, usage: usageFrom(ledger) };
    }
    ledger[word] = Date.now();
    await QP.store.setCapLedger(ledger);
    return { allowed: true, consumed: true, alreadyKnown: false, usage: usageFrom(ledger) };
  }

  async function reset() {
    await QP.store.setCapLedger({});
  }

  QP.cap = { snapshot: snapshot, record: record, reset: reset };
})();
