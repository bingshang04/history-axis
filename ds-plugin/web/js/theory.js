/* ============================================================
   theory.js — 毛中特「理论演进图谱」
   ============================================================ */
(function () {
  "use strict";
  var Axis = window.Axis = window.Axis || {};
  var U = Axis.util;
  var NS = Axis.NS;

  var W = 1000, H = 600;
  var LEFT = 252, X0 = 272, X1 = 958;
  var LANE_Y = [78, 172, 266, 360, 454];
  var AXIS_Y = 528;
  var START = 1921, END = 2025;

  var theory = {
    svg: null,
    root: null,
    nodeEls: {},
    edgeEls: [],
    laneEls: [],
    nodePos: {},
    selected: null,
    highlighted: null,
    _tip: null
  };

  function xOf(year) {
    return X0 + (U.clamp(year, START, END) - START) / (END - START) * (X1 - X0);
  }

  theory.init = function () {
    this.svg = U.$("#theorySvg");
    if (!this.svg) return;
    this.svg.textContent = "";
    var defs = U.svgEl("defs");
    [
      ["thArrowGold", "rgba(201,164,92,.75)"],
      ["thArrowGreen", "rgba(122,184,122,.7)"],
      ["thArrowRed", "rgba(192,124,84,.75)"],
      ["thArrowBlue", "rgba(122,158,196,.7)"]
    ].forEach(function (m) {
      var marker = U.svgEl("marker", {
        id: m[0], viewBox: "0 0 10 10", refX: "8", refY: "5",
        markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse"
      });
      var p = U.svgEl("path", { d: "M0 0 L10 5 L0 10 z", fill: m[1] });
      marker.appendChild(p);
      defs.appendChild(marker);
    });
    this.svg.appendChild(defs);
    this.root = U.svgEl("g");
    this.svg.appendChild(this.root);
    this._tip = U.$("#theoryTip");
    this.render();
  };

  theory.render = function () {
    if (!this.root) return;
    var D = Axis.data;
    this.root.textContent = "";
    this.nodeEls = {};
    this.edgeEls = [];
    this.laneEls = [];
    this.nodePos = {};
    var self = this;
    var theories = D.theories;
    if (!theories.length) return;

    // ---------- 时代背景带 ----------
    var eras = [
      [1921, 1949, "新民主主义革命时期"],
      [1949, 1978, "社会主义革命和建设"],
      [1978, 2012, "改革开放和社会主义现代化建设"],
      [2012, 2025, "中国特色社会主义新时代"]
    ];
    eras.forEach(function (era, i) {
      var x1 = xOf(era[0]), x2 = xOf(era[1]);
      var r = U.svgEl("rect", {
        x: x1, y: 40, width: Math.max(1, x2 - x1), height: 476,
        fill: i % 2 === 0 ? "rgba(201,164,92,.018)" : "rgba(120,140,170,.018)"
      });
      self.root.appendChild(r);
      var t = U.svgEl("text", {
        x: (x1 + x2) / 2, y: 26, "text-anchor": "middle",
        fill: "rgba(201,164,92,.40)", "font-size": "10.5", "letter-spacing": "2"
      });
      t.textContent = era[2];
      self.root.appendChild(t);
    });

    // ---------- 年代网格 ----------
    var g = U.svgEl("g", { opacity: ".8" });
    for (var y = 1921; y <= 2025; y += 10) {
      var gx = xOf(y);
      g.appendChild(U.svgEl("line", {
        x1: gx, y1: 44, x2: gx, y2: AXIS_Y,
        stroke: "rgba(201,164,92,.055)", "stroke-width": "1"
      }));
    }
    this.root.appendChild(g);

    // ---------- 泳道 ----------
    theories.forEach(function (th, idx) {
      var y = LANE_Y[idx] || (78 + idx * 94);
      var gLane = U.svgEl("g", { "data-theory": th.id });
      var x1 = xOf(Math.max(START, th.from)), x2 = xOf(Math.min(END, th.to));
      gLane.appendChild(U.svgEl("line", {
        x1: x1, y1: y, x2: x2, y2: y, stroke: U.colorAlpha(th.color, .13), "stroke-width": "7"
      }));
      gLane.appendChild(U.svgEl("rect", {
        x: x1, y: y - 22, width: Math.max(4, x2 - x1), height: 44, rx: 6,
        fill: U.colorAlpha(th.color, .028)
      }));
      gLane.appendChild(U.svgEl("line", {
        x1: x1, y1: y, x2: x2, y2: y, stroke: U.colorAlpha(th.color, .58), "stroke-width": "1.3"
      }));
      // 起止小刻度
      [x1, x2].forEach(function (xx) {
        gLane.appendChild(U.svgEl("line", {
          x1: xx, y1: y - 4, x2: xx, y2: y + 4,
          stroke: U.colorAlpha(th.color, .55), "stroke-width": "1"
        }));
      });

      // 泳道名（左侧，可两行）
      var name = th.name;
      var lines = name.length > 8 ? [name.slice(0, 7), name.slice(7)] : [name];
      var nameText = U.svgEl("text", {
        x: LEFT - 16, y: y - (lines.length > 1 ? 5 : 3),
        "text-anchor": "end", fill: th.color,
        "font-family": "var(--serif)", "font-size": "13.5", "font-weight": "600",
        "letter-spacing": "0.5"
      });
      lines.forEach(function (line, li) {
        var ts = U.svgEl("tspan", { x: LEFT - 16, dy: li === 0 ? 0 : 15 });
        ts.textContent = line;
        nameText.appendChild(ts);
      });
      gLane.appendChild(nameText);

      var status = U.svgEl("text", {
        x: LEFT - 16, y: y + (lines.length > 1 ? 25 : 14),
        "text-anchor": "end", fill: "rgba(180,172,158,.5)",
        "font-size": "9.5", "letter-spacing": "0.4"
      });
      status.textContent = th.status || "";
      gLane.appendChild(status);

      self.root.appendChild(gLane);
      self.laneEls.push({ id: th.id, el: gLane, y: y, theory: th });
    });

    // ---------- 预计算节点位置（关系边需要） ----------
    var nodeLayout = [];
    var nodeLayoutById = {};
    var laneLastX = {};
    var laneAlt = {};
    (D.maoNodes || []).forEach(function (n) {
      var idx = theories.findIndex(function (t) { return t.id === n.theory; });
      if (idx < 0) return;
      var laneY = LANE_Y[idx] || (78 + idx * 94);
      var x = xOf(n.year);
      var yOff = 0;
      if (laneLastX[idx] != null && Math.abs(laneLastX[idx] - x) < 11) {
        yOff = laneAlt[idx] ? 8 : -8;
        laneAlt[idx] = !laneAlt[idx];
      }
      laneLastX[idx] = x;
      var th = D.getTheory(n.theory) || { color: "#c9a45c" };
      var lay = { n: n, idx: idx, laneY: laneY, x: x, y: laneY + yOff, th: th };
      nodeLayout.push(lay);
      nodeLayoutById[n.id] = lay;
      self.nodePos[n.id] = { x: lay.x, y: lay.y, color: th.color, theory: n.theory };
    });

    // ---------- 关系边 ----------
    var edgeLayer = U.svgEl("g");
    this.root.appendChild(edgeLayer);
    (D.mao.edges || []).forEach(function (e) {
      var from = self.endpointPos(e.from, "from");
      var to = self.endpointPos(e.to, "to");
      if (!from || !to) return;
      var color, marker, dash;
      if (e.type === "inherit") { color = "rgba(201,164,92,.56)"; marker = "thArrowGold"; dash = "4 4"; }
      else if (e.type === "develop") { color = "rgba(122,184,122,.5)"; marker = "thArrowGreen"; dash = "1 4"; }
      else if (e.type === "turn") { color = "rgba(192,124,84,.55)"; marker = "thArrowRed"; dash = "6 3"; }
      else { color = "rgba(226,201,143,.68)"; marker = "thArrowGold"; dash = "0"; }
      var mx = (from.x + to.x) / 2;
      var my = (from.y + to.y) / 2;
      var lift = Math.abs(to.x - from.x) * 0.18 + 18;
      var d;
      if (Math.abs(from.y - to.y) < 2) {
        d = "M" + from.x + "," + from.y + " C" + (from.x + (to.x - from.x) * 0.4) + "," + (from.y - lift) +
          " " + (from.x + (to.x - from.x) * 0.6) + "," + (to.y - lift) + " " + to.x + "," + to.y;
      } else {
        d = "M" + from.x + "," + from.y + " C" + (from.x + (to.x - from.x) * 0.35) + "," + from.y +
          " " + (from.x + (to.x - from.x) * 0.65) + "," + to.y + " " + to.x + "," + to.y;
      }
      var path = U.svgEl("path", {
        d: d, fill: "none", stroke: color, "stroke-width": "1.1",
        "stroke-dasharray": dash, "marker-end": "url(#" + marker + ")",
        "data-from": e.from, "data-to": e.to, "data-type": e.type
      });
      edgeLayer.appendChild(path);
      self.edgeEls.push({ el: path, edge: e });
    });

    // ---------- 节点 ----------
    var nodeLayer = U.svgEl("g");
    this.root.appendChild(nodeLayer);
    var rowIntervals = {};
    var labelOffsets = [-14, -28, 20, 34];
    LANE_Y.forEach(function (_, i) { rowIntervals[i] = [[], [], [], []]; });

    (D.maoNodes || []).forEach(function (n) {
      var lay = nodeLayoutById[n.id];
      if (!lay) return;
      var idx = lay.idx;
      var laneY = lay.laneY;
      var x = lay.x;
      var y = lay.y;
      var th = lay.th;
      var gNode = U.svgEl("g", { class: "theory-node", "data-id": n.id, transform: "translate(" + x + "," + y + ")" });
      gNode.appendChild(U.svgEl("circle", {
        class: "tn-ring", r: "12", fill: "none", stroke: U.colorAlpha(th.color, .0), "stroke-width": "1.5"
      }));
      var r = n.rank === 1 ? 7 : 5.2;
      var shape;
      if (n.kind === "document" || n.kind === "theory") {
        shape = U.svgEl("rect", {
          x: -r, y: -r, width: r * 2, height: r * 2, rx: 1.5,
          transform: "rotate(45)", fill: "#0b1017", stroke: U.colorAlpha(th.color, .9), "stroke-width": "1.5"
        });
      } else {
        shape = U.svgEl("circle", {
          r: r, fill: "#0b1017", stroke: U.colorAlpha(th.color, .9), "stroke-width": "1.5"
        });
      }
      gNode.appendChild(shape);
      gNode.appendChild(U.svgEl("circle", { r: r * 0.34, fill: U.colorAlpha(th.color, .95) }));

      gNode.addEventListener("click", function (ev) {
        ev.stopPropagation();
        Axis.app.selectUid("m:" + n.id, { fromGraph: true });
      });
      gNode.addEventListener("mouseenter", function (ev) { self.showTip(ev, n, th); });
      gNode.addEventListener("mousemove", function (ev) { self.moveTip(ev); });
      gNode.addEventListener("mouseleave", function () { self.hideTip(); });

      self.nodeEls[n.id] = gNode;
      nodeLayer.appendChild(gNode);

      if ((D.mao.edges || []).some(function (e) { return e.from === n.id && e.type === "establish"; })) {
        var star = U.svgEl("text", {
          x: 9, y: -8, fill: "#f0d598", "font-size": "10",
          "text-anchor": "middle", "paint-order": "stroke",
          stroke: "rgba(6,9,13,.92)", "stroke-width": "2"
        });
        star.textContent = "★";
        gNode.appendChild(star);
      }

      // 标签：rank1 常显；rank2 只在节点较少的中段泳道显示，密集的毛/新时代泳道保持悬停
      var label = n.short || n.title;
      var showRank2 = idx === 1 || idx === 2 || idx === 3;
      if ((n.rank === 1 || (n.rank === 2 && showRank2)) && label) {
        var fs = n.rank === 1 ? 11.5 : 10.3;
        var w = U.textWidth(label, fs) + 10;
        var half = w / 2 + 2;
        var rowsI = rowIntervals[idx];
        var rowOrder = [0, 2, 1, 3];
        var oxOrder = [0, -30, 30, -60, 60, -90, 90];
        var placed = false;
        for (var oi = 0; oi < oxOrder.length && !placed; oi++) {
          for (var ri = 0; ri < rowOrder.length; ri++) {
            var rowIdx = rowOrder[ri];
            var lx = x + oxOrder[oi];
            var ly = laneY + labelOffsets[rowIdx];
            if (lx - half < 268 || lx + half > 968) continue;
            var intervals = rowsI[rowIdx];
            var clash = intervals.some(function (iv) { return lx + half > iv[0] && lx - half < iv[1]; });
            if (clash) continue;
            intervals.push([lx - half, lx + half]);
            if (oxOrder[oi] !== 0) {
              self.root.appendChild(U.svgEl("line", {
                x1: x, y1: y, x2: lx, y2: ly + (ly < y ? 4 : -4),
                stroke: "rgba(201,164,92,.16)", "stroke-width": ".7"
              }));
            }
            var t = U.svgEl("text", {
              x: lx, y: ly, "text-anchor": "middle",
              fill: n.rank === 1 ? "rgba(232,222,202,.92)" : "rgba(196,188,174,.72)",
              "font-size": String(fs),
              "font-family": "var(--sans)", "letter-spacing": "0.2",
              "paint-order": "stroke", stroke: "rgba(6,9,13,.94)", "stroke-width": "2.6"
            });
            t.textContent = label;
            t.setAttribute("class", "theory-node-label");
            t.addEventListener("click", function (ev) { ev.stopPropagation(); Axis.app.selectUid("m:" + n.id, { fromGraph: true }); });
            t.style.cursor = "pointer";
            self.root.appendChild(t);
            placed = true;
            break;
          }
        }
      }
    });

    // ---------- 理论跃迁连接 ----------
    for (var i = 0; i < theories.length - 1; i++) {
      var a = theories[i], b = theories[i + 1];
      var y1 = LANE_Y[i], y2 = LANE_Y[i + 1];
      var xx = xOf(Math.min(a.to, b.from));
      var conn = U.svgEl("path", {
        d: "M" + xx + "," + (y1 + 10) + " L" + xx + "," + (y2 - 10),
        stroke: "rgba(201,164,92,.30)", "stroke-width": "1",
        "stroke-dasharray": "2 5", "marker-end": "url(#thArrowGold)", fill: "none"
      });
      this.root.appendChild(conn);
    }

    // ---------- 时间轴 ----------
    var axisLayer = U.svgEl("g");
    axisLayer.appendChild(U.svgEl("line", {
      x1: X0, y1: AXIS_Y, x2: xOf(2025), y2: AXIS_Y,
      stroke: "rgba(201,164,92,.22)", "stroke-width": "1"
    }));
    var labelYears = [];
    for (var yy = 1930; yy <= 2020; yy += 10) labelYears.push(yy);
    labelYears.push(1921);
    labelYears.push(2025);
    labelYears.sort(function (a, b) { return a - b; });
    labelYears.forEach(function (yy) {
      var gx = xOf(yy);
      var major = (yy === 1921 || yy === 1945 || yy === 1949 || yy === 1978 || yy === 2012 || yy === 2021 || yy === 2025);
      axisLayer.appendChild(U.svgEl("line", {
        x1: gx, y1: AXIS_Y, x2: gx, y2: AXIS_Y + (major ? 7 : 4),
        stroke: major ? "rgba(201,164,92,.48)" : "rgba(201,164,92,.20)", "stroke-width": "1"
      }));
      var t = U.svgEl("text", {
        x: gx, y: AXIS_Y + 19, "text-anchor": "middle",
        fill: major ? "rgba(201,164,92,.68)" : "rgba(201,164,92,.4)",
        "font-family": "var(--display)", "font-size": "10.5", "letter-spacing": "0.3"
      });
      t.textContent = yy;
      axisLayer.appendChild(t);
    });

    // 关键飞跃标记
    [
      [1945, "第一次历史性飞跃"],
      [1997, "第二次历史性飞跃"],
      [2017, "新的飞跃"]
    ].forEach(function (m) {
      var gx = xOf(m[0]);
      axisLayer.appendChild(U.svgEl("line", {
        x1: gx, y1: 46, x2: gx, y2: AXIS_Y - 4,
        stroke: "rgba(226,201,143,.16)", "stroke-width": "1", "stroke-dasharray": "2 6"
      }));
      var t = U.svgEl("text", {
        x: gx + 4, y: 45, "text-anchor": "start",
        fill: "rgba(226,201,143,.55)", "font-size": "9", "letter-spacing": "0.5"
      });
      t.textContent = m[1];
      axisLayer.appendChild(t);
    });
    this.root.appendChild(axisLayer);

    // 窄屏纵向节点列表（与 SVG 图谱二选一显示）
    this.renderMobile();

    // 重新挂选中态
    if (this.selected) this.applySelection();
  };

  theory.renderMobile = function () {
    var box = U.$("#theoryMobile");
    if (!box) return;
    var D = Axis.data;
    var U2 = U;
    box.textContent = "";
    D.theories.forEach(function (th) {
      var nodes = D.maoNodes.filter(function (n) { return n.theory === th.id; });
      if (!nodes.length) return;
      nodes.sort(function (a, b) { return a.year - b.year; });
      var lane = document.createElement("div");
      lane.className = "tm-lane";
      lane.style.setProperty("--tm-color", th.color);
      var head = document.createElement("div");
      head.className = "tm-head";
      head.appendChild(document.createTextNode(th.name));
      if (th.status) {
        var em = document.createElement("em");
        em.textContent = th.status;
        head.appendChild(em);
      }
      lane.appendChild(head);
      nodes.forEach(function (n) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "tm-node";
        b.setAttribute("data-uid", "m:" + n.id);
        var y = document.createElement("span");
        y.className = "tm-year";
        y.textContent = U2.fmtYear(n.year);
        var t = document.createElement("span");
        t.className = "tm-title";
        t.textContent = n.short || n.title;
        b.appendChild(y);
        b.appendChild(t);
        b.addEventListener("click", function () {
          Axis.app.selectUid("m:" + n.id, { fromGraph: true });
        });
        lane.appendChild(b);
      });
      box.appendChild(lane);
    });
  };

  theory.syncMobileSelection = function () {
    var box = U.$("#theoryMobile");
    if (!box || box.offsetParent === null) return;
    var active = null;
    U.$$("#theoryMobile .tm-node").forEach(function (el) {
      var on = el.getAttribute("data-uid") === this.selected;
      el.classList.toggle("active", on);
      if (on) active = el;
    }, this);
    if (!active) return;
    var max = Math.max(0, box.scrollHeight - box.clientHeight);
    var boxRect = box.getBoundingClientRect();
    var actRect = active.getBoundingClientRect();
    var top = actRect.top - boxRect.top + box.scrollTop - box.clientHeight * 0.5 + actRect.height * 0.5;
    box.scrollTop = U.clamp(top, 0, max);
  };

  theory.endpointPos = function (id, side) {
    var D = Axis.data;
    if (this.nodePos[id]) return this.nodePos[id];
    var th = D.getTheory(id);
    if (th) {
      var idx = D.theories.findIndex(function (t) { return t.id === id; });
      if (idx < 0) return null;
      var x = side === "to" ? xOf(Math.min(END, th.to)) - 34 : xOf(Math.max(START, th.from)) + 26;
      return { x: x, y: LANE_Y[idx], color: th.color, theory: id };
    }
    return null;
  };

  theory.applySelection = function () {
    var uid = this.selected;
    var id = uid && uid.indexOf("m:") === 0 ? uid.slice(2) : null;
    for (var nid in this.nodeEls) {
      var g = this.nodeEls[nid];
      var ring = g.querySelector(".tn-ring");
      var on = nid === id;
      g.style.opacity = "";
      if (ring) {
        ring.setAttribute("stroke", on ? "rgba(226,201,143,.9)" : "rgba(0,0,0,0)");
        ring.setAttribute("stroke-width", on ? "2" : "1.5");
      }
      var shape = g.querySelector("circle:not(.tn-ring), rect");
      if (shape) shape.setAttribute("filter", on ? "drop-shadow(0 0 6px rgba(226,201,143,.55))" : "");
    }
    this.edgeEls.forEach(function (e) {
      var connected = id && (e.edge.from === id || e.edge.to === id);
      e.el.setAttribute("stroke-width", connected ? "1.8" : "1");
      e.el.setAttribute("opacity", id ? (connected ? "1" : ".35") : "1");
    });
    this.focusSelected();
    this.syncMobileSelection();
  };

  theory.focusSelected = function () {
    var area = document.querySelector(".theory-area");
    if (!area || !this.selected || area.offsetParent === null) return;
    if (area.scrollWidth <= area.clientWidth + 4) return;
    var id = this.selected.indexOf("m:") === 0 ? this.selected.slice(2) : null;
    var pos = id && this.nodePos[id];
    if (!pos) return;
    var maxL = area.scrollWidth - area.clientWidth;
    var maxT = area.scrollHeight - area.clientHeight;
    var left = U.clamp(pos.x / 1000 * area.scrollWidth - area.clientWidth * 0.5, 0, maxL);
    var top = U.clamp(pos.y / 600 * area.scrollHeight - area.clientHeight * 0.45, 0, maxT);
    area.scrollTo({ left: left, top: top, behavior: "smooth" });
  };

  theory.setSelection = function (uid) {
    this.selected = uid;
    this.applySelection();
  };

  theory.highlightTheory = function (id) {
    this.highlighted = id || null;
    var self = this;
    if (!this.root) return;
    if (!id) {
      U.$$("#theorySvg [data-theory]").forEach(function (el) { el.style.opacity = ""; });
      this.root.querySelectorAll(".theory-node").forEach(function (el) { el.style.opacity = ""; });
      this.edgeEls.forEach(function (e) { e.el.style.opacity = ""; });
      return;
    }
    U.$$("#theorySvg [data-theory]").forEach(function (el) {
      el.style.opacity = el.getAttribute("data-theory") === id ? "1" : ".18";
    });
    this.root.querySelectorAll(".theory-node").forEach(function (el) {
      var nid = el.getAttribute("data-id");
      var n = Axis.data.maoNodes.find(function (x) { return x.id === nid; });
      el.style.opacity = n && n.theory === id ? "1" : ".15";
    });
    this.edgeEls.forEach(function (e) { e.el.style.opacity = ".12"; });
    void self;
  };

  theory.showTip = function (ev, n, th) {
    if (!this._tip) return;
    var sub = (n.date || "") + (n.place ? " · " + n.place : "");
    this._tip.innerHTML = "<b>" + U.esc(n.title) + "</b>" + U.esc(sub) +
      "<div style='color:rgba(201,164,92,.6);margin-top:2px'>" + U.esc(th.name) + "</div>" +
      "<div style='margin-top:3px;color:rgba(180,172,158,.75)'>" + U.esc((n.summary || "").slice(0, 90)) + "</div>";
    this._tip.hidden = false;
    this.moveTip(ev);
  };

  theory.moveTip = function (ev) {
    if (!this._tip) return;
    var wrap = U.$("#theoryArea");
    if (!wrap) return;
    var r = wrap.getBoundingClientRect();
    var x = ev.clientX - r.left + 14;
    var y = ev.clientY - r.top + 14;
    x = Math.min(x, r.width - 270);
    y = Math.min(y, r.height - 120);
    this._tip.style.left = Math.max(8, x) + "px";
    this._tip.style.top = Math.max(8, y) + "px";
  };

  theory.hideTip = function () {
    if (this._tip) this._tip.hidden = true;
  };

  Axis.theory = theory;
})();
