/* ============================================================
   compare.js — 「考点对照」速查弹层
   土地纲领 / 制度与剥削 / 著作坐标 / 时间定位 四张表
   ============================================================ */
(function () {
  "use strict";
  var Axis = window.Axis = window.Axis || {};
  var U = Axis.util;

  var compare = {
    overlay: null,
    tabsEl: null,
    bodyEl: null,
    closeBtn: null,
    lastFocus: null,
    activeTab: "land",
    _open: false
  };

  function data() {
    return window.AXIS_COMPARE || { tabs: [], meta: {} };
  }
  function esc(v) { return U.esc(v == null ? "" : String(v)); }

  compare.init = function () {
    this.overlay = U.$("#compareOverlay");
    this.tabsEl = U.$("#compareTabs");
    this.bodyEl = U.$("#compareBody");
    this.closeBtn = U.$("#compareClose");
    if (!this.overlay) return;
    var self = this;

    if (this.closeBtn) this.closeBtn.addEventListener("click", function () { self.close(); });
    this.overlay.addEventListener("click", function (e) {
      if (e.target === self.overlay) self.close();
    });
    if (this.tabsEl) this.tabsEl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-compare-tab]");
      if (!b) return;
      self.render(b.getAttribute("data-compare-tab"));
    });

    var topBtn = U.$("#compareBtn");
    if (topBtn) topBtn.addEventListener("click", function () {
      if (self.isOpen()) self.close(); else self.open();
    });
    var stageBtn = U.$("#stageCompareBtn");
    if (stageBtn) stageBtn.addEventListener("click", function () {
      if (Axis.stages && Axis.stages.isOpen()) Axis.stages.close();
      self.open();
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

  compare.isOpen = function () { return this._open; };

  compare.open = function (tab) {
    if (!this.overlay) return;
    if (Axis.stages && Axis.stages.isOpen()) Axis.stages.close();
    this.lastFocus = document.activeElement;
    this._open = true;
    this.overlay.hidden = false;
    document.body.classList.add("compare-open");
    this.render(tab || this.activeTab || "land");
    if (Axis.app) Axis.app.updateCompareButton(true);
    if (this.closeBtn) setTimeout(function () { try { compare.closeBtn.focus(); } catch (e) {} }, 30);
  };

  compare.close = function () {
    if (!this._open) return;
    this._open = false;
    this.overlay.hidden = true;
    document.body.classList.remove("compare-open");
    if (this.lastFocus && this.lastFocus.focus) {
      try { this.lastFocus.focus(); } catch (e) {}
    }
    if (Axis.app) Axis.app.updateCompareButton(false);
  };

  compare.move = function (dir) {
    var list = data().tabs || [];
    if (!list.length) return;
    var i = 0;
    for (var k = 0; k < list.length; k++) if (list[k].id === this.activeTab) i = k;
    var next = list[Math.max(0, Math.min(list.length - 1, i + dir))];
    if (next && next.id !== this.activeTab) this.render(next.id);
  };

  compare.render = function (id) {
    var list = data().tabs || [];
    var tab = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) tab = list[i];
    if (!tab) tab = list[0];
    if (!tab) return;
    this.activeTab = tab.id;
    var self = this;

    if (this.tabsEl) {
      this.tabsEl.innerHTML = list.map(function (x) {
        return '<button class="cmp-tab' + (x.id === tab.id ? " active" : "") + '" data-compare-tab="' + esc(x.id) + '" role="tab" aria-selected="' + (x.id === tab.id) + '">' +
          '<b>' + esc(x.label) + '</b><span>' + esc(x.kicker) + '</span></button>';
      }).join("");
    }

    this.bodyEl.innerHTML =
      '<div class="cmp-head">' +
        '<div><div class="cmp-kicker">' + esc(tab.kicker) + '</div><h3>' + esc(tab.title) + '</h3></div>' +
        '<div class="cmp-count">' + (tab.rows || []).length + ' 条</div>' +
      '</div>' +
      '<p class="cmp-lead">' + esc(tab.lead || "") + '</p>' +
      renderTable(tab) +
      '<div class="cmp-source">' + esc((data().meta && data().meta.source) || "") + '</div>';

    var body = this.overlay.querySelector(".compare-body");
    if (body) body.scrollTop = 0;
  };

  function renderTable(tab) {
    var rows = tab.rows || [];
    var h = '<div class="cmp-scroll-hint">左右滑动查看完整列</div>' +
      '<div class="cmp-table-wrap"><table class="cmp-table" data-kind="' + esc(tab.id) + '">';
    h += '<thead><tr>' + (tab.columns || []).map(function (c) { return '<th>' + esc(c) + '</th>'; }).join("") + '</tr></thead><tbody>';
    rows.forEach(function (row) {
      var cells = row && row.cells ? row.cells : row;
      h += '<tr>' + (cells || []).map(function (c) {
        if (c && typeof c === "object") {
          return '<td><span class="cmp-tag tone-' + esc(c.tone || "neutral") + '">' + esc(c.t) + '</span></td>';
        }
        return '<td>' + esc(c) + '</td>';
      }).join("") + '</tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  Axis.compare = compare;
})();
