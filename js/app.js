/* ============================================================
   app.js — 状态、交互、播放、搜索、深链
   ============================================================ */
(function () {
  "use strict";
  var Axis = window.Axis = window.Axis || {};
  var U = Axis.util;
  var D = Axis.data;

  var app = {
    state: {
      tab: "shigang",
      year: 1855,
      uid: null,
      topicUid: null,
      opts: { slow: true, mapBg: true, force: true, labels: false, task: true },
      forceFilter: null,
      theoryFilter: null,
      sidebarHidden: false,
      period: null
    },
    _hashTimer: null,
    _mapYear: null,
    _periodId: null,
    _forceDirty: false,
    _pushHash: false,
    _suppressPush: false,
    _focusBefore: null,
    _slowItems: [],
    _searchIndex: [],
    _searchResults: [],
    _searchActive: 0,
    _searchOpen: false
  };

  /* ---------------- 基础查询 ---------------- */
  app.currentItem = function () {
    return this.state.uid ? D.item(this.state.uid) : null;
  };
  app.currentTopic = function () {
    return this.state.topicUid ? D.topicByUid(this.state.topicUid) : null;
  };
  app.currentTheoryId = function () {
    var t = this.currentTopic();
    if (t) return t.theory;
    var it = this.currentItem();
    if (it && it.kind === "theory") return it.theory;
    if (this.state.theoryFilter) return this.state.theoryFilter;
    return null;
  };

  /* ---------------- 初始化 ---------------- */
  app.init = function () {
    try {
      D.init();
      Axis.map.init();
      Axis.theory.init();
      Axis.timeline.init();
      Axis.panels.init();
      if (Axis.stages) Axis.stages.init();
      this.bind();
      this._searchIndex = D.searchIndex();

      var h = this.readHash();
      var tab = (h.tab === "mao" || h.tab === "all" || h.tab === "shigang") ? h.tab : "shigang";
      var range = D.tabRange(tab);
      var defaultYear = tab === "mao" ? 1921 : 1855;
      this.state.tab = tab;
      this.state.year = U.clamp(isFinite(h.year) ? h.year : defaultYear, range[0], range[1]);
      this.applyTabShell(tab);
      this.renderYearState();

      if (h.topic && tab === "mao" && D.getTopic(h.topic)) {
        this.selectTopic(h.topic);
      } else if (h.uid && D.item(h.uid)) {
        var it = D.item(h.uid);
        if (it.kind === "theory" && tab !== "mao") {
          this.applyTabShell("mao");
          this.state.tab = "mao";
        }
        this.selectUid(h.uid, { setYear: true, silent: true });
      } else {
        this.autoSelectForYear(this.state.year);
      }
      this.scheduleHash(false);
      this.updateChrome();
      Axis.map.resize();
      var self = this;
      setTimeout(function () {
        Axis.timeline.layout();
        Axis.map.resize();
        if (self.state.tab === "mao") Axis.theory.render();
        self.renderSelectionState();
      }, 80);
    } catch (err) {
      console.error(err);
      var sc = U.$("#leftContent");
      if (sc) {
        sc.innerHTML = '<div class="sec"><div class="sec-label">加载失败</div><p style="color:var(--red)">' +
          U.esc(err && err.message ? err.message : String(err)) +
          "</p><p>请检查 data/*.js 数据文件与浏览器控制台。</p></div>";
      }
      var t = U.$("#leftTitle");
      if (t) t.textContent = "数据加载异常";
    }
  };

  app.bind = function () {
    var self = this;

    var tabs = U.$("#tabs");
    if (tabs) tabs.addEventListener("click", function (e) {
      var b = e.target.closest(".tab");
      if (!b) return;
      self.setTab(b.getAttribute("data-tab"));
    });

    var playBtn = U.$("#playBtn");
    if (playBtn) playBtn.addEventListener("click", function () { Axis.player.toggle(); });
    var speedSel = U.$("#speedSel");
    if (speedSel) speedSel.addEventListener("change", function () { Axis.player.setSpeed(parseFloat(speedSel.value)); });
    var dirBtn = U.$("#dirBtn");
    if (dirBtn) dirBtn.addEventListener("click", function () {
      Axis.player.setDirection(Axis.player.direction * -1);
      self.updateChrome();
      U.toast(Axis.player.direction > 0 ? "正放" : "倒放");
    });

    var optSlow = U.$("#optSlow");
    if (optSlow) optSlow.addEventListener("change", function () { self.state.opts.slow = optSlow.checked; });
    var optMapBg = U.$("#optMapBg");
    if (optMapBg) optMapBg.addEventListener("change", function () {
      self.state.opts.mapBg = optMapBg.checked;
      U.$("#app").classList.toggle("no-map-bg", !optMapBg.checked);
    });
    var optForce = U.$("#optForce");
    if (optForce) optForce.addEventListener("change", function () {
      self.state.opts.force = optForce.checked;
      self._forceDirty = true;
      self.renderYearState();
      if (self.currentItem()) self.renderSelectionState();
    });
    var optLabels = U.$("#optLabels");
    if (optLabels) optLabels.addEventListener("change", function () {
      self.state.opts.labels = optLabels.checked;
      Axis.map.setLabels(optLabels.checked);
    });
    var optTask = U.$("#optTask");
    if (optTask) optTask.addEventListener("change", function () {
      self.state.opts.task = optTask.checked;
      self.updatePeriodTip();
    });

    var jumps = U.$("#yearJumps");
    if (jumps) jumps.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      var v = b.getAttribute("data-year");
      var range = D.tabRange(self.state.tab);
      var year = v === "start" ? range[0] : Number(v);
      Axis.player.pause();
      self.setYear(year, { autoSelect: true });
      self.flashPlayhead();
    });

    var sidebar = U.$("#sidebarBtn");
    if (sidebar) sidebar.addEventListener("click", function () {
      self.state.sidebarHidden = !self.state.sidebarHidden;
      U.$("#app").classList.toggle("sidebar-hidden", self.state.sidebarHidden);
      sidebar.textContent = self.state.sidebarHidden ? "显示边栏" : "隐藏边栏";
      setTimeout(function () {
        Axis.map.resize();
        Axis.timeline.layout();
        if (self.state.tab === "mao") Axis.theory.render();
      }, 40);
    });

    var searchBtn = U.$("#searchBtn");
    if (searchBtn) searchBtn.addEventListener("click", function () { self.openSearch(); });
    var overlay = U.$("#searchOverlay");
    if (overlay) overlay.addEventListener("click", function (e) {
      if (e.target === overlay) self.closeSearch();
    });
    if (overlay) overlay.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var focusables = Array.prototype.slice.call(
        overlay.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])')
      ).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
      if (!focusables.length) return;
      var i = focusables.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); focusables[focusables.length - 1].focus(); }
      else if (!e.shiftKey && i === focusables.length - 1) { e.preventDefault(); focusables[0].focus(); }
    });
    var input = U.$("#searchInput");
    if (input) {
      input.addEventListener("input", function () { self.renderSearch(input.value.trim()); });
      input.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") { e.preventDefault(); self.moveSearch(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); self.moveSearch(-1); }
        else if (e.key === "Enter") { e.preventDefault(); self.chooseSearch(self._searchActive); }
        else if (e.key === "Escape") { e.preventDefault(); self.closeSearch(); }
      });
    }
    var results = U.$("#searchResults");
    if (results) results.addEventListener("click", function (e) {
      var b = e.target.closest("[data-index]");
      if (!b) return;
      self.chooseSearch(Number(b.getAttribute("data-index")));
    });

    var locate = U.$("#eventLocate");
    if (locate) locate.addEventListener("click", function () { self.flashPlayhead(); });

    var stageBtn = U.$("#stageBtn");
    if (stageBtn) stageBtn.addEventListener("click", function () {
      if (!Axis.stages) return;
      if (Axis.stages.isOpen()) Axis.stages.close();
      else Axis.stages.open();
    });

    document.addEventListener("keydown", function (e) { self.onKey(e); });
    window.addEventListener("hashchange", function () { self.applyHash(); });
    window.addEventListener("popstate", function () { self.applyHash(); });
    window.addEventListener("resize", U.debounce(function () {
      Axis.timeline.layout();
      Axis.map.resize();
    }, 180));
  };

  app.applyHash = function () {
    var h = this.readHash();
    if (!h.tab) return;
    if (h.tab !== "shigang" && h.tab !== "mao" && h.tab !== "all") return;
    this._suppressPush = true;
    try {
      if (h.tab !== this.state.tab) {
        Axis.player.pause();
        this.state.uid = null;
        this.state.topicUid = null;
        this.applyTabShell(h.tab);
        this._periodId = null;
        this._mapYear = null;
      }
      if (isFinite(h.year)) {
        var range = D.tabRange(this.state.tab);
        this.state.year = U.clamp(h.year, range[0], range[1]);
        this.renderYearState();
      }
      if (h.topic && D.getTopic(h.topic)) {
        this.selectTopic(h.topic);
      } else if (h.uid && D.item(h.uid)) {
        this.selectUid(h.uid, { setYear: true, silent: true });
      } else {
        this.autoSelectForYear(this.state.year);
      }
    } finally {
      this._suppressPush = false;
    }
  };

  /* ---------------- 标签切换 ---------------- */
  app.applyTabShell = function (tab) {
    this.state.tab = tab;
    var root = U.$("#app");
    root.classList.toggle("tab-mao", tab === "mao");
    U.$$("#tabs .tab").forEach(function (b) {
      var on = b.getAttribute("data-tab") === tab;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    Axis.timeline.setTab(tab);
    Axis.map.setTab(tab);
    this.state.forceFilter = null;
    this.state.theoryFilter = null;
    Axis.map.setForceFilter(null);
    Axis.theory.highlightTheory(null);
    this._slowItems = D.itemsFor(tab).filter(function (it) { return it.rank === 1; });
    if (tab === "mao") {
      Axis.theory.render();
      Axis.map.hideCallout();
    } else {
      Axis.map.scheduleOverlay();
    }
    this.updateChrome();
  };

  app.setTab = function (tab) {
    if (tab !== "shigang" && tab !== "mao" && tab !== "all") return;
    if (tab === this.state.tab) return;
    Axis.player.pause();
    this.state.uid = null;
    this.state.topicUid = null;
    this.applyTabShell(tab);
    var range = D.tabRange(tab);
    this.state.year = U.clamp(this.state.year, range[0], range[1]);
    if (tab === "mao") this.state.year = Math.max(1921, this.state.year);
    this._periodId = null;
    this._mapYear = null;
    this.renderYearState();
    this.autoSelectForYear(this.state.year);
    this.scheduleHash(!this._suppressPush);
  };

  /* ---------------- 年份 ---------------- */
  app.setYear = function (year, opts) {
    opts = opts || {};
    var range = D.tabRange(this.state.tab);
    var y = U.clamp(Number(year), range[0], range[1]);
    this.state.year = y;
    this.renderYearState();
    if (opts.autoSelect) this.autoSelectForYear(y);
  };

  app.renderYearState = function () {
    var period = D.periodAt(this.state.year);
    this.state.period = period;
    if (period && (this._periodId !== period.id || this._forceDirty)) {
      Axis.map.setPeriod(period, this.state.opts.force);
      this._periodId = period.id;
      this._forceDirty = false;
    }
    if (period && this.state.forceFilter && (period.legend || []).indexOf(this.state.forceFilter) < 0) {
      this.state.forceFilter = null;
      Axis.map.setForceFilter(null);
    }
    if (this._mapYear !== Math.floor(this.state.year)) {
      Axis.map.setYear(this.state.year);
      this._mapYear = Math.floor(this.state.year);
    }
    Axis.timeline.updateYear(this.state.year);
    this.updateChrome();
    this.scheduleHash(false);
  };

  app.autoSelectForYear = function (year) {
    var item = D.latestItem(this.state.tab, year);
    if (!item) return;
    if (this.state.uid === item.uid && !this.state.topicUid) return;
    this.selectUid(item.uid, { setYear: false, fromAuto: true });
  };

  /* ---------------- 选择 ---------------- */
  app.selectUid = function (uid, opts) {
    opts = opts || {};
    var item = D.item(uid);
    if (!item) return;
    if (opts.fromMap || opts.fromTimeline || opts.fromGraph || opts.fromPanel || opts.fromSearch) {
      Axis.player.pause();
    }
    this.state.uid = uid;
    this.state.topicUid = null;
    if (opts.setYear !== false) {
      var range = D.tabRange(this.state.tab);
      this.state.year = U.clamp(item.year, range[0], range[1]);
      this._periodId = null;
      this._mapYear = null;
      this.renderYearState();
    }
    this.renderSelectionState();
    if (opts.fromSearch) U.toast("已定位：" + item.title);
    this.scheduleHash(!this._suppressPush && !opts.fromAuto && !opts.fromPlay && !opts.silent);
  };

  app.selectTopic = function (id) {
    var topic = D.getTopic(id);
    if (!topic) return;
    Axis.player.pause();
    this.state.topicUid = "t:" + id;
    this.state.uid = null;
    Axis.theory.highlightTheory(topic.theory);
    this.renderSelectionState();
    this.scheduleHash(!this._suppressPush);
  };

  app.clearTopic = function () {
    this.state.topicUid = null;
    var item = D.latestItem(this.state.tab, this.state.year);
    if (item) {
      this.selectUid(item.uid, { setYear: false, fromPanel: true });
    } else {
      this.renderSelectionState();
      this.scheduleHash(!this._suppressPush);
    }
  };

  app.renderSelectionState = function () {
    var item = this.currentItem();
    var topic = this.currentTopic();
    Axis.panels.renderLeft(item, topic);
    Axis.panels.renderRight(item, topic);
    Axis.map.setSelection(item ? item.uid : null);
    Axis.timeline.setSelection(item ? item.uid : null);
    Axis.theory.setSelection(item && item.kind === "theory" ? item.uid : null);
    if (this.state.tab !== "mao") Axis.map.scheduleOverlay();
    this.updatePeriodTip();
  };

  app.stepItem = function (dir) {
    var items = D.itemsFor(this.state.tab);
    if (!items.length) return;
    var idx = this.state.uid ? D.indexInTab(this.state.tab, this.state.uid) : -1;
    if (this.state.topicUid) {
      var latest = D.latestItem(this.state.tab, this.state.year);
      if (latest) { this.selectUid(latest.uid, { setYear: true, fromPanel: true }); return; }
    }
    var next = U.clamp(idx + dir, 0, items.length - 1);
    if (next === idx) {
      U.toast(dir < 0 ? "已经是第一个节点" : "已经是最后一个节点");
      return;
    }
    this.selectUid(items[next].uid, { setYear: true, fromPanel: true });
  };

  app.setForceFilter = function (key) {
    this.state.forceFilter = key || null;
    Axis.map.setForceFilter(this.state.forceFilter);
    Axis.panels.renderRight(this.currentItem(), this.currentTopic());
  };

  app.setTheoryFilter = function (id) {
    this.state.theoryFilter = id || null;
    Axis.theory.highlightTheory(this.state.theoryFilter);
    Axis.panels.renderRight(this.currentItem(), this.currentTopic());
  };

  /* ---------------- 播放 ---------------- */
  app.setPlayingUI = function () {
    var root = U.$("#app");
    if (!root) return;
    root.classList.toggle("is-playing", Axis.player.playing);
    var label = U.$("#playLabel");
    if (label) label.textContent = Axis.player.playing ? "暂停" : "播放";
  };

  app.playbackTick = function (dt) {
    var P = Axis.player;
    if (!P.playing) return;
    var range = D.tabRange(this.state.tab);
    var step = 2.15 * P.speed * P.direction * dt;
    var next = this.state.year + step;
    var end = P.direction > 0 ? range[1] : range[0];
    if ((P.direction > 0 && next >= range[1]) || (P.direction < 0 && next <= range[0])) {
      this.setYear(range[1] === end ? end : end, { autoSelect: true });
      P.pause();
      U.toast(P.direction > 0 ? "已到时间轴末端" : "已到时间轴开端");
      return;
    }
    var curr = this.state.year;
    var crossed = null;
    var i;
    if (this.state.opts.slow) {
      if (P.direction > 0) {
        for (i = 0; i < this._slowItems.length; i++) {
          var it = this._slowItems[i];
          if (it.year > curr + 1e-4 && it.year <= next + 1e-4) { crossed = it; break; }
        }
      } else {
        for (i = this._slowItems.length - 1; i >= 0; i--) {
          var it2 = this._slowItems[i];
          if (it2.year < curr - 1e-4 && it2.year >= next - 1e-4) { crossed = it2; break; }
        }
      }
    }
    if (crossed) {
      this.setYear(crossed.year, { autoSelect: false });
      this.selectUid(crossed.uid, { setYear: false, fromPlay: true });
      P.pauseFor(1100);
      return;
    }
    this.setYear(next, { autoSelect: true, fromPlay: true });
  };

  /* ---------------- 顶栏/提示 ---------------- */
  app.updateChrome = function () {
    var st = this.state;
    var range = D.tabRange(st.tab);

    var big = U.$("#bigYear");
    if (big) {
      var txt = U.fmtYear(st.year);
      if (big.textContent !== txt) big.textContent = txt;
    }

    var sub = U.$("#brandSub");
    if (sub) {
      var vol = D.volumeAt(st.year);
      var s;
      if (st.tab === "mao") s = "马克思主义中国化时代化 · 五条主线";
      else if (st.tab === "all") s = vol.label + " × 毛中特";
      else s = vol.label;
      if (sub.textContent !== s) sub.textContent = s;
    }

    var stageTitle = U.$("#stageTitle");
    if (stageTitle) {
      stageTitle.textContent = st.tab === "mao" ? "马克思主义中国化时代化 · 理论图谱"
        : st.tab === "all" ? "中国 · 势力图 × 理论坐标" : "中国 · 势力图";
    }
    var stagePill = U.$("#stagePill");
    if (stagePill) {
      stagePill.textContent = st.tab === "mao" ? "1921—2025 · 五条主线"
        : (st.period && st.period.boundaryNote) ? st.period.boundaryNote : "疆界示意";
    }

    var playLabel = U.$("#playLabel");
    if (playLabel) playLabel.textContent = Axis.player.playing ? "暂停" : "播放";
    var root = U.$("#app");
    if (root) root.classList.toggle("is-playing", Axis.player.playing);
    var dirBtn = U.$("#dirBtn");
    if (dirBtn) dirBtn.textContent = Axis.player.direction > 0 ? "正放" : "倒放";
    var speedSel = U.$("#speedSel");
    if (speedSel && parseFloat(speedSel.value) !== Axis.player.speed) speedSel.value = String(Axis.player.speed);

    if (U.$("#optSlow")) U.$("#optSlow").checked = st.opts.slow;
    if (U.$("#optMapBg")) U.$("#optMapBg").checked = st.opts.mapBg;
    if (U.$("#optForce")) U.$("#optForce").checked = st.opts.force;
    if (U.$("#optLabels")) U.$("#optLabels").checked = st.opts.labels;
    if (U.$("#optTask")) U.$("#optTask").checked = st.opts.task;

    var sidebar = U.$("#sidebarBtn");
    if (sidebar) sidebar.textContent = st.sidebarHidden ? "显示边栏" : "隐藏边栏";

    var jumps = U.$$("#yearJumps button");
    var numericActive = false;
    jumps.forEach(function (b) {
      var v = b.getAttribute("data-year");
      if (v === "start") return;
      var active = Math.abs(st.year - Number(v)) < 0.75;
      if (active) numericActive = true;
      b.classList.toggle("active", active);
    });
    jumps.forEach(function (b) {
      if (b.getAttribute("data-year") !== "start") return;
      b.classList.toggle("active", Math.abs(st.year - range[0]) < 0.75 && !numericActive);
    });

    this.updatePeriodTip();
  };

  app.updatePeriodTip = function () {
    var tip = U.$("#periodTip");
    if (!tip) return;
    if (!this.state.opts.task) { tip.classList.remove("show"); return; }
    var text = "";
    if (this.state.tab === "mao") {
      var th = D.getTheory(this.currentTheoryId());
      text = th ? (th.name + " · " + (th.status || "")) :
        "五条主线：毛泽东思想 → 邓小平理论 → “三个代表”重要思想 → 科学发展观 → 习近平新时代中国特色社会主义思想";
    } else if (this.state.period) {
      text = this.state.period.era + " · " + (this.state.period.summary || "");
    }
    if (tip.textContent !== text) tip.textContent = text;
    tip.classList.toggle("show", !!text);
  };

  app.flashPlayhead = function () {
    var el = U.$("#tlPlayhead");
    if (!el) return;
    el.classList.remove("pulse");
    void el.offsetWidth;
    el.classList.add("pulse");
    setTimeout(function () { el.classList.remove("pulse"); }, 900);
    if (window.matchMedia && window.matchMedia("(max-width: 719px), (max-width: 900px) and (max-height: 500px)").matches) {
      var tl = U.$("#timeline");
      if (tl) tl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    U.toast("已定位到 " + U.fmtYear(this.state.year) + " 年");
  };

  /* ---------------- 搜索 ---------------- */
  app.openSearch = function () {
    this._focusBefore = document.activeElement;
    Axis.player.pause();
    this._searchOpen = true;
    var ov = U.$("#searchOverlay");
    if (!ov) return;
    ov.hidden = false;
    var input = U.$("#searchInput");
    if (input) { input.value = ""; setTimeout(function () { input.focus(); }, 10); }
    this.renderSearch("");
  };

  app.closeSearch = function () {
    this._searchOpen = false;
    var ov = U.$("#searchOverlay");
    if (ov) ov.hidden = true;
    try {
      if (this._focusBefore && this._focusBefore.focus) this._focusBefore.focus();
    } catch (err) { /* ignore */ }
  };

  app.renderSearch = function (q) {
    var box = U.$("#searchResults");
    if (!box) return;
    var list = this._searchIndex;
    var res;
    if (q) {
      var ql = q.toLowerCase();
      var scored = [];
      list.forEach(function (it) {
        var title = String(it.title || "").toLowerCase();
        var chapter = String(it.chapter || "").toLowerCase();
        var keywords = String(it.keywords || "").toLowerCase();
        var score = 0;
        if (title === ql) score += 220;
        else if (title.indexOf(ql) === 0) score += 170;
        else if (title.indexOf(ql) >= 0) score += 120;
        if (chapter.indexOf(ql) >= 0) score += 18;
        if (keywords.indexOf(ql) >= 0) score += 12;
        if (!score) return;
        if (it.kindLabel === "专题") score += 8;
        if (it.rank === 1) score += 4;
        scored.push({ it: it, score: score });
      });
      scored.sort(function (a, b) {
        return b.score - a.score || (a.it.year || 0) - (b.it.year || 0);
      });
      res = scored.slice(0, 40).map(function (x) { return x.it; });
    } else {
      var topics = list.filter(function (it) { return it.uid.indexOf("t:") === 0; }).slice(0, 10);
      var key = list.filter(function (it) { return it.rank === 1 && it.uid.indexOf("t:") !== 0; }).slice(0, 14);
      res = topics.concat(key);
    }
    this._searchResults = res;
    this._searchActive = 0;
    if (!res.length) {
      box.innerHTML = '<div class="search-empty">没有找到相关考点，试试「遵义会议」「井冈山」「中国式现代化」</div>';
      return;
    }
    box.innerHTML = res.map(function (it, i) {
      return '<button class="search-item' + (i === 0 ? " active" : "") + '" data-index="' + i + '">' +
        '<span class="si-year">' + (it.year ? U.fmtYear(it.year) : "专题") + "</span>" +
        '<span class="si-title">' + U.esc(it.title) + "</span>" +
        '<span class="si-chapter">' + U.esc(it.kindLabel) + (it.chapter ? " · " + U.esc(it.chapter) : "") + "</span>" +
        "</button>";
    }).join("");
  };

  app.moveSearch = function (delta) {
    if (!this._searchResults.length) return;
    this._searchActive = U.clamp(this._searchActive + delta, 0, this._searchResults.length - 1);
    var items = U.$$("#searchResults .search-item");
    items.forEach(function (el, i) {
      el.classList.toggle("active", i === this._searchActive);
    }, this);
    if (items[this._searchActive]) items[this._searchActive].scrollIntoView({ block: "nearest" });
  };

  app.chooseSearch = function (idx) {
    var res = this._searchResults[idx];
    if (!res) return;
    this.closeSearch();
    if (res.uid.indexOf("t:") === 0) {
      this.setTab("mao");
      this.selectTopic(res.uid.slice(2));
      U.toast("已打开专题：" + res.title);
      return;
    }
    var item = D.item(res.uid);
    if (!item) return;
    this.setTab(item.kind === "theory" ? "mao" : "shigang");
    this.selectUid(item.uid, { fromSearch: true });
    this.flashPlayhead();
  };

  app.updateStageButton = function (open) {
    var b = U.$("#stageBtn");
    if (!b) return;
    b.classList.toggle("active", !!open);
    b.setAttribute("aria-expanded", open ? "true" : "false");
  };

  /* ---------------- 快捷键 ---------------- */
  app.onKey = function (e) {
    if (this._searchOpen) {
      if (e.key === "Escape") { e.preventDefault(); this.closeSearch(); }
      return;
    }
    if (Axis.stages && Axis.stages.isOpen()) {
      // 阶段图表自己处理 Esc / ← / →，避免同时改变年份
      return;
    }
    var tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    var key = e.key;
    if (key === "g" || key === "G") {
      e.preventDefault();
      if (Axis.stages) Axis.stages.open();
      return;
    }
    if (key === " " || key === "Spacebar") {
      e.preventDefault();
      Axis.player.toggle();
    } else if (key === "ArrowLeft") {
      e.preventDefault();
      Axis.player.pause();
      this.setYear(this.state.year - (e.shiftKey ? 5 : 1), { autoSelect: true });
    } else if (key === "ArrowRight") {
      e.preventDefault();
      Axis.player.pause();
      this.setYear(this.state.year + (e.shiftKey ? 5 : 1), { autoSelect: true });
    } else if (key === "Home") {
      e.preventDefault();
      Axis.player.pause();
      this.setYear(D.tabRange(this.state.tab)[0], { autoSelect: true });
    } else if (key === "End") {
      e.preventDefault();
      Axis.player.pause();
      this.setYear(D.tabRange(this.state.tab)[1], { autoSelect: true });
    } else if (key === "/" || (e.key === "k" && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      this.openSearch();
    } else if (key === "Escape") {
      this.closeSearch();
    }
  };

  /* ---------------- 深链 ---------------- */
  app.readHash = function () {
    var h = String(location.hash || "").replace(/^#/, "");
    var out = {};
    if (!h) return out;
    try {
      var p = new URLSearchParams(h);
      if (p.get("tab")) out.tab = p.get("tab");
      if (p.get("year")) out.year = parseFloat(p.get("year"));
      if (p.get("uid")) out.uid = p.get("uid");
      if (p.get("topic")) out.topic = p.get("topic");
    } catch (err) { /* ignore */ }
    return out;
  };

  app.scheduleHash = function (push) {
    if (push && !this._suppressPush) this._pushHash = true;
    if (this._hashTimer) return;
    var self = this;
    this._hashTimer = setTimeout(function () {
      self._hashTimer = null;
      self.writeHash();
    }, 280);
  };

  app.writeHash = function () {
    var p = new URLSearchParams();
    p.set("tab", this.state.tab);
    p.set("year", String(Math.round(this.state.year * 10) / 10));
    if (this.state.uid) p.set("uid", this.state.uid);
    if (this.state.topicUid) p.set("topic", this.state.topicUid.slice(2));
    try {
      if (this._pushHash) history.pushState(null, "", "#" + p.toString());
      else history.replaceState(null, "", "#" + p.toString());
    } catch (err) { /* file:// fallback */ }
    this._pushHash = false;
  };

  Axis.app = app;
  window.addEventListener("DOMContentLoaded", function () { app.init(); });
})();
