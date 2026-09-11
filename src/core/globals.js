/*
 * Shared namespace bootstrap.
 *
 * Loaded first in every context: the service worker (via importScripts), the
 * content script (via the manifest js list), and the popup/options pages (via
 * <script> tags). Every other module in this extension hangs its exports off
 * `self.QP`. No bundler, no ES modules: content scripts can't be modules, so
 * the whole extension stays classic-script + one global object.
 */
(function () {
  var root = typeof self !== "undefined" ? self : this;
  root.QP = root.QP || {};
})();
