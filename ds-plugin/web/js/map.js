/* ============================================================
   map.js — 中国地图：省界、势力着色、事件点、缩放平移、九段线插图
   ============================================================ */
(function () {
  "use strict";
  var Axis = window.Axis = window.Axis || {};
  var U = Axis.util;
  var NS = Axis.NS;

  var map = {
    geo: null,
    svg: null,
    root: null,
    provLayer: null,
    pinLayer: null,
    labelLayer: null,
    provMap: {},
    pinMap: {},
    pinItems: [],
    period: null,
    year: 1840,
    forceOn: true,
    labelsOn: false,
    forceFilter: null,
    tab: "shigang",
    z: 1,
    tx: 0,
    ty: 0,
    vb: [190, 14, 620, 545],
    _dragging: false,
    _dragLast: null,
    _raf: null
  };

  map.init = function () {
    this.geo = Axis.data.geo;
    this.svg = U.$("#mapSvg");
    this.root = U.$("#mapRoot");
    this.provLayer = U.$("#provincesLayer");
    this.pinLayer = U.$("#pinsLayer");
    this.labelLayer = U.$("#provinceLabels");
    this.selectedUid = null;
    this.relLayer = document.createElementNS(NS, "g");
    this.relLayer.setAttribute("id", "relationsLayer");
    this.root.insertBefore(this.relLayer, this.pinLayer);
    if (!this.geo || !this.geo.provinces) {
      this.geo = null;
      return;
    }
    this.setViewBox();
    this.initRelationMarkers();
    this.renderProvinces();
    this.renderMicroMarkers();
    this.renderLabels();
    this.renderPinItems();
    this.renderInsets();
    this.bind();
  };

  map.REL_STYLE = {
    cause: { color: "#7a9ec4", dash: "4 4" },
    promote: { color: "#c9a45c", dash: "5 4" },
    turn: { color: "#c07c54", dash: "6 3" },
    block: { color: "#b05846", dash: "1 4" }
  };

  map.initRelationMarkers = function () {
    var defs = this.svg.querySelector("defs");
    if (!defs) return;
    var self = this;
    Object.keys(this.REL_STYLE).forEach(function (type) {
      var marker = document.createElementNS(NS, "marker");
      marker.setAttribute("id", "rel-arrow-" + type);
      marker.setAttribute("viewBox", "0 0 10 10");
      marker.setAttribute("refX", "8");
      marker.setAttribute("refY", "5");
      marker.setAttribute("markerWidth", "5");
      marker.setAttribute("markerHeight", "5");
      marker.setAttribute("orient", "auto-start-reverse");
      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", "M0 0 L10 5 L0 10 z");
      path.setAttribute("fill", self.REL_STYLE[type].color);
      marker.appendChild(path);
      defs.appendChild(marker);
    });
  };

  map.setViewBox = function () {
    var b = null;
    if (this.geo.bounds && this.geo.bounds.mainland && this.geo.bounds.mainland.length === 4) {
      b = this.geo.bounds.mainland;
    } else {
      b = this.computeFallbackBounds();
    }
    var pad = 10;
    this.vb = [b[0] - pad, b[1] - pad, (b[2] - b[0]) + pad * 2, (b[3] - b[1]) + pad * 2];
    this.svg.setAttribute("viewBox", this.vb.join(" "));
  };

  map.computeFallbackBounds = function () {
    var xs = [], ys = [];
    (this.geo.provinces || []).forEach(function (p) {
      var parts = String(p.path || "").split("M").slice(1);
      parts.forEach(function (seg) {
        var nums = seg.match(/-?\d+(?:\.\d+)?/g);
        if (!nums) return;
        var pts = [];
        for (var i = 0; i + 1 < nums.length; i += 2) pts.push([Number(nums[i]), Number(nums[i + 1])]);
        var miny = Infinity;
        pts.forEach(function (q) { if (q[1] < miny) miny = q[1]; });
        // 海南省的 path 含南海诸岛碎岛，主图裁掉 y > 705 的环（旧 Miller 版阈值，仅兜底用）
        if (miny > 705) return;
        pts.forEach(function (q) { xs.push(q[0]); ys.push(q[1]); });
      });
    });
    if (!xs.length) return [190, 20, 810, 550];
    return [
      Math.min.apply(null, xs), Math.min.apply(null, ys),
      Math.max.apply(null, xs), Math.max.apply(null, ys)
    ];
  };

  map.renderProvinces = function () {
    var frag = document.createDocumentFragment();
    var self = this;
    this.provMap = {};
    this.geo.provinces.forEach(function (p) {
      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", p.path);
      path.setAttribute("class", "province");
      path.setAttribute("fill", "#3a3f45");
      path.setAttribute("fill-opacity", "0.96");
      path.setAttribute("data-short", p.short);
      path.setAttribute("data-id", p.id);
      path.addEventListener("mouseenter", function (e) { self.onProvinceEnter(e, p); });
      path.addEventListener("mousemove", function (e) { self.onProvinceMove(e); });
      path.addEventListener("mouseleave", function () { self.hideTip(); });
      frag.appendChild(path);
      self.provMap[p.short] = path;
    });
    this.provLayer.textContent = "";
    this.provLayer.appendChild(frag);
  };

  map.renderMicroMarkers = function () {
    var self = this;
    this.microMap = {};
    var layer = U.$("#provincesLayer");
    ["香港", "澳门"].forEach(function (short) {
      var p = (self.geo.provinces || []).find(function (x) { return x.short === short; });
      if (!p) return;
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("class", "micro-province");
      c.setAttribute("cx", p.center[0]);
      c.setAttribute("cy", p.center[1]);
      c.setAttribute("r", "2.6");
      c.setAttribute("fill", "#3a3f45");
      c.setAttribute("data-short", short);
      var t = document.createElementNS(NS, "title");
      t.textContent = p.name;
      c.appendChild(t);
      c.addEventListener("mouseenter", function (e) { self.onProvinceEnter(e, p); });
      c.addEventListener("mousemove", function (e) { self.onProvinceMove(e); });
      c.addEventListener("mouseleave", function () { self.hideTip(); });
      layer.appendChild(c);
      self.microMap[short] = c;
    });
  };

  map.renderLabels = function () {
    if (!this.labelLayer) return;
    var frag = document.createDocumentFragment();
    (this.geo.provinces || []).forEach(function (p) {
      if (!p.label) return;
      var t = document.createElementNS(NS, "text");
      t.setAttribute("x", p.label[0]);
      t.setAttribute("y", p.label[1]);
      t.textContent = p.short;
      frag.appendChild(t);
    });
    this.labelLayer.textContent = "";
    this.labelLayer.appendChild(frag);
    this.labelLayer.style.display = this.labelsOn ? "" : "none";
  };

  map.renderPinItems = function () {
    var items = Axis.data.allItems;
    var frag = document.createDocumentFragment();
    var self = this;
    this.pinMap = {};
    this.pinPos = {};
    this.pinItems = items;
    var occupied = {};
    items.forEach(function (it) {
      if (!it.lonlat) return;
      var pos = Axis.data.geo.project(it.lonlat[0], it.lonlat[1]);
      var key = Math.round(pos[0] / 14) + ":" + Math.round(pos[1] / 14);
      var n = occupied[key] || 0;
      occupied[key] = n + 1;
      if (n > 0) {
        var ang = n * 2.39996;
        var rad = 10 + Math.floor(n / 4) * 4;
        pos = [pos[0] + Math.cos(ang) * rad, pos[1] + Math.sin(ang) * rad];
      }
      var g = document.createElementNS(NS, "g");
      g.setAttribute("class", "pin" + (it.kind === "theory" ? " theory" : ""));
      g.setAttribute("data-uid", it.uid);
      g.setAttribute("transform", "translate(" + pos[0].toFixed(1) + "," + pos[1].toFixed(1) + ")");
      self.pinPos[it.uid] = pos;
      var halo = document.createElementNS(NS, "circle");
      halo.setAttribute("class", "pin-halo");
      halo.setAttribute("r", "8");
      var core = document.createElementNS(NS, "circle");
      core.setAttribute("class", "pin-core");
      core.setAttribute("r", it.kind === "theory" ? "3" : "3.2");
      if (it.kind === "theory") {
        // diamonds for theory congresses
        var diamond = document.createElementNS(NS, "rect");
        diamond.setAttribute("class", "pin-core");
        diamond.setAttribute("x", "-2.4");
        diamond.setAttribute("y", "-2.4");
        diamond.setAttribute("width", "4.8");
        diamond.setAttribute("height", "4.8");
        diamond.setAttribute("transform", "rotate(45)");
        g.appendChild(halo);
        g.appendChild(diamond);
      } else {
        g.appendChild(halo);
        g.appendChild(core);
      }
      g.addEventListener("click", function (e) {
        e.stopPropagation();
        self.pickPin(e.clientX, e.clientY);
      });
      g.addEventListener("mouseenter", function (e) {
        self.showTip(e.clientX, e.clientY, it.title, it.date, true);
        g.classList.add("hover");
      });
      g.addEventListener("mouseleave", function () { self.hideTip(); g.classList.remove("hover"); });
      frag.appendChild(g);
      self.pinMap[it.uid] = g;
    });
    this.pinLayer.textContent = "";
    this.pinLayer.appendChild(frag);
  };

  map.renderInsets = function () {
    var segs = this.geo.nineDash && this.geo.nineDash.segments;
    if (!segs || !segs.length) return;
    var svg = U.$("#scsSvg");
    if (!svg) return;
    var xs = [], ys = [];
    segs.forEach(function (s) { xs.push(s[0], s[2]); ys.push(s[1], s[3]); });
    var minx = Math.min.apply(null, xs), maxx = Math.max.apply(null, xs);
    var miny = Math.min.apply(null, ys), maxy = Math.max.apply(null, ys);
    var pad = 8;
    var sc = Math.min((100 - pad * 2) / Math.max(1, maxx - minx), (112 - pad * 2) / Math.max(1, maxy - miny));
    var ox = (100 - (maxx - minx) * sc) / 2;
    var oy = (112 - (maxy - miny) * sc) / 2;
    var d = "";
    segs.forEach(function (s) {
      var x1 = ox + (s[0] - minx) * sc, y1 = oy + (s[1] - miny) * sc;
      var x2 = ox + (s[2] - minx) * sc, y2 = oy + (s[3] - miny) * sc;
      d += "M" + x1.toFixed(2) + "," + y1.toFixed(2) + "L" + x2.toFixed(2) + "," + y2.toFixed(2);
    });
    var path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "rgba(201,164,92,.72)");
    path.setAttribute("stroke-width", "1.15");
    path.setAttribute("stroke-linecap", "round");
    svg.textContent = "";
    svg.appendChild(path);
    // faint island hints
    var hint = document.createElementNS(NS, "text");
    hint.setAttribute("x", "50");
    hint.setAttribute("y", "106");
    hint.setAttribute("text-anchor", "middle");
    hint.setAttribute("fill", "rgba(201,164,92,.34)");
    hint.setAttribute("font-size", "6.5");
    hint.setAttribute("letter-spacing", "1");
    hint.textContent = "十段线";
    svg.appendChild(hint);
  };

  map.bind = function () {
    var self = this;
    var svg = this.svg;

    svg.addEventListener("wheel", function (e) {
      if (Axis.app && Axis.app.state.tab === "mao") return;
      e.preventDefault();
      var p = self.screenToBase(e.clientX, e.clientY);
      var factor = Math.exp(-e.deltaY * 0.0014);
      self.zoomAt(p, self.z * factor);
    }, { passive: false });

    svg.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      self._dragMoved = false;
      self._dragStart = [e.clientX, e.clientY];
      if (e.target && e.target.closest && e.target.closest(".pin")) return;
      self._dragging = true;
      self._dragLast = [e.clientX, e.clientY];
      svg.classList.add("dragging");
      try { svg.setPointerCapture(e.pointerId); } catch (err) {}
    });
    svg.addEventListener("pointermove", function (e) {
      if (self._dragStart && Math.hypot(e.clientX - self._dragStart[0], e.clientY - self._dragStart[1]) > 4) {
        self._dragMoved = true;
      }
      if (!self._dragging) return;
      var ctm = svg.getScreenCTM();
      if (!ctm) return;
      var dx = (e.clientX - self._dragLast[0]) / (ctm.a || 1);
      var dy = (e.clientY - self._dragLast[1]) / (ctm.d || 1);
      self._dragLast = [e.clientX, e.clientY];
      self.tx += dx;
      self.ty += dy;
      self.clampPan();
      self.applyTransform();
    });
    function endDrag() {
      if (!self._dragging) return;
      self._dragging = false;
      svg.classList.remove("dragging");
    }
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    svg.addEventListener("pointerleave", endDrag);
    svg.addEventListener("click", function (e) {
      if (self._dragMoved) { self._dragMoved = false; return; }
      if (e.target && e.target.closest && e.target.closest(".map-zoom")) return;
      var best = self.pickPin(e.clientX, e.clientY);
      if (best) Axis.app.selectUid(best, { fromMap: true });
    });
    svg.addEventListener("dblclick", function (e) {
      if (e.target && e.target.closest && e.target.closest(".pin")) return;
      self.reset();
    });

    U.$$("#mapZoom button").forEach(function (b) {
      b.addEventListener("click", function () {
        var mode = b.getAttribute("data-zoom");
        if (mode === "reset") self.reset();
        else if (mode === "in") self.zoomAt(self.vbCenter(), self.z * 1.32);
        else self.zoomAt(self.vbCenter(), self.z / 1.32);
      });
    });
  };

  map.vbCenter = function () {
    return [this.vb[0] + this.vb[2] / 2, this.vb[1] + this.vb[3] / 2];
  };

  map.screenToBase = function (clientX, clientY) {
    var ctm = this.svg.getScreenCTM();
    if (!ctm) return this.vbCenter();
    var pt = this.svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    var p = pt.matrixTransform(ctm.inverse());
    return [p.x, p.y];
  };

  map.zoomAt = function (p, newZ) {
    newZ = U.clamp(newZ, 1, 3.6);
    var oldZ = this.z;
    if (Math.abs(newZ - oldZ) < 1e-4) return;
    // p is the cursor in SVG base coordinates; keep the map point under it fixed:
    // u = (p - t) / z  ->  t' = p - z' * u
    var ux = (p[0] - this.tx) / oldZ;
    var uy = (p[1] - this.ty) / oldZ;
    this.tx = p[0] - newZ * ux;
    this.ty = p[1] - newZ * uy;
    this.z = newZ;
    this.clampPan();
    this.applyTransform();
  };

  map.clampPan = function () {
    var limX = (this.z - 1) * this.vb[2] * 1.2 + 10;
    var limY = (this.z - 1) * this.vb[3] * 1.2 + 10;
    this.tx = U.clamp(this.tx, -limX, limX);
    this.ty = U.clamp(this.ty, -limY, limY);
  };

  map.applyTransform = function () {
    this.root.setAttribute("transform", "translate(" + this.tx.toFixed(2) + "," + this.ty.toFixed(2) + ") scale(" + this.z.toFixed(3) + ")");
    this.scheduleOverlay();
  };

  map.reset = function () {
    this.z = 1;
    this.tx = 0;
    this.ty = 0;
    this.applyTransform();
  };

  map.setTab = function (tab) {
    this.tab = tab;
    var showTheory = tab !== "shigang";
    for (var uid in this.pinMap) {
      var g = this.pinMap[uid];
      var isTheory = g.classList.contains("theory");
      g.style.display = (!showTheory && isTheory) ? "none" : "";
    }
    if (tab === "mao") {
      this.hideCallout();
      this.renderRelations(null);
    } else {
      this.renderRelations(this.selectedUid);
      this.scheduleOverlay();
    }
  };

  map.setPeriod = function (period, forceOn) {
    this.period = period;
    this.forceOn = !!forceOn;
    if (!period) return;
    for (var short in this.provMap) {
      var key = Axis.data.forceOf(period, short);
      var color = this.forceOn ? Axis.data.forceColor(key) : "#373d45";
      var path = this.provMap[short];
      path.style.fill = color;
      path.setAttribute("data-force", key);
    }
    for (var ms in this.microMap) {
      var mkey = Axis.data.forceOf(period, ms);
      var mcolor = this.forceOn ? Axis.data.forceColor(mkey) : "#373d45";
      this.microMap[ms].setAttribute("fill", mcolor);
      this.microMap[ms].setAttribute("data-force", mkey);
    }
    this.applyForceFilter();
  };

  map.setYear = function (year) {
    this.year = year;
    var selected = Axis.app && Axis.app.state ? Axis.app.state.uid : null;
    for (var uid in this.pinMap) {
      var g = this.pinMap[uid];
      var it = Axis.data.item(uid);
      if (!it) continue;
      var near = Math.abs(it.year - year) <= 14 || uid === selected;
      g.classList.toggle("far", !near);
      g.classList.toggle("future", it.year > year + 0.55);
      g.classList.toggle("past", it.year <= year + 0.55);
    }
  };

  map.setSelection = function (uid) {
    this.selectedUid = uid;
    for (var key in this.pinMap) {
      this.pinMap[key].classList.toggle("active", key === uid);
    }
    this.renderRelations(uid);
    this.updateOverlay();
  };

  map.renderRelations = function (uid) {
    if (!this.relLayer) return;
    this.relLayer.textContent = "";
    if (this.tab === "mao") return;
    var rels = Axis.data.relationsFor(uid);
    if (!rels.length) return;
    var start = this.pinPos[uid];
    if (!start) return;
    var self = this;
    rels.slice(0, 6).forEach(function (r, i) {
      var target = self.pinPos[r.target.uid];
      if (!target) return;
      var style = self.REL_STYLE[r.type] || self.REL_STYLE.promote;
      var from = r.dir === "in" ? target : start;
      var to = r.dir === "in" ? start : target;
      var dx = to[0] - from[0], dy = to[1] - from[1];
      var len = Math.hypot(dx, dy);
      if (len < 2) return;
      var nx = -dy / len, ny = dx / len;
      var bend = (i % 2 === 0 ? 1 : -1) * (16 + Math.floor(i / 2) * 12);
      var cx = (from[0] + to[0]) / 2 + nx * bend;
      var cy = (from[1] + to[1]) / 2 + ny * bend;
      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", "M" + from[0].toFixed(1) + "," + from[1].toFixed(1) + " Q" + cx.toFixed(1) + "," + cy.toFixed(1) + " " + to[0].toFixed(1) + "," + to[1].toFixed(1));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", style.color);
      path.setAttribute("stroke-width", "1.3");
      path.setAttribute("stroke-dasharray", style.dash);
      path.setAttribute("marker-end", "url(#rel-arrow-" + r.type + ")");
      path.setAttribute("opacity", ".9");
      self.relLayer.appendChild(path);
      // 弧度中点附近放标签
      var lx = from[0] * 0.25 + cx * 0.5 + to[0] * 0.25;
      var ly = from[1] * 0.25 + cy * 0.5 + to[1] * 0.25 - 3;
      var label = document.createElementNS(NS, "text");
      label.setAttribute("x", lx.toFixed(1));
      label.setAttribute("y", ly.toFixed(1));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("fill", style.color);
      label.setAttribute("font-size", "8.5");
      label.setAttribute("font-family", "var(--sans)");
      label.setAttribute("paint-order", "stroke");
      label.setAttribute("stroke", "rgba(6,9,13,.92)");
      label.setAttribute("stroke-width", "2.2");
      label.textContent = (r.dir === "in" ? "← " : "") + r.label;
      self.relLayer.appendChild(label);
    });
  };

  map.pickPin = function (clientX, clientY) {
    var best = null, bestD = 1e9;
    for (var uid in this.pinMap) {
      var el = this.pinMap[uid];
      if (el.style.display === "none") continue;
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      var d = Math.hypot(clientX - (r.left + r.width / 2), clientY - (r.top + r.height / 2));
      if (d < bestD) { bestD = d; best = uid; }
    }
    return best && bestD <= 14 ? best : null;
  };

  map.setLabels = function (show) {
    this.labelsOn = !!show;
    if (this.labelLayer) this.labelLayer.style.display = show ? "" : "none";
  };

  map.setForceFilter = function (key) {
    this.forceFilter = key || null;
    this.applyForceFilter();
  };

  map.applyForceFilter = function () {
    var key = this.forceFilter;
    for (var short in this.provMap) {
      var path = this.provMap[short];
      var force = path.getAttribute("data-force") || "";
      path.classList.toggle("dim", !!(key && force !== key));
      path.classList.toggle("glow", !!(key && force === key));
    }
    for (var ms in this.microMap) {
      var el = this.microMap[ms];
      var mforce = el.getAttribute("data-force") || "";
      el.classList.toggle("dim", !!(key && mforce !== key));
    }
  };

  map.onProvinceEnter = function (e, p) {
    var period = this.period || Axis.data.periodAt(this.year);
    var key = Axis.data.forceOf(period, p.short);
    var name = this.forceOn ? Axis.data.forceName(key) : "省界";
    this.showTip(e.clientX, e.clientY, p.short, name);
  };

  map.onProvinceMove = function (e) {
    if (this._tipVisible) this.positionTip(e.clientX, e.clientY);
  };

  map.showTip = function (clientX, clientY, title, sub, isPin) {
    var tip = U.$("#mapTip");
    if (!tip) return;
    tip.innerHTML = "<b>" + U.esc(title) + "</b>" + (sub ? " · " + U.esc(sub) : "");
    tip.hidden = false;
    this._tipVisible = true;
    this._tipPin = !!isPin;
    this.positionTip(clientX, clientY);
  };

  map.positionTip = function (clientX, clientY) {
    var tip = U.$("#mapTip");
    var wrap = U.$("#mapArea");
    if (!tip || !wrap) return;
    var r = wrap.getBoundingClientRect();
    tip.style.left = (clientX - r.left) + "px";
    tip.style.top = (clientY - r.top) + "px";
  };

  map.hideTip = function () {
    var tip = U.$("#mapTip");
    if (tip) tip.hidden = true;
    this._tipVisible = false;
  };

  map.scheduleOverlay = function () {
    var self = this;
    if (this._raf) return;
    this._raf = requestAnimationFrame(function () {
      self._raf = null;
      self.updateOverlay();
    });
  };

  map.updateOverlay = function () {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    var app = Axis.app;
    if (!app) return;
    var tab = app.state.tab;
    if (tab === "mao") { this.hideCallout(); return; }
    var item = app.currentItem();
    var callout = U.$("#mapCallout");
    var leader = U.$("#leaderSvg");
    if (!callout) return;
    if (!item) { this.hideCallout(); return; }
    var pin = this.pinMap[item.uid];
    var area = U.$("#mapArea");
    if (!pin || !area || area.offsetParent === null) { this.hideCallout(); return; }
    var pr = pin.getBoundingClientRect();
    var ar = area.getBoundingClientRect();
    if (!pr.width && !pr.height) { this.hideCallout(); return; }
    var cx = pr.left + pr.width / 2 - ar.left;
    var cy = pr.top + pr.height / 2 - ar.top;
    if (cx < -20 || cx > ar.width + 20 || cy < -20 || cy > ar.height + 20) { this.hideCallout(); return; }
    var maxW = 248;
    var left = U.clamp(cx, maxW / 2 + 10, ar.width - maxW / 2 - 10);
    var top = U.clamp(cy - 14, 78, ar.height - 12);

    var eyebrow = U.$("#calloutEyebrow");
    var title = U.$("#calloutTitle");
    var sub = U.$("#calloutSub");
    if (eyebrow) eyebrow.textContent = item.kind === "theory" ? "理论坐标" : "事件定位";
    if (title) title.textContent = item.title;
    if (sub) sub.textContent = (item.date || "") + (item.place ? " · " + item.place : "");
    callout.hidden = false;
    callout.style.left = left + "px";
    callout.style.top = top + "px";

    // leader line to right event card
    if (leader) {
      leader.textContent = "";
      var card = U.$("#eventCard");
      var cr = card ? card.getBoundingClientRect() : null;
      if (cr && cr.width > 0 && cr.left > ar.right - 2) {
        var sx = pr.left + pr.width / 2;
        var sy = pr.top + pr.height / 2;
        var ex = cr.left + 4;
        var ey = cr.top + Math.min(74, cr.height * 0.42);
        var dx = Math.max(60, (ex - sx) * 0.45);
        var path = document.createElementNS(NS, "path");
        path.setAttribute("d", "M" + sx.toFixed(1) + "," + sy.toFixed(1) +
          " C" + (sx + dx).toFixed(1) + "," + sy.toFixed(1) +
          " " + (ex - dx).toFixed(1) + "," + ey.toFixed(1) +
          " " + ex.toFixed(1) + "," + ey.toFixed(1));
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "rgba(124,196,255,.55)");
        path.setAttribute("stroke-width", "1");
        path.setAttribute("stroke-dasharray", "5 6");
        leader.appendChild(path);
        var dot = document.createElementNS(NS, "circle");
        dot.setAttribute("cx", sx.toFixed(1));
        dot.setAttribute("cy", sy.toFixed(1));
        dot.setAttribute("r", "2");
        dot.setAttribute("fill", "rgba(124,196,255,.65)");
        leader.appendChild(dot);
      }
    }
  };

  map.hideCallout = function () {
    var c = U.$("#mapCallout");
    if (c) c.hidden = true;
    var l = U.$("#leaderSvg");
    if (l) l.textContent = "";
  };

  map.resize = function () {
    if (!this.svg) return;
    if (U.$("#leaderSvg")) {
      U.$("#leaderSvg").setAttribute("width", window.innerWidth);
      U.$("#leaderSvg").setAttribute("height", window.innerHeight);
    }
    this.scheduleOverlay();
  };

  Axis.map = map;
})();
