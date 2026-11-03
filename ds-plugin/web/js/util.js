/* ============================================================
   util.js — 基础工具
   ============================================================ */
(function () {
  "use strict";
  var Axis = window.Axis = window.Axis || {};

  var U = {
    $: function (sel, root) { return (root || document).querySelector(sel); },
    $$: function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },
    esc: function (s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    pad2: function (n) { return n < 10 ? "0" + n : "" + n; },
    fmtYear: function (y) { return String(Math.floor(y + 1e-6)); },
    yearFloor: function (y) { return Math.floor(y + 1e-6); },
    debounce: function (fn, ms) {
      var t;
      return function () {
        var args = arguments, self = this;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(self, args); }, ms);
      };
    },
    rafThrottle: function (fn) {
      var queued = false, lastArgs;
      return function () {
        lastArgs = arguments;
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () {
          queued = false;
          fn.apply(null, lastArgs);
        });
      };
    },
    colorAlpha: function (hex, a) {
      hex = String(hex || "").replace("#", "");
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      var n = parseInt(hex, 16);
      if (!isFinite(n)) return "rgba(201,164,92," + a + ")";
      return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
    },
    mixHex: function (hexA, hexB, t) {
      function parse(h) {
        h = h.replace("#", "");
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      }
      var a = parse(hexA), b = parse(hexB);
      return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * t) + "," +
        Math.round(a[1] + (b[1] - a[1]) * t) + "," +
        Math.round(a[2] + (b[2] - a[2]) * t) + ")";
    },
    textWidth: function (text, fontSize) {
      // rough CJK-aware width estimate, good enough for label collision
      var w = 0;
      for (var i = 0; i < text.length; i++) {
        var c = text.charCodeAt(i);
        w += c > 255 ? fontSize : fontSize * 0.56;
      }
      return w;
    },
    toast: function (msg) {
      var el = U.$("#toast");
      if (!el) return;
      el.textContent = msg;
      el.hidden = false;
      el.classList.add("show");
      clearTimeout(U._toastTimer);
      U._toastTimer = setTimeout(function () {
        el.classList.remove("show");
        setTimeout(function () { el.hidden = true; }, 220);
      }, 1700);
    },
    svgEl: function (tag, attrs) {
      var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
      if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
      return el;
    }
  };

  Axis.util = U;
  Axis.NS = "http://www.w3.org/2000/svg";
})();
