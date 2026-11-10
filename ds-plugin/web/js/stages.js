/* ============================================================
   stages.js — 「阶段图表」复习台
   5 个阶段：力量对比（省域着色计数）、事件密度、事件链、
   徐涛重点 / 易混辨析 / 复习清单 / 毛中特理论坐标。
   ============================================================ */
(function () {
  "use strict";
  var Axis = window.Axis = window.Axis || {};
  var U = Axis.util;
  var D = Axis.data;

  var stages = {
    overlay: null,
    nav: null,
    main: null,
    closeBtn: null,
    lastFocus: null,
    activeId: null,
    _open: false
  };

  function esc(v) { return U.esc(v == null ? "" : String(v)); }
  function yearLabel(y) { return String(Math.floor(y)); }

  stages.init = function () {
    this.overlay = U.$("#stageOverlay");
    this.nav = U.$("#stageNav");
    this.main = U.$("#stageMain");
    this.closeBtn = U.$("#stageClose");
    if (!this.overlay) return;
    var self = this;
    if (this.closeBtn) this.closeBtn.addEventListener("click", function () { self.close(); });
    this.overlay.addEventListener("click", function (e) {
      if (e.target === self.overlay) self.close();
    });
    document.addEventListener("keydown", function (e) {
      if (!self._open) return;
      if (e.key === "Escape") { e.preventDefault(); self.close(); }
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        e.preventDefault();
        self.move(e.key === "ArrowRight" ? 1 : -1);
      }
    });
  };

  stages.isOpen = function () { return this._open; };

  stages.stageList = function () {
    return (window.STAGES && window.STAGES.stages) || [];
  };

  stages.stageById = function (id) {
    var list = this.stageList();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  stages.stageForYear = function (year) {
    var list = this.stageList();
    for (var i = 0; i < list.length; i++) {
      if (year + 1e-6 >= list[i].from && year + 1e-6 < list[i].to) return list[i];
    }
    return list[list.length - 1] || null;
  };

  stages.open = function (id) {
    var s = id ? this.stageById(id) : null;
    if (!s) s = this.stageForYear(Axis.app ? Axis.app.state.year : 1855);
    if (!s) return;
    this.lastFocus = document.activeElement;
    this._open = true;
    this.activeId = s.id;
    this.overlay.hidden = false;
    document.body.classList.add("stage-open");
    this.render(s.id);
    if (this.closeBtn) setTimeout(function () { try { stages.closeBtn.focus(); } catch (e) {} }, 30);
    if (Axis.app) Axis.app.updateStageButton(true);
  };

  stages.close = function () {
    if (!this._open) return;
    this._open = false;
    this.overlay.hidden = true;
    document.body.classList.remove("stage-open");
    if (this.lastFocus && this.lastFocus.focus) {
      try { this.lastFocus.focus(); } catch (e) {}
    }
    if (Axis.app) Axis.app.updateStageButton(false);
  };

  stages.move = function (dir) {
    var list = this.stageList();
    if (!list.length) return;
    var i = 0;
    for (var k = 0; k < list.length; k++) if (list[k].id === this.activeId) i = k;
    var next = list[Math.max(0, Math.min(list.length - 1, i + dir))];
    if (next && next.id !== this.activeId) this.render(next.id);
  };

  stages.render = function (id) {
    var s = this.stageById(id);
    if (!s) return;
    this.activeId = s.id;
    var self = this;
    var list = this.stageList();

    this.nav.innerHTML = list.map(function (x, i) {
      return '<button class="stage-nav-btn' + (x.id === s.id ? " active" : "") + '" data-stage-id="' + esc(x.id) + '"' +
        ' style="--stage-color:' + esc(x.color) + '">' +
        '<span class="sn-roman">' + esc(x.roman) + '</span>' +
        '<span class="sn-body"><b>' + esc(x.title) + '</b><em>' + esc(x.years) + '</em></span>' +
        '<span class="sn-num">0' + (i + 1) + '</span></button>';
    }).join("");

    this.main.style.setProperty("--stage-color", s.color);
    this.main.innerHTML = this.renderStage(s);
    var body = this.main.closest(".stage-modal-body");
    if (body) body.scrollTop = 0;
    this.main.scrollTop = 0;

    this.nav.querySelectorAll("[data-stage-id]").forEach(function (b) {
      b.addEventListener("click", function () { self.render(b.getAttribute("data-stage-id")); });
    });
    this.main.querySelectorAll("[data-stage-year]").forEach(function (b) {
      b.addEventListener("click", function () {
        self.goYear(parseFloat(b.getAttribute("data-stage-year")));
      });
    });
    this.main.querySelectorAll("[data-event-uid]").forEach(function (b) {
      b.addEventListener("click", function () {
        var uid = b.getAttribute("data-event-uid");
        self.close();
        if (!uid) return;
        if (Axis.app) {
          if (Axis.app.state.tab !== "shigang") Axis.app.setTab("shigang");
          Axis.app.selectUid(uid, { setYear: true });
          Axis.app.flashPlayhead();
        }
      });
    });
    this.main.querySelectorAll("[data-theory-id]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-theory-id");
        var uid = "m:" + id;
        self.close();
        if (!Axis.app) return;
        Axis.app.setTab("mao");
        setTimeout(function () {
          if (D.item(uid)) Axis.app.selectUid(uid, { setYear: true });
        }, 40);
      });
    });
    this.main.querySelectorAll("[data-stage-step]").forEach(function (b) {
      b.addEventListener("click", function () {
        self.move(parseInt(b.getAttribute("data-stage-step"), 10) || 1);
      });
    });
    this.main.querySelectorAll("[data-more-points]").forEach(function (b) {
      b.addEventListener("click", function () {
        var box = b.closest(".stage-points");
        if (!box) return;
        var on = box.classList.toggle("expanded");
        b.textContent = on ? "收起重点" : "展开全部重点";
      });
    });
  };

  stages.goYear = function (year) {
    this.close();
    if (!Axis.app) return;
    if (Axis.app.state.tab !== "shigang") Axis.app.setTab("shigang");
    Axis.app.setYear(year);
    Axis.app.autoSelectForYear(year);
    Axis.app.flashPlayhead();
  };

  stages.renderStage = function (s) {
    var events = (s.events || []).map(function (id) {
      return D.findById("history", id);
    }).filter(Boolean);
    var forceYears = s.forceYears || [];
    var routes = dynamicsRoutesFor(s);
    var theories = (s.theories || []).map(function (id) { return D.getTheory(id); }).filter(Boolean);

    var h = '';
    h += '<div class="stage-hero" style="--stage-color:' + esc(s.color) + '">';
    h += '<div class="stage-hero-top"><div class="stage-kicker">' + esc(s.kicker) + '</div>' +
      '<div class="stage-hero-actions">' +
      '<button class="stage-action" data-stage-year="' + esc(s.from) + '">定位到阶段起点</button>' +
      '<button class="stage-action" data-stage-year="' + esc(s.mapYear || s.from) + '">看地图</button>' +
      '</div></div>';
    h += '<div class="stage-title-row"><span class="stage-roman">' + esc(s.roman) + '</span>' +
      '<div><div class="stage-years">' + esc(s.years) + '</div>' +
      '<h2>' + esc(s.title) + ' <span class="stage-title-sub">' + esc(s.tagline) + '</span></h2></div></div>';
    h += '<p class="stage-thesis">' + esc(s.thesis) + '</p>';
    h += '</div>';

    h += '<div class="stage-metrics">' +
      '<div class="stage-metric"><span class="sm-label">国情定位</span><b>' + esc(s.scene) + '</b></div>' +
      '<div class="stage-metric"><span class="sm-label">主要矛盾</span><b>' + s.contradictions.map(esc).join("<br>") + '</b></div>' +
      '<div class="stage-metric"><span class="sm-label">历史任务</span><b>' + esc(s.task) + '</b></div>' +
      '</div>';

    h += '<section class="stage-section">' +
      '<div class="stage-section-head"><span class="ss-num">01</span><h3>阶段力量对比</h3>' +
      '<span class="ss-sub">按省域着色计数 · 34 个省级单元 · 单位：省</span></div>' +
      '<div class="stage-chart-grid">' +
      '<div class="force-chart-wrap"><div class="chart-cap">代表年份的地图着色构成</div>' +
      renderForceChart(s) + '</div>' +
      '<div class="density-chart-wrap"><div class="chart-cap">阶段内史纲事件密度 <em>点击柱条定位</em></div>' +
      renderDensity(s) + '</div>' +
      '</div>' +
      '<div class="chart-note">统计口径：当前时期每个省级单元的势力着色；港澳按历史势力标识，台湾按一个中国原则统一着色。仅用于建立“力量格局”直觉，不是精确控制区面积。</div>' +
      '</section>';

    h += '<section class="stage-section">' +
      '<div class="stage-section-head"><span class="ss-num">02</span><h3>事件发展链</h3>' +
      '<span class="ss-sub">点击任一事件，回到地图与考点卡</span></div>' +
      '<div class="stage-events">' + events.map(function (it, i) {
        return '<button class="stage-event" data-event-uid="' + esc(it.uid) + '">' +
          '<span class="se-year">' + yearLabel(it.year) + '</span>' +
          '<span class="se-dot"></span>' +
          '<span class="se-title">' + esc(it.short || it.title) + '</span>' +
          '<span class="se-rank">' + (i + 1) + '</span></button>';
      }).join("") + '</div>' +
      (routes.length ? '<div class="stage-route-row"><span class="sr-label">地图动态层</span>' +
        routes.map(function (r) {
          return '<button class="stage-route" data-stage-year="' + esc(Math.max(s.from, r.from)) + '">' +
            '<span class="sr-line" style="--rc:' + esc(r.color) + '"></span>' + esc(r.name) + '</button>';
        }).join("") + '</div>' : "") +
      '</section>';

    h += '<section class="stage-section">' +
      '<div class="stage-section-head"><span class="ss-num">03</span><h3>徐涛重点</h3>' +
      '<span class="ss-sub">从复盘笔记提炼 · 先记结论再补细节</span></div>' +
      '<div class="stage-points' + ((s.points || []).length > 4 ? " collapsed" : "") + '">' +
      (s.points || []).map(function (p, i) {
        return '<article class="stage-point"><span class="sp-index">' + ('0' + (i + 1)).slice(-2) + '</span>' +
          '<div><h4>' + esc(p.k) + '</h4><p>' + esc(p.v) + '</p></div></article>';
      }).join("") + '</div>' +
      ((s.points || []).length > 4 ? '<button class="stage-more" data-more-points>展开全部重点</button>' : "") +
      '</section>';

    if (s.economy && s.economy.length) {
      h += '<section class="stage-section">' +
        '<div class="stage-section-head"><span class="ss-num">04</span><h3>五种经济成分</h3>' +
        '<span class="ss-sub">过渡时期新民主主义社会的经济结构</span></div>' +
        '<div class="economy-grid">' + s.economy.map(function (e, i) {
          return '<div class="economy-item"><span class="eco-idx">' + ('0' + (i + 1)).slice(-2) + '</span>' +
            '<b>' + esc(e.name) + '</b><span>' + esc(e.note) + '</span></div>';
        }).join("") + '</div></section>';
    }

    h += '<section class="stage-section">' +
      '<div class="stage-section-head"><span class="ss-num">' + (s.economy && s.economy.length ? "05" : "04") + '</span><h3>易混辨析</h3>' +
      '<span class="ss-sub">选择题最爱设陷阱的地方</span></div>' +
      '<div class="pitfall-list">' + (s.pitfalls || []).map(function (p) {
        return '<div class="pitfall-row"><span class="pf-wrong"><i>×</i>' + esc(p[0]) + '</span>' +
          '<span class="pf-right"><i>√</i>' + esc(p[1]) + '</span></div>';
      }).join("") + '</div></section>';

    h += '<section class="stage-section">' +
      '<div class="stage-section-head"><span class="ss-num">' + (s.economy && s.economy.length ? "06" : "05") + '</span><h3>复习清单</h3>' +
      '<span class="ss-sub">按时间顺序过一遍，能复述再打勾</span></div>' +
      '<div class="stage-checklist">' + (s.checklist || []).map(function (c) {
        return '<span class="check-item">' + esc(c) + '</span>';
      }).join("") + '</div></section>';

    if (theories.length) {
      h += '<section class="stage-section">' +
        '<div class="stage-section-head"><span class="ss-num">' + (s.economy && s.economy.length ? "07" : "06") + '</span><h3>毛中特理论坐标</h3>' +
        '<span class="ss-sub">点击进入理论图谱对应节点</span></div>' +
        '<div class="stage-theories">' + theories.map(function (t) {
          return '<button class="stage-theory" data-theory-id="' + esc(t.id) + '" style="--tc:' + esc(t.color) + '">' +
            '<span class="st-dot"></span><b>' + esc(t.name) + '</b><span>' + esc(t.status || "") + '</span></button>';
        }).join("") + '</div></section>';
    }

    h += '<div class="stage-foot">' +
      '<button class="stage-action" data-stage-step="-1">← 上一阶段</button>' +
      '<span>' + esc(window.STAGES.meta.source) + ' · ' + esc(window.STAGES.meta.note) + '</span>' +
      '<button class="stage-action" data-stage-step="1">下一阶段 →</button>' +
      '</div>';

    return h;
  };

  function forceCounts(year) {
    var period = D.periodAt(year);
    var counts = {};
    if (!D.geo || !period) return { list: [], total: 0 };
    D.geo.provinces.forEach(function (p) {
      var key = D.forceOf(period, p.short);
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    var list = Object.keys(counts).map(function (key) {
      return { key: key, name: D.forceName(key), color: D.forceColor(key), count: counts[key] };
    }).sort(function (a, b) { return b.count - a.count; });
    return { list: list, total: D.geo.provinces.length };
  }

  function renderForceChart(s) {
    var years = s.forceYears || [];
    if (!years.length) return '<div class="chart-empty">暂无数据</div>';
    var allKeys = {};
    var rows = years.map(function (y) {
      var c = forceCounts(y);
      c.list.forEach(function (x) { allKeys[x.key] = x; });
      return { year: y, data: c };
    });
    var legendKeys = Object.keys(allKeys).map(function (k) { return allKeys[k]; })
      .sort(function (a, b) { return b.count - a.count; });
    var h = '<div class="force-rows">';
    rows.forEach(function (row) {
      var total = row.data.total || 1;
      var top = row.data.list.slice(0, 6);
      var other = row.data.list.slice(6);
      var otherCount = other.reduce(function (n, x) { return n + x.count; }, 0);
      h += '<div class="force-row"><span class="force-year">' + yearLabel(row.year) + '</span>' +
        '<span class="force-bar">';
      top.forEach(function (x) {
        h += '<span class="force-seg" style="width:' + (x.count / total * 100).toFixed(2) + '%;background:' + esc(x.color) + '" title="' + esc(x.name + " " + x.count) + '"></span>';
      });
      if (otherCount > 0) {
        h += '<span class="force-seg force-other" style="width:' + (otherCount / total * 100).toFixed(2) + '%" title="其他 ' + otherCount + ' 省"></span>';
      }
      h += '</span><span class="force-count">' + total + '</span></div>';
    });
    h += '</div>';
    h += '<div class="force-legend">' + legendKeys.map(function (x) {
      return '<span class="force-key"><i style="background:' + esc(x.color) + '"></i>' + esc(x.name) + '</span>';
    }).join("") + (legendKeys.length > 6 ? '<span class="force-key muted">其他见地图</span>' : '') + '</div>';
    return h;
  }

  function densityBins(s) {
    var span = s.to - s.from;
    var width = span <= 10 ? 1 : span <= 70 ? 5 : 4;
    var starts = [];
    for (var y = s.from; y < s.to; y += width) starts.push(y);
    return { width: width, bins: starts };
  }

  function renderDensity(s) {
    var info = densityBins(s);
    var items = D.historyItems || [];
    var counts = info.bins.map(function (start) {
      var end = start + info.width;
      var list = items.filter(function (it) { return it.year >= start && it.year < end; });
      return { start: start, end: end, count: list.length, items: list };
    });
    var max = Math.max.apply(null, counts.map(function (x) { return x.count; }).concat([1]));
    var h = '<div class="density-bars">';
    counts.forEach(function (b, i) {
      var pct = Math.max(2, Math.round(b.count / max * 100));
      var label = b.count ? '<span class="db-count">' + b.count + '</span>' : "";
      h += '<button class="density-bar" data-stage-year="' + esc(b.start) + '" title="' + yearLabel(b.start) + '—' + yearLabel(b.end - 1) + ' · ' + b.count + ' 个史纲事件" style="--bh:' + pct + '%">' +
        '<span class="db-fill"></span>' + label + '</button>';
    });
    h += '</div><div class="density-axis"><span>' + yearLabel(s.from) + '</span><span>' +
      (info.width === 1 ? "每年" : "每 " + info.width + " 年") + ' · 共 ' + items.filter(function (it) { return it.year >= s.from && it.year < s.to; }).length +
      ' 个事件</span><span>' + yearLabel(s.to - (info.width === 1 ? 1 : 0)) + '</span></div>';
    return h;
  }

  function dynamicsRoutesFor(s) {
    var all = (window.AXIS_DYNAMICS && window.AXIS_DYNAMICS.routes) || [];
    return all.filter(function (r) { return r.to >= s.from && r.from <= s.to; });
  }

  Axis.stages = stages;
})();
