/* ============================================================
   panels.js — 左栏考点卡 / 右栏事件定位与图例
   ============================================================ */
(function () {
  "use strict";
  var Axis = window.Axis = window.Axis || {};
  var U = Axis.util;

  var panels = {};

  function sec(label, inner) {
    return '<div class="sec"><div class="sec-label">' + label + "</div>" + inner + "</div>";
  }
  function quote(text, red) {
    return '<div class="quote' + (red ? " red" : "") + '">' + U.esc(text) + "</div>";
  }
  function bullets(arr, warn) {
    if (!arr || !arr.length) return "";
    return '<ul class="bullets' + (warn ? " warn" : "") + '">' + arr.map(function (t) {
      return "<li>" + U.esc(t) + "</li>";
    }).join("") + "</ul>";
  }
  function tags(arr, cls) {
    if (!arr || !arr.length) return "";
    return '<div class="tag-row">' + arr.map(function (t) {
      return '<span class="tag ' + (cls || "") + '">' + U.esc(t) + "</span>";
    }).join("") + "</div>";
  }

  panels.init = function () {
    var self = this;
    var scroll = U.$("#leftScroll");
    if (scroll) scroll.addEventListener("scroll", function () { self.updateScrollHint(); });
    var hint = U.$("#scrollHint");
    if (hint) hint.addEventListener("click", function () {
      var sc = U.$("#leftScroll");
      if (sc) sc.scrollBy({ top: Math.max(180, sc.clientHeight * 0.8), behavior: "smooth" });
    });
    this.leftContent = U.$("#leftContent");
    if (this.leftContent) {
      this.leftContent.addEventListener("click", function (e) {
        if (e.target.closest("[data-topic-back]")) {
          e.preventDefault();
          Axis.app.clearTopic();
          return;
        }
        var t = e.target.closest("[data-uid]");
        if (t) {
          e.preventDefault();
          Axis.app.selectUid(t.getAttribute("data-uid"), { fromPanel: true });
          return;
        }
        var top = e.target.closest("[data-topic]");
        if (top) {
          e.preventDefault();
          Axis.app.selectTopic(top.getAttribute("data-topic"));
        }
      });
    }
    var prev = U.$("#prevBtn"), next = U.$("#nextBtn");
    if (prev) prev.addEventListener("click", function () { Axis.app.stepItem(-1); });
    if (next) next.addEventListener("click", function () { Axis.app.stepItem(1); });
    var related = U.$("#relatedCurrent");
    if (related) related.addEventListener("click", function (e) {
      var b = e.target.closest("[data-uid]");
      if (!b) return;
      Axis.app.selectUid(b.getAttribute("data-uid"), { fromPanel: true });
    });
    void self;
  };

  /* ---------------- 左栏 ---------------- */
  panels.renderLeft = function (item, topic) {
    var st = Axis.app.state;
    var titleEl = U.$("#leftTitle"), metaEl = U.$("#leftMeta"), chipEl = U.$("#leftChip");
    var eyebrowEl = U.$("#leftEyebrow"), contentEl = U.$("#leftContent");
    var counterEl = U.$("#leftCounter");
    if (!contentEl) return;

    var isTheory = item && item.kind === "theory";
    var tab = st.tab;

    if (topic) {
      var th = Axis.data.getTheory(topic.theory) || {};
      eyebrowEl.textContent = "理论专题";
      chipEl.textContent = topic.chapter || th.chapter || "毛中特";
      titleEl.textContent = topic.name;
      metaEl.innerHTML = '考点：<strong>毛中特</strong> · ' + U.esc(topic.chapter || th.chapter || "") +
        ' · <span style="color:' + U.esc(th.color || "#c9a45c") + '">' + U.esc(th.name || "") + "</span>";
      contentEl.innerHTML = this.topicHtml(topic, th, st);
      counterEl.textContent = "专题 · " + (Axis.data.topics.indexOf(topic) + 1) + " / " + Axis.data.topics.length;
    } else if (item) {
      eyebrowEl.textContent = isTheory ? "理论坐标" : "历史背景";
      titleEl.textContent = item.title;
      chipEl.textContent = item.chapter || (isTheory ? "毛中特" : "史纲");
      if (isTheory) {
        var t2 = Axis.data.getTheory(item.theory) || {};
        metaEl.innerHTML = '考点：<strong>毛中特</strong> · ' + U.esc(item.chapter || "") +
          (item.place ? " · " + U.esc(item.place) : "") +
          ' · <span style="color:' + U.esc(t2.color || "#c9a45c") + '">' + U.esc(t2.name || "") + "</span>";
        contentEl.innerHTML = this.theoryHtml(item, t2, st);
      } else {
        metaEl.innerHTML = '考点：<strong>史纲</strong> · ' + U.esc(item.chapter || "") +
          (item.chapterTitle ? " · " + U.esc(item.chapterTitle) : "") +
          '<br><span style="color:var(--text-faint)">' + U.esc(item.date || "") +
          (item.place ? " · " + U.esc(item.place) : "") + "</span>";
        contentEl.innerHTML = this.eventHtml(item, st);
      }
      var idx = Axis.data.indexInTab(tab, item.uid);
      var total = Axis.data.itemsFor(tab).length;
      counterEl.textContent = U.pad2(idx + 1) + " / " + total;
      var prev = U.$("#prevBtn"), next = U.$("#nextBtn");
      if (prev) prev.disabled = idx <= 0;
      if (next) next.disabled = idx >= total - 1;
    } else {
      this.renderOverview();
      return;
    }

    var sc = U.$("#leftScroll");
    if (sc) sc.scrollTop = 0;
    var self = this;
    requestAnimationFrame(function () { self.updateScrollHint(); });
  };

  panels.updateScrollHint = function () {
    var sc = U.$("#leftScroll"), hint = U.$("#scrollHint");
    if (!sc || !hint) return;
    var more = sc.scrollHeight - sc.scrollTop - sc.clientHeight > 24;
    hint.hidden = !more;
  };

  panels.eventHtml = function (item, st) {
    var c = item.card || {};
    var h = "";
    if (c.background) h += sec("历史背景", "<p>" + U.esc(c.background) + "</p>");
    if (c.contradiction) h += sec("根本矛盾（主要矛盾）", quote(c.contradiction));
    if (c.task) h += sec("历史任务", quote(c.task));
    if (c.points && c.points.length) h += sec("关键考点", bullets(c.points));
    if (c.pitfalls && c.pitfalls.length) h += sec("易错点", bullets(c.pitfalls, true));
    if (c.memory) h += sec("记忆锚点", '<div class="memory">' + U.esc(c.memory) + "</div>");
    h += this.topicRailHtml(item.theory) ;
    h += tags(item.tags || []);
    if (st.tab === "all" || item.kind === "theory") {
      var th = Axis.data.getTheory(item.theory) || {};
      if (th.name) h += '<div style="margin-top:14px;font-size:10.5px;letter-spacing:1px;color:var(--text-faint)">所属主线：<span style="color:' + th.color + '">' + U.esc(th.name) + "</span></div>";
    }
    return h;
  };

  panels.theoryHtml = function (item, th, st) {
    var c = item.card || {};
    var h = this.topicRailHtml(item.theory);
    if (c.background) h += sec("形成背景", "<p>" + U.esc(c.background) + "</p>");
    if (c.core) h += sec("核心内容", quote(c.core));
    if (c.status) h += sec("历史地位", quote(c.status));
    if (c.points && c.points.length) h += sec("关键考点", bullets(c.points));
    if (c.pitfalls && c.pitfalls.length) h += sec("易错点", bullets(c.pitfalls, true));
    if (c.memory) h += sec("记忆锚点", '<div class="memory">' + U.esc(c.memory) + "</div>");
    h += tags(item.tags || []);
    if (th && th.name) {
      h += '<div class="sec"><div class="sec-label">理论主线</div><div style="display:flex;align-items:center;gap:8px;font-family:var(--serif);font-size:14px;color:' + th.color + '">' +
        '<span style="width:8px;height:8px;background:' + th.color + ';border-radius:2px;box-shadow:0 0 8px ' + th.color + '"></span>' +
        U.esc(th.name) + '<span style="font-size:10.5px;color:var(--text-faint);font-family:var(--sans)">' + U.esc(th.status || "") + "</span></div></div>";
    }
    void st;
    return h;
  };

  panels.topicHtml = function (topic, th, st) {
    var c = topic.card || {};
    var h = '<button class="topic-back" type="button" data-topic-back="1">‹ 返回理论坐标</button>';
    h += this.topicRailHtml(topic.theory, topic.id);
    if (topic.summary) h += sec("专题概述", "<p>" + U.esc(topic.summary) + "</p>");
    if (c.background) h += sec("形成背景", "<p>" + U.esc(c.background) + "</p>");
    if (c.core) h += sec("核心内容", quote(c.core));
    if (c.status) h += sec("历史地位", quote(c.status));
    if (c.points && c.points.length) h += sec("关键考点", bullets(c.points));
    if (c.pitfalls && c.pitfalls.length) h += sec("易错点", bullets(c.pitfalls, true));
    if (c.memory) h += sec("记忆锚点", '<div class="memory">' + U.esc(c.memory) + "</div>");
    if (th && th.name) {
      h += '<div style="margin-top:14px;font-size:10.5px;letter-spacing:1px;color:var(--text-faint)">所属主线：<span style="color:' + th.color + '">' + U.esc(th.name) + "</span></div>";
    }
    void st;
    return h;
  };

  panels.topicRailHtml = function (theoryId, activeId) {
    var topics = Axis.data.topicsForTheory(theoryId);
    if (!topics.length) return "";
    var st = Axis.app.state;
    return '<div class="sec topic-rail-sec"><div class="sec-label">理论专题</div><div class="topic-rail">' +
      topics.map(function (t) {
        var active = (activeId && t.id === activeId) || (!activeId && st.topicUid === "t:" + t.id);
        return '<button class="topic-chip' + (active ? " active" : "") + '" data-topic="' + U.esc(t.id) + '">' + U.esc(t.name) + "</button>";
      }).join("") + "</div></div>";
  };

  panels.renderOverview = function () {
    var st = Axis.app.state;
    var item = Axis.app.currentItem();
    if (item) { this.renderLeft(item, null); return; }
    var eyebrowEl = U.$("#leftEyebrow"), chipEl = U.$("#leftChip");
    var titleEl = U.$("#leftTitle"), metaEl = U.$("#leftMeta"), contentEl = U.$("#leftContent");
    var counterEl = U.$("#leftCounter");
    if (st.tab === "mao") {
      eyebrowEl.textContent = "理论总览";
      chipEl.textContent = "毛中特";
      titleEl.textContent = "马克思主义中国化时代化";
      metaEl.innerHTML = '五条理论主线 · 1921—2025 · 点击专题进入考点';
      var theories = Axis.data.theories;
      var list = theories.map(function (t) {
        var first = null;
        for (var i = 0; i < Axis.data.maoNodes.length; i++) {
          if (Axis.data.maoNodes[i].theory === t.id) { first = Axis.data.maoNodes[i]; break; }
        }
        return '<button class="overview-event" data-uid="' + U.esc(first ? "m:" + first.id : "") + '">' +
          '<span class="oy" style="color:' + t.color + '">●</span><span>' + U.esc(t.name) + "</span>" +
          '<span class="oc">' + U.esc(t.status || "") + "</span></button>";
      }).join("");
      contentEl.innerHTML =
        '<div class="overview"><div class="overview-quote">' + U.esc("马克思主义中国化时代化，就是把马克思主义基本原理同中国具体实际相结合、同中华优秀传统文化相结合，不断推进理论创新。") + "</div>" +
        '<div class="sec"><div class="sec-label">五条主线</div><div class="overview-events">' + list + "</div></div>" +
        '<div class="sec"><div class="sec-label">理论专题</div>' +
        Axis.data.topics.map(function (t) {
          return '<button class="overview-event" data-topic="' + U.esc(t.id) + '"><span>' + U.esc(t.name) + '</span><span class="oc">' + U.esc(t.chapter || "") + "</span></button>";
        }).join("") + "</div></div>";
    } else {
      var period = Axis.data.periodAt(st.year);
      var events = Axis.data.historyItems.filter(function (it) {
        return period && it.year >= period.from && it.year < period.to;
      });
      if (!events.length) events = Axis.data.historyItems.filter(function (it) { return Math.abs(it.year - st.year) < 15; });
      eyebrowEl.textContent = "考点速览";
      chipEl.textContent = Axis.data.volumeAt(st.year).label.split(" · ")[0] || "史纲";
      titleEl.textContent = period ? period.era : "中国近现代史";
      metaEl.innerHTML = period ? (period.from + " — " + period.to + " · " + U.esc(period.summary || "")) : "拖动时间轴，查看不同时期的考点";
      var listHtml = events.slice(0, 9).map(function (it) {
        return '<button class="overview-event" data-uid="' + U.esc(it.uid) + '"><span class="oy">' + U.fmtYear(it.year) + "</span>" +
          "<span>" + U.esc(it.title) + '</span><span class="oc">' + U.esc(it.chapter) + "</span></button>";
      }).join("");
      contentEl.innerHTML = '<div class="overview">' +
        '<div class="overview-quote">' + U.esc(period ? period.summary : "点击时间轴或地图节点，查看考点卡片。") + "</div>" +
        '<div class="sec"><div class="sec-label">本时期关键节点</div><div class="overview-events">' + listHtml + "</div></div>" +
        '<div class="sec"><div class="sec-label">复习提示</div><p style="font-family:var(--serif);font-size:14px;line-height:1.9;color:#c4bcad">' +
        U.esc("先扫年建立时间轴，再回到节点看矛盾、任务、考点三层结构；用易错点做二次校验，最后用记忆锚点串联。") + "</p></div></div>";
    }
    counterEl.textContent = "总览";
    var sc = U.$("#leftScroll");
    if (sc) sc.scrollTop = 0;
    var self = this;
    requestAnimationFrame(function () { self.updateScrollHint(); });
  };

  /* ---------------- 右栏 ---------------- */
  panels.renderRight = function (item, topic) {
    var st = Axis.app.state;
    var tab = st.tab;
    var dateEl = U.$("#eventDate"), titleEl = U.$("#eventTitle"), summaryEl = U.$("#eventSummary");
    var chapterEl = U.$("#eventChapter"), tagsEl = U.$("#eventTags");
    var eyebrowEl = U.$("#eventEyebrow"), rightHead = U.$("#rightHeadLabel");
    var rightPill = U.$("#rightPill");

    if (topic) {
      var thT = Axis.data.getTheory(topic.theory) || {};
      eyebrowEl.textContent = "理论专题";
      rightHead.textContent = tab === "mao" ? "毛中特 · 理论专题" : "中国 · 理论坐标";
      dateEl.textContent = thT.name || "";
      titleEl.textContent = topic.name;
      summaryEl.textContent = topic.summary || (topic.card && topic.card.background) || "";
      chapterEl.textContent = topic.chapter || thT.chapter || "";
      tagsEl.innerHTML = '<span style="color:' + U.esc(thT.color || "#c9a45c") + '">' + U.esc(thT.status || "") + "</span>";
      if (rightPill) rightPill.textContent = "1921—2025 · 理论坐标";
      if (tab === "mao") this.renderTheoryLegend(thT.id, true);
      else this.renderForceLegend(Axis.data.periodAt(st.year));
    } else if (item) {
      if (item.kind === "theory") {
        var th = Axis.data.getTheory(item.theory) || {};
        eyebrowEl.textContent = "理论坐标";
        rightHead.textContent = tab === "mao" ? "毛中特 · 理论坐标" : "中国 · 事件定位";
        dateEl.textContent = item.date || "";
        titleEl.textContent = item.title;
        summaryEl.textContent = item.summary || "";
        chapterEl.textContent = item.chapter || "";
        tagsEl.innerHTML = '<span style="color:' + U.esc(th.color || "#c9a45c") + '">' + U.esc(th.name || "") + "</span>";
        if (rightPill) rightPill.textContent = tab === "mao" ? "1921—2025 · 理论坐标" : ((Axis.data.periodAt(st.year) || {}).boundaryNote || "疆界示意");
        if (tab === "mao") this.renderTheoryLegend(th.id, true);
        else this.renderForceLegend(Axis.data.periodAt(st.year));
      } else {
        var period = Axis.data.periodAt(st.year) || {};
        eyebrowEl.textContent = "事件定位";
        rightHead.textContent = "中国 · 事件定位";
        dateEl.textContent = item.date || "";
        titleEl.textContent = item.title;
        summaryEl.textContent = item.summary || "";
        chapterEl.textContent = item.chapter || "";
        tagsEl.innerHTML = (item.tags || []).map(function (t) {
          return "<span>" + U.esc(t) + "</span>";
        }).join('<span class="dot"></span>');
        if (rightPill) rightPill.textContent = period.boundaryNote || "疆界示意";
        this.renderForceLegend(period);
      }
    } else {
      eyebrowEl.textContent = "事件定位";
      rightHead.textContent = tab === "mao" ? "毛中特 · 理论坐标" : "中国 · 事件定位";
      dateEl.textContent = "—";
      titleEl.textContent = "等待选择";
      summaryEl.textContent = "点击时间轴节点、地图事件点，或拖动年份扫过历史。";
      chapterEl.textContent = "";
      tagsEl.innerHTML = "";
      if (rightPill) rightPill.textContent = tab === "mao" ? "1921—2025" : "疆界示意";
      if (tab === "mao") this.renderTheoryLegend(null, false);
      else this.renderForceLegend(Axis.data.periodAt(st.year));
    }
    this.renderRelation(tab);
    this.renderRelated(item);
    this.renderRightFoot(item, topic);
  };

  panels.renderForceLegend = function (period) {
    var grid = U.$("#legendGrid"), main = U.$("#legendMain"), title = U.$("#legendTitle"), era = U.$("#legendEra");
    if (!grid) return;
    if (!period) { grid.innerHTML = ""; return; }
    title.textContent = "势力图 · 省界示意";
    era.textContent = period.era || "";
    var keys = (period.legend || []).filter(function (k) { return Axis.data.forces[k]; });
    var names = keys.slice(0, 4).map(function (k) { return Axis.data.forces[k].name; });
    main.textContent = names.join(" · ") + (keys.length > 4 ? " 等 " + keys.length + " 方" : "");
    var st = Axis.app.state;
    grid.innerHTML = keys.map(function (k) {
      var f = Axis.data.forces[k];
      var active = st.forceFilter === k;
      return '<button class="legend-item' + (active ? " active" : "") + '" data-force="' + U.esc(k) + '">' +
        '<span class="legend-dot" style="background:' + f.color + ';color:' + f.color + '"></span>' +
        U.esc(f.name) + "</button>";
    }).join("");
    var self = this;
    U.$$("#legendGrid .legend-item").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-force");
        Axis.app.setForceFilter(st.forceFilter === k ? null : k);
        self.renderForceLegend(period);
      });
    });
  };

  panels.renderTheoryLegend = function (theoryId, all) {
    var grid = U.$("#legendGrid"), main = U.$("#legendMain"), title = U.$("#legendTitle"), era = U.$("#legendEra");
    var st = Axis.app.state;
    title.textContent = "理论谱系 · 五条主线";
    era.textContent = "马克思主义中国化时代化";
    var theories = Axis.data.theories;
    var cur = theoryId ? Axis.data.getTheory(theoryId) : null;
    main.textContent = cur ? cur.name : "五条主线";
    grid.innerHTML = theories.map(function (t) {
      var active = st.theoryFilter === t.id || (cur && cur.id === t.id);
      return '<button class="legend-item' + (active ? " active" : "") + '" data-theory="' + U.esc(t.id) + '">' +
        '<span class="legend-dot" style="background:' + t.color + ';color:' + t.color + '"></span>' +
        U.esc(t.short || t.name) + "</button>";
    }).join("");
    var self = this;
    U.$$("#legendGrid .legend-item").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-theory");
        Axis.app.setTheoryFilter(st.theoryFilter === id ? null : id);
        self.renderTheoryLegend(theoryId, all);
      });
    });
  };

  panels.renderRelation = function (tab) {
    var list = U.$("#relationList"), title = U.$("#relationTitle");
    if (!list) return;
    if (tab === "mao") {
      title.textContent = "关系 · 理论演进";
      list.innerHTML =
        '<li><span class="rel-line"></span><span><em>一脉相承</em> · 坚持马克思主义立场</span></li>' +
        '<li><span class="rel-line cause"></span><span><em>发展 / 丰富</em> · 回答新的时代课题</span></li>' +
        '<li><span class="rel-line solid"></span><span><em>确立 / 写入党章</em> · 成为指导思想</span></li>' +
        '<li><span class="rel-line turn"></span><span><em>转折 / 开创</em> · 实现新的飞跃</span></li>';
    } else {
      title.textContent = "虚线 · 考点关联";
      list.innerHTML =
        '<li><span class="rel-line"></span><span><em>促进 / 推动 / 发展</em></span></li>' +
        '<li><span class="rel-line cause"></span><span><em>因果 / 背景 / 转折</em></span></li>' +
        '<li><span class="rel-line turn"></span><span><em>阻碍 / 失败 / 被迫</em></span></li>' +
        '<li><span class="rel-line block"></span><span><em>失败教训 / 被迫转型</em></span></li>';
    }
  };

  panels.renderRelated = function (item) {
    var box = U.$("#relatedCurrent");
    if (!box) return;
    if (!item) { box.innerHTML = ""; return; }
    if (item.kind === "theory") {
      box.innerHTML = '<div class="related-title">当前考点关联</div><div class="rel-empty">理论关系见左侧「理论图谱」</div>';
      return;
    }
    var rels = Axis.data.relationsFor(item.uid);
    if (!rels.length) {
      box.innerHTML = '<div class="related-title">当前考点关联</div><div class="rel-empty">当前事件暂无关联边</div>';
      return;
    }
    box.innerHTML = '<div class="related-title">当前考点关联</div>' + rels.slice(0, 6).map(function (r) {
      return '<button class="related-item" type="button" data-uid="' + U.esc(r.target.uid) + '">' +
        '<span class="rel-line ' + U.esc(r.type) + '"></span>' +
        '<span class="rel-type">' + U.esc(Axis.data.REL_NAMES[r.type] || r.type) + "</span>" +
        '<span class="rel-target">' + (r.dir === "in" ? "← " : "") + U.esc(r.target.title) + "</span>" +
        "</button>";
    }).join("");
  };

  panels.renderRightFoot = function (item, topic) {
    var el = U.$("#rightFoot");
    if (!el) return;
    if (topic) el.textContent = "专题：" + (topic.chapter || "") + " · 以 2023 版教材为准";
    else if (item && item.kind === "theory") el.textContent = "毛中特 · 理论坐标 · " + (item.date || "");
    else if (item) el.textContent = "史纲 · " + (item.chapter || "") + " · 以 2023 版教材为准";
    else el.textContent = "以 2023 版教材为准 · 仅供复习参考";
  };

  Axis.panels = panels;
})();
