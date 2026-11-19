/* ============================================================
   theory-deck.js — 「理论精讲」弹层
   毛中特五个理论：形成背景 / 核心思想 / 主要内容 / 地位意义
   ============================================================ */
(function () {
  "use strict";
  var Axis = window.Axis = window.Axis || {};
  var U = Axis.util;

  var deck = {
    overlay: null,
    navEl: null,
    mainEl: null,
    closeBtn: null,
    activeId: "mao",
    lastFocus: null,
    _open: false
  };

  function data() {
    return window.THEORY_PROFILES || { profiles: [], meta: {} };
  }
  function esc(v) { return U.esc(v == null ? "" : String(v)); }
  function getProfile(id) {
    var list = data().profiles || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || null;
  }
  function yearOf(p) {
    var m = String(p && p.years || "").match(/\d{4}/);
    return m ? parseInt(m[0], 10) : 1921;
  }
  function relatedNodes(p) {
    var nodes = (Axis.data && Axis.data.maoNodes) || [];
    return nodes.filter(function (n) { return n.theory === p.id; })
      .sort(function (a, b) { return a.year - b.year; });
  }

  deck.init = function () {
    this.overlay = U.$("#theoryOverlay");
    this.navEl = U.$("#theoryNav");
    this.mainEl = U.$("#theoryMain");
    this.closeBtn = U.$("#theoryClose");
    if (!this.overlay) return;
    var self = this;

    if (this.closeBtn) this.closeBtn.addEventListener("click", function () { self.close(); });
    this.overlay.addEventListener("click", function (e) {
      if (e.target === self.overlay) self.close();
    });
    if (this.navEl) this.navEl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-theory-profile]");
      if (!b) return;
      self.render(b.getAttribute("data-theory-profile"));
    });
    if (this.mainEl) this.mainEl.addEventListener("click", function (e) {
      var node = e.target.closest("[data-theory-node]");
      if (node) {
        e.preventDefault();
        self.goNode(node.getAttribute("data-theory-node"));
        return;
      }
      var start = e.target.closest("[data-theory-start]");
      if (start) {
        e.preventDefault();
        self.goStart();
        return;
      }
      var graph = e.target.closest("[data-theory-graph]");
      if (graph) {
        e.preventDefault();
        self.goGraph();
      }
    });

    var topBtn = U.$("#theoryBtn");
    if (topBtn) topBtn.addEventListener("click", function () {
      if (self.isOpen()) self.close(); else self.open();
    });

    // 左栏及阶段弹层内的“理论精讲”入口
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-theory-deck]");
      if (!b) return;
      e.preventDefault();
      self.open(b.getAttribute("data-theory-deck"));
    });

    document.addEventListener("keydown", function (e) {
      if (!self._open) return;
      if (e.key === "Escape") { e.preventDefault(); self.close(); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        e.preventDefault();
        self.move(e.key === "ArrowRight" ? 1 : -1);
      }
    });
  };

  deck.isOpen = function () { return this._open; };

  deck.open = function (id) {
    if (!this.overlay) return;
    if (Axis.stages && Axis.stages.isOpen()) Axis.stages.close();
    if (Axis.compare && Axis.compare.isOpen()) Axis.compare.close();
    this._open = true;
    this.lastFocus = document.activeElement;
    this.overlay.hidden = false;
    document.body.classList.add("theory-open");
    this.render(id || this.activeId || "mao");
    if (Axis.app) Axis.app.updateTheoryButton(true);
    if (this.closeBtn) setTimeout(function () { try { deck.closeBtn.focus(); } catch (e) {} }, 30);
  };

  deck.close = function () {
    if (!this._open) return;
    this._open = false;
    this.overlay.hidden = true;
    document.body.classList.remove("theory-open");
    if (this.lastFocus && this.lastFocus.focus) {
      try { this.lastFocus.focus(); } catch (e) {}
    }
    if (Axis.app) Axis.app.updateTheoryButton(false);
  };

  deck.move = function (dir) {
    var list = data().profiles || [];
    if (!list.length) return;
    var i = 0;
    for (var k = 0; k < list.length; k++) if (list[k].id === this.activeId) i = k;
    var next = list[Math.max(0, Math.min(list.length - 1, i + dir))];
    if (next && next.id !== this.activeId) this.render(next.id);
  };

  deck.render = function (id) {
    var list = data().profiles || [];
    var p = getProfile(id);
    if (!p) return;
    this.activeId = p.id;
    this.mainEl.style.setProperty("--theory-color", p.color || "#c9a45c");

    if (this.navEl) {
      this.navEl.innerHTML = list.map(function (x) {
        var on = x.id === p.id;
        return '<button class="theory-nav-btn' + (on ? " active" : "") + '" data-theory-profile="' + esc(x.id) + '" role="tab" aria-selected="' + on + '" style="--theory-color:' + esc(x.color) + '">' +
          '<span class="theory-nav-year">' + esc(x.years) + '</span>' +
          '<span class="theory-nav-name">' + esc(x.short || x.name) + '</span>' +
          '<span class="theory-nav-dot"></span></button>';
      }).join("");
    }

    var nodes = relatedNodes(p);
    var nodeHtml = nodes.map(function (n) {
      return '<button class="theory-node-chip" data-theory-node="' + esc(n.id) + '" title="' + esc(n.date || "") + '">' +
        '<span>' + esc(n.year) + '</span>' + esc(n.short || n.title) + '</button>';
    }).join("");
    var worksHtml = (p.works || []).map(function (w) {
      return '<span class="theory-tag">' + esc(w) + '</span>';
    }).join("");
    var pitfallsHtml = (p.pitfalls || []).map(function (w) {
      return '<li>' + esc(w) + '</li>';
    }).join("");

    this.mainEl.innerHTML =
      '<div class="theory-profile">' +
        '<div class="theory-hero">' +
          '<div class="theory-hero-kicker">' + esc(p.chapter || "") + ' · ' + esc(p.years || "") + '</div>' +
          '<h3>' + esc(p.name) + '</h3>' +
          '<p class="theory-status">' + esc(p.status || "") + '</p>' +
          '<div class="theory-hero-actions">' +
            '<button class="theory-action primary" data-theory-start>定位到理论起点 ' + yearOf(p) + '</button>' +
            '<button class="theory-action" data-theory-graph>看理论图谱</button>' +
          '</div>' +
        '</div>' +
        '<div class="theory-four">' +
          '<section class="theory-block"><div class="theory-no">01</div><h4>形成背景</h4><p>' + esc(p.formation || "") + '</p></section>' +
          '<section class="theory-block"><div class="theory-no">02</div><h4>核心思想</h4><p class="theory-quote">' + esc(p.core || "") + '</p></section>' +
          '<section class="theory-block"><div class="theory-no">03</div><h4>主要内容</h4><ul>' + (p.main || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></section>' +
          '<section class="theory-block"><div class="theory-no">04</div><h4>重要地位与意义</h4><p>' + esc(p.significance || "") + '</p></section>' +
        '</div>' +
        '<div class="theory-support">' +
          '<div class="theory-support-card"><h4>关键文献 / 会议</h4><div class="theory-tags">' + worksHtml + '</div></div>' +
          '<div class="theory-support-card"><h4>相关理论节点 · 点击定位</h4><div class="theory-nodes">' + nodeHtml + '</div></div>' +
          '<div class="theory-support-card wide"><h4>易混提醒</h4><ul class="theory-pitfalls">' + pitfallsHtml + '</ul></div>' +
        '</div>' +
        '<div class="theory-source">' + esc((data().meta && data().meta.source) || "") + '</div>' +
      '</div>';

    if (this.mainEl) this.mainEl.scrollTop = 0;
  };

  deck.goNode = function (id) {
    if (!id) return;
    this.close();
    if (Axis.app) {
      Axis.app.setTab("mao");
      Axis.app.selectUid("m:" + id, { setYear: true, fromPanel: true });
    }
  };

  deck.goStart = function () {
    var p = getProfile(this.activeId);
    if (!p) return;
    this.close();
    if (Axis.app) {
      Axis.app.setTab("mao");
      Axis.app.setYear(yearOf(p), { autoSelect: true });
    }
  };

  deck.goGraph = function () {
    this.close();
    if (Axis.app) Axis.app.setTab("mao");
  };

  Axis.theoryDeck = deck;
})();
