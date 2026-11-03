/* ============================================================
   player.js — 播放时钟
   ============================================================ */
(function () {
  "use strict";
  var Axis = window.Axis = window.Axis || {};

  var player = {
    playing: false,
    speed: 1,
    direction: 1,
    _raf: 0,
    _last: 0,
    _pauseUntil: 0
  };

  player.play = function () {
    if (this.playing) return;
    var app = Axis.app;
    if (!app) return;
    var range = Axis.data.tabRange(app.state.tab);
    if (this.direction > 0 && app.state.year >= range[1] - 0.01) {
      app.setYear(range[0], { autoSelect: true });
    } else if (this.direction < 0 && app.state.year <= range[0] + 0.01) {
      app.setYear(range[1], { autoSelect: true });
    }
    this.playing = true;
    this._last = performance.now();
    this._pauseUntil = 0;
    app.setPlayingUI();
    this._loop();
  };

  player.pause = function () {
    if (!this.playing) return;
    this.playing = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (Axis.app) Axis.app.setPlayingUI();
  };

  player.toggle = function () {
    if (this.playing) this.pause();
    else this.play();
  };

  player.setSpeed = function (s) {
    this.speed = Math.max(0.25, Math.min(8, s || 1));
  };

  player.setDirection = function (d) {
    this.direction = d < 0 ? -1 : 1;
  };

  player.pauseFor = function (ms) {
    this._pauseUntil = performance.now() + ms;
  };

  player._loop = function (ts) {
    if (!this.playing) { this._raf = 0; return; }
    var now = ts || performance.now();
    if (!this._last) this._last = now;
    var dt = Math.min(0.1, (now - this._last) / 1000);
    this._last = now;
    if (now >= this._pauseUntil) Axis.app.playbackTick(dt);
    this._raf = requestAnimationFrame(this._loop.bind(this));
  };

  Axis.player = player;
})();
