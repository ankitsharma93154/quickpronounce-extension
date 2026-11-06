/*
 * Light / dark choice from Settings. "system" (the default) leaves the colours
 * to the OS through each stylesheet's prefers-color-scheme block; "light" and
 * "dark" set data-qp-theme on an element, and the stylesheets give that
 * attribute priority over the OS.
 *
 * Extension pages (popup, options) load this in <head>, so the saved choice
 * from localStorage applies before the first paint and they don't flash the
 * wrong colours while chrome.storage answers. The content script only uses
 * apply(), on its own element: it runs inside other sites' pages, and must
 * never touch their localStorage or their <html>.
 */
(function () {
  var QP = (self.QP = self.QP || {});

  var ATTR = "data-qp-theme";
  var CACHE_KEY = "qpTheme";

  function normalize(value) {
    return value === "light" || value === "dark" ? value : "system";
  }

  function apply(el, value) {
    if (!el) return;
    var theme = normalize(value);
    if (theme === "system") el.removeAttribute(ATTR);
    else el.setAttribute(ATTR, theme);
  }

  // Extension pages only.
  function applyToPage(value) {
    apply(document.documentElement, value);
    try {
      localStorage.setItem(CACHE_KEY, normalize(value));
    } catch (e) {
      /* no storage: chrome.storage still applies it, slightly later */
    }
  }

  QP.theme = { normalize: normalize, apply: apply, applyToPage: applyToPage };

  if (typeof location !== "undefined" && /-extension:$/.test(location.protocol)) {
    try {
      apply(document.documentElement, localStorage.getItem(CACHE_KEY));
    } catch (e) {
      /* first paint follows the OS; the page corrects it once settings load */
    }
  }
})();
