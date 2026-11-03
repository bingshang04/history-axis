/* ============================================================
   timeline.js — 底部时间轴：刻度、事件节点、标签、播放头、拖拽扫年
   ============================================================ */
(function () {
  "use strict";
  var Axis = window.Axis = window.Axis || {};
  var U = Axis.util;

  var PAD = 26;
  var LABEL_TOP = 18;
  var ROW_H = 23;
  var REL_COLORS = { cause: "#7a9ec4", promote: "#c9a45c", turn: "#c07c54", block: "#b05846" };

  var timeline = {
    tab: "shigang",
    start: 1840,
    end: 2025,
    innerW: 1000,
    items: [],
    dotEls: {},
    labelEls: {},
    extraLabel: null,
    selected: null,
    year: 1840,
    _dragging: false,
    _labelData: []
  };

  function $(id) { return document.getElementById(id); }

  timeline.init = function () {
    var self = this;
    this.canvas = $("tlCanvas");
    this.bands = $("tlBands");
    this.labels = $("tlLabels");
    this.dots = $("tlDots");
    this.ruler = $("tlRuler");
    this.playhead = $("tlPlayhead");
    this.playheadYear = $("tlPlayheadYear");
    this.posEl = $("tlPos");
    this.noteEl = $("tlNote");
    this.linkSvg = $("tlLinks");
    this.initLinkMarkers();
    this.canvas.addEventListener("pointerdown", function (e) { self.onPointerDown(e); });
    this.canvas.addEventListener("pointermove", function (e) { self.onPointerMove(e); });
    window.addEventListener("pointerup", function () { self._dragging = false; });
    this.canvas.addEventListener("pointerleave", function () { self._dragging = false; });
    this.setTab(this.tab);
  };

  timeline.initLinkMarkers = function () {
    if (!this.linkSvg) return;
    var NS = "http://www.w3.org/2000/svg";
    var defs = document.createElementNS(NS, "defs");
    [
      ["tlarrow-cause", "#7a9ec4"],
      ["tlarrow-promote", "#c9a45c"],
      ["tlarrow-turn", "#c07c54"],
      ["tlarrow-block", "#b05846"]
    ].forEach(function (m) {
      var marker = document.createElementNS(NS, "marker");
      marker.setAttribute("id", m[0]);
      marker.setAttribute("viewBox", "0 0 10 10");
      marker.setAttribute("refX", "8");
      marker.setAttribute("refY", "5");
      marker.setAttribute("markerWidth", "5");
      marker.setAttribute("markerHeight", "5");
      marker.setAttribute("orient", "auto-start-reverse");
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", "M0 0 L10 5 L0 10 z");
      p.setAttribute("fill", m[1]);
      marker.appendChild(p);
      defs.appendChild(marker);
    });
    var layer = document.createElementNS(NS, "g");
    layer.setAttribute("id", "tlRelationLayer");
    this.linkSvg.appendChild(defs);
    this.linkSvg.appendChild(layer);
    this.linkLayer = layer;
  };

  timeline.setTab = function (tab) {
    this.tab = tab;
    var range = Axis.data.tabRange(tab);
    this.start = range[0];
    this.end = range[1];
    this.items = Axis.data.itemsFor(tab);
    this.render();
  };

  timeline.x = function (year) {
    return PAD + (U.clamp(year, this.start, this.end) - this.start) / (this.end - this.start) * this.innerW;
  };

  timeline.render = function () {
    if (!this.canvas) return;
    var cw = this.canvas.clientWidth;
    this.innerW = Math.max(120, cw - PAD * 2);
    this.bands.textContent = "";
    this.labels.textContent = "";
    this.dots.textContent = "";
    this.ruler.textContent = "";
    this.dotEls = {};
    this.labelEls = {};
    this._labelData = [];
    if (this.extraLabel) { this.extraLabel.remove(); this.extraLabel = null; }

    this.renderBands();
    this.renderTicks();
    this.renderDots();
    this.renderLabels();
    this.updateYear(this.year, true);
    this.updateSelection(this.selected);
    this.updateNote();
  };

  timeline.updateNote = function () {
    if (this.noteEl) this.noteEl.textContent = this.start + " — " + this.end + " · 拖拽扫年 · 共 " + this.items.length + " 个节点";
  };

  timeline.renderBands = function () {
    var vols = Axis.data.volumes(this.tab);
    var self = this;
    vols.forEach(function (v) {
      var x1 = self.x(Math.max(self.start, v.from));
      var x2 = self.x(Math.min(self.end, v.to));
      if (x2 - x1 < 2) return;
      var d = document.createElement("div");
      d.className = "tl-band";
      d.style.left = (x1 - PAD) + "px";
      d.style.width = (x2 - x1) + "px";
      var lab = document.createElement("div");
      lab.className = "tl-band-label";
      lab.textContent = v.label;
      d.appendChild(lab);
      self.bands.appendChild(d);
    });
  };

  timeline.renderTicks = function () {
    var span = this.end - this.start;
    var pxPerYear = this.innerW / span;
    var labelStep = pxPerYear >= 6.2 ? 5 : pxPerYear >= 3.8 ? 10 : 20;
    var majorYears = [1840, 1919, 1949, 1978, 2012, 2021, 2025];
    var has = {};
    for (var y = this.start; y <= this.end + 1e-6; y += labelStep) {
      var yy = Math.round(y);
      if (yy > this.end) break;
      var tick = document.createElement("div");
      tick.className = "tl-tick major";
      tick.style.left = (this.x(yy) - PAD) + "px";
      this.ruler.appendChild(tick);
      if (!has[yy]) {
        has[yy] = true;
        var lab = document.createElement("div");
        lab.className = "tl-tick-label major";
        lab.style.left = (this.x(yy) - PAD) + "px";
        lab.textContent = yy;
        this.ruler.appendChild(lab);
      }
    }
    // 关键年份补标（避开已有标签）
    var self = this;
    majorYears.forEach(function (yy) {
      if (yy < self.start || yy > self.end) return;
      if (has[yy]) return;
      var near = Object.keys(has).some(function (k) { return Math.abs(Number(k) - yy) < labelStep * 0.55; });
      if (near) return;
      has[yy] = true;
      var lab = document.createElement("div");
      lab.className = "tl-tick-label major key";
      lab.style.left = (self.x(yy) - PAD) + "px";
      lab.style.color = "rgba(226,201,143,.75)";
      lab.textContent = yy;
      self.ruler.appendChild(lab);
    });
  };

  timeline.renderDots = function () {
    var self = this;
    var yearBuckets = {};
    var offsets = [0, -7, 7, -13, 13];
    this.items.forEach(function (it) {
      var d = document.createElement("div");
      d.className = "tl-dot" + (it.kind === "theory" ? " theory" : "");
      d.style.left = (self.x(it.year) - PAD) + "px";
      var bucket = Math.round(it.year * 2);
      var seen = yearBuckets[bucket] || 0;
      yearBuckets[bucket] = seen + 1;
      d.style.top = (88.5 + offsets[Math.min(seen, offsets.length - 1)]) + "px";
      d.setAttribute("data-uid", it.uid);
      d.title = (it.date ? it.date + " · " : it.year + " · ") + it.title;
      if (it.kind === "theory") {
        var th = Axis.data.getTheory(it.theory);
        if (th) d.style.borderColor = U.colorAlpha(th.color, .75);
      }
      d.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      d.addEventListener("click", function (e) {
        e.stopPropagation();
        self.pickDot(e.clientX, e.clientY);
      });
      d.addEventListener("mouseenter", function () { self.hoverItem(it); });
      d.addEventListener("mouseleave", function () { self.hoverItem(null); });
      self.dots.appendChild(d);
      self.dotEls[it.uid] = d;
    });
  };

  timeline.pickDot = function (clientX, clientY) {
    var cands = [];
    for (var uid in this.dotEls) {
      var r = this.dotEls[uid].getBoundingClientRect();
      if (!r.width || !r.height) continue;
      var d = Math.hypot(clientX - (r.left + r.width / 2), clientY - (r.top + r.height / 2));
      if (d <= 14) cands.push({ uid: uid, d: d });
    }
    if (!cands.length) return;
    if (cands.length === 1) {
      Axis.app.selectUid(cands[0].uid, { fromTimeline: true });
      return;
    }
    cands.sort(function (a, b) {
      var ia = Axis.data.item(a.uid), ib = Axis.data.item(b.uid);
      return (ia ? ia.year : 0) - (ib ? ib.year : 0);
    });
    this.showChooser(cands.map(function (c) { return c.uid; }), clientX, clientY);
  };

  timeline.showChooser = function (uids, clientX, clientY) {
    this.hideChooser();
    var box = document.createElement("div");
    box.className = "tl-chooser";
    box.setAttribute("role", "menu");
    var html = '<div class="tc-title">该时间点附近有 ' + uids.length + " 个考点</div>";
    uids.forEach(function (uid) {
      var it = Axis.data.item(uid);
      if (!it) return;
      html += '<button type="button" role="menuitem" data-uid="' + U.esc(uid) + '">' +
        "<span>" + U.esc((it.date || U.fmtYear(it.year)) + " · " + it.title) + "</span>" +
        '<em>' + U.esc(it.chapter || "") + "</em></button>";
    });
    box.innerHTML = html;
    document.body.appendChild(box);
    var w = 270, h = Math.min(300, 40 + uids.length * 34);
    box.style.left = U.clamp(clientX - 20, 8, window.innerWidth - w - 8) + "px";
    box.style.top = U.clamp(clientY - h - 16, 8, window.innerHeight - h - 8) + "px";
    this._chooser = box;
    var self = this;
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-uid]");
      if (!b) return;
      e.stopPropagation();
      self.hideChooser();
      Axis.app.selectUid(b.getAttribute("data-uid"), { fromTimeline: true });
    });
    setTimeout(function () {
      document.addEventListener("pointerdown", self._chooserOutside = function (e) {
        if (self._chooser && !self._chooser.contains(e.target)) self.hideChooser();
      });
      document.addEventListener("keydown", self._chooserKey = function (e) {
        if (e.key === "Escape") self.hideChooser();
      });
    }, 0);
  };

  timeline.hideChooser = function () {
    if (this._chooser) { this._chooser.remove(); this._chooser = null; }
    if (this._chooserOutside) { document.removeEventListener("pointerdown", this._chooserOutside); this._chooserOutside = null; }
    if (this._chooserKey) { document.removeEventListener("keydown", this._chooserKey); this._chooserKey = null; }
  };

  timeline.renderLabels = function () {
    var self = this;
    // rank 优先，其次按年份；最多三行，避免拥挤。窄屏只显示 rank1 标签
    var narrow = this.innerW < 1000;
    var candidates = this.items.filter(function (it) {
      return it.rank === 1 || (!narrow && it.rank === 2);
    });
    candidates.sort(function (a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.year - b.year;
    });
    var rows = [[], [], []];
    var placedUids = {};
    candidates.forEach(function (it) {
      var text = it.short || it.title;
      if (!text) return;
      var w = U.textWidth(text, 10.5) + 12;
      var x = self.x(it.year);
      var half = w / 2;
      var row = -1;
      for (var r = 0; r < rows.length; r++) {
        var clash = rows[r].some(function (iv) { return x + half > iv[0] && x - half < iv[1]; });
        if (!clash) { row = r; break; }
      }
      if (row < 0) return;
      rows[row].push([x - half - 2, x + half + 2]);
      var el = document.createElement("div");
      el.className = "tl-label" + (it.kind === "theory" ? " theory" : "");
      var localX = x - PAD;
      el.style.top = (row * ROW_H) + "px";
      if (localX - half < 1) {
        el.style.left = (localX + 2) + "px";
        el.style.transform = "none";
      } else if (localX + half > self.innerW - 1) {
        el.style.left = (localX - 2) + "px";
        el.style.transform = "translateX(-100%)";
      } else {
        el.style.left = localX + "px";
      }
      el.textContent = text;
      el.title = (it.date ? it.date + " · " : it.year + " · ") + it.title;
      el.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        Axis.app.selectUid(it.uid, { fromTimeline: true });
      });
      self.labels.appendChild(el);
      self.labelEls[it.uid] = el;
      placedUids[it.uid] = true;
    });
    this._labelData = candidates.filter(function (it) { return placedUids[it.uid]; });
  };

  timeline.updateYear = function (year, force) {
    this.year = year;
    var x = this.x(year);
    if (this.playhead) {
      this.playhead.style.left = x + "px";
      if (this.playheadYear) this.playheadYear.textContent = U.fmtYear(year);
    }
    if (this.posEl) {
      var idx = -1;
      for (var i = 0; i < this.items.length; i++) {
        if (this.items[i].year <= year + 1e-6) idx = i;
        else break;
      }
      this.posEl.textContent = "当前 " + U.fmtYear(year) + " 年 · 第 " + Math.max(1, idx + 1) + " / " + this.items.length + " 个节点";
    }
    for (var uid in this.dotEls) {
      var it = Axis.data.item(uid);
      if (!it) continue;
      this.dotEls[uid].classList.toggle("past", it.year <= year + 1e-6);
      this.dotEls[uid].classList.remove("future");
    }
    void force;
  };

  timeline.updateSelection = function (uid) {
    this.selected = uid;
    for (var key in this.dotEls) this.dotEls[key].classList.toggle("active", key === uid);
    for (var k2 in this.labelEls) this.labelEls[k2].classList.toggle("active", k2 === uid);
    if (this.extraLabel) { this.extraLabel.remove(); this.extraLabel = null; }
    this.renderRelations(uid);
    if (!uid) return;
    var it = Axis.data.item(uid);
    if (!it) return;
    if (!this.labelEls[uid]) {
      var el = document.createElement("div");
      el.className = "tl-label active extra";
      el.style.left = (this.x(it.year) - PAD) + "px";
      el.style.top = "0px";
      el.style.zIndex = "5";
      el.textContent = it.short || it.title;
      el.title = (it.date ? it.date + " · " : it.year + " · ") + it.title;
      this.labels.appendChild(el);
      this.extraLabel = el;
    }
  };

  timeline.updateExtraLabel = function () {};

  timeline.renderRelations = function (uid) {
    if (!this.linkLayer) return;
    this.linkLayer.textContent = "";
    if (this.tab === "mao") return;
    var item = Axis.data.item(uid);
    if (!item || item.kind !== "history") return;
    var rels = Axis.data.relationsFor(uid);
    if (!rels.length) return;
    var NS = "http://www.w3.org/2000/svg";
    var self = this;
    function dotCenterY(id) {
      var el = self.dotEls[id];
      if (!el) return 91.5;
      var top = parseFloat(el.style.top);
      if (!isFinite(top)) top = 88.5;
      return top + (el.offsetHeight || 6) / 2;
    }
    var selY = dotCenterY(uid);
    rels.slice(0, 4).forEach(function (r, i) {
      // #tlLinks 覆盖整个 canvas；坐标必须与 .tl-dots 的 left:26px 对齐，
      // 直接用 this.x()（已含 PAD），不要再减 PAD。
      var sx = self.x(item.year);
      var tx = self.x(r.target.year);
      var sy = selY;
      var ty = dotCenterY(r.target.uid);
      if (Math.abs(tx - sx) < 1.5) return;
      var fromX = r.dir === "in" ? tx : sx;
      var fromY = r.dir === "in" ? ty : sy;
      var toX = r.dir === "in" ? sx : tx;
      var toY = r.dir === "in" ? sy : ty;
      var apex = 54 - i * 9;
      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", "M" + fromX + "," + fromY + " C" + fromX + "," + apex + " " + toX + "," + apex + " " + toX + "," + toY);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", REL_COLORS[r.type] || "#c9a45c");
      path.setAttribute("stroke-width", "1.1");
      path.setAttribute("stroke-dasharray", r.type === "block" ? "1 4" : r.type === "turn" ? "6 3" : "4 4");
      path.setAttribute("marker-end", "url(#tlarrow-" + r.type + ")");
      path.setAttribute("opacity", ".78");
      self.linkLayer.appendChild(path);
      var t = document.createElementNS(NS, "text");
      t.setAttribute("x", (fromX + toX) / 2);
      t.setAttribute("y", apex - 2);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", "8.5");
      t.setAttribute("font-family", "var(--sans)");
      t.setAttribute("fill", REL_COLORS[r.type] || "#c9a45c");
      t.setAttribute("paint-order", "stroke");
      t.setAttribute("stroke", "rgba(6,9,13,.94)");
      t.setAttribute("stroke-width", "2.2");
      t.textContent = (r.dir === "in" ? "← " : "") + (r.label || "");
      self.linkLayer.appendChild(t);
    });
  };

  timeline.setSelection = function (uid) { this.updateSelection(uid); };

  timeline.onPointerDown = function (e) {
    if (e.button !== 0) return;
    this._dragging = true;
    this.scrubTo(e.clientX);
    if (Axis.player) Axis.player.pause();
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {}
  };

  timeline.onPointerMove = function (e) {
    if (!this._dragging) return;
    this.scrubTo(e.clientX);
  };

  timeline.scrubTo = function (clientX) {
    var r = this.canvas.getBoundingClientRect();
    var x = U.clamp(clientX - r.left - PAD, 0, this.innerW);
    var year = this.start + (x / this.innerW) * (this.end - this.start);
    Axis.app.setYear(year, { autoSelect: true, fromScrub: true });
  };

  timeline.hoverItem = function (it) {
    // 轻量高亮：其它节点降低透明度
    for (var uid in this.dotEls) {
      this.dotEls[uid].style.opacity = !it || uid === it.uid ? "" : ".35";
    }
    for (var k in this.labelEls) {
      this.labelEls[k].style.opacity = !it || k === it.uid ? "" : ".4";
    }
  };

  timeline.layout = function () {
    this.render();
  };

  Axis.timeline = timeline;
})();
