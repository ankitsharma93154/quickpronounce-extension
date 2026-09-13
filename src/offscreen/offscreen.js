/*
 * Offscreen document: the only place audio actually plays.
 *
 * A host page's Content-Security-Policy applies to everything living in that
 * page's own DOM, including a blob: URL handed to an <audio> element the
 * content script created there. Some sites' CSP has no media-src and falls
 * back to a default-src that doesn't allow blob: at all, so on-page playback
 * gets silently blocked no matter how fast the audio arrived.
 *
 * This page is served from chrome-extension://<id>/..., a separate origin
 * with its own CSP, so the same blob: URL built here is never subject to the
 * host page's policy. The content script / popup only relay the base64 audio
 * through the background service worker and get playback state back; the
 * Blob and <audio> element live here for good.
 *
 * Only one clip plays at a time (mirrors the old shared-Audio-per-card
 * behavior), tagged with a playbackId so a caller can tell a fresh "ended"/
 * "error" apart from one belonging to a clip it already moved on from.
 */
(function () {
  var QP = self.QP;

  var audio = new Audio();
  var activeId = null;
  var activeUrl = null;

  function revokeActiveUrl() {
    if (activeUrl) {
      try {
        URL.revokeObjectURL(activeUrl);
      } catch (e) {
        /* noop */
      }
      activeUrl = null;
    }
  }

  function broadcast(playbackId, event, extra) {
    var payload = Object.assign({ type: "AUDIO_EVENT", playbackId: playbackId, event: event }, extra || {});
    chrome.runtime.sendMessage(payload, function () {
      void chrome.runtime.lastError; // no listener left (card closed/tab gone) is fine
    });
  }

  // playbackId == null means "whatever is currently active" (used when a
  // card closes and the caller may not know/care which clip was playing).
  function stop(playbackId) {
    if (playbackId != null && playbackId !== activeId) return;
    var stoppedId = activeId;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {
      /* noop */
    }
    revokeActiveUrl();
    activeId = null;
    if (stoppedId != null) broadcast(stoppedId, "stopped");
  }

  function play(playbackId, base64, format) {
    var previousId = activeId;
    try {
      audio.pause();
    } catch (e) {
      /* noop */
    }
    revokeActiveUrl();
    if (previousId != null) broadcast(previousId, "stopped");

    activeId = playbackId;

    var bytes, blob;
    try {
      bytes = QP.util.base64ToBytes(base64);
      blob = new Blob([bytes], { type: format || "audio/mpeg" });
      activeUrl = URL.createObjectURL(blob);
    } catch (e) {
      activeId = null;
      broadcast(playbackId, "error", { message: "Could not play audio" });
      return;
    }

    audio.src = activeUrl;
    audio.onended = function () {
      if (activeId !== playbackId) return;
      activeId = null;
      revokeActiveUrl();
      broadcast(playbackId, "ended");
    };
    audio.onerror = function () {
      if (activeId !== playbackId) return;
      activeId = null;
      revokeActiveUrl();
      broadcast(playbackId, "error", { message: "Could not play audio" });
    };

    var p = audio.play();
    if (p && p.catch) {
      p.then(function () {
        if (activeId !== playbackId) return;
        broadcast(playbackId, "playing");
      }).catch(function () {
        if (activeId !== playbackId) return;
        activeId = null;
        revokeActiveUrl();
        broadcast(playbackId, "error", { message: "Playback blocked" });
      });
    } else {
      broadcast(playbackId, "playing");
    }
  }

  chrome.runtime.onMessage.addListener(function (msg) {
    if (!msg || !msg.type) return;
    if (msg.type === "OFFSCREEN_PLAY") {
      play(msg.playbackId, msg.base64, msg.format);
      return;
    }
    if (msg.type === "OFFSCREEN_STOP") {
      stop(msg.playbackId);
      return;
    }
  });
})();
